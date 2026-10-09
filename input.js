// ==================== 输入系统 ====================
const Input = (() => {
    const keys = {};
    const justPressed = new Set();
    const keyHoldTime = {};
    let mouseX = 0, mouseY = 0;
    let mouseDown = false;
    let mouseJustPressed = false;
    let scrollDelta = 0;
    let initialized = false;

    // 触摸控制状态
    let touchAimId = null;
    let touchStickId = null;
    let stickOrigin = { x: 0, y: 0 };
    let stickCurrent = { x: 0, y: 0 };
    const STICK_MAX_RADIUS = 40;
    const STICK_THRESHOLD = 8;
    // 右侧瞄准摇杆：以圆心为原点的方向；轻点不拖动时由游戏自动瞄准最近敌人
    let aimCenter = { x: 0, y: 0 };
    let aimVec = null;
    let aimOverride = null;
    const AIM_DEADZONE = 14;
    function updateAim(x, y) {
        const dx = x - aimCenter.x, dy = y - aimCenter.y;
        const d = Math.hypot(dx, dy);
        aimVec = d > AIM_DEADZONE ? { x: dx / d, y: dy / d } : null;
        const knob = document.getElementById('aim-knob');
        if (knob) {
            const k = Math.min(d, 46) / (d || 1);
            knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
            knob.classList.add('is-active');
        }
    }
    function resetAim() {
        aimVec = null;
        const knob = document.getElementById('aim-knob');
        if (knob) { knob.style.transform = 'translate(0px, 0px)'; knob.classList.remove('is-active'); }
    }

    function init(canvas) {
        if (initialized) return;
        initialized = true;

        window.addEventListener('keydown', e => {
            if (e.repeat) return;
            if (!keys[e.code]) {
                justPressed.add(e.code);
                keyHoldTime[e.code] = 0;
            }
            keys[e.code] = true;
            if (['Space', 'KeyW', 'ArrowUp', 'KeyS', 'ArrowDown'].includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', e => { 
            keys[e.code] = false; 
            delete keyHoldTime[e.code];
        });

        canvas.addEventListener('mousemove', e => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        canvas.addEventListener('mousedown', e => {
            if (e.button === 0) {
                mouseDown = true;
                mouseJustPressed = true;
                Audio.init();
            }
        });
        canvas.addEventListener('mouseup', e => {
            if (e.button === 0) mouseDown = false;
        });
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            scrollDelta += e.deltaY > 0 ? 1 : -1;
        }, { passive: false });
        canvas.addEventListener('contextmenu', e => e.preventDefault());

        initTouchControls();
    }

    function initTouchControls() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (!isTouchDevice) return;
        document.body.classList.add('touch-device');

        const stickArea = document.getElementById('stick-area');
        const aimArea = document.getElementById('aim-area');
        if (!stickArea || !aimArea) return;

        // ===== 虚拟摇杆 =====
        stickArea.addEventListener('touchstart', e => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            touchStickId = touch.identifier;
            const rect = stickArea.getBoundingClientRect();
            stickOrigin.x = rect.left + rect.width / 2;
            stickOrigin.y = rect.top + rect.height / 2;
            updateStick(touch.clientX, touch.clientY);
        }, { passive: false });

        stickArea.addEventListener('touchmove', e => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchStickId) {
                    updateStick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
                }
            }
        }, { passive: false });

        const endStick = e => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchStickId) {
                    e.preventDefault();
                    touchStickId = null;
                    resetStick();
                }
            }
        };
        stickArea.addEventListener('touchend', endStick);
        stickArea.addEventListener('touchcancel', endStick);

        // ===== 瞄准射击区 =====
        aimArea.addEventListener('touchstart', e => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            touchAimId = touch.identifier;
            const ar = aimArea.getBoundingClientRect();
            aimCenter.x = ar.left + ar.width / 2;
            aimCenter.y = ar.top + ar.height / 2;
            updateAim(touch.clientX, touch.clientY);
            mouseDown = true;
            mouseJustPressed = true;
            Audio.init();
        }, { passive: false });

        aimArea.addEventListener('touchmove', e => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchAimId) {
                    updateAim(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
                }
            }
        }, { passive: false });

        const endAim = e => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchAimId) {
                    e.preventDefault();
                    touchAimId = null;
                    mouseDown = false;
                    resetAim();
                }
            }
        };
        aimArea.addEventListener('touchend', endAim);
        aimArea.addEventListener('touchcancel', endAim);

        // ===== 功能按钮绑定 =====
        bindMobileButton('m-btn-jump', 'Space');
        bindMobileButton('m-btn-crouch', 'KeyS');
        bindMobileButton('m-btn-dash', 'KeyC');
        bindMobileButton('m-btn-pickup', 'KeyE');
        bindMobileButton('m-btn-pause', 'Escape');

        // 投掷：按住瞄准，松手投掷
        const throwBtn = document.getElementById('m-btn-throw');
        if (throwBtn) {
            throwBtn.addEventListener('touchstart', e => {
                e.preventDefault();
                simulateKeyDown('KeyQ');
            }, { passive: false });
            throwBtn.addEventListener('touchend', e => {
                e.preventDefault();
                simulateKeyUp('KeyQ');
            });
        }

        // 切枪：循环切换到下一把已拥有的武器（复用滚轮逻辑，跳过空槽位）
        const switchBtn = document.getElementById('m-btn-switch');
        if (switchBtn) {
            switchBtn.addEventListener('touchstart', e => {
                e.preventDefault();
                scrollDelta += 1;
            }, { passive: false });
        }
        bindMobileButton('m-btn-rage', 'KeyV');

        // 全局阻止默认触摸滚动（仅游戏过程中）
        document.addEventListener('touchmove', e => {
            if (e.target.closest('#mobile-controls')) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    function bindMobileButton(id, code) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('touchstart', e => {
            e.preventDefault();
            simulateKeyDown(code);
        }, { passive: false });
        btn.addEventListener('touchend', e => {
            e.preventDefault();
            simulateKeyUp(code);
        });
    }

    function updateStick(x, y) {
        const dx = x - stickOrigin.x;
        const dy = y - stickOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const clampedDist = Math.min(dist, STICK_MAX_RADIUS);

        stickCurrent.x = Math.cos(angle) * clampedDist;
        stickCurrent.y = Math.sin(angle) * clampedDist;

        const knob = document.getElementById('stick-knob');
        if (knob) {
            knob.style.transform = `translate(${stickCurrent.x}px, ${stickCurrent.y}px)`;
        }

        if (clampedDist > STICK_THRESHOLD) {
            if (dx < -STICK_THRESHOLD) {
                simulateKeyDown('KeyA');
                simulateKeyUp('KeyD');
            } else if (dx > STICK_THRESHOLD) {
                simulateKeyDown('KeyD');
                simulateKeyUp('KeyA');
            } else {
                simulateKeyUp('KeyA');
                simulateKeyUp('KeyD');
            }
        } else {
            simulateKeyUp('KeyA');
            simulateKeyUp('KeyD');
        }
    }

    function resetStick() {
        stickCurrent.x = 0;
        stickCurrent.y = 0;
        const knob = document.getElementById('stick-knob');
        if (knob) {
            knob.style.transform = `translate(0px, 0px)`;
        }
        simulateKeyUp('KeyA');
        simulateKeyUp('KeyD');
    }

    function simulateKeyDown(code) {
        if (!keys[code]) {
            justPressed.add(code);
            keyHoldTime[code] = 0;
        }
        keys[code] = true;
    }

    function simulateKeyUp(code) {
        keys[code] = false;
        delete keyHoldTime[code];
    }

    function isDown(code) { return !!keys[code]; }
    function wasPressed(code) { return justPressed.has(code); }
    // 画面在矮屏上会整体缩放，这里把屏幕坐标换算成画布逻辑坐标
    function getMouse() {
        if (aimOverride) return { x: aimOverride.x, y: aimOverride.y };
        const s = (typeof Renderer !== 'undefined' && Renderer.viewScale) ? Renderer.viewScale() : 1;
        return { x: mouseX / s, y: mouseY / s };
    }
    function isMouseDown() { return mouseDown; }
    function wasMousePressed() { return mouseJustPressed; }
    function getScrollDelta() { return scrollDelta; }
    function clearScrollDelta() { scrollDelta = 0; }
    function getHoldTime(code) { return keyHoldTime[code] || 0; }

    function update(dt) {
        for (const code in keyHoldTime) {
            if (keys[code]) {
                keyHoldTime[code] += dt;
            }
        }
    }

    function endFrame() {
        justPressed.clear();
        mouseJustPressed = false;
        scrollDelta = 0;
    }

    function getTouchAim() { return { active: touchAimId !== null, vec: aimVec }; }
    function setAimOverride(p) { aimOverride = p; }
    function isTouch() { return document.body.classList.contains('touch-device'); }

    // 页面一加载就标记触屏设备（之前要等开局才加，导致菜单里的手机样式不生效）
    try {
        if (('ontouchstart' in window || navigator.maxTouchPoints > 0) && document.body) document.body.classList.add('touch-device');
    } catch (e) { /* ignore */ }

    return { getTouchAim, setAimOverride, isTouch, init, isDown, wasPressed, getMouse, isMouseDown, wasMousePressed, getScrollDelta, getHoldTime, update, endFrame, _getJustPressed: () => justPressed };
})();
