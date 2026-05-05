// ==================== 武器系统 ====================
const WeaponData = {
    pistol: {
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
        sound: 'shoot',
        bulletColor: '#f1c40f',
        trailColor: '#ff9500',
        explosion: false,
    },
    shotgun: {
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
        sound: 'shotgun',
        bulletColor: '#ff9500',
        trailColor: '#ff6600',
        explosion: false,
    },
    smg: {
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
        sound: 'shoot',
        bulletColor: '#3498db',
        trailColor: '#2980b9',
        explosion: false,
    },
    laser: {
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
        sound: 'laser',
        bulletColor: '#e056fd',
        trailColor: '#be2edd',
        explosion: false,
    },
    rocket: {
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
        sound: 'rocket',
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
    }

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
    }

    update(dt) {
        this.trailTimer += dt;
        // 每隔一小段时间记录一个拖尾点
        if (this.trailTimer > 0.02) {
            this.trailPoints.push({ x: this.x, y: this.y });
            if (this.trailPoints.length > 12) this.trailPoints.shift();
            this.trailTimer = 0;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
        const sx = this.x - Utils.camera.x;
        const sy = this.y - Utils.camera.y;

        // 拖尾（增强版：渐变+发光）
        if (this.trailPoints.length > 1) {
            for (let i = 1; i < this.trailPoints.length; i++) {
                const alpha = (i / this.trailPoints.length) * 0.5;
                const width = (i / this.trailPoints.length) * this.size * 1.2;
                ctx.beginPath();
                ctx.moveTo(this.trailPoints[i - 1].x - Utils.camera.x, this.trailPoints[i - 1].y - Utils.camera.y);
                ctx.lineTo(this.trailPoints[i].x - Utils.camera.x, this.trailPoints[i].y - Utils.camera.y);
                ctx.strokeStyle = this.trail;
                ctx.lineWidth = width;
                ctx.globalAlpha = alpha;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        // 子弹本体（增强发光）
        // 外圈光晕
        ctx.beginPath();
        ctx.arc(sx, sy, this.size * 3, 0, Math.PI * 2);
        const gOuter = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.size * 3);
        gOuter.addColorStop(0, this.color + '40');
        gOuter.addColorStop(1, 'transparent');
        ctx.fillStyle = gOuter;
        ctx.fill();

        // 核心
        ctx.beginPath();
        ctx.arc(sx, sy, this.size, 0, Math.PI * 2);
        const gCore = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.size);
        gCore.addColorStop(0, '#fff');
        gCore.addColorStop(0.4, this.color);
        gCore.addColorStop(1, this.color + '80');
        ctx.fillStyle = gCore;
        ctx.fill();

        // 高光点
        ctx.beginPath();
        ctx.arc(sx - this.size * 0.3, sy - this.size * 0.3, this.size * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
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

        // 发光底座
        ctx.beginPath();
        ctx.ellipse(sx, sy + 12, 22, 6, 0, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(sx, sy + 12, 0, sx, sy + 12, 22);
        g.addColorStop(0, this.data.color + '50');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fill();

        // 武器图标
        ctx.save();
        ctx.translate(sx, sy);
        this.drawWeaponIcon(ctx);
        ctx.restore();

        // 名称标签
        ctx.fillStyle = this.data.color;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.data.name, sx, sy + 26);

        // 剩余时间闪烁
        if (this.life < 4) {
            ctx.globalAlpha = 0.5 + Math.sin(this.life * 10) * 0.5;
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

    getRect() {
        return { x: this.x - 24, y: this.y - 16, w: 48, h: 40 };
    }
}
