// ==================== 武器系统 ====================
const WeaponData = {
    pistol: {
        range: 460,          // 基础射程（像素），每升 1 级 +15%
        name: '手枪',
        color: '#bdc3c7',
        fireRate: 0.3,
        damage: 10,
        bulletSpeed: 800,
        bulletSize: 4,
        spread: 0.03,
        bulletCount: 1,
        infinite: true,
        ammo: Infinity,
        sound: 'fire_pistol',
        bulletColor: '#f1c40f',
        trailColor: '#ff9500',
        explosion: false,
    },
    shotgun: {
        range: 270,          // 基础射程（像素），每升 1 级 +15%
        name: '散弹枪',
        color: '#e67e22',
        fireRate: 0.6,
        damage: 8,
        bulletSpeed: 600,
        bulletSize: 3,
        spread: 0.25,
        bulletCount: 5,
        infinite: false,
        ammo: 30,
        sound: 'fire_shotgun',
        bulletColor: '#ff9500',
        trailColor: '#ff6600',
        explosion: false,
    },
    smg: {
        range: 400,          // 基础射程（像素），每升 1 级 +15%
        name: '冲锋枪',
        color: '#3498db',
        fireRate: 0.08,
        damage: 6,
        bulletSpeed: 900,
        bulletSize: 3,
        spread: 0.08,
        bulletCount: 1,
        infinite: false,
        ammo: 80,
        sound: 'fire_smg',
        bulletColor: '#3498db',
        trailColor: '#2980b9',
        explosion: false,
    },
    laser: {
        range: 680,          // 基础射程（像素），每升 1 级 +15%
        name: '激光枪',
        color: '#9b59b6',
        fireRate: 0.15,
        damage: 15,
        bulletSpeed: 1500,
        bulletSize: 2,
        spread: 0.01,
        bulletCount: 1,
        infinite: false,
        ammo: 50,
        sound: 'fire_laser',
        bulletColor: '#e056fd',
        trailColor: '#be2edd',
        explosion: false,
    },
    rocket: {
        range: 600,          // 基础射程（像素），每升 1 级 +15%
        name: '火箭筒',
        color: '#e74c3c',
        fireRate: 1.0,
        damage: 40,
        bulletSpeed: 500,
        bulletSize: 6,
        spread: 0.02,
        bulletCount: 1,
        infinite: false,
        ammo: 12,
        sound: 'fire_rocket',
        bulletColor: '#e74c3c',
        trailColor: '#ff6600',
        explosion: true,
    },
    grenade: {
        name: '手雷',
        color: '#558833',
        fireRate: 0.6,
        damage: 55,
        bulletSpeed: 0,
        bulletSize: 0,
        spread: 0,
        bulletCount: 0,
        infinite: true,
        ammo: Infinity,
        sound: 'explode',
        bulletColor: '#558833',
        trailColor: '#336622',
        explosion: true,
    },
    molotov: {
        name: '燃烧瓶',
        color: '#ff6600',
        fireRate: 0.6,
        damage: 0,
        bulletSpeed: 0,
        bulletSize: 0,
        spread: 0,
        bulletCount: 0,
        infinite: true,
        ammo: Infinity,
        sound: 'explode',
        bulletColor: '#ff6600',
        trailColor: '#cc4400',
        explosion: false,
    },
    health: {
        name: '血包',
        color: '#e74c3c',
        fireRate: 0,
        damage: 0,
        bulletSpeed: 0,
        bulletSize: 0,
        spread: 0,
        bulletCount: 0,
        infinite: true,
        ammo: Infinity,
        sound: 'pickup',
        bulletColor: '#e74c3c',
        trailColor: '#c0392b',
        explosion: false,
    },
    shield: {
        name: '护盾',
        color: '#00d2ff',
        fireRate: 0,
        damage: 0,
        bulletSpeed: 0,
        bulletSize: 0,
        spread: 0,
        bulletCount: 0,
        infinite: true,
        ammo: Infinity,
        sound: 'pickup',
        bulletColor: '#00d2ff',
        trailColor: '#00a8cc',
        explosion: false,
    },
};

