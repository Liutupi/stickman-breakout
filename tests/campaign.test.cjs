const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function runtime() {
    const memory = new Map();
    const noop = new Proxy({}, { get: () => () => {} });
    const c = vm.createContext({ console, Math, Audio: noop, Particles: noop, Renderer: noop, FX: noop,
        localStorage: { getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, v) } });
    for (const file of ['utils.js', 'hero-appearance.js', 'progression.js', 'enemy-types.js', 'boss-motion.js', 'entities.js', 'levels.js', 'campaign.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, { filename: file });
    }
    return code => vm.runInContext(code, c);
}

test('九关新路线、补给、敌人和 Boss 全部位于有效地图内', () => {
    const run = runtime();
    const rows = run(`Levels.map(l => ({ width:l.levelWidth, old:l.originalWidth, sectors:l.sectors.length,
        arena:l.arenaStart, end:l.boss.x, bossFloor:l.platforms.some(p => l.boss.x > p.x && l.boss.x < p.x+p.w && p.y === l.boss.y),
        variants:[...new Set(l.enemies.filter(e=>e.x>l.originalWidth).map(e=>e.type))],
        invalid:l.enemies.some(e=>e.x<0 || e.x>l.levelWidth), supply:l.supplyBeacons.length,
        oldEnd:Math.max(...l.platforms.filter(p=>p.x<l.originalWidth-220).map(p=>p.x+p.w)) }))`);
    assert.equal(rows.length, 9);
    for (const row of rows) {
        assert.ok(row.width > row.old * 2.6); assert.equal(row.sectors, 8);
        assert.equal(row.supply, 6); assert.ok(row.bossFloor); assert.ok(row.end > row.arena);
        assert.equal(row.invalid, false);
        for (const type of ['lancer', 'scattergun', 'medic', 'sentinel']) assert.ok(row.variants.includes(type));
        assert.ok(row.oldEnd >= row.old - 400, '原路线必须能接到扩展入口');
    }
});

test('枪兵有蓄力、锁定方向和冷却，悬崖前能刹车', () => {
    const run = runtime();
    assert.ok(run(`(() => { const e=new Enemy(200,500,{type:'lancer',aggroRange:500,attackRate:2}); const floor=[{x:0,y:500,w:1500,h:100}]; e.onGround=true;
        e.update(.1,floor,400,500); if(e.x!==200 || !(e.telegraph>0)) return false;
        for(let i=0;i<8;i++) e.update(.1,floor,0,500);
        if(e.chargeDir!==1 || e.x<=200) return false;
        for(let i=0;i<8;i++) e.update(.1,floor,0,500);
        return e.attackCooldown>0 && !(e.chargeLeft>0); })()`));
    assert.ok(run(`(() => {const e=new Enemy(180,500,{type:'lancer'});e.onGround=true;e.chargeLeft=.3;e.chargeDir=1;
        e.update(.016,[{x:0,y:500,w:200,h:100}],400,500);return e.x===180 && e.chargeLeft===0;})()`));
});

test('散弹预警后才发射五发，下一次射击受冷却限制', () => {
    const run = runtime();
    assert.ok(run(`(() => {const e=new Enemy(200,500,{type:'scattergun',aggroRange:500,bulletSpeed:290,attackRate:2.6}); const f=[{x:0,y:500,w:1000,h:100}];
        for(let i=0;i<7;i++) e.update(.1,f,440,500);if(e.bullets.length) return false;
        e.update(.2,f,440,500); const count=e.bullets.length; e.update(.1,f,440,500);
        return count===5 && e.bullets.length===5 && e.attackCooldown>2;})()`));
});

test('医师只治疗范围内受伤同伴，受上限和冷却限制', () => {
    const run = runtime();
    assert.ok(run(`(() => {const m=new Enemy(200,500,{type:'medic',health:40,aggroRange:500});m.health=20;
        const a=new Enemy(280,500,{health:100}),far=new Enemy(800,500,{health:100});a.health=95;far.health=10;
        const f=[{x:0,y:500,w:1000,h:100}];m.update(2.1,f,450,500,[m,a,far]);
        if(a.health!==100 || m.health!==20 || far.health!==10)return false;
        a.health=50;m.update(.1,f,450,500,[m,a]);return a.health===50;})()`));
});

test('所有飞行单位持续悬浮，不被平台或重力拖落', () => {
    for (const type of ['flyer', 'bomber', 'swooper', 'drone', 'sentinel']) {
        const run = runtime();
        assert.ok(run(`(() => {const e=new Enemy(200,280,{type:'${type}',baseY:280});for(let i=0;i<900;i++)e.update(1/60,[{x:0,y:300,w:1000,h:100}],10000,500);return !e.dead && e.y>200 && e.y<340 && !e.onGround;})()`), type);
    }
});

