const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { simulateRoute } = require('./route-controller.cjs');
const root = path.resolve(__dirname, '..');
function runtime() {
    const memory = new Map();
    const noop = new Proxy({}, { get: () => () => {} });
    const c = vm.createContext({ console, Math, Audio: noop, Particles: noop, Renderer: noop, FX: noop,
        Input: { isDown:()=>false, wasPressed:()=>false, isMouseDown:()=>false,
            getMouse:()=>({x:10000,y:450}), getScrollDelta:()=>0, getHoldTime:()=>0 },
        localStorage: { getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, v) } });
    for (const file of ['utils.js', 'hero-appearance.js', 'progression.js', 'enemy-types.js', 'weapons.js', 'boss-motion.js', 'entities.js', 'levels.js', 'campaign.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, { filename: file });
    }
    vm.runInContext(simulateRoute.toString(), c);
    return code => vm.runInContext(code, c);
}

test('十关新路线、补给、敌人和 Boss 全部位于有效地图内', () => {
    const run = runtime();
    const rows = run(`Levels.map(l => ({ width:l.levelWidth, old:l.originalWidth, sectors:l.sectors.length,
        arena:l.arenaStart, end:l.boss.x, bossFloor:l.platforms.some(p => l.boss.x > p.x && l.boss.x < p.x+p.w && p.y === l.boss.y),
        variants:[...new Set(l.enemies.filter(e=>e.x>l.originalWidth).map(e=>e.type))],
        invalid:l.enemies.some(e=>e.x<0 || e.x>l.levelWidth), supply:l.supplyBeacons.length,
        oldEnd:Math.max(...l.platforms.filter(p=>p.x<l.originalWidth-220).map(p=>p.x+p.w)) }))`);
    assert.equal(rows.length, 10);
    for (const row of rows) {
        assert.ok(row.width > row.old * 2.6); assert.equal(row.sectors, 8);
        assert.equal(row.supply, 6); assert.ok(row.bossFloor); assert.ok(row.end > row.arena);
        assert.equal(row.invalid, false);
        assert.ok(row.variants.length >= 7, '每关扩展路段至少 7 种敌人');
        assert.ok(row.variants.filter(t => ['swarm','gunship','diver','flyer','drone','bomber','swooper','sentinel'].includes(t)).length >= 2, '每关至少 2 种空中敌人');
        assert.ok(row.oldEnd >= row.old - 400, '原路线必须能接到扩展入口');
    }
    // 每关兵种组合都不同，且后一关的扩展路段总血量不低于前一关（难度递增）
    const hp = run(`Levels.map(l => l.enemies.filter(e=>e.x>l.originalWidth).reduce((a,e)=>a+(e.health||30),0))`);
    for (let i = 1; i < rows.length; i++) {
        assert.notDeepEqual([...rows[i].variants].sort(), [...rows[i - 1].variants].sort(), `第 ${i + 1} 关兵种组合与上一关相同`);
        assert.ok(hp[i] >= hp[i - 1], `第 ${i + 1} 关难度没有递增`);
    }
});

test('后五关必须逐台跳跃，四种移动相位下普通二段跳均能通过且直跑必坠落', () => {
    const run = runtime();
    const counts = run('Levels.slice(5).map(l=>(l.traversalChallenges||[]).length)');
    assert.deepEqual([...counts], [4,5,5,5,5]);
    for (let index = 5; index < 10; index++) {
        const challenges = run(`Levels[${index}].traversalChallenges.map(c=>({id:c.id,kind:c.kind}))`);
        for (const challenge of challenges) {
            for (const phaseOffset of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
                const result = run(`simulateRoute(${JSON.stringify({index,challengeId:challenge.id,phaseOffset})})`);
                assert.equal(result.dead, false, `第 ${index+1} 关 ${challenge.id} 相位 ${phaseOffset} 坠落: ${JSON.stringify(result)}`);
                assert.ok(result.x >= result.end, `第 ${index+1} 关 ${challenge.id} 未走通: ${JSON.stringify(result)}`);
                assert.deepEqual([...result.challenges[0].landings.map(l=>l.step)], [1,2,3,4], '必须真实踩中每块中继台和终点台');
                assert.ok(result.jumps >= 4 && result.doubleJumps > 0, '必须实际起跳并覆盖二段跳');
            }
            const straight = run(`simulateRoute(${JSON.stringify({index,challengeId:challenge.id,noJump:true})})`);
            assert.equal(straight.dead, true, `第 ${index+1} 关 ${challenge.id} 不跳仍能过`);
            assert.ok(straight.x < straight.end, '直跑不能在坠亡前越过终点');
        }
    }
});

