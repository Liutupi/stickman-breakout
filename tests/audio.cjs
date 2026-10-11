const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createServer } = require('../scripts/serve.cjs');

const newMusic = [
    ['level-06-eternal-rave.mp3', 'Fyex, DJ Samir - Eternal Rave'],
    ['level-07-babydoll.mp3', 'SEVENOP, MIRBRO - BABYDOLL (Phonk)'],
    ['level-08-agudo-magklco.mp3', 'FinalSay - AGUDO MAGKLCO (GHETTO HOUSE)'],
    ['level-09-sea-of-tranquility.mp3', 'BeMax - Sea of Tranquility (Radio Edit)'],
    ['level-10-revenge-super-slowed.mp3', '1HXSX, wnorg17 - REVENGE (Super Slowed)'],
];
const voicePaths = [1, 2, 3, 4].map(n => `assets/audio/voices/kill-${n}.mp3`)
    .concat('assets/audio/voices/boss-06-settlement.mp3');
const assetPaths = voicePaths.concat(newMusic.map(([file]) => `assets/audio/bgm/${file}`));
const allMusicFiles = ['三角洲典狱长进行曲.mp3', '威龙进行曲.mp3', '猛攻小曲.mp3',
    'Underground.mp3', '决斗小曲.mp3'].concat(newMusic.map(([file]) => file));
const output = path.resolve(__dirname, '../test-results');

// Observe native media elements and public game effects, without replacing the audio engine.
async function instrument(page) {
    await page.evaluateOnNewDocument(() => {
        const NativeAudio = window.Audio;
        window.__media = [];
        window.Audio = function(...args) {
            const media = new NativeAudio(...args);
            window.__media.push(media);
            return media;
        };
        window.Audio.prototype = NativeAudio.prototype;
        let frameId = 0, time = 0;
        const frames = new Map();
        window.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId; };
        window.cancelAnimationFrame = id => frames.delete(id);
        window.__advance = count => {
            time = Math.max(time, performance.now());
            for (let i = 0; i < count; i++) {
                time += 1000 / 60;
                const batch = [...frames.values()];
                frames.clear();
                batch.forEach(fn => fn(time));
            }
        };
    });
}

async function enterLevel(page, index) {
    await page.evaluate(index => {
        Audio.stopVoices();
        Audio.setBackgroundPaused(false);
        if (Audio.getMuted()) Audio.toggleMute();
        Audio.setSfxLevel(1);
        Audio.setMusicLevel(0.6);
        Game.selectLevel(index);
        Game.selectDifficulty('normal');
        __advance(1);
        const p = Game._debug().player;
        p.invincibleTimer = 1000;
        p.stagnationTimer = -1000;
    }, index);
    assert.equal(await page.evaluate(() => Game._debug().state), 'playing');
}

async function playingMedia(page, pathname) {
    await page.waitForFunction(pathname => window.__media.some(a =>
        new URL(a.src || location.href).pathname.endsWith(pathname) && !a.paused && a.readyState >= 2),
    { timeout: 10000, polling: 25 }, pathname);
}

