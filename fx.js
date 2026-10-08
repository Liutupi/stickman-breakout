// ==================== 打击感 & 画面特效系统 ====================
// 顿帧 / 慢动作 / 冲击波 / 动态光照 / 肢体碎裂 / 弹壳 / 分数晶片 / 播报横幅 / 电影黑边
const FX = (() => {
    // ---- 时间控制 ----
    let hitStopTimer = 0;
    let hitStopCooldown = 0;
    let timeScale = 1;
    let slowTimer = 0;
    let slowScale = 1;

    // ---- 世界空间特效 ----
    let shockwaves = [];
    let lights = [];
    let gibs = [];
    let shells = [];
    let orbs = [];
    let scorches = [];

    // ---- 屏幕空间特效 ----
    let banners = [];
    let speedLines = [];
    let letterbox = 0;          // 0..1 当前
    let letterboxTarget = 0;
    let screenTint = { color: '255,140,40', alpha: 0 };
    let realTime = 0;

    const MAX_GIBS = 90;
    const MAX_SHELLS = 60;
    const MAX_ORBS = 120;

    // ==================== 时间 ====================
    function hitStop(sec) {
        if (hitStopCooldown > 0 && sec < 0.12) return;
        hitStopTimer = Math.max(hitStopTimer, sec);
    }

    function slowMo(scale, duration) {
        slowScale = Math.min(slowTimer > 0 ? slowScale : 1, scale);
        slowTimer = Math.max(slowTimer, duration);
    }

    // 传入真实 dt，返回模拟 dt（顿帧期间为 0）
    function stepTime(realDt) {
        realTime += realDt;
        if (hitStopTimer > 0) {
            hitStopTimer -= realDt;
            if (hitStopTimer <= 0) hitStopCooldown = 0.06;
            return 0;
        }
        hitStopCooldown = Math.max(0, hitStopCooldown - realDt);
        if (slowTimer > 0) {
            slowTimer -= realDt;
            timeScale = Utils.lerp(timeScale, slowScale, 1 - Math.pow(0.0001, realDt));
        } else {
            timeScale = Utils.lerp(timeScale, 1, 1 - Math.pow(0.002, realDt));
            if (Math.abs(timeScale - 1) < 0.01) timeScale = 1;
        }
        return realDt * timeScale;
    }

    function isFrozen() { return hitStopTimer > 0; }
    function getTimeScale() { return hitStopTimer > 0 ? 0 : timeScale; }

    // ==================== 世界特效生成 ====================
    function shockwave(x, y, maxR, color, width, life) {
        shockwaves.push({ x, y, r: 4, maxR, color: color || '255,220,150', width: width || 6, life: life || 0.35, maxLife: life || 0.35 });
    }

    function light(x, y, radius, color, life, intensity) {
        if (lights.length > 40) lights.shift();
        lights.push({ x, y, radius, color: color || '255,170,60', life: life || 0.2, maxLife: life || 0.2, intensity: intensity || 0.6 });
    }

    function scorch(x, y, r) {
        if (scorches.length > 24) scorches.shift();
        scorches.push({ x, y, r, life: 6, maxLife: 6 });
    }

    // 火柴人肢体碎裂：头 + 躯干 + 四肢
    function stickGibs(x, y, h, color, dirX, force) {
        const parts = [
            { kind: 'head', len: 7 },
            { kind: 'limb', len: h * 0.42 },
            { kind: 'limb', len: h * 0.3 },
            { kind: 'limb', len: h * 0.3 },
            { kind: 'limb', len: h * 0.28 },
            { kind: 'limb', len: h * 0.28 },
        ];
        const f = force || 1;
        for (const part of parts) {
            if (gibs.length >= MAX_GIBS) gibs.shift();
            gibs.push({
                x: x + Utils.rand(-6, 6),
                y: y - Utils.rand(h * 0.2, h * 0.9),
                vx: (dirX || (Math.random() < 0.5 ? -1 : 1)) * Utils.rand(120, 380) * f + Utils.rand(-80, 80),
                vy: -Utils.rand(220, 520) * f,
                rot: Utils.rand(0, Math.PI * 2),
                vr: Utils.rand(-14, 14),
                len: part.len,
                kind: part.kind,
                color,
                life: Utils.rand(1.6, 2.4),
                maxLife: 2.4,
                bounces: 0,
                trail: 0.6,
            });
        }
    }

    function shell(x, y, facing, color) {
        if (shells.length >= MAX_SHELLS) shells.shift();
        shells.push({
            x, y,
            vx: -facing * Utils.rand(60, 160),
            vy: -Utils.rand(160, 280),
            rot: Utils.rand(0, Math.PI),
            vr: Utils.rand(-20, 20),
            life: 1.6,
            color: color || '#e8b04a',
            bounces: 0,
        });
    }

    // 分数晶片 / 回血晶片
    function spawnOrbs(x, y, count, value, kind) {
        for (let i = 0; i < count; i++) {
            if (orbs.length >= MAX_ORBS) break;
            const a = Utils.rand(-Math.PI * 0.95, -Math.PI * 0.05);
            const spd = Utils.rand(160, 360);
            orbs.push({
                x, y,
                vx: Math.cos(a) * spd,
                vy: Math.sin(a) * spd,
                value,
                kind: kind || 'score',
                age: 0,
                delay: Utils.rand(0.25, 0.45),
                life: 9,
                spin: Utils.rand(0, Math.PI * 2),
            });
        }
    }

    // ==================== 屏幕特效 ====================
    function banner(text, opts = {}) {
        // 同类型只保留最新一条，避免叠字
        if (opts.channel) banners = banners.filter(b => b.channel !== opts.channel);
        banners.push({
            text,
            sub: opts.sub || '',
            color: opts.color || '#ffd36b',
            glow: opts.glow || opts.color || '#ff9a2e',
            size: opts.size || 54,
            y: opts.y !== undefined ? opts.y : 0.26,
            life: opts.life || 1.4,
            maxLife: opts.life || 1.4,
            channel: opts.channel || null,
        });
    }

    function burstSpeedLines(dir, count) {
        for (let i = 0; i < (count || 18); i++) {
            speedLines.push({
                y: Math.random(),
                x: Math.random(),
                len: Utils.rand(0.08, 0.25),
                dir: dir || 1,
                life: Utils.rand(0.15, 0.3),
                maxLife: 0.3,
                speed: Utils.rand(1.8, 3.2),
            });
        }
    }

    function setLetterbox(on) { letterboxTarget = on ? 1 : 0; }

    function setTint(color, alpha) {
        screenTint.color = color;
        screenTint.alpha = alpha;
    }

    // ==================== 更新 ====================
    function update(dt, realDt, platforms, player, onOrbCollect) {
        // 冲击波
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            const s = shockwaves[i];
            s.life -= dt;
            const t = 1 - s.life / s.maxLife;
            s.r = 4 + (s.maxR - 4) * (1 - Math.pow(1 - t, 3));
            if (s.life <= 0) shockwaves.splice(i, 1);
        }
        for (let i = lights.length - 1; i >= 0; i--) {
            lights[i].life -= dt;
            if (lights[i].life <= 0) lights.splice(i, 1);
        }
        for (let i = scorches.length - 1; i >= 0; i--) {
            scorches[i].life -= dt;
            if (scorches[i].life <= 0) scorches.splice(i, 1);
        }

        // 肢体
        for (let i = gibs.length - 1; i >= 0; i--) {
            const g = gibs[i];
            g.vy += 1300 * dt;
            const prevY = g.y;
            g.x += g.vx * dt;
            g.y += g.vy * dt;
            g.rot += g.vr * dt;
            g.life -= dt;
            g.trail = Math.max(0, g.trail - dt);
            if (g.vy > 0 && platforms) {
                for (const p of platforms) {
                    if (g.x > p.x && g.x < p.x + p.w && prevY <= p.y + 2 && g.y >= p.y) {
                        g.y = p.y - 1;
                        g.vy *= -0.38;
                        g.vx *= 0.6;
                        g.vr *= 0.5;
                        g.bounces++;
                        if (Math.abs(g.vy) < 40) { g.vy = 0; g.vr = 0; }
                        break;
                    }
                }
            }
            if (g.life <= 0 || g.y > 900) gibs.splice(i, 1);
        }

        // 弹壳
        for (let i = shells.length - 1; i >= 0; i--) {
            const s = shells[i];
            s.vy += 1200 * dt;
            const prevY = s.y;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.rot += s.vr * dt;
            s.life -= dt;
            if (s.vy > 0 && platforms) {
                for (const p of platforms) {
                    if (s.x > p.x && s.x < p.x + p.w && prevY <= p.y + 2 && s.y >= p.y) {
                        s.y = p.y - 1;
                        s.vy *= -0.35;
                        s.vx *= 0.55;
                        s.vr *= 0.4;
                        if (s.bounces++ === 0 && Math.random() < 0.3) Audio.play('shellTink');
                        break;
                    }
                }
            }
            if (s.life <= 0 || s.y > 900) shells.splice(i, 1);
        }

        // 晶片
        if (player && !player.dead) {
            const px = player.x, py = player.y - 26;
            const magnet = player.overdriveTimer > 0 ? 420 : 260;
            for (let i = orbs.length - 1; i >= 0; i--) {
                const o = orbs[i];
                o.age += dt;
                o.life -= dt;
                o.spin += dt * 6;
                const dx = px - o.x, dy = py - o.y;
                const dist = Math.hypot(dx, dy) || 1;
                if (o.age > o.delay && (dist < magnet || o.age > 1.6)) {
                    const pull = 2600 + o.age * 1800;
                    o.vx += (dx / dist) * pull * dt;
                    o.vy += (dy / dist) * pull * dt;
                    o.vx *= 0.9;
                    o.vy *= 0.9;
                } else {
                    o.vy += 900 * dt;
                    o.vx *= 0.985;
                    if (platforms) {
                        for (const p of platforms) {
                            if (o.x > p.x && o.x < p.x + p.w && o.y >= p.y - 4 && o.y <= p.y + 12 && o.vy > 0) {
                                o.y = p.y - 4;
                                o.vy *= -0.45;
                                o.vx *= 0.8;
                                break;
                            }
                        }
                    }
                }
                o.x += o.vx * dt;
                o.y += o.vy * dt;
                if (dist < 26 && o.age > o.delay) {
                    if (onOrbCollect) onOrbCollect(o);
                    orbs.splice(i, 1);
                    continue;
                }
                if (o.life <= 0 || o.y > 900) orbs.splice(i, 1);
            }
        }

        // 屏幕层用真实时间
        for (let i = banners.length - 1; i >= 0; i--) {
            banners[i].life -= realDt;
            if (banners[i].life <= 0) banners.splice(i, 1);
        }
        for (let i = speedLines.length - 1; i >= 0; i--) {
            speedLines[i].life -= realDt;
            speedLines[i].x -= speedLines[i].dir * speedLines[i].speed * realDt;
            if (speedLines[i].life <= 0) speedLines.splice(i, 1);
        }
        letterbox += (letterboxTarget - letterbox) * (1 - Math.pow(0.004, realDt));
    }

    // ==================== 绘制（世界层，在实体之下）====================
    function drawUnder(ctx) {
        const cx = Utils.camera.x, cy = Utils.camera.y;
        // 焦痕
        for (const s of scorches) {
            const a = Math.min(1, s.life / 2) * 0.45;
            const g = ctx.createRadialGradient(s.x - cx, s.y - cy, 0, s.x - cx, s.y - cy, s.r);
            g.addColorStop(0, `rgba(10,6,4,${a})`);
            g.addColorStop(0.6, `rgba(30,14,6,${a * 0.5})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(s.x - cx, s.y - cy, s.r, s.r * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ==================== 绘制（世界层，在实体之上）====================
    function drawOver(ctx) {
        const cx = Utils.camera.x, cy = Utils.camera.y;

        // 弹壳
        for (const s of shells) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, s.life * 2);
            ctx.translate(s.x - cx, s.y - cy);
            ctx.rotate(s.rot);
            ctx.fillStyle = s.color;
            ctx.fillRect(-2.5, -1.2, 5, 2.4);
            ctx.restore();
        }

        // 肢体碎块
        ctx.lineCap = 'round';
        for (const g of gibs) {
            const a = Math.min(1, g.life / 0.6);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(g.x - cx, g.y - cy);
            ctx.rotate(g.rot);
            ctx.strokeStyle = g.color;
            ctx.shadowColor = g.color;
            ctx.shadowBlur = g.trail > 0 ? 10 : 0;
            ctx.lineWidth = 3;
            if (g.kind === 'head') {
                ctx.beginPath();
                ctx.arc(0, 0, g.len, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(-g.len / 2, 0);
                ctx.lineTo(g.len / 2, 0);
                ctx.stroke();
            }
            ctx.restore();
        }

        // 晶片
        for (const o of orbs) {
            const sx = o.x - cx, sy = o.y - cy;
            const blink = o.life < 2 ? (Math.sin(o.life * 20) > 0 ? 1 : 0.3) : 1;
            const isHeal = o.kind === 'heal';
            const col = isHeal ? '90,255,160' : '255,206,90';
            ctx.save();
            ctx.globalAlpha = blink;
            ctx.globalCompositeOperation = 'lighter';
            Utils.drawGlow(ctx, col, sx, sy, 13, 0.55 * blink);
            ctx.globalAlpha = blink;
            ctx.translate(sx, sy);
            ctx.rotate(o.spin);
            const s = 4 * (0.8 + Math.sin(o.spin * 1.3) * 0.2);
            ctx.fillStyle = isHeal ? '#7dffb5' : '#ffd36b';
            ctx.beginPath();
            ctx.moveTo(0, -s * 1.4); ctx.lineTo(s, 0); ctx.lineTo(0, s * 1.4); ctx.lineTo(-s, 0);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillRect(-1, -1, 2, 2);
            ctx.restore();
        }

        // 冲击波 + 动态光（加法混合）
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const l of lights) {
            const t = l.life / l.maxLife;
            Utils.drawGlow(ctx, l.color, l.x - cx, l.y - cy, l.radius, l.intensity * t);
        }
        ctx.globalAlpha = 1;
        for (const s of shockwaves) {
            const t = s.life / s.maxLife;
            ctx.strokeStyle = `rgba(${s.color},${t * 0.9})`;
            ctx.lineWidth = s.width * t + 1;
            ctx.beginPath();
            ctx.arc(s.x - cx, s.y - cy, s.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${t * 0.5})`;
            ctx.lineWidth = Math.max(1, s.width * t * 0.35);
            ctx.beginPath();
            ctx.arc(s.x - cx, s.y - cy, s.r * 0.92, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    // ==================== 绘制（屏幕层）====================
    function drawScreen(ctx, w, h) {
        // 狂暴/特殊色调
        if (screenTint.alpha > 0.01) {
            const pulse = 0.75 + Math.sin(realTime * 7) * 0.25;
            const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
            g.addColorStop(0, `rgba(${screenTint.color},0)`);
            g.addColorStop(1, `rgba(${screenTint.color},${screenTint.alpha * pulse})`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        }

        // 速度线
        if (speedLines.length) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineCap = 'round';
            for (const s of speedLines) {
                const a = (s.life / s.maxLife) * 0.5;
                ctx.strokeStyle = `rgba(180,235,255,${a})`;
                ctx.lineWidth = 1.5;
                const x = s.x * w, y = s.y * h;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + s.dir * s.len * w, y);
                ctx.stroke();
            }
            ctx.restore();
        }

        // 电影黑边
        if (letterbox > 0.005) {
            const bh = h * 0.11 * letterbox;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, bh);
            ctx.fillRect(0, h - bh, w, bh);
            ctx.fillStyle = `rgba(168,48,53,${0.6 * letterbox})`;
            ctx.fillRect(0, bh - 2, w, 2);
            ctx.fillRect(0, h - bh, w, 2);
        }

        // 播报横幅
        for (const b of banners) {
            const t = 1 - b.life / b.maxLife;            // 0 → 1
            const appear = Math.min(1, t / 0.12);
            const fade = b.life < 0.35 ? b.life / 0.35 : 1;
            const punch = appear < 1 ? 1.6 - 0.6 * easeOutBack(appear) : 1 + Math.max(0, 0.04 - t * 0.04);
            const y = h * b.y - (1 - fade) * 20;
            ctx.save();
            ctx.globalAlpha = appear * fade;
            ctx.translate(w / 2, y);
            ctx.scale(punch, punch);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // 斜切底条
            const bw = Math.max(260, b.text.length * b.size * 0.9 + 80);
            ctx.fillStyle = 'rgba(5,8,16,0.55)';
            ctx.beginPath();
            ctx.moveTo(-bw / 2 + 20, -b.size * 0.62);
            ctx.lineTo(bw / 2 + 20, -b.size * 0.62);
            ctx.lineTo(bw / 2 - 20, b.size * 0.62);
            ctx.lineTo(-bw / 2 - 20, b.size * 0.62);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = b.glow;
            ctx.fillRect(-bw / 2, b.size * 0.62 - 3, bw * Math.min(1, t * 3), 3);

            ctx.font = `900 ${b.size}px "Orbitron", "Noto Sans SC", "Microsoft YaHei", sans-serif`;
            ctx.lineWidth = 6;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.strokeText(b.text, 0, 2);
            ctx.shadowColor = b.glow;
            ctx.shadowBlur = 24;
            ctx.fillStyle = b.color;
            ctx.fillText(b.text, 0, 0);
            ctx.shadowBlur = 0;
            if (b.sub) {
                ctx.font = `700 ${Math.round(b.size * 0.34)}px "Orbitron", "Noto Sans SC", "Microsoft YaHei", sans-serif`;
                ctx.fillStyle = '#e8f2ff';
                ctx.fillText(b.sub, 0, b.size * 0.95);
            }
            ctx.restore();
        }
    }

    function easeOutBack(t) {
        const c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    function clear() {
        shockwaves = []; lights = []; gibs = []; shells = []; orbs = []; scorches = [];
        banners = []; speedLines = [];
        hitStopTimer = 0; slowTimer = 0; timeScale = 1;
        letterboxTarget = 0; letterbox = 0;
        screenTint.alpha = 0;
    }

    return {
        hitStop, slowMo, stepTime, isFrozen, getTimeScale,
        shockwave, light, scorch, stickGibs, shell, spawnOrbs,
        banner, burstSpeedLines, setLetterbox, setTint,
        update, drawUnder, drawOver, drawScreen, clear,
    };
})();