test('后五关从出生点连续跑通原路线、新断层与决战区，敌人和补给有真实落脚点', () => {
    const run = runtime();
    for (let index=5;index<10;index++) {
        const result=run(`simulateRoute({index:${index}})`);
        assert.equal(result.dead,false, `第 ${index+1} 关完整路线坠亡: ${JSON.stringify(result)}`);
        assert.ok(result.x>=result.end, `第 ${index+1} 关完整路线未到终点`);
        assert.ok(result.challenges.every(c=>c.complete && c.landings.length===4));
        const invalid=run(`(() => {
            const l=Levels[${index}], air=['flyer','bomber','swooper','drone','sentinel','swarm','gunship','diver'];
            const badEnemies=l.enemies.filter(e=>!air.includes(e.type)).filter(e=>
                !l.platforms.some(p=>e.x>=p.x+12 && e.x<=p.x+p.w-12 && Math.abs(e.y-p.y)<12));
            const badDrops=l.weaponDrops.filter(d=>!l.platforms.some(p=>
                d.x>=p.x+12 && d.x<=p.x+p.w-12 && Math.abs(d.y-p.y+4)<1));
            const intruders=l.enemies.filter(e=>l.traversalChallenges.some(c=>e.x>c.start-120&&e.x<c.end+120));
            return {enemies:badEnemies.map(e=>e.spawnId),drops:badDrops,intruders:intruders.map(e=>e.spawnId)};
        })()`);
        assert.equal(invalid.enemies.length,0, `第 ${index+1} 关敌人悬空: ${JSON.stringify(invalid)}`);
        assert.equal(invalid.drops.length,0, `第 ${index+1} 关补给悬空: ${JSON.stringify(invalid)}`);
        assert.equal(invalid.intruders.length,0,'断层前后应留出清场与落脚空间');
    }
});

test('第六关原基础地面兵在四种移动初相位下稳定站立，不再白掉敌人', () => {
    const run=runtime();
    const rows=run(`(() => {
        const result=[];
        for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
            const level=Levels[5],platforms=JSON.parse(JSON.stringify(level.platforms));
            const enemies=level.enemies.filter(e=>e.x<level.originalWidth &&
                !['flyer','bomber','swooper','drone','sentinel','swarm','gunship','diver'].includes(e.type))
                .map(config=>{const e=new Enemy(config.x,config.y,config);e.speed=0;return e;});
            platforms.forEach((p,i)=>{p._startX=p.x;p._startY=p.y;p._phase=phase+i*1.618;});
            const unsupported=new Set();
            for(let frame=0;frame<180;frame++){
                const time=frame/60;
                for(const p of platforms){const x=p.x,y=p.y,m=p.moving;
                    if(m?.ampX&&m.speedX)p.x=p._startX+Math.sin(time*m.speedX+p._phase)*m.ampX;
                    if(m?.ampY&&m.speedY)p.y=p._startY+Math.sin(time*m.speedY+p._phase+.5)*m.ampY;
                    p._dx=p.x-x;p._dy=p.y-y;
                }
                for(const e of enemies){e.update(1/60,platforms,1e6,500,enemies);if(frame>5&&!e.onGround)unsupported.add(e.spawnId);}
            }
            result.push({phase,count:enemies.length,fallen:enemies.filter(e=>e.dead).map(e=>e.spawnId),unsupported:[...unsupported]});
        }
        return result;
    })()`);
    for(const row of rows){
        assert.ok(row.count>=15,'保留原基础地面遭遇');
        assert.equal(row.fallen.length,0,`第六关地面兵坠亡: ${JSON.stringify(row)}`);
        assert.equal(row.unsupported.length,0,`第六关地面兵失去台面: ${JSON.stringify(row)}`);
    }
});

