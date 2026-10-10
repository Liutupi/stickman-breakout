// ==================== 手柄支持（蓝牙 / 有线，标准布局：Xbox / PS / Switch Pro / 多数安卓手柄） ====================
// 战斗：左摇杆/十字键移动，摇杆上推/十字键上 跳（二段跳再推一次），摇杆下 蹲；A/RT 射击，右摇杆瞄准（不推则自动瞄准）；
//       B 冲刺，X 拾取，Y 切枪，LB 狂暴，LT 投掷，RB（或 R3）切换手雷/燃烧瓶，L3 护盾，Select 升级武器，Start 暂停。
// 菜单：摇杆/十字键移动选择，A 确认，B 返回。
const PadInput = (() => {
    const DEAD = 0.28;
    // 标准按键编号
    const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
    // 按键 → 模拟的键盘键
    // 跳跃 = 左摇杆上推 / 十字键上（不占按键）；A 也能射击，方便单手玩
    const KEYMAP = { [BTN.B]: 'KeyC', [BTN.X]: 'KeyE', [BTN.LB]: 'KeyV', [BTN.LT]: 'KeyQ', [BTN.RB]: 'KeyF', [BTN.R3]: 'KeyF', [BTN.SELECT]: 'KeyR', [BTN.START]: 'Escape', [BTN.L3]: 'ShiftLeft' };
    // 输入“去向”：1P = 全局输入（与键盘鼠标共用），2P = 双人模式下 2P 的独立输入源
    const SINKS = {
        p1: { held: {}, stickJump: false, keyDown: c => Input.keyDown(c), keyUp: c => Input.keyUp(c), fire: v => Input.setGamepadFire(v), aim: v => Input.setGamepadAim(v), scroll: n => Input.addScroll(n) },
        p2: { held: {}, stickJump: false, keyDown: c => Input.p2.keyDown(c), keyUp: c => Input.p2.keyUp(c), fire: v => Input.p2.setFire(v), aim: v => Input.p2.setAim(v), scroll: n => Input.p2.addScroll(n) },
    };
    const prevByPad = {};
    const prevOf = p => prevByPad[p.index] || [];
    let awake = false;        // 手柄是否已被按过（第一下只用于唤醒，不当确认）

    let running = false;
    let menuFocus = null, menuRoot = null, navCooldown = 0, lastT = 0;
    let announced = false;

    function pads() {
        try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean); } catch (e) { return []; }
    }

    function pressed(b) { return !!b && (b.pressed || b.value > 0.5); }

    function setKey(sink, code, down) {
        if (down && !sink.held[code]) { sink.held[code] = true; sink.keyDown(code); }
        else if (!down && sink.held[code]) { sink.held[code] = false; sink.keyUp(code); }
    }
    function releaseSink(sink) {
        for (const code in sink.held) if (sink.held[code]) sink.keyUp(code);
        sink.held = {};
        sink.stickJump = false;
        sink.fire(false);
        sink.aim(null);
    }
    function releaseAll() { releaseSink(SINKS.p1); releaseSink(SINKS.p2); }
    function isCoop() { return typeof Game !== 'undefined' && Game.isCoop && Game.isCoop(); }

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
        const prev = prevOf(p);
        const edge = b => pressed(p.buttons[b]) && !prev[b];
        if (edge(BTN.A)) activate(menuFocus);
        if (edge(BTN.B)) back(root);
        if (edge(BTN.START)) { if (root.id === 'pause-menu') Game.resume(); else activate(menuFocus); }
    }

    // ---------- 战斗 ----------
    // 非标准布局（很多手柄的 D-input 模式）：十字键常以“帽子开关”报在某个轴上（上≈-1，右≈-0.43，下≈0.14，左≈0.71）
    function hatDirs(p) {
        if (p.mapping === 'standard') return null;
        // 只看第 10 个轴（Chrome 在 Windows 上报告帽子开关的位置），避免把扳机的静止值 -1 误当成“上”
        {
            const v = p.axes[9];
            if (v === undefined || v > 1.05 || v < -1.05) return null;
            const near = t => Math.abs(v - t) < 0.12;
            if (near(-1) || near(-0.71) || near(1)) return { up: true, right: near(-0.71), left: near(1), down: false };
            if (near(-0.43)) return { right: true };
            if (near(-0.14)) return { right: true, down: true };
            if (near(0.14)) return { down: true };
            if (near(0.43)) return { down: true, left: true };
            if (near(0.71)) return { left: true };
        }
        return null;
    }

    function playStep(p, sink) {
        const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        const b = p.buttons.slice();
        const hat = hatDirs(p);
        if (hat) {
            if (hat.up) b[BTN.UP] = { pressed: true, value: 1 };
            if (hat.down) b[BTN.DOWN] = { pressed: true, value: 1 };
            if (hat.left) b[BTN.LEFT] = { pressed: true, value: 1 };
            if (hat.right) b[BTN.RIGHT] = { pressed: true, value: 1 };
        }
        setKey(sink, 'KeyA', ax < -DEAD || pressed(b[BTN.LEFT]));
        setKey(sink, 'KeyD', ax > DEAD || pressed(b[BTN.RIGHT]));
        setKey(sink, 'KeyS', ay > 0.6 || pressed(b[BTN.DOWN]));
        // 左摇杆明显上推 = 跳；回到中间附近才算松开，再推一次就是二段跳
        if (!sink.stickJump && ay < -0.55 && -ay > Math.abs(ax) * 0.6) sink.stickJump = true;
        else if (sink.stickJump && ay > -0.3) sink.stickJump = false;
        setKey(sink, 'Space', sink.stickJump || pressed(b[BTN.UP]));
        const want = {};
        for (const k in KEYMAP) want[KEYMAP[k]] = want[KEYMAP[k]] || pressed(b[k]);
        for (const code in want) setKey(sink, code, want[code]);
        if (pressed(b[BTN.Y]) && !prevOf(p)[BTN.Y]) sink.scroll(1);
        sink.fire(pressed(b[BTN.A]) || pressed(b[BTN.RT]));
        const rx = p.axes[2] || 0, ry = p.axes[3] || 0;
        const m = Math.hypot(rx, ry);
        sink.aim(m > 0.35 ? { x: rx / m, y: ry / m } : null);
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
        const savePrev = () => { for (const q of list) prevByPad[q.index] = q.buttons.map(pressed); };
        const coop = isCoop();
        const active = list.find(anyInput);

        // 第一下只用于唤醒
        if (active && !awake) {
            awake = true;
            if (!coop) Input.setGamepadActive(true);
            if (!announced) { announced = true; toast(coop ? '手柄已连接 · 双人模式下此手柄为 2P' : '手柄已连接 · 摇杆上推跳 / A 或 RT 射击 / 右摇杆瞄准'); }
            try { Audio.init(); } catch (e) { /* ignore */ }
            savePrev();
            return;
        }
        if (!awake) { savePrev(); return; }

        const root = visibleMenu();
        const rotate = document.getElementById('rotate-hint');
        const rotateOn = rotate && getComputedStyle(rotate).display !== 'none';
        if (root && !rotateOn) {
            releaseAll();
            // 菜单：任何一个手柄都能操作
            menuStep(active || list[0], now, dt, root);
        } else {
            if (menuFocus) setFocus(null);
            menuRoot = null;
            if (coop) {
                // 双人：只有 1 个手柄 → 给 2P；2 个手柄 → 第 1 个给 1P，第 2 个给 2P
                const p2pad = list.length >= 2 ? list[1] : list[0];
                const p1pad = list.length >= 2 ? list[0] : null;
                if (p1pad) {
                    if (anyInput(p1pad) && !Input.gamepadActive()) Input.setGamepadActive(true);
                    if (Input.gamepadActive()) playStep(p1pad, SINKS.p1);
                } else if (Input.gamepadActive()) { releaseSink(SINKS.p1); Input.setGamepadActive(false); }
                if (!Game.hasP2()) {
                    releaseSink(SINKS.p2);
                    if (anyInput(p2pad) && Game.isPlaying && Game.isPlaying()) { Game.joinP2(); savePrev(); return; }
                } else {
                    playStep(p2pad, SINKS.p2);
                }
            } else {
                releaseSink(SINKS.p2);
                const p = active || list[0];
                if (active && !Input.gamepadActive()) Input.setGamepadActive(true);
                if (Input.gamepadActive()) playStep(p, SINKS.p1);
            }
        }
        savePrev();
    }

    function start() {
        if (running) return;
        running = true;
        lastT = 0;
        requestAnimationFrame(step);
    }

    // 震动反馈（支持的手柄才会震）
    function rumble(strength, ms) {
        if (!Input.gamepadActive() && !isCoop()) return;
        for (const p of pads()) {
            const act = p && p.vibrationActuator;
            if (!act || !act.playEffect) continue;
            try {
                act.playEffect('dual-rumble', { duration: Math.min(400, ms || 120), strongMagnitude: Math.min(1, strength), weakMagnitude: Math.min(1, strength * 0.7) }).catch(() => {});
            } catch (e) { /* ignore */ }
        }
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