async function defeatSixthBoss(page) {
    await enterLevel(page, 5);
    await page.evaluate(() => {
        const d = Game._debug();
        d.enemies.length = 0;
        d.player.x = d.levelData.arenaStart + 280;
        d.player.y = 500;
        __advance(230);
        const b = Game._debug().boss;
        if (!b) throw new Error('未触发第六关真实首领');
        b.takeDamage(b.maxHealth * 10);
        b.deathTimer = 3;
        FX.clear();
        __advance(1);
    });
    await playingMedia(page, 'boss-06-settlement.mp3');
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
    const errors = [], failures = [];
    const checks = [];
    try {
        browser = await puppeteer.launch({ headless: true,
            executablePath: candidates.find(candidate => fs.existsSync(candidate)),
            args: ['--autoplay-policy=no-user-gesture-required'] });
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });
        await page.setRequestInterception(true);
        page.on('request', request => request.url().startsWith(origin) ? request.continue() : request.abort());
        page.on('pageerror', error => errors.push(error.stack));
        page.on('response', response => {
            if (response.url().startsWith(origin) && response.status() >= 400) failures.push(response.url());
        });
        await instrument(page);
        await page.goto(origin, { waitUntil: 'networkidle0' });

        // Successful fetches alone do not establish that an MP3 is playable.
        const decoded = await page.evaluate(async paths => {
            const context = new AudioContext();
            const rows = [];
            try {
                for (const file of paths) {
                    const response = await fetch(file);
                    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
                    const bytes = await response.arrayBuffer();
                    const byteLength = bytes.byteLength;
                    const buffer = await context.decodeAudioData(bytes);
                    const samples = buffer.getChannelData(0);
                    let peak = 0;
                    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
                    rows.push({ file, bytes: byteLength, duration: buffer.duration,
                        channels: buffer.numberOfChannels, sampleRate: buffer.sampleRate, peak });
                }
            } finally { await context.close(); }
            return rows;
        }, assetPaths);
        assert.equal(decoded.length, 10);
        for (const item of decoded) {
            assert.ok(item.duration > 0.1 && item.channels > 0 && item.sampleRate >= 8000, item.file);
            assert.ok(item.peak > 0.001, `${item.file} 解码后不能是静音`);
        }
        checks.push('10 个新增 MP3 真实解码且非静音');

        await page.evaluate(() => {
            Audio.init();
            window.__initialMediaCount = __media.length;
            for (let i = 0; i < 8; i++) Audio.init();
            window.__killCalls = [];
            window.__comboBanners = [];
            window.__bossCalls = [];
            const kill = Audio.playKillVoice;
            Audio.playKillVoice = function(count) { __killCalls.push(count); return kill.call(Audio, count); };
            const epic = Audio.playVoiceEpic;
            Audio.playVoiceEpic = function(name, complete) { __bossCalls.push(name); return epic.call(Audio, name, complete); };
            const banner = FX.banner;
            FX.banner = function(text, options) {
                if (options?.channel === 'combo') __comboBanners.push(text);
                return banner.call(FX, text, options);
            };
        });
        assert.ok(await page.evaluate(() => __media.length === __initialMediaCount), '反复唤醒不应重复创建音频元素');
        checks.push('Audio.init 幂等');

        const titles = await page.evaluate(() => Game.bgmList());
        assert.equal(titles.length, 10);
        assert.deepEqual(titles.slice(5), newMusic.map(([, title]) => title));
        const playedMusic = [];
        for (let index = 0; index < 10; index++) {
            await enterLevel(page, index);
            await page.waitForFunction(() => __media.filter(a => a.loop && !a.paused && a.readyState >= 2).length === 1,
                { timeout: 10000, polling: 25 });
            const music = await page.evaluate(() => __media.filter(a => a.loop && !a.paused).map(a => a.src));
            playedMusic.push(music[0]);
            assert.ok(decodeURIComponent(new URL(music[0]).pathname).endsWith(allMusicFiles[index]), `第 ${index + 1} 关曲目不匹配`);
            assert.ok(await page.$eval('#now-playing', (el, title) => el.textContent.includes(title), titles[index]));
        }
        assert.equal(new Set(playedMusic).size, 10, '每一关必须使用独立曲目');
        assert.ok(await page.evaluate(() => __media.length === __initialMediaCount), '换关和开局不应重复创建音频元素');
        checks.push('10 关 BGM 切换、单曲循环与曲名匹配');

        // Change levels while muted, then resume the newly selected track.
        await enterLevel(page, 5);
        await page.evaluate(() => {
            Audio.toggleMute();
            Game.selectLevel(6); Game.selectDifficulty('normal'); __advance(1);
        });
        assert.ok(await page.evaluate(() => __media.every(a => a.paused)), '静音时媒体必须暂停');
        await page.evaluate(() => Audio.toggleMute());
        await playingMedia(page, newMusic[1][0]);
        assert.equal(await page.evaluate(() => __media.filter(a => a.loop && !a.paused).length), 1);
        await page.evaluate(() => Audio.setBackgroundPaused(true));
        assert.ok(await page.evaluate(() => __media.every(a => a.paused)), '后台时媒体必须暂停');
        await page.evaluate(() => { Audio.toggleMute(); Audio.setBackgroundPaused(false); });
        assert.ok(await page.evaluate(() => __media.every(a => a.paused)), '后台恢复不能绕过静音');
        await page.evaluate(() => Audio.toggleMute());
        await playingMedia(page, newMusic[1][0]);
        checks.push('静音换关、后台暂停与正确曲目恢复');

        await enterLevel(page, 0);
        await page.evaluate(() => { __killCalls.length = 0; __comboBanners.length = 0; });
        for (let count = 1; count <= 4; count++) {
            await page.evaluate(() => {
                const d = Game._debug();
                const enemy = d.enemies.find(e => !e.dead && e.type !== 'kamikaze');
                if (!enemy) throw new Error('没有可用于真实击杀的敌人');
                FX.clear();
                enemy.takeDamage(enemy.maxHealth * 10 + 1000);
                __advance(5);
            });
            await playingMedia(page, `kill-${count}.mp3`);
            assert.equal(await page.evaluate(() => __media.filter(a => /\/voices\/kill-\d\.mp3/.test(a.src) && !a.paused).length), 1,
                '快速连杀播报应替换前一段');
        }
        assert.deepEqual(await page.evaluate(() => __killCalls), [1, 2, 3, 4]);
        assert.deepEqual(await page.evaluate(() => __comboBanners.slice(0, 4)), ['一杀', '二杀', '三杀', '四杀']);
        await page.screenshot({ path: path.join(output, 'audio-four-kill.png') });
        await page.evaluate(() => { Audio.stopVoices(); FX.clear(); __advance(230); });
        await page.evaluate(() => {
            const enemy = Game._debug().enemies.find(e => !e.dead && e.type !== 'kamikaze');
            enemy.takeDamage(enemy.maxHealth * 10 + 1000); __advance(5);
        });
        await playingMedia(page, 'kill-1.mp3');
        assert.equal(await page.evaluate(() => __killCalls.at(-1)), 1, '连击过期后应从一杀重新播报');
        checks.push('真实敌人击杀匹配一杀到四杀文字、独占播报、连击重置');

        const liveVolume = await page.evaluate(() => {
            const voice = __media.find(a => a.src.endsWith('kill-1.mp3') && !a.paused);
            const before = voice.volume;
            Audio.setSfxLevel(0.2);
            const music = __media.find(a => a.loop && !a.paused);
            return { before, after: voice.volume, music: music.volume };
        });
        assert.ok(liveVolume.after < liveVolume.before && liveVolume.after <= 0.21, '音效设置应立即降低正在播放的语音');
        assert.ok(liveVolume.music < 0.6, '播报期间 BGM 应降低音量');
        await page.evaluate(() => Audio.stopVoices());
        assert.ok(await page.evaluate(() => Math.abs(__media.find(a => a.loop && !a.paused).volume - 0.6) < 0.001),
            '取消播报后 BGM 应恢复玩家设置的音量');
        await page.evaluate(() => { Audio.setSfxLevel(1); Audio.playKillVoice(2); });
        await playingMedia(page, 'kill-2.mp3');
        await page.evaluate(() => Audio.toggleMute());
        assert.ok(await page.evaluate(() => __media.every(a => a.paused)), '静音应停止当前语音');
        await page.evaluate(() => { Audio.toggleMute(); Audio.playKillVoice(3); });
        await playingMedia(page, 'kill-3.mp3');
        await page.evaluate(() => Audio.setBackgroundPaused(true));
        assert.ok(await page.evaluate(() => __media.every(a => a.paused)), '进入后台应停止当前语音');
        await page.evaluate(() => Audio.setBackgroundPaused(false));
        assert.ok(await page.evaluate(() => __media.filter(a => /\/voices\//.test(a.src)).every(a => a.paused)), '后台恢复不应重播过期语音');
        checks.push('活动语音实时音量、静音与后台取消');

        // Native media errors and rejected play promises must release settlement once.
        await page.evaluate(() => {
            Audio.stopVoices(); window.__callbacks = 0;
            Audio.playVoiceEpic('bossChubby', () => __callbacks++);
        });
        await playingMedia(page, 'boss-06-settlement.mp3');
        await page.evaluate(() => {
            const voice = __media.find(a => a.src.endsWith('boss-06-settlement.mp3'));
            voice.dispatchEvent(new Event('error')); voice.dispatchEvent(new Event('ended'));
        });
        await page.waitForFunction(() => __callbacks === 1, { timeout: 2000 });
        await page.evaluate(async () => {
            window.__callbacks = 0;
            const voice = __media.find(a => a.src.endsWith('boss-06-settlement.mp3'));
            const play = voice.play;
            voice.play = () => Promise.reject(new DOMException('测试拒播', 'NotAllowedError'));
            Audio.playVoiceEpic('bossChubby', () => __callbacks++);
            await new Promise(resolve => setTimeout(resolve, 0));
            voice.play = play;
            voice.dispatchEvent(new Event('ended'));
        });
        assert.equal(await page.evaluate(() => __callbacks), 1, '拒播和后续 ended 不能重复结算');
        await page.evaluate(() => {
            window.__callbacks = 0;
            Audio.playVoiceEpic('bossChubby', () => __callbacks++);
        });
        await playingMedia(page, 'boss-06-settlement.mp3');
        await page.evaluate(() => {
            const voice = __media.find(a => a.src.endsWith('boss-06-settlement.mp3'));
            Audio.stopVoices();
            voice.dispatchEvent(new Event('ended')); voice.dispatchEvent(new Event('error'));
        });
        assert.equal(await page.evaluate(() => __callbacks), 0, '显式取消不能继续旧结算回调');
        checks.push('媒体错误与拒播至多回调一次，stopVoices 取消回调');

        await defeatSixthBoss(page);
        assert.equal(await page.evaluate(() => __bossCalls.at(-1)), 'bossChubby');
        await page.waitForFunction(() => Game._debug().state === 'levelComplete', { timeout: 15000, polling: 25 });
        assert.ok(await page.evaluate(() => Progression.get('匿名特工').cleared.includes(5)));
        checks.push('第六关真实 Boss 死亡播放专属结算语音并完成通关');

        for (const action of ['restart', 'backToTitle']) {
            await defeatSixthBoss(page);
            await page.evaluate(action => {
                window.__oldSettlement = __media.find(a => a.src.endsWith('boss-06-settlement.mp3'));
                window.__oldPlayer = Game._debug().player;
                Game[action]();
                if (action === 'backToTitle') {
                    Game.selectLevel(5); Game.selectDifficulty('normal'); __advance(1);
                }
            }, action);
            await page.waitForFunction(() => Game._debug().state === 'playing' && Game._debug().player !== __oldPlayer,
                { timeout: 3000, polling: 25 });
            await page.evaluate(() => {
                __oldSettlement.dispatchEvent(new Event('ended'));
                __oldSettlement.dispatchEvent(new Event('error'));
            });
            await page.waitForFunction(() => Game._debug().state === 'levelComplete',
                { timeout: 2900, polling: 25 }).then(() => {
                    throw new Error(`${action} 后陈旧语音回调误结算了新局`);
                }, error => { if (error.name !== 'TimeoutError') throw error; });
            assert.equal(await page.evaluate(() => Game._debug().state), 'playing');
        }
        checks.push('重开与返回标题后旧 Boss 回调不会通关新局');

        assert.deepEqual(errors, []);
        assert.deepEqual(failures, []);
        fs.writeFileSync(path.join(output, 'audio-summary.json'), JSON.stringify({ checks, decoded, errors, failures }, null, 2));
        console.log(`通过：${checks.join('；')}。`);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
