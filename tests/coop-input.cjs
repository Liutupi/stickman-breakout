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
    const errors = [], results = [];
    const scenarios = [
        { name: '键鼠 1P + 单手柄 2P', pads: 1 },
        { name: '单人手柄切换为双人键鼠 1P + 手柄 2P', pads: 1, fromSolo: true },
        { name: '双手柄进行中 1P 改用鼠标', pads: 2 },
        { name: '触屏笔记本键鼠 1P + 手柄 2P', pads: 1, touch: true },
        { name: '非标准手柄静止扳机不抢走鼠标', pads: 2, idleTriggers: true },
    ];

    async function setup(scenario) {
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        await page.setViewport({ width: 1440, height: 900, isMobile: false, hasTouch: !!scenario.touch });
        page.on('pageerror', e => errors.push(e.stack));
        await page.setRequestInterception(true);
        page.on('request', req => req.url().startsWith(url) ? req.continue() : req.abort());
        await page.evaluateOnNewDocument(() => {
            let id = 0, time = 0;
            const pending = new Map();
            window.requestAnimationFrame = fn => { pending.set(++id, fn); return id; };
            window.cancelAnimationFrame = n => pending.delete(n);
            window.__advance = frames => {
                time = Math.max(time, performance.now());
                for (let i = 0; i < frames; i++) {
                    time += 1000 / 60;
                    const batch = [...pending.values()]; pending.clear(); batch.forEach(fn => fn(time));
                }
            };
            window.__pads = [];
            Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => window.__pads });
            window.__makePad = index => ({
                index, connected: true, id: `Regression virtual standard pad ${index}`, mapping: 'standard',
                axes: [0, 0, 0, 0],
                buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
            });
        });
        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.evaluate(scenario => {
            Game.setCoop(!scenario.fromSolo);
            Game.selectDifficulty('normal');
            window.__pads = Array.from({ length: scenario.pads }, (_, i) => __makePad(i));
            PadInput.start();
            // 唤醒手柄。2P 一直推住右摇杆向下，确保两名玩家输入相互独立。
            __pads[__pads.length - 1].axes[3] = 1;
            __advance(3);
            if (scenario.fromSolo) {
                if (!Input.gamepadActive()) throw new Error('单人手柄未激活');
                Game.setCoop(true);
            }
            if (scenario.pads === 2) {
                if (scenario.idleTriggers) {
                    __pads[0].mapping = '';
                    __pads[0].axes[4] = -1; __pads[0].axes[5] = -1;
                } else {
                    // 1P 保持摇杆不放；旧输入不能在鼠标接管后逐帧抢回瞄准。
                    __pads[0].axes[0] = .7;
                    __pads[0].axes[3] = 1;
                }
            }
            __advance(3);
            if (!Game.hasP2()) Game.joinP2();
            const d = Game._debug();
            for (const p of [d.player, d.p2]) {
                p.x = p.isP2 ? 500 : 600; p.y = 500; p.vx = 0; p.vy = 0;
                p.invincibleTimer = 100; p.stagnationTimer = -100;
                p.weapon.spread = 0; // 只测输入方向，消除手枪的随机散射。
            }
            // 清除敌人的干扰，让失效时的自动瞄准稳定朝水平；保持真实玩家更新与射击。
            d.enemies.forEach(e => { e.dead = true; e.health = 0; });
            __advance(4);
        }, scenario);
        return { context, page };
    }

    async function aimAndFire(page, point) {
        // 两次真实 mousemove，覆盖从任意初始指针位置切换回键鼠的情形。
        await page.mouse.move(720, 300);
        await page.mouse.move(point.x, point.y, { steps: 2 });
        await page.evaluate(() => {
            const p = Game._debug().player; p.bullets.length = 0; p.weapon.cooldown = 0;
            __advance(2);
        });
        await page.mouse.down();
        await page.evaluate(() => __advance(1));
        const snapshot = await page.evaluate(point => {
            const d = Game._debug(), p = d.player;
            const expected = Math.atan2(point.y / Renderer.viewScale() + Utils.camera.y - (p.y - (p.crouching ? 14 : 30)), point.x / Renderer.viewScale() + Utils.camera.x - p.x);
            const delta = a => Math.abs(Math.atan2(Math.sin(a - expected), Math.cos(a - expected)));
            const bullet = p.bullets[p.bullets.length - 1];
            const bulletAngle = bullet && Math.atan2(bullet.vy, bullet.vx);
            return {
                expected, arm: p.armAngle, armError: delta(p.armAngle),
                bulletAngle, bulletError: bullet ? delta(bulletAngle) : null,
                p2Arm: d.p2.armAngle, gamepadActive: Input.gamepadActive(), touch: Input.isTouch(),
                p1x: p.x, camera: { ...Utils.camera },
            };
        }, point);
        await page.mouse.up();
        return snapshot;
    }

    async function checkKeyboardAndPadSwitch(page) {
        await page.keyboard.down('KeyD');
        const mouse = await aimAndFire(page, { x: 200, y: 130 });
        const before = await page.evaluate(() => Game._debug().player.x);
        const keyboard = await page.evaluate(() => {
            __advance(8);
            return { rightHeld: Input.isDown('KeyD'), x: Game._debug().player.x, gamepadActive: Input.gamepadActive() };
        });
        await page.keyboard.up('KeyD');
        const pad = await page.evaluate(() => {
            // 松开再重新推动是新的有效操作，允许 1P 主动切回手柄。
            __pads[0].axes = [0, 0, 0, 0]; __advance(2);
            __pads[0].axes[2] = -1; __advance(3);
            return { active: Input.gamepadActive(), arm: Game._debug().player.armAngle, p2Arm: Game._debug().p2.armAngle };
        });
        return {
            pass: mouse.armError < .035 && keyboard.rightHeld && keyboard.x > before + 5 && !keyboard.gamepadActive
                && pad.active && Math.abs(Math.abs(pad.arm) - Math.PI) < .035 && Math.abs(pad.p2Arm - Math.PI / 2) < .035,
            mouse, keyboard, before, pad,
        };
    }

    async function checkTouchSwitch(page) {
        const client = await page.createCDPSession();
        const center = await page.$eval('#aim-area', el => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await page.evaluate(() => { const p = Game._debug().player; p.bullets.length = 0; p.weapon.cooldown = 0; });
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...center, id: 1 }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x - 40, y: center.y - 25, id: 1 }] });
        const touch = await page.evaluate(() => {
            __advance(3);
            const p = Game._debug().player, b = p.bullets[p.bullets.length - 1];
            const expected = Math.atan2(-25, -40);
            const error = a => Math.abs(Math.atan2(Math.sin(a - expected), Math.cos(a - expected)));
            return { armError: error(p.armAngle), bulletError: b ? error(Math.atan2(b.vy, b.vx)) : null, active: Input.getTouchAim().active, mode: Input.getAimMode ? Input.getAimMode() : null };
        });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await client.detach();
        const mouse = await aimAndFire(page, { x: 1180, y: 180 });
        return { pass: touch.active && touch.armError < .035 && touch.bulletError !== null && touch.bulletError < .035 && mouse.armError < .035 && mouse.bulletError !== null && mouse.bulletError < .035, touch, mouse };
    }

    try {
        for (const scenario of scenarios) {
            const { context, page } = await setup(scenario);
            try {
                const left = await aimAndFire(page, { x: 120, y: 150 });
                const right = await aimAndFire(page, { x: 1180, y: 180 });
                const keyboardAndPad = scenario.pads === 2 && !scenario.idleTriggers ? await checkKeyboardAndPadSwitch(page) : null;
                const touchSwitch = scenario.touch ? await checkTouchSwitch(page) : null;
                const pass = [left, right].every(s => s.armError < .035 && s.bulletError !== null && s.bulletError < .035 && Math.abs(s.p2Arm - Math.PI / 2) < .035)
                    && (!keyboardAndPad || keyboardAndPad.pass) && (!touchSwitch || touchSwitch.pass);
                results.push({ name: scenario.name, pass, left, right, keyboardAndPad, touchSwitch });
                console.log(`${pass ? '通过' : '失败'}：${scenario.name}；鼠标左/右瞄准误差 ${left.armError.toFixed(3)} / ${right.armError.toFixed(3)} rad`);
            } finally { await context.close(); }
        }
        fs.writeFileSync(path.join(out, 'coop-input-summary.json'), JSON.stringify({ results, errors }, null, 2));
        assert.deepEqual(errors, [], '浏览器出现脚本异常');
        assert.ok(results.every(r => r.pass), `双人模式鼠标方向回归失败：${results.filter(r => !r.pass).map(r => r.name).join('、')}`);
        console.log('通过：双人键鼠、手柄切换、触屏桌面鼠标瞄准与实际子弹方向。');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