test('第六关高速浮台原路在四种随机初相位下均能从出生点连续走到决战区', () => {
    const run=runtime();
    for(const phaseOffset of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
        const result=run(`simulateRoute({index:5,phaseOffset:${phaseOffset}})`);
        assert.equal(result.dead,false,`第六关全程相位 ${phaseOffset} 坠亡: ${JSON.stringify(result)}`);
        assert.ok(result.x>=result.end,`第六关全程相位 ${phaseOffset} 未走通`);
        assert.ok(result.challenges.every(c=>c.complete&&c.landings.length===4));
    }
});

test('玩家能站稳高速升降台，平台上下转向不会穿漏，起跳后不再粘台', () => {
    const run=runtime();
    const rows=run(`(() => {
        const result=[],pressed=Input.wasPressed;
        for(const dt of [1/30,1/60,1/120]){
            const p=new Player(200,400),platform={x:100,y:400,w:220,h:18};p.onGround=true;
            let unsupported=0,maxError=0,jump=false;
            Input.wasPressed=key=>key==='KeyW'&&jump;
            p.update(dt,[platform]); // Establish support by a real collision before moving the pad.
            for(let i=0;i<Math.round(3/dt);i++){
                const x=platform.x,y=platform.y;
                platform.x=100+Math.sin((i+1)*dt*3.5)*120;
                platform.y=400+Math.sin((i+1)*dt*3.4)*130;
                platform._dx=platform.x-x;platform._dy=platform.y-y;
                p.update(dt,[platform]);maxError=Math.max(maxError,Math.abs(p.y-platform.y));
                if(!p.onGround)unsupported++;
            }
            platform._dx=0;platform._dy=0;
            jump=true;p.update(dt,[platform]);const left=!p.onGround&&p.vy<0;
            jump=false;p.update(dt,[platform]);
            result.push({dt,unsupported,maxError,left,airborne:!p.onGround});
        }
        Input.wasPressed=pressed;return result;
    })()`);
    for(const row of rows){
        assert.equal(row.unsupported,0,`高速升降台丢失玩家支撑: ${JSON.stringify(row)}`);
        assert.ok(row.maxError<1,`平台不能穿过角色脚底: ${JSON.stringify(row)}`);
        assert.ok(row.left&&row.airborne,'真实起跳后应脱离移动平台');
    }
});

test('首次落到高速上升台按相对交叉判定，台下和未追上的下降台不能吸附', () => {
    const run=runtime();
    const rows=run(`(() => {
        const rows=[];
        // 第六关原浮台 ampY=130、speedY=3.4 的峰速附近，覆盖不同帧率。
        for(const dt of [1/30,1/60,1/120])for(const scenario of ['risingContact','alreadyBelow','descendingAway']){
            const shift=Math.sin(dt*3.4)*130;
            const platform={x:100,y:400+(scenario==='descendingAway'?shift:-shift),w:220,h:18,
                _dx:0,_dy:scenario==='descendingAway'?shift:-shift};
            const p=new Player(200,scenario==='alreadyBelow'?412:399);
            p.vy=scenario==='descendingAway'?0:100;
            const before={y:p.y,vy:p.vy};p.update(dt,[platform]);
            const first={onGround:p.onGround,y:p.y,vy:p.vy,platformY:platform.y};
            if(scenario==='risingContact'){
                const y=platform.y;platform.y=400-Math.sin(dt*2*3.4)*130;platform._dy=platform.y-y;
                p.update(dt,[platform]);
            }
            rows.push({dt,scenario,before,first,onGround:p.onGround,y:p.y,platformY:platform.y});
        }
        return rows;
    })()`);
    for(const row of rows){
        if(row.scenario==='risingContact'){
            assert.ok(row.first.onGround&&row.first.y===row.first.platformY&&row.first.vy===0,
                `新落脚不能被高速上升台穿漏: ${JSON.stringify(row)}`);
            assert.ok(row.onGround&&row.y===row.platformY,'首次落脚后应正常随台移动');
        }else{
            assert.equal(row.first.onGround,false,`没有从上方交叉台面就不能吸附: ${JSON.stringify(row)}`);
            assert.ok(row.first.y>row.before.y&&row.first.vy>0,'未落地时应保留真实下落');
        }
    }
});

