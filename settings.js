// ==================== 设置与画质 ====================
// 音乐 / 音效分开调、震屏强度、画质（自动 / 高 / 中 / 低），保存在本机 localStorage。
// 自动画质：战斗中持续数秒低于 45 帧时逐级降档，并提示玩家。
const GAME_VERSION = '2026.10.10-h';
const Settings = (() => {
    const KEY = 'stickman_settings';
    const QUALITY = {
        high:   { label: '高', pixelRatioCap: 2,   shadows: true,  maxParticles: 900, thinning: 0,    maxLights: 40 },
        medium: { label: '中', pixelRatioCap: 1.5, shadows: true,  maxParticles: 520, thinning: 0.25, maxLights: 24 },
        low:    { label: '低', pixelRatioCap: 1,   shadows: false, maxParticles: 300, thinning: 0.45, maxLights: 12 },
    };
    const ORDER = ['high', 'medium', 'low'];
    const SHAKE = [{ v: 1, label: '标准' }, { v: 0.5, label: '轻微' }, { v: 0, label: '关闭' }];
    const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0) && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    const defaults = { music: 0.8, sfx: 1, shake: 1, quality: 'auto' };
    let cfg = load();
    // 自动模式下当前实际档位：手机从“中”起步，电脑从“高”起步
    let autoTier = isTouch ? 'medium' : 'high';
    let returnMenu = 'start-menu';

    function load() {
        try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return Object.assign({}, defaults); }
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* 存储不可用时忽略 */ }
    }

    function tier() { return cfg.quality === 'auto' ? autoTier : cfg.quality; }

    function applyQuality() {
        const q = QUALITY[tier()] || QUALITY.high;
        try { ['high', 'medium', 'low'].forEach(k => document.body.classList.toggle('quality-' + k, k === tier())); } catch (e) { /* ignore */ }
        if (Renderer.setQuality) Renderer.setQuality(q);
        if (Particles.setQuality) Particles.setQuality(q);
        if (FX.setQuality) FX.setQuality(q);
    }

    function apply() {
        Audio.setMusicLevel(cfg.music);
        Audio.setSfxLevel(cfg.sfx);
        Renderer.setShakeEnabled(cfg.shake);
        applyQuality();
    }

    // ---------- 自动降画质（帧率监测） ----------
    let sampleTime = 0, sampleFrames = 0, warmup = 2.5, slowWindows = 0;
    function resetMonitor() { sampleTime = 0; sampleFrames = 0; warmup = 2.5; slowWindows = 0; }
    // rawDt：真实帧间隔（秒，未截断）；playing：是否处于战斗中
    function tick(rawDt, playing) {
        if (cfg.quality !== 'auto' || !playing) return;
        if (!(rawDt > 0) || rawDt > 0.25) return;          // 切后台/卡顿尖峰不计入
        if (warmup > 0) { warmup -= rawDt; return; }        // 刚开局素材加载时不判断
        sampleTime += rawDt; sampleFrames++;
        if (sampleTime < 2) return;
        const fps = sampleFrames / sampleTime;
        sampleTime = 0; sampleFrames = 0;
        slowWindows = fps < 45 ? slowWindows + 1 : 0;
        if (slowWindows >= 2) {                              // 连续约 4 秒低帧才降档
            const i = ORDER.indexOf(autoTier);
            if (i < ORDER.length - 1) {
                autoTier = ORDER[i + 1];
                applyQuality();
                warmup = 1.5; slowWindows = 0;
                if (typeof FX !== 'undefined' && FX.banner) FX.banner('画质自动调为「' + QUALITY[autoTier].label + '」', { sub: '保持流畅 · 可在设置中手动调整', color: '#9be7ff', glow: '#2f9bd6', size: 30, y: 0.2, life: 2.2, channel: 'quality' });
            }
        }
    }

    // ---------- 设置界面 ----------
    function $(id) { return document.getElementById(id); }
    function show(from) {
        returnMenu = from || 'start-menu';
        document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
        $('settings-menu').classList.remove('hidden');
        document.body.classList.add('menu-open');
        render();
    }
    function hide() {
        $('settings-menu').classList.add('hidden');
        const back = $(returnMenu);
        if (back) back.classList.remove('hidden');
    }

    function render() {
        const box = $('settings-content');
        if (!box) return;
        const pct = v => Math.round(v * 100);
        const qOpts = [['auto', '自动' + (cfg.quality === 'auto' ? '（当前' + QUALITY[autoTier].label + '）' : '')], ['high', '高'], ['medium', '中'], ['low', '低']];
        box.innerHTML = `
            <div class="settings-row">
                <span class="settings-row__label">音乐</span>
                <input type="range" min="0" max="100" step="5" value="${pct(cfg.music)}" oninput="Settings.set('music', this.value / 100)">
                <span class="settings-row__val" id="set-music-val">${pct(cfg.music)}</span>
            </div>
            <div class="settings-row">
                <span class="settings-row__label">音效</span>
                <input type="range" min="0" max="100" step="5" value="${pct(cfg.sfx)}" oninput="Settings.set('sfx', this.value / 100)" onchange="Audio.play('coin')">
                <span class="settings-row__val" id="set-sfx-val">${pct(cfg.sfx)}</span>
            </div>
            <div class="settings-row">
                <span class="settings-row__label">屏幕震动</span>
                <div class="settings-seg">${SHAKE.map(o => `<button class="${cfg.shake === o.v ? 'is-on' : ''}" onclick="Settings.set('shake', ${o.v})">${o.label}</button>`).join('')}</div>
            </div>
            <div class="settings-row">
                <span class="settings-row__label">画质</span>
                <div class="settings-seg">${qOpts.map(([k, l]) => `<button class="${cfg.quality === k ? 'is-on' : ''}" onclick="Settings.set('quality', '${k}')">${l}</button>`).join('')}</div>
            </div>
            <div class="settings-row settings-row--pad">
                <span class="settings-row__label">手柄测试</span>
                <span class="settings-pad" id="set-pad">未检测到手柄：连上后按任意键</span>
            </div>
            <p class="settings-hint">手机卡顿时选“自动”或“低”；低画质会关闭部分光晕并减少粒子。<span class="settings-ver">版本 ${GAME_VERSION}</span></p>`;
        startPadMonitor();
    }

    // 手柄测试：实时显示摇杆和按键，方便确认手柄是否被识别、方向是否正确
    let padTimer = null;
    function startPadMonitor() {
        if (padTimer) return;
        const names = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', '上', '下', '左', '右'];
        padTimer = setInterval(() => {
            const el = $('set-pad');
            const menu = $('settings-menu');
            if (!el || !menu || menu.classList.contains('hidden')) { clearInterval(padTimer); padTimer = null; return; }
            let p = null;
            try { p = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).find(Boolean); } catch (e) { /* ignore */ }
            if (!p) { el.textContent = '未检测到手柄：连上后按任意键'; return; }
            const ax = (p.axes[0] || 0).toFixed(1), ay = (p.axes[1] || 0).toFixed(1);
            const down = p.buttons.map((b, i) => (b && (b.pressed || b.value > 0.5)) ? (names[i] || '#' + i) : null).filter(Boolean);
            const dir = ay < -0.55 ? '↑跳' : ay > 0.6 ? '↓蹲' : ax < -0.3 ? '←' : ax > 0.3 ? '→' : '·';
            el.textContent = `${p.mapping === 'standard' ? '标准' : '非标准'}布局 · 左摇杆 ${ax}, ${ay} ${dir} · 按下: ${down.join(' ') || '无'}`;
        }, 100);
    }

    function set(key, value) {
        cfg[key] = value;
        save();
        if (key === 'music') { Audio.setMusicLevel(value); const el = $('set-music-val'); if (el) el.textContent = Math.round(value * 100); return; }
        if (key === 'sfx') { Audio.setSfxLevel(value); const el = $('set-sfx-val'); if (el) el.textContent = Math.round(value * 100); return; }
        if (key === 'shake') { Renderer.setShakeEnabled(value); if (value > 0) Renderer.shake(10, 0.25); }
        if (key === 'quality') { if (value === 'auto') resetMonitor(); applyQuality(); }
        render();
    }

    function get() { return Object.assign({ tier: tier() }, cfg); }

    return { apply, tick, resetMonitor, show, hide, set, get, QUALITY };
})();