// 各武器手感参数：镜头踢动 / 屏震 / 角色后退 / 枪口火花 / 光照半径 / 弹壳
const WEAPON_FEEL = {
    pistol:  { kick: 0.05, shake: 0,   push: 0,   sparks: 4,  light: 90,  shell: true,  shellColor: '#e8b04a' },
    shotgun: { kick: 0.22, shake: 5,   push: 3,   sparks: 12, light: 160, shell: true,  shellColor: '#d0473a' },
    smg:     { kick: 0.035, shake: 0,  push: 0,   sparks: 3,  light: 70,  shell: true,  shellColor: '#e8b04a' },
    laser:   { kick: 0.04, shake: 0,   push: 0,   sparks: 5,  light: 110, shell: false },
    rocket:  { kick: 0.3,  shake: 6,   push: 5,   sparks: 14, light: 180, shell: false },
};

// 升级倍率
const UPGRADE_MULTIPLIERS = {
    damage: 1.3,
    fireRate: 0.88,
    bulletSpeed: 1.12,
};

class Weapon {
    constructor(type) {
        const data = WeaponData[type];
        this.type = type;
        this.name = data.name;
        this.color = data.color;
        this.fireRate = data.fireRate;
        this.damage = data.damage;
        this.bulletSpeed = data.bulletSpeed;
        this.bulletSize = data.bulletSize;
        this.spread = data.spread;
        this.bulletCount = data.bulletCount;
        this.infinite = data.infinite;
        this.ammo = data.ammo;
        this.maxAmmo = data.ammo;
        this.sound = data.sound;
        this.bulletColor = data.bulletColor;
        this.trailColor = data.trailColor;
        this.explosion = data.explosion;
        this.level = 1;
        this.maxLevel = 5;
        this.cooldown = 0;
        this.baseRange = data.range || 600;
    }

    // 射程随武器等级提升：Lv1 = 基础，之后每级 +15%（Lv5 = 1.6 倍）
    get range() { return Math.round(this.baseRange * (1 + (this.level - 1) * 0.15)); }

    canFire() { return this.cooldown <= 0 && this.ammo > 0; }

    fire() {
        if (!this.canFire()) return null;
        this.cooldown = this.fireRate;
        if (!this.infinite) this.ammo--;
        Audio.play(this.sound);
        const bullets = [];
        for (let i = 0; i < this.bulletCount; i++) {
            const angleOffset = (Math.random() - 0.5) * this.spread * 2;
            bullets.push({
                damage: this.damage,
                speed: this.bulletSpeed * Utils.rand(0.9, 1.1),
                size: this.bulletSize,
                angle: angleOffset,
                color: this.bulletColor,
                trail: this.trailColor,
                explosion: this.explosion,
                wtype: this.type,
                range: this.range,
            });
        }
        return bullets;
    }

    update(dt) {
        if (this.cooldown > 0) this.cooldown -= dt;
    }

    upgrade() {
        if (this.level >= this.maxLevel) return false;
        this.level++;
        this.damage = Math.round(this.damage * UPGRADE_MULTIPLIERS.damage);
        this.fireRate *= UPGRADE_MULTIPLIERS.fireRate;
        this.bulletSpeed = Math.round(this.bulletSpeed * UPGRADE_MULTIPLIERS.bulletSpeed);
        if (!this.infinite) {
            this.maxAmmo = Math.round(this.maxAmmo * 1.2);
            this.ammo = this.maxAmmo;
        }
        Audio.play('upgrade');
        return true;
    }

    getUpgradeCost() {
        return 300 + this.level * 200;
    }
}

class Bullet {
    constructor(x, y, angle, data) {
        this.x = x; this.y = y;
        this.angle = angle + data.angle;
        this.vx = Math.cos(this.angle) * data.speed;
        this.vy = Math.sin(this.angle) * data.speed;
        this.damage = data.damage;
        this.size = data.size;
        this.color = data.color;
        this.trail = data.trail;
        this.explosion = data.explosion;
        this.life = 3;
        this.dead = false;
        this.trailPoints = [];
        this.trailTimer = 0;
        this.pierce = 0;
        this.hitIds = null;
        this.wtype = data.wtype || 'pistol';
        this.range = data.range || 99999;   // 最远飞行距离，超出后消散（火箭在射程尽头爆炸）
        this.traveled = 0;
        this.rangeEnd = false;
    }

