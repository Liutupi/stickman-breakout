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

    function init(canvas) {
        if (initialized) return;
        initialized = true;

        window.addEventListener('keydown', e => {
            if (e.repeat) return;  // 忽略长按产生的重复事件，防止连续跳跃
            if (!keys[e.code]) {
                justPressed.add(e.code);
                keyHoldTime[e.code] = 0;
            }
            keys[e.code] = true;
            if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) e.preventDefault();
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
    }

    function isDown(code) { return !!keys[code]; }
    function wasPressed(code) { 
        if (justPressed.has(code)) {
            justPressed.delete(code);
            return true;
        }
        return false;
    }
    function getMouse() { return { x: mouseX, y: mouseY }; }
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

    return { init, isDown, wasPressed, getMouse, isMouseDown, wasMousePressed, getScrollDelta, getHoldTime, update, endFrame, _getJustPressed: () => justPressed };
})();
