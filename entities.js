// ==================== 实体系统 ====================

// ---- 火柴人主角 ----
class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.w = 28; this.h = 52;
        this.vx = 0; this.vy = 0;
        this.speed = 300;
        this.jumpForce = -560;
        this.gravity = 1100;
        this.onGround = false;
        this.canDoubleJump = true;  // 二段跳
        this.jumpCount = 0;
        this.maxJumps = 2;
        this.coyoteTime = 0;       // 土狼时间（离开平台后仍可跳跃）
        this.jumpBufferTime = 0;   // 跳跃缓冲（提前按跳）
        this.jumpConsumed = false; // 本帧是否已消费跳跃输入
        this.facing = 1; // 1右 -1左
        this.health = 100;
        this.maxHealth = 100;
        this.dead = false;
        this.invincibleTimer = 0;
        this.score = 0;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.dashSpeed = 1800;
        this.dashDuration = 0.12;
        this.trailPositions = [];  // 移动拖尾

        // 武器
        this.weapons = [new Weapon('pistol'), null, null, null, null];
        this.currentWeapon = 0;
        this.bullets = [];

        // 武器槽位映射：每种武器类型的固定槽位索引
        this.weaponSlotMap = {
            pistol: 0,
            shotgun: 1,
            smg: 2,
            laser: 3,
            rocket: 4,
        };

        // 投掷武器
        this.grenadeCount = 3;
        this.molotovCount = 3;
        this.thrown = [];
        this.thrownCooldown = 0;
        this.selectedThrown = 'grenade';
        this.aiming = false;       // 是否正在瞄准投掷
        this.aimTarget = { x: 0, y: 0 }; // 瞄准目标点

        // 动画
        this.animTime = 0;
        this.legPhase = 0;
        this.armAngle = 0;
        this.shootFlash = 0;
        this.deathTimer = 0;

        this.gunTipOffset = { x: 18, y: -12 };

        // 停滞检测（防止玩家站在原地不动）
        this.stagnationTimer = 0;      // 停滞计时器
        this.stagnationDamage = 2;     // 每秒扣血量（降低）
        this.stagnationWarning = 0;    // 警告闪烁效果

        // 护盾
        this.shieldTimer = 0;
        this.shieldActive = false;
        this.shieldStorage = 0;
    }

    get weapon() { return this.weapons[this.currentWeapon]; }

    getRect() {
        return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
    }

    update(dt, platforms) {
        if (this.dead) {
            this.deathTimer += dt;
            return;
        }

        // 输入
        let moveX = 0;
        if (Input.isDown('KeyA') || Input.isDown('ArrowLeft')) moveX = -1;
        if (Input.isDown('KeyD') || Input.isDown('ArrowRight')) moveX = 1;

        this.vx = moveX * this.speed;
        if (moveX !== 0) this.facing = moveX;

        // 冲刺
        this.dashCooldown = Math.max(0, this.dashCooldown - dt);
        if (this.dashTimer > 0) {
            this.dashTimer -= dt;
            this.invincibleTimer = 0.08;
        } else if (Input.wasPressed('KeyC') && this.dashCooldown <= 0) {
            this.dashTimer = this.dashDuration;
            this.dashCooldown = 1.2;
            const dashDir = moveX !== 0 ? moveX : this.facing;
            this.vx = dashDir * this.dashSpeed;
            this.vy = 0;
            Audio.play('dash');
            Particles.spawn(this.x, this.y - this.h / 2, 8, '#ffffff', 50, 0.25);
        }

        // Shift 键释放护盾
        if ((Input.wasPressed('ShiftLeft') || Input.wasPressed('ShiftRight')) && !this.shieldActive && this.shieldStorage > 0) {
            this.shieldStorage--;
            this.shieldTimer = 8;
            this.shieldActive = true;
            Particles.spawn(this.x, this.y - 25, 12, '#00d2ff', 150, 0.5);
            Audio.play('pickup');
        }

        // 土狼时间
        if (this.onGround) {
            this.coyoteTime = 0.1;
            this.jumpCount = 0;
        } else {
            this.coyoteTime = Math.max(0, this.coyoteTime - dt);
        }

        // 跳跃输入（仅本帧按下才设为true）
        this.jumpConsumed = false;
        const jumpPressed = Input.wasPressed('KeyW') || Input.wasPressed('Space') || Input.wasPressed('ArrowUp');
        if (jumpPressed) {
            this.jumpBufferTime = 0.08;
        }

        // ---- 物理 ----
        if (this.dashTimer > 0) {
            // 冲刺中：忽略重力和移动输入，维持冲刺速度
            this.vy = 0;
        } else {
            this.vy += this.gravity * dt;
            if (!this.onGround && moveX !== 0) {
                this.vx = moveX * this.speed * 0.85;
            }
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // ---- 平台碰撞 ----
        this.onGround = false;
        const feetY = this.y;                    // 脚底 y
        const halfW = this.w / 2;
        const prevFeetY = feetY - this.vy * dt;  // 上一帧脚底 y

        for (const p of platforms) {
            // 水平范围有交集才算
            if (this.x + halfW > p.x && this.x - halfW < p.x + p.w) {
                // 情况 A：正在下落或水平穿过，且上一帧脚底在平台顶面之上
                if (this.vy >= 0 && prevFeetY <= p.y + 6 && feetY >= p.y - 2) {
                    this.y = p.y;
                    this.vy = 0;
                    this.onGround = true;
                    this.x += p._dx || 0;
                    break;
                }
                // 情况 B：脚底紧贴平台顶面（容差 4px），视为站立
                if (this.vy >= 0 && Math.abs(feetY - p.y) <= 4) {
                    this.y = p.y;
                    this.vy = 0;
                    this.onGround = true;
                    this.x += p._dx || 0;
                    break;
                }
            }
        }

        // ---- 落地检测 ----
        if (this.onGround) {
            if (this.jumpCount > 0) {
                Particles.spawn(this.x, this.y, 5, '#ffffff60', 80, 0.25);
            }
            this.jumpCount = 0;
            // 跑动尘土
            if (Math.abs(this.vx) > 50 && Math.random() < 0.4) {
                Particles.spawnDust(this.x + Utils.rand(-8, 8), this.y);
            }
        }

        // ---- 跳跃执行 ----
        if (!this.jumpConsumed && this.jumpBufferTime > 0 && this.onGround) {
            this.vy = this.jumpForce;
            this.onGround = false;
            this.coyoteTime = 0;
            this.jumpCount = 1;
            this.jumpBufferTime = 0;
            this.jumpConsumed = true;
            Audio.play('jump');
            Particles.spawn(this.x, this.y, 6, '#ffffff80', 100, 0.3);
        } else if (!this.jumpConsumed && this.jumpBufferTime > 0 && !this.onGround && this.jumpCount < this.maxJumps) {
            this.vy = this.jumpForce * 0.85;
            this.jumpCount++;
            this.jumpBufferTime = 0;
            this.jumpConsumed = true;
            Audio.play('doubleJump');
            Particles.spawn(this.x, this.y, 10, '#3498db', 150, 0.4);
        }

        // 递减跳跃缓冲
        if (!jumpPressed) {
            this.jumpBufferTime = Math.max(0, this.jumpBufferTime - dt);
        }

        // 停滞检测（防止玩家站在原地不动）
        // 检测是否有任何行动：移动、跳跃（射击不算）
        const isMoving = Math.abs(this.vx) > 20;
        const isJumping = !this.onGround;
        const hasAction = isMoving || isJumping;

        if (hasAction) {
            // 有任何行动，重置停滞计时
            this.stagnationTimer = 0;
            this.stagnationWarning = Math.max(0, this.stagnationWarning - dt * 4);
        } else {
            // 完全静止，累加停滞计时
            this.stagnationTimer += dt;
            this.stagnationWarning = Math.min(1, this.stagnationWarning + dt * 1.5);
        }

        // 停滞超过 2 秒开始扣血
        if (this.stagnationTimer > 2) {
            const damage = this.stagnationDamage * dt;
            this.health -= damage;
            // 扣血粒子效果（降低频率）
            if (Math.random() < 0.15) {
                Particles.spawn(this.x, this.y - 25, 2, '#ff6b6b', 60, 0.25);
            }
            // 检查死亡
            if (this.health <= 0) {
                this.health = 0;
                this.dead = true;
                Audio.play('death');
                Audio.playMp3('deathVoice');
            }
        }

        // 拖尾记录
        if (Math.abs(this.vx) > 50 || Math.abs(this.vy) > 50) {
            this.trailPositions.push({ x: this.x, y: this.y - this.h / 2, alpha: 0.4 });
            if (this.trailPositions.length > 6) this.trailPositions.shift();
        }
        for (let i = this.trailPositions.length - 1; i >= 0; i--) {
            this.trailPositions[i].alpha -= dt * 3;
            if (this.trailPositions[i].alpha <= 0) this.trailPositions.splice(i, 1);
        }

        // 动画
        this.animTime += dt;
        if (Math.abs(this.vx) > 10 && this.onGround) {
            this.legPhase += dt * 12;
        } else {
            this.legPhase *= 0.9;
        }

        // 瞄准
        const mouse = Input.getMouse();
        const worldMouse = { x: mouse.x + Utils.camera.x, y: mouse.y + Utils.camera.y };
        this.armAngle = Utils.angle(this.x, this.y - 30, worldMouse.x, worldMouse.y);
        if (Math.cos(this.armAngle) < 0) this.facing = -1;
        else this.facing = 1;

        // 射击
        if (this.weapon) {
            this.weapon.update(dt);
            this.shootFlash = Math.max(0, this.shootFlash - dt * 10);

            if (Input.isMouseDown() && this.weapon.canFire()) {
                const result = this.weapon.fire();
                if (result) {
                    this.shootFlash = 1;
                    const tipX = this.x + Math.cos(this.armAngle) * this.gunTipOffset.x;
                    const tipY = this.y - 30 + Math.sin(this.armAngle) * this.gunTipOffset.x;
                    for (const b of result) {
                        this.bullets.push(new Bullet(tipX, tipY, this.armAngle, b));
                    }
                    Particles.spawnSparks(tipX, tipY, 3);
                }
            }
        } else {
            this.shootFlash = Math.max(0, this.shootFlash - dt * 10);
        }

        // 更新子弹
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].update(dt);
            if (this.bullets[i].dead) this.bullets.splice(i, 1);
        }

        // 无敌时间
        if (this.invincibleTimer > 0) this.invincibleTimer -= dt;

        // 护盾计时
        if (this.shieldTimer > 0) {
            this.shieldTimer -= dt;
            this.shieldActive = this.shieldTimer > 0;
        }

        // 切换武器
        if (Input.wasPressed('Digit1') && this.weapons[0]) this.currentWeapon = 0;
        if (Input.wasPressed('Digit2') && this.weapons[1]) this.currentWeapon = 1;
        if (Input.wasPressed('Digit3') && this.weapons[2]) this.currentWeapon = 2;
        if (Input.wasPressed('Digit4') && this.weapons[3]) this.currentWeapon = 3;
        if (Input.wasPressed('Digit5') && this.weapons[4]) this.currentWeapon = 4;

        // 长按数字键丢弃武器（按住0.5秒）
        const dropKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
        for (let i = 0; i < 5; i++) {
            if (Input.isDown(dropKeys[i]) && Input.getHoldTime(dropKeys[i]) > 0.5 && this.weapons[i]) {
                // 丢弃武器，创建掉落物
                const weaponType = this.weapons[i].type;
                if (weaponType !== 'pistol') { // 手枪不能丢弃
                    Particles.spawn(this.x, this.y - 20, 10, this.weapons[i].color, 120, 0.4);
                    Particles.spawnAmmoText(this.x, this.y - 20, `丢弃 ${this.weapons[i].name}`, '#e74c3c');
                    this.weapons[i] = null;
                    // 切换到下一个有武器的槽位
                    if (this.currentWeapon === i) {
                        for (let j = 0; j < 5; j++) {
                            if (this.weapons[j]) {
                                this.currentWeapon = j;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // 鼠标滚轮切枪
        const scrollDelta = Input.getScrollDelta();
        if (scrollDelta !== 0) {
            const direction = scrollDelta > 0 ? 1 : -1;
            let nextSlot = this.currentWeapon;
            for (let i = 0; i < 5; i++) {
                nextSlot = (nextSlot + direction + 5) % 5;
                if (this.weapons[nextSlot]) {
                    this.currentWeapon = nextSlot;
                    break;
                }
            }
        }

        // 投掷武器冷却
        this.thrownCooldown = Math.max(0, this.thrownCooldown - dt);

        // F键切换手雷/燃烧瓶
        if (Input.wasPressed('KeyF')) {
            this.selectedThrown = this.selectedThrown === 'grenade' ? 'molotov' : 'grenade';
        }

        // Q键瞄准投掷（按住显示抛物线，松开投掷）
        if (Input.isDown('KeyQ') && this.thrownCooldown <= 0) {
            if ((this.selectedThrown === 'grenade' && this.grenadeCount > 0) ||
                (this.selectedThrown === 'molotov' && this.molotovCount > 0)) {
                this.aiming = true;
                // 瞄准目标跟随鼠标（转换为世界坐标）
                const mouse = Input.getMouse();
                this.aimTarget.x = mouse.x + Utils.camera.x;
                this.aimTarget.y = mouse.y + Utils.camera.y;
            }
        } else if (this.aiming && !Input.isDown('KeyQ')) {
            // 松开Q时投掷
            this.aiming = false;
            if (this.selectedThrown === 'grenade' && this.grenadeCount > 0) {
                this.thrown.push(new ThrownProjectile('grenade', this.x, this.y - 30, this.aimTarget.x, this.aimTarget.y));
                this.grenadeCount--;
                this.thrownCooldown = 0.6;
            } else if (this.selectedThrown === 'molotov' && this.molotovCount > 0) {
                this.thrown.push(new ThrownProjectile('molotov', this.x, this.y - 30, this.aimTarget.x, this.aimTarget.y));
                this.molotovCount--;
                this.thrownCooldown = 0.6;
            }
        }

        // 更新投掷物
        for (let i = this.thrown.length - 1; i >= 0; i--) {
            this.thrown[i].update(dt, platforms);
            if (this.thrown[i].dead) this.thrown.splice(i, 1);
        }

        // 掉落悬崖（立即死亡，绕过无敌帧）
        if (this.y > 700) this.die();
    }

    die() {
        if (this.dead) return;
        this.health = 0;
        this.dead = true;
        Audio.play('death');
        Audio.playMp3('deathVoice');
    }

    increaseMaxHealth(amount) {
        this.maxHealth += amount;
        this.health = Math.min(this.health + amount, this.maxHealth);
    }

    takeDamage(amount) {
        if (this.invincibleTimer > 0 || this.dead) return;
        if (this.shieldActive) {
            Particles.spawn(this.x, this.y - 25, 6, '#00d2ff', 80, 0.3);
            Audio.play('playerHit');
            return;
        }
        this.health -= amount;
        this.invincibleTimer = 0.5;
        Particles.spawnBlood(this.x, this.y - 25, 8);
        Audio.play('playerHit');
        if (this.health <= 0) {
            this.health = 0;
            this.dead = true;
            Audio.play('death');
            Audio.playMp3('deathVoice');
        }
    }

    addScore(pts) {
        this.score += pts;
    }

    tryPickup(drops) {
        for (let i = drops.length - 1; i >= 0; i--) {
            const d = drops[i];
            if (Utils.dist(this.x, this.y, d.x, d.y) < 65) {
                if (d.type === 'health') {
                    const heal = 25;
                    this.health = Math.min(this.maxHealth, this.health + heal);
                    Particles.spawn(d.x, d.y, 10, '#2ecc71', 120, 0.4);
                    Audio.play('pickup');
                } else if (d.type === 'grenade') {
                    this.grenadeCount = Math.min(10, this.grenadeCount + 2);
                    Particles.spawn(d.x, d.y, 10, d.data.color, 150, 0.5);
                    Audio.play('pickup');
                } else if (d.type === 'molotov') {
                    this.molotovCount = Math.min(10, this.molotovCount + 2);
                    Particles.spawn(d.x, d.y, 10, d.data.color, 150, 0.5);
                    Audio.play('pickup');
                } else if (d.type === 'shield') {
                    this.shieldStorage++;
                    Particles.spawn(d.x, d.y, 12, '#00d2ff', 150, 0.5);
                    Particles.spawnAmmoText(d.x, d.y - 10, `护盾储存 x${this.shieldStorage}`, '#00d2ff');
                    Audio.play('pickup');
                } else {
                    // 固定槽位系统：检查是否已拥有该类型武器
                    const existingWeapon = this.weapons.find(w => w && w.type === d.type);
                    if (existingWeapon) {
                        // 已拥有该武器，补充弹药
                        if (!existingWeapon.infinite) {
                            const ammoBonus = Math.ceil(existingWeapon.maxAmmo * 0.3);
                            existingWeapon.ammo = Math.min(existingWeapon.maxAmmo, existingWeapon.ammo + ammoBonus);
                            Particles.spawn(d.x, d.y, 8, d.data.color, 120, 0.4);
                            Particles.spawnAmmoText(d.x, d.y, `+${ammoBonus}弹药`, '#3498db');
                        } else {
                            // 无限弹药武器，提供少量分数补偿
                            this.score += 50;
                            Particles.spawn(d.x, d.y, 6, '#f1c40f', 80, 0.3);
                            Particles.spawnScoreText(d.x, d.y, '+50分');
                        }
                    } else {
                        // 未拥有该武器，放入固定槽位
                        const slotIndex = this.weaponSlotMap[d.type];
                        if (slotIndex !== undefined) {
                            this.weapons[slotIndex] = new Weapon(d.type);
                            this.currentWeapon = slotIndex;
                        } else {
                            // 未知武器类型，使用第一个空槽位或替换当前武器
                            if (this.weapons.length < 5) {
                                this.weapons.push(new Weapon(d.type));
                                this.currentWeapon = this.weapons.length - 1;
                            } else {
                                this.weapons[this.currentWeapon] = new Weapon(d.type);
                            }
                        }
                        Particles.spawn(d.x, d.y, 12, d.data.color, 150, 0.5);
                    }
                    Audio.play('pickup');
                }
                drops.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    upgradeWeapon() {
        if (!this.weapon) return false;
        const cost = this.weapon.getUpgradeCost();
        if (this.score >= cost && this.weapon.upgrade()) {
            this.score -= cost;
            return true;
        }
        return false;
    }

    draw(ctx) {
        const sx = this.x - Utils.camera.x;
        const sy = this.y - Utils.camera.y;

        // 受伤闪烁
        if (this.invincibleTimer > 0 && Math.sin(this.invincibleTimer * 30) > 0) return;

        // 低血量呼吸灯效果
        if (this.health < this.maxHealth * 0.3 && !this.dead) {
            const breathAlpha = 0.1 + Math.sin(this.animTime * 4) * 0.08;
            const breathSize = 35 + Math.sin(this.animTime * 3) * 5;
            ctx.beginPath();
            ctx.arc(sx, sy - this.h / 2, breathSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 50, 50, ${breathAlpha})`;
            ctx.fill();
        }

        // 停滞警告效果（红色脉冲光环）
        if (this.stagnationWarning > 0) {
            const warningAlpha = this.stagnationWarning * 0.4;
            const pulseSize = 30 + Math.sin(this.animTime * 6) * 5;
            ctx.beginPath();
            ctx.arc(sx, sy - this.h / 2, pulseSize, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 50, 50, ${warningAlpha})`;
            ctx.lineWidth = 3;
            ctx.stroke();

            // 内部警告闪烁
            if (this.stagnationTimer > 2) {
                const innerAlpha = (Math.sin(this.animTime * 10) + 1) * 0.2;
                ctx.fillStyle = `rgba(255, 0, 0, ${innerAlpha})`;
                ctx.beginPath();
                ctx.arc(sx, sy - this.h / 2, 20, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 冲刺残影（带角色轮廓）
        for (let i = 0; i < this.trailPositions.length; i++) {
            const t = this.trailPositions[i];
            const alpha = t.alpha * (i / this.trailPositions.length) * 0.3;
            if (alpha <= 0) continue;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(t.x - Utils.camera.x, t.y - Utils.camera.y);
            ctx.scale(this.facing, 1);
            // 简化的角色轮廓
            ctx.strokeStyle = '#7ce7ff';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(0, -8, 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, -3);
            ctx.lineTo(0, 8);
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(sx, sy);

        if (this.dead) {
            this.drawDead(ctx);
            ctx.restore();
            return;
        }

        // 脚下阴影
        if (this.onGround) {
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(0, 4, 14, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 二段跳指示（脚下光环）
        if (!this.onGround && this.jumpCount < this.maxJumps) {
            const r = 6 + Math.sin(this.animTime * 8) * 2;
            const g = ctx.createRadialGradient(0, 4, 0, 0, 4, r);
            g.addColorStop(0, 'rgba(52, 152, 219, 0.6)');
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 4, r, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.scale(this.facing, 1);

        // 腿部动画
        const legSwing = Math.sin(this.legPhase) * 12;
        const leftLeg = this.onGround ? legSwing : 5;
        const rightLeg = this.onGround ? -legSwing : -5;

        // 命中闪烁
        const isFlashing = this.invincibleTimer > 0 && Math.sin(this.invincibleTimer * 30) > 0;
        const bodyColor = isFlashing ? '#ff4444' : '#fff';
        const bodyLineWidth = isFlashing ? 4 : 3;

        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = bodyLineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 头部装备轮廓（头盔）
        ctx.beginPath();
        ctx.arc(0, -46, 10, -Math.PI * 0.8, Math.PI * 0.8);
        ctx.strokeStyle = isFlashing ? '#cc3333' : '#667788';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 头 — 填充 + 边框
        ctx.beginPath();
        ctx.arc(0, -46, 9, 0, Math.PI * 2);
        const headGrad = ctx.createRadialGradient(-2, -48, 2, 0, -46, 9);
        headGrad.addColorStop(0, bodyColor);
        headGrad.addColorStop(0.7, bodyColor === '#fff' ? '#ddd' : '#cc3333');
        headGrad.addColorStop(1, '#888');
        ctx.fillStyle = headGrad;
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 眼睛（朝向感知 + 发光）
        const eyeGlow = 0.7 + Math.sin(this.animTime * 3) * 0.3;
        ctx.fillStyle = `rgba(100, 220, 255, ${eyeGlow})`;
        ctx.shadowColor = '#64dcff';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(3, -49, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(3, -49, 0.9, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.shadowBlur = 0;

        // 身干护甲线条
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = bodyLineWidth;
        ctx.beginPath();
        ctx.moveTo(0, -38);
        ctx.lineTo(0, -14);
        ctx.stroke();
        // 肩甲轮廓
        ctx.strokeStyle = isFlashing ? '#cc3333' : '#556677';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-4, -36);
        ctx.lineTo(0, -38);
        ctx.lineTo(4, -36);
        ctx.stroke();
        // 胸甲细节
        ctx.beginPath();
        ctx.moveTo(-3, -32);
        ctx.lineTo(3, -32);
        ctx.stroke();

        // 腿
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = bodyLineWidth;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(leftLeg, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(rightLeg, 0);
        ctx.stroke();

        // 手臂 - 射击手
        ctx.save();
        ctx.translate(0, -32);
        // 根据朝向调整手臂角度，确保枪指向正确方向
        const drawArmAngle = this.facing === 1 ? this.armAngle : Math.PI - this.armAngle;
        ctx.rotate(drawArmAngle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(16, 0);
        ctx.stroke();

        // 武器
        if (this.weapon) {
            const wpLvl = this.weapon.level || 1;
            const wpLen = 12 + wpLvl * 2;
            const wpH = 4 + wpLvl;
            // 武器主体
            ctx.fillStyle = this.weapon.color;
            ctx.fillRect(12, -wpH / 2, wpLen, wpH);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            ctx.strokeRect(12, -wpH / 2, wpLen, wpH);
            // 武器细节线条
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.moveTo(14, -wpH / 2 + 1);
            ctx.lineTo(12 + wpLen - 2, -wpH / 2 + 1);
            ctx.stroke();

            // 高级别武器发光 + 能量流动
            if (wpLvl >= 3) {
                ctx.shadowColor = this.weapon.color;
                ctx.shadowBlur = 6 + wpLvl;
                ctx.strokeStyle = this.weapon.color + '80';
                ctx.lineWidth = 2;
                ctx.strokeRect(12, -wpH / 2, wpLen, wpH);
                // 能量流动动画
                const flowOffset = (this.animTime * 30) % wpLen;
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fillRect(12 + flowOffset, -wpH / 2, 3, wpH);
                ctx.shadowBlur = 0;
            }
            // 枪管发光条纹
            ctx.strokeStyle = this.weapon.color + 'aa';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(12 + wpLen, 0);
            ctx.stroke();
        } else {
            // 无武器时绘制默认手枪外观
            ctx.fillStyle = '#888';
            ctx.fillRect(12, -2, 16, 4);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            ctx.strokeRect(12, -2, 16, 4);
        }

        // 枪口闪光（增强版）
        if (this.shootFlash > 0.3) {
            const flashSize = 8 * this.shootFlash;
            // 中心闪光
            ctx.beginPath();
            ctx.arc(26, 0, flashSize * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 200, ${this.shootFlash})`;
            ctx.fill();
            // 外圈光晕
            ctx.beginPath();
            ctx.arc(26, 0, flashSize, 0, Math.PI * 2);
            const flashG = ctx.createRadialGradient(26, 0, 0, 26, 0, flashSize);
            flashG.addColorStop(0, `rgba(255, 230, 100, ${this.shootFlash * 0.8})`);
            flashG.addColorStop(1, 'transparent');
            ctx.fillStyle = flashG;
            ctx.fill();
        }
        ctx.restore();

        // 另一只手
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        const otherArmAngle = this.onGround ? Math.sin(this.animTime * 3) * 0.3 : -0.5;
        ctx.beginPath();
        ctx.moveTo(0, -32);
        ctx.lineTo(-10 + Math.cos(otherArmAngle) * 8, -28 + Math.sin(otherArmAngle) * 8);
        ctx.stroke();

        ctx.restore();

        // 瞄准时绘制抛物线轨迹
        if (this.aiming) {
            this.drawTrajectory(ctx);
        }

        // 护盾效果
        if (this.shieldActive) {
            const shieldAlpha = 0.25 + Math.sin(this.animTime * 8) * 0.1;
            const shieldRadius = 32 + Math.sin(this.animTime * 6) * 3;
            ctx.beginPath();
            ctx.arc(sx, sy - this.h / 2, shieldRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 210, 255, ${shieldAlpha + 0.3})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            const g = ctx.createRadialGradient(sx, sy - this.h / 2, 0, sx, sy - this.h / 2, shieldRadius);
            g.addColorStop(0, `rgba(0, 210, 255, ${shieldAlpha * 0.3})`);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.fill();
            // 护盾能量粒子
            for (let i = 0; i < 4; i++) {
                const a = this.animTime * 4 + (Math.PI * 2 * i) / 4;
                const px = sx + Math.cos(a) * shieldRadius;
                const py = sy - this.h / 2 + Math.sin(a) * shieldRadius;
                ctx.fillStyle = `rgba(150, 240, 255, ${shieldAlpha + 0.2})`;
                ctx.beginPath();
                ctx.arc(px, py, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 护盾储存数量显示
        if (this.shieldStorage > 0 && !this.shieldActive) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.ellipse(sx + 24, sy - this.h - 8, 16, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#00d2ff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`盾x${this.shieldStorage}`, sx + 24, sy - this.h - 4);
        }
    }

    drawTrajectory(ctx) {
        const startX = this.x;
        const startY = this.y - 30;
        const endX = this.aimTarget.x;
        const endY = this.aimTarget.y;
        const arcHeight = this.selectedThrown === 'grenade' ? 100 : 80;

        // 绘制抛物线轨迹（虚线）
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = this.selectedThrown === 'grenade' ? 'rgba(85, 136, 51, 0.7)' : 'rgba(255, 102, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const steps = 20;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = startX + (endX - startX) * t;
            const baseY = startY + (endY - startY) * t;
            const y = baseY - Math.sin(t * Math.PI) * arcHeight;
            if (i === 0) {
                ctx.moveTo(x - Utils.camera.x, y - Utils.camera.y);
            } else {
                ctx.lineTo(x - Utils.camera.x, y - Utils.camera.y);
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // 绘制落点标记
        const targetSX = endX - Utils.camera.x;
        const targetSY = endY - Utils.camera.y;
        const radius = this.selectedThrown === 'grenade' ? 160 : 65;

        // 范围指示圆圈
        ctx.beginPath();
        ctx.arc(targetSX, targetSY, radius, 0, Math.PI * 2);
        ctx.fillStyle = this.selectedThrown === 'grenade' ? 'rgba(85, 136, 51, 0.15)' : 'rgba(255, 102, 0, 0.15)';
        ctx.fill();
        ctx.strokeStyle = this.selectedThrown === 'grenade' ? 'rgba(85, 136, 51, 0.5)' : 'rgba(255, 102, 0, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 落点中心十字
        ctx.strokeStyle = this.selectedThrown === 'grenade' ? '#558833' : '#ff6600';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(targetSX - 8, targetSY);
        ctx.lineTo(targetSX + 8, targetSY);
        ctx.moveTo(targetSX, targetSY - 8);
        ctx.lineTo(targetSX, targetSY + 8);
        ctx.stroke();

        ctx.restore();
    }

    drawDead(ctx) {
        const fall = Math.min(this.deathTimer * 2, 1);

        ctx.globalAlpha = 1 - fall * 0.6;

        // 碎裂效果
        const fragmentCount = 6;
        for (let i = 0; i < fragmentCount; i++) {
            const angle = (Math.PI * 2 * i) / fragmentCount + this.deathTimer * 2;
            const dist = fall * 30 + i * 5;
            const fx = Math.cos(angle) * dist;
            const fy = Math.sin(angle) * dist - fall * 15;

            ctx.save();
            ctx.translate(fx, fy);
            ctx.rotate(fall * Math.PI * 0.5 * (i % 2 === 0 ? 1 : -1));
            ctx.globalAlpha = (1 - fall) * (0.5 + i * 0.08);

            ctx.strokeStyle = '#888';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';

            if (i === 0) {
                // 头部碎片
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.stroke();
            } else if (i < 3) {
                // 身体碎片
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(0, 8);
                ctx.stroke();
            } else {
                // 腿部碎片
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(10, 8);
                ctx.stroke();
            }
            ctx.restore();
        }

        // 倒下的身体（淡出）
        ctx.save();
        ctx.globalAlpha = (1 - fall) * 0.8;
        ctx.rotate(fall * Math.PI / 2 * this.facing);
        ctx.translate(0, -fall * 20);

        ctx.strokeStyle = '#666';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        // 头
        ctx.beginPath();
        ctx.arc(-5, -8, 7, 0, Math.PI * 2);
        ctx.stroke();

        // 身干
        ctx.beginPath();
        ctx.moveTo(2, -8);
        ctx.lineTo(15, -8);
        ctx.stroke();

        // 腿
        ctx.beginPath();
        ctx.moveTo(15, -8);
        ctx.lineTo(22, -2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(15, -8);
        ctx.lineTo(20, -15);
        ctx.stroke();

        ctx.restore();

        // 死亡光环扩散
        if (this.deathTimer < 0.8) {
            const ringRadius = 20 + this.deathTimer * 80;
            const ringAlpha = (0.5 - this.deathTimer * 0.6) * (1 - this.deathTimer / 0.8);
            if (ringAlpha > 0) {
                ctx.beginPath();
                ctx.arc(0, -25, ringRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(124, 231, 255, ${ringAlpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }
}

// ---- 投掷物（手雷/燃烧瓶）----
class ThrownProjectile {
    constructor(type, x, y, targetX, targetY) {
        this.type = type;
        this.x = x; this.y = y;
        this.targetX = targetX; this.targetY = targetY;
        this.startX = x; this.startY = y;
        this.progress = 0;
        this.speed = type === 'grenade' ? 2.2 : 2.0;
        this.arcHeight = type === 'grenade' ? 100 : 80;
        this.damage = type === 'grenade' ? 55 : 0;
        this.radius = type === 'grenade' ? 160 : 140;
        this.dead = false;
        this.exploded = false;
        this.fireZoneLife = 0;
        this.maxFireZoneLife = type === 'molotov' ? 8.0 : 0;
        this.animTime = 0;
    }

    update(dt, platforms) {
        if (this.dead) return;
        this.animTime += dt;
        this.progress += this.speed * dt;
        if (this.progress >= 1) {
            this.progress = 1;
            this.x = this.targetX;
            this.y = this.targetY;
            if (!this.exploded) {
                this.exploded = true;
                if (this.type === 'grenade') {
                    Particles.spawnExplosion(this.x, this.y);
                    Audio.play('explode');
                    // 不在这里设 dead，让 game.js 碰撞检测处理伤害后再清除
                } else {
                    Audio.play('explode');
                }
            }
        } else {
            const t = this.progress;
            this.x = this.startX + (this.targetX - this.startX) * t;
            const baseY = this.startY + (this.targetY - this.startY) * t;
            this.y = baseY - Math.sin(t * Math.PI) * this.arcHeight;
        }
        if (this.type === 'molotov' && this.exploded) {
            this.fireZoneLife += dt;
            if (this.fireZoneLife >= this.maxFireZoneLife) this.dead = true;
            if (Math.random() < 0.3) {
                Particles.spawn(this.x + Utils.rand(-this.radius * 0.6, this.radius * 0.6),
                    this.y + Utils.rand(-10, 10), 1, '#ff6600', 40, 0.4, 2);
            }
        }
    }

    draw(ctx) {
        const sx = this.x - Utils.camera.x;
        const sy = this.y - Utils.camera.y;
        if (this.type === 'grenade') {
            ctx.fillStyle = '#558833';
            ctx.beginPath();
            ctx.arc(sx, sy, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#336622';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx, sy - 7);
            ctx.lineTo(sx + 4, sy - 13);
            ctx.stroke();
        } else {
            if (this.exploded) {
                const flicker = Math.sin(this.animTime * 10) * 0.1 + 0.8;
                const baseR = this.radius;

                // 散开火焰 — 多个向外溅射的火舌（像汽油向四周流淌燃烧）
                const splashCount = 12;
                for (let i = 0; i < splashCount; i++) {
                    const seed = i * 2.31;
                    const angle = (Math.PI * 2 * i) / splashCount + Math.sin(this.animTime * 0.5 + seed) * 0.5;
                    // 每条火舌长度不同，模拟随机溅射
                    const reach = baseR * (0.35 + Math.sin(seed) * 0.3 + Math.sin(this.animTime * 2 + seed) * 0.1);
                    const width = baseR * 0.1 + Math.sin(this.animTime * 4 + seed) * 4;

                    const startX = sx + Math.cos(angle) * baseR * 0.08;
                    const startY = sy + Math.sin(angle) * baseR * 0.08;
                    const endX = sx + Math.cos(angle) * reach;
                    const endY = sy + Math.sin(angle) * reach * 0.45; // 压扁，更贴地

                    const sway = Math.sin(this.animTime * 6 + seed) * width * 0.7;
                    const midX = (startX + endX) * 0.5 + sway;
                    const midY = (startY + endY) * 0.5;

                    // 外焰（暗红）
                    ctx.fillStyle = `rgba(255, 40, 0, ${flicker * 0.3})`;
                    ctx.beginPath();
                    ctx.moveTo(startX - width, startY);
                    ctx.quadraticCurveTo(midX + sway, midY, endX, endY);
                    ctx.quadraticCurveTo(midX - sway, midY, startX + width, startY);
                    ctx.fill();

                    // 中焰（橙）
                    ctx.fillStyle = `rgba(255, 120, 0, ${flicker * 0.42})`;
                    ctx.beginPath();
                    ctx.moveTo(startX - width * 0.7, startY);
                    ctx.quadraticCurveTo(midX + sway * 0.7, midY, endX * 0.8 + startX * 0.2, endY * 0.8 + startY * 0.2);
                    ctx.quadraticCurveTo(midX - sway * 0.7, midY, startX + width * 0.7, startY);
                    ctx.fill();

                    // 内焰（金黄）
                    ctx.fillStyle = `rgba(255, 210, 60, ${flicker * 0.5})`;
                    ctx.beginPath();
                    ctx.moveTo(startX - width * 0.4, startY);
                    ctx.quadraticCurveTo(midX + sway * 0.4, midY, endX * 0.55 + startX * 0.45, endY * 0.55 + startY * 0.45);
                    ctx.quadraticCurveTo(midX - sway * 0.4, midY, startX + width * 0.4, startY);
                    ctx.fill();
                }

                // 中心火堆核心
                const coreG = ctx.createRadialGradient(sx, sy, 0, sx, sy, baseR * 0.22);
                coreG.addColorStop(0, `rgba(255, 250, 180, ${flicker * 0.75})`);
                coreG.addColorStop(0.5, `rgba(255, 170, 0, ${flicker * 0.55})`);
                coreG.addColorStop(1, 'transparent');
                ctx.fillStyle = coreG;
                ctx.beginPath();
                ctx.ellipse(sx, sy, baseR * 0.28, baseR * 0.16, 0, 0, Math.PI * 2);
                ctx.fill();

                // 飘散的火星
                for (let i = 0; i < 14; i++) {
                    const seed = i * 4.1 + this.animTime * 3.5;
                    const mx = sx + Math.sin(seed) * baseR * 0.8;
                    const my = sy + Math.cos(seed * 1.4) * baseR * 0.3 - Math.abs(Math.sin(seed * 2.3)) * baseR * 0.25;
                    const mAlpha = flicker * (0.4 + Math.sin(seed * 5) * 0.4);
                    const mSize = 0.5 + Math.sin(seed * 4) * 0.6;
                    ctx.fillStyle = `rgba(255, ${170 + Math.sin(seed) * 50}, 40, ${mAlpha})`;
                    ctx.beginPath();
                    ctx.arc(mx, my, Math.max(0.3, mSize), 0, Math.PI * 2);
                    ctx.fill();
                }

                // 随时间淡出
                const lifeRatio = 1 - this.fireZoneLife / this.maxFireZoneLife;
                if (lifeRatio < 0.3) ctx.globalAlpha = lifeRatio / 0.3;
                ctx.globalAlpha = 1;
            } else {
                ctx.save();
                ctx.translate(sx, sy);
                ctx.rotate(this.progress * Math.PI * 3);

                // 火焰拖尾
                for (let i = 1; i <= 4; i++) {
                    const t = i / 4;
                    const alpha = (1 - t) * 0.5;
                    ctx.fillStyle = `rgba(255, ${80 + t * 120}, 0, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(0, -10 - i * 3.5, 2.5 + t * 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }

                // 玻璃瓶身
                ctx.fillStyle = 'rgba(200, 220, 255, 0.25)';
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
                ctx.fillStyle = 'rgba(255, 100, 0, 0.7)';
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

                // 瓶口火焰
                const flameFlicker = Math.sin(this.animTime * 15) * 2.5;
                ctx.fillStyle = '#ff4400';
                ctx.beginPath();
                ctx.moveTo(-3, -6);
                ctx.quadraticCurveTo(-4 + flameFlicker, -17, 0, -19);
                ctx.quadraticCurveTo(4 + flameFlicker, -17, 3, -6);
                ctx.fill();
                ctx.fillStyle = '#ff8800';
                ctx.beginPath();
                ctx.moveTo(-2.5, -6);
                ctx.quadraticCurveTo(-3 + flameFlicker * 0.5, -14, 0, -16);
                ctx.quadraticCurveTo(3 + flameFlicker * 0.5, -14, 2.5, -6);
                ctx.fill();
                ctx.fillStyle = '#ffcc00';
                ctx.beginPath();
                ctx.moveTo(-1.5, -6);
                ctx.quadraticCurveTo(-1.5 + flameFlicker * 0.3, -11, 0, -12);
                ctx.quadraticCurveTo(1.5 + flameFlicker * 0.3, -11, 1.5, -6);
                ctx.fill();

                ctx.restore();
            }
        }
    }

    getGrenadeRect() {
        return { x: this.x - this.radius, y: this.y - this.radius, w: this.radius * 2, h: this.radius * 2 };
    }
}

// ---- 敌人基类 ----
class Enemy {
    constructor(x, y, config) {
        this.x = x; this.y = y;
        this.w = config.w || 24;
        this.h = config.h || 46;
        this.vx = 0; this.vy = 0;
        this.speed = config.speed || 100;
        this.gravity = 1200;
        this.health = config.health || 30;
        this.maxHealth = this.health;
        this.damage = config.damage || 10;
        this.score = config.score || 50;
        this.onGround = false;
        this.facing = -1;
        this.dead = false;
        this.deathTimer = 0;
        this.color = config.color || '#e74c3c';
        this.type = config.type || 'walker';
        this.aggroRange = config.aggroRange || 300;
        this.attackCooldown = 0;
        this.attackRate = config.attackRate || 1;
        this.animTime = Math.random() * 10;
        this.exploded = false;
        this.baseY = config.baseY || y;

        // 巡逻
        this.patrolDir = Math.random() > 0.5 ? 1 : -1;
        this.patrolTimer = Utils.rand(1, 3);

        // 射击型
        this.canShoot = config.canShoot || false;
        this.bulletSpeed = config.bulletSpeed || 400;
        this.bullets = [];
    }

    getRect() {
        return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
    }

    update(dt, platforms, playerX, playerY) {
        if (this.dead) {
            this.deathTimer += dt;
            return this.deathTimer < 0.5;
        }

        // 固定炮台：完全静止，只转向和射击
        if (this.type === 'turret' && this.onGround) {
            this.animTime += dt;
            this.attackCooldown = Math.max(0, this.attackCooldown - dt);
            this.facing = playerX > this.x ? 1 : -1;
            const dist = Utils.dist(this.x, this.y, playerX, playerY);
            if (dist < this.aggroRange && this.canShoot && this.attackCooldown <= 0) {
                this.shoot(playerX, playerY);
                this.attackCooldown = this.attackRate;
            }
            for (let i = this.bullets.length - 1; i >= 0; i--) {
                const b = this.bullets[i];
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                b.life -= dt;
                if (b.life <= 0) this.bullets.splice(i, 1);
            }
            return true;
        }

        this.animTime += dt;
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);

        // 飞行器：悬浮运动
        if (this.type === 'flyer') {
            const hoverTarget = this.baseY + Math.sin(this.animTime * 2) * 30;
            this.vy = (hoverTarget - this.y) * 5;
        }

        const distToPlayer = Utils.dist(this.x, this.y, playerX, playerY);
        const inRange = distToPlayer < this.aggroRange;

        // 轰炸机：高空飞行，周期性投弹
        if (this.type === 'bomber') {
            const hoverTarget = this.baseY + Math.sin(this.animTime * 1.5) * 20;
            this.vy = (hoverTarget - this.y) * 4;
            // 轰炸机水平巡航
            if (!inRange) {
                this.vx = this.patrolDir * this.speed;
            }
        }

        // 俯冲者：高空盘旋，发现玩家后快速俯冲
        if (this.type === 'swooper') {
            if (!this.swoopState) this.swoopState = 'hover';
            if (!this.swoopCooldown) this.swoopCooldown = 0;
            this.swoopCooldown = Math.max(0, this.swoopCooldown - dt);

            if (this.swoopState === 'hover') {
                const hoverTarget = this.baseY + Math.sin(this.animTime * 2.5) * 25;
                this.vy = (hoverTarget - this.y) * 5;
                this.vx *= 0.95;
                // 发现玩家且冷却结束，开始俯冲
                if (inRange && this.swoopCooldown <= 0) {
                    this.swoopState = 'dive';
                    this.diveTargetX = playerX;
                    this.diveTargetY = playerY;
                    Audio.play('shoot');
                }
            } else if (this.swoopState === 'dive') {
                // 快速俯冲向玩家
                const angle = Utils.angle(this.x, this.y, this.diveTargetX, this.diveTargetY);
                this.vx = Math.cos(angle) * this.speed * 3;
                this.vy = Math.sin(angle) * this.speed * 3;
                // 到达目标点附近或过低，拉起
                const distToTarget = Utils.dist(this.x, this.y, this.diveTargetX, this.diveTargetY);
                if (distToTarget < 40 || this.y > 480) {
                    this.swoopState = 'ascend';
                }
            } else if (this.swoopState === 'ascend') {
                // 快速拉升回高空
                this.vy = -this.speed * 2;
                this.vx *= 0.9;
                if (this.y <= this.baseY + 20) {
                    this.swoopState = 'hover';
                    this.swoopCooldown = 2.0;
                }
            }
        }

        // 无人机：小型高速，围绕玩家做圆周运动
        if (this.type === 'drone') {
            if (!this.orbitAngle) this.orbitAngle = Math.random() * Math.PI * 2;
            this.orbitAngle += dt * 2;
            if (inRange) {
                const orbitRadius = 120 + Math.sin(this.animTime * 3) * 30;
                const targetX = playerX + Math.cos(this.orbitAngle) * orbitRadius;
                const targetY = playerY - 40 + Math.sin(this.orbitAngle * 0.7) * 40;
                this.vx = (targetX - this.x) * 3;
                this.vy = (targetY - this.y) * 3;
            } else {
                const hoverTarget = this.baseY + Math.sin(this.animTime * 3) * 15;
                this.vy = (hoverTarget - this.y) * 5;
            }
            // 无人机射击
            if (this.canShoot && this.attackCooldown <= 0 && inRange) {
                this.shoot(playerX, playerY);
                this.attackCooldown = this.attackRate;
            }
        }

        if (inRange) {
            // 追踪玩家
            const dir = playerX > this.x ? 1 : -1;
            this.facing = dir;

            if (this.type === 'walker' || this.type === 'runner') {
                this.vx = dir * this.speed;
            } else if (this.type === 'shooter') {
                // 射击型保持距离
                if (distToPlayer < 150) {
                    this.vx = -dir * this.speed * 0.7;
                } else if (distToPlayer > 250) {
                    this.vx = dir * this.speed * 0.5;
                } else {
                    this.vx = 0;
                }

                // 射击
                if (this.canShoot && this.attackCooldown <= 0) {
                    this.shoot(playerX, playerY);
                    this.attackCooldown = this.attackRate;
                }
            } else if (this.type === 'jumper') {
                this.vx = dir * this.speed;
                if (this.onGround && Math.random() < 0.02) {
                    this.vy = -400;
                    this.onGround = false;
                }
            } else if (this.type === 'missile') {
                if (distToPlayer < 180) {
                    this.vx = -dir * this.speed * 0.7;
                } else if (distToPlayer > 350) {
                    this.vx = dir * this.speed * 0.5;
                } else {
                    this.vx = 0;
                }
                if (this.canShoot && this.attackCooldown <= 0) {
                    this.shoot(playerX, playerY, { homing: true, turnRate: 3, speed: this.bulletSpeed, life: 5, size: 5 });
                    this.attackCooldown = this.attackRate;
                }
            } else if (this.type === 'kamikaze') {
                this.vx = dir * this.speed;
                this.facing = dir;
                if (!this._chargePlayed && distToPlayer < 180) {
                    this._chargePlayed = true;
                    Audio.play('kamikazeCharge');
                }
                if (distToPlayer < 60) {
                    this.dead = true;
                    this.health = 0;
                }
            } else if (this.type === 'flyer') {
                this.vx = dir * this.speed;
                if (this.canShoot && this.attackCooldown <= 0) {
                    this.shoot(playerX, playerY);
                    this.attackCooldown = this.attackRate;
                }
            } else if (this.type === 'bomber') {
                // 轰炸机保持在玩家上方，周期性投弹
                this.vx = dir * this.speed * 0.6;
                if (this.canShoot && this.attackCooldown <= 0) {
                    this.shoot(playerX, playerY, { speed: 200, life: 2, size: 6 });
                    this.attackCooldown = this.attackRate;
                }
            } else if (this.type === 'swooper') {
                // 俯冲者的追踪逻辑在上方已处理
                if (this.swoopState === 'hover') {
                    this.vx = dir * this.speed * 0.3;
                }
            } else if (this.type === 'drone') {
                // 无人机的追踪逻辑在上方已处理
            }
        } else {
            // 巡逻（炮台不巡逻）
            if (this.type !== 'turret') {
                this.patrolTimer -= dt;
                if (this.patrolTimer <= 0) {
                    this.patrolDir *= -1;
                    this.patrolTimer = Utils.rand(1.5, 3);
                }
                this.vx = this.patrolDir * this.speed * 0.4;
                this.facing = this.patrolDir;
            }
        }

        // 物理
        if (this.type !== 'turret') this.vy += this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // 平台碰撞（飞行器跳过）
        if (this.type !== 'flyer') {
            this.onGround = false;
            const halfW = this.w / 2;
            const prevFeetY = this.y - this.vy * dt;
            for (const p of platforms) {
                if (this.x + halfW > p.x && this.x - halfW < p.x + p.w) {
                    if (this.vy >= 0 && prevFeetY <= p.y + 4 && this.y >= p.y - 2) {
                        this.y = p.y;
                        this.vy = 0;
                        this.onGround = true;
                        this.x += p._dx || 0;
                        break;
                    }
                    if (this.vy >= 0 && Math.abs(this.y - p.y) <= 4) {
                        this.y = p.y;
                        this.vy = 0;
                        this.onGround = true;
                        this.x += p._dx || 0;
                        break;
                    }
                }
            }
        }

        // 掉落深渊判定为死亡
        if (this.y > 700) {
            this.dead = true;
            this.health = 0;
            return false;
        }

        // 更新子弹
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            if (b.homing) {
                const targetAngle = Utils.angle(b.x, b.y, playerX, playerY);
                const currentAngle = Math.atan2(b.vy, b.vx);
                let diff = targetAngle - currentAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                const turn = Math.sign(diff) * Math.min(Math.abs(diff), b.turnRate * dt);
                const newAngle = currentAngle + turn;
                const speed = Math.hypot(b.vx, b.vy);
                b.vx = Math.cos(newAngle) * speed;
                b.vy = Math.sin(newAngle) * speed;
            }
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0) this.bullets.splice(i, 1);
        }

        return true;
    }

    shoot(tx, ty, opts = {}) {
        const angle = Utils.angle(this.x, this.y - this.h / 2, tx, ty);
        const bullet = {
            x: this.x, y: this.y - this.h / 2,
            vx: Math.cos(angle) * (opts.speed || this.bulletSpeed),
            vy: Math.sin(angle) * (opts.speed || this.bulletSpeed),
            damage: this.damage * 0.7,
            life: opts.life || 3,
            size: opts.size || 3,
        };
        if (opts.homing) {
            bullet.homing = true;
            bullet.turnRate = opts.turnRate || 3;
        }
        this.bullets.push(bullet);
        Audio.play('enemyShoot');
    }

    takeDamage(amount) {
        this.health -= amount;
        Particles.spawnBlood(this.x, this.y - this.h / 2, 4);
        if (this.health <= 0) {
            this.health = 0;
            this.dead = true;
            Audio.play('hit');
        }
    }

    draw(ctx) {
        const sx = this.x - Utils.camera.x;
        const sy = this.y - Utils.camera.y;

        if (this.dead) {
            const alpha = 1 - Math.min(this.deathTimer * 3, 1);
            ctx.globalAlpha = alpha;

            // 死亡碎裂动画（增强版）
            const fragmentCount = 5;
            for (let i = 0; i < fragmentCount; i++) {
                const angle = (Math.PI * 2 * i) / fragmentCount + this.deathTimer * 3;
                const dist = this.deathTimer * 40 + i * 8;
                const fx = sx + Math.cos(angle) * dist;
                const fy = sy - this.h / 2 + Math.sin(angle) * dist;

                ctx.fillStyle = this.color;
                ctx.save();
                ctx.translate(fx, fy);
                ctx.rotate(this.deathTimer * 5 * (i % 2 === 0 ? 1 : -1));
                ctx.fillRect(-3, -3, 6, 6);
                ctx.restore();
            }

            // 死亡光环
            if (this.deathTimer < 0.5) {
                const ringRadius = 15 + this.deathTimer * 60;
                const ringAlpha = (0.4 - this.deathTimer * 0.8) * (1 - this.deathTimer / 0.5);
                if (ringAlpha > 0) {
                    ctx.beginPath();
                    ctx.arc(sx, sy - this.h / 2, ringRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = this.color + Math.floor(ringAlpha * 255).toString(16).padStart(2, '0');
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            ctx.globalAlpha = 1;
            return;
        }

        ctx.save();
        ctx.translate(sx, sy);

        // 自爆兵：发光效果
        if (this.type === 'kamikaze') {
            const glowIntensity = 0.5 + Math.sin(this.animTime * 8) * 0.3;
            const glowRadius = 25 + Math.sin(this.animTime * 6) * 5;
            const g = ctx.createRadialGradient(0, -this.h / 2, 0, 0, -this.h / 2, glowRadius);
            g.addColorStop(0, `rgba(255, 100, 0, ${glowIntensity * 0.8})`);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, -this.h / 2, glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 固定炮台绘制
        if (this.type === 'turret') {
            ctx.strokeStyle = this.color;
            ctx.fillStyle = '#444';
            ctx.fillRect(-16, -6, 32, 6);
            ctx.fillStyle = '#666';
            ctx.beginPath();
            ctx.arc(0, -12, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(0, -12, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.scale(this.facing, 1);
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(4, -12);
            ctx.lineTo(22, -12);
            ctx.stroke();
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(22, -12, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.restore();
            for (const b of this.bullets) {
                ctx.beginPath();
                ctx.arc(b.x - Utils.camera.x, b.y - Utils.camera.y, b.size, 0, Math.PI * 2);
                ctx.fillStyle = '#ff4444';
                ctx.fill();
            }
            if (this.health < this.maxHealth) {
                const barW = 30, barH = 4;
                const ratio = this.health / this.maxHealth;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(sx - barW / 2, sy - this.h - 12, barW, barH);
                ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
                ctx.fillRect(sx - barW / 2, sy - this.h - 12, barW * ratio, barH);
            }
            return;
        }

        // 飞行器绘制
        if (this.type === 'flyer') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(0, -42, 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(3, -43, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, -35);
            ctx.lineTo(0, -14);
            ctx.stroke();
            ctx.scale(this.facing, 1);
            const wingFlap = Math.sin(this.animTime * 10) * 12;
            ctx.strokeStyle = this.color + 'aa';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -28);
            ctx.lineTo(-18, -28 + wingFlap);
            ctx.lineTo(-14, -20);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, -28);
            ctx.lineTo(18, -28 - wingFlap);
            ctx.lineTo(14, -20);
            ctx.stroke();
            ctx.fillStyle = '#666';
            ctx.fillRect(-6, -12, 12, 8);
            ctx.fillStyle = '#ff6600';
            const thrustSize = 4 + Math.sin(this.animTime * 15) * 2;
            ctx.beginPath();
            ctx.moveTo(-3, -4);
            ctx.lineTo(3, -4);
            ctx.lineTo(0, -4 + thrustSize + 6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            if (this.health < this.maxHealth) {
                const barW = 30, barH = 4;
                const ratio = this.health / this.maxHealth;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(sx - barW / 2, sy - this.h - 16, barW, barH);
                ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
                ctx.fillRect(sx - barW / 2, sy - this.h - 16, barW * ratio, barH);
            }
            for (const b of this.bullets) {
                ctx.beginPath();
                ctx.arc(b.x - Utils.camera.x, b.y - Utils.camera.y, b.size, 0, Math.PI * 2);
                ctx.fillStyle = '#ff4444';
                ctx.fill();
            }
            return;
        }

        // 轰炸机绘制
        if (this.type === 'bomber') {
            ctx.scale(this.facing, 1);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            // 机身
            ctx.fillStyle = '#555';
            ctx.beginPath();
            ctx.ellipse(0, -30, 20, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = this.color;
            ctx.stroke();
            // 驾驶舱
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.arc(12, -32, 5, 0, Math.PI * 2);
            ctx.fill();
            // 机翼
            ctx.strokeStyle = this.color + 'cc';
            ctx.lineWidth = 2;
            const wingSweep = Math.sin(this.animTime * 6) * 5;
            ctx.beginPath();
            ctx.moveTo(-5, -28);
            ctx.lineTo(-25, -22 + wingSweep);
            ctx.lineTo(-20, -26);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-5, -32);
            ctx.lineTo(-25, -38 - wingSweep);
            ctx.lineTo(-20, -34);
            ctx.stroke();
            // 炸弹舱（闪烁指示可投弹）
            if (this.attackCooldown <= 0.3) {
                ctx.fillStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(this.animTime * 10) * 0.5})`;
                ctx.beginPath();
                ctx.arc(0, -22, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            // 引擎尾焰
            ctx.fillStyle = '#ff8800';
            const exhaustSize = 3 + Math.sin(this.animTime * 12) * 1.5;
            ctx.beginPath();
            ctx.moveTo(-18, -28);
            ctx.lineTo(-18 - exhaustSize - 4, -28);
            ctx.lineTo(-18, -28 + exhaustSize);
            ctx.lineTo(-18, -28 - exhaustSize);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            // 血条
            if (this.health < this.maxHealth) {
                const barW = 30, barH = 4;
                const ratio = this.health / this.maxHealth;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(sx - barW / 2, sy - this.h - 16, barW, barH);
                ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
                ctx.fillRect(sx - barW / 2, sy - this.h - 16, barW * ratio, barH);
            }
            for (const b of this.bullets) {
                ctx.beginPath();
                ctx.arc(b.x - Utils.camera.x, b.y - Utils.camera.y, b.size, 0, Math.PI * 2);
                ctx.fillStyle = '#ff8800';
                ctx.fill();
            }
            return;
        }

        // 俯冲者绘制
        if (this.type === 'swooper') {
            ctx.scale(this.facing, 1);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            // 头
            ctx.beginPath();
            ctx.arc(0, -38, 7, 0, Math.PI * 2);
            const swoopG = ctx.createRadialGradient(-1, -39, 1, 0, -38, 7);
            swoopG.addColorStop(0, '#fff');
            swoopG.addColorStop(0.5, this.color);
            swoopG.addColorStop(1, '#333');
            ctx.fillStyle = swoopG;
            ctx.fill();
            ctx.stroke();
            // 眼睛（俯冲时变红）
            const swoopEyeColor = this.swoopState === 'dive' ? '#ff0000' : '#ffff00';
            ctx.fillStyle = swoopEyeColor;
            ctx.shadowColor = swoopEyeColor;
            ctx.shadowBlur = this.swoopState === 'dive' ? 8 : 3;
            ctx.beginPath();
            ctx.arc(3, -39, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            // 身干
            ctx.beginPath();
            ctx.moveTo(0, -31);
            ctx.lineTo(0, -12);
            ctx.stroke();
            // 翅膀（俯冲时收起，盘旋时展开）
            const wingSpread = this.swoopState === 'dive' ? 5 : 20;
            const wingFlap2 = Math.sin(this.animTime * 12) * 8;
            ctx.strokeStyle = this.color + 'bb';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -26);
            ctx.lineTo(-wingSpread, -26 + wingFlap2);
            ctx.lineTo(-wingSpread + 4, -20);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, -26);
            ctx.lineTo(wingSpread, -26 - wingFlap2);
            ctx.lineTo(wingSpread - 4, -20);
            ctx.stroke();
            // 俯冲时的残影效果
            if (this.swoopState === 'dive') {
                ctx.strokeStyle = this.color + '40';
                ctx.lineWidth = 1;
                for (let i = 1; i <= 3; i++) {
                    ctx.beginPath();
                    ctx.arc(0 - this.vx * 0.01 * i, -38 - this.vy * 0.01 * i, 7, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            ctx.restore();
            if (this.health < this.maxHealth) {
                const barW = 28, barH = 4;
                const ratio = this.health / this.maxHealth;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(sx - barW / 2, sy - this.h - 14, barW, barH);
                ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
                ctx.fillRect(sx - barW / 2, sy - this.h - 14, barW * ratio, barH);
            }
            return;
        }

        // 无人机绘制
        if (this.type === 'drone') {
            ctx.scale(this.facing, 1);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            // 核心
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(0, -20, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = this.color;
            ctx.stroke();
            // 能量核心（发光）
            const coreGlow = 0.6 + Math.sin(this.animTime * 8) * 0.4;
            ctx.fillStyle = `rgba(0, 255, 255, ${coreGlow})`;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(0, -20, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            // 旋翼
            const rotorSpeed = this.animTime * 20;
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 4; i++) {
                const angle = rotorSpeed + (Math.PI / 2) * i;
                const rx = Math.cos(angle) * 14;
                const ry = Math.sin(angle) * 6;
                ctx.beginPath();
                ctx.moveTo(0, -20);
                ctx.lineTo(rx, -20 + ry);
                ctx.stroke();
            }
            // 旋翼环
            ctx.strokeStyle = this.color + '60';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(0, -20, 14, 6, 0, 0, Math.PI * 2);
            ctx.stroke();
            // 小型武器
            ctx.fillStyle = '#666';
            ctx.fillRect(5, -22, 6, 3);
            ctx.restore();
            if (this.health < this.maxHealth) {
                const barW = 24, barH = 3;
                const ratio = this.health / this.maxHealth;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(sx - barW / 2, sy - this.h - 12, barW, barH);
                ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
                ctx.fillRect(sx - barW / 2, sy - this.h - 12, barW * ratio, barH);
            }
            for (const b of this.bullets) {
                ctx.beginPath();
                ctx.arc(b.x - Utils.camera.x, b.y - Utils.camera.y, b.size, 0, Math.PI * 2);
                ctx.fillStyle = '#00ffff';
                ctx.fill();
            }
            return;
        }

        ctx.scale(this.facing, 1);

        // 脚下阴影
        if (this.onGround) {
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath();
            ctx.ellipse(0, 1, 10, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        // 头 — 填充 + 边框
        ctx.beginPath();
        ctx.arc(0, -42, 8, 0, Math.PI * 2);
        const hG = ctx.createRadialGradient(-1, -43, 1, 0, -42, 8);
        hG.addColorStop(0, '#fff');
        hG.addColorStop(0.6, this.color);
        hG.addColorStop(1, '#444');
        ctx.fillStyle = hG;
        ctx.fill();
        ctx.stroke();

        // 眼睛（红色，脉冲发光）
        const eyePulse = 0.7 + Math.sin(this.animTime * 6) * 0.3;
        ctx.fillStyle = `rgba(255, 0, 0, ${eyePulse})`;
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 4 * eyePulse;
        ctx.beginPath();
        ctx.arc(3, -43, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 身干
        ctx.beginPath();
        ctx.moveTo(0, -35);
        ctx.lineTo(0, -14);
        ctx.stroke();

        // 腿
        const legAnim = Math.sin(this.animTime * 8) * 10;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(legAnim * (this.onGround ? 1 : 0.3), 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(-legAnim * (this.onGround ? 1 : 0.3), 0);
        ctx.stroke();

        // 手臂
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(12, -24);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(-8, -24);
        ctx.stroke();

        ctx.restore();

        // 血条
        if (this.health < this.maxHealth) {
            const barW = 30;
            const barH = 4;
            const ratio = this.health / this.maxHealth;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(sx - barW / 2, sy - this.h - 12, barW, barH);
            ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
            ctx.fillRect(sx - barW / 2, sy - this.h - 12, barW * ratio, barH);
        }

        // 子弹绘制
        for (const b of this.bullets) {
            const bx = b.x - Utils.camera.x;
            const by = b.y - Utils.camera.y;
            if (b.homing) {
                // 导弹：尖锥形 + 尾焰
                ctx.save();
                ctx.translate(bx, by);
                ctx.rotate(Math.atan2(b.vy, b.vx));
                ctx.fillStyle = '#ff6600';
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(-5, -5);
                ctx.lineTo(-3, 0);
                ctx.lineTo(-5, 5);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(255, 200, 50, 0.8)';
                ctx.beginPath();
                ctx.arc(-4, 0, 4 + Math.sin(this.animTime * 20) * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(bx, by, b.size, 0, Math.PI * 2);
                ctx.fillStyle = '#ff4444';
                ctx.fill();
            }
        }
    }
}

// ---- Boss ----
class Boss {
    constructor(x, y, config) {
        this.x = x; this.y = y;
        this.w = config.w || 50;
        this.h = config.h || 80;
        this.vx = 0; this.vy = 0;
        this.speed = config.speed || 80;
        this.gravity = 1200;
        this.health = config.health || 500;
        this.maxHealth = this.health;
        this.damage = config.damage || 20;
        this.score = config.score || 500;
        this.onGround = false;
        this.facing = -1;
        this.dead = false;
        this.deathTimer = 0;
        this.name = config.name || 'Boss';
        this.color = config.color || '#e74c3c';
        this.level = config.level || 1;
        this.phase = 0; // 战斗阶段
        this.animTime = 0;
        this.attackPattern = 0;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.bullets = [];
        this.abilities = config.abilities || ['melee', 'shoot'];
        this.entranceDone = false;
        this.entranceTimer = 0;
        this.shieldActive = false;
        this.shieldTimer = 0;
        this.flashTimer = 0;
    }

    getRect() {
        return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
    }

    update(dt, platforms, playerX, playerY) {
        this.animTime += dt;
        this.flashTimer = Math.max(0, this.flashTimer - dt);

        if (this.dead) {
            this.deathTimer += dt;
            if (this.deathTimer > 2) return false;
            // 死亡爆炸
            if (Math.random() < 0.3) {
                Particles.spawnExplosion(
                    this.x + Utils.rand(-30, 30),
                    this.y - Utils.rand(0, this.h)
                );
            }
            return true;
        }

        // 入场动画
        if (!this.entranceDone) {
            this.entranceTimer += dt;
            if (this.entranceTimer > 1.5) this.entranceDone = true;
            return true;
        }

        const distToPlayer = Utils.dist(this.x, this.y, playerX, playerY);
        this.facing = playerX > this.x ? 1 : -1;

        // 阶段转换
        const healthRatio = this.health / this.maxHealth;
        if (healthRatio < 0.3 && this.phase < 2) {
            this.phase = 2;
            this.speed *= 1.3;
            Particles.spawnExplosion(this.x, this.y - this.h / 2);
            Audio.play('bossPhase');
        } else if (healthRatio < 0.6 && this.phase < 1) {
            this.phase = 1;
            Particles.spawnSparks(this.x, this.y - this.h / 2, 15);
            Audio.play('bossPhase');
        }

        // 攻击逻辑
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        this.attackTimer += dt;

        if (this.attackCooldown <= 0) {
            this.executeAttack(playerX, playerY, distToPlayer);
        }

        // 移动（追踪玩家）
        if (distToPlayer > 80) {
            const dir = playerX > this.x ? 1 : -1;
            this.vx = dir * this.speed * (1 + this.phase * 0.2);
        } else {
            this.vx *= 0.8;
        }

        // 断层检测：前瞻250px寻找立足平台
        let hasGroundAhead = false;
        let gapJumpTarget = null;
        let closestForwardDist = Infinity;
        const lookStart = this.x + this.facing * (this.w / 2 + 5);

        for (const p of platforms) {
            // 正下方是否有立足点
            if (lookStart >= p.x && lookStart <= p.x + p.w && Math.abs(this.y - p.y) < 20) {
                hasGroundAhead = true;
            }
            // 前方是否有平台（跳跃可达高度内）
            if (this.facing === 1 ? p.x > this.x : p.x + p.w < this.x) {
                const pCenter = p.x + p.w / 2;
                const d = Math.abs(pCenter - this.x);
                if (d < 350 && d < closestForwardDist && Math.abs(p.y - this.y) < 200) {
                    // 判断这个平台能不能跳上去：dy ≥ 0 更好（在下方），dy < 0 需要足够的vy
                    const dy = p.y - this.y;
                    const jumpTime = d / (this.speed * 1.2); // 预估飞行时间
                    const needVy = (dy - 0.5 * this.gravity * jumpTime * jumpTime) / jumpTime;
                    if (needVy > -700) { // 在 Boss 跳跃能力内
                        closestForwardDist = d;
                        gapJumpTarget = p;
                    }
                }
            }
        }

        // 前方有断层：智能跳跃
        if (!hasGroundAhead && this.onGround && gapJumpTarget) {
            const targetX = gapJumpTarget.x + gapJumpTarget.w / 2;
            const dx = targetX - this.x;
            const dy = gapJumpTarget.y - this.y;
            const jumpSpeed = this.speed * 1.4;
            const flightTime = Math.abs(dx) / jumpSpeed;
            const clampedTime = Math.min(flightTime, 1.3);
            const targetVy = (dy - 0.5 * this.gravity * clampedTime * clampedTime) / clampedTime;
            this.vy = Math.min(targetVy, -350); // 至少跳350像素/秒
            this.vx = Math.sign(dx) * jumpSpeed;
            this.onGround = false;
            this.facing = Math.sign(dx) || this.facing;
        } else if (!hasGroundAhead && this.onGround && !gapJumpTarget) {
            // 前方无任何平台可达：急刹车转向
            this.vx *= -0.5;
            this.facing *= -1;
        }

        // 物理（Boss 有更强的空中控制）
        this.vy += this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // 平台碰撞
        this.onGround = false;
        const halfW = this.w / 2;
        const prevFeetY = this.y - this.vy * dt;
        for (const p of platforms) {
            if (this.x + halfW > p.x && this.x - halfW < p.x + p.w) {
                if (this.vy >= 0 && prevFeetY <= p.y + 6 && this.y >= p.y - 2) {
                    this.y = p.y;
                    this.vy = 0;
                    this.onGround = true;
                    this.x += p._dx || 0;
                    break;
                }
                if (this.vy >= 0 && Math.abs(this.y - p.y) <= 6) {
                    this.y = p.y;
                    this.vy = 0;
                    this.onGround = true;
                    this.x += p._dx || 0;
                    break;
                }
            }
        }

        // Boss 跌落恢复：寻找最近可达平台（不限于地面）
        if (this.y > 600) {
            let bestPlatform = null;
            let bestScore = Infinity;
            for (const p of platforms) {
                const d = Math.abs(this.x - (p.x + p.w / 2));
                const heightDiff = Math.abs(p.y - this.y);
                // 优先距离近 + 高度差小的，且平台在 Boss 前方
                const score = d * 0.7 + heightDiff * 0.3
                    + (this.facing === 1 && p.x + p.w / 2 < this.x ? 200 : 0)
                    + (this.facing === -1 && p.x + p.w / 2 > this.x ? 200 : 0);
                if (d < 500 && score < bestScore) {
                    bestScore = score;
                    bestPlatform = p;
                }
            }
            if (bestPlatform) {
                this.x = Utils.clamp(this.x, bestPlatform.x + 20, bestPlatform.x + bestPlatform.w - 20);
                this.y = bestPlatform.y - 5;
                this.vy = 0;
                this.vx = 0;
                this.facing = playerX > this.x ? 1 : -1;
            } else {
                this.x = playerX + (this.facing * -150);
                this.y = 400;
                this.vy = 0;
                this.vx = 0;
            }
            Particles.spawnExplosion(this.x, this.y - this.h / 2);
            Audio.play('bossSpecial');
            Renderer.shake(5, 0.2);
        }

        // 更新子弹
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0) this.bullets.splice(i, 1);
        }

        // 护盾
        if (this.shieldTimer > 0) {
            this.shieldTimer -= dt;
            this.shieldActive = this.shieldTimer > 0;
        }

        return true;
    }

    executeAttack(px, py, dist) {
        // 根据阶段扩充可用技能池
        let pool = [...this.abilities];
        if (this.phase >= 1 && !pool.includes('spread')) pool.push('spread');
        if (this.phase >= 2 && !pool.includes('special')) pool.push('special');
        const pattern = pool[Utils.randInt(0, pool.length - 1)];

        switch (pattern) {
            case 'melee':
                if (dist < 120) {
                    this.attackCooldown = 0.8 - this.phase * 0.15;
                } else {
                    this.attackCooldown = 0.3;
                }
                break;
            case 'shoot':
                this.shootAt(px, py);
                this.attackCooldown = 1.0 - this.phase * 0.2;
                break;
            case 'spread':
                this.spreadShoot(px, py);
                this.attackCooldown = 1.5 - this.phase * 0.2;
                break;
            case 'special':
                this.specialAttack(px, py);
                Audio.play('bossSpecial');
                this.attackCooldown = 2.0;
                break;
        }
    }

    shootAt(tx, ty) {
        const angle = Utils.angle(this.x, this.y - this.h / 2, tx, ty);
        const spd = 350 + this.phase * 50;
        this.bullets.push({
            x: this.x, y: this.y - this.h / 2,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            damage: this.damage * 0.5,
            life: 4, size: 5,
            color: this.color,
        });
    }

    spreadShoot(tx, ty) {
        const baseAngle = Utils.angle(this.x, this.y - this.h / 2, tx, ty);
        const count = 3 + this.phase * 2;
        const spread = 0.4 + this.phase * 0.1;
        for (let i = 0; i < count; i++) {
            const a = baseAngle - spread + (spread * 2 * i / (count - 1));
            this.bullets.push({
                x: this.x, y: this.y - this.h / 2,
                vx: Math.cos(a) * 300,
                vy: Math.sin(a) * 300,
                damage: this.damage * 0.4,
                life: 3, size: 4,
                color: this.color,
            });
        }
        Audio.play('shotgun');
    }

    specialAttack(px, py) {
        // 环形弹幕
        const count = 12 + this.phase * 4;
        for (let i = 0; i < count; i++) {
            const a = (Math.PI * 2 * i) / count;
            this.bullets.push({
                x: this.x, y: this.y - this.h / 2,
                vx: Math.cos(a) * 250,
                vy: Math.sin(a) * 250,
                damage: this.damage * 0.3,
                life: 4, size: 4,
                color: '#ff0000',
            });
        }
        Audio.play('explode');
    }

    takeDamage(amount) {
        if (this.dead) return;
        if (this.shieldActive) amount *= 0.2;
        this.health -= amount;
        this.flashTimer = 0.1;
        Particles.spawnBlood(this.x, this.y - this.h / 2, 3);
        if (this.health <= 0) {
            this.health = 0;
            this.dead = true;
            this.deathTimer = 0;
            Audio.play('bossDeath');
            if (this.level === 1) {
                Audio.stopBgm();
                Audio.setMasterGainBoost(3);
                Audio.playMp3('bossExplode');
                setTimeout(function() {
                    Audio.restoreMasterGain();
                }, 3000);
            }
            Particles.spawnExplosion(this.x, this.y - this.h / 2);
        }
    }

    draw(ctx) {
        const sx = this.x - Utils.camera.x;
        const sy = this.y - Utils.camera.y;

        // 死亡动画（增强版）
        if (this.dead) {
            const alpha = 1 - this.deathTimer / 2;
            ctx.globalAlpha = alpha;
            // 震动效果
            const shake = Math.sin(this.deathTimer * 30) * 5;
            ctx.translate(shake, shake);
            // 连续爆炸效果
            if (this.deathTimer < 1.5) {
                const explodeCount = Math.floor(this.deathTimer * 4);
                for (let i = 0; i < explodeCount; i++) {
                    const ex = sx + Math.sin(this.deathTimer * 10 + i * 2) * 30;
                    const ey = sy - this.h / 2 + Math.cos(this.deathTimer * 8 + i * 1.5) * 25;
                    ctx.beginPath();
                    const r = 10 + Math.sin(this.deathTimer * 15 + i) * 5;
                    const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, r);
                    g.addColorStop(0, 'rgba(255, 200, 50, 0.9)');
                    g.addColorStop(0.5, 'rgba(255, 100, 0, 0.6)');
                    g.addColorStop(1, 'transparent');
                    ctx.fillStyle = g;
                    ctx.arc(ex, ey, r, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // 入场动画
        let scale = 1;
        if (!this.entranceDone) {
            scale = Math.min(this.entranceTimer / 1.5, 1);
            ctx.globalAlpha = scale;
        }

        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(scale, scale);

        // 脚下阴影
        if (this.onGround) {
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.ellipse(0, 1, this.w * 0.6, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 阶段发光 — 大范围脉冲（增强版）
        if (this.phase > 0) {
            const pulse = 0.7 + Math.sin(this.animTime * (3 + this.phase)) * 0.3;
            const glowSize = 45 + this.phase * 20;
            const g = ctx.createRadialGradient(0, -this.h / 2, 0, 0, -this.h / 2, glowSize);
            g.addColorStop(0, this.color + Math.floor(pulse * 80).toString(16).padStart(2, '0'));
            g.addColorStop(0.4, this.color + '30');
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, -this.h / 2, glowSize, 0, Math.PI * 2);
            ctx.fill();

            // 阶段2：环绕能量环
            if (this.phase >= 2) {
                const ringCount = 8;
                for (let i = 0; i < ringCount; i++) {
                    const a = this.animTime * 2.5 + (Math.PI * 2 * i) / ringCount;
                    const rx = Math.cos(a) * (glowSize * 0.5);
                    const ry = Math.sin(a) * (glowSize * 0.5) - this.h / 2;
                    const particleSize = 3 + Math.sin(this.animTime * 6 + i) * 1.5;
                    ctx.fillStyle = this.color;
                    ctx.shadowColor = this.color;
                    ctx.shadowBlur = 6;
                    ctx.beginPath();
                    ctx.arc(rx, ry, particleSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }
        }

        ctx.scale(this.facing, 1);

        // 受伤闪烁
        const bodyColor = this.flashTimer > 0 ? '#fff' : this.color;
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        // 头部护甲（根据等级变化）
        const headRadius = 12 + this.level;
        ctx.beginPath();
        ctx.arc(0, -this.h + 12, headRadius + 2, -Math.PI * 0.7, Math.PI * 0.7);
        ctx.strokeStyle = bodyColor === '#fff' ? '#ddd' : '#556677';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 头 — 填充 + 边框
        ctx.beginPath();
        ctx.arc(0, -this.h + 12, headRadius, 0, Math.PI * 2);
        const bossHG = ctx.createRadialGradient(-3, -this.h + 9, 3, 0, -this.h + 12, headRadius);
        bossHG.addColorStop(0, '#fff');
        bossHG.addColorStop(0.5, bodyColor === '#fff' ? '#ddd' : this.color);
        bossHG.addColorStop(1, '#222');
        ctx.fillStyle = bossHG;
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 角/王冠（根据等级增强）
        if (this.level >= 2) {
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 3;
            const hornLen = 10 + this.level * 2;
            ctx.beginPath();
            ctx.moveTo(-8, -this.h + 3);
            ctx.lineTo(-12, -this.h - hornLen);
            ctx.lineTo(-4, -this.h + 1);
            ctx.moveTo(8, -this.h + 3);
            ctx.lineTo(12, -this.h - hornLen);
            ctx.lineTo(4, -this.h + 1);
            ctx.stroke();
            // 角尖发光
            ctx.fillStyle = '#f1c40f';
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(-12, -this.h - hornLen, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(12, -this.h - hornLen, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // 眼睛（更霸气）
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 4;
        const eyeGlow = Math.sin(this.animTime * 5) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 0, 0, ${0.7 + eyeGlow * 0.3})`;
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 6 + this.phase * 2;
        ctx.beginPath();
        ctx.arc(5, -this.h + 10, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 身干（加粗）
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, -this.h + 24);
        ctx.lineTo(0, -this.h + 55);
        ctx.stroke();
        // 胸甲纹路
        ctx.strokeStyle = bodyColor === '#fff' ? '#ddd' : '#445566';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, -this.h + 30);
        ctx.lineTo(6, -this.h + 30);
        ctx.moveTo(-5, -this.h + 38);
        ctx.lineTo(5, -this.h + 38);
        ctx.stroke();

        // 腿（更粗）
        const legAnim = Math.sin(this.animTime * 6) * 15;
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, -this.h + 55);
        ctx.lineTo(legAnim, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -this.h + 55);
        ctx.lineTo(-legAnim, 0);
        ctx.stroke();

        // 手臂（更强壮）
        const armAnim = Math.sin(this.animTime * 4) * 0.5;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, -this.h + 35);
        ctx.lineTo(20, -this.h + 30 + Math.sin(armAnim) * 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -this.h + 35);
        ctx.lineTo(-18, -this.h + 40);
        ctx.stroke();
        // 拳头
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(20, -this.h + 30 + Math.sin(armAnim) * 10, 4, 0, Math.PI * 2);
        ctx.fill();

        // 护盾（增强版）
        if (this.shieldActive) {
            const shieldPulse = 0.4 + Math.sin(this.animTime * 10) * 0.2;
            ctx.beginPath();
            ctx.arc(0, -this.h / 2, this.w + 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(100, 200, 255, ${shieldPulse})`;
            ctx.lineWidth = 3;
            ctx.stroke();
            // 护盾能量环
            for (let i = 0; i < 6; i++) {
                const a = this.animTime * 3 + (Math.PI * 2 * i) / 6;
                const sx2 = Math.cos(a) * (this.w + 8);
                const sy2 = Math.sin(a) * (this.w + 8) - this.h / 2;
                ctx.fillStyle = `rgba(150, 220, 255, ${shieldPulse * 0.8})`;
                ctx.beginPath();
                ctx.arc(sx2, sy2, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
        ctx.globalAlpha = 1;

        // 子弹（增强版）
        for (const b of this.bullets) {
            const bx = b.x - Utils.camera.x;
            const by = b.y - Utils.camera.y;
            const bulletColor = b.color || this.color;
            // 子弹主体
            ctx.beginPath();
            ctx.arc(bx, by, b.size, 0, Math.PI * 2);
            ctx.fillStyle = bulletColor;
            ctx.fill();
            // 子弹发光
            ctx.beginPath();
            ctx.arc(bx, by, b.size * 2.5, 0, Math.PI * 2);
            const g2 = ctx.createRadialGradient(bx, by, 0, bx, by, b.size * 2.5);
            g2.addColorStop(0, bulletColor + '60');
            g2.addColorStop(1, 'transparent');
            ctx.fillStyle = g2;
            ctx.fill();
            // 子弹尾迹
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - b.vx * 0.03, by - b.vy * 0.03);
            ctx.strokeStyle = bulletColor + '40';
            ctx.lineWidth = b.size * 0.8;
            ctx.stroke();
        }
    }
}
