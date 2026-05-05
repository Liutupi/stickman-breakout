// ==================== 渲染系统 ====================
const Renderer = (() => {
    let canvas, ctx;
    let width, height;
    let initialized = false;

    // 背景装饰元素
    let bgStars = [];
    let bgDeco = [];

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

    function generateBackground(level) {
        bgStars = [];
        bgDeco = [];
        for (let i = 0; i < 80; i++) {
            bgStars.push({
                x: Utils.rand(0, level.levelWidth),
                y: Utils.rand(0, 350),
                size: Utils.rand(0.8, 2.5),
                alpha: Utils.rand(0.2, 0.9),
                twinkle: Utils.rand(0, Math.PI * 2),
                color: Utils.rand(0, 1) > 0.8 ? '#7ce7ff' : '#fff',
            });
        }
        // 背景装饰 - 根据关卡主题生成不同元素
        for (let i = 0; i < 25; i++) {
            bgDeco.push({
                x: Utils.rand(100, level.levelWidth - 100),
                type: Utils.randInt(0, 5),
                height: Utils.rand(50, 200),
                width: Utils.rand(15, 50),
                layer: Utils.randInt(0, 2), // 0=远景, 1=中景, 2=近景
            });
        }
    }

    function drawBackground(level, time) {
        // 背景色
        const grad = typeof level.bgGradient === 'function'
            ? level.bgGradient(ctx, width, height)
            : '#1a1a2e';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // 远景层（视差0.2）
        const parallaxFar = Utils.camera.x * 0.15;
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        for (const d of bgDeco) {
            if (d.layer !== 0) continue;
            const dx = d.x - parallaxFar;
            if (dx < -80 || dx > width + 80) continue;
            drawBgDecoration(dx, d, height, time, 0.025);
        }

        // 星星
        const parallax = Utils.camera.x * 0.2;
        for (const s of bgStars) {
            const sx = (s.x - parallax) % (width + 100);
            const adjX = sx < 0 ? sx + width + 100 : sx;
            const twinkle = Math.sin(time * 2 + s.twinkle) * 0.3 + 0.7;
            ctx.globalAlpha = s.alpha * twinkle;
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(adjX, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // 中景层（视差0.4）
        const parallaxMid = Utils.camera.x * 0.35;
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        for (const d of bgDeco) {
            if (d.layer !== 1) continue;
            const dx = d.x - parallaxMid;
            if (dx < -100 || dx > width + 100) continue;
            drawBgDecoration(dx, d, height, time, 0.04);
        }

        // 近景远景装饰
        const parallax2 = Utils.camera.x * 0.5;
        for (const d of bgDeco) {
            if (d.layer !== 2) continue;
            const dx = d.x - parallax2;
            if (dx < -100 || dx > width + 100) continue;
            drawBgDecoration(dx, d, height, time, 0.06);
        }
    }

    function drawBgDecoration(dx, d, h, time, alpha) {
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        if (d.type === 0) {
            // 柱子/建筑
            ctx.fillRect(dx, h - 80 - d.height, d.width, d.height);
            // 纹理
            ctx.fillStyle = `rgba(0,0,0,${alpha * 0.5})`;
            for (let y = h - 80 - d.height; y < h - 80; y += 20) {
                ctx.fillRect(dx + 2, y, d.width - 4, 1);
            }
        } else if (d.type === 1) {
            // 三角形/山峰
            ctx.beginPath();
            ctx.moveTo(dx, h - 80);
            ctx.lineTo(dx + d.width / 2, h - 80 - d.height);
            ctx.lineTo(dx + d.width, h - 80);
            ctx.closePath();
            ctx.fill();
        } else if (d.type === 2) {
            // 山丘/圆顶
            ctx.beginPath();
            ctx.ellipse(dx + d.width / 2, h - 80, d.width, d.height * 0.4, 0, Math.PI, 0);
            ctx.fill();
        } else if (d.type === 3) {
            // 管道/横梁
            ctx.fillRect(dx, h - 80 - d.height * 0.6, d.width * 2, 4);
            ctx.fillRect(dx, h - 80 - d.height * 0.6, 4, d.height * 0.6);
            ctx.fillRect(dx + d.width * 2 - 4, h - 80 - d.height * 0.6, 4, d.height * 0.6);
        } else if (d.type === 4) {
            // 塔楼/天线
            ctx.fillRect(dx + d.width / 2 - 2, h - 80 - d.height, 4, d.height);
            ctx.beginPath();
            ctx.arc(dx + d.width / 2, h - 80 - d.height, 6, 0, Math.PI * 2);
            ctx.fill();
            // 闪烁灯
            const blink = Math.sin(time * 3 + dx) > 0.5 ? 1 : 0.3;
            ctx.fillStyle = `rgba(255, 50, 50, ${blink * alpha * 2})`;
            ctx.beginPath();
            ctx.arc(dx + d.width / 2, h - 80 - d.height, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (d.type === 5) {
            // 悬浮平台残影
            ctx.fillStyle = `rgba(255,255,255,${alpha * 0.5})`;
            const floatY = Math.sin(time + dx * 0.01) * 10;
            ctx.fillRect(dx, h - 120 - d.height * 0.3 + floatY, d.width, 3);
            ctx.fillRect(dx + 4, h - 120 - d.height * 0.3 - 8 + floatY, d.width - 8, 2);
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
                // 顶部细节（金属边缘）
                const topGrad = ctx.createLinearGradient(sx, sy, sx, sy + 8);
                topGrad.addColorStop(0, level.groundDetail);
                topGrad.addColorStop(1, level.groundColor);
                ctx.fillStyle = topGrad;
                ctx.fillRect(sx, sy, p.w, 8);
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