test('移动台支撑在走下、移除、换关对象和远距传送后立即解除', () => {
    const run=runtime();
    const rows=run(`(() => {
        const oldDown=Input.isDown,rows=[];
        try{
            for(const scenario of ['removed','replaced','teleported','walkedOff']){
                const platform={x:100,y:400,w:220,h:18},p=new Player(200,400);
                p.update(1/60,[platform]);
                let platforms=[platform];
                if(scenario==='walkedOff'){
                    Input.isDown=key=>key==='KeyD';
                    for(let i=0;i<32;i++)p.update(1/60,platforms);
                }
                Input.isDown=()=>false;
                if(scenario==='removed')platforms=[];
                if(scenario==='replaced')platforms=[{x:100,y:400,w:220,h:18}];
                if(scenario==='teleported'){p.x=1000;p.y=200;}
                platform.x+=180;platform.y-=100;platform._dx=180;platform._dy=-100;
                const before={x:p.x,y:p.y};p.update(1/60,platforms);
                rows.push({scenario,before,x:p.x,y:p.y,onGround:p.onGround});
            }
            return rows;
        }finally{Input.isDown=oldDown;}
    })()`);
    for(const row of rows){
        assert.equal(row.x,row.before.x,`旧支撑不能把玩家横向带走: ${JSON.stringify(row)}`);
        if(row.scenario==='replaced')assert.ok(row.onGround&&row.y===400,'新关卡台面应独立判定落脚');
        else assert.ok(!row.onGround&&row.y>row.before.y,'离开旧台后应继续正常重力');
    }
});

test('断层等待宽限覆盖八秒、保留挂机扣血，走动、起跳和离台会重置', () => {
    const run=runtime();
    const result=run(`(() => {
        const oldDown=Input.isDown,oldPressed=Input.wasPressed;
        let direction=0,jump=false;
        Input.isDown=key=>direction>0&&key==='KeyD';
        Input.wasPressed=key=>jump&&key==='KeyW';
        function snapshot(p){return {health:p.health,timer:p.stagnationTimer,warning:p.stagnationWarning,wait:p.traversalWaitTimer,ground:p.onGround};}
        function make(moving=false){
            const platform={x:100,y:450,w:700,h:20,traversalId:'test-wait'};
            const p=new Player(350,450);p.onGround=true;
            let time=0;
            return {p,platform,tick(frames){for(let i=0;i<frames;i++){
                time+=1/60;const x=platform.x,y=platform.y;
                if(moving){platform.x=100+Math.sin(time*.8)*70;platform.y=450+Math.sin(time*.9)*32;}
                platform._dx=platform.x-x;platform._dy=platform.y-y;
                p.update(1/60,[platform]);
            }}};
        }
        try{
            const rows=[];
            for(const moving of [false,true]){
                const test=make(moving),start=test.p.health;
                test.tick(480);const grace=snapshot(test.p);
                test.tick(180);const expired=snapshot(test.p);
                rows.push({moving,start,grace,expired});
            }
            const walk=make();walk.tick(450);direction=1;walk.tick(1);direction=0;
            const afterMove=snapshot(walk.p);walk.tick(450);const renewed=snapshot(walk.p);
            jump=true;walk.tick(1);jump=false;const afterJump=snapshot(walk.p);
            const exit=make();exit.platform.w=300;
            const ordinary={x:400,y:450,w:1800,h:30};direction=1;
            for(let i=0;i<50;i++)exit.p.update(1/60,[exit.platform,ordinary]);
            direction=0;const afterExit=snapshot(exit.p);
            for(let i=0;i<180;i++)exit.p.update(1/60,[exit.platform,ordinary]);
            const ordinaryWait=snapshot(exit.p);
            return {rows,afterMove,renewed,afterJump,afterExit,ordinaryWait};
        }finally{Input.isDown=oldDown;Input.wasPressed=oldPressed;}
    })()`);
    for(const row of result.rows){
        assert.equal(row.grace.health,row.start,'判断移动台时机不能被停滞扣血');
        assert.ok(row.grace.ground&&row.grace.wait>=7.99);
        assert.ok(row.grace.timer<.05&&row.grace.warning<.03,'八秒以内不能显示停滞警告');
        assert.ok(row.expired.health<row.start&&row.expired.timer>2,'超过十秒仍应触发挂机扣血');
    }
    assert.equal(result.afterMove.wait,0);assert.equal(result.afterMove.timer,0);
    assert.ok(result.renewed.wait>=7.49&&result.renewed.timer===0,'走动后应重新获得等待时间');
    assert.equal(result.afterJump.wait,0);assert.equal(result.afterJump.ground,false);
    assert.equal(result.afterExit.wait,0);assert.equal(result.afterExit.ground,true);
    assert.ok(result.ordinaryWait.health<result.afterExit.health&&result.ordinaryWait.timer>2,'普通地面仍按原三秒内开始扣血');
});

