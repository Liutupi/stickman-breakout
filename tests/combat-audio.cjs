const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createServer } = require('../scripts/serve.cjs');

const voiceFiles = ['kill-8.mp3', 'kill-12.mp3', 'kill-16.mp3',
    'overdrive-start.mp3', 'boss-phase.mp3', 'boss-charge.mp3'];
const output = path.resolve(__dirname, '../test-results');

async function preparePage(page, origin, errors, failures) {
    await page.setViewport({ width: 1440, height: 900 });
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (!request.url().startsWith(origin)) return request.abort();
        if (new URL(request.url()).pathname === '/version.json') {
            return request.respond({ status: 200, contentType: 'application/json',
                body: JSON.stringify({ version: '9999-test-version-mismatch' }) });
        }
        return request.continue();
    });
    page.on('pageerror', error => errors.push(error.stack));
    page.on('response', response => {
        if (response.url().startsWith(origin) && response.status() >= 400) failures.push(response.url());
    });
    await page.evaluateOnNewDocument(() => {
        const NativeAudio = window.Audio;
        window.__media = [];
        window.Audio = function(...args) {
            const media = new NativeAudio(...args);
            __media.push(media);
            return media;
        };
        window.Audio.prototype = NativeAudio.prototype;
        let id = 0, time = 0;
        const pending = new Map();
        window.requestAnimationFrame = fn => { pending.set(++id, fn); return id; };
        window.cancelAnimationFrame = handle => pending.delete(handle);
        window.__advance = count => {
            time = Math.max(time, performance.now());
            for (let i = 0; i < count; i++) {
                time += 1000 / 60;
                const batch = [...pending.values()];
                pending.clear();
                batch.forEach(fn => fn(time));
            }
        };
    });
    await page.goto(origin, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
        Audio.init();
        window.__killCalls = [];
        window.__combatCalls = [];
        window.__banners = [];
        const kill = Audio.playKillVoice;
        Audio.playKillVoice = function(count) {
            const accepted = kill.call(Audio, count);
            __killCalls.push({ count, accepted });
            return accepted;
        };
        const combat = Audio.playCombatVoice;
        Audio.playCombatVoice = function(name, options) {
            const accepted = combat.call(Audio, name, options);
            const boss = Game._debug().boss;
            __combatCalls.push({ name, accepted, windup: boss?.windup?.type || null,
                windupTime: boss?.windup?.timer || 0, bullets: boss?.bullets.length || 0,
                hazards: boss?.hazards.length || 0 });
            return accepted;
        };
        const banner = FX.banner;
        FX.banner = function(text, options) {
            __banners.push({ text, channel: options?.channel });
            return banner.call(FX, text, options);
        };
    });
}

async function playing(page, filename) {
    await page.waitForFunction(filename => __media.some(media =>
        media.src.endsWith(filename) && !media.paused && media.readyState >= 2),
    { timeout: 10000, polling: 25 }, filename);
}

async function enterLevel(page, index) {
    await page.evaluate(index => {
        Audio.setBackgroundPaused(false);
        if (Audio.getMuted()) Audio.toggleMute();
        Audio.setSfxLevel(1);
        Audio.setMusicLevel(0.6);
        Game.selectLevel(index); Game.selectDifficulty('normal'); __advance(1);
        const p = Game._debug().player;
        p.invincibleTimer = 1000; p.stagnationTimer = -1000;
        __combatCalls.length = 0; __killCalls.length = 0; __banners.length = 0;
    }, index);
}

async function enterBoss(page, index = 9) {
    await enterLevel(page, index);
    await page.evaluate(() => {
        const d = Game._debug();
        d.enemies.length = 0; d.player.x = d.levelData.arenaStart + 280; d.player.y = 500;
        __advance(230);
        const boss = Game._debug().boss;
        if (!boss || !boss.entranceDone) throw new Error('未通过真实决战区生成完成入场的 Boss');
        boss.action = null; boss.windup = null; boss.attackCooldown = 1000;
        boss.bullets.length = 0; boss.hazards.length = 0;
        Audio.resetCombatVoices(); FX.clear();
        __combatCalls.length = 0; __banners.length = 0;
    });
}

