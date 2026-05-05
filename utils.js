// ==================== 工具函数 ====================
const Utils = {
    lerp(a, b, t) { return a + (b - a) * t; },
    clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },
    rand(min, max) { return Math.random() * (max - min) + min; },
    randInt(min, max) { return Math.floor(Utils.rand(min, max + 1)); },
    dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
    angle(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); },

    rectCollide(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x &&
               a.y < b.y + b.h && a.y + a.h > b.y;
    },

    pointInRect(px, py, r) {
        return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
    },

    // 简单的相机偏移
    camera: { x: 0, y: 0 },

    toScreen(x, y) {
        return { x: x - this.camera.x, y: y - this.camera.y };
    }
};
