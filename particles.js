// ==================== 粒子系统 ====================
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
        this.type = 'circle'; // circle, square, spark
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += 400 * dt;
        this.life -= dt;
        this.rotation += this.rotationSpeed * dt;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
        const alpha = Utils.clamp(this.life / this.maxLife, 0, 1);
        const size = this.size * (0.5 + alpha * 0.5);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;

        ctx.save();
        ctx.translate(this.x - Utils.camera.x, this.y - Utils.camera.y);
        ctx.rotate(this.rotation);

        if (this.type === 'spark') {
            // 火花：细长形状
            ctx.beginPath();
            ctx.ellipse(0, 0, size * 2, size * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'square') {
            // 方块碎片
            ctx.fillRect(-size / 2, -size / 2, size, size);
        } else {
            // 圆形粒子
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        ctx.globalAlpha = 1;
    }
}

// 浮动伤害数字
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x; this.y = y;
        this.text = text;
        this.color = color || '#fff';
        this.life = 0.8;
        this.maxLife = 0.8;
        this.vy = -80;
        this.vx = Utils.rand(-20, 20);
        this.dead = false;
        this.scale = 0;
        this.targetScale = 1;
    }

    update(dt) {
        this.y += this.vy * dt;
        this.x += this.vx * dt;
        this.vy *= 0.98;
        this.life -= dt;
        // 缩放动画
        this.scale += (this.targetScale - this.scale) * 0.2;
        if (this.life < 0.2) {
            this.targetScale = 0;
        }
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
        const alpha = Utils.clamp(this.life / this.maxLife, 0, 1);
        const sx = this.x - Utils.camera.x;
        const sy = this.y - Utils.camera.y;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(sx, sy);
        ctx.scale(this.scale, this.scale);
        ctx.font = `bold 16px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 描边
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(this.text, 0, 0);
        // 填充
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, 0, 0);
        ctx.restore();
    }
}

const Particles = (() => {
    let particles = [];
    let floatingTexts = [];

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
            particles.push(p);
        }
    }

    function spawnBlood(x, y, count) {
        const colors = ['#e74c3c', '#c0392b', '#ff4444', '#aa0000'];
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
            p.type = Utils.rand(0, 1) > 0.5 ? 'circle' : 'square';
            particles.push(p);
        }
    }

    function spawnSparks(x, y, count) {
        const colors = ['#f1c40f', '#ff9500', '#fff', '#ffcc00'];
        for (let i = 0; i < count; i++) {
            const angle = Utils.rand(0, Math.PI * 2);
            const spd = Utils.rand(100, 300);
            const p = new Particle(
                x, y,
                Math.cos(angle) * spd,
                Math.sin(angle) * spd,
                colors[Utils.randInt(0, colors.length - 1)],
                Utils.rand(0.2, 0.5), Utils.rand(1, 3)
            );
            p.type = 'spark';
            particles.push(p);
        }
    }

    function spawnExplosion(x, y) {
        // 核心爆炸
        spawn(x, y, 30, '#ff6600', 380, 0.7, 6);
        spawn(x, y, 20, '#ffcc00', 280, 0.5, 4);
        spawn(x, y, 15, '#fff', 200, 0.3, 3);
        spawnSparks(x, y, 25);
        // 爆炸碎片
        for (let i = 0; i < 8; i++) {
            const angle = Utils.rand(0, Math.PI * 2);
            const spd = Utils.rand(150, 350);
            const p = new Particle(
                x, y,
                Math.cos(angle) * spd,
                Math.sin(angle) * spd - 100,
                '#ff4400',
                Utils.rand(0.4, 0.8), Utils.rand(3, 6)
            );
            p.type = 'square';
            particles.push(p);
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
            p.type = 'circle';
            particles.push(p);
        }
    }

    function spawnHitImpact(x, y) {
        // 冲击波环
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const spd = Utils.rand(100, 200);
            const p = new Particle(
                x, y,
                Math.cos(angle) * spd,
                Math.sin(angle) * spd,
                '#ffffff', Utils.rand(0.1, 0.25), Utils.rand(1, 2.5)
            );
            p.type = 'spark';
            particles.push(p);
        }
        spawnSparks(x, y, 6);
    }

    function spawnDamageNum(x, y, amount) {
        const colors = ['#ff4444', '#ff6600', '#f1c40f', '#ff0000'];
        const color = amount > 25 ? colors[3] : amount > 15 ? colors[0] : amount > 8 ? colors[1] : colors[2];
        floatingTexts.push(new FloatingText(x, y - Utils.rand(10, 25), Math.round(amount).toString(), color));
    }

    function spawnCritNum(x, y, amount) {
        const text = `暴击 ${Math.round(amount)}!`;
        const ft = new FloatingText(x, y - 25, text, '#f1c40f');
        ft.targetScale = 1.3;
        floatingTexts.push(ft);
    }

    function spawnAmmoText(x, y, text, color) {
        floatingTexts.push(new FloatingText(x, y - 30, text, color || '#3498db'));
    }

    function spawnScoreText(x, y, text) {
        floatingTexts.push(new FloatingText(x, y - 30, text, '#f1c40f'));
    }

    function update(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update(dt);
            if (particles[i].dead) particles.splice(i, 1);
        }
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            floatingTexts[i].update(dt);
            if (floatingTexts[i].dead) floatingTexts.splice(i, 1);
        }
    }

    function draw(ctx) {
        particles.forEach(p => p.draw(ctx));
        floatingTexts.forEach(t => t.draw(ctx));
    }

    function clear() { particles = []; floatingTexts = []; }

    return { spawn, spawnBlood, spawnSparks, spawnExplosion, spawnDust, spawnHitImpact, spawnDamageNum, spawnCritNum, spawnAmmoText, spawnScoreText, update, draw, clear };
})();
