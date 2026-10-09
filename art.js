// 生图图集 + 独立视差层。素材失败时返回 false，由原矢量渲染接管。
const GameArt = (() => {
    const backgrounds = new Image();
    backgrounds.src = 'assets/generated/environments-v2.png';
    const bosses = new Image();
    const infantry = new Image();
    const enemyOrder = ['walker', 'runner', 'shooter', 'jumper', 'missile', 'kamikaze',
        'flyer', 'bomber', 'swooper', 'drone', 'turret', 'shielder',
        'sniper', 'lancer', 'scattergun', 'medic', 'sentinel'];
    const bossFrames = [], enemyFrames = [];
    const colors = ['#f4b267', '#7ce7b1', '#ff864d', '#b1e9ff', '#c29aff', '#ff677b', '#6ee9ff', '#f5cb7c', '#b1ddff'];
    // 在浏览器内读取各格的 alpha 边界，统一脚底位置，避免图集留白导致悬空。
    function measureAtlas(img, cols, rows, frames, count) {
        const buffer = document.createElement('canvas');
        buffer.width = img.naturalWidth; buffer.height = img.naturalHeight;
        const c = buffer.getContext('2d', { willReadFrequently: true });
        c.drawImage(img, 0, 0);
        const pixels = c.getImageData(0, 0, buffer.width, buffer.height).data;
        for (let i = 0; i < count; i++) {
            const left = Math.ceil(i % cols * buffer.width / cols) + 2;
            const top = Math.ceil(Math.floor(i / cols) * buffer.height / rows) + 2;
            const right = Math.floor((i % cols + 1) * buffer.width / cols) - 2;
            const bottom = Math.floor((Math.floor(i / cols) + 1) * buffer.height / rows) - 2;
            let x1 = right, y1 = bottom, x2 = left, y2 = top;
            for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
                if (pixels[(y * buffer.width + x) * 4 + 3] < 48) continue;
                x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y);
            }
            frames.push({ x: x1, y: y1, w: Math.max(1, x2 - x1 + 1), h: Math.max(1, y2 - y1 + 1) });
        }
    }
    bosses.onload = () => measureAtlas(bosses, 3, 3, bossFrames, 9);
    infantry.onload = () => measureAtlas(infantry, 6, 3, enemyFrames, 17);
    bosses.src = 'assets/generated/bosses-v2.png';
    infantry.src = 'assets/generated/enemies-v2.png';
    const motionNames = ['steel-guardian','shadow-king','inferno-demon','frost-beast','void-lord',
        'chaos-creator','neon-assassin','sand-colossus','sky-judicator'];
    const motions = motionNames.map(name => {
        const sheet = { img:new Image(), frames:[] };
        sheet.img.onload = () => measureMotion(sheet);
        sheet.img.src = `assets/generated/boss-motion/${name}.png`;
        return sheet;
    });
    function measureMotion(sheet) {
        const img=sheet.img, buffer=document.createElement('canvas');
        buffer.width=img.naturalWidth; buffer.height=img.naturalHeight;
        const c=buffer.getContext('2d',{willReadFrequently:true}); c.drawImage(img,0,0);
        const pixels=c.getImageData(0,0,buffer.width,buffer.height).data;
        // 生成图的行距有几像素浮动：在预期分界附近找透明谷，避免截掉脚或武器。
        const rowInk=new Uint32Array(buffer.height);
        for(let y=0;y<buffer.height;y++) for(let x=0;x<buffer.width;x++) if(pixels[(y*buffer.width+x)*4+3]>48) rowInk[y]++;
        const edges=[0];
        for(let r=1;r<4;r++) {
            const expected=r*buffer.height/4, reach=buffer.height*.035;
            let best=Math.round(expected), score=Infinity;
            for(let y=Math.floor(expected-reach);y<expected+reach;y++) {
                const value=rowInk[y]+Math.abs(y-expected)*.1;
                if(value<score){score=value;best=y;}
            }
            edges.push(best);
        }
        edges.push(buffer.height);
        for(let i=0;i<16;i++) {
            const left=Math.ceil(i%4*buffer.width/4)+1, right=Math.floor((i%4+1)*buffer.width/4)-1;
            const top=edges[Math.floor(i/4)]+1, bottom=edges[Math.floor(i/4)+1]-1;
            // 个别武器尖端会越过生成图的分格。仅清理贴着边界的小孤岛，
            // 保留主体、独立法球与浮游刀刃，避免邻格碎片跟着人物移动。
            const cellW=right-left,cellH=bottom-top,visited=new Uint8Array(cellW*cellH);
            const queue=new Int32Array(cellW*cellH),components=[];
            for(let y=top;y<bottom;y++) for(let x=left;x<right;x++) {
                const start=(y-top)*cellW+x-left;
                if(visited[start] || pixels[(y*buffer.width+x)*4+3]<48)continue;
                let head=0,tail=1,x1=x,y1=y,x2=x,y2=y;queue[0]=start;visited[start]=1;
                while(head<tail){
                    const n=queue[head++],cx=n%cellW+left,cy=Math.floor(n/cellW)+top;
                    x1=Math.min(x1,cx);x2=Math.max(x2,cx);y1=Math.min(y1,cy);y2=Math.max(y2,cy);
                    for(const next of [n-1,n+1,n-cellW,n+cellW]){
                        if(next<0 || next>=visited.length || visited[next])continue;
                        const nx=next%cellW+left,ny=Math.floor(next/cellW)+top;
                        if(Math.abs(nx-cx)+Math.abs(ny-cy)!==1 || pixels[(ny*buffer.width+nx)*4+3]<48)continue;
                        visited[next]=1;queue[tail++]=next;
                    }
                }
                components.push({x1,y1,x2,y2,area:tail});
            }
            const largest=Math.max(0,...components.map(v=>v.area));
            for(const piece of components){
                if(piece.area>=largest*.06 || (piece.x1>left+2 && piece.x2<right-3 && piece.y1>top+2 && piece.y2<bottom-3))continue;
                const a=Math.max(left,piece.x1-2),b=Math.max(top,piece.y1-2),r=Math.min(right,piece.x2+3),d=Math.min(bottom,piece.y2+3);
                c.clearRect(a,b,r-a,d-b);
                for(let y=b;y<d;y++)for(let x=a;x<r;x++)pixels[(y*buffer.width+x)*4+3]=0;
            }
            let x1=right,y1=bottom,x2=left,y2=top;
            for(let y=top;y<bottom;y++) for(let x=left;x<right;x++) {
                if(pixels[(y*buffer.width+x)*4+3]<48)continue;
                x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y);
            }
            sheet.frames.push({ x:x1,y:y1,w:Math.max(1,x2-x1+1),h:Math.max(1,y2-y1+1),
                anchorX:(i%4+.55)*buffer.width/4 });
        }
        sheet.texture=buffer;
    }

    function polygon(ctx, points, fill, stroke) {
        ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    }

    function drawEnvironment(ctx, level, time, width, height) {
        if (!backgrounds.complete || !backgrounds.naturalWidth) return false;
        const index = level.artIndex || 0;
        const cellW = backgrounds.naturalWidth / 3, cellH = backgrounds.naturalHeight / 3;
        const srcX = index % 3 * cellW + 1, srcY = Math.floor(index / 3) * cellH + 1;
        const drawH = Math.max(height + 150, width * 0.64), drawW = drawH * cellW / cellH;
        const offset = Utils.camera.x * 0.12;
        // 镜像接续的全景远层，接缝始终连续；镜头纵移幅度小于战斗层。
        const top = Math.min(-50, 500 - Utils.camera.y * 0.18 - drawH * 0.91);
        const tile = Math.floor(offset / drawW);
        ctx.save();
        for (let n = tile; n <= tile + Math.ceil(width / drawW) + 1; n++) {
            const x = n * drawW - offset;
            ctx.save(); ctx.translate(x + (n % 2 ? drawW : 0), top); ctx.scale(n % 2 ? -1 : 1, 1);
            ctx.drawImage(backgrounds, srcX, srcY, cellW - 2, cellH - 2, 0, 0, drawW, drawH); ctx.restore();
        }
        const shade = ctx.createLinearGradient(0, 0, 0, height);
        shade.addColorStop(0, 'rgba(4,10,21,0.24)'); shade.addColorStop(0.52, 'rgba(4,10,21,0.12)'); shade.addColorStop(1, 'rgba(4,10,21,0.62)');
        ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
        drawScenery(ctx, index, time, width, height, false);
        // 斜向光束位于远景与中景之间。
        ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.035;
        for (let i = 0; i < 3; i++) {
            const x = (i * 630 - Utils.camera.x * 0.24 + Math.sin(time * 0.14 + i) * 40) % (width + 600);
            const light = ctx.createLinearGradient(x, 0, x - 180, height);
            light.addColorStop(0, colors[index]); light.addColorStop(1, 'transparent');
            polygon(ctx, [[x, 0], [x + 70, 0], [x - 130, height], [x - 300, height]], light);
        }
        ctx.restore();
        return true;
    }

    function drawScenery(ctx, index, time, width, height, foreground) {
        const par = foreground ? 1.16 : 0.48;
        const spacing = foreground ? 890 : 540;
        const offset = Utils.camera.x * par;
        const start = Math.floor(offset / spacing) - 1;
        const baseline = foreground ? 590 - Utils.camera.y : 520 - Utils.camera.y * 0.45;
        ctx.save();
        ctx.globalAlpha = foreground ? 0.65 : 0.4;
        for (let i = start; i < start + Math.ceil(width / spacing) + 3; i++) {
            const x = i * spacing - offset + Math.sin(i * 7.13) * 60;
            const size = 90 + (Math.sin(i * 4.7) * 0.5 + 0.5) * 100;
            // 近景只位于画面下沿，不遮挡落脚点与角色。
            ctx.save(); ctx.translate(x, baseline + (foreground ? 65 : 0));
            ctx.fillStyle = foreground ? '#060d17' : '#101d2b'; ctx.strokeStyle = colors[index]; ctx.lineWidth = 1;
            if (index === 1) {
                polygon(ctx, [[-35, 70], [-20, -size * 2.2], [-7, -size * 2.8], [8, -size], [40, 70]], ctx.fillStyle);
                ctx.lineWidth = 14; ctx.strokeStyle = '#0a1922';
                ctx.beginPath(); ctx.moveTo(-10, -size); ctx.bezierCurveTo(-80, -size * 1.4, -90, -size * 1.8, -160, -size * 1.9); ctx.stroke();
            } else if ([2, 3, 4, 5].includes(index)) {
                polygon(ctx, [[-50, 50], [-34, -size * 0.6], [-5, -size * 1.5], [15, -size * 0.8], [48, 50]], ctx.fillStyle, colors[index] + '40');
                polygon(ctx, [[-5, -size * 1.5], [4, -size * 0.65], [48, 50], [15, -size * 0.8]], colors[index] + '28');
            } else if (index === 7) {
                polygon(ctx, [[-32, 50], [-24, -size], [0, -size - 30], [24, -size], [32, 50]], ctx.fillStyle);
                ctx.fillStyle = colors[index] + '44'; ctx.fillRect(-4, -size + 14, 5, size - 30);
            } else {
                polygon(ctx, [[-48, 60], [-48, -size], [28, -size], [50, -size + 20], [50, 60]], ctx.fillStyle);
                ctx.fillStyle = colors[index] + '38'; ctx.fillRect(-43, -size + 10, 3, size);
                ctx.strokeStyle = '#4c6573'; ctx.lineWidth = 3;
                for (let j = 0; j < 4; j++) {
                    ctx.beginPath(); ctx.moveTo(-40, -size + 26 + j * 38); ctx.lineTo(30, -size + 62 + j * 38); ctx.stroke();
                }
                if (index === 6) { ctx.fillStyle = colors[index] + '90'; ctx.fillRect(-20, -size + 25, 32, 7); }
            }
            ctx.restore();
        }
        // 雾带横向缓慢漂移，和全景有不同运动速度。
        if (!foreground) {
            ctx.globalAlpha = 0.12;
            const fog = ctx.createLinearGradient(0, baseline - 160, 0, baseline + 50);
            fog.addColorStop(0, 'transparent'); fog.addColorStop(0.65, colors[index]); fog.addColorStop(1, 'transparent');
            ctx.fillStyle = fog; ctx.fillRect(0, baseline - 160 + Math.sin(time * 0.3) * 10, width, 210);
        }
        ctx.restore();
    }

    function drawPlatformDepth(ctx, level, p) {
        const x = p.x - Utils.camera.x, y = p.y - Utils.camera.y;
        const depth = p.h > 50 ? 22 : 14;
        const color = colors[level.artIndex || 0];
        const top = ctx.createLinearGradient(0, y - depth, 0, y);
        top.addColorStop(0, level.groundDetail); top.addColorStop(1, p.h > 50 ? level.groundColor : level.platformDetail);
        ctx.save();
        polygon(ctx, [[x, y], [x + depth, y - depth * 0.65], [x + p.w + depth, y - depth * 0.65], [x + p.w, y]], top, color + '55');
        polygon(ctx, [[x + p.w, y], [x + p.w + depth, y - depth * 0.65], [x + p.w + depth, y + p.h - depth * 0.65], [x + p.w, y + p.h]], '#111d2c');
        // 顶面材质随关卡变化，纹理锚定世界坐标。
        ctx.strokeStyle = color + '22'; ctx.lineWidth = 1;
        const start = Math.max(p.x + 16, Utils.camera.x - 30);
        for (let wx = Math.ceil(start / 90) * 90; wx < Math.min(p.x + p.w, Utils.camera.x + Renderer.width() + 30); wx += 90) {
            const sx = wx - Utils.camera.x;
            ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + depth, y - depth * 0.65); ctx.stroke();
        }
        ctx.restore();
    }

    function drawPlatformFace(ctx, level, p) {
        if (p.h < 50) return;
        const index = level.artIndex || 0, y = p.y - Utils.camera.y;
        const start = Math.ceil(Math.max(p.x, Utils.camera.x - 220) / 220) * 220;
        const end = Math.min(p.x + p.w - 30, Utils.camera.x + Renderer.width() + 30);
        ctx.save(); ctx.beginPath(); ctx.rect(p.x - Utils.camera.x, y + 10, p.w, Renderer.height()); ctx.clip();
        for (let wx = start; wx < end; wx += 220) {
            const x = wx - Utils.camera.x;
            if ([0, 6, 8].includes(index)) {
                const metal = ctx.createLinearGradient(x, y + 20, x, y + 180);
                metal.addColorStop(0, '#101d2b80'); metal.addColorStop(1, '#060e1a20');
                polygon(ctx, [[x + 8, y + 22], [x + 193, y + 22], [x + 193, y + 166], [x + 8, y + 166]], metal, '#86b4ca18');
                ctx.strokeStyle = '#91b5c82a'; ctx.lineWidth = 6;
                ctx.beginPath(); ctx.moveTo(x + 13, y + 28); ctx.lineTo(x + 184, y + 158); ctx.moveTo(x + 184, y + 28); ctx.lineTo(x + 13, y + 158); ctx.stroke();
                ctx.fillStyle = colors[index] + '38'; ctx.fillRect(x + 20, y + 29, 24, 2);
                ctx.fillStyle = '#09131f';
                for (const dx of [16, 185]) for (const dy of [30, 157]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 3, 0, Math.PI * 2); ctx.fill(); }
            } else {
                const depth = 90 + Math.sin(wx * 0.23) * 35;
                polygon(ctx, [[x - 20, y + 12], [x + 85, y + 18], [x + 116, y + depth], [x + 12, y + depth + 85]], '#06101b30', colors[index] + '14');
                polygon(ctx, [[x + 85, y + 18], [x + 194, y + 10], [x + 178, y + depth + 90], [x + 116, y + depth]], '#02071335');
                ctx.strokeStyle = colors[index] + '22'; ctx.lineWidth = index === 1 ? 3 : 1;
                ctx.beginPath(); ctx.moveTo(x + 50, y + 20); ctx.bezierCurveTo(x + 30, y + 65, x + 110, y + 90, x + 75, y + 150); ctx.stroke();
            }
        }
        ctx.restore();
    }

    function drawSprite(ctx, img, frame, entity, boss) {
        if (!frame || !img.naturalWidth) return false;
        const height = entity.h;
        const width = Math.min(height * frame.w / frame.h, boss ? entity.w * 2.8 : 112);
        const speed = Math.abs(entity.vx || 0);
        const bob = entity.onGround ? Math.sin(entity.animTime * (boss ? 6 : 10)) * Math.min(2, speed / 70) : Math.sin(entity.animTime * 3) * 1.5;
        ctx.save(); ctx.scale(-entity.facing, 1);
        ctx.rotate(Utils.clamp(-(entity.vx || 0) * entity.facing / 9000, -0.06, 0.06));
        if (entity.flashTimer > 0 || entity.hitFlashTimer > 0) ctx.filter = 'brightness(2)';
        ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, -width / 2, -height + bob, width, height);
        if (boss && entity.windup) {
            ctx.strokeStyle = entity.accentColor; ctx.lineWidth = 2; ctx.globalAlpha *= 0.6;
            ctx.beginPath(); ctx.ellipse(0, -height * 0.45, width * 0.55, height * 0.53, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
        return true;
    }
    function drawEnemy(ctx, enemy) { return drawSprite(ctx, infantry, enemyFrames[enemyOrder.indexOf(enemy.type)], enemy, false); }
    function drawBoss(ctx, boss) {
        const sheet=motions[boss.artIndex || 0];
        if(!sheet || sheet.frames.length!==16) return drawSprite(ctx,bosses,bossFrames[boss.artIndex || 0],boss,true);
        const scale=boss.h/sheet.frames[0].h;
        const paint=(index,facing,alpha=1) => {
            const f=sheet.frames[index];
            ctx.save();ctx.scale(-facing,1);ctx.globalAlpha*=alpha;
            ctx.drawImage(sheet.texture,f.x,f.y,f.w,f.h,(f.x-f.anchorX)*scale,-f.h*scale,f.w*scale,f.h*scale);
            ctx.restore();
        };
        for(const t of boss.motionTrail) {
            ctx.save();ctx.translate(t.x-boss.x,t.y-boss.y);paint(t.frame,t.facing,t.life/.18*.15);ctx.restore();
        }
        ctx.save();
        if(boss.flashTimer>0)ctx.filter='brightness(1.7)';
        if(boss.action?.kind==='blink') {
            const k=Math.abs(boss.action.elapsed-.23)/.23;
            ctx.globalAlpha*=Utils.clamp(k,.08,1);ctx.scale(.35+k*.65,1);
        }
        paint(BossMotion.frame(boss),boss.facing);
        ctx.restore();
        BossMotion.drawEffects(ctx,boss);
        return true;
    }

    function drawWorldDetails(ctx, level, enemies, boss, player, time) {
        ctx.save();
        for (const actor of [player, boss, ...enemies]) {
            if (!actor || actor.dead || Math.abs(actor.x - Utils.camera.x - Renderer.width() / 2) > Renderer.width() / 2 + 120) continue;
            const floors = level.platforms.filter(p => actor.x >= p.x && actor.x <= p.x + p.w && p.y >= actor.y - 5);
            const floor = floors.sort((a, b) => a.y - b.y)[0];
            if (!floor || floor.y - actor.y > 300) continue;
            ctx.fillStyle = `rgba(0,0,0,${0.32 * (1 - Math.max(0, floor.y - actor.y) / 320)})`;
            ctx.beginPath(); ctx.ellipse(actor.x - Utils.camera.x + 6, floor.y - Utils.camera.y - 2, actor.w * 0.75, 5, -0.08, 0, Math.PI * 2); ctx.fill();
        }
        for (const beacon of level.supplyBeacons || []) {
            const x = beacon.x - Utils.camera.x, y = beacon.y - Utils.camera.y;
            if (x < -100 || x > Renderer.width() + 100) continue;
            ctx.fillStyle = '#172a36'; ctx.fillRect(x - 8, y - 58, 16, 58);
            ctx.fillStyle = colors[level.artIndex || 0]; ctx.fillRect(x - 5, y - 52, 10, 3);
            ctx.globalAlpha = 0.13 + Math.sin(time * 3) * 0.04;
            polygon(ctx, [[x - 4, y - 50], [x + 4, y - 50], [x + 45, y], [x - 45, y]], ctx.fillStyle); ctx.globalAlpha = 1;
            ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#c4e6ed'; ctx.fillText('补给点', x, y - 70);
        }
        ctx.restore();
    }
    function drawForeground(ctx, level, time) { drawScenery(ctx, level.artIndex || 0, time, Renderer.width(), Renderer.height(), true); }
    return { drawEnvironment, drawPlatformDepth, drawPlatformFace, drawEnemy, drawBoss, drawWorldDetails, drawForeground,
        ready: () => ({ backgrounds: !!backgrounds.naturalWidth, bosses: bossFrames.length === 9, enemies: enemyFrames.length === 17,
            bossMotion: motions.every(s=>s.frames.length===16) }) };
})();
