// ==================== 渲染系统 ====================
const Renderer = (() => {
    let canvas, ctx;
    let width, height;
    let initialized = false;

    // 背景装饰元素
    let bgStars = [];
    let bgDeco = [];
    let bgBeacons = [];

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
            const starColors = ['#7ce7ff', '#ff6ef0', '#fff', '#ffd700', '#ffffff', '#a0d8ef'];
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
                color: ['#00e5ff', '#ff335f', '#f5c84b'][Utils.randInt(0, 2)],
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
                neonColor: ['#00e5ff', '#ff2d78', '#7ce7ff', '#ff9100'][Utils.randInt(0, 3)],
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
            : '#1a1a2e';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        drawSkyPressure(time);

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

        const focusShade = ctx.createLinearGradient(0, 0, 0, height);
        focusShade.addColorStop(0, 'rgba(2, 5, 14, 0.16)');
        focusShade.addColorStop(0.45, 'rgba(2, 5, 14, 0.08)');
        focusShade.addColorStop(1, 'rgba(2, 8, 16, 0.22)');
        ctx.fillStyle = focusShade;
        ctx.fillRect(0, 0, width, height);
    }

    function drawSkyPressure(time) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        const sweep = (Math.sin(time * 0.18) * 0.5 + 0.5) * width;
        const leftBeam = ctx.createLinearGradient(sweep - width * 0.5, 0, sweep + width * 0.4, height);
        leftBeam.addColorStop(0, 'rgba(0, 229, 255, 0)');
        leftBeam.addColorStop(0.48, 'rgba(0, 229, 255, 0.08)');
        leftBeam.addColorStop(1, 'rgba(0, 229, 255, 0)');
        ctx.fillStyle = leftBeam;
        ctx.beginPath();
        ctx.moveTo(sweep - 260, 0);
        ctx.lineTo(sweep + 120, 0);
        ctx.lineTo(sweep + width * 0.3, height);
        ctx.lineTo(sweep - width * 0.15, height);
        ctx.closePath();
        ctx.fill();

        const dangerGlow = ctx.createLinearGradient(0, height * 0.12, width, height * 0.64);
        dangerGlow.addColorStop(0, 'rgba(255, 40, 84, 0)');
        dangerGlow.addColorStop(0.62, 'rgba(255, 40, 84, 0.045)');
        dangerGlow.addColorStop(1, 'rgba(255, 40, 84, 0)');
        ctx.fillStyle = dangerGlow;
        ctx.fillRect(0, 0, width, height);

        ctx.restore();
    }

    function drawAtmosphereStreaks(time) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.strokeStyle = 'rgba(166, 231, 255, 0.32)';
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
            const color = isDanger ? `rgba(255, 60, 88, ${0.2 + pulse * 0.2})` : `rgba(0, 229, 255, ${0.16 + pulse * 0.14})`;
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
        horizon.addColorStop(0, 'rgba(0, 229, 255, 0)');
        horizon.addColorStop(0.5, 'rgba(0, 229, 255, 0.08)');
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
                        ctx.fillStyle = `rgba(160,200,255,${0.15 * f})`;
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
                            ctx.fillStyle = `rgba(180, 220, 255, ${0.35 * flicker})`;
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
                            ctx.fillStyle = lit ? 'rgba(200, 220, 255, 0.28)' : 'rgba(15, 18, 35, 0.5)';
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
                ctx.fillStyle = `rgba(255, 30, 30, ${blink2 * 0.75})`;
                ctx.beginPath(); ctx.arc(cx, topY - 24, 3.5, 0, Math.PI * 2); ctx.fill();
                if (blink2) {
                    ctx.fillStyle = 'rgba(255, 30, 30, 0.18)';
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
                    ctx.fillStyle = `rgba(0, 230, 255, ${na})`;
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
                // 地面 - 增强材质感
                ctx.fillStyle = level.groundColor;
                ctx.fillRect(sx, sy, p.w, p.h);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
                ctx.fillRect(sx, sy + 10, p.w, p.h - 10);
                // 顶部细节（金属边缘）
                const topGrad = ctx.createLinearGradient(sx, sy, sx, sy + 8);
                topGrad.addColorStop(0, level.groundDetail);
                topGrad.addColorStop(1, level.groundColor);
                ctx.fillStyle = topGrad;
                ctx.fillRect(sx, sy, p.w, 8);
                ctx.fillStyle = 'rgba(190, 238, 255, 0.28)';
                ctx.fillRect(sx, sy, p.w, 2);
                ctx.fillStyle = 'rgba(0, 229, 255, 0.14)';
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
                    ctx.shadowColor = '#f1c40f';
                    ctx.shadowBlur = 14 + Math.sin(time) * 5;
                    ctx.fillStyle = '#4a5a3a';
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
                    ctx.fillStyle = '#f1c40f';
                    ctx.fillRect(sx + 4, sy, p.w - 8, 2);
                    for (let ax = sx + 12; ax < sx + p.w - 12; ax += 18) {
                        ctx.strokeStyle = 'rgba(255, 230, 120, 0.48)';
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
                    ctx.strokeStyle = 'rgba(0, 229, 255, 0.18)';
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

    // 屏幕震动
    let shakeAmount = 0;
    let shakeDuration = 0;

    function shake(amount, duration) {
        shakeAmount = amount;
        shakeDuration = duration;
    }

    function applyShake(dt) {
        if (shakeDuration > 0) {
            shakeDuration -= dt;
            const dx = (Math.random() - 0.5) * shakeAmount;
            const dy = (Math.random() - 0.5) * shakeAmount;
            ctx.save();
            ctx.translate(dx, dy);
            return true;
        }
        return false;
    }

    function endShake() {
        ctx.restore();
    }

    // 受伤vignette效果
    function drawVignette(healthRatio, time) {
        if (healthRatio >= 0.4) return;
        const intensity = 1 - healthRatio / 0.4;
        const r = Math.max(width, height) * 0.7;

        // 暗角
        const g = ctx.createRadialGradient(width / 2, height / 2, r * 0.5, width / 2, height / 2, r);
        g.addColorStop(0, 'transparent');
        g.addColorStop(0.7, `rgba(200, 0, 0, ${intensity * 0.2})`);
        g.addColorStop(1, `rgba(150, 0, 0, ${intensity * 0.45})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);

        // 心跳脉冲边缘
        if (healthRatio < 0.25) {
            const pulse = Math.sin(time * 8) * 0.5 + 0.5;
            const g2 = ctx.createRadialGradient(width / 2, height / 2, r * 0.6, width / 2, height / 2, r * 1.1);
            g2.addColorStop(0, 'transparent');
            g2.addColorStop(1, `rgba(255, 0, 0, ${intensity * pulse * 0.3})`);
            ctx.fillStyle = g2;
            ctx.fillRect(0, 0, width, height);
        }
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
        drawPlatforms, shake, applyShake, endShake,
        drawVignette, drawScreenVignette,
        ctx: () => ctx,
        width: () => width,
        height: () => height,
    };
})();