test('后五个 Boss 三阶段各有独立组合，新招预警固定目标且释放之前没有伤害', () => {
    const run=runtime();
    const result=run(`(() => {
        const profiles=[];
        for(const level of Levels.slice(5)) {
            const b=new Boss(700,500,{...level.boss,arenaMin:0,arenaMax:1600});b.entranceDone=true;b.onGround=true;
            const phases=[];
            for(let phase=0;phase<3;phase++){
                b.phase=phase;const pool=b.getAttackPool();phases.push(pool);
                for(const type of pool.filter(t=>['cross_slash','feint_dash','aerial_dive','lane_barrage'].includes(t))){
                    b.attackPattern=pool.indexOf(type);b.executeAttack(b.x+80,500,80);
                    if(b.windup.type!==type||b.windup.duration<.68)throw Error(type+' has insufficient warning');
                    b.windup=null;
                }
            }
            profiles.push(phases);
        }
        for(const type of ['cross_slash','feint_dash','aerial_dive','lane_barrage'])for(let phase=0;phase<3;phase++) {
            const b=new Boss(700,500,{...Levels[9].boss,arenaMin:0,arenaMax:1600});
            b.entranceDone=true;b.onGround=true;b.phase=phase;b.health=b.maxHealth*[1,.5,.2][phase];
            b.startWindup(type,1100,500,.9);const mark=b.windup;
            for(let i=0;i<40;i++)b.update(1/60,[{x:0,y:500,w:1600,h:100}],100,150);
            if(b.x!==700 || b.facing!==1 || b.windup!==mark || mark.x!==1100 || mark.y!==500 ||
                mark.dir!==1 || mark.phase!==phase || b.hazards.length || b.bullets.length)throw Error(type+' pre-warning changed');
        }
        return profiles;
    })()`);
    for (const phases of result) {
        assert.notDeepEqual([...phases[0]],[...phases[1]],'第二阶段应改变攻击节奏');
        assert.notDeepEqual([...phases[1]],[...phases[2]],'第三阶段应改变攻击节奏');
    }
    assert.equal(new Set(result.map(p=>JSON.stringify(p))).size,5,'五个后期 Boss 不能套同一技能表');
});

test('二连斩有两次独立命中区、可逃脱的间隔和停止滑动的反击窗口', () => {
    const run=runtime();
    const result=run(`(() => {
        const rows=[];
        for(let phase=0;phase<3;phase++)for(const dir of [-1,1]) {
            const b=new Boss(800,500,{...Levels[5].boss,arenaMin:0,arenaMax:1600});
            b.entranceDone=true;b.onGround=true;b.phase=phase;b.health=b.maxHealth*[1,.5,.2][phase];b.attackCooldown=100;b.facing=dir;
            b.performAttack({type:'cross_slash',x:800+dir*250,y:500,dir,phase});
            const seen=new Set(), hits=[];let recovered=false, safeFrames=0;
            for(let i=0;i<100;i++) {
                b.update(1/60,[{x:0,y:500,w:1600,h:100}],800-dir*600,500);
                for(const h of b.hazards)if(h.sourceAttack==='cross_slash'&&!seen.has(h)) {
                    seen.add(h);const rect={x:h.x-h.w/2,y:h.y-h.h,w:h.w,h:h.h};
                    if(!Utils.rectCollide(rect,{x:h.x-14,y:448,w:28,h:52}) ||
                        Utils.rectCollide(rect,{x:800-dir*250-14,y:448,w:28,h:52}) ||
                        Utils.rectCollide(rect,{x:h.x-14,y:190,w:28,h:52}))throw Error('unreadable hit region');
                    hits.push({time:i/60,dir:h.dir,swing:h.swing});
                }
                if(i>20&&i<42&&!b.hazards.some(h=>h.sourceAttack==='cross_slash'))safeFrames++;
                if(b.action?.kind==='recover'){recovered=true;if(b.action.duration<.5||!b.isVulnerable()||b.x!==800||b.vx!==0)throw Error('bad recovery');}
                if(BossMotion.frame(b)<0||BossMotion.frame(b)>15||b.facing!==dir)throw Error('pose/direction changed');
            }
            rows.push({hits,recovered,safeFrames});
        }
        return rows;
    })()`);
    for(const row of result){
        assert.equal(row.hits.length,2);assert.deepEqual([...row.hits.map(h=>h.swing)],[0,1]);
        assert.ok(row.hits[1].time-row.hits[0].time>=.5);assert.ok(row.safeFrames>=18);assert.ok(row.recovered);
    }
});

