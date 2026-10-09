// Boss 的动作、物理和出招共用时间轴：预备 → 出手 → 收招。
const BossMotion = (() => {
    const physical = new Set(['charge', 'shockwave', 'melee']);
    function init(b, config) {
        b.action = null;
        b.arenaMin = config.arenaMin ?? -Infinity;
        b.arenaMax = config.arenaMax ?? Infinity;
        b.motionTrail = [];
        b.attackCooldown = 0.8;
    }
    function action(b, kind, type, duration, extra = {}) {
        b.action = { kind, type, duration, elapsed: 0, ...extra };
    }
    function recover(b, duration = 0.65) {
        b.vx = 0;
        b.chargeTimer = 0;
        b.vulnerableTimer = Math.max(b.vulnerableTimer, duration);
        action(b, 'recover', 'recover', duration);
        b.attackCooldown = Math.max(b.attackCooldown, duration + 0.3);
    }
    function targetX(b, x) {
        return Utils.clamp(x, b.arenaMin + b.w / 2, b.arenaMax - b.w / 2);
    }
    function attack(b, mark) {
        b.vx = 0;
        if (mark.type === 'charge') {
            b.chargeDir = b.facing;
            b.chargeTimer = 0.62 + b.phase * 0.06;
            action(b, 'charge', mark.type, b.chargeTimer);
            Audio.play('bossSpecial');
        } else if (mark.type === 'leap_slam') {
            const flight = 1.1;
            const landingX = targetX(b, Utils.clamp(mark.x, b.x - 520, b.x + 520));
            // 弹道在起跳时确定；玩家离开标记后不会被空中追踪。
            b.vx = (landingX - b.x) / flight;
            b.vy = -b.gravity * flight / 2;
            b.onGround = false;
            action(b, 'leap', mark.type, 2, { landingX, landingY: b.y });
            Audio.play('bossSpecial');
        } else if (mark.type === 'teleport') {
            action(b, 'blink', mark.type, 0.46, { mark, released: false });
        } else {
            action(b, physical.has(mark.type) ? 'strike' : 'cast', mark.type, 0.52,
                { mark, released: false });
        }
    }
    function advanceAction(b, dt, px, py) {
        const a = b.action;
        if (!a) return;
        a.elapsed += dt;
        if (a.kind === 'charge') {
            b.chargeTimer = Math.max(0, a.duration - a.elapsed);
            b.vx = b.chargeDir * b.speed * (4.2 + b.phase * 0.35);
            if (a.elapsed >= a.duration) {
                b.stunTimer = 0.7;
                recover(b, 0.9);
                Renderer.shake(5, 0.15);
            }
        } else if (a.kind === 'blink') {
            b.vx = 0;
            if (!a.released && a.elapsed >= 0.23) {
                a.released = true;
                Particles.spawn(b.x, b.y - b.h / 2, 12, b.accentColor, 160, 0.35);
                b.x = targetX(b, a.mark.x + b.facing * 165);
                b.facing = a.mark.x > b.x ? 1 : -1;
                Particles.spawn(b.x, b.y - b.h / 2, 18, b.accentColor, 200, 0.45);
                Audio.play('dash');
            }
            if (a.elapsed >= a.duration) recover(b, 0.55);
        } else if (a.kind === 'strike' || a.kind === 'cast') {
            b.vx = 0;
            if (!a.released && a.elapsed >= 0.17) {
                a.released = true;
                b.releaseAttack(a.mark, a.mark.x, a.mark.y);
            }
            if (a.elapsed >= a.duration) recover(b, 0.55 - b.phase * 0.06);
        } else if (a.kind === 'land') {
            b.vx = 0;
            if (a.elapsed >= a.duration) recover(b, 0.85);
        } else if (a.kind === 'recover') {
            b.vx = 0;
            if (a.elapsed >= a.duration) b.action = null;
        } else if (a.kind === 'leap' && a.elapsed > a.duration) {
            // 极端帧率下的保险；正常落地由平台碰撞触发。
            b.y = a.landingY; b.vy = 0; b.onGround = true;
            land(b);
        }
    }
    function land(b) {
        b.vx = 0; b.vy = 0;
        b.spawnShockwave(-1); b.spawnShockwave(1);
        action(b, 'land', 'leap_slam', 0.24);
        b.vulnerableTimer = 1.09;
        Particles.spawn(b.x, b.y - 4, 22, b.accentColor, 260, 0.5, 4);
        FX.shockwave(b.x, b.y, 150, '255,200,130', 7, 0.4);
        Renderer.shake(9, 0.24); Audio.play('slam');
    }
    function update(b, dt, platforms, px, py) {
        b.animTime += dt;
        b.flashTimer = Math.max(0, b.flashTimer - dt);
        if (b.dead) {
            b.deathTimer += dt;
            if (b.deathTimer > 2) return false;
            if (Math.random() < 0.3) Particles.spawnExplosion(b.x + Utils.rand(-30,30), b.y - Utils.rand(0,b.h));
            return true;
        }
        b.vulnerableTimer = Math.max(0, b.vulnerableTimer - dt);
        b.stunTimer = Math.max(0, b.stunTimer - dt);
        b.shieldTimer = Math.max(0, b.shieldTimer - dt);
        b.shieldActive = b.shieldTimer > 0;
        b.attackCooldown = Math.max(0, b.attackCooldown - dt);
        b.attackTimer += dt;
        b.updateHazards(dt); b.updateBossBullets(dt, px, py);
        b.motionTrail = b.motionTrail.filter(t => (t.life -= dt) > 0);
        if (!b.entranceDone) {
            b.entranceTimer += dt;
            if (b.entranceTimer >= 1.5) b.entranceDone = true;
            return true;
        }
        const ratio = b.health / b.maxHealth;
        const phase = ratio < 0.3 ? 2 : ratio < 0.6 ? 1 : 0;
        if (phase > b.phase) {
            if (phase === 2) b.speed *= 1.3;
            b.phase = phase;
            Particles.spawnExplosion(b.x, b.y - b.h / 2); Audio.play('bossPhase');
        }
        advanceAction(b, dt, px, py);
        if (b.windup) {
            b.vx = 0;
            b.windup.timer -= dt;
            if (b.windup.timer <= 0) {
                const mark = b.windup; b.windup = null;
                b.performAttack(mark, px, py);
            }
        } else if (!b.action && b.stunTimer <= 0) {
            b.facing = px > b.x ? 1 : -1;
            if (b.attackCooldown <= 0 && b.onGround) b.executeAttack(px, py, Utils.dist(b.x,b.y,px,py));
            if (!b.windup) b.vx = Math.abs(px - b.x) > 125 ? b.facing * b.speed * (1 + b.phase * 0.15) : 0;
        }
        // 脚下的动作不滑行；缺口前的普通追击会刹车，跃击单独走弹道。
        if (b.onGround && !b.action && !b.windup && b.vx) {
            const ahead = b.x + Math.sign(b.vx) * (b.w / 2 + 18);
            if (!platforms.some(p => ahead >= p.x && ahead <= p.x+p.w && Math.abs(p.y-b.y)<25)) b.vx = 0;
        }
        const oldX = b.x, oldY = b.y;
        b.vy += b.gravity * dt;
        b.x = targetX(b, b.x + b.vx * dt); b.y += b.vy * dt;
        b.onGround = false;
        for (const p of platforms) {
            if (b.x+b.w/2>p.x && b.x-b.w/2<p.x+p.w && b.vy>=0 && oldY<=p.y+6 && b.y>=p.y-2) {
                b.y = p.y; b.vy = 0; b.onGround = true; b.x += p._dx || 0;
                if (b.action?.kind === 'leap') land(b);
                break;
            }
        }
        if (b.action?.kind === 'charge' && oldX === b.x) recover(b, 0.9);
        if (b.y > 650) {
            const floor = platforms.filter(p=>p.h>50).sort((a,c)=>Math.abs(a.x+a.w/2-b.x)-Math.abs(c.x+c.w/2-b.x))[0];
            if (floor) { b.x=targetX(b,Utils.clamp(b.x,floor.x+b.w/2,floor.x+floor.w-b.w/2)); b.y=floor.y; b.vy=0; b.onGround=true; recover(b); }
        }
        if (b.action && ['charge','leap','blink'].includes(b.action.kind) && Math.floor(b.animTime*24)!==Math.floor((b.animTime-dt)*24)) {
            b.motionTrail.push({ x:oldX, y:oldY, facing:b.facing, frame:frame(b), life:0.18 });
        }
        return true;
    }
    // 每帧姿态来自真实动画图集，不对整张立绘进行摆动来假装走路。
    function frame(b) {
        if (b.dead) return 14;
        if (b.windup) {
            const t=1-b.windup.timer/b.windup.duration;
            if (b.windup.type === 'leap_slam') return t < .55 ? 4 : 8;
            if (physical.has(b.windup.type)) return t < .45 ? 4 : 5;
            if (b.windup.type === 'teleport') return 4;
            return t < .4 ? 0 : 12;
        }
        const a=b.action;
        if (a?.kind === 'leap') return b.vy < 80 ? 9 : 10;
        if (a?.kind === 'land') return 11;
        if (a?.kind === 'blink') return a.elapsed < .23 ? 4 : 6;
        if (a?.kind === 'strike') return a.elapsed < .13 ? 5 : a.elapsed < .32 ? 6 : 7;
        if (a?.kind === 'cast') return a.elapsed < .17 ? 12 : 13;
        if (a?.kind === 'recover') return a.elapsed < a.duration * .4 ? 7 : 15;
        if (a?.kind === 'charge' || Math.abs(b.vx)>12) return [1,2,3,2][Math.floor(b.animTime*11)%4];
        if (b.flashTimer > 0) return 14;
        return 0;
    }
    function drawEffects(ctx, b) {
        const a=b.action;
        if (a?.kind === 'strike' && a.elapsed>.12 && a.elapsed<.35) {
            ctx.save(); ctx.scale(b.facing,1);
            ctx.globalAlpha *= Math.sin((a.elapsed-.12)/.23*Math.PI)*.8;
            ctx.strokeStyle=b.accentColor; ctx.lineWidth=8; ctx.shadowColor=b.accentColor; ctx.shadowBlur=15;
            ctx.beginPath(); ctx.ellipse(15,-b.h*.45,b.h*.65,b.h*.55,-.2,-1.4,1.2); ctx.stroke();
            ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke(); ctx.restore();
        }
        if (a?.kind === 'leap') {
            ctx.save(); ctx.translate(a.landingX-b.x,a.landingY-b.y);
            ctx.strokeStyle=b.accentColor; ctx.fillStyle=b.accentColor+'22'; ctx.lineWidth=2;
            ctx.beginPath(); ctx.ellipse(0,0,70,12,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
        }
    }
    return { init, update, attack, frame, drawEffects, recover };
})();
