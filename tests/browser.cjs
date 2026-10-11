const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createServer } = require('../scripts/serve.cjs');
const out = path.resolve(__dirname, '../test-results');
fs.mkdirSync(out, { recursive: true });

(async () => {
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const candidates = [process.env.CHROME_PATH, puppeteer.executablePath(), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
    const browser = await puppeteer.launch({ headless: true, executablePath: candidates.find(p => fs.existsSync(p)) });
    const errors = [], failures = [];
    async function setup(page, fallback = false, route = '') {
        await page.setRequestInterception(true);
        page.on('request', req => {
            if (!req.url().startsWith(url)) return req.abort();
            if (fallback && req.url().includes('/assets/generated/')) return req.abort();
            req.continue();
        });
        page.on('pageerror', e => errors.push(e.stack));
        page.on('response', r => { if (r.url().startsWith(url) && r.status() >= 400) failures.push(r.url()); });
        await page.evaluateOnNewDocument(() => {
            let id = 0, time = 0;
            const pending = new Map();
            window.requestAnimationFrame = fn => { pending.set(++id, fn); return id; };
            window.cancelAnimationFrame = n => pending.delete(n);
            window.__advance = frames => {
                time = Math.max(time, performance.now());
                for (let i = 0; i < frames; i++) { time += 1000 / 60; const batch = [...pending.values()]; pending.clear(); batch.forEach(fn => fn(time)); }
            };
        });
        await page.goto(url + route, { waitUntil: 'networkidle0' });
    }
    try {
        const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 }); await setup(page);
        await page.waitForFunction(() => Object.values(GameArt.ready()).every(Boolean));
        const levelCount = await page.evaluate(() => Levels.length);
        assert.equal(levelCount, 10, '本次战役应包含第十关');
        const summary = [];
        for (let index = 0; index < levelCount; index++) {
            await page.evaluate(index => { Game.selectLevel(index); Game.selectDifficulty('normal'); __advance(60); }, index);
            assert.equal(await page.evaluate(() => Game._debug().state), 'playing');
            assert.ok(await page.evaluate(() => { const d = Game._debug(); return d.enemies.filter(e => e.x > d.levelData.originalWidth + 1000).every(e => !e.activated); }));
            // 使用真实 Player.update 跑完扩展段；新增第十关同时覆盖从起点到决战区的完整路线。
            const route = await page.evaluate(() => {
                const level = Game._debug().levelData;
                const fullRoute = level.boss.archetype === 'astral_regent';
                const start = fullRoute ? level.playerStart : { x:level.originalWidth - 150, y:500 };
                const p = new Player(start.x, start.y); p.onGround = !fullRoute;
                const maxFrames = Math.ceil((level.levelWidth - start.x) / 200 * 60) + 300;
                const down = Input.isDown, pressed = Input.wasPressed, mouse = Input.isMouseDown;
                let jump = false, minY = 500, maxY = 500;
                Input.isDown = key => key === 'KeyD'; Input.wasPressed = key => key === 'KeyW' && jump; Input.isMouseDown = () => false;
                try {
                    for (let i = 0; i < maxFrames && p.x < level.levelWidth - 200 && !p.dead; i++) {
                        const floor = level.platforms.find(f => f.h > 50 && p.x >= f.x && p.x <= f.x + f.w && Math.abs(p.y - f.y) < 6);
                        jump = p.onGround && floor && floor.x + floor.w - p.x < 90;
                        p.update(1/60, level.platforms); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                    }
                    return { x:p.x, start:start.x, end:level.levelWidth, dead:p.dead, minY, maxY, fullRoute };
                } finally { Input.isDown = down; Input.wasPressed = pressed; Input.isMouseDown = mouse; }
            });
            assert.equal(route.dead, false, `关卡 ${index + 1} 扩展路线坠亡`);
            assert.ok(route.x >= route.end - 210, `关卡 ${index + 1} 路线未走通`);
            await page.evaluate(() => {
                const d = Game._debug(); d.player.x = d.levelData.originalWidth + 550; d.player.y = 500;
                d.player.takeDamage = () => 0; d.player.stagnationDamage = 0; d.player.stagnationTimer = -100;
                d.player.appearance = HeroAppearance.TIERS[4]; __advance(80); d.player.invincibleTimer = 0;
            });
            await page.screenshot({ path: path.join(out, `level-${index + 1}.png`) });
            // 敌军清完也不能在远处提前召唤 Boss；走到决战区才触发。
            await page.evaluate(() => { const d = Game._debug(); d.enemies.length = 0; d.player.x = d.levelData.originalWidth; __advance(160); });
            assert.equal(await page.evaluate(() => !!Game._debug().boss), false);
            await page.evaluate(() => { const d = Game._debug(); d.player.x = d.levelData.arenaStart + 280; d.player.y = 500; __advance(230); });
            assert.ok(await page.evaluate(() => { const b = Game._debug().boss; return b && b.health > 0 && b.artIndex === Game._debug().currentLevel; }));
            await page.screenshot({ path: path.join(out, `boss-${index + 1}.png`) });
            summary.push({ level:index + 1, route:'passed', fullRoute:route.fullRoute, boss:'passed' });
        }
        // 旧的九关存档仍能继续：第九关结算解锁第十关，第十关击破后才进入结局。
        const storyContext = await browser.createBrowserContext();
        const story = await storyContext.newPage();
        await story.setViewport({ width: 1440, height: 900 }); await setup(story);
        await story.evaluate(() => {
            const prog = Progression.get('匿名特工'); prog.cleared = Array.from({ length: 8 }, (_, i) => i);
            Progression.save('匿名特工', prog);
            // 只隔离语音播放生命周期，真实伤害、击杀、结算和换关逻辑保持运行。
            Audio.playVoiceEpic = (key, complete) => complete();
            Game.showLevelSelect();
        });
        assert.equal(await story.$eval('[data-level="9"]', card => card.classList.contains('locked')), true);
        const scene = await story.$eval('[data-level="9"] .level-card__scene', el => ({ image:el.style.backgroundImage, size:el.style.backgroundSize, position:el.style.backgroundPosition }));
        assert.ok(scene.image.includes('level10-starcore.webp'));
        assert.equal(scene.size, 'cover'); assert.equal(scene.position, 'center center');
        async function enterAndDefeatBoss(target) {
            await target.evaluate(() => {
                const d = Game._debug(); d.enemies.length = 0;
                d.player.x = d.levelData.arenaStart + 280; d.player.y = 500;
                d.player.invincibleTimer = 1000; d.player.stagnationTimer = -1000;
                __advance(230);
                if (!Game._debug().boss) throw new Error('未触发真实决战区首领');
                const b = Game._debug().boss;
                b.takeDamage(b.maxHealth * 10);
                // 加速已验证过的死亡演出，保留 game.js 的真实击杀结算与异步切换。
                b.deathTimer = 3; FX.clear(); __advance(1);
            });
        }
        await story.evaluate(() => { Game.selectLevel(Levels.length - 2); Game.selectDifficulty('normal'); __advance(60); });
        await enterAndDefeatBoss(story);
        await story.waitForFunction(() => Game._debug().state === 'levelComplete', { timeout: 8000, polling:50 });
        const ninth = await story.evaluate(() => ({ state:Game._debug().state, cleared:Progression.get('匿名特工').cleared,
            grade:Game.bestGrades()[8], unlocked:Progression.isUnlocked('匿名特工',9,Game.bestGrades()), ending:Ending.isOn() }));
        assert.equal(ninth.ending, false); assert.ok(ninth.cleared.includes(8)); assert.ok(!ninth.cleared.includes(9));
        assert.ok(ninth.grade); assert.equal(ninth.unlocked, true);
        await story.evaluate(() => {
            const choice = document.querySelector('.upgrade-choice-card').getAttribute('onclick').match(/'([^']+)'/)[1];
            Game.chooseUpgrade(choice);
            window.__nextMusic = [];
            const play = Audio.playBgm, stop = Audio.stopBgm;
            Audio.playBgm = key => { __nextMusic.push({ play:key }); return play(key); };
            Audio.stopBgm = () => { __nextMusic.push({ stop:true }); return stop(); };
            Game.nextLevel();
        });
        await story.waitForFunction(() => Game._debug().state === 'playing' && Game._debug().currentLevel === Levels.length - 1, { polling:50 });
        const tenth = await story.evaluate(() => ({ name:Game._debug().levelData.name, artIndex:Game._debug().levelData.artIndex,
            music:__nextMusic, grades:Game.bestGrades() }));
        assert.ok(tenth.name.includes('星环中枢')); assert.equal(tenth.artIndex, 9);
        assert.ok(tenth.music.some(call => call.stop)); assert.ok(!tenth.music.some(call => call.play), '第十关暂不添加背景音乐');
        assert.equal(await story.evaluate(() => !!document.querySelector('#now-playing.is-on')), false, '无配乐的第十关不应残留上一关曲名');
        assert.equal(tenth.grades[9], undefined);
        await enterAndDefeatBoss(story);
        await story.waitForFunction(() => Game._debug().state === 'victory', { timeout: 8000, polling:50 });
        assert.ok(await story.evaluate(() => Progression.get('匿名特工').cleared.includes(9) && !!Game.bestGrades()[9]));
        await story.waitForFunction(() => Ending.isOn(), { timeout: 5000, polling:50 });
        assert.equal(await story.$$eval('.ending-grade', badges => badges.length), levelCount);
        assert.equal(await story.$eval('.ending-sub', el => el.textContent), `${levelCount} 关最佳评级`);
        await story.evaluate(() => {
            Ending.next(); // 结算 → 小兵巡礼。
            for (let i = 0; i < Math.ceil(Object.keys(Game.enemyInfo()).length / 4); i++) Ending.next();
        });
        for (let index = 0; index < levelCount; index++) {
            assert.ok(await story.$eval('#ending-parade-title', el => el.textContent).then(text => text.includes(`第 ${index + 1} 关首领`)));
            await story.evaluate(() => Ending.next());
        }
        assert.ok(await story.$eval('#ending-roll', el => el.textContent).then(text => text.includes(`${levelCount} 位首领`) && text.includes('星环主宰·轨道裁决者')));
        await story.evaluate(() => Ending.finish());
        await storyContext.close();
        // 经验边界在新开局生效，成长界面同时展示真实战斗形态和概念图。
        await page.evaluate(() => {
            const data = Progression.get('匿名特工'); data.xp = 0;
            for (let lv = 1; lv < 20; lv++) data.xp += Math.round(400 * Math.pow(lv, 1.35));
            Progression.save('匿名特工', data); Game.selectDifficulty('normal'); __advance(1); Game.showGrowth();
        });
        assert.equal(await page.evaluate(() => Game._debug().player.appearance.index), 5);
        assert.equal(await page.$$eval('.g-skin', els => els.length), 6);
        await page.screenshot({ path: path.join(out, 'growth-evolution.png') });
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await page.evaluate(() => Game.showGrowth());
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(out, 'growth-mobile.png') });
        await page.evaluate(() => { Game.selectDifficulty('normal'); __advance(60); });
        await page.screenshot({ path: path.join(out, 'game-mobile.png') });
        // 独立演示使用与实战相同的渲染和物理，逐关检查腾空、下落、落地帧。
        const preview = await browser.newPage(); await preview.setViewport({width:1440,height:1000});
        await setup(preview, false, '/boss-motion-preview.html');
        await preview.waitForFunction(() => GameArt.ready().bossMotion);
        await preview.select('#attack','leap_slam');
        for(let index=0;index<levelCount;index++) {
            const motion = await preview.evaluate(index => {
                BossPreview.select(index);const seen=new Set();let minY=500,landed=false;
                for(let i=0;i<180;i++){__advance(1);const b=BossPreview.boss;
                    seen.add(BossMotion.frame(b));minY=Math.min(minY,b.y);landed ||= b.action?.kind==='land';}
                return {seen:[...seen],minY,landed,y:BossPreview.boss.y};
            },index);
            for(const frame of [8,9,10,11])assert.ok(motion.seen.includes(frame),`Boss ${index+1} 缺少动作姿态 ${frame}`);
            assert.ok(motion.landed && motion.minY<340 && motion.y===500);
        }
        await preview.evaluate(()=>{BossPreview.select(0);__advance(80);});
        await preview.screenshot({path:path.join(out,'boss-motion-preview.png')});
        // 放大对照所有图集的脚底、武器与动作边界。
        await preview.evaluate(()=>{
            const sheet=document.createElement('canvas');sheet.width=1200;sheet.height=Levels.length*205+50;
            sheet.style.cssText=`display:block;width:1200px;max-width:none;height:${sheet.height}px;aspect-ratio:1200/${sheet.height}`;const c=sheet.getContext('2d');
            c.fillStyle='#101d2c';c.fillRect(0,0,sheet.width,sheet.height);
            const labels=['待机','举武器蓄力','挥击','腾跃','落地'];
            c.font='16px system-ui';c.textAlign='center';c.fillStyle='#cce4ef';labels.forEach((t,i)=>c.fillText(t,i*240+120,30));
            for(let i=0;i<Levels.length;i++)for(let pose=0;pose<5;pose++){
                const b=new Boss(0,0,{...Levels[i].boss,h:150});b.entranceDone=true;b.facing=-1;
                if(pose===1)b.windup={type:'melee',timer:.1,duration:.8};
                if(pose===2)b.action={kind:'strike',elapsed:.2};
                if(pose===3){b.action={kind:'leap',landingX:0,landingY:0};b.vy=-200;}
                if(pose===4)b.action={kind:'land'};
                c.save();c.translate(pose*240+120,i*205+205);c.strokeStyle='#334c60';c.beginPath();c.moveTo(-110,0);c.lineTo(110,0);c.stroke();
                GameArt.drawBoss(c,b);c.restore();
            }
            document.body.replaceChildren(sheet);document.body.style.margin='0';
        });
        await preview.setViewport({width:1200,height:levelCount*205+50});
        await preview.screenshot({path:path.join(out,'boss-pose-contact-sheet.png')});
        // 新图集逐格放大检查全部 16 个姿态，脚底基线让裁切与邻格残片可直接检查。
        await preview.evaluate(() => {
            const sheet=document.createElement('canvas');sheet.width=1520;sheet.height=1360;
            sheet.style.cssText='display:block;width:1520px;max-width:none;height:1360px;aspect-ratio:1520/1360';
            const c=sheet.getContext('2d');c.fillStyle='#101d2c';c.fillRect(0,0,sheet.width,sheet.height);
            const labels=['待机','踏步一','踏步二','踏步三','压低蓄力','举刃','挥斩','随动','起跳','上升','下落','落地','施法蓄力','施法释放','受击','收招'];
            const frame=BossMotion.frame;
            try {
                for(let i=0;i<16;i++){
                    const x=i%4*380+190,y=Math.floor(i/4)*340+300;
                    c.font='16px system-ui';c.textAlign='center';c.fillStyle='#d4e9ff';c.fillText(`${i}. ${labels[i]}`,x,y-260);
                    c.save();c.translate(x,y);c.strokeStyle='#61788b';c.beginPath();c.moveTo(-170,0);c.lineTo(170,0);c.stroke();
                    const b=new Boss(0,0,{...Levels[9].boss,h:180});b.entranceDone=true;b.facing=-1;
                    BossMotion.frame=()=>i;GameArt.drawBoss(c,b);c.restore();
                }
            } finally { BossMotion.frame=frame; }
            document.body.replaceChildren(sheet);
        });
        await preview.setViewport({width:1520,height:1360});
        await preview.screenshot({path:path.join(out,'boss-10-all-poses.png')});
        // 单独的上下文隔离前面试玩安装的 Service Worker 与图片缓存，
        // 让这里真实模拟首次访问时素材下载失败，而不是命中旧缓存。
        const fallbackContext = await browser.createBrowserContext();
        const fallback = await fallbackContext.newPage(); await setup(fallback, true);
        await fallback.evaluate(() => { Game.selectLevel(Levels.length - 1); Game.selectDifficulty('normal'); __advance(90); });
        assert.equal(await fallback.evaluate(() => Game._debug().state), 'playing');
        assert.equal(await fallback.evaluate(() => GameArt.ready().backgrounds), false);
        await fallback.screenshot({ path: path.join(out, 'fallback.png') });
        await fallbackContext.close();
        assert.deepEqual(errors, []); assert.deepEqual(failures, []);
        fs.writeFileSync(path.join(out, 'browser-summary.json'), JSON.stringify({ summary, errors, failures, bossMotion:'passed', evolution:'passed', mobile:'passed', fallback:'passed', finale:{ ninth, tenth, verdict:'第九关继续，第十关结局' } }, null, 2));
        console.log(`通过：${levelCount} 关扩展段真实移动、全部 Boss、跳砸动画与落地物理、第九到第十关解锁及最终结局、远处敌人激活、外观进化、移动端、资源失败后备渲染。`);
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
