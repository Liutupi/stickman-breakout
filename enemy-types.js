// 新兵种使用独立、基于时间的状态机；所有攻击都有可读前摇。
const EnemyVariants = (() => {
    const names = { lancer: '突击枪兵', scattergun: '散弹兵', medic: '战地医师', sentinel: '棱镜哨兵', swarm: '蜂群无人机', gunship: '空中炮艇', diver: '俯冲雷鹰' };
    const AIR = new Set(['swarm', 'gunship', 'diver']);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // ---------- 空中新兵种 ----------
    // 蜂群无人机：成群绕着玩家飞，闪红 0.45 秒后直线俯冲撞人，撞完拉回高空（散弹枪克制）
    // 空中炮艇：高空悬停，保持在玩家 360 像素外；扇形连射，每第三轮改为投弹（逼玩家靠近/用远程武器）
    // 俯冲雷鹰：高空盘旋，锁定时画出红色俯冲线（最后 0.3 秒不再跟踪），然后高速直线俯冲（冲刺/跳开躲避）
    function updateAir(e, dt, px, py, dx, dist, active, dir) {
        if (e.phase === undefined) { e.phase = Math.random() * Math.PI * 2; e.homeX = e.x; e.side = Math.random() < 0.5 ? -1 : 1; e.state = 'hover'; }
        const bob = (amp, sp) => e.baseY + Math.sin(e.animTime * sp + e.phase) * amp;
        if (e.type === 'swarm') {
            if (e.state === 'dive') {
                e.diveT -= dt;
                if (e.diveT <= 0 || e.y > py + 40) e.state = 'return';
            } else if (e.state === 'return') {
                e.vy = -e.speed * 1.6; e.vx *= 0.92;
                if (e.y <= e.baseY + 10) { e.state = 'hover'; e.attackCooldown = e.attackRate + Math.random() * 1.2; }
            } else if (e.state === 'tele') {
                e.vx *= 0.85; e.vy *= 0.85;
                e.telegraph += dt;
                if (e.telegraph >= 0.45) {
                    const a = Math.atan2(py - 30 - (e.y - e.h / 2), dx);
                    e.vx = Math.cos(a) * 470; e.vy = Math.sin(a) * 470;
                    e.diveT = 0.6; e.state = 'dive'; e.telegraph = 0;
                    Audio.play('dash');
                }
            } else {
                const tx = active ? px + Math.cos(e.animTime * 1.6 + e.phase) * 150 : e.homeX + Math.cos(e.animTime + e.phase) * 70;
                const ty = bob(36, 2.3);
                e.vx = clamp((tx - e.x) * 2.2, -e.speed * 1.6, e.speed * 1.6);
                e.vy = clamp((ty - e.y) * 3, -e.speed, e.speed);
                if (active && e.attackCooldown <= 0 && dist < 430) { e.state = 'tele'; e.telegraph = dt; }
            }
            e.facing = e.vx >= 0 ? 1 : -1;
            return;
        }
        if (e.type === 'gunship') {
            e.facing = dir;
            const tx = active ? px - dir * 360 : e.homeX + Math.sin(e.animTime * 0.5 + e.phase) * 120;
            e.vx = clamp((tx - e.x) * 1.2, -e.speed, e.speed);
            e.vy = (bob(14, 1.3) - e.y) * 3;
            if (active && e.attackCooldown <= 0) {
                e.telegraph = (e.telegraph || 0) + dt;
                if (e.telegraph >= 0.7) {
                    e.volley = (e.volley || 0) + 1;
                    const ox = e.x + dir * 22, oy = e.y - e.h * 0.3;
                    if (e.volley % 3 === 0) {
                        for (let i = -1; i <= 1; i++) {
                            e.bullets.push({ x: e.x + i * 18, y: e.y - 4, vx: dir * 70 + i * 40, vy: 30, gravity: 650,
                                size: 6, damage: e.damage * 1.3, life: 2.4, bomb: true });
                        }
                        Audio.play('throw');
                    } else {
                        const a0 = Math.atan2(py - 26 - oy, px - ox);
                        for (let i = -2; i <= 2; i++) {
                            const a = a0 + i * 0.13;
                            e.bullets.push({ x: ox, y: oy, vx: Math.cos(a) * e.bulletSpeed, vy: Math.sin(a) * e.bulletSpeed,
                                size: 3.5, damage: e.damage * 0.55, life: 2.2 });
                        }
                        Audio.play('enemyShoot');
                    }
                    e.telegraph = 0; e.attackCooldown = e.attackRate;
                }
            } else e.telegraph = 0;
            return;
        }
        if (e.type === 'diver') {
            if (e.state === 'aim') {
                e.vx *= 0.9; e.vy = (e.baseY - 10 - e.y) * 3;
                e.telegraph += dt;
                if (e.telegraph < 0.5) { e.lockX = px; e.lockY = py - 28; }   // 前 0.5 秒跟踪，之后锁死给玩家反应
                e.facing = e.lockX >= e.x ? 1 : -1;
                if (e.telegraph >= 0.8) {
                    const a = Math.atan2(e.lockY - (e.y - e.h / 2), e.lockX - e.x);
                    e.vx = Math.cos(a) * 680; e.vy = Math.sin(a) * 680;
                    e.diveT = 1.0; e.state = 'dive'; e.telegraph = 0;
                    Audio.play('dash');
                }
            } else if (e.state === 'dive') {
                e.diveT -= dt;
                e.facing = e.vx >= 0 ? 1 : -1;
                if (e.diveT <= 0 || e.y > e.lockY + 90) e.state = 'recover';
            } else if (e.state === 'recover') {
                e.vy = -280; e.vx *= 0.95;
                if (e.y <= e.baseY) { e.state = 'hover'; e.attackCooldown = e.attackRate; e.side *= -1; }
            } else {
                const tx = active ? px + e.side * 230 : e.homeX + Math.sin(e.animTime * 0.7 + e.phase) * 90;
                e.vx = clamp((tx - e.x) * 1.5, -e.speed * 1.5, e.speed * 1.5);
                e.vy = (bob(18, 2) - e.y) * 4;
                e.facing = dir;
                if (active && e.attackCooldown <= 0 && dist < 640) { e.state = 'aim'; e.telegraph = 0; e.lockX = px; e.lockY = py - 28; }
            }
        }
    }

    function update(e, dt, platforms, px, py, allies) {
        if (!names[e.type]) return false;
        e.signal = Math.max(0, (e.signal || 0) - dt);
        const dx = px - e.x, dist = Math.hypot(dx, py - e.y);
        const active = dist < e.aggroRange;
        const dir = dx >= 0 ? 1 : -1;
        if (AIR.has(e.type)) { updateAir(e, dt, px, py, dx, dist, active, dir); return true; }
        if (e.type === 'sentinel') {
            e.facing = dir;
            e.vx = active && Math.abs(dx) > 290 ? dir * e.speed : 0;
            e.vy = (e.baseY + Math.sin(e.animTime * 2) * 22 - e.y) * 4;
            if (active && e.attackCooldown <= 0) {
                e.telegraph = (e.telegraph || 0) + dt;
                if (e.telegraph >= 0.85) {
                    e.shoot(px, py - 24, { speed: e.bulletSpeed });
                    e.burstLeft = 2; e.burstTimer = 0.18;
                    e.telegraph = 0; e.attackCooldown = e.attackRate;
                }
            } else e.telegraph = 0;
            if (e.burstLeft > 0) {
                e.burstTimer -= dt;
                if (e.burstTimer <= 0) {
                    e.shoot(px, py - 24, { speed: e.bulletSpeed });
                    e.burstLeft--; e.burstTimer += 0.18;
                }
            }
            return true;
        }
        if (e.type === 'lancer') {
            if (e.chargeLeft > 0) {
                e.chargeLeft -= dt; e.vx = e.chargeDir * 430;
                if (e.chargeLeft <= 0) { e.vx = 0; e.attackCooldown = e.attackRate; }
            } else if (e.telegraph > 0) {
                e.vx = 0; e.telegraph += dt;
                if (e.telegraph >= 0.75) {
                    e.telegraph = 0; e.chargeLeft = 0.42; e.vx = e.chargeDir * 430;
                }
            } else {
                e.facing = dir;
                e.vx = active && dist > 310 ? dir * e.speed : 0;
                if (active && Math.abs(py - e.y) < 80 && dist < 360 && e.attackCooldown <= 0) {
                    e.chargeDir = dir; e.telegraph = dt;
                }
            }
        } else if (e.type === 'scattergun') {
            e.facing = dir;
            e.vx = active ? (dist < 170 ? -dir * e.speed : dist > 300 ? dir * e.speed : 0) : 0;
            if (active && e.attackCooldown <= 0) {
                e.vx = 0; e.telegraph = (e.telegraph || 0) + dt;
                if (e.telegraph >= 0.8) {
                    const angle = Math.atan2(py - 24 - (e.y - e.h / 2), dx);
                    for (let i = -2; i <= 2; i++) {
                        const a = angle + i * 0.16;
                        e.bullets.push({ x: e.x, y: e.y - e.h / 2, vx: Math.cos(a) * e.bulletSpeed,
                            vy: Math.sin(a) * e.bulletSpeed, size: 3, damage: e.damage * 0.42, life: 1.15 });
                    }
                    Audio.play('enemyShoot'); e.telegraph = 0; e.attackCooldown = e.attackRate;
                }
            } else e.telegraph = 0;
        } else if (e.type === 'medic') {
            e.facing = dir;
            e.vx = active && dist < 200 ? -dir * e.speed : 0;
            e.healCooldown = (e.healCooldown === undefined ? 2 : e.healCooldown) - dt;
            if (active && e.healCooldown <= 0) {
                let healed = false;
                for (const ally of allies || []) {
                    if (ally === e || ally.dead || ally.health >= ally.maxHealth || Math.hypot(ally.x - e.x, ally.y - e.y) > 230) continue;
                    ally.health = Math.min(ally.maxHealth, ally.health + ally.maxHealth * 0.12);
                    healed = true;
                }
                if (healed) { e.signal = 0.7; Particles.spawnAmmoText(e.x, e.y - e.h - 12, '治疗脉冲', '#67efbb'); }
                e.healCooldown = 4.5;
            }
            if (active && e.attackCooldown <= 0) {
                e.shoot(px, py - 22, { speed: 230 }); e.attackCooldown = e.attackRate;
            }
        }
        // 地面新兵种会在悬崖前刹车，冲锋也不会无提示自杀。
        if (e.onGround && e.vx) {
            const ahead = e.x + Math.sign(e.vx) * (e.w / 2 + 24);
            if (!platforms.some(p => ahead > p.x && ahead < p.x + p.w && Math.abs(p.y - e.y) < 14)) {
                e.vx = 0;
                if (e.chargeLeft > 0) { e.chargeLeft = 0; e.attackCooldown = e.attackRate; }
            }
        }
        return true;
    }

    function drawAir(ctx, e, color) {
        ctx.save();
        // 俯冲雷鹰的预警线（世界坐标换算到以敌人脚底为原点）
        if (e.type === 'diver' && e.state === 'aim') {
            const lx = e.lockX - e.x, ly = e.lockY - e.y, oy = -e.h / 2;
            const locked = e.telegraph >= 0.5;
            ctx.strokeStyle = locked ? 'rgba(255,60,60,0.85)' : 'rgba(255,120,120,0.45)';
            ctx.lineWidth = locked ? 3 : 1.5;
            ctx.setLineDash(locked ? [] : [8, 6]);
            const ex = lx + (lx) * 0.25, ey = ly + (ly - oy) * 0.25;
            ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(lx, ly, 10 + Math.sin(e.animTime * 20) * 3, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.scale(e.facing, 1);
        if (e.type === 'swarm') {
            const tele = e.state === 'tele';
            const blink = tele && Math.sin(e.animTime * 40) > 0;
            const c = blink ? '#ff4040' : color;
            ctx.translate(0, -e.h / 2);
            ctx.rotate(clamp(e.vy / 900, -0.6, 0.6));
            ctx.scale(1.45, 1.45);
            ctx.fillStyle = tele ? 'rgba(255,60,60,0.25)' : 'rgba(255,209,102,0.16)';
            ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1b2333'; ctx.strokeStyle = c; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.globalAlpha = 0.55;
            const flap = Math.sin(e.animTime * 50) * 3;
            ctx.fillStyle = c;
            ctx.beginPath(); ctx.ellipse(-3, -6 - flap * 0.3, 7, 2 + Math.abs(flap) * 0.4, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = c; ctx.beginPath(); ctx.arc(6, 0, 2.4, 0, Math.PI * 2); ctx.fill();
            if (e.state === 'dive') { ctx.strokeStyle = 'rgba(255,200,80,0.6)'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-26, 0); ctx.stroke(); }
        } else if (e.type === 'gunship') {
            ctx.translate(0, -e.h / 2);
            ctx.rotate(clamp(e.vx / 600, -0.12, 0.12) * e.facing);
            // 机身
            ctx.fillStyle = '#18233a'; ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-36, -4); ctx.lineTo(-18, -16); ctx.lineTo(26, -14); ctx.lineTo(38, -2); ctx.lineTo(24, 12); ctx.lineTo(-28, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = color; ctx.globalAlpha = 0.85; ctx.fillRect(8, -10, 16, 5); ctx.globalAlpha = 1;
            // 旋翼
            ctx.strokeStyle = 'rgba(200,230,255,0.55)'; ctx.lineWidth = 2;
            const r = Math.sin(e.animTime * 60) * 30;
            ctx.beginPath(); ctx.moveTo(-r, -22); ctx.lineTo(r, -22); ctx.stroke();
            ctx.fillStyle = '#2b3a55'; ctx.fillRect(-3, -22, 6, 7);
            // 机炮与吊舱
            ctx.fillStyle = '#9fb3c8'; ctx.fillRect(28, 4, 16, 4);
            ctx.fillStyle = '#2b3a55'; ctx.fillRect(-14, 10, 20, 6);
            if (e.telegraph > 0) {
                ctx.fillStyle = `rgba(255,80,80,${0.4 + e.telegraph * 0.8})`;
                ctx.beginPath(); ctx.arc(44, 6, 4 + e.telegraph * 6, 0, Math.PI * 2); ctx.fill();
            }
            // 血条
            ctx.rotate(0);
        } else if (e.type === 'diver') {
            ctx.translate(0, -e.h / 2);
            const diving = e.state === 'dive';
            ctx.rotate(diving ? Math.atan2(e.vy, Math.abs(e.vx)) : Math.sin(e.animTime * 3) * 0.08);
            const wing = diving ? 4 : 10 + Math.sin(e.animTime * 14) * 6;
            ctx.fillStyle = '#241826'; ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-8, -wing); ctx.lineTo(-16, 0); ctx.lineTo(-8, wing); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(10, -3); ctx.lineTo(10, 3); ctx.closePath(); ctx.fill();
            ctx.fillStyle = e.state === 'aim' ? '#ff4040' : '#ffd166'; ctx.beginPath(); ctx.arc(8, -1, 2.2, 0, Math.PI * 2); ctx.fill();
            if (diving) { ctx.strokeStyle = 'rgba(255,120,120,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-44, 0); ctx.stroke(); }
        }
        ctx.restore();
        if (e.type !== 'swarm') {
            ctx.save(); ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillStyle = color; ctx.fillText(names[e.type], 0, -e.h - (e.type === 'gunship' ? 22 : 12)); ctx.restore();
        }
        // 炮艇血条（血厚，需要让玩家看到进度）
        if (e.type === 'gunship' && e.health < e.maxHealth) {
            const w = 56, p = Math.max(0, e.health / e.maxHealth);
            ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-w / 2, -e.h - 18, w, 4);
            ctx.fillStyle = '#7cc4ff'; ctx.fillRect(-w / 2, -e.h - 18, w * p, 4); ctx.restore();
        }
        return true;
    }

    function draw(ctx, e) {
        if (!names[e.type]) return false;
        const color = e.hitFlashTimer > 0 ? '#ffffff' : e.color;
        if (AIR.has(e.type)) return drawAir(ctx, e, color);
        ctx.save();
        if (e.signal > 0) {
            ctx.strokeStyle = `rgba(103,239,187,${e.signal})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(0, -8, (0.7 - e.signal) * 330, (0.7 - e.signal) * 80, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.scale(e.facing, 1);
        ctx.lineCap = 'round';
        if (e.type === 'sentinel') {
            ctx.rotate(Math.sin(e.animTime * 2) * 0.08);
            ctx.fillStyle = '#172338'; ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-23, -18); ctx.lineTo(0, -34); ctx.lineTo(23, -18); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
            for (const s of [-1, 1]) {
                ctx.fillStyle = '#354160'; ctx.fillRect(s * 22 - 9, -23, 18, 7);
                ctx.fillStyle = color; ctx.fillRect(s * 22 - 8, -25, 16, 2);
            }
            ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(0, -19, 5 + (e.telegraph || 0) * 5, 0, Math.PI * 2); ctx.fill();
        } else {
            const step = Math.sin(e.animTime * 9) * Math.min(9, Math.abs(e.vx) * 0.1);
            ctx.strokeStyle = '#111b29'; ctx.lineWidth = 7;
            ctx.beginPath(); ctx.moveTo(-step, 0); ctx.lineTo(-6, -15); ctx.lineTo(0, -25); ctx.lineTo(6, -15); ctx.lineTo(step + 3, 0); ctx.stroke();
            ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-step, -2); ctx.lineTo(-5, -14); ctx.moveTo(step + 3, -2); ctx.lineTo(5, -14); ctx.stroke();
            ctx.fillStyle = '#253047'; ctx.fillRect(-10, -38, 20, 17);
            ctx.fillStyle = color; ctx.fillRect(-10, -37, 20, 3);
            ctx.fillStyle = '#111c2a'; ctx.strokeStyle = color;
            ctx.beginPath(); ctx.arc(0, -e.h + 6, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = color; ctx.fillRect(1, -e.h + 4, 9, 3);
            if (e.type === 'lancer') {
                ctx.strokeStyle = '#98a9bd'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(-13, -26); ctx.lineTo(36, -26); ctx.stroke();
                ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(46, -26); ctx.lineTo(30, -32); ctx.lineTo(30, -20); ctx.closePath(); ctx.fill();
                if (e.telegraph > 0 || e.chargeLeft > 0) {
                    ctx.globalAlpha = 0.4 + Math.sin(e.animTime * 22) * 0.2;
                    ctx.fillRect(8, -3, 180, 3);
                    ctx.beginPath(); ctx.moveTo(194, -2); ctx.lineTo(177, -10); ctx.lineTo(177, 6); ctx.closePath(); ctx.fill();
                }
            } else if (e.type === 'scattergun') {
                ctx.fillStyle = '#151d2b'; ctx.fillRect(5, -31, 27, 9);
                ctx.fillStyle = color; ctx.fillRect(29, -32, 5, 11);
                for (let i = 0; i < 3; i++) ctx.fillRect(-13 + i * 4, -33, 2, 9);
                if (e.telegraph > 0) {
                    ctx.strokeStyle = color; ctx.globalAlpha = 0.25 + e.telegraph * 0.5; ctx.lineWidth = 1;
                    for (const a of [-0.32, 0, 0.32]) { ctx.beginPath(); ctx.moveTo(32, -27); ctx.lineTo(32 + Math.cos(a) * 170, -27 + Math.sin(a) * 170); ctx.stroke(); }
                }
            } else {
                ctx.fillStyle = '#174b44'; ctx.fillRect(-19, -38, 10, 22);
                ctx.fillStyle = color; ctx.fillRect(-17, -30, 6, 3); ctx.fillRect(-15, -32, 2, 7);
                ctx.fillRect(-3, -34, 6, 3); ctx.fillRect(-1, -36, 2, 7);
                ctx.fillStyle = '#9baeb9'; ctx.fillRect(10, -28, 15, 5);
            }
        }
        ctx.restore();
        ctx.save(); ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = color; ctx.fillText(names[e.type], 0, -e.h - 15); ctx.restore();
        return true;
    }
    function drawSignals(ctx, e) {
        ctx.save();
        if (names[e.type]) {
            ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = e.color;
            ctx.fillText(names[e.type], 0, -e.h - 9);
        }
        if (e.signal > 0) {
            ctx.strokeStyle = `rgba(103,239,187,${e.signal})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(0, -8, (0.7 - e.signal) * 330, (0.7 - e.signal) * 80, 0, 0, Math.PI * 2); ctx.stroke();
        }
        if (e.type === 'shielder' && e.shieldHP > 0) {
            ctx.strokeStyle = e.shieldFlash > 0 ? '#ffffff' : '#88d8ff'; ctx.lineWidth = 2;
            ctx.globalAlpha = 0.4 + e.shieldHP / e.maxShieldHP * 0.4;
            ctx.beginPath(); ctx.ellipse(e.facing * 15, -e.h / 2, 10, e.h * 0.55, 0, -1.3, 1.3); ctx.stroke();
        }
        if (e.type === 'kamikaze') {
            ctx.strokeStyle = '#ffac4a'; ctx.lineWidth = 2; ctx.globalAlpha = 0.4 + Math.sin(e.animTime * 12) * 0.3;
            ctx.beginPath(); ctx.arc(0, -e.h / 2, e.h * 0.6, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.scale(e.facing, 1);
        if (e.type === 'lancer' && (e.telegraph > 0 || e.chargeLeft > 0)) {
            ctx.fillStyle = '#ffbd69'; ctx.globalAlpha = 0.45 + Math.sin(e.animTime * 22) * 0.2;
            ctx.fillRect(8, -3, 180, 3);
            ctx.beginPath(); ctx.moveTo(194, -2); ctx.lineTo(177, -10); ctx.lineTo(177, 6); ctx.closePath(); ctx.fill();
        }
        if (e.type === 'scattergun' && e.telegraph > 0) {
            ctx.strokeStyle = '#ff7394'; ctx.lineWidth = 1; ctx.globalAlpha = 0.25 + e.telegraph * 0.5;
            for (const a of [-0.32, 0, 0.32]) { ctx.beginPath(); ctx.moveTo(22, -27); ctx.lineTo(22 + Math.cos(a) * 170, -27 + Math.sin(a) * 170); ctx.stroke(); }
        }
        if (e.type === 'sentinel' && e.telegraph > 0) {
            ctx.strokeStyle = '#d2aeff'; ctx.lineWidth = 2; ctx.globalAlpha = e.telegraph;
            ctx.beginPath(); ctx.arc(0, -19, 20 + e.telegraph * 12, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }
    return { update, draw, drawSignals, names, AIR };
})();
