// ==================== 音效系统 (Web Audio API) ====================
const Audio = (() => {
    let ctx = null;
    let masterGain = null;
    let muted = false;
    let volume = 0.3;
    let ambientNodes = [];       // 环境背景音节点
    let lowHealthTimer = 0;
    let lowHealthActive = false;
    let warningTimer = 0;       // 停滞警告计时
    const mp3Audios = {};       // MP3 音效缓存

    const AMBIENT_PRESETS = [
        { freq: 82, detune: 6, gain: 0.04, lfoRate: 0.15, type: 'triangle' },
        { freq: 110, detune: 8, gain: 0.04, lfoRate: 0.2, type: 'sine' },
        { freq: 65, detune: 5, gain: 0.05, lfoRate: 0.12, type: 'sawtooth' },
        { freq: 180, detune: 12, gain: 0.03, lfoRate: 0.25, type: 'sine' },
        { freq: 130, detune: 10, gain: 0.04, lfoRate: 0.18, type: 'triangle' },
    ];

    function ensureCtx() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.gain.value = muted ? 0 : volume;
            masterGain.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
    }

    function makeOsc(type, freq, start, end, volStart, volEnd, detune) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        if (detune) osc.detune.value = detune;
        gain.gain.setValueAtTime(volStart, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(volEnd, 0.0001), end);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(end);
    }

    // ---- MP3 音效（使用 HTML5 Audio 元素）----
    function loadMp3(name, url) {
        try {
            const audio = new window.Audio(url);
            audio.preload = 'auto';
            audio.load();
            mp3Audios[name] = audio;
            audio.oncanplaythrough = function() {
                console.log('MP3 就绪: ' + name);
            };
            audio.onerror = function(e) {
                console.error('MP3 加载失败: ' + name, e);
            };
        } catch (e) {
            console.warn('创建 MP3 失败: ' + name, e);
        }
    }

    function playMp3(name, vol) {
        if (muted) return;
        const audio = mp3Audios[name];
        if (!audio) return;
        audio.currentTime = 0;
        if (vol !== undefined) audio.volume = Math.max(0, Math.min(1, vol));
        else audio.volume = 1;
        audio.play().catch(function() {});
    }

    function playMp3WithCallback(name, vol, onEnd) {
        if (muted) { if (onEnd) onEnd(); return; }
        const audio = mp3Audios[name];
        if (!audio) { if (onEnd) onEnd(); return; }
        audio.currentTime = 0;
        if (vol !== undefined) audio.volume = Math.max(0, Math.min(1, vol));
        else audio.volume = 1;
        audio.onended = function() {
            audio.onended = null;
            if (onEnd) onEnd();
        };
        audio.play().catch(function() { if (onEnd) onEnd(); });
    }

    let savedBgmVolume = null;

    function setBgmVolume(vol) {
        if (currentBgm) {
            if (savedBgmVolume === null) savedBgmVolume = currentBgm.volume;
            currentBgm.volume = Math.max(0, Math.min(1, vol));
        }
    }

    function restoreBgmVolume() {
        if (currentBgm && savedBgmVolume !== null) {
            currentBgm.volume = savedBgmVolume;
            savedBgmVolume = null;
        }
    }

    let currentBgm = null;

    function playBgm(name) {
        if (muted) return;
        stopBgm();
        const audio = mp3Audios[name];
        if (!audio) {
            console.warn('BGM 未找到: ' + name);
            return;
        }
        
        audio.currentTime = 0;
        audio.loop = true;
        audio.play().then(function() {
            console.log('BGM 开始播放: ' + name);
        }).catch(function(e) {
            console.warn('BGM 播放失败: ' + name, e);
        });
        currentBgm = audio;
    }

    function stopBgm() {
        if (currentBgm) {
            currentBgm.pause();
            currentBgm.currentTime = 0;
            currentBgm = null;
        }
    }

    function preloadMp3s() {
        loadMp3('deathVoice', '啊.mp3');
        loadMp3('bossExplode', '我的刀盾.mp3');
        loadMp3('levelComplete', '颗秒.mp3');
        loadMp3('bgm_level1', '三角洲典狱长进行曲.mp3');
        loadMp3('bgm_level2', '威龙进行曲.mp3');
        loadMp3('bgm_level3', '猛攻小曲.mp3');
        loadMp3('bgm_level4', 'Underground.mp3');
        loadMp3('bgm_level5', '决斗小曲.mp3');
        loadMp3('bossLaugh', '气笑的一天.mp3');
        loadMp3('bossLuck', '下次就没那么好运啦.mp3');
        loadMp3('bossRespect', '有两下子.mp3');
        loadMp3('bossBad', '坏的很.mp3');
        loadMp3('bossSurrender', '我服了.mp3');
    }

    // ---- 公开接口 ----
    function init() {
        ensureCtx();
        preloadMp3s();
    }

    function setMasterGainBoost(boost) {
        if (masterGain) {
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(volume * boost, ctx.currentTime);
        }
    }

    function restoreMasterGain() {
        if (masterGain) {
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(muted ? 0 : volume, ctx.currentTime);
        }
    }

    function setVolume(v) {
        volume = Math.max(0, Math.min(1, v));
        if (!muted && masterGain) {
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(volume, ctx.currentTime);
        }
    }

    function toggleMute() {
        muted = !muted;
        if (masterGain) {
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(muted ? 0 : volume, ctx.currentTime);
        }
        const btn = document.getElementById('mute-btn');
        if (btn) {
            btn.textContent = muted ? '🔇' : '🔊';
            btn.classList.toggle('muted', muted);
        }
        return muted;
    }

    function getMuted() { return muted; }
    function getVolume() { return Math.round(volume * 100); }

    // ---- 环境背景音 ----
    function startAmbient(levelIndex) {
        stopAmbient();
        if (levelIndex < 0 || levelIndex >= AMBIENT_PRESETS.length) return;
        ensureCtx();
        const p = AMBIENT_PRESETS[levelIndex];
        const now = ctx.currentTime;
        for (let i = -1; i <= 1; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();

            osc.type = p.type;
            osc.frequency.value = p.freq + i * p.detune;
            gain.gain.value = p.gain * (1 - Math.abs(i) * 0.25);

            lfo.type = 'sine';
            lfo.frequency.value = p.lfoRate;
            lfoGain.gain.value = p.gain * 0.3;
            lfo.connect(lfoGain);
            lfoGain.connect(gain.gain);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            filter.Q.value = 2;

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            lfo.start(now);

            ambientNodes.push({ osc, gain, lfo, filter });
        }
    }

    function stopAmbient() {
        ambientNodes.forEach(n => {
            try { n.osc.stop(); } catch (e) { }
            try { n.lfo.stop(); } catch (e) { }
        });
        ambientNodes = [];
        lowHealthActive = false;
    }

    function updateLowHealth(dt, healthRatio) {
        if (healthRatio <= 0) { lowHealthActive = false; return; }
        if (healthRatio < 0.3) {
            lowHealthActive = true;
            lowHealthTimer -= dt;
            if (lowHealthTimer <= 0) {
                lowHealthTimer = 0.6;
                ensureCtx();
                const now = ctx.currentTime;
                makeOsc('sine', 80, now, now + 0.08, 0.12, 0.01);
                makeOsc('sine', 60, now + 0.02, now + 0.06, 0.1, 0.01);
            }
        } else {
            lowHealthActive = false;
        }
    }

    function updateWarning(dt, stagnationTimer) {
        if (stagnationTimer > 1.5) {
            warningTimer -= dt;
            if (warningTimer <= 0) {
                warningTimer = 0.8;
                ensureCtx();
                const now = ctx.currentTime;
                makeOsc('square', 440, now, now + 0.05, 0.07, 0.01);
                makeOsc('square', 330, now + 0.05, now + 0.1, 0.07, 0.01);
            }
        } else {
            warningTimer = 0;
        }
    }

    // ---- 音效播放 ----
    function play(type) {
        ensureCtx();
        const now = ctx.currentTime;

        switch (type) {
            case 'shoot':
                makeOsc('square', 800, now, now + 0.06, 0.3, 0.01);
                makeOsc('sawtooth', 300, now, now + 0.04, 0.15, 0.01, 5);
                break;

            case 'enemyShoot':
                makeOsc('square', 500, now, now + 0.07, 0.2, 0.01);
                makeOsc('triangle', 200, now, now + 0.05, 0.12, 0.01);
                break;

            case 'shotgun':
                for (let i = 0; i < 3; i++) {
                    makeOsc('sawtooth', 200 + i * 150, now + i * 0.005, now + 0.15, 0.25, 0.01, i * 20);
                }
                break;

            case 'laser':
                makeOsc('sine', 1400, now, now + 0.1, 0.2, 0.01);
                makeOsc('sine', 900, now + 0.02, now + 0.12, 0.12, 0.01, 3);
                break;

            case 'rocket':
                makeOsc('sawtooth', 200, now, now + 0.2, 0.2, 0.01, 15);
                makeOsc('triangle', 80, now + 0.05, now + 0.25, 0.15, 0.01, -10);
                break;

            case 'explode':
                makeOsc('sawtooth', 150, now, now + 0.25, 0.45, 0.01, 20);
                makeOsc('square', 60, now + 0.02, now + 0.2, 0.35, 0.01);
                makeOsc('triangle', 400, now, now + 0.08, 0.2, 0.01);
                break;

            case 'kamikazeCharge':
                makeOsc('sawtooth', 400, now, now + 0.3, 0.18, 0.01);
                makeOsc('square', 600, now + 0.05, now + 0.25, 0.12, 0.01, 10);
                break;

            case 'hit':
                makeOsc('triangle', 300, now, now + 0.08, 0.2, 0.01);
                makeOsc('sawtooth', 120, now + 0.02, now + 0.1, 0.15, 0.01);
                break;

            case 'playerHit':
                makeOsc('square', 500, now, now + 0.08, 0.25, 0.01);
                makeOsc('sawtooth', 200, now + 0.01, now + 0.12, 0.2, 0.01, 8);
                makeOsc('triangle', 800, now, now + 0.04, 0.12, 0.01);
                break;

            case 'pickup':
                makeOsc('sine', 600, now, now + 0.1, 0.2, 0.01);
                makeOsc('sine', 900, now + 0.05, now + 0.15, 0.15, 0.01, 3);
                break;

            case 'upgrade':
                makeOsc('sine', 400, now, now + 0.15, 0.2, 0.01);
                makeOsc('sine', 600, now + 0.08, now + 0.2, 0.15, 0.01, 2);
                makeOsc('sine', 800, now + 0.15, now + 0.3, 0.2, 0.01, 5);
                break;

            case 'death':
                makeOsc('sawtooth', 300, now, now + 0.4, 0.3, 0.01);
                makeOsc('triangle', 100, now + 0.1, now + 0.5, 0.25, 0.01, -5);
                break;

            case 'boss':
                makeOsc('square', 100, now, now + 0.2, 0.25, 0.01, 3);
                makeOsc('sawtooth', 150, now + 0.1, now + 0.35, 0.2, 0.01, -8);
                break;

            case 'bossPhase':
                for (let i = 0; i < 4; i++) {
                    makeOsc('sine', 200 + i * 150, now + i * 0.08, now + i * 0.08 + 0.15, 0.2, 0.01);
                }
                makeOsc('sawtooth', 60, now, now + 0.5, 0.3, 0.01);
                break;

            case 'bossSpecial':
                makeOsc('sawtooth', 100, now, now + 0.3, 0.3, 0.01, 10);
                makeOsc('square', 250, now + 0.05, now + 0.3, 0.2, 0.01, -5);
                makeOsc('triangle', 400, now, now + 0.15, 0.15, 0.01);
                break;

            case 'bossDeath':
                for (let i = 0; i < 5; i++) {
                    makeOsc('sawtooth', 150 - i * 25, now + i * 0.1, now + i * 0.1 + 0.5, 0.3, 0.01, i * 10);
                }
                makeOsc('square', 40, now, now + 0.8, 0.4, 0.01);
                break;

            case 'levelup':
                [400, 500, 600, 800].forEach((f, i) => {
                    makeOsc('sine', f, now + i * 0.12, now + i * 0.12 + 0.15, 0.2, 0.01, 3);
                });
                makeOsc('triangle', 1000, now + 0.4, now + 0.6, 0.25, 0.01);
                break;

            case 'victory':
                [300, 400, 500, 600, 700, 800, 900, 1000].forEach((f, i) => {
                    makeOsc('sine', f, now + i * 0.1, now + i * 0.1 + 0.25, 0.2, 0.01, 2);
                });
                makeOsc('triangle', 1200, now + 0.7, now + 1.2, 0.3, 0.01);
                break;

            case 'jump':
                makeOsc('sine', 300, now, now + 0.1, 0.12, 0.01);
                break;

            case 'doubleJump':
                makeOsc('sine', 500, now, now + 0.08, 0.14, 0.01);
                makeOsc('sine', 700, now + 0.02, now + 0.1, 0.1, 0.01, 3);
                break;

            case 'dash':
                makeOsc('triangle', 600, now, now + 0.1, 0.15, 0.01);
                makeOsc('square', 400, now + 0.02, now + 0.12, 0.12, 0.01, 10);
                break;

            case 'pause':
                makeOsc('sine', 600, now, now + 0.06, 0.12, 0.01);
                makeOsc('sine', 400, now + 0.06, now + 0.12, 0.12, 0.01);
                break;

            case 'unpause':
                makeOsc('sine', 400, now, now + 0.06, 0.12, 0.01);
                makeOsc('sine', 600, now + 0.06, now + 0.12, 0.12, 0.01);
                break;

            case 'lowHealth':
                makeOsc('sine', 70, now, now + 0.1, 0.15, 0.01);
                makeOsc('sine', 50, now + 0.02, now + 0.08, 0.12, 0.01);
                break;

            case 'warning':
                makeOsc('square', 500, now, now + 0.04, 0.08, 0.01);
                makeOsc('square', 350, now + 0.05, now + 0.1, 0.08, 0.01);
                break;
        }
    }

    return {
        init, play, playMp3, playMp3WithCallback, playBgm, stopBgm,
        setBgmVolume, restoreBgmVolume,
        setVolume, toggleMute, getMuted, getVolume,
        startAmbient, stopAmbient, updateLowHealth, updateWarning,
        setMasterGainBoost, restoreMasterGain
    };
})();
