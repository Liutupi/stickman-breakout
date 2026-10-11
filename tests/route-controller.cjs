// Real Player physics, deterministic moving-platform phases, and no position resets.
// This function is serializable into a browser page or the node:vm runtime.
function simulateRoute(options = {}) {
    const level = Levels[options.index || 0];
    const platforms = JSON.parse(JSON.stringify(level.platforms));
    const challenges = (level.traversalChallenges || []).filter(c => !options.challengeId || c.id === options.challengeId);
    const isolated = options.challengeId && challenges[0];
    const fullRoute = options.fullRoute || options.index >= 5;
    const start = isolated
        ? { x: isolated.start + 70, y: isolated.floorY }
        : fullRoute ? level.playerStart : { x: level.originalWidth - 150, y: 500 };
    const end = isolated ? isolated.end - 35 : level.levelWidth - 200;
    const p = new Player(start.x, start.y);
    const down = Input.isDown, pressed = Input.wasPressed, mouse = Input.isMouseDown;
    let direction = 1, jump = false, minY = p.y, maxY = p.y, time = 0, airborne = 0;
    let settled = false, freeTarget = null, freeAirFrames = 0, freeSecondFrame = 25;
    let jumps = 0, doubleJumps = 0, frames = 0;
    const trace=[];
    const records = challenges.map(c => ({ id: c.id, next: 1, landings: [], jumps: 0, doubleJumps: 0, waits: 0, complete: false }));
    const maxFrames = Math.ceil((end - start.x) / 170 * 60) + challenges.length * 600 + 600;
    const phase = options.phaseOffset || 0;
    platforms.forEach((f, i) => {
        if (!f.moving) return;
        f._startX = f.x; f._startY = f.y; f._phase = phase + i * 1.618;
    });
    function movePlatforms() {
        for (const f of platforms) {
            const x = f.x, y = f.y, m = f.moving;
            if (m?.ampX && m.speedX) f.x = f._startX + Math.sin(time * m.speedX + f._phase) * m.ampX;
            if (m?.ampY && m.speedY) f.y = f._startY + Math.sin(time * m.speedY + f._phase + .5) * m.ampY;
            f._dx = f.x - x; f._dy = f.y - y;
        }
    }
    function support() {
        // Motion advances before Player.update carries a grounded player. Identify
        // the actual prior contact surface, not the pad's already-moved top; fast
        // upward motion can exceed the collision tolerance in a single frame.
        return platforms.find(f => {
            const x=f.x-(f._dx||0),y=f.y-(f._dy||0);
            return p.x+p.w/2>x&&p.x-p.w/2<x+f.w&&Math.abs(p.y-y)<6;
        });
    }
    function predictedPlatform(f, future) {
        const m = f.moving;
        return {
            x: m?.ampX && m.speedX ? f._startX + Math.sin((time+future)*m.speedX+f._phase)*m.ampX : f.x,
            y: m?.ampY && m.speedY ? f._startY + Math.sin((time+future)*m.speedY+f._phase+.5)*m.ampY : f.y,
        };
    }
    function reachableWindow(floor, target, secondFrame) {
        let y=floor.y, vy=p.jumpForce;
        // Predict only the player's unchanged jump arc and platform sine trajectory;
        // waits choose a launch time, they never alter physics or the platform path.
        for (let i=1;i<=102;i++) {
            const t=i/60, oldY=y;
            vy+=p.gravity/60;y+=vy/60;
            const next=predictedPlatform(target,t);
            if (vy>=0 && oldY<=next.y+6 && y>=next.y-2 &&
                Math.abs(next.x+Math.min(target.w/2,60)-p.x) < 255*t-12) return true;
            if(i===secondFrame)vy=p.jumpForce*.85;
        }
        return false;
    }
    function interceptX(target) {
        let y=p.y, vy=p.vy, usedSecond=p.jumpCount>1;
        for (let i=1;i<=100;i++) {
            const future=i/60, old=y;
            vy+=p.gravity/60; y+=vy/60;
            if (!usedSecond && freeAirFrames+i>=freeSecondFrame) { vy=p.jumpForce*.85; usedSecond=true; }
            const next=predictedPlatform(target,future);
            if (vy>=0 && old<=next.y+5 && y>=next.y-2) return next.x+target.w/2;
        }
        return target.x+target.w/2;
    }
    Input.isDown = key => direction < 0 ? key === 'KeyA' : direction > 0 && key === 'KeyD';
    Input.wasPressed = key => key === 'KeyW' && jump;
    Input.isMouseDown = () => false;
    try {
        for (; frames < maxFrames && p.x < end && !p.dead; frames++) {
            time += 1 / 60; movePlatforms();
            jump = false; direction = 1;
            const floor = p.onGround ? support() : null;
            const ci = challenges.findIndex((c,i) => p.x <= c.end && !records[i].complete &&
                (records[i].started || p.onGround && floor?.traversalId === c.id));
            const c = challenges[ci], record = records[ci];
            if (!settled) {
                direction = 0;
                if (p.onGround) settled = true;
            } else if (c && !options.noJump) {
                record.started = true;
                freeTarget = null;
                const route = c.platformIds.map(id => platforms.find(f => f.id === id));
                if (route.some(f => !f)) throw new Error(`Missing route platform: ${c.id}`);
                if (floor && floor.id === route[record.next]?.id) {
                    record.landings.push({ step: record.next, platform: floor.id, x: p.x, y: p.y, time });
                    record.next++;
                    record.stepWaits = 0;
                    if (record.next >= route.length) record.complete = true;
                }
                if (!record.complete) {
                    const target = route[record.next];
                    if (p.onGround && floor) {
                        airborne = 0;
                        const launchX = floor.x + floor.w - 38;
                        direction = p.x < launchX - 5 ? 1 : p.x > launchX + 6 ? -1 : 0;
                        if (!direction) {
                            // A short readable pause on moving links waits for the next pad to
                            // approach; every phase has a bounded wait, never a position correction.
                            const waitingForMotion = !!(floor.moving || target.moving) && (record.stepWaits || 0) < 12;
                            if (waitingForMotion) { record.waits++; record.stepWaits = (record.stepWaits || 0) + 1; }
                            else { jump = true; direction = 1; record.jumps++; }
                        }
                    } else {
                        airborne += 1 / 60;
                        const targetX = target.x + target.w / 2;
                        direction = p.x < targetX - 5 ? 1 : p.x > targetX + 5 ? -1 : 0;
                        if (airborne >= .35 && p.jumpCount === 1) { jump = true; record.doubleJumps++; }
                    }
                }
            } else if (!options.noJump) {
                // Old floating routes also use real successive landings. On a wide deck the
                // player walks normally; at its edge choose the next platform and track its
                // actual moving position throughout a normal two-jump flight.
                if (p.onGround && floor) {
                    airborne = 0; freeTarget = null;freeAirFrames=0;
                    if (floor.x + floor.w - p.x < 45) {
                        const walkOff = platforms.some(f => f !== floor && f.y >= floor.y &&
                            f.x < p.x + 65 && f.x + f.w > p.x + 65);
                        const currentRight = floor._startX === undefined ? floor.x + floor.w : floor._startX + floor.w;
                        const candidates = platforms.filter(f => f !== floor &&
                            (f._startX ?? f.x) + f.w > currentRight + 20 &&
                            f.x + f.w / 2 > p.x + 40 &&
                            (f._startX ?? f.x) < currentRight + 500 &&
                            (f._startY ?? f.y)+(f.moving?.ampY||0) > floor.y - 240);
                        candidates.sort((a,b)=>(a._startX ?? a.x) - (b._startX ?? b.x) || b.y-a.y);
                        freeTarget = walkOff ? null : candidates[0] || null;
                        if (freeTarget) {
                            const timing=[25,16,33,42].find(frame=>reachableWindow(floor,freeTarget,frame));
                            if (timing) {jump = true;freeSecondFrame=timing;}
                            else { direction=0; freeTarget=null; }
                        }
                    }
                } else if (freeTarget) {
                    airborne += 1 / 60;freeAirFrames++;
                    const targetX = interceptX(freeTarget);
                    direction = p.x < targetX - 5 ? 1 : p.x > targetX + 5 ? -1 : 0;
                    if (freeAirFrames >= freeSecondFrame && p.jumpCount === 1) jump = true;
                }
            }
            const oldCount = p.jumpCount;
            p.update(1 / 60, platforms);
            if(options.trace){
                trace.push({frame:frames,x:p.x,y:p.y,vy:p.vy,onGround:p.onGround,jumpCount:p.jumpCount,jump,
                    target:freeTarget?{x:freeTarget.x,y:freeTarget.y,w:freeTarget.w,startX:freeTarget._startX}:null,
                    secondFrame:freeSecondFrame,freeAirFrames});
                if(trace.length>200)trace.shift();
            }
            if (jump && p.jumpConsumed) { jumps++; if (oldCount > 0) doubleJumps++; }
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        return { index: options.index, x: p.x, start: start.x, end, dead: p.dead, minY, maxY,
            fullRoute, frames, jumps, doubleJumps, challenges: records, ...(options.trace?{trace}:{}) };
    } finally { Input.isDown = down; Input.wasPressed = pressed; Input.isMouseDown = mouse; }
}

module.exports = { simulateRoute };