// Let the real Boss.update -> executeAttack -> startWindup path create the warning.
async function beginAttack(page, type) {
    await page.evaluate(type => {
        const boss = Game._debug().boss;
        const index = boss.getAttackPool().indexOf(type);
        if (index < 0) throw new Error(`该 Boss 当前阶段没有 ${type} 攻击`);
        boss.action = null; boss.windup = null; boss.attackCooldown = 0;
        boss.stunTimer = 0; boss.onGround = true; boss.attackPattern = index;
        boss.bullets.length = 0; boss.hazards.length = 0;
        FX.clear(); __advance(1);
    }, type);
}

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const candidates = [process.env.CHROME_PATH, puppeteer.executablePath(),
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
    let browser;
    const errors = [], failures = [], checks = [];
    try {
        browser = await puppeteer.launch({ headless: true,
            executablePath: candidates.find(candidate => fs.existsSync(candidate)),
            args: ['--autoplay-policy=no-user-gesture-required'] });
        const page = await browser.newPage();
        await preparePage(page, origin, errors, failures);
        const decoded = await page.evaluate(async files => {
            const context = new AudioContext(), rows = [];
            try {
                for (const file of files) {
                    const response = await fetch(`assets/audio/voices/${file}`);
                    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
                    const bytes = await response.arrayBuffer(), byteLength = bytes.byteLength;
                    const buffer = await context.decodeAudioData(bytes);
                    const samples = buffer.getChannelData(0);
                    let peak = 0;
                    for (const value of samples) peak = Math.max(peak, Math.abs(value));
                    rows.push({ file, bytes: byteLength, duration: buffer.duration,
                        channels: buffer.numberOfChannels, peak });
                }
            } finally { await context.close(); }
            return rows;
        }, voiceFiles);
        assert.equal(decoded.length, 6);
        for (const row of decoded) assert.ok(row.bytes > 0 && row.duration > 0.1 && row.peak > 0.001, row.file);
        checks.push('6 条新增语音真实浏览器解码且非静音');

        await enterLevel(page, 0);
        for (let count = 1; count <= 16; count++) {
            await page.evaluate(() => {
                const enemy = Game._debug().enemies.find(e => !e.dead && e.type !== 'kamikaze');
                if (!enemy) throw new Error('没有可用于真实连杀的敌人');
                FX.clear(); enemy.takeDamage(enemy.maxHealth * 10 + 1000); __advance(5);
            });
            if ([8, 12, 16].includes(count)) {
                await playing(page, `kill-${count}.mp3`);
                assert.equal(await page.evaluate(() => __media.filter(a => /\/voices\//.test(a.src) && !a.paused).length), 1,
                    `${count} 杀播报不应叠音`);
            }
        }
        const streak = await page.evaluate(() => ({ combo: Game._debug().combo,
            milestones: __killCalls.filter(row => [8, 12, 16].includes(row.count)),
            banners: __banners.filter(row => row.channel === 'combo').map(row => row.text) }));
        assert.equal(streak.combo, 16);
        assert.deepEqual(streak.milestones.map(row => row.count), [8, 12, 16]);
        assert.ok(streak.milestones.every(row => row.accepted === true));
        for (const text of ['无人能挡', '主宰战场', '无双']) assert.ok(streak.banners.includes(text), text);
        await page.screenshot({ path: path.join(output, 'combat-audio-streak.png') });
        checks.push('真实 8/12/16 连杀播报与无人能挡、主宰战场、无双文字匹配');

        await enterLevel(page, 0);
        await page.evaluate(() => { Game._debug().enemies.length = 0; Game._debug().player.rage = 100; });
        await page.keyboard.down('v');
        await page.evaluate(() => __advance(1));
        await playing(page, 'overdrive-start.mp3');
        await page.evaluate(() => { FX.clear(); __advance(30); });
        await page.keyboard.up('v');
        assert.ok(await page.evaluate(() => Game._debug().player.overdriveTimer > 0));
        assert.equal(await page.evaluate(() => __combatCalls.filter(row => row.name === 'overdriveStart').length), 1,
            '按住狂暴键不能重复播报');
        await page.keyboard.press('v'); await page.evaluate(() => __advance(2));
        assert.equal(await page.evaluate(() => __combatCalls.filter(row => row.name === 'overdriveStart').length), 1,
            '狂暴期间再次按键不能重复激活');
        assert.ok(await page.evaluate(() => __banners.some(row => row.text === '狂暴模式')));
        checks.push('真实狂暴成功激活时播报一次，按住/重复按键不重播');

        await enterBoss(page);
        await page.evaluate(() => { Game._debug().boss.takeDamage(Game._debug().boss.maxHealth * 0.45); __advance(1); });
        await playing(page, 'boss-phase.mp3');
        await page.evaluate(() => { FX.clear(); __advance(20); });
        assert.equal(await page.evaluate(() => Game._debug().boss.phase), 1);
        assert.equal(await page.evaluate(() => __combatCalls.filter(row => row.name === 'bossPhaseVoice').length), 1);
        await page.evaluate(() => {
            Audio.stopVoices(); FX.clear();
            Game._debug().boss.takeDamage(Game._debug().boss.maxHealth * 0.3); __advance(1);
        });
        await playing(page, 'boss-phase.mp3');
        await page.evaluate(() => { FX.clear(); __advance(20); });
        assert.equal(await page.evaluate(() => Game._debug().boss.phase), 2);
        assert.equal(await page.evaluate(() => __combatCalls.filter(row => row.name === 'bossPhaseVoice').length), 2,
            '每次真实阶段跃迁一次，后续帧不重复');
        assert.ok(await page.evaluate(() => __banners.some(row => row.text === '第二阶段') && __banners.some(row => row.text === '狂怒形态')));
        checks.push('真实 Boss 两次阶段跃迁各播报一次，并保留阶段文字');

        await page.evaluate(() => { Audio.resetCombatVoices(); __combatCalls.length = 0; });
        await beginAttack(page, 'special');
        await playing(page, 'boss-charge.mp3');
        const telegraph = await page.evaluate(() => __combatCalls.find(row => row.name === 'bossChargeVoice'));
        assert.equal(telegraph.accepted, true);
        assert.equal(telegraph.windup, 'special'); assert.ok(telegraph.windupTime > 0);
        assert.equal(telegraph.bullets, 0); assert.equal(telegraph.hazards, 0);
        const priorities = await page.evaluate(() => ({
            kill: Audio.playKillVoice(8),
            overdrive: Audio.playCombatVoice('overdriveStart'),
            phase: Audio.playCombatVoice('bossPhaseVoice'),
        }));
        assert.deepEqual(priorities, { kill: false, overdrive: false, phase: false });
        await page.evaluate(() => __advance(4));
        assert.equal(await page.evaluate(() => __combatCalls.filter(row => row.name === 'bossChargeVoice').length), 1,
            '蓄力每帧不得重复播报');
        await page.screenshot({ path: path.join(output, 'combat-audio-boss-charge.png') });
        await page.evaluate(() => __advance(120));
        assert.equal(await page.evaluate(() => __combatCalls.filter(row => row.name === 'bossChargeVoice').length), 1,
            '攻击释放时不能再次播放蓄力音');
        await beginAttack(page, 'special');
        assert.equal(await page.evaluate(() => __combatCalls.filter(row => row.name === 'bossChargeVoice').at(-1).accepted), false,
            '连续大招预警应遵守默认 8 秒冷却');
        await page.evaluate(() => Audio.resetCombatVoices());
        await beginAttack(page, 'special'); await playing(page, 'boss-charge.mp3');
        assert.equal(await page.evaluate(() => __combatCalls.filter(row => row.name === 'bossChargeVoice').at(-1).accepted), true,
            '重置战斗播报后不能沿用上一局冷却');
        const warningCount = await page.evaluate(() => __combatCalls.filter(row => row.name === 'bossChargeVoice').length);
        await page.evaluate(() => Audio.resetCombatVoices());
        await beginAttack(page, 'teleport');
        assert.equal(await page.evaluate(() => __combatCalls.filter(row => row.name === 'bossChargeVoice').length), warningCount,
            '普通闪现前摇不应被当作大招蓄力');
        checks.push('大招在真实前摇创建时预警一次，释放不重复，8 秒冷却可重置，普通闪现不预警');
        checks.push('Boss 大招预警优先于连杀、狂暴和阶段播报');

        // A phase change and attack may begin in the same update. The danger warning wins.
        await enterBoss(page);
        await page.evaluate(() => {
            const boss = Game._debug().boss;
            boss.takeDamage(boss.maxHealth * 0.45);
            boss.attackPattern = boss.getAttackPool().indexOf('leap_slam');
            boss.attackCooldown = 0; boss.onGround = true; __advance(1);
        });
        await playing(page, 'boss-charge.mp3');
        const simultaneous = await page.evaluate(() => __combatCalls.filter(row =>
            ['bossChargeVoice', 'bossPhaseVoice'].includes(row.name)));
        assert.deepEqual(simultaneous.map(row => [row.name, row.accepted]),
            [['bossChargeVoice', true], ['bossPhaseVoice', false]]);
        checks.push('同帧阶段变化与大招开始时保留危险预警');

        // A rejected browser play must release its priority, allowing later ordinary cues.
        await page.evaluate(async () => {
            Audio.resetCombatVoices();
            const media = __media.find(a => a.src.endsWith('boss-charge.mp3'));
            const play = media.play;
            media.play = () => Promise.reject(new DOMException('测试拒播', 'NotAllowedError'));
            window.__rejectedRequestAccepted = Audio.playCombatVoice('bossChargeVoice', { cooldown: 0 });
            await new Promise(resolve => setTimeout(resolve, 0));
            media.play = play;
            window.__afterRejectionAccepted = Audio.playKillVoice(8);
        });
        assert.ok(await page.evaluate(() => __rejectedRequestAccepted === true && __afterRejectionAccepted === true));
        await playing(page, 'kill-8.mp3');
        checks.push('浏览器拒播后释放优先级，后续连杀仍可播放');

        await enterBoss(page, 5);
        await page.evaluate(() => {
            const boss = Game._debug().boss;
            boss.takeDamage(boss.maxHealth * 10); boss.deathTimer = 3;
            FX.clear(); __advance(1);
        });
        await playing(page, 'boss-06-settlement.mp3');
        const settlement = await page.evaluate(() => ({
            warning: Audio.playCombatVoice('bossChargeVoice', { priority: 99, cooldown: 0 }),
            equalPriority: Audio.playCombatVoice('bossChargeVoice', { priority: 100, cooldown: 0 }),
            excessivePriority: Audio.playCombatVoice('bossChargeVoice', { priority: 1000, cooldown: 0 }),
            invalidPriority: Audio.playCombatVoice('bossChargeVoice', { priority: NaN, cooldown: NaN }),
            overdrive: Audio.playCombatVoice('overdriveStart'),
            kill: Audio.playKillVoice(16),
        }));
        assert.deepEqual(settlement, { warning: false, equalPriority: false, excessivePriority: false,
            invalidPriority: false, overdrive: false, kill: false });
        assert.ok(await page.evaluate(() => __media.some(a => a.src.endsWith('boss-06-settlement.mp3') && !a.paused)));
        await page.waitForFunction(() => Game._debug().state === 'levelComplete', { timeout: 15000, polling: 25 });
        checks.push('Boss 结算语音不被任何战斗播报打断，仍可正常通关');

        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        assert.ok(await page.evaluate(() => {
            const bar = document.getElementById('update-bar');
            return !bar || getComputedStyle(bar).display === 'none' || !bar.getClientRects().length;
        }), '版本不一致时也不能出现底部更新提示');
        checks.push('即使版本号不一致也不显示底部更新提示');
        assert.deepEqual(errors, []); assert.deepEqual(failures, []);
        fs.writeFileSync(path.join(output, 'combat-audio-summary.json'),
            JSON.stringify({ checks, decoded, streak, telegraph, priorities, simultaneous, settlement, errors, failures }, null, 2));
        console.log(`通过：${checks.join('；')}。`);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
