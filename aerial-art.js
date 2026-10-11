// 独立空中机群：所有素材面向左，机体中心对齐原碰撞盒中心。
const AerialArt = (() => {
    const specs = {
        swarm:    { width:1.7, height:1.5, color:'#ffd166', rotor:true },
        gunship:  { width:1.5, height:1.5, color:'#7cc4ff', rotor:true },
        diver:    { width:1.75,height:1.65,color:'#ff7a7a' },
        flyer:    { width:2.6, height:1.15,color:'#42dfff' },
        bomber:   { width:3,   height:1.25,color:'#ffad50' },
        swooper:  { width:2.6, height:1.05,color:'#ff71bf' },
        drone:    { width:2.1, height:1.05,color:'#65efef', rotor:true },
        sentinel: { width:1.7, height:1.2, color:'#c9a2ff' },
    };
    const sheets = {};
    Object.keys(specs).forEach(type => {
        const sheet = sheets[type] = { image:new Image(), frames:[] };
        sheet.image.onload = () => measure(sheet);
        // 新 URL 避免安装版继续命中旧设备的图片缓存。
        sheet.image.src = `assets/generated/aerial-v1/${type}.webp`;
    });
    function measure(sheet) {
        const image=sheet.image, canvas=document.createElement('canvas');
        canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);
        const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;
        // 生图的翼尖可能略过标称格线，在附近寻找透明间隔再取帧。
        // 每行独立定位列边界，既保留完整翼尖，也不带入邻格的碎片。
        const gap=(expected,ink)=>{
            let best=Math.round(expected),score=Infinity;
            const reach=Math.floor(ink.length*.05);
            for(let n=best-reach;n<=expected+reach;n++){
                const value=ink[n]+Math.abs(n-expected)*.001;
                if(value<score){score=value;best=n;}
            }
            return best;
        };
        const rowInk=new Uint32Array(canvas.height);
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)
            if(pixels[(y*canvas.width+x)*4+3]>=48)rowInk[y]++;
        const rows=[0,gap(canvas.height/2,rowInk),canvas.height],columns=[];
        for(let r=0;r<2;r++){
            const ink=new Uint32Array(canvas.width);
            for(let y=rows[r];y<rows[r+1];y++)for(let x=0;x<canvas.width;x++)
                if(pixels[(y*canvas.width+x)*4+3]>=48)ink[x]++;
            columns.push([0,gap(canvas.width/2,ink),canvas.width]);
        }
        for(let i=0;i<4;i++){
            const row=Math.floor(i/2),col=i%2;
            const left=columns[row][col]+1,top=rows[row]+1;
            const right=columns[row][col+1],bottom=rows[row+1];
            let x1=right,y1=bottom,x2=left,y2=top;
            for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
                if(pixels[(y*canvas.width+x)*4+3]<48)continue;
                x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y);
            }
            if(x2<=x1 || y2<=y1){sheet.frames=[];return;}
            sheet.frames.push({x:x1,y:y1,w:x2-x1+1,h:y2-y1+1});
        }
    }
    function pose(e) {
        if(e.type==='swarm')return ({tele:1,dive:2,return:3})[e.state] || 0;
        if(e.type==='diver')return ({aim:1,dive:2,recover:3})[e.state] || 0;
        if(e.type==='swooper'){
            if(e.swoopState==='dive')return 2;
            if(e.swoopState==='ascend')return 3;
            return e.swoopCooldown<=.3?1:0;
        }
        if(e.type==='sentinel'){
            if(e.burstLeft>0)return 2;
            if(e.telegraph>0)return 1;
            return e.bullets?.length && e.attackCooldown>(e.attackRate || 2)-.65?3:0;
        }
        if(e.type==='gunship' && e.telegraph>0){
            return ((e.volley || 0)+1)%3===0 && e.telegraph>.42?2:1;
        }
        const rate=e.attackRate || 1.5;
        if(e.bullets?.length){
            if(e.attackCooldown>rate-.24)return 2;
            if(e.attackCooldown>rate-.65)return 3;
        }
        if(e.type!=='gunship' && e.attackCooldown<=.3)return 1;
        return 0;
    }
    function geometry(e,sheet) {
        const spec=specs[e.type],f=sheet.frames[0];
        const scale=Math.min(e.w*spec.width/f.w,e.h*spec.height/f.h);
        return {scale,width:f.w*scale,height:f.h*scale};
    }
    function draw(ctx,e) {
        const sheet=sheets[e.type];
        if(!sheet || sheet.frames.length!==4)return false;
        const spec=specs[e.type],p=pose(e),f=sheet.frames[p],g=geometry(e,sheet);
        const time=e.animTime || 0;
        const diving=e.state==='dive' || e.swoopState==='dive';
        const climbing=e.state==='return' || e.state==='recover' || e.swoopState==='ascend';
        // 旧俯冲机的 AI 会继续看向玩家，但锁定后的机头应沿实际速度前进。
        const facing=diving && Math.abs(e.vx)>1?Math.sign(e.vx):(e.facing===-1?-1:1);
        // 旋转放在镜像之前：向左/向右的下降都必须朝速度方向低头。
        const pitch=diving?Math.atan2(e.vy || 0,Math.max(1,Math.abs(e.vx || 0)))*facing:
            Utils.clamp((e.vy || 0)/900,-.16,.16)*facing;
        ctx.save();ctx.translate(0,-e.h/2);ctx.rotate(pitch);ctx.scale(-facing,1);
        // 尾焰使用实时长度，回升时只改变推进器强度，不移动碰撞盒。
        if(e.type!=='sentinel'){
            const intensity=diving?1:(climbing ? .7 : .25+Math.min(.35,Math.abs(e.vx || 0)/500));
            const tail=g.width*.36, flame=g.width*(.12+intensity*.38);
            const glow=ctx.createLinearGradient(tail,0,tail+flame,0);
            glow.addColorStop(0,spec.color+'bb');glow.addColorStop(1,spec.color+'00');
            ctx.fillStyle=glow;ctx.beginPath();ctx.moveTo(tail,-g.height*.1);
            ctx.quadraticCurveTo(tail+flame*.5,-g.height*.12,tail+flame,Math.sin(time*36)*2);
            ctx.quadraticCurveTo(tail+flame*.5,g.height*.12,tail,g.height*.1);ctx.closePath();ctx.fill();
        }
        if(e.hitFlashTimer>0)ctx.filter='brightness(2)';
        ctx.drawImage(sheet.image,f.x,f.y,f.w,f.h,-f.w*g.scale/2,-f.h*g.scale/2,f.w*g.scale,f.h*g.scale);
        ctx.filter='none';
        if(spec.rotor){
            ctx.strokeStyle=spec.color+'66';ctx.lineWidth=e.type==='swarm'?1:1.3;
            for(const x of [-g.width*.2,g.width*.19]){
                const rx=g.width*(e.type==='swarm'?.14:.16),ry=Math.max(1,g.height*.035);
                ctx.beginPath();ctx.ellipse(x,-g.height*.29,rx,ry,0,0,Math.PI*2);ctx.stroke();
                const angle=time*(e.type==='swarm'?65:48)+x;
                ctx.globalAlpha*=.65;ctx.beginPath();
                ctx.moveTo(x-Math.cos(angle)*rx,-g.height*.29-Math.sin(angle)*ry);
                ctx.lineTo(x+Math.cos(angle)*rx,-g.height*.29+Math.sin(angle)*ry);ctx.stroke();ctx.globalAlpha/=.65;
            }
        }
        if(e.type==='sentinel'){
            ctx.strokeStyle=spec.color+'88';ctx.lineWidth=1.4;
            ctx.beginPath();ctx.ellipse(0,0,g.width*.53,g.height*.21,Math.sin(time*2)*.35,0,Math.PI*2);ctx.stroke();
        }
        ctx.restore();return true;
    }
    // 世界方向的预警单独绘制，不跟随机身倾斜或镜像。
    function drawSignals(ctx,e) {
        if(!specs[e.type])return;
        const time=e.animTime || 0,oy=-e.h/2;
        ctx.save();
        if(e.type==='diver' && e.state==='aim' && Number.isFinite(e.lockX+e.lockY)){
            const x=e.lockX-e.x,y=e.lockY-e.y,locked=e.telegraph>=.5;
            ctx.strokeStyle=locked?'rgba(255,60,60,0.9)':'rgba(255,120,120,0.55)';ctx.lineWidth=locked?3:1.5;
            ctx.setLineDash(locked?[]:[8,6]);ctx.beginPath();ctx.moveTo(0,oy);ctx.lineTo(x*1.25,y+(y-oy)*.25);ctx.stroke();
            ctx.setLineDash([]);ctx.beginPath();ctx.arc(x,y,10+Math.sin(time*20)*3,0,Math.PI*2);ctx.stroke();
        }
        if(e.type==='swarm' && e.state==='tele'){
            ctx.strokeStyle='#ff4040';ctx.lineWidth=1.5;ctx.globalAlpha*=.55+Math.sin(time*40)*.4;
            ctx.beginPath();ctx.ellipse(0,oy,e.w*.85,e.h*.8,0,0,Math.PI*2);ctx.stroke();
            ctx.fillStyle='#ff4040';ctx.beginPath();ctx.arc(e.facing*e.w*.5,oy,3.5,0,Math.PI*2);ctx.fill();
        }
        if(e.type==='gunship' && e.telegraph>0){
            const x=e.facing*e.w*.62,y=oy+e.h*.18,t=Utils.clamp(e.telegraph/.7,0,1);
            ctx.fillStyle=`rgba(255,80,80,${.35+t*.5})`;ctx.beginPath();ctx.arc(x,y,3+t*5,0,Math.PI*2);ctx.fill();
            ctx.strokeStyle='#ff6060';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,5+t*7,0,Math.PI*2);ctx.stroke();
            if(((e.volley || 0)+1)%3===0){ctx.fillStyle='#ffb853';for(const x of [-12,0,12]){ctx.beginPath();ctx.arc(x,-2,2+t*2,0,Math.PI*2);ctx.fill();}}
        }
        if(e.type==='gunship' && e.health<e.maxHealth){
            const w=70;ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(-w/2,-e.h-19,w,4);
            ctx.fillStyle='#7cc4ff';ctx.fillRect(-w/2,-e.h-19,w*Utils.clamp(e.health/e.maxHealth,0,1),4);
        }
        if(e.type==='bomber' && e.attackCooldown<=.3){
            ctx.fillStyle='#ffad50';ctx.globalAlpha*=.55+Math.sin(time*24)*.35;
            for(const x of [-10,0,10]){ctx.beginPath();ctx.arc(x,-2,2.5,0,Math.PI*2);ctx.fill();}
        }
        ctx.restore();
    }
    return {draw,drawSignals,pose,ready:()=>Object.values(sheets).every(s=>s.frames.length===4)};
})();
