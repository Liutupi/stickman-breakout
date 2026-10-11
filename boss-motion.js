// Boss 的动作、物理和出招共用时间轴：预备 → 出手 → 收招。
const BossMotion = (() => {
    const physical = new Set(['charge', 'shockwave', 'melee', 'cross_slash', 'feint_dash', 'repel']);
    // 走位性格：brawler 贴身压制，skirmisher 游走换位，caster 保持射程。near/far 是理想交战距离。
    const PROFILE = {
        steel_guardian: { style: 'brawler', near: 70, far: 210 },
        shadow_king:    { style: 'skirmisher', near: 140, far: 330, blink: true },
        inferno_demon:  { style: 'caster', near: 230, far: 430 },
        frost_beast:    { style: 'brawler', near: 80, far: 230 },
        void_lord:      { style: 'caster', near: 270, far: 470, blink: true },
        chaos_creator:  { style: 'brawler', near: 90, far: 260 },
        neon_assassin:  { style: 'skirmisher', near: 90, far: 280, blink: true },
        sand_colossus:  { style: 'brawler', near: 100, far: 250 },
        sky_judicator:  { style: 'caster', near: 260, far: 450, blink: true },
        astral_regent:  { style: 'skirmisher', near: 150, far: 380, blink: true },
    };
    // 连招表：上一招收尾后直接接的下一招（只取本阶段招式池里有的，外加通用的震退/后跳射击）
    const CHAINS = {
        charge: ['leap_slam', 'shockwave', 'cross_slash'],
        feint_dash: ['cross_slash', 'aerial_dive', 'shockwave'],
        leap_slam: ['shockwave', 'leap_slam', 'cross_slash', 'ice_spikes', 'fire_pillar'],
        aerial_dive: ['cross_slash', 'shockwave', 'lane_barrage', 'boulder_rain'],
        cross_slash: ['feint_dash', 'shockwave', 'teleport', 'repel'],
        teleport: ['melee', 'cross_slash', 'shadow_burst', 'laser_sweep'],
        melee: ['shadow_burst', 'teleport', 'spread', 'repel'],
        shockwave: ['charge', 'leap_slam', 'aerial_dive'],
        shoot: ['spread', 'homing_orb', 'teleport'],
        spread: ['shoot', 'fire_pillar', 'homing_orb'],
        fire_pillar: ['fire_pillar', 'spread', 'leap_slam', 'aerial_dive'],
        ice_spikes: ['ice_spikes', 'leap_slam', 'melee', 'cross_slash'],
        ice_wall: ['ice_spikes', 'leap_slam'],
        portal_barrage: ['homing_orb', 'teleport', 'laser_sweep', 'special'],
        homing_orb: ['portal_barrage', 'teleport', 'spread'],
        laser_sweep: ['lane_barrage', 'homing_orb', 'teleport', 'boulder_rain'],
        boulder_rain: ['aerial_dive', 'leap_slam', 'shockwave'],
        lane_barrage: ['aerial_dive', 'laser_sweep', 'teleport'],
        shadow_burst: ['teleport', 'melee', 'feint_dash'],
        special: ['teleport', 'portal_barrage', 'leap_slam'],
        shield: ['charge', 'shockwave'],
        repel: ['cross_slash', 'charge', 'teleport', 'backstep_shot', 'leap_slam'],
        backstep_shot: ['portal_barrage', 'homing_orb', 'fire_pillar', 'lane_barrage', 'laser_sweep', 'spread'],
    };
    function prof(b) { return PROFILE[b.archetype] || { style: 'brawler', near: 80, far: 240 }; }
    function tier(b) { return Utils.clamp(((b.level || 1) - 1) / 9, 0, 1); }
    // 关卡越后，出招前摇越短、收招硬直越短（仍保留可读的预警和反击窗口）
    function windupScale(b) { return 1 - tier(b) * 0.2; }
    function recoverScale(b) { return (1 - tier(b) * 0.25) * (b.phase >= 2 ? 0.85 : 1); }
    function comboBudget(b) {
        return Math.min(3, (b.level >= 3 ? 1 : 0) + b.phase + (b.level >= 8 ? 1 : 0));
    }
    function init(b, config) {
        b.action = null;
        b.arenaMin = config.arenaMin ?? -Infinity;
        b.arenaMax = config.arenaMax ?? Infinity;
        b.motionTrail = [];
        b.attackCooldown = 0.8;
        b.comboLeft = 0; b.lastAttack = null;
        b.strafeDir = 1; b.strafeT = 0;
        b.anchorX = b.x; b.anchorT = 0;
        b.hugT = 0; b.repelCd = 1.5; b.evadeCd = 2; b.recentDmg = 0; b.airT = 0;
        b.pendingRoar = false;
    }
    function action(b, kind, type, duration, extra = {}) {
        b.action = { kind, type, duration, elapsed: 0, ...extra };
    }
    function pickChain(b) {
        const pool = b.getAttackPool();
        const options = (CHAINS[b.lastAttack] || []).filter(t => pool.includes(t) || t === 'repel' || t === 'backstep_shot');
        if (!options.length) return pool[(b.attackPattern++) % pool.length];
        return options[Math.floor(Math.random() * options.length)];
    }
    function recover(b, duration = 0.65) {
        b.vx = 0;
        b.chargeTimer = 0;
        // 连招：还有连段预算时不进硬直，短暂衔接后直接起下一招
        if (b.comboLeft > 0 && !b.dead && b.lastAttack && Math.random() < 0.45 + tier(b) * 0.35 + b.phase * 0.1) {
            b.comboLeft--;
            action(b, 'link', 'link', 0.2 - tier(b) * 0.06, { next: pickChain(b) });
            return;
        }
        b.comboLeft = 0;
        duration *= recoverScale(b);
        b.vulnerableTimer = Math.max(b.vulnerableTimer, duration);
        action(b, 'recover', 'recover', duration);
        b.attackCooldown = Math.max(b.attackCooldown, duration + 0.22 - tier(b) * 0.12);
    }
    // ---------- 机动动作：跳跃换位 / 地面闪步 / 瞬移 / 后跳射击 ----------
    function hop(b, toX, opts = {}) {
        toX = targetX(b, toX);
        const flight = Utils.clamp(Math.abs(toX - b.x) / 760 + 0.36, 0.42, 0.8);
        b.vx = (toX - b.x) / flight;
        b.vy = -b.gravity * flight / 2;
        b.onGround = false;
        action(b, 'hop', opts.shot ? 'backstep_shot' : 'hop', flight + 0.8,
            { landingX: toX, landingY: b.y, slam: !!opts.slam, shot: !!opts.shot, fired: false, mark: opts.mark });
        Audio.play('dash');
        Particles.spawn(b.x, b.y - 4, 10, b.accentColor, 180, 0.35);
    }
    function dashStep(b, toX) {
        toX = targetX(b, toX);
        const dur = 0.24;
        b.vx = (toX - b.x) / dur;
        b.facing = b.vx >= 0 ? 1 : -1;
        action(b, 'dashstep', 'dashstep', dur, { toX });
        Audio.play('dash');
    }
    function blinkTo(b, toX, px) {
        action(b, 'blink', 'blinkstep', 0.4, { mark: { x: px }, destX: targetX(b, toX), released: false, mobility: true });
    }
    // 被集火时闪避：施法者后跳反击，游击者瞬移到身后，力量型硬顶上来（震退或跃击）
    function evade(b, px, py) {
        const P = prof(b), dir = px > b.x ? 1 : -1, ad = Math.abs(px - b.x);
        b.facing = dir;
        const roomBehind = dir > 0 ? b.x - b.arenaMin : b.arenaMax - b.x;
        if (P.style === 'caster') {
            if (roomBehind > 260) { hop(b, b.x - dir * 260, { shot: true, mark: { x: px, y: py } }); return; }
            if (P.blink) { blinkTo(b, px + dir * 360, px); return; }
            hop(b, px + dir * 230, { slam: b.phase >= 1 });
            return;
        }
        if (P.style === 'skirmisher') {
            if (P.blink && Math.random() < 0.6) { blinkTo(b, px + dir * (150 + Math.random() * 60), px); return; }
            if (roomBehind > 200) { hop(b, b.x - dir * 220, { shot: true, mark: { x: px, y: py } }); return; }
            dashStep(b, px + dir * 170);
            return;
        }
        if (ad < 170) { b.startWindup('repel', px, py, 0.4 - tier(b) * 0.08); return; }
        hop(b, px - dir * 70, { slam: true });
    }
    // 站桩太久：换个位置继续压迫
    function reposition(b, px, py) {
        const P = prof(b), dir = px > b.x ? 1 : -1, ad = Math.abs(px - b.x);
        if (P.style === 'brawler') {
            if (ad < 160) hop(b, px + dir * 150, { slam: b.phase >= 1 });     // 越过玩家头顶落到另一侧
            else hop(b, px - dir * 90, { slam: true });
        } else if (P.blink) {
            const side = Math.random() < 0.5 ? -1 : 1;
            blinkTo(b, px + side * (P.near + 40 + Math.random() * 90), px);
        } else {
            const want = px - dir * (P.near + P.far) / 2;
            if (Math.abs(want - b.x) > 120) dashStep(b, want); else hop(b, px + dir * (P.near + 60));
        }
    }
    function steer(b, dt, px) {
        const P = prof(b), d = px - b.x, ad = Math.abs(d), dir = d >= 0 ? 1 : -1;
        const run = b.speed * (1.3 + tier(b) * 0.35) * (1 + b.phase * 0.15);
        b.strafeT -= dt;
        if (b.strafeT <= 0) { b.strafeT = 0.4 + Math.random() * 0.6; b.strafeDir = Math.random() < 0.5 ? -1 : 1; }
        if (ad > P.far) return dir * run;
        if (ad < P.near) return P.style === 'brawler' ? b.strafeDir * run * 0.35 : -dir * run * 0.85;
        return b.strafeDir * run * (P.style === 'caster' ? 0.55 : 0.45);
    }
    function tactics(b, dt, px, py) {
        if (!b.onGround) return false;
        const P = prof(b), ad = Math.abs(px - b.x), T = tier(b);
        if (b.pendingRoar) { b.pendingRoar = false; roar(b); return true; }
        // 原地停留太久：强制换位（优先于震退，避免贴身时只会原地反复震退）
        if (b.anchorT > 2.4 - T * 0.8) { b.anchorT = 0; reposition(b, px, py); return true; }
        // 玩家贴身输出：短前摇震退
        if (b.hugT > 0.9 - T * 0.4 && b.repelCd <= 0) {
            b.hugT = 0; b.repelCd = 3.4 - T;
            b.startWindup('repel', px, py, 0.42 - T * 0.1);
            return true;
        }
        // 短时间内掉血太多：闪避 / 反击
        const threshold = b.maxHealth * (0.05 - 0.02 * T);
        if (b.recentDmg > threshold && b.evadeCd <= 0) {
            b.recentDmg = 0; b.evadeCd = 3.2 - 1.2 * T - 0.3 * b.phase;
            evade(b, px, py);
            return true;
        }
        // 被逼到墙角
        const cornered = b.x - b.arenaMin < b.w / 2 + 60 || b.arenaMax - b.x < b.w / 2 + 60;
        if (cornered && ad < P.near + 70 && b.evadeCd <= 0) {
            b.evadeCd = 2.4;
            hop(b, px + (px > b.x ? 1 : -1) * 180, { slam: b.phase >= 1 });
            return true;
        }
        return false;
    }
    // 进入新阶段：怒吼震退并立刻开启连招
    function roar(b) {
        b.vx = 0; b.windup = null;
        action(b, 'roar', 'roar', 0.8, { released: false });
        Audio.play('bossPhase');
    }
    function targetX(b, x) {
        return Utils.clamp(x, b.arenaMin + b.w / 2, b.arenaMax - b.w / 2);
    }
    function leapTarget(b, mark) {
        return { x: targetX(b, Utils.clamp(mark.x, b.x - 520, b.x + 520)), y: b.y };
    }
    function diveTarget(b, mark) {
        return { x: targetX(b, Utils.clamp(mark.x, b.x - 600, b.x + 600)), y: b.y };
    }
    function feintTarget(b, mark) {
        const dir = mark.dir || b.facing;
        const retreatX = targetX(b, b.x - dir * 120);
        const distance = Utils.clamp((mark.x - retreatX) * dir + 90, 180, 520);
        return { retreatX, dashX: targetX(b, retreatX + dir * distance) };
    }
    function lanePlan(b, beat = 0, phase = b.phase, floorY = b.y) {
        return { lanes: [floorY - 22, floorY - 90, floorY - 158],
            gap: (phase >= 2 ? [1, 0, 1] : [0, 1, 0])[Math.min(2, beat)] };
    }
    function attack(b, mark) {
        b.vx = 0;
        b.lastAttack = mark.type;
        mark = { ...mark, dir: mark.dir || b.facing, phase: mark.phase ?? b.phase, floorY: mark.floorY ?? b.y };
        if (mark.type === 'cross_slash') {
            action(b, 'combo', mark.type, 1.08, { mark, swing: 0 });
        } else if (mark.type === 'feint_dash') {
            mark = { ...mark, ...feintTarget(b, mark) };
            b.vx = (mark.retreatX - b.x) / .32;
            action(b, 'retreat', mark.type, .32, { mark });
            Audio.play('dash');
        } else if (mark.type === 'aerial_dive') {
            const landing = diveTarget(b, mark);
            // 后仰腾空再前扑，近身目标也不会出现朝右站姿却向左俯冲。
            b.vx = (targetX(b, b.x - mark.dir * 90) - b.x) / .48;
            b.vy = -640;
            b.onGround = false;
            action(b, 'takeoff', mark.type, .48, { mark, landingX: landing.x, landingY: landing.y });
            Audio.play('bossSpecial');
        } else if (mark.type === 'lane_barrage') {
            action(b, 'barrage', mark.type, 1.3, { mark, volley: 0 });
        } else if (mark.type === 'charge') {
            b.chargeDir = b.facing;
            b.chargeTimer = 0.62 + b.phase * 0.06;
            action(b, 'charge', mark.type, b.chargeTimer);
            Audio.play('bossSpecial');
        } else if (mark.type === 'leap_slam') {
            const flight = b.archetype === 'astral_regent' ? 1.18 : 1.1;
            const landing = leapTarget(b, mark);
            // 弹道在起跳时确定；玩家离开标记后不会被空中追踪。
            b.vx = (landing.x - b.x) / flight;
            b.vy = -b.gravity * flight / 2;
            b.onGround = false;
            action(b, 'leap', mark.type, 2, { landingX: landing.x, landingY: landing.y });
            Audio.play('bossSpecial');
        } else if (mark.type === 'backstep_shot') {
            hop(b, b.x - mark.dir * 240, { shot: true, mark });
        } else if (mark.type === 'teleport') {
            action(b, 'blink', mark.type, b.archetype === 'astral_regent' ? 0.6 : 0.46, { mark, released: false });
        } else {
            action(b, physical.has(mark.type) ? 'strike' : 'cast', mark.type, b.archetype === 'astral_regent' ? 0.66 : 0.52,
                { mark, released: false });
        }
    }
    function advanceAction(b, dt, px, py) {
        const a = b.action;
        if (!a) return;
        a.elapsed += dt;
        if (a.kind === 'link') {
            b.vx = 0;
            if (a.elapsed >= a.duration) {
                b.action = null;
                b.facing = px > b.x ? 1 : -1;
                // 连招里原地站太久：先换位，再继续出招
                if (b.anchorT > 2 - tier(b) * 0.6 && b.onGround) { b.anchorT = 0; reposition(b, px, py); b.attackCooldown = 0; }
                else b.beginAttack(a.next, px, py, 0.62);
            }
        } else if (a.kind === 'hop') {
            if (a.shot && !a.fired && a.elapsed >= 0.2) {
                a.fired = true;
                const tx = a.mark ? a.mark.x : px, ty = a.mark ? a.mark.y : py;
                b.spreadShoot(px, py);
                if (b.phase >= 1) b.shootAt(tx, ty);
            }
        } else if (a.kind === 'dashstep') {
            if (a.elapsed >= a.duration) {
                b.vx = 0; b.action = null;
                b.attackCooldown = Math.min(b.attackCooldown, 0.12);
            }
        } else if (a.kind === 'roar') {
            b.vx = 0;
            if (!a.released && a.elapsed >= 0.3) {
                a.released = true;
                b.releaseAttack({ type: 'repel', big: true }, px, py);
            }
            if (a.elapsed >= a.duration) {
                b.action = null;
                b.attackCooldown = 0.1;
                b.comboLeft = comboBudget(b) + 1;
            }
        } else if (a.kind === 'combo') {
            b.vx = 0;
            const beats = [.14, .72];
            while (a.swing < beats.length && a.elapsed >= beats[a.swing]) {
                b.releaseAttack({ ...a.mark, swing: a.swing }, a.mark.x, a.mark.y);
                a.swing++;
            }
            if (a.elapsed >= a.duration) recover(b, .95);
        } else if (a.kind === 'retreat') {
            if (a.elapsed >= a.duration) {
                b.x = a.mark.retreatX; b.vx = 0;
                action(b, 'dash_ready', a.type, .24, { mark: a.mark });
            }
        } else if (a.kind === 'dash_ready') {
            b.vx = 0;
            if (a.elapsed >= a.duration) {
                b.vx = (a.mark.dashX - b.x) / .42;
                action(b, 'dash', a.type, .42, { mark: a.mark, released: false });
                Audio.play('dash');
            }
        } else if (a.kind === 'dash') {
            if (!a.released && a.elapsed >= .29) {
                a.released = true;
                b.releaseAttack(a.mark, a.mark.x, a.mark.y);
            }
            if (a.elapsed >= a.duration) {
                b.x = a.mark.dashX;
                recover(b, 1.05);
            }
        } else if (a.kind === 'takeoff') {
            if (a.elapsed >= a.duration) {
                b.vx = 0; b.vy = 0;
                action(b, 'hover', a.type, .28, { mark: a.mark, landingX: a.landingX, landingY: a.landingY });
            }
        } else if (a.kind === 'hover') {
            b.vx = 0; b.vy = 0;
            if (a.elapsed >= a.duration) {
                const duration = .38;
                b.vx = (a.landingX - b.x) / duration;
                b.vy = (a.landingY - b.y) / duration;
                action(b, 'dive', a.type, duration, { mark: a.mark, landingX: a.landingX, landingY: a.landingY });
            }
        } else if (a.kind === 'dive' && a.elapsed >= a.duration) {
            b.x = a.landingX; b.y = a.landingY; b.onGround = true;
            land(b, 'aerial_dive');
        } else if (a.kind === 'barrage') {
            b.vx = 0;
            const beats = [.14, .56, .98];
            while (a.volley < beats.length && a.elapsed >= beats[a.volley]) {
                b.releaseAttack({ ...a.mark, beat: a.volley }, a.mark.x, a.mark.y);
                a.volley++;
            }
            if (a.elapsed >= a.duration) recover(b, .85);
        } else if (a.kind === 'charge') {
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
                b.x = targetX(b, a.destX ?? (a.mark.x + b.facing * 165));
                b.facing = (a.mobility ? px : a.mark.x) > b.x ? 1 : -1;
                Particles.spawn(b.x, b.y - b.h / 2, 18, b.accentColor, 200, 0.45);
                Audio.play('dash');
            }
            if (a.elapsed >= a.duration) {
                if (a.mobility) { b.action = null; b.attackCooldown = Math.min(b.attackCooldown, 0.1); }
                else recover(b, b.archetype === 'astral_regent' ? 0.8 : 0.55);
            }
        } else if (a.kind === 'strike' || a.kind === 'cast') {
            b.vx = 0;
            if (!a.released && a.elapsed >= 0.17) {
                a.released = true;
                b.releaseAttack(a.mark, a.mark.x, a.mark.y);
            }
            if (a.elapsed >= a.duration) recover(b, b.archetype === 'astral_regent' ? 0.8 - b.phase * 0.04 : 0.55 - b.phase * 0.06);
        } else if (a.kind === 'land') {
            b.vx = 0;
            if (a.elapsed >= a.duration && (a.type === 'hop' || a.type === 'backstep_shot')) {
                b.action = null;
                b.attackCooldown = Math.min(b.attackCooldown, 0.15);
            } else if (a.elapsed >= a.duration) recover(b, a.type === 'aerial_dive' || b.archetype === 'astral_regent' ? 1.05 : 0.85);
        } else if (a.kind === 'recover') {
            b.vx = 0;
            if (a.elapsed >= a.duration) b.action = null;
        } else if ((a.kind === 'leap' || a.kind === 'hop') && a.elapsed > a.duration) {
            // 极端帧率下的保险；正常落地由平台碰撞触发。
            b.y = a.landingY; b.vy = 0; b.onGround = true;
            land(b, a.kind === 'hop' ? a.type : 'leap_slam');
        }
    }
    function land(b, type = 'leap_slam') {
        if (Number.isFinite(b.action?.landingX)) {
            b.x = targetX(b, b.action.landingX);
            b.y = b.action.landingY;
        }
        b.vx = 0; b.vy = 0;
        if (type === 'hop' || type === 'backstep_shot') {
            // 换位跳：轻落地，二阶段起落地带冲击波
            if (b.action?.slam) {
                b.spawnShockwave(-1); b.spawnShockwave(1);
                FX.shockwave(b.x, b.y, 110, '255,200,130', 5, 0.3);
                Renderer.shake(5, 0.14); Audio.play('slam');
            }
            Particles.spawn(b.x, b.y - 4, 10, b.accentColor, 160, 0.35, 3);
            action(b, 'land', type, 0.12);
            return;
        }
        b.spawnShockwave(-1); b.spawnShockwave(1);
        if (type === 'aerial_dive') b.releaseAttack({ type, dir:b.facing }, b.x, b.y);
        action(b, 'land', type, 0.24);
        b.vulnerableTimer = b.archetype === 'astral_regent' ? 1.29 : 1.09;
        Particles.spawn(b.x, b.y - 4, 22, b.accentColor, 260, 0.5, 4);
        FX.shockwave(b.x, b.y, 150, b.archetype === 'astral_regent' ? '157,239,255' : '255,200,130', 7, 0.4);
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
        b.evadeCd = Math.max(0, b.evadeCd - dt);
        b.repelCd = Math.max(0, b.repelCd - dt);
        b.recentDmg *= Math.exp(-dt / 1.4);
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
            b.attackPattern = 0;
            b.pendingRoar = true;
            Particles.spawnExplosion(b.x, b.y - b.h / 2); Audio.play('bossPhase');
        }
        // 防卡死保险：任何动作/前摇超时都强制结束；长时间悬空直接落回地面
        if (b.action && b.action.elapsed > b.action.duration + 2.5) { b.action = null; b.vx = 0; }
        if (b.windup && b.windup.timer < -0.5) b.windup = null;
        b.airT = b.onGround ? 0 : b.airT + dt;
        if (b.airT > 3) {
            const floor = platforms.filter(p => p.h > 50 && b.x >= p.x && b.x <= p.x + p.w)[0]
                || platforms.filter(p => p.h > 50).sort((a, c) => Math.abs(a.x + a.w / 2 - b.x) - Math.abs(c.x + c.w / 2 - b.x))[0];
            if (floor) { b.x = targetX(b, Utils.clamp(b.x, floor.x + b.w / 2, floor.x + floor.w - b.w / 2)); b.y = floor.y; b.vy = 0; b.onGround = true; b.action = null; }
            b.airT = 0;
        }
        // 位置停滞 / 玩家贴身计时
        if (Math.abs(b.x - b.anchorX) > 70) { b.anchorX = b.x; b.anchorT = 0; } else b.anchorT += dt;
        const hugging = Math.abs(px - b.x) < b.w / 2 + 48 && py > b.y - b.h - 60;
        b.hugT = hugging ? b.hugT + dt : Math.max(0, b.hugT - dt * 2);
        // 二阶段起，被重火力压在收招硬直里时可以强行脱身
        if (b.action?.kind === 'recover' && b.phase >= 1 && b.action.elapsed > b.action.duration * 0.45
            && b.recentDmg > b.maxHealth * (0.08 - 0.03 * tier(b)) && b.evadeCd <= 0 && b.onGround) {
            b.action = null; b.vulnerableTimer = 0; b.recentDmg = 0;
            b.evadeCd = 3.4 - tier(b);
            evade(b, px, py);
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
            if (tactics(b, dt, px, py)) {
                // 机动 / 闪避 / 震退已接管本帧
            } else if (b.attackCooldown <= 0 && b.onGround) {
                b.executeAttack(px, py, Utils.dist(b.x,b.y,px,py));
                if (b.windup) b.comboLeft = comboBudget(b);
            }
            if (!b.windup && !b.action) b.vx = steer(b, dt, px);
        }
        // 脚下的动作不滑行；缺口前的普通追击会刹车，跃击单独走弹道。
        if (b.onGround && !b.action && !b.windup && b.vx) {
            const ahead = b.x + Math.sign(b.vx) * (b.w / 2 + 18);
            if (!platforms.some(p => ahead >= p.x && ahead <= p.x+p.w && Math.abs(p.y-b.y)<25)) b.vx = 0;
        }
        const oldX = b.x, oldY = b.y;
        if (!['hover', 'dive'].includes(b.action?.kind)) b.vy += b.gravity * dt;
        b.x = targetX(b, b.x + b.vx * dt); b.y += b.vy * dt;
        if (b.action?.kind === 'retreat' && (b.x-b.action.mark.retreatX)*b.action.mark.dir<0) b.x=b.action.mark.retreatX;
        if (b.action?.kind === 'dash' && (b.x-b.action.mark.dashX)*b.action.mark.dir>0) b.x=b.action.mark.dashX;
        b.onGround = false;
        for (const p of platforms) {
            if (['leap','dive','hop'].includes(b.action?.kind) && Math.abs(p.y-b.action.landingY)>8) continue;
            if (b.x+b.w/2>p.x && b.x-b.w/2<p.x+p.w && b.vy>=0 && oldY<=p.y+6 && b.y>=p.y-2) {
                b.y = p.y; b.vy = 0; b.onGround = true; b.x += p._dx || 0;
                if (b.action?.kind === 'leap' || b.action?.kind === 'dive' || b.action?.kind === 'hop') land(b, b.action.type);
                break;
            }
        }
        if (b.action?.kind === 'charge' && oldX === b.x) recover(b, 0.9);
        if (b.y > 650) {
            const floor = platforms.filter(p=>p.h>50).sort((a,c)=>Math.abs(a.x+a.w/2-b.x)-Math.abs(c.x+c.w/2-b.x))[0];
            if (floor) { b.x=targetX(b,Utils.clamp(b.x,floor.x+b.w/2,floor.x+floor.w-b.w/2)); b.y=floor.y; b.vy=0; b.onGround=true; recover(b); }
        }
        if (b.action && ['charge','leap','blink','retreat','dash','takeoff','dive','hop','dashstep'].includes(b.action.kind) && Math.floor(b.animTime*24)!==Math.floor((b.animTime-dt)*24)) {
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
            if (b.windup.type === 'aerial_dive') return t < .6 ? 4 : 8;
            if (physical.has(b.windup.type)) return t < .45 ? 4 : 5;
            if (b.windup.type === 'teleport') return 4;
            if (b.windup.type === 'backstep_shot') return 4;
            return t < .4 ? 0 : 12;
        }
        const a=b.action;
        if (a?.kind === 'combo') {
            if (a.elapsed < .14 || (a.elapsed > .36 && a.elapsed < .72)) return 5;
            return a.elapsed < .36 || a.elapsed > .72 && a.elapsed < .94 ? 6 : 7;
        }
        if (a?.kind === 'retreat') return [3,2,1][Math.floor(a.elapsed*18)%3];
        if (a?.kind === 'dash_ready') return 5;
        if (a?.kind === 'dash') return a.elapsed < .25 ? 3 : 6;
        if (a?.kind === 'takeoff') return a.elapsed < .08 ? 8 : 9;
        if (a?.kind === 'hover' || a?.kind === 'dive') return 10;
        if (a?.kind === 'barrage') return a.elapsed < .14 || a.elapsed > .3 && a.elapsed < .56 || a.elapsed > .74 && a.elapsed < .98 ? 12 : 13;
        if (a?.kind === 'leap' || a?.kind === 'hop') return b.vy < 80 ? 9 : 10;
        if (a?.kind === 'dashstep') return 3;
        if (a?.kind === 'link') return 5;
        if (a?.kind === 'roar') return a.elapsed < .3 ? 12 : 13;
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
        if (a?.kind === 'combo' || a?.kind === 'dash') {
            const second = a.kind === 'combo' && a.elapsed >= .72;
            const start = a.kind === 'dash' ? .29 : second ? .72 : .14;
            const t = (a.elapsed - start) / .16;
            if (t >= 0 && t <= 1) {
                ctx.save(); ctx.scale(a.mark.dir, 1);
                ctx.globalAlpha *= Math.sin(t*Math.PI)*.9;
                const reach = b.h*(second ? 1.22 : 1.02);
                ctx.strokeStyle = b.accentColor; ctx.lineWidth = 11;
                ctx.shadowColor = b.accentColor; ctx.shadowBlur = 20;
                ctx.beginPath(); ctx.ellipse(15, -b.h*.46, reach, b.h*.46, second ? .2 : -.2,
                    second ? -1.3 : -1.5, second ? 1.5 : 1.3); ctx.stroke();
                ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
            }
        }
        if (a?.kind === 'retreat' || a?.kind === 'dash_ready') drawDashCue(ctx, b, a.mark);
        if (a?.kind === 'takeoff' || a?.kind === 'hover' || a?.kind === 'dive') {
            ctx.save(); ctx.translate(a.landingX-b.x, a.landingY-b.y);
            ctx.fillStyle = b.accentColor+'22'; ctx.strokeStyle = b.accentColor; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(0,0,82,14,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.setLineDash([7,7]); ctx.beginPath(); ctx.moveTo(0,-100); ctx.lineTo(0,-20); ctx.stroke();
            ctx.restore();
        }
        if (a?.kind === 'barrage' && a.volley < 3) drawLaneCue(ctx, b, a.mark, a.volley, true);
        if (a?.kind === 'strike' && a.elapsed>.12 && a.elapsed<.35) {
            ctx.save(); ctx.scale(b.facing,1);
            ctx.globalAlpha *= Math.sin((a.elapsed-.12)/.23*Math.PI)*.8;
            ctx.strokeStyle=b.accentColor; ctx.lineWidth=8; ctx.shadowColor=b.accentColor; ctx.shadowBlur=15;
            ctx.beginPath(); ctx.ellipse(15,-b.h*.45,b.h*.65,b.h*.55,-.2,-1.4,1.2); ctx.stroke();
            ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke(); ctx.restore();
        }
        if (a?.kind === 'roar') {
            const t = Utils.clamp(a.elapsed / .3, 0, 1);
            ctx.save(); ctx.globalAlpha *= a.released ? Math.max(0, 1 - (a.elapsed - .3) / .4) : .4 + t * .5;
            ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 4 + t * 4; ctx.shadowColor = '#ff2a2a'; ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.ellipse(0, -b.h * .45, b.w * .6 + t * 200, b.h * .55 + t * 40, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }
        if (a?.kind === 'leap' || (a?.kind === 'hop' && a.slam)) {
            ctx.save(); ctx.translate(a.landingX-b.x,a.landingY-b.y);
            ctx.strokeStyle=b.accentColor; ctx.fillStyle=b.accentColor+'22'; ctx.lineWidth=2;
            ctx.beginPath(); ctx.ellipse(0,0,70,12,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
        }
    }
    function drawDashCue(ctx, b, mark) {
        ctx.save(); ctx.globalAlpha *= .6;
        ctx.strokeStyle = b.accentColor; ctx.fillStyle = b.accentColor+'22'; ctx.lineWidth = 2;
        const x = mark.dashX-b.x;
        ctx.fillRect(Math.min(0,x), -b.h*.65, Math.abs(x), b.h*.6);
        ctx.setLineDash([13,9]); ctx.beginPath(); ctx.moveTo(0,-b.h*.35); ctx.lineTo(x,-b.h*.35); ctx.stroke();
        ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x-mark.dir*14,-b.h*.35-9);
        ctx.lineTo(x,-b.h*.35); ctx.lineTo(x-mark.dir*14,-b.h*.35+9); ctx.stroke(); ctx.restore();
    }
    function drawLaneCue(ctx, b, mark, beat, upcoming = false) {
        const plan = lanePlan(b, beat, mark.phase ?? b.phase, mark.floorY ?? b.y);
        const dir = mark.dir || b.facing;
        const end = dir > 0 ? b.arenaMax-b.x : b.arenaMin-b.x;
        ctx.save();
        const safeY = plan.lanes[plan.gap]-b.y;
        const from = upcoming ? dir*(b.w/2+14) : 0;
        const to = upcoming ? from+dir*68 : end;
        ctx.fillStyle = '#80ffd822'; ctx.strokeStyle = '#80ffd899'; ctx.lineWidth = 1;
        ctx.fillRect(Math.min(from,to), safeY-29, Math.abs(to-from), 58);
        ctx.strokeRect(Math.min(from,to), safeY-29, Math.abs(to-from), 58);
        ctx.strokeStyle = b.accentColor; ctx.globalAlpha *= .6; ctx.setLineDash([12,12]);
        for (let i=0;i<plan.lanes.length;i++) if(i!==plan.gap) {
            const y=plan.lanes[i]-b.y;
            ctx.beginPath();ctx.moveTo(upcoming ? from : dir*50,y);ctx.lineTo(to,y);ctx.stroke();
        }
        if(upcoming) {
            ctx.globalAlpha=1;ctx.setLineDash([]);ctx.fillStyle='#b8ffe8';ctx.textAlign='center';
            ctx.font='700 12px "Noto Sans SC",sans-serif';
            ctx.fillText(`下一拍 · ${plan.gap===0 ? '低位' : '中位'}弹隙`,(from+to)/2,-b.h-18);
        }
        ctx.restore();
    }
    function drawWindup(ctx, b) {
        const w = b.windup;
        if (!w || !['cross_slash','feint_dash','aerial_dive','lane_barrage','repel','backstep_shot'].includes(w.type)) return false;
        const t=1-w.timer/w.duration;
        const bx=b.x-Utils.camera.x, by=b.y-Utils.camera.y;
        ctx.save(); ctx.translate(bx,by); ctx.globalAlpha=.45+t*.5;
        ctx.strokeStyle=b.accentColor;ctx.fillStyle=b.accentColor+'22';ctx.lineWidth=2+t*2;
        if (w.type === 'repel') {
            ctx.globalAlpha = .5 + t * .5; ctx.lineWidth = 3 + t * 4;
            ctx.beginPath(); ctx.ellipse(0, -b.h * .45, b.w * .5 + 115 * t + 20, b.h * .5 + 20 * t, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (w.type === 'backstep_shot') {
            ctx.scale(w.dir,1); ctx.setLineDash([8,8]);
            ctx.beginPath(); ctx.moveTo(0,-b.h*.5); ctx.quadraticCurveTo(-120,-b.h-90,-240,0); ctx.stroke();
        } else if (w.type === 'cross_slash') {
            ctx.scale(w.dir,1);
            ctx.beginPath();ctx.ellipse(20,-b.h*.45,b.h*1.22,b.h*.46,0,-Math.PI*.5,Math.PI*.5);
            ctx.stroke();
        } else if (w.type === 'feint_dash') drawDashCue(ctx,b,{...w,...feintTarget(b,w)});
        else if (w.type === 'aerial_dive') {
            const landing=diveTarget(b,w), x=landing.x-b.x;
            ctx.beginPath();ctx.ellipse(x,0,82,14,0,0,Math.PI*2);ctx.fill();ctx.stroke();
            ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(0,-b.h);ctx.quadraticCurveTo(x*.5,-b.h-180,x,0);ctx.stroke();
        } else drawLaneCue(ctx,b,w,0);
        ctx.restore();
        const labels={cross_slash:'二连斩 · 连续两击后反击',feint_dash:'后撤突刺 · 离开标记路线',
            aerial_dive:'升空俯冲 · 离开锁定落点',lane_barrage:'分层齐射 · 躲进绿色弹隙',
            repel:'震退爆发 · 别贴身',backstep_shot:'后跳散射 · 注意弹幕'};
        ctx.save();ctx.font='700 14px "Noto Sans SC",sans-serif';ctx.textAlign='center';ctx.fillStyle='#efffff';
        ctx.fillText(labels[w.type],Utils.clamp(bx,130,Renderer.width()-130),Math.max(24,by-b.h-44));ctx.restore();
        return true;
    }
    return { init, update, attack, frame, drawEffects, drawWindup, recover, leapTarget, diveTarget, feintTarget, lanePlan,
        windupScale, comboBudget, tier, profile: prof };
})();