    update(dt) {
        this.trailTimer += dt;
        // 每隔一小段时间记录一个拖尾点
        if (this.trailTimer > 0.016) {
            this.trailPoints.push({ x: this.x, y: this.y });
            if (this.trailPoints.length > 7) this.trailPoints.shift();
            this.trailTimer = 0;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.traveled += Math.hypot(this.vx, this.vy) * dt;
        this.life -= dt;
        if (this.traveled >= this.range) {
            this.dead = true;
            this.rangeEnd = true;
            if (!this.explosion) Particles.spawn(this.x, this.y, 2, this.color, 50, 0.18, 1.6);
        }
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
        const cx = Utils.camera.x, cy = Utils.camera.y;
        const sx = this.x - cx;
        const sy = this.y - cy;
        const color = this.overdrive ? '#ffb347' : this.color;
        const trail = this.overdrive ? '#ff6a2a' : this.trail;
        // 接近射程尽头逐渐变淡，让玩家看得出“打不到那么远”
        const fade = this.range < 99999 ? Utils.clamp((this.range - this.traveled) / (this.range * 0.22), 0, 1) : 1;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (fade < 1) ctx.globalAlpha = fade;
        const baseAlpha = fade;
        ctx.lineCap = 'round';
        // 拖尾：一条渐细的光带
        if (this.trailPoints.length > 1) {
            const n = this.trailPoints.length;
            for (let i = 1; i < n; i++) {
                const t = i / n;
                ctx.globalAlpha = t * 0.55 * baseAlpha;
                ctx.strokeStyle = trail;
                ctx.lineWidth = Math.max(1, this.size * 1.4 * t);
                ctx.beginPath();
                ctx.moveTo(this.trailPoints[i - 1].x - cx, this.trailPoints[i - 1].y - cy);
                ctx.lineTo(this.trailPoints[i].x - cx, this.trailPoints[i].y - cy);
                ctx.stroke();
            }
            const last = this.trailPoints[n - 1];
            ctx.globalAlpha = 0.8 * baseAlpha;
            ctx.lineWidth = this.size * 1.3;
            ctx.beginPath();
            ctx.moveTo(last.x - cx, last.y - cy);
            ctx.lineTo(sx, sy);
            ctx.stroke();
        }
        // 弹头：拉长的高亮核心（沿速度方向）
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const ux = this.vx / sp, uy = this.vy / sp;
        const len = this.size * (this.explosion ? 2.5 : 4);
        ctx.globalAlpha = 0.35 * baseAlpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, this.size * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = baseAlpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = this.size * 1.4;
        ctx.beginPath();
        ctx.moveTo(sx - ux * len, sy - uy * len);
        ctx.lineTo(sx + ux * this.size * 0.5, sy + uy * this.size * 0.5);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, this.size * 0.6);
        ctx.beginPath();
        ctx.moveTo(sx - ux * len * 0.6, sy - uy * len * 0.6);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.restore();
    }
}

// 掉落的武器
class WeaponDrop {
    constructor(x, y, type) {
        this.x = x; this.y = y;
        this.type = type;
        this.data = WeaponData[type];
        this.bobOffset = Math.random() * Math.PI * 2;
        this.life = 15; // 15秒后消失
        this.dead = false;
        this.width = 40;
        this.height = 24;
        this.nearPlayer = false;
        this.pickupReady = false;
        this.pickupVector = { x: 0, y: 0 };
    }