test('外观等级边界、跨级奖励和独立存档兼容', () => {
    const run = runtime();
    for (const [lv, expected] of [[1,0],[2,0],[3,1],[5,1],[6,2],[9,2],[10,3],[14,3],[15,4],[19,4],[20,5],[99,5]]) {
        assert.equal(run(`HeroAppearance.forLevel(${lv}).index`), expected);
    }
    assert.ok(run(`(() => {const a=Progression.get('A');a.xp=0;Progression.save('A',a);
        const result=Progression.grant('A',{scoreGained:200000,bossKilled:true});
        const unlocked=HeroAppearance.TIERS.filter(t=>t.level>1 && t.level<=result.after.level);
        return result.appearanceUnlocks.length===unlocked.length && Progression.get('B').xp===0 && Progression.stats(result.prog).appearance.index===HeroAppearance.forLevel(result.after.level).index;})()`));
});

test('Boss 蓄力固定脚步和朝向，出手后才产生伤害', () => {
    const run = runtime();
    assert.ok(run(`(() => { const b=new Boss(700,500,{archetype:'shadow_king',arenaMin:0,arenaMax:1600});
        b.entranceDone=true;b.onGround=true;const f=[{x:0,y:500,w:1600,h:100}];
        b.startWindup('melee',900,500,.5);b.update(.3,f,300,500);
        if(b.x!==700 || b.facing!==1 || b.hazards.length || BossMotion.frame(b)!==5)return false;
        b.update(.21,f,300,500); if(b.hazards.length || b.action.kind!=='strike')return false;
        b.update(.1,f,300,500);if(b.hazards.length)return false;
        b.update(.08,f,300,500);return b.hazards.length===1 && b.facing===1 && BossMotion.frame(b)===6;
    })()`));
});

test('Boss 跳砸有完整抛物线，只在落地时放出冲击波并进入反击窗口', () => {
    const run=runtime();
    assert.ok(run(`(() => {const b=new Boss(600,500,{archetype:'sand_colossus',arenaMin:0,arenaMax:1600});
        b.entranceDone=true;b.onGround=true;b.attackCooldown=100;const f=[{x:0,y:500,w:1600,h:100}];
        b.performAttack({type:'leap_slam',x:1000,y:500});
        if(b.x!==600 || b.bullets.length || b.vy>=0)return false;
        let minY=500,ascending=false,descending=false,landed=false;
        for(let i=0;i<100;i++){b.update(1/60,f,100,500);minY=Math.min(minY,b.y);
            ascending ||= BossMotion.frame(b)===9; descending ||= BossMotion.frame(b)===10;
            if(b.action?.kind==='land'){landed=true;break;} if(b.bullets.length)return false;}
        if(!landed || !ascending || !descending || minY>340 || b.bullets.length!==2 || !b.isVulnerable())return false;
        const landingX=b.x;for(let i=0;i<40;i++)b.update(1/60,f,100,500);
        return b.onGround && b.y===500 && b.x===landingX && b.action.kind==='recover' && b.isVulnerable() && Math.abs(landingX-1000)<12;
    })()`));
});

test('Boss 冲锋不随玩家掉头，收招停止滑动，闪现也受决战场地约束', () => {
    const run=runtime();
    assert.ok(run(`(() => {const b=new Boss(600,500,{speed:100,arenaMin:300,arenaMax:1200});
        b.entranceDone=true;b.onGround=true;b.attackCooldown=100;b.facing=1;const f=[{x:0,y:500,w:1600,h:100}];
        b.performAttack({type:'charge',x:1000,y:500});for(let i=0;i<20;i++)b.update(1/60,f,0,500);
        if(b.x<=600 || b.facing!==1 || !(b.chargeTimer>0))return false;
        for(let i=0;i<25;i++)b.update(1/60,f,0,500);const end=b.x;
        if(b.action.kind!=='recover' || !b.isVulnerable())return false;
        for(let i=0;i<20;i++)b.update(1/60,f,0,500);if(b.x!==end)return false;
        b.action=null;b.facing=1;b.performAttack({type:'teleport',x:2000,y:500});
        b.update(.2,f,0,500);if(b.x!==end)return false;
        b.update(.05,f,0,500);return b.x<=1200-b.w/2 && b.x>=300+b.w/2;
    })()`));
});

test('九个 Boss 的完整技能循环、阶段切换、护盾计时和落地物理持续有效', () => {
    const run=runtime();
    assert.ok(run(`(() => {for(const level of Levels){const b=new Boss(level.boss.x,500,level.boss);
        b.entranceDone=true;b.onGround=true;const f=[{x:level.arenaStart,y:500,w:1600,h:100}];
        const seen=new Set();for(let i=0;i<2100;i++){if(i===900)b.health=b.maxHealth*.25;
            b.update(1/60,f,level.arenaStart+400,500);if(b.windup)seen.add(b.windup.type);
            if(!Number.isFinite(b.x+b.y+b.vx+b.vy)||b.x<b.arenaMin || b.x>b.arenaMax || b.y>501)return false;}
        if(seen.size<3 || b.phase!==2)return false;
        b.shieldTimer=.1;b.shieldActive=true;BossMotion.recover(b,1);b.update(.2,f,b.x-100,500);
        if(b.shieldActive)return false;
    }return true;})()`));
});
