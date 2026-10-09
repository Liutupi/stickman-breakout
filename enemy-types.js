// 新兵种使用独立、基于时间的状态机；所有攻击都有可读前摇。
const EnemyVariants = (() => {
    const names = { lancer: '突击枪兵', scattergun: '散弹兵', medic: '战地医师', sentinel: '棱镜哨兵' };
    function update(e, dt, platforms, px, py, allies) {
        if (!names[e.type]) return false;
        e.signal = Math.max(0, (e.signal || 0) - dt);
        const dx = px - e.x, dist = Math.hypot(dx, py - e.y);
        const active = dist < e.aggroRange;
        const dir = dx >= 0 ? 1 : -1;
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

    function draw(ctx, e) {
        if (!names[e.type]) return false;
        const color = e.hitFlashTimer > 0 ? '#ffffff' : e.color;
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
    return { update, draw, drawSignals, names };
})();
