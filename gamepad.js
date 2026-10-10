// ==================== 手柄支持（蓝牙 / 有线，标准布局：Xbox / PS / Switch Pro / 多数安卓手柄） ====================
// 战斗：左摇杆/十字键移动，A 跳，B 冲刺，X 拾取，Y 切枪，RT/RB 射击，LT 投掷，LB 切换手雷/燃烧瓶，
//       右摇杆瞄准（不推则自动瞄准最近敌人），R3/十字键上 狂暴，L3 护盾，Select 升级武器，Start 暂停。
// 菜单：摇杆/十字键移动选择，A 确认，B 返回。
const PadInput = (() => {
    const DEAD = 0.28;
    // 标准按键编号
    const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
    // 按键 → 模拟的键盘键
    const KEYMAP = { [BTN.A]: 'Space', [BTN.B]: 'KeyC', [BTN.X]: 'KeyE', [BTN.LB]: 'KeyF', [BTN.LT]: 'KeyQ', [BTN.SELECT]: 'KeyR', [BTN.START]: 'Escape', [BTN.L3]: 'ShiftLeft', [BTN.R3]: 'KeyV', [BTN.UP]: 'KeyV' };

    let prev = [];
    let held = {};            // 当前由手柄按住的键盘键
    let running = false;
    let menuFocus = null, menuRoot = null, navCooldown = 0, lastT = 0;
    let announced = false;

    function pads() {
        try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean); } catch (e) { return []; }
    }

    function pressed(b) { return !!b && (b.pressed || b.value > 0.5); }

    function setKey(code, down) {
        if (down && !held[code]) { held[code] = true; Input.keyDown(code); }
        else if (!down && held[code]) { held[code] = false; Input.keyUp(code); }
    }
    function releaseAll() {
        for (const code in held) if (held[code]) Input.keyUp(code);
        held = {};
        Input.setGamepadFire(false);
        Input.setGamepadAim(null);
    }

    function toast(text) {
        let el = document.getElementById('gp-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'gp-toast';
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.classList.add('is-on');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('is-on'), 2600);
    }

    // ---------- 菜单导航 ----------
    function visibleMenu() {
        const guide = document.getElementById('install-guide');
        if (guide && !guide.classList.contains('hidden')) return guide;
        const boot = document.getElementById('boot-screen');
        if (boot && !boot.classList.contains('hidden')) return boot;
        return document.querySelector('#ui-layer .menu:not(.hidden)');
    }
    function focusables(root) {
        if (root.id === 'boot-screen') return [root];
        const list = root.querySelectorAll('button, .level-card, .difficulty-card, .upgrade-choice-card, .player-list-item, input[type="range"], input[type="text"]');
        return Array.from(list).filter(el => {
            if (el.disabled) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
        });
    }
    function setFocus(el) {
        if (menuFocus) menuFocus.classList.remove('gp-focus');
        menuFocus = el;
        if (el) {
            el.classList.add('gp-focus');
            try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* ignore */ }
        }
    }
    function defaultFocus(items) {
        return items.find(el => el.classList.contains('menu-btn--primary') && !el.classList.contains('hidden'))
            || items.find(el => /continue|next-level|checkpoint/.test(el.id || ''))
            || items[0];
    }
    function moveFocus(items, dx, dy) {
        if (!menuFocus || !items.includes(menuFocus)) { setFocus(defaultFocus(items)); return; }
        const a = menuFocus.getBoundingClientRect();
        const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
        let best = null, bestScore = Infinity;
        for (const el of items) {
            if (el === menuFocus) continue;
            const r = el.getBoundingClientRect();
            const vx = r.left + r.width / 2 - ax, vy = r.top + r.height / 2 - ay;
            const along = vx * dx + vy * dy;
            if (along <= 4) continue;
            const across = Math.abs(vx * dy - vy * dx);
            const score = along + across * 2.2;
            if (score < bestScore) { bestScore = score; best = el; }
        }
        if (best) { setFocus(best); try { Audio.play('switch'); } catch (e) { /* ignore */ } }
    }
    function activate(el) {
        if (!el) return;
        if (el.tagName === 'INPUT' && el.type === 'text') { el.focus(); return; }
        el.click();
    }
    function back(root) {
        if (root.id === 'install-guide') { Install.hide(); return; }
        if (root.id === 'pause-menu') { Game.resume(); return; }
        const btns = Array.from(root.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        const b = btns.find(x => /^返回/.test(x.textContent.trim())) || btns.find(x => /返回/.test(x.textContent));
        if (b) b.click();
    }
    function adjustRange(el, dir) {
        const step = +el.step || 1;
        el.value = Math.max(+el.min || 0, Math.min(+el.max || 100, +el.value + dir * step));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function menuStep(p, now, dt, root) {
        const items = focusables(root);
        if (root !== menuRoot || !menuFocus || !items.includes(menuFocus)) {
            menuRoot = root;
            setFocus(defaultFocus(items));
        }
        const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        let dx = 0, dy = 0;
        if (pressed(p.buttons[BTN.LEFT]) || ax < -0.5) dx = -1;
        else if (pressed(p.buttons[BTN.RIGHT]) || ax > 0.5) dx = 1;
        else if (pressed(p.buttons[BTN.UP]) || ay < -0.5) dy = -1;
        else if (pressed(p.buttons[BTN.DOWN]) || ay > 0.5) dy = 1;
        navCooldown -= dt;
        if ((dx || dy) && navCooldown <= 0) {
            if (dx && menuFocus && menuFocus.type === 'range') adjustRange(menuFocus, dx);
            else moveFocus(items, dx, dy);
            navCooldown = navCooldown < -0.05 ? 0.28 : 0.13;    // 按住时先停顿再连跳
        } else if (!dx && !dy) navCooldown = 0;
        const edge = b => pressed(p.buttons[b]) && !prev[b];
        if (edge(BTN.A)) activate(menuFocus);
        if (edge(BTN.B)) back(root);
        if (edge(BTN.START)) { if (root.id === 'pause-menu') Game.resume(); else activate(menuFocus); }
    }

    // ---------- 战斗 ----------
    function playStep(p) {
        const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        const b = p.buttons;
        setKey('KeyA', ax < -DEAD || pressed(b[BTN.LEFT]));
        setKey('KeyD', ax > DEAD || pressed(b[BTN.RIGHT]));
        setKey('KeyS', ay > 0.6 || pressed(b[BTN.DOWN]));
        for (const k in KEYMAP) {
            const code = KEYMAP[k];
            if (code === 'KeyV') continue;
            setKey(code, pressed(b[k]));
        }
        setKey('KeyV', pressed(b[BTN.R3]) || pressed(b[BTN.UP]));
        if (pressed(b[BTN.Y]) && !prev[BTN.Y]) Input.addScroll(1);
        Input.setGamepadFire(pressed(b[BTN.RT]) || pressed(b[BTN.RB]));
        const rx = p.axes[2] || 0, ry = p.axes[3] || 0;
        const m = Math.hypot(rx, ry);
        Input.setGamepadAim(m > 0.35 ? { x: rx / m, y: ry / m } : null);
    }

    function anyInput(p) {
        if (p.buttons.some(pressed)) return true;
        return p.axes.some(v => Math.abs(v) > 0.5);
    }

    function step(now) {
        if (!running) return;
        requestAnimationFrame(step);
        const dt = Math.min(0.1, (now - (lastT || now)) / 1000);
        lastT = now;
        const list = pads();
        if (!list.length) return;
        const p = list.find(anyInput) || list[0];
        if (anyInput(p) && !Input.gamepadActive()) {
            Input.setGamepadActive(true);
            if (!announced) { announced = true; toast('手柄已连接 · A 跳 / RT 射击 / 右摇杆瞄准'); }
            try { Audio.init(); } catch (e) { /* ignore */ }
            prev = p.buttons.map(pressed);      // 唤醒用的这一下不当作确认，避免误触开局
            return;
        }
        if (!Input.gamepadActive()) { prev = p.buttons.map(pressed); return; }

        const root = visibleMenu();
        const rotate = document.getElementById('rotate-hint');
        const rotateOn = rotate && getComputedStyle(rotate).display !== 'none';
        if (root && !rotateOn) {
            releaseAll();
            // Start 在暂停菜单里也要能直接继续（交给游戏的 Escape 逻辑之外处理）
            menuStep(p, now, dt, root);
        } else {
            if (menuFocus) setFocus(null);
            menuRoot = null;
            playStep(p);
        }
        prev = p.buttons.map(pressed);
    }

    function start() {
        if (running) return;
        running = true;
        lastT = 0;
        requestAnimationFrame(step);
    }

    // 震动反馈（支持的手柄才会震）
    function rumble(strength, ms) {
        if (!Input.gamepadActive()) return;
        const p = pads()[0];
        const act = p && p.vibrationActuator;
        if (!act || !act.playEffect) return;
        try {
            act.playEffect('dual-rumble', { duration: Math.min(400, ms || 120), strongMagnitude: Math.min(1, strength), weakMagnitude: Math.min(1, strength * 0.7) }).catch(() => {});
        } catch (e) { /* ignore */ }
    }

    window.addEventListener('gamepadconnected', e => { toast(`已检测到手柄：按任意键开始使用`); start(); });
    window.addEventListener('gamepaddisconnected', () => {
        if (!pads().length) { releaseAll(); Input.setGamepadActive(false); setFocus(null); toast('手柄已断开'); }
    });
    // 触屏一碰就切回触屏操作
    window.addEventListener('touchstart', () => { if (Input.gamepadActive()) { releaseAll(); Input.setGamepadActive(false); setFocus(null); } }, { passive: true });
    // 有些浏览器在页面加载前就连上了手柄，不会再发 connected 事件
    if (pads().length) start();
    else setTimeout(() => { if (pads().length) start(); }, 1500);

    return { rumble, start, _step: step };
})();