    update(dt) {
        this.bobOffset += dt * 3;
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
        const bob = Math.sin(this.bobOffset) * 4;
        const sx = this.x - Utils.camera.x;
        const sy = this.y + bob - Utils.camera.y;
        const focus = this.pickupReady ? 1 : this.nearPlayer ? 0.55 : 0;
        const pulse = Math.sin(this.bobOffset * 2.2) * 0.5 + 0.5;

        // 剩余时间闪烁（即将消失时整体透明度变化）
        if (this.life < 4) {
            ctx.globalAlpha = 0.5 + Math.sin(this.life * 10) * 0.5;
        }

        if (focus > 0) {
            const px = sx + this.pickupVector.x;
            const py = sy + this.pickupVector.y;
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.strokeStyle = this.data.color + Math.floor((0.16 + focus * 0.18) * 255).toString(16).padStart(2, '0');
            ctx.lineWidth = this.pickupReady ? 2 : 1;
            ctx.setLineDash([8, 10]);
            ctx.lineDashOffset = -this.bobOffset * 16;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(px, py - 18);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.beginPath();
            ctx.ellipse(sx, sy + 17, 36 + pulse * 7, 10 + pulse * 2, 0, 0, Math.PI * 2);
            ctx.strokeStyle = this.data.color + Math.floor((0.34 + focus * 0.28) * 255).toString(16).padStart(2, '0');
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = this.data.color + Math.floor((0.08 + focus * 0.12) * 255).toString(16).padStart(2, '0');
            ctx.beginPath();
            ctx.ellipse(sx, sy + 17, 42 + pulse * 8, 12 + pulse * 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        const beamAlpha = 0.18 + Math.sin(this.bobOffset * 1.7) * 0.05;
        const beam = ctx.createLinearGradient(sx, sy - 34, sx, sy + 18);
        beam.addColorStop(0, 'transparent');
        beam.addColorStop(0.45, this.data.color + Math.floor(beamAlpha * 255).toString(16).padStart(2, '0'));
        beam.addColorStop(1, 'transparent');
        ctx.fillStyle = beam;
        ctx.fillRect(sx - 1.5, sy - 34, 3, 52);

        // 发光底座
        ctx.beginPath();
        ctx.ellipse(sx, sy + 17, 27, 7, 0, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(sx, sy + 17, 0, sx, sy + 17, 27);
        g.addColorStop(0, this.data.color + '66');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fill();

        ctx.save();
        ctx.translate(sx, sy);
        ctx.shadowColor = this.data.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(5, 10, 18, 0.88)';
        this.roundRect(ctx, -24, -18, 48, 32, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = this.data.color;
        ctx.lineWidth = focus > 0 ? 2.2 : 1.5;
        this.roundRect(ctx, -24, -18, 48, 32, 8);
        ctx.stroke();
        if (focus > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.58)';
            ctx.lineWidth = 1;
            this.roundRect(ctx, -19, -13, 38, 22, 6);
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(-18, -15, 36, 2);
        ctx.restore();

        // 武器图标
        ctx.save();
        ctx.translate(sx, sy);
        this.drawWeaponIcon(ctx);
        ctx.restore();

        // 名称标签
        const labelW = Math.max(42, this.data.name.length * 12);
        ctx.fillStyle = 'rgba(3, 7, 14, 0.76)';
        this.roundRect(ctx, sx - labelW / 2, sy + 20, labelW, 17, 8);
        ctx.fill();
        ctx.strokeStyle = this.data.color + '88';
        ctx.lineWidth = 1;
        this.roundRect(ctx, sx - labelW / 2, sy + 20, labelW, 17, 8);
        ctx.stroke();
        ctx.fillStyle = this.data.color;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.data.name, sx, sy + 32);

        if (this.pickupReady) {
            ctx.save();
            ctx.translate(sx, sy - 34);
            ctx.fillStyle = 'rgba(3, 7, 14, 0.86)';
            this.roundRect(ctx, -17, -11, 34, 22, 7);
            ctx.fill();
            ctx.strokeStyle = this.data.color;
            ctx.lineWidth = 1.5;
            this.roundRect(ctx, -17, -11, 34, 22, 7);
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('E', 0, 1);
            ctx.restore();
        }

        ctx.globalAlpha = 1;
    }

    drawWeaponIcon(ctx) {
        ctx.fillStyle = this.data.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;

        switch (this.type) {
            case 'pistol':
                ctx.fillRect(-10, -4, 20, 8);
                ctx.strokeRect(-10, -4, 20, 8);
                ctx.fillRect(6, -8, 4, 4);
                break;
            case 'shotgun':
                ctx.fillRect(-16, -3, 32, 6);
                ctx.strokeRect(-16, -3, 32, 6);
                ctx.fillRect(-16, 3, 10, 4);
                break;
            case 'smg':
                ctx.fillRect(-12, -3, 24, 6);
                ctx.strokeRect(-12, -3, 24, 6);
                ctx.fillRect(-4, 3, 3, 8);
                break;
            case 'laser':
                ctx.fillRect(-14, -2, 28, 4);
                ctx.strokeRect(-14, -2, 28, 4);
                ctx.fillStyle = '#e056fd';
                ctx.fillRect(12, -1, 6, 2);
                break;
            case 'rocket':
                ctx.fillRect(-14, -5, 28, 10);
                ctx.strokeRect(-14, -5, 28, 10);
                ctx.fillRect(10, -7, 6, 14);
                break;
            case 'grenade':
                ctx.fillStyle = '#558833';
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#336622';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.strokeStyle = '#888';
                ctx.beginPath();
                ctx.moveTo(0, -10);
                ctx.lineTo(4, -16);
                ctx.stroke();
                break;
            case 'molotov':
                // 玻璃瓶身
                ctx.fillStyle = 'rgba(200, 220, 255, 0.35)';
                ctx.beginPath();
                ctx.moveTo(-4, -2);
                ctx.lineTo(4, -2);
                ctx.lineTo(5, 10);
                ctx.lineTo(-5, 10);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#aabbcc';
                ctx.lineWidth = 1;
                ctx.stroke();
                // 瓶内液体
                ctx.fillStyle = 'rgba(255, 100, 0, 0.75)';
                ctx.beginPath();
                ctx.moveTo(-4.5, 2);
                ctx.lineTo(4.5, 2);
                ctx.lineTo(5, 10);
                ctx.lineTo(-5, 10);
                ctx.closePath();
                ctx.fill();
                // 瓶口细颈
                ctx.strokeStyle = '#aabbcc';
                ctx.beginPath();
                ctx.moveTo(-3, -2);
                ctx.lineTo(-3, 2);
                ctx.moveTo(3, -2);
                ctx.lineTo(3, 2);
                ctx.stroke();
                // 瓶口布条
                ctx.fillStyle = '#cc8855';
                ctx.fillRect(-3, -6, 6, 4);
                ctx.strokeStyle = '#aa6633';
                ctx.strokeRect(-3, -6, 6, 4);
                // 火焰
                const mf = Math.sin(this.bobOffset * 3) * 2;
                ctx.fillStyle = '#ff4400';
                ctx.beginPath();
                ctx.moveTo(-3, -6);
                ctx.quadraticCurveTo(-4 + mf, -15, 0, -17);
                ctx.quadraticCurveTo(4 + mf, -15, 3, -6);
                ctx.fill();
                ctx.fillStyle = '#ff8800';
                ctx.beginPath();
                ctx.moveTo(-2.5, -6);
                ctx.quadraticCurveTo(-3 + mf * 0.5, -12, 0, -14);
                ctx.quadraticCurveTo(3 + mf * 0.5, -12, 2.5, -6);
                ctx.fill();
                ctx.fillStyle = '#ffcc00';
                ctx.beginPath();
                ctx.moveTo(-1.5, -6);
                ctx.quadraticCurveTo(-1.5 + mf * 0.3, -10, 0, -11);
                ctx.quadraticCurveTo(1.5 + mf * 0.3, -10, 1.5, -6);
                ctx.fill();
                break;
            case 'health':
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(-10, -3, 20, 6);
                ctx.fillRect(-3, -10, 6, 20);
                ctx.strokeStyle = '#c0392b';
                ctx.lineWidth = 1;
                ctx.strokeRect(-10, -3, 20, 6);
                ctx.strokeRect(-3, -10, 6, 20);
                break;
            case 'shield':
                ctx.strokeStyle = '#00d2ff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, -2, 12, Math.PI, 0);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-12, -2);
                ctx.lineTo(-12, 6);
                ctx.lineTo(0, 14);
                ctx.lineTo(12, 6);
                ctx.lineTo(12, -2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(0, 210, 255, 0.25)';
                ctx.fill();
                ctx.fillStyle = '#00d2ff';
                ctx.beginPath();
                ctx.arc(0, 4, 3, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    getRect() {
        return { x: this.x - 24, y: this.y - 16, w: 48, h: 40 };
    }
}
