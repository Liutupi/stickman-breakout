const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createServer } = require('../scripts/serve.cjs');

const settlements = [
    { index: 6, key: 'bossHomework', file: 'boss-07-settlement.mp3', text: '我还会回来检查你作业的' },
    { index: 7, key: 'bossDefeated', file: 'boss-08-settlement.mp3', text: '终于，我还是被你打败了' },
    { index: 8, key: 'bossDefeatedTogether', file: 'boss-09-settlement.mp3', text: '最终，我还是败给了你们' },
    { index: 9, key: 'bossLegend', file: 'boss-10-settlement.mp3', text: '难道你就是传说中的火柴人' },
];
const output = path.resolve(__dirname, '../test-results');

async function preparePage(browser, origin, errors, failures, viewport = { width: 1440, height: 900 }) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport(viewport);
    await page.setRequestInterception(true);
    page.on('request', request => request.url().startsWith(origin) ? request.continue() : request.abort());
    page.on('pageerror', error => errors.push(error.stack));
    page.on('response', response => {
        if (response.url().startsWith(origin) && response.status() >= 400) failures.push(response.url());
    });
    await page.evaluateOnNewDocument(() => {
        const NativeAudio = window.Audio;
        window.__media = []; window.__mediaEvents = [];
        window.Audio = function(...args) {
            const media = new NativeAudio(...args);
            __media.push(media);
            media.addEventListener('ended', () => __mediaEvents.push({ type: 'ended', src: media.src }));
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
                const batch = [...pending.values()]; pending.clear();
                batch.forEach(fn => fn(time));
            }
        };
    });
    await page.goto(origin, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
        Audio.init();
        window.__epicCalls = []; window.__banners = []; window.__rewards = [];
        window.__endingStarts = 0; window.__lastSettlementCallback = null;
        const epic = Audio.playVoiceEpic;
        Audio.playVoiceEpic = function(name, complete) {
            const observation = { name, completions: 0 };
            __epicCalls.push(observation);
            // Retain the public callback to simulate a completion arriving after cancellation.
            window.__lastSettlementCallback = complete;
            return epic.call(Audio, name, () => {
                observation.completions++;
                if (complete) complete();
            });
        };
        const banner = FX.banner;
        FX.banner = function(text, options) {
            __banners.push({ text, channel: options?.channel });
            return banner.call(FX, text, options);
        };
        const grant = Progression.grant;
        Progression.grant = function(name, reward) {
            __rewards.push({ name, clearedLevel: reward.clearedLevel, bossKilled: reward.bossKilled });
            return grant.call(Progression, name, reward);
        };
        const ending = Ending.start;
        Ending.start = function(options) { __endingStarts++; return ending.call(Ending, options); };
    });
    return { context, page };
}

async function enterBoss(page, index) {
    await page.evaluate(index => {
        Audio.setBackgroundPaused(false);
        if (Audio.getMuted()) Audio.toggleMute();
        Audio.setSfxLevel(1); Audio.setMusicLevel(0.5);
        Game.selectLevel(index); Game.selectDifficulty('normal'); __advance(1);
        const d = Game._debug();
        d.player.invincibleTimer = 1000; d.player.stagnationTimer = -1000;
        d.enemies.length = 0; d.player.x = d.levelData.arenaStart + 280; d.player.y = 500;
        __advance(230);
        const boss = Game._debug().boss;
        if (!boss || !boss.entranceDone) throw new Error('未通过真实关卡决战区生成 Boss');
        boss.attackCooldown = 1000; boss.action = null; boss.windup = null;
        boss.bullets.length = 0; boss.hazards.length = 0;
        Audio.resetCombatVoices(); FX.clear();
        __epicCalls.length = 0; __banners.length = 0; __rewards.length = 0; __mediaEvents.length = 0;
    }, index);
}

async function defeatBoss(page) {
    await page.evaluate(() => {
        const boss = Game._debug().boss;
        boss.shieldActive = false;
        boss.takeDamage(boss.maxHealth * 10);
        // Accelerate only the death animation; preserve real damage, rewards and async audio completion.
        boss.deathTimer = 3; FX.clear(); __advance(1);
    });
}

async function waitForVoice(page, file) {
    await page.waitForFunction(file => __media.some(media =>
        media.src.endsWith(file) && !media.paused && media.readyState >= 2),
    { timeout: 10000, polling: 25 }, file);
}

