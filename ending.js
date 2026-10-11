// ==================== 通关结局：结算 → 怪兽巡礼 → 制作人员 → 宣传片 ====================
const Ending = (() => {
    const CREDITS = [
        { role: '主创', names: ['刘果鑫', '刘沐鑫'] },
        { role: '辅助创作', names: ['刘东坡'] },
        { role: '美术设计', names: ['克劳德（Claude）', '酷爹'] },
        { role: '音乐设计', names: ['刘果鑫'] },
    ];
    // 巡礼用的外观参数（颜色/尺寸与关卡里一致）
    const LOOK = {
        walker: { color: '#e97d64' }, runner: { color: '#c0392b' }, shooter: { color: '#ec9c62' }, jumper: { color: '#d796ed' },
        kamikaze: { color: '#f39c12' }, turret: { color: '#e74c3c' }, missile: { color: '#9b59b6' }, shielder: { color: '#82b8d8', shieldHP: 60 },
        sniper: { color: '#ff3b5c' }, lancer: { color: '#ffbd69' }, scattergun: { color: '#ff7394' }, medic: { color: '#67efbb' },
        flyer: { color: '#00bcd4', air: 1 }, drone: { color: '#00ffff', air: 1 }, bomber: { color: '#ff8800', air: 1 }, swooper: { color: '#ff4488', air: 1 },
        sentinel: { color: '#c9a2ff', w: 38, h: 48, air: 1 }, swarm: { color: '#ffd166', w: 20, h: 18, air: 1 },
        diver: { color: '#ff7a7a', w: 36, h: 26, air: 1 }, gunship: { color: '#7cc4ff', w: 76, h: 40, air: 1 },
    };
    const ORDER = ['walker', 'runner', 'shooter', 'jumper', 'kamikaze', 'turret', 'missile', 'shielder', 'lancer', 'scattergun',
        'medic', 'sniper', 'flyer', 'drone', 'bomber', 'swooper', 'sentinel', 'swarm', 'diver', 'gunship'];
    const PER_PAGE = 4, PAGE_TIME = 3.6, BOSS_TIME = 2.8;

    let root = null, canvas = null, ctx = null, raf = 0, last = 0;
    let phase = '', phaseT = 0, onDone = null, actors = [], page = -1, bossIdx = -1, flash = 0, shake = 0;

    function $(id) { return document.getElementById(id); }
    function info() { return (typeof Game !== 'undefined' && Game.enemyInfo) ? Game.enemyInfo() : {}; }

    function build() {
        if (root) return;
        root = document.createElement('div');
        root.id = 'ending';
        root.className = 'ending hidden';
        root.innerHTML = `
            <canvas id="ending-canvas"></canvas>
            <div class="ending-layer" id="ending-results"></div>
            <div class="ending-layer ending-parade-ui" id="ending-parade-ui"><div class="ending-parade-title" id="ending-parade-title"></div></div>
            <div class="ending-layer" id="ending-credits"><div class="ending-credits-roll" id="ending-roll"></div></div>
            <div class="ending-layer" id="ending-video">
                <div class="ending-video-title">《火柴人：突围行动》宣传片</div>
                <video id="ending-video-el" controls playsinline preload="none" poster="assets/title-key-art-guomu.webp"></video>
                <div class="ending-video-actions">
                    <button class="menu-btn" onclick="Ending.replayVideo()">再看一遍</button>
                    <button class="menu-btn secondary" onclick="Ending.finish()">返回</button>
                </div>
            </div>
            <div class="ending-skip">
                <button class="menu-btn secondary" id="ending-next" onclick="Ending.next()">下一段 ›</button>
                <button class="menu-btn secondary" onclick="Ending.toVideo()">跳到宣传片 »</button>
            </div>`;
        document.body.appendChild(root);
        canvas = $('ending-canvas');
        ctx = canvas.getContext('2d');
        window.addEventListener('resize', resize);
        window.addEventListener('keydown', e => {
            if (!root || root.classList.contains('hidden')) return;
            if (e.code === 'Escape') { e.stopPropagation(); phase === 'video' ? finish() : next(); }
        }, true);
    }

    function resize() {
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(innerWidth * dpr); canvas.height = Math.floor(innerHeight * dpr);
        canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    }

    function show(id) {
        ['ending-results', 'ending-parade-ui', 'ending-credits', 'ending-video'].forEach(k => $(k).classList.toggle('is-on', k === id));
        root.querySelector('.ending-skip').classList.toggle('hidden', id === 'ending-video');
    }

    // ---------- 1. 通关结算 ----------
    function fmtTime(s) { s = Math.round(s || 0); return `${Math.floor(s / 60)} 分 ${s % 60} 秒`; }
    function renderResults(st) {
        const grades = (typeof Game !== 'undefined' && Game.bestGrades) ? Game.bestGrades() : {};
        const levelNames = (typeof Levels !== 'undefined') ? Levels.map(l => l.name.split('·').pop().trim()) : [];
        const badges = levelNames.map((n, i) => `<div class="ending-grade ending-grade--${grades[i] || 'none'}"><b>${grades[i] || '—'}</b><span>${i + 1}. ${n}</span></div>`).join('');
        const row = (k, v) => `<div class="ending-stat"><span>${k}</span><b>${v}</b></div>`;
        $('ending-results').innerHTML = `
            <div class="ending-card">
                <div class="ending-kicker">MISSION COMPLETE</div>
                <h1 class="ending-h1">全线突围 · 通关结算</h1>
                <div class="ending-stats">
                    ${row('总积分', (st.finalScore || 0).toLocaleString())}
                    ${row('本次通关关卡', `${st.levels || 1} 关`)}
                    ${row('总击杀', st.kills || 0)}
                    ${row('最高连击', `×${st.maxCombo || 0}`)}
                    ${row('作战用时', fmtTime(st.time))}
                    ${row('获得金币', `+${st.coins || 0}`)}
                </div>
                <div class="ending-sub">九关最佳评级</div>
                <div class="ending-grades">${badges}</div>
                <div class="ending-tip">接下来：全体怪兽登场 · 制作人员 · 宣传片</div>
            </div>`;
    }

    // ---------- 2. 怪兽巡礼 ----------
    function makeEnemy(type, x, groundY) {
        const lk = LOOK[type] || {};
        const cfg = { type, color: lk.color, w: lk.w, h: lk.h, shieldHP: lk.shieldHP || 0 };
        const y = lk.air ? groundY - (type === 'gunship' ? 150 : 110) : groundY;
        const e = new Enemy(x, y, cfg);
        e.baseY = y; e.onGround = !lk.air; e.facing = -1; e.activated = true;
        e._tx = x; e._walk = true;
        return e;
    }

    function setupPage(p) {
        const types = ORDER.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
        const W = innerWidth;
        actors = types.map((t, i) => {
            const e = makeEnemy(t, W + 120 + i * 140, 0);
            e._tx = W * (0.17 + i * 0.22);
            e._label = info()[t] || [t, ''];
            e._delay = i * 0.18;
            return e;
        });
        $('ending-parade-title').innerHTML = `<span>全体怪兽登场</span><small>${p + 1} / ${Math.ceil(ORDER.length / PER_PAGE)}</small>`;
        flash = 0.25;
    }

    function setupBoss(i) {
        const lv = Levels[i];
        const b = new Boss(innerWidth + 200, 0, { ...lv.boss, artIndex: i, h: Math.max(Math.round(lv.boss.h * 1.3), 154), w: Math.max(lv.boss.w, 64) });
        b.entranceDone = true; b.facing = -1; b.onGround = true;
        if (b.hazards) b.hazards.length = 0;
        b._tx = innerWidth * 0.62;
        actors = [b];
        $('ending-parade-title').innerHTML = `<span>第 ${i + 1} 关首领</span><small>${lv.name}</small>`;
        flash = 0.5; shake = 0.4;
        try { Audio.play('boss'); } catch (e) { /* ignore */ }
    }

    function drawStage(dt) {
        const dpr = canvas.width / innerWidth;
        const W = innerWidth, H = innerHeight;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#070b16'); g.addColorStop(1, '#141b2c');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // 聚光灯
        const groundY = H * 0.68;
        const sp = ctx.createRadialGradient(W / 2, groundY, 20, W / 2, groundY, W * 0.6);
        sp.addColorStop(0, 'rgba(77,184,232,0.18)'); sp.addColorStop(1, 'rgba(77,184,232,0)');
        ctx.fillStyle = sp; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#0b111d'; ctx.fillRect(0, groundY, W, H - groundY);
        ctx.strokeStyle = 'rgba(124,231,255,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();
        return groundY;
    }

    function drawActors(dt, groundY) {
        const W = innerWidth, H = innerHeight;
        const isBoss = phase === 'bosses';
        const scale = isBoss ? Math.max(0.85, Math.min(2.0, H / 520)) : Math.max(1, Math.min(1.9, H / 420));
        const savedCam = { x: Utils.camera.x, y: Utils.camera.y };
        Utils.camera.x = 0; Utils.camera.y = 0;
        const dpr = canvas.width / innerWidth;
        const sx = shake > 0 ? (Math.random() - 0.5) * 14 * shake : 0;
        try {
            for (const e of actors) {
                if (e._delay > 0) { e._delay -= dt; continue; }
                const dx = e._tx - e.x;
                e.vx = Math.abs(dx) > 4 ? Math.sign(dx) * Math.min(1000, Math.abs(dx) * 5) : 0;
                e.x += e.vx * dt;
                e.animTime += dt;
                if (e.legPhase !== undefined) e.legPhase += dt * 10;
                // 用实体自己的 draw：把世界坐标原点放在“脚底”，再整体缩放
                const lk = LOOK[e.type] || {};
                const lift = isBoss ? 0 : (lk.air ? (e.type === 'gunship' ? 120 : 90) + Math.sin(e.animTime * 2) * 6 : 0);
                ctx.save();
                ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (e.x + sx), dpr * (groundY - lift * scale));
                const ox = e.x, oy = e.y;
                e.x = 0; e.y = 0;
                try { e.draw(ctx); } catch (err) { /* ignore */ }
                e.x = ox; e.y = oy;
                ctx.restore();
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
            for (const e of actors) {
                const dx = e._tx - e.x;
                const lk = LOOK[e.type] || {};
                // 名牌（第二遍）
                if (!isBoss && e._label && Math.abs(dx) < 30) {
                    ctx.save();
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    ctx.textAlign = 'center';
                    ctx.font = `900 ${Math.round(Math.min(26, W / 40))}px "Noto Sans SC","Microsoft YaHei",sans-serif`;
                    ctx.fillStyle = lk.color || '#fff';
                    ctx.fillText(e._label[0], e.x, groundY + 46);
                    ctx.font = `600 ${Math.round(Math.min(15, W / 70))}px "Noto Sans SC","Microsoft YaHei",sans-serif`;
                    ctx.fillStyle = 'rgba(220,232,248,0.85)';
                    wrapText(e._label[1], e.x, groundY + 72, Math.min(220, W * 0.2), 20);
                    ctx.restore();
                }
                if (isBoss && Math.abs(dx) < 30) {
                    ctx.save();
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    ctx.textAlign = 'left';
                    ctx.font = `900 ${Math.round(Math.min(56, W / 18))}px "Noto Sans SC","Microsoft YaHei",sans-serif`;
                    ctx.shadowColor = e.color; ctx.shadowBlur = 24;
                    ctx.fillStyle = '#fff';
                    ctx.fillText(e.name, W * 0.08, H * 0.5);
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = e.color;
                    ctx.fillRect(W * 0.08, H * 0.5 + 16, Math.min(320, W * 0.3), 4);
                    ctx.restore();
                }
            }
        } finally {
            Utils.camera.x = savedCam.x; Utils.camera.y = savedCam.y;
        }
        if (flash > 0) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H);
            flash = Math.max(0, flash - dt * 2);
        }
        shake = Math.max(0, shake - dt);
    }

    function wrapText(text, x, y, maxW, lh) {
        let line = '', yy = y;
        for (const ch of text) {
            if (ctx.measureText(line + ch).width > maxW && line) { ctx.fillText(line, x, yy); line = ch; yy += lh; }
            else line += ch;
        }
        if (line) ctx.fillText(line, x, yy);
    }

    // ---------- 3. 制作人员 ----------
    function renderCredits() {
        const block = c => `<div class="ending-credit"><div class="ending-role">${c.role}</div>${c.names.map(n => `<div class="ending-name">${n}</div>`).join('')}</div>`;
        const tracks = (typeof Game !== 'undefined' && Game.bgmList) ? Game.bgmList() : [];
        const music = (typeof Levels !== 'undefined') ? Levels.map((l, i) => tracks[i] ? `<div class="ending-small">${l.name} — 《${tracks[i]}》</div>` : '').join('')
            + (Game.bgmTitle ? `<div class="ending-small">结局 — 《${Game.bgmTitle('bgm_level2')}》</div>` : '') : '';
        const bosses = (typeof Levels !== 'undefined') ? Levels.map((l, i) => `<div class="ending-small">第 ${i + 1} 关 · ${l.boss.name}</div>`).join('') : '';
        $('ending-roll').innerHTML = `
            <div class="ending-logo">火柴人：突围行动</div>
            <div class="ending-tag">STICKMAN · BREAKOUT</div>
            ${CREDITS.map(block).join('')}
            <div class="ending-credit"><div class="ending-role">背景音乐</div>${music}</div>
            <div class="ending-credit"><div class="ending-role">九位首领</div>${bosses}</div>
            <div class="ending-credit"><div class="ending-role">特别感谢</div><div class="ending-name">每一位玩家</div></div>
            <div class="ending-final">果沐兄弟 出品</div>
            <div class="ending-thanks">感谢游玩！</div>`;
    }

    // ---------- 流程 ----------
    function setPhase(p) {
        phase = p; phaseT = 0;
        if (p === 'results') { show('ending-results'); }
        else if (p === 'enemies') { show('ending-parade-ui'); page = 0; setupPage(0); }
        else if (p === 'bosses') { show('ending-parade-ui'); bossIdx = 0; setupBoss(0); }
        else if (p === 'credits') {
            show('ending-credits'); renderCredits();
            const roll = $('ending-roll');
            roll.style.transition = 'none'; roll.style.transform = `translateY(${innerHeight}px)`;
            void roll.offsetHeight;
            const dist = innerHeight + roll.scrollHeight;
            const dur = Math.max(14, dist / 70);
            roll.style.transition = `transform ${dur}s linear`;
            roll.style.transform = `translateY(${-roll.scrollHeight + innerHeight * 0.35}px)`;
            roll._dur = dur;
        } else if (p === 'video') {
            show('ending-video');
            try { Audio.stopBgm(); } catch (e) { /* ignore */ }
            const v = $('ending-video-el');
            if (!v.src) v.src = 'assets/video/promo.mp4';
            v.currentTime = 0;
            v.play().catch(() => {});
        }
    }

    function next() {
        if (phase === 'results') setPhase('enemies');
        else if (phase === 'enemies') { if (++page < Math.ceil(ORDER.length / PER_PAGE)) { setupPage(page); phaseT = 0; } else setPhase('bosses'); }
        else if (phase === 'bosses') { if (++bossIdx < Levels.length) { setupBoss(bossIdx); phaseT = 0; } else setPhase('credits'); }
        else if (phase === 'credits') setPhase('video');
    }

    function loop(now) {
        if (!root || root.classList.contains('hidden')) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (now - (last || now)) / 1000);
        last = now;
        phaseT += dt;
        if (phase === 'enemies' || phase === 'bosses') {
            const groundY = drawStage(dt);
            drawActors(dt, groundY);
            if (phaseT > (phase === 'bosses' ? BOSS_TIME : PAGE_TIME)) next();
        } else if (phase === 'results') {
            drawStage(dt);
            if (phaseT > 9) next();
        } else if (phase === 'credits') {
            drawStage(dt);
            const roll = $('ending-roll');
            if (phaseT > (roll._dur || 16) + 1.5) next();
        }
    }

    function start(opts = {}) {
        build();
        resize();
        onDone = opts.onDone || null;
        renderResults(opts.stats || {});
        root.classList.remove('hidden');
        document.body.classList.add('ending-on');
        try { Audio.playBgm('bgm_level2'); } catch (e) { /* ignore */ }
        setPhase(opts.stats ? 'results' : 'enemies');
        last = 0;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
    }

    function toVideo() { setPhase('video'); }
    function replayVideo() { const v = $('ending-video-el'); v.currentTime = 0; v.play().catch(() => {}); }

    function finish() {
        if (!root) return;
        const v = $('ending-video-el');
        try { v.pause(); } catch (e) { /* ignore */ }
        root.classList.add('hidden');
        document.body.classList.remove('ending-on');
        cancelAnimationFrame(raf);
        try { Audio.stopBgm(); } catch (e) { /* ignore */ }
        const cb = onDone; onDone = null;
        if (cb) cb();
    }

    function isOn() { return !!root && !root.classList.contains('hidden'); }

    return { start, next, toVideo, replayVideo, finish, isOn, CREDITS };
})();
