// ==================== 渲染系统 ====================
const Renderer = (() => {
    let canvas, ctx;
    let width, height;
    let initialized = false;

    // 关卡氛围色与飘尘
    let ambientColor = '#4db8e8';
    let ambientKind = 'dust';
    let bgTheme = 'city';
    let motes = [];
    const AMBIENT_THEMES = [
        { color: '#d4953a', kind: 'ember', theme: 'city' },   // 废弃工厂：火星
        { color: '#7ce7a8', kind: 'firefly', theme: 'forest' }, // 黑暗森林：萤火
        { color: '#ff6a2a', kind: 'ember', theme: 'lava' },   // 熔岩地穴：火星
        { color: '#cfefff', kind: 'snow', theme: 'ice' },    // 极寒冰原：雪
        { color: '#b88cff', kind: 'firefly', theme: 'void' }, // 虚空幻境：虚空粒子
        { color: '#ff5a7a', kind: 'ember', theme: 'chaos' },   // 终焉之境
    ];

    function setAmbient(index) {
        const theme = AMBIENT_THEMES[index] || AMBIENT_THEMES[0];
        ambientColor = theme.color;
        ambientKind = theme.kind;
        bgTheme = theme.theme;
        motes = [];
        for (let i = 0; i < 70; i++) {
            motes.push({
                x: Math.random(), y: Math.random(),
                z: Utils.rand(0.3, 1.2),
                size: Utils.rand(0.8, 2.6),
                phase: Utils.rand(0, Math.PI * 2),
                speed: Utils.rand(0.6, 1.4),
            });
        }
    }

    function drawMotes(time) {
        if (!motes.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rgb = hexToRgba(ambientColor, 1).replace('rgba(', '').replace(', 1)', '').replace(/ /g, '');
        for (const m of motes) {
            let vx = 0, vy = 0;
            if (ambientKind === 'ember') { vy = -0.035 * m.speed; vx = Math.sin(time * 0.7 + m.phase) * 0.01; }
            else if (ambientKind === 'snow') { vy = 0.03 * m.speed; vx = -0.02 + Math.sin(time + m.phase) * 0.01; }
            else { vx = Math.sin(time * 0.5 + m.phase) * 0.012; vy = Math.cos(time * 0.4 + m.phase) * 0.01; }
            m.x += vx * 0.016; m.y += vy * 0.016;
            const px = (((m.x - Utils.camera.x * 0.0004 * m.z) % 1) + 1) % 1 * width;
            const py = ((m.y % 1) + 1) % 1 * height;
            const flick = ambientKind === 'firefly' ? (Math.sin(time * 3 * m.speed + m.phase) * 0.5 + 0.5) : 0.8;
            const a = 0.5 * flick * m.z;
            const r = m.size * m.z * 3;
            Utils.drawGlow(ctx, rgb, px, py, r, a);
        }
        ctx.restore();
    }

    // 背景装饰元素
    let bgStars = [];
    let bgDeco = [];
    let bgBeacons = [];

    // 屏幕特效系统
    let flash = { color: '#ffffff', intensity: 0, duration: 0 };
    let transition = { active: false, type: 'scanline', progress: 0, duration: 0.8 };
    let audioPulse = { intensity: 0, decay: 4 };

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        resize();
        if (!initialized) {
            window.addEventListener('resize', resize);
            initialized = true;
        }
    }

    function resize() {
        if (!canvas || !ctx) return;

        const dpr = window.devicePixelRatio || 1;
        width = window.innerWidth;
        height = window.innerHeight;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ==================== 背景生成系统 ====================
    function generateBackground(level) {
        bgStars = [];
        bgDeco = [];
        bgBeacons = [];

        // 星星 - 增加密度和色彩多样性
        for (let i = 0; i < 130; i++) {
            const starColors = ['#6dd0f5', '#a86890', '#fff', '#d4953a', '#ffffff', '#a0d8ef'];
            bgStars.push({
                x: Utils.rand(0, level.levelWidth),
                y: Utils.rand(0, 360),
                size: Utils.rand(0.5, 2.5),
                alpha: Utils.rand(0.15, 0.85),
                twinkle: Utils.rand(0, Math.PI * 2),
                twinkleSpeed: Utils.rand(0.5, 3),
                color: starColors[Utils.randInt(0, 5)],
            });
        }

        // 纵深信标光柱，让高速推进时有更强的方向感
        for (let i = 0; i < 24; i++) {
            bgBeacons.push({
                x: Utils.rand(0, level.levelWidth),
                y: Utils.rand(120, 280),
                height: Utils.rand(120, 260),
                width: Utils.rand(18, 44),
                color: ['#4db8e8', '#a83035', '#d4953a'][Utils.randInt(0, 2)],
                phase: Utils.rand(0, Math.PI * 2),
            });
        }

        // L0 远景：天际线剪影（18个）- 深色大块建筑群
        for (let i = 0; i < 18; i++) {
            const x = Utils.rand(50, level.levelWidth - 120);
            bgDeco.push({
                x, layer: 0,
                type: Utils.randInt(0, 1), // 0=skyline集群, 1=远塔
                height: Utils.rand(140, 320),
                width: Utils.rand(50, 140),
                variant: Utils.randInt(0, 4),
            });
        }

        // L1 中景：城市建筑（20个）- 带窗格和霓虹
        for (let i = 0; i < 20; i++) {
            const x = Utils.rand(30, level.levelWidth - 80);
            bgDeco.push({
                x, layer: 1,
                type: Utils.randInt(0, 3), // 0=城区楼, 1=工厂, 2=霓虹楼, 3=住宅群
                height: Utils.rand(70, 200),
                width: Utils.rand(35, 100),
                variant: Utils.randInt(0, 3),
                neonColor: ['#4db8e8', '#a83035', '#6dd0f5', '#d4953a'][Utils.randInt(0, 3)],
            });
        }

        // L2 近景：工业细节（18个）- 高细节结构件
        for (let i = 0; i < 18; i++) {
            const x = Utils.rand(20, level.levelWidth - 60);
            bgDeco.push({
                x, layer: 2,
                type: Utils.randInt(0, 4), // 0=管廊, 1=天线塔, 2=广告牌, 3=巨型风扇, 4=吊车
                height: Utils.rand(50, 160),
                width: Utils.rand(25, 75),
                variant: Utils.randInt(0, 3),
                phase: Utils.rand(0, Math.PI * 2),
            });
        }

        bgDeco.sort((a, b) => a.layer - b.layer);
    }

    // ==================== 背景渲染系统 ====================
    function drawBackground(level, time) {
        const baseY = height - 70;

        // 天空渐变
        const grad = typeof level.bgGradient === 'function'
            ? level.bgGradient(ctx, width, height)
            : '#0f1428';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        drawSkyPressure(time);

        if (bgTheme !== 'city') {
            drawThemedBackdrop(time);
            drawMotes(time);
            const shade = ctx.createLinearGradient(0, 0, 0, height);
            shade.addColorStop(0, 'rgba(2, 5, 14, 0.12)');
            shade.addColorStop(1, 'rgba(2, 8, 16, 0.2)');
            ctx.fillStyle = shade;
            ctx.fillRect(0, 0, width, height);
            return;
        }

        // ---- L0 远景天际线 (视差 0.15) ----
        const parFar = Utils.camera.x * 0.15;
        for (const d of bgDeco) {
            if (d.layer !== 0) continue;
            const dx = d.x - parFar;
            if (dx < -200 || dx > width + 200) continue;
            drawLayer0(dx, d, baseY, time);
        }

        // 大气雾层 (远景→中景之间)
        drawHaze(0.3, 0.55);

        // 星星 (视差 0.2)
        const parStar = Utils.camera.x * 0.2;
        for (const s of bgStars) {
            const sx = ((s.x - parStar) % (width + 100) + width + 100) % (width + 100);
            const twinkle = Math.sin(time * s.twinkleSpeed + s.twinkle) * 0.35 + 0.65;
            ctx.globalAlpha = s.alpha * twinkle;
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(sx, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        drawAtmosphereStreaks(time);

        // ---- L1 中景城市 (视差 0.35) ----
        const parMid = Utils.camera.x * 0.35;
        for (const d of bgDeco) {
            if (d.layer !== 1) continue;
            const dx = d.x - parMid;
            if (dx < -150 || dx > width + 150) continue;
            drawLayer1(dx, d, baseY, time);
        }
        drawBeaconLanes(time);

        // 大气雾层 (中景→近景之间)
        drawHaze(0.18, 0.4);

        // ---- L2 近景工业 (视差 0.5) ----
        const parNear = Utils.camera.x * 0.5;
        for (const d of bgDeco) {
            if (d.layer !== 2) continue;
            const dx = d.x - parNear;
            if (dx < -120 || dx > width + 120) continue;
            drawLayer2(dx, d, baseY, time);
        }
        drawRunwayGuides(level, time);
        drawMotes(time);

        const focusShade = ctx.createLinearGradient(0, 0, 0, height);
        focusShade.addColorStop(0, 'rgba(2, 5, 14, 0.16)');
        focusShade.addColorStop(0.45, 'rgba(2, 5, 14, 0.08)');
        focusShade.addColorStop(1, 'rgba(2, 8, 16, 0.22)');
        ctx.fillStyle = focusShade;
        ctx.fillRect(0, 0, width, height);
    }


    // ==================== 主题背景（每关独立美术）====================
    const THEMES = {
        forest: {
            ridges: [
                { par: 0.06, amp: 150, lift: 150, color: '#16223a', seed: 1.3, deco: null },
                { par: 0.18, amp: 90,  lift: 70,  color: '#0f1b2c', seed: 4.1, deco: 'pine' },
                { par: 0.38, amp: 60,  lift: 20,  color: '#0a1420', seed: 7.7, deco: 'pine' },
            ],
            fog: 'rgba(120, 190, 170, 0.10)',
        },
        lava: {
            ridges: [
                { par: 0.06, amp: 130, lift: 140, color: '#2a0f12', seed: 2.2, deco: null },
                { par: 0.2,  amp: 100, lift: 60,  color: '#1c0a0c', seed: 5.4, deco: 'rock' },
                { par: 0.4,  amp: 70,  lift: 15,  color: '#120607', seed: 8.8, deco: 'rock' },
            ],
            fog: 'rgba(255, 90, 30, 0.10)',
        },
        ice: {
            ridges: [
                { par: 0.05, amp: 220, lift: 160, color: '#2a3f5e', seed: 3.3, deco: 'snowcap' },
                { par: 0.16, amp: 120, lift: 80,  color: '#1d2e48', seed: 6.6, deco: 'snowcap' },
                { par: 0.36, amp: 60,  lift: 20,  color: '#132036', seed: 9.9, deco: 'crystal' },
            ],
            fog: 'rgba(200, 235, 255, 0.10)',
        },
        void: {
            ridges: [
                { par: 0.08, amp: 0, lift: 0, color: '#1a1030', seed: 1.9, deco: 'islands' },
                { par: 0.22, amp: 0, lift: 0, color: '#120a24', seed: 3.7, deco: 'islands' },
            ],
            fog: 'rgba(160, 110, 255, 0.10)',
        },
        chaos: {
            ridges: [
                { par: 0.06, amp: 180, lift: 150, color: '#2a0d18', seed: 2.9, deco: 'spire' },
                { par: 0.2,  amp: 110, lift: 70,  color: '#1c0811', seed: 5.1, deco: 'spire' },
                { par: 0.4,  amp: 60,  lift: 20,  color: '#12050b', seed: 7.3, deco: 'rock' },
            ],
            fog: 'rgba(255, 70, 110, 0.10)',
        },
    };

    function ridgeH(x, seed) {
        return 0.5 + 0.28 * Math.sin(x * 0.0037 + seed) + 0.14 * Math.sin(x * 0.0113 + seed * 2.3) + 0.08 * Math.sin(x * 0.031 + seed * 4.1);
    }

    function hash(n) {
        const x = Math.sin(n * 127.1) * 43758.5453;
        return x - Math.floor(x);
    }

    function drawThemedBackdrop(time) {
        const th = THEMES[bgTheme];
        if (!th) return;
        const horizon = Math.min(height - 40, 500 - Utils.camera.y + 12);
        drawCelestial(time, horizon);

        // 星空
        if (bgTheme !== 'lava') {
            const parStar = Utils.camera.x * 0.03;
            for (const st of bgStars) {
                const sx = ((st.x - parStar) % (width + 100) + width + 100) % (width + 100);
                const tw = Math.sin(time * st.twinkleSpeed + st.twinkle) * 0.35 + 0.65;
                ctx.globalAlpha = st.alpha * tw * 0.8;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(sx, st.y * 0.8, st.size, st.size);
            }
            ctx.globalAlpha = 1;
        }

        th.ridges.forEach((r, li) => {
            const off = Utils.camera.x * r.par;
            if (r.deco === 'islands') {
                drawIslands(off, r, li, time, horizon);
            } else {
                const base = horizon - r.lift;
                ctx.fillStyle = r.color;
                ctx.beginPath();
                ctx.moveTo(0, height);
                const step = 14;
                for (let x = -step; x <= width + step; x += step) {
                    const wx = x + off;
                    const y = base - ridgeH(wx, r.seed) * r.amp;
                    ctx.lineTo(x, y);
                }
                ctx.lineTo(width, height);
                ctx.closePath();
                ctx.fill();
                drawRidgeDeco(r, off, base, time, li);
            }
            // 层间雾
            const fogG = ctx.createLinearGradient(0, horizon - r.lift - r.amp * 0.6, 0, horizon + 20);
            fogG.addColorStop(0, 'rgba(0,0,0,0)');
            fogG.addColorStop(1, th.fog);
            ctx.fillStyle = fogG;
            ctx.fillRect(0, horizon - r.lift - r.amp, width, r.amp + r.lift + 60);
        });

        // 熔岩：底部炽热辉光 + 顶部钟乳石
        if (bgTheme === 'lava') {
            const glow = ctx.createLinearGradient(0, horizon - 120, 0, height);
            glow.addColorStop(0, 'rgba(255, 80, 20, 0)');
            glow.addColorStop(1, `rgba(255, 90, 20, ${0.28 + Math.sin(time * 1.5) * 0.06})`);
            ctx.fillStyle = glow;
            ctx.fillRect(0, horizon - 120, width, height);
            ctx.fillStyle = '#100506';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const off = Utils.camera.x * 0.25;
            for (let x = 0; x <= width + 20; x += 20) {
                const wx = x + off;
                const k = Math.floor(wx / 20);
                const len = 20 + hash(k) * 70 * (hash(k * 3.1) > 0.6 ? 1.6 : 0.6);
                ctx.lineTo(x - 10, 18 + hash(k + 9) * 10);
                ctx.lineTo(x, len);
            }
            ctx.lineTo(width, 0);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawCelestial(time, horizon) {
        const px = width * 0.74 - Utils.camera.x * 0.015;
        ctx.save();
        if (bgTheme === 'forest') {
            Utils.drawGlow(ctx, '190,230,255', px, 120, 190, 0.35);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#e9f4ff';
            ctx.beginPath(); ctx.arc(px, 120, 46, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(160, 185, 210, 0.35)';
            ctx.beginPath(); ctx.arc(px - 14, 110, 9, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(px + 12, 132, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(px + 16, 104, 4, 0, Math.PI * 2); ctx.fill();
        } else if (bgTheme === 'ice') {
            // 极光
            ctx.globalCompositeOperation = 'lighter';
            const bands = [['80,255,190', 0], ['90,200,255', 1.7], ['170,120,255', 3.1]];
            for (const [col, ph] of bands) {
                ctx.beginPath();
                for (let x = 0; x <= width; x += 20) {
                    const y = 90 + Math.sin(x * 0.006 + time * 0.4 + ph) * 34 + Math.sin(x * 0.013 - time * 0.25 + ph) * 16 + ph * 14;
                    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                for (let x = width; x >= 0; x -= 20) {
                    const y = 90 + Math.sin(x * 0.006 + time * 0.4 + ph) * 34 + Math.sin(x * 0.013 - time * 0.25 + ph) * 16 + ph * 14 + 70;
                    ctx.lineTo(x, y);
                }
                ctx.closePath();
                const g = ctx.createLinearGradient(0, 60, 0, 220);
                g.addColorStop(0, `rgba(${col},0.18)`);
                g.addColorStop(1, `rgba(${col},0)`);
                ctx.fillStyle = g;
                ctx.fill();
            }
        } else if (bgTheme === 'void') {
            // 带环巨行星 + 旋涡
            const cx = px - 60, cy = 150;
            const vg = ctx.createRadialGradient(cx, cy, 10, cx, cy, 300);
            vg.addColorStop(0, 'rgba(180, 120, 255, 0.22)');
            vg.addColorStop(1, 'rgba(80, 40, 160, 0)');
            ctx.fillStyle = vg;
            ctx.fillRect(cx - 300, cy - 300, 600, 600);
            ctx.strokeStyle = 'rgba(200, 160, 255, 0.12)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.ellipse(cx, cy, 120 + i * 40, 40 + i * 14, time * 0.05 + i * 0.4, 0, Math.PI * 1.3);
                ctx.stroke();
            }
            const pg = ctx.createRadialGradient(cx - 20, cy - 20, 5, cx, cy, 70);
            pg.addColorStop(0, '#8d6bd8');
            pg.addColorStop(0.7, '#3b2370');
            pg.addColorStop(1, '#1a0f38');
            ctx.fillStyle = pg;
            ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(220, 190, 255, 0.55)';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(cx, cy, 120, 22, -0.25, 0, Math.PI * 2); ctx.stroke();
        } else if (bgTheme === 'chaos') {
            // 日蚀：黑日 + 血色日冕
            const cx = px, cy = 130;
            Utils.drawGlow(ctx, '255,60,90', cx, cy, 230, 0.55 + Math.sin(time * 2) * 0.08);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = 'rgba(255, 150, 160, 0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, cy, 54, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#05010a';
            ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();
            // 偶发血色闪电
            const flashT = (time * 0.37) % 1;
            if (flashT < 0.03) {
                ctx.strokeStyle = 'rgba(255, 140, 170, 0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                let lx = width * (0.2 + hash(Math.floor(time * 0.37)) * 0.6), ly = 0;
                ctx.moveTo(lx, ly);
                while (ly < horizon - 100) { lx += (Math.random() - 0.5) * 40; ly += 20 + Math.random() * 20; ctx.lineTo(lx, ly); }
                ctx.stroke();
                ctx.fillStyle = 'rgba(255, 120, 150, 0.06)';
                ctx.fillRect(0, 0, width, height);
            }
        } else if (bgTheme === 'lava') {
            Utils.drawGlow(ctx, '255,110,40', width * 0.5, horizon, 500, 0.25);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawRidgeDeco(r, off, base, time, li) {
        if (!r.deco) return;
        const spacing = r.deco === 'pine' ? 26 + li * 6 : r.deco === 'spire' ? 140 : r.deco === 'crystal' ? 90 : r.deco === 'snowcap' ? 1 : 110;
        if (r.deco === 'snowcap') {
            // 山顶积雪：沿山脊上沿画一条亮线
            ctx.strokeStyle = li === 0 ? 'rgba(230, 245, 255, 0.35)' : 'rgba(230, 245, 255, 0.22)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let x = 0; x <= width; x += 14) {
                const y = base - ridgeH(x + off, r.seed) * r.amp;
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
            return;
        }
        const start = Math.floor(off / spacing) - 1;
        const end = Math.ceil((off + width) / spacing) + 1;
        ctx.fillStyle = r.color;
        for (let k = start; k <= end; k++) {
            const rnd = hash(k * 1.7 + r.seed);
            const wx = k * spacing + rnd * spacing * 0.6;
            const x = wx - off;
            const y = base - ridgeH(wx, r.seed) * r.amp + 2;
            if (r.deco === 'pine') {
                const h = 30 + rnd * 40 + li * 10;
                const w = h * 0.36;
                ctx.beginPath();
                ctx.moveTo(x, y - h);
                ctx.lineTo(x + w * 0.55, y - h * 0.55);
                ctx.lineTo(x + w * 0.3, y - h * 0.55);
                ctx.lineTo(x + w, y);
                ctx.lineTo(x - w, y);
                ctx.lineTo(x - w * 0.3, y - h * 0.55);
                ctx.lineTo(x - w * 0.55, y - h * 0.55);
                ctx.closePath();
                ctx.fill();
            } else if (r.deco === 'rock') {
                const h = 20 + rnd * 60;
                ctx.beginPath();
                ctx.moveTo(x - 14, y);
                ctx.lineTo(x - 6, y - h);
                ctx.lineTo(x + 4, y - h * 0.8);
                ctx.lineTo(x + 14, y);
                ctx.closePath();
                ctx.fill();
                if (bgTheme === 'lava' && rnd > 0.55) {
                    ctx.strokeStyle = `rgba(255, 110, 40, ${0.35 + Math.sin(time * 2 + k) * 0.15})`;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(x - 4, y - h * 0.9); ctx.lineTo(x - 1, y - h * 0.5); ctx.lineTo(x - 5, y - h * 0.2);
                    ctx.stroke();
                }
            } else if (r.deco === 'crystal') {
                const h = 30 + rnd * 50;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = `rgba(150, 220, 255, ${0.08 + rnd * 0.08})`;
                ctx.beginPath();
                ctx.moveTo(x, y - h); ctx.lineTo(x + 9, y - h * 0.3); ctx.lineTo(x, y); ctx.lineTo(x - 9, y - h * 0.3);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(200, 240, 255, 0.25)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
                ctx.fillStyle = r.color;
            } else if (r.deco === 'spire') {
                const h = 80 + rnd * 120;
                ctx.beginPath();
                ctx.moveTo(x - 12, y);
                ctx.lineTo(x - 2, y - h);
                ctx.lineTo(x + 3, y - h * 0.9);
                ctx.lineTo(x + 12, y);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = `rgba(255, 70, 110, ${0.5 + Math.sin(time * 3 + k) * 0.3})`;
                ctx.fillRect(x - 1.5, y - h * 0.7, 3, 3);
                ctx.fillStyle = r.color;
            }
        }
    }

    function drawIslands(off, r, li, time, horizon) {
        const spacing = 260 + li * 120;
        const start = Math.floor(off / spacing) - 1;
        const end = Math.ceil((off + width) / spacing) + 1;
        for (let k = start; k <= end; k++) {
            const rnd = hash(k * 2.3 + r.seed);
            const x = k * spacing + rnd * 120 - off;
            const y = horizon - 160 - rnd * 160 + li * 60 + Math.sin(time * 0.6 + k) * 8;
            const w = 50 + rnd * 70 + li * 20;
            ctx.fillStyle = r.color;
            ctx.beginPath();
            ctx.moveTo(x - w, y);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x + w * 0.4, y + w * 0.5);
            ctx.lineTo(x, y + w * 0.9);
            ctx.lineTo(x - w * 0.5, y + w * 0.45);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = `rgba(190, 140, 255, ${0.25 + rnd * 0.2})`;
            ctx.fillRect(x - w, y - 2, w * 2, 2);
            if (rnd > 0.4) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                Utils.drawGlow(ctx, '180,130,255', x, y + w * 0.9, 18, 0.5 + Math.sin(time * 2 + k) * 0.2);
                ctx.restore();
                ctx.globalAlpha = 1;
            }
        }
    }

    function drawSkyPressure(time) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        const sweep = (Math.sin(time * 0.18) * 0.5 + 0.5) * width;
        const leftBeam = ctx.createLinearGradient(sweep - width * 0.5, 0, sweep + width * 0.4, height);
        leftBeam.addColorStop(0, 'rgba(77, 184, 232, 0)');
        leftBeam.addColorStop(0.48, 'rgba(77, 184, 232, 0.08)');
        leftBeam.addColorStop(1, 'rgba(77, 184, 232, 0)');
        ctx.fillStyle = leftBeam;
        ctx.beginPath();
        ctx.moveTo(sweep - 260, 0);
        ctx.lineTo(sweep + 120, 0);
        ctx.lineTo(sweep + width * 0.3, height);
        ctx.lineTo(sweep - width * 0.15, height);
        ctx.closePath();
        ctx.fill();

        const dangerGlow = ctx.createLinearGradient(0, height * 0.12, width, height * 0.64);
        dangerGlow.addColorStop(0, 'rgba(168, 48, 53, 0)');
        dangerGlow.addColorStop(0.62, 'rgba(168, 48, 53, 0.045)');
        dangerGlow.addColorStop(1, 'rgba(168, 48, 53, 0)');
        ctx.fillStyle = dangerGlow;
        ctx.fillRect(0, 0, width, height);

        ctx.restore();
    }

    function drawAtmosphereStreaks(time) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.strokeStyle = 'rgba(125, 195, 230, 0.32)';
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';

        const drift = (time * 240 + Utils.camera.x * 0.18) % 180;
        for (let i = -1; i < Math.ceil(width / 80) + 2; i++) {
            const x = i * 80 + drift - 120;
            const yBase = ((i * 97 + time * 100) % (height * 0.68)) + height * 0.02;
            ctx.beginPath();
            ctx.moveTo(x, yBase);
            ctx.lineTo(x - 30, yBase + 56);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawBeaconLanes(time) {
        const parBeacon = Utils.camera.x * 0.42;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        for (const beacon of bgBeacons) {
            const dx = beacon.x - parBeacon;
            if (dx < -80 || dx > width + 80) continue;

            const pulse = 0.55 + Math.sin(time * 1.8 + beacon.phase) * 0.3;
            const beam = ctx.createLinearGradient(dx, beacon.y, dx, beacon.y + beacon.height);
            beam.addColorStop(0, `${hexToRgba(beacon.color, 0)}`);
            beam.addColorStop(0.35, `${hexToRgba(beacon.color, 0.08 * pulse)}`);
            beam.addColorStop(1, `${hexToRgba(beacon.color, 0)}`);

            ctx.fillStyle = beam;
            ctx.fillRect(dx - beacon.width / 2, beacon.y, beacon.width, beacon.height);
            ctx.fillStyle = hexToRgba(beacon.color, 0.22 * pulse);
            ctx.fillRect(dx - 12, beacon.y + beacon.height * 0.72, 24, 2);
        }

        ctx.restore();
    }

    function drawRunwayGuides(level, time) {
        const floorY = height - 72;
        const stride = 180;
        const start = Math.floor(Utils.camera.x / stride) * stride;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let wx = start - stride; wx < Utils.camera.x + width + stride; wx += stride) {
            const sx = wx - Utils.camera.x;
            const pulse = 0.5 + Math.sin(time * 3 + wx * 0.04) * 0.28;
            const isDanger = ((wx / stride) | 0) % 4 === 0;
            const color = isDanger ? `rgba(168, 48, 53, ${0.2 + pulse * 0.2})` : `rgba(77, 184, 232, ${0.16 + pulse * 0.14})`;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(sx, floorY);
            ctx.lineTo(sx + 58, floorY);
            ctx.lineTo(sx + 34, floorY + 12);
            ctx.lineTo(sx - 24, floorY + 12);
            ctx.closePath();
            ctx.fill();
        }

        const horizon = ctx.createLinearGradient(0, floorY - 22, 0, floorY + 36);
        horizon.addColorStop(0, 'rgba(77, 184, 232, 0)');
        horizon.addColorStop(0.5, 'rgba(77, 184, 232, 0.08)');
        horizon.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = horizon;
        ctx.fillRect(0, floorY - 22, width, 58);
        ctx.restore();
    }

    function hexToRgba(hex, alpha) {
        const value = hex.replace('#', '');
        const r = parseInt(value.slice(0, 2), 16);
        const g = parseInt(value.slice(2, 4), 16);
        const b = parseInt(value.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // 大气雾霾（深度感）
    function drawHaze(intensity, startYRatio) {
        const startY = height * startYRatio;
        const g = ctx.createLinearGradient(0, startY, 0, height);
        g.addColorStop(0, 'transparent');
        g.addColorStop(1, `rgba(10, 14, 30, ${intensity})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
    }

    // ==================== L0 远景：天际线剪影 ====================
    function drawLayer0(dx, d, baseY, time) {
        const h = d.height;
        const w = d.width;

        if (d.type === 0) {
            // 天际线集群 — 多栋摩天楼暗色剪影
            ctx.fillStyle = 'rgba(8, 10, 24, 0.8)';
            ctx.fillRect(dx, baseY - h, w, h);

            // 尖顶/阶梯塔楼
            const tw = Math.max(w * 0.16, 8);
            ctx.fillRect(dx + 2, baseY - h - h * 0.3, tw, h * 0.3);
            ctx.fillRect(dx + w * 0.38, baseY - h - h * 0.18, tw, h * 0.18);
            ctx.fillRect(dx + w * 0.72, baseY - h - h * 0.26, tw, h * 0.26);

            // 极远窗光（微小亮点）
            for (let wy = baseY - h + 10; wy < baseY - 5; wy += 28) {
                for (let wx = dx + 8; wx < dx + w - 6; wx += 22) {
                    if (((wx * 7 + wy * 13 + d.variant) % 10) > 4) {
                        const f = Math.sin(time * 2 + wx) * 0.25 + 0.75;
                        ctx.fillStyle = `rgba(120,175,220,${0.15 * f})`;
                        ctx.fillRect(wx, wy, 3, 2);
                    }
                }
            }
        } else {
            // 远塔 — 细高塔楼+天线+航空灯
            const tw2 = 14;
            ctx.fillStyle = 'rgba(8, 10, 24, 0.75)';
            ctx.fillRect(dx + w / 2 - tw2 / 2, baseY - h, tw2, h);

            // 观景层
            ctx.fillRect(dx + w / 2 - tw2 + 2, baseY - h, tw2 * 2 - 4, 12);

            // 天线
            ctx.fillRect(dx + w / 2 - 1, baseY - h - 22, 2, 22);

            // 红色航空警告灯
            const blink = Math.sin(time * 2.2 + dx) > 0.3 ? 1 : 0;
            ctx.fillStyle = `rgba(255, 40, 40, ${blink * 0.6})`;
            ctx.beginPath();
            ctx.arc(dx + w / 2, baseY - h - 24, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ==================== L1 中景：城市建筑 ====================
    function drawLayer1(dx, d, baseY, time) {
        const h = d.height;
        const w = d.width;
        const nc = d.neonColor;

        switch (d.type) {
            case 0: { // 城区楼块 — 矩形建筑+窗格+屋顶设备
                ctx.fillStyle = 'rgba(15, 18, 35, 0.88)';
                ctx.fillRect(dx, baseY - h, w, h);

                // 屋顶机房/水箱
                ctx.fillStyle = 'rgba(10, 12, 24, 0.92)';
                ctx.fillRect(dx + w * 0.15, baseY - h - 8, w * 0.25, 8);
                ctx.fillRect(dx + w * 0.55, baseY - h - 12, w * 0.22, 12);

                // 窗格网
                for (let wy = baseY - h + 6; wy < baseY - 4; wy += 9) {
                    for (let wx = dx + 6; wx < dx + w - 6; wx += 11) {
                        const lit = ((wx * 7 + wy * 13 + d.variant) % 10) > 2;
                        if (lit) {
                            const flicker = Math.sin(time * 2.5 + wx + wy) * 0.2 + 0.8;
                            ctx.fillStyle = `rgba(135, 190, 230, ${0.35 * flicker})`;
                            ctx.fillRect(wx, wy, 4, 3);
                        }
                    }
                }
                ctx.strokeStyle = 'rgba(30, 40, 70, 0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(dx, baseY - h, w, h);
                break;
            }
            case 1: { // 工厂 — 锯齿屋顶+烟囱+排烟
                ctx.fillStyle = 'rgba(18, 20, 35, 0.88)';
                ctx.fillRect(dx, baseY - h, w, h);

                // 锯齿屋顶
                ctx.fillStyle = 'rgba(12, 14, 24, 0.9)';
                const teethW = w / 4;
                for (let i = 0; i < 4; i++) {
                    const tx = dx + i * teethW;
                    ctx.beginPath();
                    ctx.moveTo(tx, baseY - h);
                    ctx.lineTo(tx + teethW / 2, baseY - h - 14);
                    ctx.lineTo(tx + teethW, baseY - h);
                    ctx.closePath();
                    ctx.fill();
                }

                // 烟囱
                for (let i = 0; i < 2; i++) {
                    const sx = dx + w * 0.25 + i * w * 0.4;
                    const sh = 22 + i * 6;
                    ctx.fillStyle = 'rgba(20, 22, 40, 0.9)';
                    ctx.fillRect(sx, baseY - h - sh, 6, sh);

                    // 飘烟
                    const sa = 0.06 + Math.sin(time * 1.3 + sx) * 0.03;
                    ctx.fillStyle = `rgba(100, 110, 140, ${sa})`;
                    const smX = sx + 3 + Math.sin(time * 0.8 + sx) * 10;
                    const smY = baseY - h - sh - 8 + Math.cos(time * 0.6 + sx) * 6;
                    ctx.beginPath();
                    ctx.arc(smX, smY, 7, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.arc(smX + 5, smY - 4, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                // 厂房大门
                ctx.fillStyle = 'rgba(5, 5, 14, 0.5)';
                ctx.fillRect(dx + w * 0.3, baseY - h * 0.5, w * 0.4, h * 0.5);
                break;
            }
            case 2: { // 霓虹楼 — 暗色楼体+彩色发光条
                ctx.fillStyle = 'rgba(12, 14, 28, 0.88)';
                ctx.fillRect(dx, baseY - h, w, h);

                // 横向霓虹条
                const strips = 2 + d.variant;
                for (let i = 0; i < strips; i++) {
                    const ny = baseY - h + (h / (strips + 1)) * (i + 1);
                    ctx.shadowColor = nc;
                    ctx.shadowBlur = 6;
                    ctx.fillStyle = nc;
                    ctx.fillRect(dx + 3, ny - 1, w - 6, 2);
                    ctx.shadowBlur = 0;
                }
                // 竖向霓虹装饰
                if (d.variant % 2 === 0) {
                    ctx.shadowColor = nc;
                    ctx.shadowBlur = 4;
                    ctx.fillStyle = nc;
                    ctx.fillRect(dx + w * 0.35, baseY - h + 5, 2, h - 10);
                    ctx.shadowBlur = 0;
                }
                break;
            }
            case 3: { // 住宅群 — 2-4栋窄楼拼接，密集窗格
                const count = 2 + (d.variant % 3);
                const bldW = w / count;
                for (let i = 0; i < count; i++) {
                    const bx = dx + i * bldW;
                    const bh = h * (0.55 + Math.sin(i * 2.1 + d.variant * 1.7) * 0.35);
                    const bw = bldW - 3;
                    ctx.fillStyle = 'rgba(16, 18, 35, 0.88)';
                    ctx.fillRect(bx, baseY - bh, bw, bh);
                    ctx.fillStyle = 'rgba(10, 12, 24, 0.9)';
                    ctx.fillRect(bx + 1, baseY - bh - 2, bw - 2, 2);

                    for (let wy = baseY - bh + 5; wy < baseY - 4; wy += 7) {
                        for (let wx = bx + 3; wx < bx + bw - 4; wx += 9) {
                            const lit = ((wx * 11 + wy * 7 + d.variant * 3) % 8) > 3;
                            ctx.fillStyle = lit ? 'rgba(150, 195, 230, 0.28)' : 'rgba(15, 18, 35, 0.5)';
                            ctx.fillRect(wx, wy, 3, 2);
                        }
                    }
                }
                break;
            }
        }
    }

    // ==================== L2 近景：工业细节 ====================
    function drawLayer2(dx, d, baseY, time) {
        const h = d.height;
        const w = d.width;

        switch (d.type) {
            case 0: { // 管廊 — 支撑柱+横梁+多层管道
                const colW = 3;
                const cols = Math.floor(w / 18) + 2;
                ctx.fillStyle = 'rgba(20, 22, 38, 0.92)';
                for (let i = 0; i < cols; i++) {
                    const cx = dx + (w / Math.max(cols - 1, 1)) * i - colW / 2;
                    ctx.fillRect(cx, baseY - h, colW, h);
                }
                ctx.fillRect(dx, baseY - h, w, 3);

                const pipes = 3;
                for (let i = 0; i < pipes; i++) {
                    const py = baseY - h + 8 + i * 16;
                    ctx.fillStyle = 'rgba(50, 55, 75, 0.8)';
                    ctx.fillRect(dx + 2, py, w - 4, 3);
                    ctx.fillStyle = 'rgba(80, 85, 110, 0.25)';
                    ctx.fillRect(dx + 2, py, w - 4, 1);
                }
                // 法兰接头
                for (let i = 0; i < cols; i++) {
                    const jx = dx + (w / Math.max(cols - 1, 1)) * i - 2;
                    ctx.fillStyle = 'rgba(35, 38, 55, 0.9)';
                    ctx.fillRect(jx, baseY - h + 6, 4, h - 6);
                }
                break;
            }
            case 1: { // 天线塔 — 三角桁架+红色闪烁信标
                const cx = dx + w / 2;
                const topY = baseY - h;
                ctx.fillStyle = 'rgba(18, 20, 35, 0.92)';
                ctx.fillRect(cx - 1.5, topY, 3, h);

                const segs = Math.floor(h / 20);
                for (let i = 0; i < segs; i++) {
                    const sy = topY + i * 20;
                    const bw2 = 8 - i * 0.35;
                    ctx.fillRect(cx - bw2 / 2, sy, bw2, 1.5);
                }
                // 拉线
                ctx.strokeStyle = 'rgba(25, 28, 45, 0.25)';
                ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(cx, topY); ctx.lineTo(cx - w / 2, baseY); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx, topY); ctx.lineTo(cx + w / 2, baseY); ctx.stroke();

                ctx.fillRect(cx - 0.5, topY - 22, 1, 22);

                const blink2 = Math.sin(time * 2.5 + d.phase) > 0.15 ? 1 : 0;
                ctx.fillStyle = `rgba(168, 48, 53, ${blink2 * 0.75})`;
                ctx.beginPath(); ctx.arc(cx, topY - 24, 3.5, 0, Math.PI * 2); ctx.fill();
                if (blink2) {
                    ctx.fillStyle = 'rgba(168, 48, 53, 0.18)';
                    ctx.beginPath(); ctx.arc(cx, topY - 24, 9, 0, Math.PI * 2); ctx.fill();
                }
                break;
            }
            case 2: { // 广告牌 — 支架+框架+霓虹残片
                ctx.fillStyle = 'rgba(20, 22, 38, 0.92)';
                ctx.fillRect(dx + w * 0.1, baseY - h, 3, h);
                ctx.fillRect(dx + w * 0.9 - 3, baseY - h, 3, h);

                const bdH2 = h * 0.58;
                const bdY2 = baseY - h;
                ctx.strokeStyle = 'rgba(30, 33, 50, 0.85)';
                ctx.lineWidth = 2;
                ctx.strokeRect(dx, bdY2, w, bdH2);

                ctx.strokeStyle = 'rgba(25, 28, 42, 0.35)';
                ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(dx, bdY2); ctx.lineTo(dx + w, bdY2 + bdH2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(dx + w, bdY2); ctx.lineTo(dx, bdY2 + bdH2); ctx.stroke();

                ctx.fillStyle = 'rgba(8, 10, 20, 0.3)';
                ctx.fillRect(dx + 4, bdY2 + 4, w * 0.42, bdH2 - 8);
                ctx.fillRect(dx + w * 0.58, bdY2 + 4, w * 0.38, bdH2 - 8);

                const nFlick = Math.sin(time * 4 + d.phase) * 0.3 + Math.sin(time * 7 + dx) * 0.2;
                if (nFlick > -0.1) {
                    const na = Math.max(0, nFlick * 0.5 + 0.12);
                    ctx.fillStyle = `rgba(77, 184, 232, ${na})`;
                    ctx.fillRect(dx, bdY2 + bdH2 - 3, w, 2);
                }
                break;
            }
            case 3: { // 巨型风扇 — 圆形外壳+旋转叶片
                const fcx = dx + w / 2;
                const fcy = baseY - h / 2;
                const fr = Math.min(w / 2, h / 2) - 4;

                ctx.fillStyle = 'rgba(18, 20, 35, 0.9)';
                ctx.beginPath(); ctx.arc(fcx, fcy, fr, 0, Math.PI * 2); ctx.fill();

                ctx.strokeStyle = 'rgba(35, 38, 55, 0.8)';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(fcx, fcy, fr, 0, Math.PI * 2); ctx.stroke();

                ctx.strokeStyle = 'rgba(25, 28, 45, 0.45)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(fcx, fcy - fr + 3); ctx.lineTo(fcx, fcy + fr - 3); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(fcx - fr + 3, fcy); ctx.lineTo(fcx + fr - 3, fcy); ctx.stroke();

                const ba = time * 0.4 + d.phase;
                ctx.strokeStyle = 'rgba(40, 45, 65, 0.55)';
                ctx.lineWidth = 1.5;
                for (let b = 0; b < 4; b++) {
                    const a = ba + b * Math.PI / 2;
                    ctx.beginPath();
                    ctx.moveTo(fcx, fcy);
                    ctx.lineTo(fcx + Math.cos(a) * fr * 0.72, fcy + Math.sin(a) * fr * 0.72);
                    ctx.stroke();
                }

                ctx.fillStyle = 'rgba(50, 55, 75, 0.9)';
                ctx.beginPath(); ctx.arc(fcx, fcy, 5, 0, Math.PI * 2); ctx.fill();

                ctx.fillStyle = 'rgba(20, 22, 38, 0.9)';
                ctx.fillRect(fcx - 2, fcy + fr, 4, baseY - fcy - fr);
                break;
            }
            case 4: { // 吊车 — 竖塔+横臂+吊索+驾驶舱
                const crX = dx + w / 2;
                ctx.fillStyle = 'rgba(18, 20, 35, 0.92)';
                ctx.fillRect(crX - 2.5, baseY - h, 5, h);

                for (let i = 0; i < Math.floor(h / 14); i++) {
                    ctx.fillRect(crX - 4, baseY - h + i * 14, 8, 1);
                }

                const bmH = h * 0.12;
                ctx.fillStyle = 'rgba(18, 20, 35, 0.9)';
                ctx.fillRect(dx, baseY - h - bmH, w, 2.5);
                for (let i = 0; i < Math.floor(w / 10); i++) {
                    ctx.fillRect(dx + i * 10, baseY - h - bmH, 1, bmH);
                }

                ctx.fillStyle = 'rgba(12, 14, 24, 0.9)';
                ctx.fillRect(crX - 6, baseY - h * 0.38, 12, 9);

                const cbX = dx + w * 0.78;
                ctx.strokeStyle = 'rgba(30, 33, 50, 0.55)';
                ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(cbX, baseY - h - bmH); ctx.lineTo(cbX, baseY - h * 0.3); ctx.stroke();

                ctx.fillStyle = 'rgba(35, 38, 55, 0.8)';
                ctx.fillRect(cbX - 2, baseY - h * 0.3, 4, 8);
                break;
            }
        }
    }

    function drawPlatforms(level) {
        for (const p of level.platforms) {
            const sx = p.x - Utils.camera.x;
            const sy = p.y - Utils.camera.y;
            if (sx + p.w < -50 || sx > width + 50) continue;

            if (p.h > 50) {
                // 地面 - 增强材质感（向下延伸填满屏幕，避免地面下方露出背景）
                const fillH = Math.max(p.h, height - sy + 20);
                ctx.fillStyle = level.groundColor;
                ctx.fillRect(sx, sy, p.w, fillH);
                const deep = ctx.createLinearGradient(0, sy + 30, 0, sy + fillH);
                deep.addColorStop(0, 'rgba(0,0,0,0)');
                deep.addColorStop(1, 'rgba(0,0,0,0.55)');
                ctx.fillStyle = deep;
                ctx.fillRect(sx, sy + 30, p.w, fillH - 30);
                // 边缘霓虹描线
                ctx.fillStyle = hexToRgba(ambientColor, 0.55);
                ctx.fillRect(sx, sy - 1, p.w, 1.5);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
                ctx.fillRect(sx, sy + 10, p.w, fillH - 10);
                // 顶部细节（金属边缘）
                const topGrad = ctx.createLinearGradient(sx, sy, sx, sy + 8);
                topGrad.addColorStop(0, level.groundDetail);
                topGrad.addColorStop(1, level.groundColor);
                ctx.fillStyle = topGrad;
                ctx.fillRect(sx, sy, p.w, 8);
                ctx.fillStyle = 'rgba(145, 200, 235, 0.28)';
                ctx.fillRect(sx, sy, p.w, 2);
                ctx.fillStyle = 'rgba(77, 184, 232, 0.14)';
                for (let tx = sx + 16; tx < sx + p.w; tx += 96) {
                    ctx.beginPath();
                    ctx.moveTo(tx, sy + 3);
                    ctx.lineTo(tx + 24, sy + 3);
                    ctx.lineTo(tx + 14, sy + 8);
                    ctx.lineTo(tx - 10, sy + 8);
                    ctx.closePath();
                    ctx.fill();
                }
                // 地面纹理（更丰富的细节）
                ctx.fillStyle = 'rgba(0,0,0,0.12)';
                for (let tx = sx; tx < sx + p.w; tx += 35) {
                    ctx.fillRect(tx, sy + 18, 18, 2);
                    ctx.fillRect(tx + 12, sy + 38, 22, 2);
                    ctx.fillRect(tx + 5, sy + 58, 15, 2);
                }
                // 金属接缝线
                ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                ctx.lineWidth = 1;
                for (let tx = sx; tx < sx + p.w; tx += 80) {
                    ctx.beginPath();
                    ctx.moveTo(tx, sy + 10);
                    ctx.lineTo(tx, sy + p.h);
                    ctx.stroke();
                }
                // 顶部磨损高光
                ctx.fillStyle = 'rgba(255,255,255,0.04)';
                ctx.fillRect(sx, sy, p.w, 2);
            } else {
                // 浮动平台 - 增强材质和发光
                const isMoving = p.moving && (p.moving.ampX || p.moving.ampY);
                const time = p._phase || 0;

                if (isMoving) {
                    // 移动残影轨迹（多层）
                    for (let i = 1; i <= 3; i++) {
                        const ghostAlpha = (0.08 - i * 0.02) + Math.sin(time) * 0.02;
                        const ghostOffset = (p._dx || 0) * i * 2;
                        ctx.fillStyle = `rgba(241, 196, 15, ${ghostAlpha})`;
                        roundRect(ctx, sx + ghostOffset, sy + 1, p.w, p.h, 4);
                        ctx.fill();
                    }

                    // 发光辉光（更强）
                    const glowAlpha = 0.35 + Math.sin(time) * 0.15;
                    ctx.shadowColor = '#d4953a';
                    ctx.shadowBlur = 14 + Math.sin(time) * 5;
                    ctx.fillStyle = '#3a5a4a';
                } else {
                    ctx.fillStyle = level.platformColor;
                }
                const r = 4;
                roundRect(ctx, sx, sy, p.w, p.h, r);
                ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;

                // 平台顶部细节（机械纹理）
                if (isMoving) {
                    // 移动平台：能量条纹
                    ctx.fillStyle = '#d4953a';
                    ctx.fillRect(sx + 4, sy, p.w - 8, 2);
                    for (let ax = sx + 12; ax < sx + p.w - 12; ax += 18) {
                        ctx.strokeStyle = 'rgba(212, 149, 58, 0.48)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(ax, sy + p.h - 5);
                        ctx.lineTo(ax + 8, sy + p.h / 2);
                        ctx.lineTo(ax, sy + 5);
                        ctx.stroke();
                    }
                    // 能量流动动画
                    const flowOffset = (time * 20) % p.w;
                    ctx.fillStyle = 'rgba(255,255,255,0.5)';
                    ctx.fillRect(sx + 4 + flowOffset, sy, 6, 2);
                } else {
                    // 静止平台：金属质感
                    const platGrad = ctx.createLinearGradient(sx, sy, sx, sy + p.h);
                    platGrad.addColorStop(0, level.platformDetail);
                    platGrad.addColorStop(0.5, level.platformColor);
                    platGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
                    ctx.fillStyle = platGrad;
                    roundRect(ctx, sx, sy, p.w, p.h, r);
                    ctx.fill();
                    // 顶部高光（脉冲）
                    const pulseAlpha = 0.3 + Math.sin(time * 0.5) * 0.1;
                    ctx.fillStyle = `rgba(255,255,255,${pulseAlpha})`;
                    ctx.fillRect(sx + 4, sy, p.w - 8, 2);
                    ctx.strokeStyle = 'rgba(77, 184, 232, 0.18)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(sx + 6, sy + p.h - 3);
                    ctx.lineTo(sx + p.w - 6, sy + p.h - 3);
                    ctx.stroke();
                }

                // 底部阴影（渐变）
                const shadowGrad = ctx.createLinearGradient(sx + 6, sy + p.h, sx + 6, sy + p.h + 8);
                shadowGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
                shadowGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = shadowGrad;
                ctx.fillRect(sx + 6, sy + p.h, p.w - 12, 8);

                // 平台侧面铆钉细节
                if (p.w > 60) {
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.beginPath();
                    ctx.arc(sx + 8, sy + p.h / 2, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(sx + p.w - 8, sy + p.h / 2, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    function roundRect(ctx, x, y, w, h, r) {
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

    // 屏幕震动（创伤值模型：多次震动叠加而不是互相覆盖）+ 方向性镜头踢动
    let trauma = 0;
    let shakeTime = 0;
    let kick = { x: 0, y: 0, vx: 0, vy: 0 };
    let shakeEnabled = true;

    function shake(amount, duration) {
        // amount 以像素为量级；duration 越长衰减越慢
        const add = Math.min(1, amount / 14) * Math.min(1.5, 0.6 + (duration || 0.1) * 2);
        trauma = Math.min(1, trauma + add * 0.6);
    }

    function addKick(dx, dy) {
        kick.vx += dx * 60;
        kick.vy += dy * 60;
    }

    function setShakeEnabled(v) { shakeEnabled = v; }

    function applyShake(dt) {
        shakeTime += dt;
        // 弹簧回中
        kick.vx += (-kick.x * 520 - kick.vx * 26) * dt;
        kick.vy += (-kick.y * 520 - kick.vy * 26) * dt;
        kick.x += kick.vx * dt;
        kick.y += kick.vy * dt;
        trauma = Math.max(0, trauma - dt * 1.7);

        const t2 = trauma * trauma;
        let dx = kick.x, dy = kick.y, rot = 0;
        if (t2 > 0.0005 && shakeEnabled) {
            const maxOff = 26;
            dx += maxOff * t2 * (Math.sin(shakeTime * 61.3) * 0.6 + Math.sin(shakeTime * 97.1 + 1.7) * 0.4);
            dy += maxOff * t2 * (Math.sin(shakeTime * 71.9 + 3.1) * 0.6 + Math.sin(shakeTime * 113.3) * 0.4);
            rot = 0.02 * t2 * Math.sin(shakeTime * 43.7);
        }
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && rot === 0) return false;
        ctx.save();
        ctx.translate(width / 2 + dx, height / 2 + dy);
        ctx.rotate(rot);
        ctx.translate(-width / 2, -height / 2);
        return true;
    }

    function endShake() {
        ctx.restore();
    }

    // 屏幕闪光系统
    function addFlash(color, intensity, duration) {
        flash.color = color;
        flash.intensity = Math.max(flash.intensity, intensity);
        flash.duration = Math.max(flash.duration, duration);
    }

    function updateFlash(dt) {
        if (flash.duration > 0) {
            flash.duration -= dt;
            flash.intensity = Math.max(0, flash.intensity - dt * 3);
        }
    }

    function drawFlash() {
        if (flash.intensity <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, flash.intensity);
        ctx.fillStyle = flash.color;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

    // 关卡过渡系统
    function startTransition(type, duration) {
        transition.active = true;
        transition.type = type || 'scanline';
        transition.progress = 0;
        transition.duration = duration || 0.8;
    }

    function updateTransition(dt) {
        if (!transition.active) return;
        transition.progress += dt / transition.duration;
        if (transition.progress >= 1) {
            transition.active = false;
            transition.progress = 1;
        }
    }

    function drawTransition() {
        if (!transition.active) return;
        const p = transition.progress;
        if (transition.type === 'scanline') {
            // 扫描线
            const scanY = p * height;
            ctx.fillStyle = 'rgba(77, 184, 232, 0.35)';
            ctx.fillRect(0, scanY - 1, width, 3);
            ctx.fillStyle = 'rgba(77, 184, 232, 0.12)';
            ctx.fillRect(0, scanY - 6, width, 12);
            // 整体遮罩：先暗下来，再亮起来
            const overlay = p < 0.5 ? p * 2 : (1 - p) * 2;
            ctx.fillStyle = `rgba(8, 14, 26, ${overlay * 0.9})`;
            ctx.fillRect(0, 0, width, height);
            // 噪点线条
            ctx.fillStyle = `rgba(77, 184, 232, ${overlay * 0.08})`;
            for (let i = 0; i < height; i += 4) {
                if ((i + Math.floor(scanY)) % 8 < 4) {
                    ctx.fillRect(0, i, width, 1);
                }
            }
        }
    }

    // 受伤vignette效果
    function drawVignette(healthRatio, time) {
        if (healthRatio >= 0.4) return;
        const intensity = 1 - healthRatio / 0.4;
        const r = Math.max(width, height) * 0.7;

        // 暗角
        const g = ctx.createRadialGradient(width / 2, height / 2, r * 0.5, width / 2, height / 2, r);
        g.addColorStop(0, 'transparent');
        g.addColorStop(0.7, `rgba(168, 48, 53, ${intensity * 0.22})`);
        g.addColorStop(1, `rgba(130, 35, 40, ${intensity * 0.48})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);

        // 心跳脉冲边缘
        if (healthRatio < 0.25) {
            const pulse = Math.sin(time * 8) * 0.5 + 0.5;
            const g2 = ctx.createRadialGradient(width / 2, height / 2, r * 0.6, width / 2, height / 2, r * 1.1);
            g2.addColorStop(0, 'transparent');
            g2.addColorStop(1, `rgba(168, 48, 53, ${intensity * pulse * 0.3})`);
            ctx.fillStyle = g2;
            ctx.fillRect(0, 0, width, height);
        }
    }

    // 音频可视化脉冲
    function addAudioPulse(intensity) {
        audioPulse.intensity = Math.min(1, audioPulse.intensity + intensity);
    }

    function updateAudioPulse(dt) {
        if (audioPulse.intensity > 0) {
            audioPulse.intensity -= dt * audioPulse.decay;
            if (audioPulse.intensity < 0) audioPulse.intensity = 0;
        }
    }

    function drawAudioPulse() {
        if (audioPulse.intensity <= 0) return;
        const a = audioPulse.intensity;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        // 上下边缘光带
        const gradTop = ctx.createLinearGradient(0, 0, width, 0);
        gradTop.addColorStop(0, `rgba(77, 184, 232, ${a * 0.3})`);
        gradTop.addColorStop(0.5, `rgba(77, 184, 232, ${a * 0.1})`);
        gradTop.addColorStop(1, `rgba(77, 184, 232, ${a * 0.3})`);
        ctx.fillStyle = gradTop;
        ctx.fillRect(0, 0, width, 3);
        ctx.fillRect(0, height - 3, width, 3);
        // 侧边微光
        const gradSide = ctx.createLinearGradient(0, 0, 0, height);
        gradSide.addColorStop(0, `rgba(77, 184, 232, ${a * 0.12})`);
        gradSide.addColorStop(0.5, 'transparent');
        gradSide.addColorStop(1, `rgba(77, 184, 232, ${a * 0.12})`);
        ctx.fillStyle = gradSide;
        ctx.fillRect(0, 0, 2, height);
        ctx.fillRect(width - 2, 0, 2, height);
        ctx.restore();
    }

    // 绘制暗角
    function drawScreenVignette() {
        if (!ctx || !width || !height) return;
        const g = ctx.createRadialGradient(width / 2, height / 2, width * 0.4, width / 2, height / 2, width * 0.75);
        g.addColorStop(0, 'transparent');
        g.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
    }

    return {
        init, resize, generateBackground, drawBackground,
        drawPlatforms, shake, addKick, setShakeEnabled, applyShake, endShake, setAmbient,
        drawVignette, drawScreenVignette,
        addFlash, updateFlash, drawFlash,
        startTransition, updateTransition, drawTransition,
        addAudioPulse, updateAudioPulse, drawAudioPulse,
        ctx: () => ctx,
        width: () => width,
        height: () => height,
    };
})();
