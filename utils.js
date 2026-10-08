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

    // 预渲染的发光贴图（替代每帧创建径向渐变，大幅降低绘制开销）
    _glowCache: {},
    glowSprite(rgb) {
        let c = this._glowCache[rgb];
        if (c) return c;
        c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, `rgba(${rgb},1)`);
        grad.addColorStop(0.35, `rgba(${rgb},0.4)`);
        grad.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        this._glowCache[rgb] = c;
        return c;
    },
    drawGlow(ctx, rgb, x, y, r, alpha) {
        if (alpha <= 0.003 || r <= 0) return;
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.drawImage(this.glowSprite(rgb), x - r, y - r, r * 2, r * 2);
    },

    // 两段式肢体 IK：给定根部与末端，求关节位置（bend=1/-1 决定弯曲方向）
    ik(x0, y0, x1, y1, l1, l2, bend) {
        let dx = x1 - x0, dy = y1 - y0;
        let d = Math.hypot(dx, dy) || 0.0001;
        const maxD = l1 + l2 - 0.01;
        if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
        const a = Math.atan2(dy, dx);
        const cosA = Utils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
        const ang = a + Math.acos(cosA) * (bend || 1);
        return { jx: x0 + Math.cos(ang) * l1, jy: y0 + Math.sin(ang) * l1, ex: x0 + dx, ey: y0 + dy };
    },

    // 简单的相机偏移
    camera: { x: 0, y: 0 },

    toScreen(x, y) {
        return { x: x - this.camera.x, y: y - this.camera.y };
    }
};
