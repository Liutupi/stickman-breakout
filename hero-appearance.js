// 装甲附着在原 IK 关节上；跑跳、蹲伏、双手瞄准继续使用原动画。
const HeroAppearance = (() => {
    const TIERS = [
        { level: 1, name: '侦察新兵', accent: '#70d5fa', armor: '#1b2638', detail: '白色圆头 · 轻装围巾' },
        { level: 3, name: '疾风游侠', accent: '#92e7ff', armor: '#33465e', detail: '银色护腕 · 单肩轻甲' },
        { level: 6, name: '苍蓝先锋', accent: '#55dcff', armor: '#40657c', detail: '双肩装甲 · 苍蓝核心' },
        { level: 10, name: '星辉统领', accent: '#f0d08d', armor: '#d3e1e9', detail: '白金胸甲 · 星辉头饰' },
        { level: 15, name: '天穹守卫', accent: '#b2edff', armor: '#deebee', detail: '机械光翼 · 银金装甲' },
        { level: 20, name: '破晓传奇', accent: '#ffe2a0', armor: '#fff0cc', detail: '四刃光翼 · 破晓光环' },
    ].map((tier, index) => ({ ...tier, index }));
    function forLevel(level) { return TIERS.filter(t => level >= t.level).at(-1) || TIERS[0]; }
    function next(level) { return TIERS.find(t => t.level > level) || null; }
    function polygon(ctx, pts, fill, stroke) {
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
        ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    }
    function back(ctx, p, x, y, headY) {
        const tier = p.appearance || TIERS[0], n = tier.index;
        ctx.save(); ctx.lineWidth = 1;
        if (n >= 3) {
            const count = n >= 5 ? 2 : 1;
            for (const side of [-1, 1]) for (let i = 0; i < count; i++) {
                const wave = Math.sin(p.animTime * 3 + i + side) * 2;
                const reach = (n >= 4 ? 25 : 14) + i * 8;
                const rootX = x + side * 7, rootY = y + 3 + i * 7;
                polygon(ctx, [[rootX, rootY], [x + side * reach, y - 13 + i * 18 + wave],
                    [x + side * (reach - 5), y - 1 + i * 16 + wave], [rootX, rootY + 6]], '#233d55', tier.accent);
                if (n >= 4) {
                    polygon(ctx, [[rootX, rootY], [x + side * (reach + 9), y - 22 + i * 28 + wave],
                        [x + side * (reach - 2), y - 8 + i * 24 + wave]], '#71dcf080', '#c5f5ff');
                }
            }
        }
        if (n >= 5) {
            ctx.strokeStyle = '#ffe2a0'; ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.7 + Math.sin(p.animTime * 3) * 0.15;
            ctx.beginPath(); ctx.ellipse(x, headY - 16, 12, 3, -0.1, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }
    function armor(ctx, p, shoulderX, shoulderY, legA, legB, armFront) {
        const tier = p.appearance || TIERS[0], n = tier.index;
        if (!n) return;
        ctx.save(); ctx.lineWidth = 1;
        const metal = ctx.createLinearGradient(shoulderX - 8, shoulderY - 5, shoulderX + 10, shoulderY + 12);
        metal.addColorStop(0, n >= 3 ? '#ffffff' : '#a0c3db'); metal.addColorStop(0.45, tier.armor); metal.addColorStop(1, '#253a52');
        for (const side of n >= 2 ? [-1, 1] : [-1]) {
            const x = shoulderX + side * 6;
            polygon(ctx, [[x - 6, shoulderY - 3], [x + 2, shoulderY - 6], [x + 7, shoulderY + 2], [x - 4, shoulderY + 4]], metal, tier.accent);
        }
        if (n >= 2) for (const leg of [legA, legB]) {
            polygon(ctx, [[leg.jx - 3, leg.jy - 4], [leg.jx + 3, leg.jy - 3], [leg.jx + 4, leg.jy + 4], [leg.jx - 2, leg.jy + 3]], metal, tier.accent);
        }
        // 前臂装甲和手臂一起转动，瞄准方向仍然由 IK 决定。
        ctx.translate(armFront.jx, armFront.jy);
        ctx.rotate(Math.atan2(armFront.ey - armFront.jy, armFront.ex - armFront.jx));
        polygon(ctx, [[0, -3], [7, -3], [9, 0], [7, 3], [0, 2]], metal, tier.accent);
        ctx.restore();
    }
    function head(ctx, p) {
        const tier = p.appearance || TIERS[0];
        if (tier.index < 2) return;
        ctx.save(); ctx.lineWidth = 1;
        polygon(ctx, [[-8, -6], [-8, 4], [-4, 8], [-2, 3], [-4, -4]], tier.armor, tier.accent);
        if (tier.index >= 3) polygon(ctx, [[-7, -5], [-11, -13], [-5, -9], [-2, -6]], tier.armor, tier.accent);
        ctx.restore();
    }
    return { TIERS, forLevel, next, back, armor, head };
})();
