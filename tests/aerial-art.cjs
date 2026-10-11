const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createServer } = require('../scripts/serve.cjs');

const out = path.resolve(__dirname, '../test-results');
fs.mkdirSync(out, { recursive: true });
const TYPES = ['swarm', 'gunship', 'diver', 'flyer', 'bomber', 'swooper', 'drone', 'sentinel'];

(async () => {
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const candidates = [process.env.CHROME_PATH, puppeteer.executablePath(), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
    let browser;
    const errors = [], failures = [];
    async function setup(context, fallback = false) {
        const page = await context.newPage();
        await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
        await page.setRequestInterception(true);
        page.on('request', req => {
            const target = req.url();
            if (!target.startsWith(url) || /\.(mp3|ogg|wav|mp4)(\?|$)/i.test(target)) return req.abort();
            if (fallback && target.includes('/assets/generated/')) return req.abort();
            req.continue();
        });
        page.on('pageerror', error => errors.push({ fallback, message: error.stack || error.message }));
        page.on('response', response => {
            if (response.url().includes('/aerial-v1/') && response.status() >= 400) failures.push(response.url());
        });
        await page.evaluateOnNewDocument(() => {
            let id = 0, time = 0;
            const pending = new Map();
            window.requestAnimationFrame = callback => { pending.set(++id, callback); return id; };
            window.cancelAnimationFrame = key => pending.delete(key);
            window.__advance = frames => {
                time = Math.max(time, performance.now());
                for (let i = 0; i < frames; i++) {
                    time += 1000 / 60;
                    const callbacks = [...pending.values()];
                    pending.clear(); callbacks.forEach(callback => callback(time));
                }
            };
        });
        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.evaluate(() => {
            // Disable sound in deterministic AI simulations; audio has its own browser lifecycle.
            Audio.play = () => {};
            Audio.playBgm = () => {};
            Utils.camera.x = 0; Utils.camera.y = 0;
            window.__airConfigs = {};
            for (const type of ['swarm', 'gunship', 'diver', 'flyer', 'bomber', 'swooper', 'drone', 'sentinel']) {
                const source = Levels.flatMap(level => level.enemies).find(enemy => enemy.type === type);
                if (!source) throw new Error(`关卡中缺少 ${type}`);
                __airConfigs[type] = { ...source };
            }
            window.__makeAir = (type, x = 260, y = 180) => {
                const e = new Enemy(x, y, { ...__airConfigs[type], baseY: y });
                e.baseY = y; e.phase = 0; e.homeX = x; e.side = 1;
                e.state = 'hover'; e.swoopState = 'hover'; e.swoopCooldown = 2;
                e.animTime = 1.25; e.attackCooldown = e.attackRate / 2; e.activated = true;
                e.facing = 1; return e;
            };
            window.__setAirPose = (e, pose) => {
                e.state = ['hover', 'tele', 'dive', 'return'][pose];
                if (e.type === 'diver') e.state = ['hover', 'aim', 'dive', 'recover'][pose];
                e.swoopState = ['hover', 'hover', 'dive', 'ascend'][pose];
                e.swoopCooldown = pose === 1 ? 0 : 2;
                e.telegraph = pose === 1 ? 0.6 : 0;
                e.lockX = e.x + 180; e.lockY = e.y + 220;
                e.attackCooldown = pose === 1 ? 0 : pose === 2 ? e.attackRate : e.attackRate * 0.5;
                e.burstLeft = pose === 2 ? 2 : 0;
                e.vx = pose === 2 ? 470 : pose === 3 ? 30 : 0;
                e.vy = pose === 2 ? 300 : pose === 3 ? -200 : 0;
                e.bullets = [];
                if (e.type === 'swooper') {
                    // Its AI uses swoopCooldown, rather than the shooting cooldown.
                    e.attackCooldown = 0;
                    e.swoopCooldown = pose === 1 ? 0.2 : 2;
                } else if (['gunship', 'flyer', 'bomber', 'drone', 'sentinel'].includes(e.type)) {
                    e.state = 'hover'; e.swoopState = 'hover'; e.vx = 0; e.vy = 0;
                    e.telegraph = pose === 1 && ['gunship', 'sentinel'].includes(e.type) ? 0.3 : 0;
                    e.burstLeft = e.type === 'sentinel' && pose === 2 ? 2 : 0;
                    e.attackCooldown = pose === 1 ? 0.2 : pose === 2 ? e.attackRate - 0.1 : pose === 3 ? e.attackRate - 0.4 : e.attackRate;
                    if (pose === 2 || pose === 3) e.bullets.push({ x: e.x + 90, y: e.y, vx: 200, vy: 0, size: 3, life: 1.5 });
                }
                return e;
            };
        });
        return page;
    }
    try {
        browser = await puppeteer.launch({ headless: true, executablePath: candidates.find(file => fs.existsSync(file)) });
        const context = await browser.createBrowserContext();
        const page = await setup(context);
        await page.waitForFunction(() => typeof AerialArt !== 'undefined' && AerialArt.ready(), { timeout: 60000 });
        assert.equal(await page.evaluate(() => GameArt.ready().aerial), true, 'GameArt 应报告八套空中素材全部就绪');

        const render = await page.evaluate(types => {
            Utils.camera.x = 0; Utils.camera.y = 0;
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 600;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            let images = 0;
            const drawImage = ctx.drawImage.bind(ctx);
            ctx.drawImage = (...args) => { images++; return drawImage(...args); };
            const rows = [];
            for (const type of types) {
                const row = { type, poses: [] };
                for (let pose = 0; pose < 4; pose++) {
                    const e = __setAirPose(__makeAir(type), pose);
                    const before = JSON.stringify(e.getRect()), beforeW = e.w, beforeH = e.h;
                    ctx.clearRect(0, 0, 600, 600); const count = images;
                    e.draw(ctx);
                    const pixels = ctx.getImageData(0, 0, 600, 600).data;
                    let opaque = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 32) opaque++;
                    row.poses.push({ requested: pose, selected: AerialArt.pose(e), images: images - count, opaque,
                        rectUnchanged: JSON.stringify(e.getRect()) === before && e.w === beforeW && e.h === beforeH });
                }
                rows.push(row);
            }
            return rows;
        }, TYPES);
        for (const row of render) for (const pose of row.poses) {
            assert.ok(pose.images > 0, `${row.type} 姿态 ${pose.requested} 没有经过真实 Enemy.draw 绘制位图`);
            assert.ok(pose.opaque > 80, `${row.type} 姿态 ${pose.requested} 没有可见机体`);
            assert.equal(pose.rectUnchanged, true, `${row.type} 绘制改变了碰撞尺寸`);
        }
        for (const type of TYPES) {
            assert.deepEqual(render.find(row => row.type === type).poses.map(pose => pose.selected), [0, 1, 2, 3], `${type} 四个 AI 状态应选中四个姿态`);
        }

        // 玩家越过俯冲机后，AI 仍沿已锁定目标飞行，机头必须保持沿速度方向。
        const diveDirection = await page.evaluate(() => {
            const e = __makeAir('swooper');
            e.swoopState = 'dive'; e.diveTargetX = e.x + 300; e.diveTargetY = e.y + 250;
            e.update(1 / 60, [], e.x - 100, 480, [e]);
            const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
            const scales = [], rotations = [], scale = ctx.scale.bind(ctx), rotate = ctx.rotate.bind(ctx);
            ctx.scale = (x, y) => { scales.push([x, y]); return scale(x, y); };
            ctx.rotate = angle => { rotations.push(angle); return rotate(angle); };
            const before = JSON.stringify({ facing:e.facing, vx:e.vx, vy:e.vy, rect:e.getRect() });
            const drawn = AerialArt.draw(ctx, e);
            return { drawn, facing:e.facing, vx:e.vx, vy:e.vy, scales, rotations,
                unchanged:before === JSON.stringify({ facing:e.facing, vx:e.vx, vy:e.vy, rect:e.getRect() }) };
        });
        assert.equal(diveDirection.drawn, true); assert.equal(diveDirection.facing, -1);
        assert.ok(diveDirection.vx > 0 && diveDirection.vy > 0);
        assert.deepEqual(diveDirection.scales, [[-1, 1]], '锁定向右俯冲时机头不能跟随身后玩家反向');
        assert.ok(Math.abs(diveDirection.rotations[0] - Math.atan2(diveDirection.vy, diveDirection.vx)) < 1e-8);
        assert.equal(diveDirection.unchanged, true, '视觉朝向修正不能改变 AI 或碰撞盒');
        assert.equal(await page.evaluate(() => {
            const e = __makeAir('gunship'); e.volley = 2; e.telegraph = 0.5;
            return AerialArt.pose(e);
        }), 2, '炮艇第三轮投弹的后半段前摇应打开弹舱攻击姿态');

        // Inspect a real red stroke outside the bitmap, so merely retaining state/lock fields cannot pass.
        const warning = await page.evaluate(() => {
            Utils.camera.x = 0; Utils.camera.y = 0;
            const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600;
            const ctx = canvas.getContext('2d');
            let segments = [], point = null; const strokes = [];
            const begin = ctx.beginPath.bind(ctx), move = ctx.moveTo.bind(ctx), line = ctx.lineTo.bind(ctx), stroke = ctx.stroke.bind(ctx);
            ctx.beginPath = () => { segments = []; point = null; return begin(); };
            ctx.moveTo = (x, y) => { point = { x, y }; return move(x, y); };
            ctx.lineTo = (x, y) => { if (point) segments.push(Math.hypot(x - point.x, y - point.y)); point = { x, y }; return line(x, y); };
            ctx.stroke = (...args) => { strokes.push({ color: ctx.strokeStyle, alpha: ctx.globalAlpha, width: ctx.lineWidth, longest: Math.max(0, ...segments) }); return stroke(...args); };
            const e = __setAirPose(__makeAir('diver'), 1); e.telegraph = 0.65; e.lockX = 560; e.lockY = 470;
            e.draw(ctx);
            const red = color => {
                const rgb = color.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);
                if (rgb) return +rgb[1] > 200 && +rgb[2] < 160 && +rgb[3] < 160;
                const hex = color.match(/^#([a-f\d]{6})/i);
                return hex && parseInt(hex[1].slice(0, 2), 16) > 200 && parseInt(hex[1].slice(2, 4), 16) < 160 && parseInt(hex[1].slice(4, 6), 16) < 160;
            };
            return { strokes, visible: strokes.some(s => s.alpha > 0.2 && s.width >= 1.5 && s.longest > 150 && red(s.color)) };
        });
        assert.equal(warning.visible, true, '雷鹰的锁定红线必须在位图机体路径中实际描画');

        const ai = await page.evaluate(() => {
            const platforms = [{ x: -1000, y: 500, w: 5000, h: 100 }, { x: 0, y: 180, w: 2000, h: 20 }];
            const swarm = __makeAir('swarm'); swarm.attackCooldown = 0;
            const swarmStates = new Set(); let swarmSpeed = 0;
            for (let i = 0; i < 220; i++) { swarm.update(1 / 60, platforms, 500, 500, [swarm]); swarmStates.add(swarm.state); if (swarm.state === 'dive') swarmSpeed = Math.max(swarmSpeed, Math.hypot(swarm.vx, swarm.vy)); }
            const diver = __makeAir('diver'); diver.attackCooldown = 0;
            for (let i = 0; i < 35; i++) diver.update(1 / 60, platforms, 500, 500, [diver]);
            const locked = { x: diver.lockX, y: diver.lockY }, aiming = diver.state;
            for (let i = 0; i < 16; i++) diver.update(1 / 60, platforms, 650, 470, [diver]);
            const dive = { state: diver.state, speed: Math.hypot(diver.vx, diver.vy), lockX: diver.lockX, lockY: diver.lockY };
            const diverStates = new Set([diver.state]);
            for (let i = 0; i < 200; i++) { diver.update(1 / 60, platforms, 500, 500, [diver]); diverStates.add(diver.state); }
            const ship = __makeAir('gunship'); ship.volley = 2; ship.attackCooldown = 0; ship.telegraph = 0.69;
            ship.update(1 / 60, platforms, 500, 500, [ship]);
            const bombs = ship.bullets.filter(bullet => bullet.bomb).map(bullet => ({ gravity: bullet.gravity, vy: bullet.vy }));
            const speedBefore = ship.bullets[0]?.vy;
            // Observe gravity before ground impact; the extra air platform deliberately tests
            // flying bodies above, but bombs are meant to collide with it.
            ship.update(0.1, platforms.filter(p => p.y === 500), 500, 500, [ship]);
            const bombFalling = ship.bullets[0]?.vy > speedBefore;
            const volley = __makeAir('gunship'); volley.attackCooldown = 0; volley.telegraph = 0.69;
            volley.update(1 / 60, platforms, 500, 500, [volley]);
            const swooper = __makeAir('swooper'); swooper.swoopCooldown = 0;
            const swoopStates = new Set();
            for (let i = 0; i < 220; i++) { swooper.update(1 / 60, platforms, 450, 480, [swooper]); swoopStates.add(swooper.swoopState); }
            return { swarm: { states: [...swarmStates], speed: swarmSpeed }, diver: { locked, aiming, dive, states: [...diverStates] },
                gunship: { bombs, bombFalling, volley: volley.bullets.length, volleyHasBombs: volley.bullets.some(b => b.bomb) },
                swooper: [...swoopStates], noLanding: [swarm, diver, ship, volley, swooper].every(e => !e.onGround && !e.dead) };
        });
        for (const state of ['tele', 'dive', 'return', 'hover']) assert.ok(ai.swarm.states.includes(state), `蜂群未完成 ${state}`);
        assert.ok(ai.swarm.speed > 450);
        assert.equal(ai.diver.aiming, 'aim'); assert.equal(ai.diver.dive.state, 'dive');
        assert.equal(ai.diver.dive.lockX, ai.diver.locked.x); assert.equal(ai.diver.dive.lockY, ai.diver.locked.y);
        assert.ok(ai.diver.dive.speed > 660); assert.ok(ai.diver.states.includes('recover'));
        assert.equal(ai.gunship.bombs.length, 3); assert.ok(ai.gunship.bombs.every(b => b.gravity === 650));
        assert.ok(ai.gunship.bombFalling); assert.equal(ai.gunship.volley, 5); assert.equal(ai.gunship.volleyHasBombs, false);
        for (const state of ['dive', 'ascend', 'hover']) assert.ok(ai.swooper.includes(state), `旧俯冲者未完成 ${state}`);
        assert.equal(ai.noLanding, true, '飞行设备不应被平台落地逻辑吸附或坠亡');

        const battle = [];
        for (const type of ['swarm', 'gunship', 'diver']) {
            const result = await page.evaluate(type => {
                const level = Levels.findIndex(level => level.enemies.some(e => e.type === type));
                Game.selectLevel(level); Game.selectDifficulty('normal'); __advance(2);
                const d = Game._debug(), e = d.enemies.find(e => e.type === type);
                d.player.x = e.x - 100; d.player.y = 500; d.player.takeDamage = () => 0;
                Utils.camera.x = d.player.x - Renderer.width() * 0.35; Utils.camera.y = 0;
                d.player.stagnationDamage = 0; d.player.stagnationTimer = -100;
                e.takeDamage = () => 0;
                e.attackCooldown = 0; const before = e.animTime, previous = AerialArt.draw;
                let visible = 0;
                AerialArt.draw = function(ctx, enemy) { const drawn = previous.call(this, ctx, enemy); if (drawn && enemy === e) visible++; return drawn; };
                // Capture its readable windup in the actual level before the dive passes
                // the player or the player's passive pulses destroy the showcase actor.
                // The distant gunship sits beneath the sector banner initially; wait for
                // that introduction to clear before taking its scale reference image.
                try { __advance(type === 'gunship' ? 210 : 30); } finally { AerialArt.draw = previous; }
                return { type, level: level + 1, activated: e.activated, updated: e.animTime > before, visible, state: Game._debug().state };
            }, type);
            assert.equal(result.state, 'playing'); assert.equal(result.activated, true); assert.equal(result.updated, true); assert.ok(result.visible > 0);
            battle.push(result);
            await page.screenshot({ path: path.join(out, `aerial-battle-${type}.png`) });
        }

        // Ending catches draw errors internally; record them before rethrowing to expose regressions.
        const parade = await page.evaluate(() => {
            const original = Enemy.prototype.draw, seen = new Set(), errors = [];
            Enemy.prototype.draw = function(ctx) {
                if (ctx.canvas.id === 'ending-canvas') seen.add(this.type);
                try { return original.call(this, ctx); } catch (error) { errors.push(`${this.type}: ${error.message}`); throw error; }
            };
            try {
                Ending.start({});
                // Let all four actors settle on stage, without reaching the 3.6 s auto-page.
                for (let page = 0; page < 5; page++) { if (page) Ending.next(); __advance(150); }
                return { seen: [...seen], errors, title: document.getElementById('ending-parade-title').textContent };
            } finally { Enemy.prototype.draw = original; }
        });
        assert.deepEqual(parade.errors, []);
        for (const type of TYPES) assert.ok(parade.seen.includes(type), `${type} 没有进入真实结局巡礼`);
        await page.screenshot({ path: path.join(out, 'aerial-ending-parade.png') });
        await page.evaluate(() => Ending.finish());

        await page.evaluate(types => {
            Utils.camera.x = 0; Utils.camera.y = 0;
            const canvas = document.createElement('canvas'); canvas.id = 'aerial-contact-sheet';
            canvas.width = 1600; canvas.height = 1780;
            canvas.style.cssText = 'position:absolute;left:0;top:0;width:1600px;height:1780px;z-index:2147483647;max-width:none';
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0b1421'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#e4f3ff'; ctx.font = 'bold 30px system-ui'; ctx.fillText('空中设备 · 实际游戏渲染', 48, 52);
            ctx.font = '17px system-ui'; ctx.fillStyle = '#8ca7be'; ctx.fillText('前三种为新增机型；下方对照悬停、前摇、攻击、恢复。所有机体通过 Enemy.draw。', 48, 83);
            ['swarm', 'gunship', 'diver'].forEach((type, index) => {
                const e = __makeAir(type, 0, 0), scale = type === 'swarm' ? 8 : type === 'diver' ? 6 : 4;
                // The large close-ups omit the in-world label, which would become an
                // 80 px heading; the same real Enemy.draw still renders each machine.
                const fillText = ctx.fillText;
                ctx.fillText = () => {};
                ctx.save(); ctx.translate(index * 520 + 280, 310); ctx.scale(scale, scale); e.draw(ctx); ctx.restore();
                ctx.fillText = fillText;
                ctx.font = '20px system-ui'; ctx.fillStyle = '#b7d5e8'; ctx.textAlign = 'center'; ctx.fillText(type, index * 520 + 280, 360);
            });
            const headings = ['悬停', '蓄力 / 锁定', '攻击', '恢复'];
            ctx.font = '19px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#b8d8f0';
            headings.forEach((text, index) => ctx.fillText(text, 410 + index * 330, 410));
            types.forEach((type, row) => {
                const top = 440 + row * 160;
                ctx.strokeStyle = '#23364b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(40, top); ctx.lineTo(1560, top); ctx.stroke();
                ctx.fillStyle = '#c4d8e8'; ctx.font = '20px system-ui'; ctx.textAlign = 'left'; ctx.fillText(type, 45, top + 80);
                for (let pose = 0; pose < 4; pose++) {
                    const e = __setAirPose(__makeAir(type, 0, 0), pose);
                    // Keep the lock marker inside each column while showing the targeting beam.
                    e.lockX = 45; e.lockY = 8;
                    const scale = type === 'gunship' ? 1.8 : type === 'swarm' ? 3 : 2;
                    ctx.save(); ctx.translate(410 + pose * 330, top + 112 + (type === 'gunship' ? 12 : 0)); ctx.scale(scale, scale); e.draw(ctx); ctx.restore();
                    ctx.fillStyle = '#607f98'; ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`AI → 帧 ${AerialArt.pose(e)}`, 410 + pose * 330, top + 145);
                }
            });
            document.body.appendChild(canvas);
        }, TYPES);
        await page.setViewport({ width: 1600, height: 1780 });
        await page.$eval('#aerial-contact-sheet', canvas => scrollTo(0, 0));
        await (await page.$('#aerial-contact-sheet')).screenshot({ path: path.join(out, 'aerial-contact-sheet.png') });

        const fallbackContext = await browser.createBrowserContext();
        const fallback = await setup(fallbackContext, true);
        assert.equal(await fallback.evaluate(() => AerialArt.ready()), false);
        const fallbackRender = await fallback.evaluate(types => {
            Utils.camera.x = 0; Utils.camera.y = 0;
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 600;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            return types.map(type => {
                const e = __setAirPose(__makeAir(type), 1);
                const vector = !GameArt.drawEnemy(ctx, e);
                ctx.clearRect(0, 0, 600, 600); e.draw(ctx);
                const pixels = ctx.getImageData(0, 0, 600, 600).data;
                let count = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 32) count++;
                return { type, vector, count };
            });
        }, TYPES);
        for (const row of fallbackRender) { assert.equal(row.vector, true); assert.ok(row.count > 80, `${row.type} 资源失败后缺少可见矢量后备`); }
        await fallback.evaluate(() => { Game.selectLevel(3); Game.selectDifficulty('normal'); __advance(90); });
        assert.equal(await fallback.evaluate(() => Game._debug().state), 'playing');
        await fallback.screenshot({ path: path.join(out, 'aerial-fallback.png') });
        assert.deepEqual(errors, []); assert.deepEqual(failures, []);
        fs.writeFileSync(path.join(out, 'aerial-summary.json'), JSON.stringify({ render, diveDirection, warning, ai, battle, parade, fallback: fallbackRender, errors, failures }, null, 2));
        console.log('通过：八种空中设备真实绘制、四姿态、碰撞尺寸、雷鹰红线、俯冲锁定与投弹 AI、实战激活、结局巡礼、资源失败后备。');
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