async function verifyDialogue(page, settlement) {
    const dialogue = await page.evaluate(({ key, text }) => ({
        voices: __epicCalls.map(row => row.name),
        subtitles: __banners.filter(row => row.channel === 'boss' && row.text === text).length,
        state: Game._debug().state,
        musicStopped: __media.filter(media => media.loop).every(media => media.paused),
        expectedKey: key,
    }), settlement);
    assert.deepEqual(dialogue.voices, [settlement.key]);
    assert.equal(dialogue.subtitles, 1, `第 ${settlement.index + 1} 关必须显示同句字幕`);
    assert.equal(dialogue.state, 'playing', '语音结束前不应提前进入结算');
    assert.ok(dialogue.musicStopped, 'Boss 结算台词期间关卡 BGM 应停止');
    return dialogue;
}

async function verifyCompleted(page, settlement, natural = true) {
    const expectedState = settlement.index === 9 ? 'victory' : 'levelComplete';
    await page.waitForFunction(state => Game._debug().state === state,
        { timeout: 20000, polling: 25 }, expectedState);
    const completed = await page.evaluate(({ index, file }) => ({
        state: Game._debug().state,
        completions: __epicCalls[0].completions,
        rewards: __rewards.filter(row => row.bossKilled && row.clearedLevel === index).length,
        naturalEnds: __mediaEvents.filter(row => row.type === 'ended' && row.src.endsWith(file)).length,
        cleared: Progression.get('匿名特工').cleared.includes(index),
        grade: Game.bestGrades()[index],
    }), settlement);
    assert.equal(completed.completions, 1, '首领台词结束回调只能运行一次');
    assert.equal(completed.rewards, 1, '首领通关奖励只能结算一次');
    assert.ok(completed.cleared && completed.grade);
    if (natural) assert.equal(completed.naturalEnds, 1, '应等待真实媒体 ended，不能由超时提前通关');
    await page.evaluate(file => {
        const media = __media.find(media => media.src.endsWith(file));
        media.dispatchEvent(new Event('ended')); media.dispatchEvent(new Event('error'));
    }, settlement.file);
    assert.equal(await page.evaluate(() => __epicCalls[0].completions), 1, '迟到或重复媒体事件不能再次运行回调');
    assert.equal(await page.evaluate(index => __rewards.filter(row => row.clearedLevel === index).length, settlement.index), 1);
    if (settlement.index === 9) {
        await page.waitForFunction(() => Ending.isOn(), { timeout: 6000, polling: 25 });
        await page.evaluate(() => __advance(2));
        assert.equal(await page.evaluate(() => __endingStarts), 1, '第十关结局只能启动一次');
    } else {
        assert.ok(await page.evaluate(() => !Ending.isOn() && __endingStarts === 0), '第七到九关不应启动最终结局');
    }
    return completed;
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
        const fixture = await preparePage(browser, origin, errors, failures);
        const decoded = await fixture.page.evaluate(async settlements => {
            const context = new AudioContext(), rows = [];
            try {
                for (const { file } of settlements) {
                    const response = await fetch(`assets/audio/voices/${file}`);
                    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
                    const bytes = await response.arrayBuffer(), byteLength = bytes.byteLength;
                    const buffer = await context.decodeAudioData(bytes);
                    let peak = 0;
                    for (const value of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(value));
                    rows.push({ file, bytes: byteLength, duration: buffer.duration,
                        channels: buffer.numberOfChannels, peak });
                }
            } finally { await context.close(); }
            return rows;
        }, settlements);
        for (const row of decoded) assert.ok(row.bytes > 0 && row.duration > 0.1 && row.peak > 0.001, row.file);
        await fixture.context.close();
        checks.push('第七到十关 4 条新增结算 MP3 真实解码且非静音');

        // Independent contexts allow all four natural audio endings to run concurrently.
        const natural = await Promise.all(settlements.map(async settlement => {
            const { context, page } = await preparePage(browser, origin, errors, failures);
            try {
                await enterBoss(page, settlement.index); await defeatBoss(page);
                await waitForVoice(page, settlement.file);
                await page.evaluate(() => __advance(30));
                const dialogue = await verifyDialogue(page, settlement);
                await page.screenshot({ path: path.join(output, `boss-${settlement.index + 1}-settlement.png`) });
                const completed = await verifyCompleted(page, settlement);
                return { level: settlement.index + 1, key: settlement.key, text: settlement.text, dialogue, completed };
            } finally { await context.close(); }
        }));
        checks.push('真实第七到十关 Boss 死亡各播放对应语音和同句字幕');
        checks.push('自然播放结束后仅一次通关奖励，第十关仅一次进入最终结局');

        await Promise.all(settlements.map(async settlement => {
            const { context, page } = await preparePage(browser, origin, errors, failures,
                { width: 844, height: 390, isMobile: true, hasTouch: true });
            try {
                await enterBoss(page, settlement.index); await defeatBoss(page);
                await waitForVoice(page, settlement.file); await page.evaluate(() => __advance(30));
                await verifyDialogue(page, settlement);
                await page.screenshot({ path: path.join(output, `boss-${settlement.index + 1}-settlement-mobile.png`) });
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                    '手机横屏字幕不能造成页面横向溢出');
                await page.evaluate(() => Game.backToTitle());
            } finally { await context.close(); }
        }));
        checks.push('四句字幕桌面与手机横屏截图，手机页面无横向溢出');

        const muted = await preparePage(browser, origin, errors, failures);
        try {
            const settlement = settlements[0];
            await enterBoss(muted.page, settlement.index);
            await muted.page.evaluate(() => Audio.toggleMute());
            await defeatBoss(muted.page); await verifyDialogue(muted.page, settlement);
            assert.ok(await muted.page.evaluate(file => __media.filter(a => a.src.endsWith(file)).every(a => a.paused), settlement.file));
            await verifyCompleted(muted.page, settlement, false);
        } finally { await muted.context.close(); }
        checks.push('静音时保留字幕并正常放行结算');

        const rejected = await preparePage(browser, origin, errors, failures);
        try {
            const settlement = settlements[1];
            await enterBoss(rejected.page, settlement.index);
            await rejected.page.evaluate(file => {
                const media = __media.find(media => media.src.endsWith(file));
                media.play = () => Promise.reject(new DOMException('测试拒播', 'NotAllowedError'));
            }, settlement.file);
            await defeatBoss(rejected.page); await verifyDialogue(rejected.page, settlement);
            await verifyCompleted(rejected.page, settlement, false);
        } finally { await rejected.context.close(); }
        checks.push('浏览器拒播时保留字幕，回调与结算仍只运行一次');

        for (const action of ['restart', 'backToTitle']) {
            const cancelled = await preparePage(browser, origin, errors, failures);
            try {
                const settlement = settlements[action === 'restart' ? 2 : 3];
                await enterBoss(cancelled.page, settlement.index); await defeatBoss(cancelled.page);
                await waitForVoice(cancelled.page, settlement.file);
                await cancelled.page.evaluate(({ action, file }) => {
                    window.__oldPlayer = Game._debug().player;
                    window.__oldVoice = __media.find(media => media.src.endsWith(file));
                    window.__oldCallback = __lastSettlementCallback;
                    Game[action]();
                    if (action === 'backToTitle') { Game.selectLevel(0); Game.selectDifficulty('normal'); __advance(1); }
                }, { action, file: settlement.file });
                await cancelled.page.waitForFunction(() => Game._debug().state === 'playing' && Game._debug().player !== __oldPlayer,
                    { timeout: 4000, polling: 25 });
                assert.ok(await cancelled.page.evaluate(() => __oldVoice.paused), '离开旧关卡应停止结算语音');
                await cancelled.page.evaluate(() => {
                    __oldVoice.dispatchEvent(new Event('ended')); __oldVoice.dispatchEvent(new Event('error'));
                    // Exercise the game generation guard even if an external async completion was already queued.
                    __oldCallback();
                });
                await cancelled.page.waitForFunction(() => Game._debug().state !== 'playing',
                    { timeout: 2900, polling: 25 }).then(() => {
                        throw new Error(`${action} 后旧语音错误结算了新局`);
                    }, error => { if (error.name !== 'TimeoutError') throw error; });
                assert.equal(await cancelled.page.evaluate(() => __epicCalls[0].completions), 0, '取消后的媒体事件不能调用旧完成回调');
                assert.equal(await cancelled.page.evaluate(() => __rewards.length), 0, '取消旧结算不能给新局发放通关奖励');
                assert.ok(await cancelled.page.evaluate(() => !Ending.isOn() && __endingStarts === 0));
            } finally { await cancelled.context.close(); }
        }
        checks.push('重开和返回标题取消旧语音，迟到事件与异步回调不能结算新局');

        assert.deepEqual(errors, []); assert.deepEqual(failures, []);
        fs.writeFileSync(path.join(output, 'boss-settlement-summary.json'),
            JSON.stringify({ checks, decoded, natural, errors, failures }, null, 2));
        console.log(`通过：${checks.join('；')}。`);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