try { Settings.apply(); } catch (e) { console.warn('设置应用失败', e); }

// ==================== 新版本提示 ====================
// 浏览器/CDN 可能缓存旧文件几分钟。启动时向服务器要最新版本号（绕过缓存），
// 和当前运行的版本不一致就在顶部提示，点一下清掉缓存并重新加载。
(function checkForUpdate() {
    if (location.protocol === 'file:') return;
    function forceReload() {
        const done = () => location.replace(location.pathname + '?v=' + Date.now());
        const jobs = [];
        try { if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())))); } catch (e) { /* ignore */ }
        try { if (window.caches) jobs.push(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))); } catch (e) { /* ignore */ }
        Promise.all(jobs).then(done, done);
    }
    function show(ver) {
        let el = document.getElementById('update-bar');
        if (!el) {
            el = document.createElement('button');
            el.id = 'update-bar';
            el.onclick = forceReload;
            document.body.appendChild(el);
        }
        el.textContent = `有新版本 ${ver}（当前 ${GAME_VERSION}）· 点这里更新`;
    }
    function check() {
        fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
            .then(r => r.ok ? r.json() : null)
            .then(j => { if (j && j.version && j.version !== GAME_VERSION) show(j.version); })
            .catch(() => {});
    }
    setTimeout(check, 1500);
    // 切回页面时也查一次（手机上常常是切后台再回来）
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
})();
