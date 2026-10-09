// ==================== 音效系统 (Web Audio API) ====================
const Audio = (() => {
    let ctx = null;
    let masterGain = null;
    let compressor = null;
    let reverbSend = null;
    let distCurveHeavy = null;
    // 响度均衡：每个音效的增益系数（由离线测量自动校准，让各音效听感音量接近）
    let levelGain = 1;
    let SOUND_LEVELS = {
        fire_pistol: 0.715,
        fire_smg: 1.535,
        fire_shotgun: 0.103,
        fire_laser: 0.857,
        fire_rocket: 0.181,
        enemyShoot: 1.973,
        impact_pistol: 1.004,
        impact_smg: 1.319,
        impact_shotgun: 0.817,
        impact_laser: 0.956,
        impact_armor: 1.011,
        impact_headshot: 0.54,
        impact_crit: 1.24,
        kill: 0.219,
        explode: 0.107,
        bigExplode: 0.115,
        switch: 2.892,
        dry: 2.512,
        jump: 2.445,
        doubleJump: 0.886,
        land: 2.011,
        dash: 2.752,
        slam: 0.529,
        pickup: 1.038,
        upgrade: 0.958,
        orb: 1.374,
        combo: 0.671,
        overdrive: 0.802,
        playerHit: 0.716,
        hit: 2.586,
        hitTick: 1.686,
        shellTink: 2.385,
        crit: 1.44,
        death: 0.778,
        boss: 1.107,
        bossPhase: 0.771,
        bossSpecial: 0.691,
        bossDeath: 0.662,
        levelup: 0.726,
        victory: 0.47,
        pause: 1.182,
        unpause: 1.183,
        kamikazeCharge: 0.954,
        shoot: 1.417,
        shotgun: 0.482,
        laser: 2.133,
        rocket: 0.946,
        warning: 1.327,
        lowHealth: 2.128,
        sniperCharge: 0.88, sniperShot: 0.126, laserCharge: 1.2, beam: 0.141, shieldBlock: 1.0, coin: 2.16, agentLevelUp: 1.24,
    };
    let muted = false;
    let volume = 0.3;
    // 玩家设置：音乐 / 音效分开调（0~1），由 Settings 模块写入
    let musicLevel = 1, sfxLevel = 1;
    function sfxGain() { return volume * sfxLevel; }
    let pageHidden = false;
    let visibilityBound = false;
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
            masterGain.gain.value = muted ? 0 : sfxGain();
            // 母线：压缩器（让爆炸/霰弹更响但不破音）+ 短混响（枪声有空间尾音）
            compressor = ctx.createDynamicsCompressor();
            compressor.threshold.value = -16;
            compressor.knee.value = 10;
            compressor.ratio.value = 5;
            compressor.attack.value = 0.002;
            compressor.release.value = 0.18;
            masterGain.connect(compressor);
            compressor.connect(ctx.destination);
            reverbSend = ctx.createGain();
            reverbSend.gain.value = 0.22;
            const convolver = ctx.createConvolver();
            convolver.buffer = makeImpulse(1.1, 2.8);
            reverbSend.connect(convolver);
            convolver.connect(compressor);
        }
        if (ctx.state === 'suspended' && !pageHidden) ctx.resume();
    }

    function makeOsc(type, freq, start, end, volStart, volEnd, detune) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        if (detune) osc.detune.value = detune;
        gain.gain.setValueAtTime(volStart * levelGain, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(volEnd * levelGain, 0.0001), end);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(end);
    }

    // ---- 噪声层（让枪声/爆炸有“颗粒感”和冲击力）----
    let noiseBuffer = null;
    function getNoise() {
        if (noiseBuffer) return noiseBuffer;
        const len = ctx.sampleRate * 1.5;
        noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        return noiseBuffer;
    }

    function noise(start, dur, vol, filterType, freq, freqEnd, q) {
        const src = ctx.createBufferSource();
        src.buffer = getNoise();
        src.playbackRate.value = 0.8 + Math.random() * 0.4;
        const filter = ctx.createBiquadFilter();
        filter.type = filterType || 'lowpass';
        filter.frequency.setValueAtTime(freq || 2000, start);
        if (freqEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + dur);
        filter.Q.value = q || 0.8;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol * levelGain, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        src.start(start, Math.random() * 0.5);
        src.stop(start + dur + 0.02);
    }

    function sweep(type, f0, f1, start, end, vol) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, start);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), end);
        gain.gain.setValueAtTime(vol * levelGain, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(end + 0.02);
    }


    // ==================== 高级合成工具（武器 / 打击音效）====================
    function makeImpulse(seconds, decay) {
        const len = Math.floor(ctx.sampleRate * seconds);
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = buf.getChannelData(c);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
        return buf;
    }

    function getDistCurve() {
        if (distCurveHeavy) return distCurveHeavy;
        // 奇数长度：保证输入 0 精确映射到 0，否则失真节点会持续输出直流偏移
        const n = 2049, k = 40;
        distCurveHeavy = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const x = i * 2 / (n - 1) - 1;
            distCurveHeavy[i] = (1 + k) * x / (1 + k * Math.abs(x));
        }
        return distCurveHeavy;
    }

    // 输出节点：带声像 + 可选混响发送 + 可选失真
    function out(pan, wet, drive) {
        let node = ctx.createGain();
        node.gain.value = levelGain;
        let head = node;
        if (drive) {
            const ws = ctx.createWaveShaper();
            ws.curve = getDistCurve();
            ws.oversample = '2x';
            const pre = ctx.createGain();
            pre.gain.value = drive;
            pre.connect(ws);
            ws.connect(node);
            head = pre;
        }
        let tail = node;
        if (pan && ctx.createStereoPanner) {
            const p = ctx.createStereoPanner();
            p.pan.value = Math.max(-1, Math.min(1, pan));
            node.connect(p);
            tail = p;
        }
        tail.connect(masterGain);
        if (wet && reverbSend) {
            const w = ctx.createGain();
            w.gain.value = wet;
            tail.connect(w);
            w.connect(reverbSend);
        }
        return head;
    }

    function nz(dest, start, dur, vol, type, f0, f1, q, attack) {
        const src = ctx.createBufferSource();
        src.buffer = getNoise();
        src.playbackRate.value = 0.85 + Math.random() * 0.3;
        const filter = ctx.createBiquadFilter();
        filter.type = type || 'lowpass';
        filter.frequency.setValueAtTime(f0, start);
        if (f1) filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + dur);
        filter.Q.value = q || 0.8;
        const g = ctx.createGain();
        if (attack) {
            g.gain.setValueAtTime(0.0001, start);
            g.gain.exponentialRampToValueAtTime(vol, start + attack);
        } else {
            g.gain.setValueAtTime(vol, start);
        }
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        src.connect(filter); filter.connect(g); g.connect(dest);
        src.start(start, Math.random() * 0.8);
        src.stop(start + dur + 0.05);
    }

    function tone(dest, type, f0, f1, start, dur, vol, attack) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, start);
        if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + dur);
        if (attack) {
            g.gain.setValueAtTime(0.0001, start);
            g.gain.exponentialRampToValueAtTime(vol, start + attack);
        } else {
            g.gain.setValueAtTime(vol, start);
        }
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        o.connect(g); g.connect(dest);
        o.start(start);
        o.stop(start + dur + 0.05);
    }

    // 金属质感：多个不成谐波的正弦叠加
    function metal(dest, base, start, dur, vol) {
        [1, 2.76, 5.4, 8.93].forEach((m, i) => tone(dest, 'sine', base * m, base * m * 0.98, start, dur / (1 + i * 0.6), vol / (1 + i)));
    }

    const rv = (a, b) => a + Math.random() * (b - a);   // 随机微调，避免连发听起来像复读机

    // ---- 各武器开火音 ----
    function fireSound(type, now) {
        switch (type) {
            case 'pistol': {
                // 手枪：清脆的爆裂 + 胸腔感低频 + 套筒复位“咔嗒”
                const d = out(0, 0.25, 0);
                const p = rv(0.94, 1.06);
                nz(d, now, 0.05, 0.9, 'bandpass', 3200 * p, 1200, 0.7);
                nz(d, now, 0.12, 0.45, 'lowpass', 1600, 300, 0.7);
                tone(d, 'sine', 190 * p, 55, now, 0.11, 0.7);
                tone(d, 'square', 1400 * p, 600, now, 0.025, 0.12);
                nz(d, now + 0.075, 0.025, 0.18, 'highpass', 4500, 0, 2);   // 套筒
                metal(d, 2100 * p, now + 0.08, 0.05, 0.05);
                break;
            }
            case 'smg': {
                // 冲锋枪：更短更紧、偏高频的“哒”，带金属机匣颤音
                const d = out(rv(-0.05, 0.05), 0.12, 0);
                const p = rv(0.9, 1.1);
                nz(d, now, 0.035, 0.75, 'bandpass', 4200 * p, 1800, 0.9);
                nz(d, now, 0.06, 0.3, 'lowpass', 2200, 500, 0.7);
                tone(d, 'triangle', 260 * p, 90, now, 0.05, 0.45);
                tone(d, 'square', 2400 * p, 1500, now, 0.015, 0.06);
                break;
            }
            case 'shotgun': {
                // 霰弹枪：失真的轰鸣 + 超低频冲击 + 泵动上膛“咔-嚓”
                const d = out(0, 0.35, 3.2);
                const clean = out(0, 0.2, 0);
                nz(d, now, 0.32, 0.55, 'lowpass', 5000, 180, 0.6);
                nz(clean, now, 0.06, 0.8, 'bandpass', 2600, 900, 0.6);
                tone(clean, 'sine', 120, 32, now, 0.35, 1.0);
                tone(d, 'sawtooth', 85, 40, now, 0.18, 0.25);
                // 泵动
                nz(clean, now + 0.3, 0.05, 0.35, 'bandpass', 1800, 900, 2.5);
                metal(clean, 900, now + 0.3, 0.06, 0.06);
                nz(clean, now + 0.42, 0.06, 0.4, 'bandpass', 2600, 1300, 2.5);
                metal(clean, 1300, now + 0.42, 0.07, 0.07);
                break;
            }
            case 'laser': {
                // 激光枪：共鸣滤波扫频 + FM 电子啸叫 + 能量余韵
                const d = out(0, 0.4, 0);
                const p = rv(0.95, 1.05);
                const o = ctx.createOscillator();
                const mod = ctx.createOscillator();
                const modG = ctx.createGain();
                const f = ctx.createBiquadFilter();
                const g = ctx.createGain();
                o.type = 'sawtooth';
                o.frequency.setValueAtTime(1800 * p, now);
                o.frequency.exponentialRampToValueAtTime(220, now + 0.18);
                mod.frequency.value = 85;
                modG.gain.value = 400;
                mod.connect(modG); modG.connect(o.frequency);
                f.type = 'lowpass';
                f.Q.value = 14;
                f.frequency.setValueAtTime(6000, now);
                f.frequency.exponentialRampToValueAtTime(400, now + 0.18);
                g.gain.setValueAtTime(0.32, now);
                g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
                o.connect(f); f.connect(g); g.connect(d);
                o.start(now); mod.start(now);
                o.stop(now + 0.22); mod.stop(now + 0.22);
                tone(d, 'sine', 3200 * p, 900, now, 0.12, 0.12);
                nz(d, now, 0.03, 0.25, 'highpass', 6000, 0, 1);
                break;
            }
            case 'rocket': {
                // 火箭筒：发射“砰”+ 推进器呼啸上扬 + 点火噼啪
                const d = out(0, 0.3, 2.2);
                const clean = out(0, 0.25, 0);
                tone(clean, 'sine', 150, 40, now, 0.25, 0.9);
                nz(d, now, 0.12, 0.5, 'lowpass', 2500, 300, 0.7);
                nz(clean, now + 0.03, 0.6, 0.5, 'bandpass', 500, 3800, 1.4, 0.05);  // 呼啸
                for (let i = 0; i < 5; i++) nz(clean, now + 0.05 + i * 0.05, 0.02, 0.2, 'highpass', 3000, 0, 1);
                break;
            }
            case 'enemy': {
                // 敌人枪声：偏闷、偏远，与玩家明显区分
                const d = out(0, 0.3, 0);
                nz(d, now, 0.08, 0.35, 'lowpass', 1400, 300, 0.8);
                tone(d, 'square', 520, 180, now, 0.06, 0.08);
                break;
            }
        }
        if (typeof Renderer !== 'undefined') {
            Renderer.addAudioPulse({ pistol: 0.07, smg: 0.04, shotgun: 0.2, laser: 0.08, rocket: 0.16, enemy: 0.03 }[type] || 0.05);
        }
    }

    // ---- 命中音：根据武器与目标区分 ----
    function impactSound(kind, pan, now) {
        const d = out(pan || 0, 0.12, 0);
        switch (kind) {
            case 'pistol':
                // 实打实的“噗-嗒”肉感
                nz(d, now, 0.07, 0.55, 'lowpass', 1800, 250, 1.2);
                tone(d, 'sine', 160, 60, now, 0.08, 0.5);
                nz(d, now, 0.015, 0.25, 'highpass', 3500, 0, 1);
                break;
            case 'smg':
                nz(d, now, 0.045, 0.4, 'lowpass', 2400, 400, 1.2);
                tone(d, 'sine', 200, 80, now, 0.05, 0.3);
                break;
            case 'shotgun':
                // 多颗弹丸同时命中：厚重闷击
                nz(d, now, 0.12, 0.7, 'lowpass', 1200, 120, 1);
                tone(d, 'sine', 110, 40, now, 0.14, 0.7);
                nz(d, now + 0.01, 0.03, 0.3, 'bandpass', 2500, 1000, 1.5);
                break;
            case 'laser':
                // 灼烧“滋—”
                nz(d, now, 0.14, 0.35, 'highpass', 4000, 9000, 2);
                tone(d, 'sawtooth', 900, 300, now, 0.1, 0.1);
                tone(d, 'sine', 140, 70, now, 0.06, 0.3);
                break;
            case 'armor':
                // Boss / 冰墙：金属铿锵
                metal(d, rv(700, 900), now, 0.18, 0.18);
                nz(d, now, 0.05, 0.4, 'bandpass', 3000, 1500, 2);
                tone(d, 'sine', 120, 60, now, 0.08, 0.35);
                break;
            case 'headshot':
                // 爆头：清脆“叮”+ 碎裂
                metal(d, 1650, now, 0.35, 0.22);
                nz(d, now, 0.09, 0.6, 'bandpass', 2200, 600, 1.4);
                tone(d, 'sine', 220, 50, now, 0.12, 0.6);
                break;
            case 'crit':
                metal(d, 2400, now, 0.22, 0.16);
                tone(d, 'square', 1900, 1900, now, 0.05, 0.08);
                nz(d, now, 0.05, 0.3, 'highpass', 4000, 0, 1);
                break;
            case 'kill': {
                // 击杀确认：脆裂 + 低频下坠 + 高音提示
                const dd = out(pan || 0, 0.25, 1.8);
                nz(dd, now, 0.1, 0.5, 'bandpass', 1600, 400, 1.2);
                tone(d, 'sine', 240, 42, now, 0.22, 0.75);
                tone(d, 'triangle', 1760, 1760, now + 0.02, 0.07, 0.1);
                tone(d, 'triangle', 2640, 2640, now + 0.06, 0.09, 0.08);
                break;
            }
        }
    }

    // 同类音效节流，避免冲锋枪/大量命中时爆音
    const lastPlayed = {};
    const MIN_INTERVAL = { fire_smg: 0.03, impact_pistol: 0.025, impact_smg: 0.03, impact_shotgun: 0.05, impact_laser: 0.04, impact_armor: 0.035, impact_headshot: 0.04, impact_crit: 0.04, impact_kill: 0.03, enemyShoot: 0.05, dry: 0.15, switch: 0.06, hit: 0.03, hitTick: 0.035, enemyShoot: 0.05, orb: 0.03, shellTink: 0.06, land: 0.12, explode: 0.04, kill: 0.03 };

    // ---- MP3 音效（使用 HTML5 Audio 元素）----
    // 短语音（几十 KB）预加载；BGM（每首 2-4MB）只在真正播放时才下载
    function loadMp3(name, url) {
        try {
            const isBgm = name.startsWith('bgm_');
            const audio = new window.Audio();
            audio.preload = isBgm ? 'none' : 'auto';
            audio.src = url;
            if (!isBgm) audio.load();
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
        if (muted || pageHidden) return;
        const audio = mp3Audios[name];
        if (!audio) return;
        audio.currentTime = 0;
        audio.volume = Math.max(0, Math.min(1, (vol !== undefined ? vol : 1) * sfxLevel));
        audio.play().catch(function() {});
    }

    function playMp3WithCallback(name, vol, onEnd) {
        if (muted || pageHidden) { if (onEnd) onEnd(); return; }
        const audio = mp3Audios[name];
        if (!audio) { if (onEnd) onEnd(); return; }
        audio.currentTime = 0;
        audio.volume = Math.max(0, Math.min(1, (vol !== undefined ? vol : 1) * sfxLevel));
        audio.onended = function() {
            audio.onended = null;
            if (onEnd) onEnd();
        };
        audio.play().catch(function() { if (onEnd) onEnd(); });
    }

    let savedBgmVolume = null;
    let bgmDuck = 1;

    // iOS Safari 的 <audio>.volume 只读（恒为 1），需要改走 Web Audio 增益节点才能调音乐音量
    const elementVolumeWorks = (function() {
        try { const a = new window.Audio(); a.volume = 0.5; return Math.abs(a.volume - 0.5) < 0.01; } catch (e) { return true; }
    })();
    const bgmRoutes = new Map();
    function applyBgmVolume(audio, v) {
        v = Math.max(0, Math.min(1, v));
        if (elementVolumeWorks) { audio.volume = v; return; }
        let route = bgmRoutes.get(audio);
        if (!route && ctx && v < 0.999) {
            try {
                const src = ctx.createMediaElementSource(audio);
                const g = ctx.createGain();
                src.connect(g); g.connect(ctx.destination);
                route = { gain: g }; bgmRoutes.set(audio, route);
            } catch (e) { /* 无法接管时保持原音量 */ }
        }
        if (route) route.gain.gain.value = v;
    }

    function setBgmVolume(vol) {
        if (currentBgm) {
            if (savedBgmVolume === null) savedBgmVolume = currentBgm.volume;
            bgmDuck = Math.max(0, Math.min(1, vol));
            applyBgmVolume(currentBgm, bgmDuck * musicLevel);
        }
    }

    function restoreBgmVolume() {
        if (currentBgm && savedBgmVolume !== null) {
            bgmDuck = 1;
            applyBgmVolume(currentBgm, musicLevel);
            savedBgmVolume = null;
        }
    }

    let currentBgm = null;

    let pendingBgm = null;   // 静音期间请求的曲目，取消静音后接着放
    function playBgm(name) {
        if (muted) { pendingBgm = name; return; }
        pendingBgm = null;
        stopBgm();
        const audio = mp3Audios[name];
        if (!audio) {
            console.warn('BGM 未找到: ' + name);
            return;
        }
        
        audio.currentTime = 0;
        audio.loop = true;
        bgmDuck = 1;
        applyBgmVolume(audio, musicLevel);
        savedBgmVolume = null;
        currentBgm = audio;
        if (pageHidden) return;
        audio.play().then(function() {
            console.log('BGM 开始播放: ' + name);
        }).catch(function(e) {
            console.warn('BGM 播放失败: ' + name, e);
        });
    }

    function stopBgm() {
        pendingBgm = null;
        if (currentBgm) {
            currentBgm.pause();
            currentBgm.currentTime = 0;
            currentBgm = null;
        }
    }

    function setBackgroundPaused(hidden) {
        pageHidden = hidden;
        if (hidden) {
            if (currentBgm) currentBgm.pause();
            if (ctx && ctx.state === 'running') ctx.suspend().catch(function() {});
            return;
        }

        if (ctx && ctx.state === 'suspended' && !muted) ctx.resume().catch(function() {});
        if (currentBgm && !muted) currentBgm.play().catch(function() {});
    }

    function bindVisibilityPause() {
        if (visibilityBound || typeof document === 'undefined') return;
        visibilityBound = true;
        pageHidden = !!document.hidden;
        document.addEventListener('visibilitychange', function() {
            setBackgroundPaused(!!document.hidden);
        });
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
        bindVisibilityPause();
    }

    function setMasterGainBoost(boost) {
        if (masterGain) {
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(sfxGain() * boost, ctx.currentTime);
        }
    }

    function restoreMasterGain() {
        if (masterGain) {
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(muted ? 0 : sfxGain(), ctx.currentTime);
        }
    }

    function setVolume(v) {
        volume = Math.max(0, Math.min(1, v));
        if (!muted && masterGain) {
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(sfxGain(), ctx.currentTime);
        }
    }

    function setSfxLevel(v) {
        sfxLevel = Math.max(0, Math.min(1, v));
        if (!muted && masterGain && ctx) {
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(sfxGain(), ctx.currentTime);
        }
    }

    function setMusicLevel(v) {
        musicLevel = Math.max(0, Math.min(1, v));
        if (currentBgm) applyBgmVolume(currentBgm, bgmDuck * musicLevel);
    }
    function getLevels() { return { music: musicLevel, sfx: sfxLevel }; }

    function toggleMute() {
        muted = !muted;
        if (masterGain) {
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(muted ? 0 : sfxGain(), ctx.currentTime);
        }
        if (currentBgm) {
            if (muted) currentBgm.pause();
            else if (!pageHidden) currentBgm.play().catch(function() {});
        } else if (!muted && pendingBgm) {
            playBgm(pendingBgm);
        }
        const btn = document.getElementById('mute-btn');
        if (btn) {
            btn.innerHTML = muted ? '<span class="icon-sound-muted"><span></span></span>' : '<span class="icon-sound"></span>';
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
                levelGain = SOUND_LEVELS.lowHealth !== undefined ? SOUND_LEVELS.lowHealth : 1;
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
                levelGain = SOUND_LEVELS.warning !== undefined ? SOUND_LEVELS.warning : 1;
                const now = ctx.currentTime;
                makeOsc('square', 440, now, now + 0.05, 0.07, 0.01);
                makeOsc('square', 330, now + 0.05, now + 0.1, 0.07, 0.01);
            }
        } else {
            warningTimer = 0;
        }
    }

    // ---- 音效播放 ----
    function play(type, param) {
        if (pageHidden) return;
        ensureCtx();
        const now = ctx.currentTime;
        levelGain = SOUND_LEVELS[type] !== undefined ? SOUND_LEVELS[type] : 1;
        const minGap = MIN_INTERVAL[type];
        if (minGap) {
            if (lastPlayed[type] && now - lastPlayed[type] < minGap) return;
            lastPlayed[type] = now;
        }

        if (type.startsWith('fire_')) { fireSound(type.slice(5), now); return; }
        if (type.startsWith('impact_')) { impactSound(type.slice(7), param, now); return; }

        switch (type) {
            case 'enemyShoot':
                fireSound('enemy', now);
                break;

            case 'sniperCharge': {
                // 狙击充能：逐渐升高的电子嗡鸣，提醒玩家躲避
                const d = out(param || 0, 0.1, 0);
                tone(d, 'sine', 300, 1400, now, 1.15, 0.12, 0.9);
                tone(d, 'square', 150, 700, now, 1.15, 0.03, 0.9);
                break;
            }
            case 'sniperShot': {
                const d = out(param || 0, 0.45, 2);
                nz(d, now, 0.09, 0.8, 'bandpass', 3500, 900, 0.8);
                tone(d, 'sine', 240, 40, now, 0.25, 0.8);
                nz(d, now + 0.02, 0.5, 0.2, 'lowpass', 1200, 200, 0.7);
                break;
            }
            case 'laserCharge': {
                const d = out(0, 0.3, 0);
                tone(d, 'sawtooth', 120, 900, now, 0.85, 0.12, 0.7);
                tone(d, 'sine', 240, 1800, now, 0.85, 0.1, 0.7);
                nz(d, now, 0.85, 0.15, 'bandpass', 400, 4000, 3, 0.8);
                break;
            }
            case 'beam': {
                const d = out(0, 0.5, 2.5);
                tone(d, 'sawtooth', 90, 60, now, 0.5, 0.35);
                tone(d, 'square', 180, 120, now, 0.5, 0.12);
                nz(d, now, 0.5, 0.4, 'bandpass', 1200, 600, 1.2);
                break;
            }
            case 'shieldBlock': {
                const d = out(param || 0, 0.15, 0);
                metal(d, 1250, now, 0.25, 0.18);
                nz(d, now, 0.04, 0.35, 'highpass', 3000, 0, 1);
                break;
            }
            case 'coin': {
                const d = out(0, 0.2, 0);
                [1568, 2093].forEach((f, i) => tone(d, 'square', f, f, now + i * 0.07, 0.12, 0.06));
                tone(d, 'sine', 2637, 2637, now + 0.14, 0.25, 0.08);
                break;
            }
            case 'agentLevelUp': {
                const d = out(0, 0.4, 0);
                [523, 659, 784, 1047].forEach((f, i) => { tone(d, 'triangle', f, f, now + i * 0.09, 0.4, 0.16); tone(d, 'sine', f * 2, f * 2, now + i * 0.09, 0.3, 0.05); });
                nz(d, now + 0.3, 0.6, 0.08, 'highpass', 6000, 9000, 0.5);
                break;
            }

            case 'dry': {
                const d = out(0, 0, 0);
                nz(d, now, 0.02, 0.3, 'highpass', 3000, 0, 3);
                tone(d, 'square', 1800, 1800, now, 0.012, 0.05);
                break;
            }

            case 'switch': {
                // 换枪：拉栓上膛，不同武器音高不同
                const pitch = { pistol: 1.3, smg: 1.15, shotgun: 0.8, laser: 1, rocket: 0.7 }[param] || 1;
                const d = out(0, 0.1, 0);
                nz(d, now, 0.04, 0.35, 'bandpass', 1500 * pitch, 800, 2.5);
                metal(d, 800 * pitch, now, 0.06, 0.05);
                nz(d, now + 0.09, 0.05, 0.4, 'bandpass', 2400 * pitch, 1200, 2.5);
                metal(d, 1200 * pitch, now + 0.09, 0.08, 0.06);
                if (param === 'laser') tone(d, 'sine', 400, 2400, now + 0.05, 0.25, 0.08, 0.05);
                break;
            }

            case 'kill':
                impactSound('kill', param, now);
                break;

            case 'hitTick':
                noise(now, 0.04, 0.22, 'highpass', 2500, 0, 0.7);
                makeOsc('square', 1200 + Math.random() * 300, now, now + 0.03, 0.08, 0.01);
                break;

            case '_killOld':
                // 击杀确认：清脆“咔”+低频下坠
                noise(now, 0.09, 0.4, 'bandpass', 1800, 400, 1.2);
                sweep('sine', 260, 50, now, now + 0.18, 0.5);
                makeOsc('triangle', 1600, now, now + 0.05, 0.12, 0.01);
                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.14);
                break;

            case 'crit':
                makeOsc('square', 1900, now, now + 0.06, 0.12, 0.01);
                makeOsc('sine', 2800, now + 0.01, now + 0.12, 0.1, 0.01);
                noise(now, 0.05, 0.2, 'highpass', 4000, 0, 1);
                break;

            case 'orb': {
                const step = Math.min(param || 0, 14);
                const f = 880 * Math.pow(2, step / 12);
                makeOsc('sine', f, now, now + 0.07, 0.09, 0.01);
                makeOsc('triangle', f * 2, now + 0.01, now + 0.06, 0.04, 0.01);
                break;
            }

            case 'combo': {
                const lvl = Math.min(param || 1, 8);
                const base = 330 * Math.pow(2, lvl / 12);
                [1, 1.26, 1.5, 2].forEach((m, i) => {
                    makeOsc('sawtooth', base * m, now + i * 0.04, now + i * 0.04 + 0.22, 0.07, 0.01, 6);
                    makeOsc('sine', base * m, now + i * 0.04, now + i * 0.04 + 0.3, 0.1, 0.01);
                });
                noise(now, 0.25, 0.12, 'highpass', 3000, 8000, 0.5);
                break;
            }

            case 'overdrive':
                sweep('sawtooth', 80, 900, now, now + 0.6, 0.25);
                sweep('square', 120, 1400, now + 0.05, now + 0.5, 0.12);
                noise(now, 0.7, 0.35, 'bandpass', 300, 5000, 1.5);
                sweep('sine', 120, 30, now + 0.5, now + 1.0, 0.5);
                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.6);
                break;

            case 'land':
                noise(now, 0.08, 0.18, 'lowpass', 600, 120, 0.7);
                sweep('sine', 90, 45, now, now + 0.08, 0.2);
                break;

            case 'shellTink':
                makeOsc('sine', 3200 + Math.random() * 800, now, now + 0.05, 0.04, 0.005);
                break;

            case 'bigExplode': {
                const d = out(param || 0, 0.6, 3);
                const c = out(param || 0, 0.4, 0);
                nz(d, now, 1.4, 0.7, 'lowpass', 2000, 50, 0.7);
                nz(c, now, 0.08, 0.8, 'bandpass', 1600, 400, 0.8);
                tone(c, 'sine', 120, 22, now, 1.1, 1.1);
                tone(d, 'sawtooth', 70, 25, now, 0.6, 0.3);
                for (let i = 0; i < 10; i++) nz(c, now + 0.1 + Math.random() * 0.8, 0.04, 0.15, 'highpass', 2000, 0, 1);
            }
                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.6);
                break;

            case 'slam':
                noise(now, 0.35, 0.6, 'lowpass', 900, 80, 0.8);
                sweep('sine', 110, 35, now, now + 0.35, 0.7);
                break;

            case 'shoot':
                noise(now, 0.07, 0.35, 'bandpass', 2600, 900, 0.9);
                sweep('square', 900, 180, now, now + 0.06, 0.14);
                sweep('sine', 160, 50, now, now + 0.08, 0.35);
                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.06);
                break;

            case '_enemyShootOld':
                makeOsc('square', 500, now, now + 0.07, 0.2, 0.01);
                makeOsc('triangle', 200, now, now + 0.05, 0.12, 0.01);
                                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.04);
                break;

            case 'shotgun':
                noise(now, 0.28, 0.75, 'lowpass', 3500, 200, 0.7);
                sweep('sine', 180, 40, now, now + 0.22, 0.7);
                sweep('sawtooth', 300, 60, now, now + 0.12, 0.18);
                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.16);
                break;

            case 'laser':
                sweep('sawtooth', 2400, 600, now, now + 0.12, 0.12);
                sweep('sine', 1600, 300, now, now + 0.14, 0.14);
                noise(now, 0.05, 0.1, 'highpass', 5000, 0, 1);
                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.08);
                break;

            case 'rocket':
                noise(now, 0.45, 0.45, 'bandpass', 600, 2400, 0.8);
                sweep('sawtooth', 220, 60, now, now + 0.3, 0.2);
                sweep('sine', 120, 40, now, now + 0.2, 0.4);
                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.12);
                break;

            case 'explode': {
                const d = out(param || 0, 0.45, 2.5);
                const c = out(param || 0, 0.3, 0);
                nz(d, now, 0.7, 0.6, 'lowpass', 2600, 70, 0.7);
                nz(c, now, 0.05, 0.7, 'bandpass', 2000, 600, 0.8);
                tone(c, 'sine', 130, 28, now, 0.6, 1.0);
                for (let i = 0; i < 6; i++) nz(c, now + 0.08 + Math.random() * 0.4, 0.03, 0.15, 'highpass', 2500, 0, 1); // 碎片落地
            }
                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.32);
                break;

            case 'kamikazeCharge':
                makeOsc('sawtooth', 400, now, now + 0.3, 0.18, 0.01);
                makeOsc('square', 600, now + 0.05, now + 0.25, 0.12, 0.01, 10);
                                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.1);
                break;

            case 'hit':
                noise(now, 0.07, 0.3, 'bandpass', 1400, 500, 1);
                sweep('triangle', 420, 120, now, now + 0.09, 0.22);
                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.1);
                break;

            case 'playerHit':
                noise(now, 0.16, 0.5, 'lowpass', 1200, 150, 0.9);
                sweep('square', 520, 140, now, now + 0.12, 0.16);
                sweep('sine', 140, 45, now, now + 0.2, 0.55);
                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.2);
                break;

            case 'pickup':
                makeOsc('sine', 600, now, now + 0.1, 0.2, 0.01);
                makeOsc('sine', 900, now + 0.05, now + 0.15, 0.15, 0.01, 3);
                                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.08);
                break;

            case 'upgrade':
                makeOsc('sine', 400, now, now + 0.15, 0.2, 0.01);
                makeOsc('sine', 600, now + 0.08, now + 0.2, 0.15, 0.01, 2);
                makeOsc('sine', 800, now + 0.15, now + 0.3, 0.2, 0.01, 5);
                                if (typeof Renderer !== 'undefined') Renderer.addAudioPulse(0.12);
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
                noise(now, 0.07, 0.12, 'bandpass', 900, 2500, 1);
                sweep('sine', 220, 420, now, now + 0.09, 0.12);
                break;

            case 'doubleJump':
                makeOsc('sine', 500, now, now + 0.08, 0.14, 0.01);
                makeOsc('sine', 700, now + 0.02, now + 0.1, 0.1, 0.01, 3);
                break;

            case 'dash':
                noise(now, 0.18, 0.3, 'bandpass', 600, 3500, 1.2);
                sweep('triangle', 300, 900, now, now + 0.12, 0.12);
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
        setBgmVolume, restoreBgmVolume, setMusicLevel, setSfxLevel, getLevels,
        setVolume, toggleMute, getMuted, getVolume,
        startAmbient, stopAmbient, updateLowHealth, updateWarning,
        setMasterGainBoost, restoreMasterGain, setBackgroundPaused,
        _setLevels: (t) => { SOUND_LEVELS = t; }
    };
})();