test('近战连斩会先接近远处玩家，接近后才出斩且不丢失技能顺序', () => {
    const run=runtime();
    assert.ok(run(`(() => {
        for(const level of Levels.slice(5))for(let phase=0;phase<3;phase++) {
            const b=new Boss(700,500,{...level.boss,arenaMin:0,arenaMax:1600});b.phase=phase;
            const index=b.getAttackPool().indexOf('cross_slash');if(index<0)continue;
            b.attackPattern=index;b.executeAttack(1450,500,750);
            if(b.windup.type==='cross_slash'||b.attackPattern!==index)return false;
            b.windup=null;b.executeAttack(780,500,80);
            if(b.windup.type!=='cross_slash'||b.attackPattern!==index+1)return false;
        }
        return true;
    })()`));
});

test('后撤冲刺先退再蓄力再前突，锁定端点与朝向，结束后真正停下来', () => {
    const run=runtime();
    assert.ok(run(`(() => {
        for(let phase=0;phase<3;phase++)for(const dir of [-1,1]) {
            const b=new Boss(800,500,{...Levels[6].boss,arenaMin:300,arenaMax:1300});
            b.entranceDone=true;b.onGround=true;b.phase=phase;b.health=b.maxHealth*[1,.5,.2][phase];b.attackCooldown=100;b.facing=dir;
            b.performAttack({type:'feint_dash',x:800+dir*400,y:500,dir,phase});
            const locked={...b.action.mark},states=new Set();let hit=false,recoverX;
            for(let i=0;i<130;i++) {
                b.update(1/60,[{x:0,y:500,w:1600,h:100}],800-dir*600,150);
                if(recoverX!==undefined&&!b.action)break;
                if(b.action)states.add(b.action.kind);
                if(b.x<b.arenaMin+b.w/2 || b.x>b.arenaMax-b.w/2 || b.y!==500 || b.facing!==dir)return false;
                if(b.action?.kind==='retreat'&&(b.x-800)*dir>0)return false;
                if(b.action?.kind==='dash'&&(b.x-locked.dashX)*dir>0)return false;
                hit ||= b.hazards.some(h=>h.sourceAttack==='feint_dash' && h.dir===dir);
                if(b.action?.kind==='recover') {
                    if(recoverX===undefined)recoverX=b.x;
                    if(b.x!==locked.dashX || b.x!==recoverX || b.vx!==0 || b.action.duration<.6 || !b.isVulnerable())return false;
                }
            }
            if(!['retreat','dash_ready','dash','recover'].every(s=>states.has(s)) || !hit)return false;
        }
        return true;
    })()`));
});

