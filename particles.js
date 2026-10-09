// ==================== 粒子系统（加法发光 + 流光火花）====================
class Particle {
    constructor(x, y, vx, vy, color, life, size) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size || 3;
        this.dead = false;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = Utils.rand(-5, 5);
        this.type = 'circle'; // circle, square, spark, smoke
        this.glow = false;
        this.gravity = 400;
        this.drag = 0;
    }

    update(dt) {
        if (this.drag) {
            const d = Math.pow(1 - this.drag, dt * 60);
            this.vx *= d; this.vy *= d;
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += this.gravity * dt;
        this.life -= dt;
        this.rotation += this.rotationSpeed * dt;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx, cx, cy) {
        const alpha = Utils.clamp(this.life / this.maxLife, 0, 1);
        const sx = this.x - cx, sy = this.y - cy;
        ctx.globalAlpha = alpha;

        if (this.type === 'spark') {
            // 沿速度方向拉长的流光
            const sp = Math.hypot(this.vx, this.vy) || 1;
            const len = Math.min(26, sp * 0.035 + 2) * (0.4 + alpha * 0.6);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.size * (0.5 + alpha * 0.6);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - this.vx / sp * len, sy - this.vy / sp * len);
            ctx.stroke();
        } else if (this.type === 'square') {
            const size = this.size * (0.5 + alpha * 0.5);
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(this.rotation);
            ctx.fillStyle = this.color;
            ctx.fillRect(-size / 2, -size / 2, size, size);
            ctx.restore();
        } else if (this.type === 'smoke') {
            const size = this.size * (1.6 - alpha * 0.6);
            ctx.globalAlpha = alpha * 0.35;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const size = this.size * (0.5 + alpha * 0.5);
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// 浮动伤害数字
class FloatingText {
    constructor(x, y, text, color, opts = {}) {
        this.x = x; this.y = y;
        this.text = text;
        this.color = color || '#fff';
        this.life = opts.life || 0.8;
        this.maxLife = this.life;
        this.vy = opts.vy !== undefined ? opts.vy : -90;
        this.vx = Utils.rand(-30, 30);
        this.dead = false;
        this.scale = 0;
        this.targetScale = opts.scale || 1;
        this.fontSize = opts.size || 17;
        this.crit = !!opts.crit;
    }

    update(dt) {
        this.y += this.vy * dt;
        this.x += this.vx * dt;
        this.vy *= Math.pow(0.9, dt * 60);
        this.vx *= Math.pow(0.92, dt * 60);
        this.life -= dt;
        const age = this.maxLife - this.life;
        // 弹出：先冲过头再回落
        const pop = age < 0.08 ? (age / 0.08) * 1.5 : age < 0.18 ? 1.5 - ((age - 0.08) / 0.1) * 0.5 : 1;
        this.scale = this.targetScale * pop * (this.life < 0.2 ? this.life / 0.2 : 1);
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx, cx, cy) {
        const alpha = Utils.clamp(this.life / this.maxLife * 1.6, 0, 1);
        const sx = this.x - cx;
        const sy = this.y - cy;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(sx, sy);
        if (this.crit) ctx.rotate(Math.sin(this.life * 40) * 0.04);
        ctx.scale(this.scale, this.scale);
        ctx.font = `900 ${this.fontSize}px "Orbitron", "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 4;
        ctx.strokeText(this.text, 0, 0);
        if (this.crit) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 12;
        }
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, 0, 0);
        ctx.restore();
    }
}

const Particles = (() => {
    let particles = [];
    let floatingTexts = [];

    let MAX_PARTICLES = 900;
    let thinning = 0;   // 低画质时按比例丢弃新粒子
    function setQuality(opts) {
        if (opts.maxParticles) MAX_PARTICLES = opts.maxParticles;
        if (opts.thinning !== undefined) thinning = opts.thinning;
        if (particles.length > MAX_PARTICLES) particles.length = MAX_PARTICLES;
    }
    const GLOW_COLORS = new Set(['#ff6600', '#ffcc00', '#fff', '#ffffff', '#f1c40f', '#ff9500', '#ff4400', '#d07830', '#7ce7ff', '#00d2ff', '#4db8e8']);

    function add(p) {
        if (thinning > 0 && Math.random() < thinning) return;
        if (particles.length >= MAX_PARTICLES) {
            // 替换最老的粒子，避免爆炸时新粒子被丢弃
            particles[(Math.random() * particles.length) | 0] = p;
            return;
        }
        particles.push(p);
    }

    function spawn(x, y, count, color, speed, life, size) {
        for (let i = 0; i < count; i++) {
            const angle = Utils.rand(0, Math.PI * 2);
            const spd = Utils.rand(speed * 0.3, speed);
            const p = new Particle(
                x, y,
                Math.cos(angle) * spd,
                Math.sin(angle) * spd - Utils.rand(50, 150),
                color, Utils.rand(life * 0.5, life), size || Utils.rand(2, 4)
            );
            p.glow = GLOW_COLORS.has(color);
            add(p);
        }
    }

    // 有方向的喷射（用于命中、击杀）
    function spray(x, y, count, color, angle, spread, speedMin, speedMax, life, size, type) {
        for (let i = 0; i < count; i++) {
            const a = angle + (Math.random() - 0.5) * spread;
            const spd = Utils.rand(speedMin, speedMax);
            const p = new Particle(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, Utils.rand(life * 0.5, life), size || Utils.rand(1.5, 3.5));
            p.type = type || 'spark';
            p.glow = true;
            p.drag = 0.04;
            add(p);
        }
    }

    function spawnBlood(x, y, count) {
        const colors = ['#e74c3c', '#c0392b', '#d85050', '#aa0000'];
        for (let i = 0; i < count; i++) {
            const angle = Utils.rand(0, Math.PI * 2);
            const spd = Utils.rand(80, 250);
            const p = new Particle(
                x, y,
                Math.cos(angle) * spd,
                Math.sin(angle) * spd - Utils.rand(100, 200),
                colors[Utils.randInt(0, colors.length - 1)],
                Utils.rand(0.3, 0.8), Utils.rand(2, 5)
            );
            p.type = Math.random() > 0.5 ? 'circle' : 'square';
            add(p);
        }
    }

    function spawnSparks(x, y, count) {
        const colors = ['#f1c40f', '#ff9500', '#fff', '#ffcc00'];
        for (let i = 0; i < count; i++) {
            const angle = Utils.rand(0, Math.PI * 2);
            const spd = Utils.rand(120, 380);
            const p = new Particle(
                x, y,
                Math.cos(angle) * spd,
                Math.sin(angle) * spd,
                colors[Utils.randInt(0, colors.length - 1)],
                Utils.rand(0.2, 0.5), Utils.rand(1.2, 2.6)
            );
            p.type = 'spark';
            p.glow = true;
            p.drag = 0.03;
            add(p);
        }
    }

    function spawnExplosion(x, y, scale = 1) {
        // 火球核心
        for (let i = 0; i < 26 * scale; i++) {
            const a = Utils.rand(0, Math.PI * 2);
            const spd = Utils.rand(40, 260) * scale;
            const p = new Particle(x, y, Math.cos(a) * spd, Math.sin(a) * spd - 60,
                ['#ff6600', '#ffcc00', '#ff4400', '#fff'][i % 4], Utils.rand(0.25, 0.6), Utils.rand(4, 9) * scale);
            p.glow = true;
            p.drag = 0.08;
            p.gravity = -60;
            add(p);
        }
        // 浓烟
        for (let i = 0; i < 10 * scale; i++) {
            const a = Utils.rand(0, Math.PI * 2);
            const spd = Utils.rand(30, 140) * scale;
            const p = new Particle(x, y, Math.cos(a) * spd, Math.sin(a) * spd - 40, '#2a2630', Utils.rand(0.8, 1.4), Utils.rand(8, 16) * scale);
            p.type = 'smoke';
            p.drag = 0.06;
            p.gravity = -90;
            add(p);
        }
        // 火花流星
        for (let i = 0; i < 26 * scale; i++) {
            const a = Utils.rand(0, Math.PI * 2);
            const spd = Utils.rand(260, 620) * scale;
            const p = new Particle(x, y, Math.cos(a) * spd, Math.sin(a) * spd - 80,
                ['#ffcc00', '#ff9500', '#fff'][i % 3], Utils.rand(0.3, 0.7), Utils.rand(1.4, 2.6));
            p.type = 'spark';
            p.glow = true;
            p.drag = 0.025;
            p.gravity = 700;
            add(p);
        }
        // 碎片
        for (let i = 0; i < 8; i++) {
            const angle = Utils.rand(0, Math.PI * 2);
            const spd = Utils.rand(150, 350);
            const p = new Particle(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd - 120, '#3a2a22', Utils.rand(0.6, 1.0), Utils.rand(3, 6));
            p.type = 'square';
            p.gravity = 900;
            add(p);
        }
        if (typeof FX !== 'undefined') {
            FX.shockwave(x, y, 120 * scale, '255,190,110', 8, 0.32);
            FX.light(x, y, 260 * scale, '255,150,50', 0.3, 0.75);
        }
    }

    function spawnDust(x, y) {
        for (let i = 0; i < 4; i++) {
            const p = new Particle(
                x + Utils.rand(-8, 8), y,
                Utils.rand(-25, 25),
                -Utils.rand(15, 45),
                '#bcaa8a', Utils.rand(0.2, 0.4), Utils.rand(2, 4)
            );
            p.type = 'smoke';
            p.gravity = 0;
            add(p);
        }
    }

    function spawnHitImpact(x, y, angle) {
        // 命中时火花沿子弹方向反向扇形喷溅（更有“打进去”的感觉）
        const baseAngle = angle !== undefined ? angle : -Math.PI / 2;
        spray(x, y, 10, '#ffffff', baseAngle, Math.PI * 0.7, 160, 420, 0.18, 1.6);
        spray(x, y, 5, '#ffcc00', baseAngle + Math.PI, Math.PI * 0.9, 80, 240, 0.22, 1.8);
    }

    function spawnDamageNum(x, y, amount, opts = {}) {
        const rounded = Math.round(amount);
        if (rounded <= 0) return;
        let color = amount > 30 ? '#ff4040' : amount > 15 ? '#ff7a3a' : amount > 8 ? '#ffb03a' : '#ffe08a';
        let scale = amount > 30 ? 1.5 : amount > 15 ? 1.25 : 1;
        let text = rounded.toString();
        let size = 17;
        if (opts.crit || opts.headshot || opts.weak) {
            color = opts.headshot ? '#ff3b5c' : opts.weak && !opts.crit ? '#7ce7ff' : '#ffe14a';
            scale = 1.7;
            size = 20;
            text = (opts.headshot ? '爆头 ' : opts.crit ? '暴击 ' : '弱点 ') + rounded;
        }
        const big = opts.crit || opts.headshot || opts.weak;
        const ft = new FloatingText(x + Utils.rand(-6, 6), y - Utils.rand(10, 26), text, color, {
            scale, size, crit: big, life: big ? 1.0 : 0.7,
        });
        floatingTexts.push(ft);
        if (floatingTexts.length > 60) floatingTexts.shift();
    }

    function spawnCritNum(x, y, amount) {
        spawnDamageNum(x, y, amount, { crit: true });
    }

    function spawnAmmoText(x, y, text, color) {
        floatingTexts.push(new FloatingText(x, y - 30, text, color || '#3498db'));
    }

    function spawnScoreText(x, y, text, color, scale) {
        floatingTexts.push(new FloatingText(x, y - 30, text, color || '#f1c40f', { scale: scale || 1, life: 1.0, vy: -70 }));
    }

    function update(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update(dt);
            if (particles[i].dead) {
                const last = particles.pop();
                if (i < particles.length) particles[i] = last;
            }
        }
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            floatingTexts[i].update(dt);
            if (floatingTexts[i].dead) {
                const last = floatingTexts.pop();
                if (i < floatingTexts.length) floatingTexts[i] = last;
            }
        }
    }

    function draw(ctx) {
        const cx = Utils.camera.x, cy = Utils.camera.y;
        ctx.save();
        ctx.lineCap = 'round';
        // 普通粒子
        for (const p of particles) if (!p.glow) p.draw(ctx, cx, cy);
        // 发光粒子（加法混合）
        ctx.globalCompositeOperation = 'lighter';
        for (const p of particles) if (p.glow) p.draw(ctx, cx, cy);
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawTexts(ctx) {
        const cx = Utils.camera.x, cy = Utils.camera.y;
        for (const t of floatingTexts) t.draw(ctx, cx, cy);
    }

    function clear() { particles = []; floatingTexts = []; }

    return { spawn, spray, spawnBlood, spawnSparks, spawnExplosion, spawnDust, spawnHitImpact, spawnDamageNum, spawnCritNum, spawnAmmoText, spawnScoreText, update, draw, drawTexts, clear, setQuality };
})();