test('腾空俯冲锁定落点，飞越上层平台，只有落地才产生冲击并能离开标记躲开', () => {
    const run=runtime();
    assert.ok(run(`(() => {
        for(let phase=0;phase<3;phase++)for(const markX of [-2000,1100,5000]) {
            const b=new Boss(800,500,{...Levels[7].boss,arenaMin:300,arenaMax:1300});
            b.entranceDone=true;b.onGround=true;b.phase=phase;b.health=b.maxHealth*[1,.5,.2][phase];b.attackCooldown=100;
            b.performAttack({type:'aerial_dive',x:markX,y:150,dir:markX>800?1:-1,phase});
            const target=b.action.landingX,states=new Set();let minY=500,landed=false;
            const platforms=[{x:700,y:320,w:600,h:18},{x:0,y:500,w:1600,h:100}];
            for(let i=0;i<120;i++) {
                b.update(1/60,platforms,markX>800?100:1500,500);minY=Math.min(minY,b.y);
                if(b.action)states.add(b.action.kind);
                if(b.action?.kind==='land') {
                    landed=true;
                    if(b.x!==target || b.y!==500 || b.bullets.length!==2 || !b.hazards.some(h=>h.sourceAttack==='aerial_dive'))return false;
                    const h=b.hazards.find(h=>h.sourceAttack==='aerial_dive'),rect={x:h.x-h.w/2,y:h.y-h.h,w:h.w,h:h.h};
                    if(!Utils.rectCollide(rect,{x:target-14,y:448,w:28,h:52}) ||
                        Utils.rectCollide(rect,{x:target+200,y:448,w:28,h:52}))return false;
                    break;
                }
                if(b.bullets.length||b.hazards.length)return false;
            }
            if(!landed||minY>360||!['takeoff','hover','dive','land'].every(s=>states.has(s)))return false;
            for(let i=0;i<20;i++)b.update(1/60,platforms,100,500);
            if(b.x!==target||b.y!==500||b.action.kind!=='recover'||b.action.duration<.6||!b.isVulnerable())return false;
        }
        return true;
    })()`));
});

test('错层弹幕三拍保留完整角色宽度的安全层，弹道固定且不追踪，狂暴阶段换档', () => {
    const run=runtime();
    const result=run(`(() => {
        const phases=[];
        for(let phase=0;phase<3;phase++)for(const dir of [-1,1]) {
            const b=new Boss(800,500,{...Levels[8].boss,arenaMin:0,arenaMax:1600});
            b.entranceDone=true;b.onGround=true;b.phase=phase;b.health=b.maxHealth*[1,.5,.2][phase];b.attackCooldown=100;b.facing=dir;
            b.performAttack({type:'lane_barrage',x:800+dir*500,y:200,dir,phase,floorY:500});
            const seen=new Set(),shots=[];let recovered=false;
            for(let i=0;i<130;i++) {
                b.update(1/60,[{x:0,y:500,w:1600,h:100}],800-dir*600,100);
                for(const shot of b.bullets)if(!seen.has(shot)){
                    seen.add(shot);if(shot.sourceAttack!=='lane_barrage'||shot.vy!==0||Math.sign(shot.vx)!==dir||shot.homing)throw Error('tracked shot');
                    shots.push({beat:shot.laneBeat,gap:shot.gapIndex,y:shot.y,time:i/60});
                }
                if(b.action?.kind==='recover'){recovered=true;if(b.vx!==0||b.x!==800||b.action.duration<.5||!b.isVulnerable())throw Error('bad recovery');}
            }
            for(let beat=0;beat<3;beat++){
                const volley=shots.filter(s=>s.beat===beat),plan=BossMotion.lanePlan(b,beat,phase,500);
                if(volley.length!==2||volley.some(s=>s.gap!==plan.gap||s.y===plan.lanes[plan.gap]))throw Error('missing safe lane');
                const safe={x:800-14,y:plan.lanes[plan.gap]-26,w:28,h:52};
                for(const shot of volley)if(Utils.rectCollide({x:795,y:shot.y-5,w:10,h:10},safe))throw Error('gap too thin');
            }
            phases.push({phase,dir,shots,recovered});
        }
        return phases;
    })()`);
    for(const row of result){assert.equal(row.shots.length,6);assert.ok(row.recovered);assert.ok(row.shots[2].time-row.shots[0].time>=.4);}
    assert.notDeepEqual([...result[0].shots.map(s=>s.gap)],[...result[4].shots.map(s=>s.gap)],'狂暴阶段必须改变安全层节奏');
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
    for (const type of ['flyer', 'bomber', 'swooper', 'drone', 'sentinel', 'swarm', 'gunship', 'diver']) {
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

test('全部 Boss 的完整技能循环、阶段切换、护盾计时和落地物理持续有效', () => {
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

test('星环主宰按三阶段组合出招，裁决蓄力可读、闪现受边界约束且有反击窗口', () => {
    const run = runtime();
    assert.equal(run(`Levels[9].boss.archetype`), 'astral_regent');
    assert.equal(run(`Levels[9].artIndex`), 9);
    assert.equal(run(`Levels[9].previewArt`), 'assets/generated/level10-starcore.webp');
    assert.ok(run(`(() => {
        const b=new Boss(700,500,{...Levels[9].boss,arenaMin:0,arenaMax:1600});
        b.entranceDone=true;b.onGround=true;
        const pools=[];
        for(let phase=0;phase<3;phase++){
            b.phase=phase;pools.push(new Set(b.getAttackPool()));
            if(!['leap_slam','teleport','laser_sweep','homing_orb'].every(type=>pools[phase].has(type)))return false;
        }
        if(pools[0].has('portal_barrage') || pools[0].has('special') || !pools[1].has('portal_barrage') || pools[1].has('special') || !pools[2].has('special'))return false;
        b.phase=0;b.attackPattern=b.getAttackPool().indexOf('laser_sweep');b.executeAttack(1000,500,300);
        if(b.windup.type!=='laser_sweep' || b.windup.duration<.95)return false;
        const f=[{x:0,y:500,w:1600,h:100}];
        b.update(.5,f,100,500);
        if(b.x!==700 || b.facing!==1 || b.bullets.length || b.hazards.length || !b.windup)return false;
        b.windup=null;b.facing=1;b.performAttack({type:'teleport',x:2000,y:500});
        b.update(.2,f,100,500);if(b.x!==700)return false;
        b.update(.05,f,100,500);
        if(b.x>1600-b.w/2 || b.x< b.w/2)return false;
        b.update(.36,f,100,500);
        return b.action.kind==='recover' && b.action.duration>=.55 && b.isVulnerable();
    })()`));
});

test('星环跃击锁定起跳目标，落地发出两道冲击波并留足收招时间', () => {
    const run=runtime();
    assert.ok(run(`(() => {
        const b=new Boss(600,500,{...Levels[9].boss,arenaMin:0,arenaMax:1600});
        b.entranceDone=true;b.onGround=true;b.attackCooldown=100;
        const f=[{x:0,y:500,w:1600,h:100}];b.performAttack({type:'leap_slam',x:1000,y:500});
        if(b.action.landingX!==1000 || b.vy>=0 || b.bullets.length)return false;
        let minY=500,landed=false;
        for(let i=0;i<110;i++){
            b.update(1/60,f,50,500);minY=Math.min(minY,b.y);
            if(b.action?.kind==='land'){landed=true;break;}
            if(b.bullets.length)return false;
        }
        if(!landed || minY>=320 || Math.abs(b.x-1000)>12 || b.bullets.length!==2 || b.vulnerableTimer<1.2)return false;
        const x=b.x;for(let i=0;i<20;i++)b.update(1/60,f,50,500);
        return b.x===x && b.y===500 && b.action.kind==='recover' && b.action.duration>=.7 && b.isVulnerable();
    })()`));
});

test('星环跃击的预警圈与实际落点一致，远距和空中目标不会误导玩家', () => {
    const run=runtime();
    assert.ok(run(`(() => {
        Utils.camera.x=250;Utils.camera.y=40;
        for(const mark of [{x:5000,y:180},{x:-1000,y:260},{x:950,y:140}]){
            const b=new Boss(600,500,{...Levels[9].boss,arenaMin:300,arenaMax:1200});
            b.windup={...mark,type:'leap_slam',timer:.5,duration:1};
            const ellipses=[];
            const ctx=new Proxy({}, {get:(target,key)=>key==='ellipse'
                ? (...args)=>ellipses.push(args) : ()=>{}});
            b.drawWindup(ctx);b.performAttack(b.windup);
            if(ellipses.length!==1)return false;
            const [x,y]=ellipses[0];
            if(x+Utils.camera.x!==b.action.landingX || y+Utils.camera.y!==b.action.landingY)return false;
            if(b.action.landingX<300+b.w/2 || b.action.landingX>1200-b.w/2 || b.action.landingY!==500)return false;
        }
        return true;
    })()`));
});

// 发布检查：version.json 必须和 settings.js 里的 GAME_VERSION 一致，否则玩家会一直看到“有新版本”提示
test('version.json 与 GAME_VERSION 一致', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const root = path.resolve(__dirname, '..');
    const src = fs.readFileSync(path.join(root, 'settings.js'), 'utf8');
    const m = src.match(/const GAME_VERSION = '([^']+)'/);
    const json = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
    assert.equal(json.version, m && m[1]);
});
