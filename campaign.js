// 原关卡保留；六段有不同节奏的长路线，最后接独立 Boss 场地。
(() => {
    const routes = [
        ['装配车间', '货运栈桥', '熔炉长廊', '装甲仓库', '动力管廊', '核心机房'],
        ['荧光林径', '古树栈道', '月影回廊', '守林营地', '悬根幽谷', '翡翠圣所'],
        ['玄武岩桥', '熔岩裂谷', '灰烬长廊', '黑铁营垒', '地心断桥', '深渊锻炉'],
        ['冰封栈道', '极光裂隙', '寒霜回廊', '冻土要塞', '冰晶悬桥', '霜晶神殿'],
        ['碎星回廊', '重力断层', '虚空长堤', '星骸哨站', '失重边界', '日蚀祭坛'],
        ['残响废墟', '血色裂谷', '崩坏长廊', '混沌营垒', '破碎天桥', '创世之门'],
        ['雨幕天桥', '高架轨道', '广告塔群', '安保中枢', '空中连廊', '霓虹核心'],
        ['沙海石道', '流沙断桥', '王陵列柱', '禁卫营地', '悬空墓道', '太阳祭坛'],
        ['云端船坞', '浮空舰桥', '风暴长廊', '苍穹哨站', '云海断层', '天穹核心'],
    ];
    const variants = {
        lancer: { health: 48, speed: 85, damage: 18, score: 110, color: '#ffbd69', aggroRange: 460, attackRate: 2.4 },
        scattergun: { health: 42, speed: 65, damage: 14, score: 120, color: '#ff7394', aggroRange: 440, attackRate: 2.6, bulletSpeed: 290 },
        medic: { health: 38, speed: 70, damage: 9, score: 140, color: '#67efbb', aggroRange: 430, attackRate: 3.2 },
        sentinel: { health: 36, speed: 75, damage: 10, score: 130, color: '#c9a2ff', aggroRange: 520, attackRate: 2.8, bulletSpeed: 310, w: 38, h: 48 },
        walker: { health: 38, speed: 90, damage: 12, score: 65, color: '#e97d64' },
        jumper: { health: 32, speed: 110, damage: 12, score: 85, color: '#d796ed' },
        shielder: { health: 60, speed: 65, damage: 14, score: 130, color: '#82b8d8', shieldHP: 60 },
        shooter: { health: 32, speed: 60, damage: 12, score: 90, color: '#ec9c62', canShoot: true, attackRate: 1.8, aggroRange: 380 },
        // 空中兵种：蜂群（成群俯冲撞人）、炮艇（高空远距离扇射+投弹）、雷鹰（锁定后直线俯冲）
        swarm: { health: 14, speed: 150, damage: 9, score: 35, color: '#ffd166', aggroRange: 520, attackRate: 2.6, w: 20, h: 18 },
        gunship: { health: 160, speed: 75, damage: 12, score: 260, color: '#7cc4ff', aggroRange: 640, attackRate: 2.3, bulletSpeed: 300, w: 76, h: 40 },
        diver: { health: 40, speed: 130, damage: 18, score: 100, color: '#ff7a7a', aggroRange: 640, attackRate: 3.4, w: 36, h: 26 },
        // 原关卡里的老兵种，也可以出现在扩展路段
        runner: { health: 25, speed: 150, damage: 10, score: 60, color: '#c0392b' },
        kamikaze: { health: 15, speed: 220, damage: 35, score: 90, color: '#f39c12', aggroRange: 350 },
        missile: { health: 55, speed: 55, damage: 14, score: 150, color: '#9b59b6', canShoot: true, attackRate: 2.5, aggroRange: 500, bulletSpeed: 220 },
        turret: { health: 50, speed: 0, damage: 10, score: 100, color: '#e74c3c', canShoot: true, attackRate: 0.9, aggroRange: 420 },
        sniper: { health: 95, speed: 60, damage: 40, score: 450, color: '#ff3b5c', canShoot: true, attackRate: 2.6, aggroRange: 950, bulletSpeed: 1150 },
        flyer: { health: 30, speed: 120, damage: 10, score: 90, color: '#00bcd4', canShoot: true, attackRate: 1.5, aggroRange: 400 },
        drone: { health: 20, speed: 150, damage: 8, score: 80, color: '#00ffff', canShoot: true, attackRate: 0.8, aggroRange: 350 },
        bomber: { health: 40, speed: 80, damage: 14, score: 120, color: '#ff8800', canShoot: true, attackRate: 2.0, aggroRange: 450 },
        swooper: { health: 35, speed: 140, damage: 14, score: 130, color: '#ff4488', aggroRange: 380 },
    };
    // ---- 每关兵种表：逐关引入新兵种、组合越来越复杂（难度递增），每关主题不同 ----
    // ground 普通地面 / elite 精英与支援 / air 空中 / heavy 重型空中（炮艇）
    const ROSTER = [
        { theme: '步兵突击', ground: ['walker', 'shooter', 'runner'], elite: ['lancer', 'scattergun'], air: ['swarm', 'flyer'], heavy: [] },
        { theme: '林间伏击', ground: ['jumper', 'walker', 'shooter'], elite: ['scattergun', 'medic', 'lancer'], air: ['swooper', 'swarm', 'diver'], heavy: [] },
        { theme: '自爆与轰炸', ground: ['kamikaze', 'runner', 'shooter'], elite: ['lancer', 'turret', 'scattergun'], air: ['bomber', 'swarm', 'diver'], heavy: ['gunship'] },
        { theme: '盾阵推进', ground: ['shielder', 'jumper', 'walker'], elite: ['medic', 'missile', 'sentinel'], air: ['drone', 'diver', 'swarm'], heavy: ['gunship'] },
        { theme: '虚空空袭', airBonus: 2, ground: ['jumper', 'kamikaze', 'walker'], elite: ['sentinel', 'missile', 'scattergun'], air: ['swooper', 'drone', 'flyer', 'swarm', 'diver'], heavy: ['gunship'] },
        { theme: '混沌混编', ground: ['shielder', 'kamikaze', 'runner'], elite: ['medic', 'missile', 'lancer', 'turret'], air: ['bomber', 'diver', 'swarm', 'swooper'], heavy: ['gunship'] },
        { theme: '狙击街区', ground: ['shielder', 'runner', 'shooter'], elite: ['sniper', 'medic', 'lancer', 'sentinel'], air: ['drone', 'swarm', 'diver'], heavy: ['gunship'] },
        { theme: '沙暴围猎', ground: ['jumper', 'shielder', 'kamikaze'], elite: ['sniper', 'missile', 'scattergun', 'medic'], air: ['bomber', 'swooper', 'diver', 'swarm'], heavy: ['gunship'] },
        { theme: '天空要塞', airBonus: 1, ground: ['shielder', 'kamikaze'], elite: ['sniper', 'medic', 'sentinel', 'lancer', 'missile'], air: ['diver', 'swarm', 'drone', 'swooper', 'bomber'], heavy: ['gunship'] },
    ];
    const AIR_Y = { swarm: 170, gunship: 250, diver: 280, flyer: 150, drone: 160, bomber: 240, swooper: 230, sentinel: 180 };
    const AIR_TYPES = ['sentinel', 'swarm', 'gunship', 'diver', 'flyer', 'drone', 'bomber', 'swooper'];
    const AIR_HEIGHT = AIR_Y;

    Levels.forEach((level, index) => {
        const originalEnd = level.levelWidth;
        level.originalWidth = originalEnd;
        level.artIndex = index;
        level.sectors = [{ x: 0, name: '外围突破' }];
        let cursor = originalEnd;
        const scale = 1 + index * 0.24;
        const addEnemy = (x, y, type) => {
            const base = variants[type];
            level.enemies.push({ ...base, type, x, y,
                health: Math.round(base.health * scale), score: Math.round(base.score * (1 + index * 0.18)),
                damage: Math.round(base.damage * (1 + index * 0.1)),
                shieldHP: base.shieldHP ? Math.round(base.shieldHP * scale) : 0,
                baseY: AIR_TYPES.includes(type) ? y : undefined,
            });
        };
        // 一群蜂群无人机（数量随关卡增加）
        const swarmSize = 3 + Math.floor(index / 2);
        const addSwarm = (x, floorY) => {
            for (let k = 0; k < swarmSize; k++) addEnemy(x + (k - swarmSize / 2) * 46, floorY - AIR_HEIGHT.swarm - (k % 2) * 34, 'swarm');
        };
        const addAir = (x, floorY, type) => type === 'swarm' ? addSwarm(x, floorY) : addEnemy(x, floorY - AIR_HEIGHT[type], type);
        // 原关卡路段也补上空中威胁（远离出生点）
        if (originalEnd > 2400) {
            addSwarm(Math.round(originalEnd * 0.42), 430);
            addAir(Math.round(originalEnd * 0.72), 500, 'diver');
            if (index >= 3) addAir(Math.round(originalEnd * 0.86), 500, 'gunship');
        }
        // 接回原关尾端；浮空关卡也能安全落到新路线。
        level.platforms.push({ x: originalEnd - 220, y: 500, w: 300, h: 100 });
        for (let zone = 0; zone < 6; zone++) {
            const length = 1600 + zone * 120 + index * 85;
            const floorY = [500, 470, 500, 460, 500, 480][zone];
            const traversal = zone === 1 || zone === 4;
            const gapStart = Math.round(length * 0.52);
            const gap = index === 0 ? 100 : 130;
            const rhythms = ['突击推进', '栈道穿越', '交叉火力', '支援阵地', '空地夹击', '核心攻坚'];
            level.sectors.push({ x: cursor, name: routes[index][zone], rhythm: rhythms[zone], floorY });
            if (traversal) {
                level.platforms.push({ x: cursor, y: floorY, w: gapStart, h: 100 });
                level.platforms.push({ x: cursor + gapStart + gap, y: floorY, w: length - gapStart - gap, h: 100 });
                level.platforms.push({ x: cursor + gapStart + 18, y: floorY - 65, w: gap - 36, h: 18 });
            } else level.platforms.push({ x: cursor, y: floorY, w: length, h: 100 });
            // 高低路线用于闪避和取武器；主线缺口保留可直接跳过的距离。
            for (const [fraction, elevation] of [[0.16,90],[0.34,155],[0.71,105],[0.87,145]]) {
                level.platforms.push({ x: cursor + Math.round(length * fraction), y: floorY - elevation, w: 180, h: 18,
                    moving: traversal && fraction === 0.34 ? { ampY: 24, speedY: 1.1 + index * 0.06 } : undefined });
            }
            // 按本关兵种表生成本区的遭遇：数量随关卡和区段递增，类型在各区之间轮换
            const R = ROSTER[index];
            const pick = (list, k) => list[(k + zone * 2 + index) % list.length];
            const nGround = 3 + Math.floor(index / 3) + (zone >= 3 ? 1 : 0);
            const nElite = 1 + Math.floor((index + zone) / 4);
            const nAir = 1 + Math.floor(index / 3) + (zone === 4 ? 1 : 0) + (R.airBonus && zone % 2 === 1 ? R.airBonus : 0);
            const nHeavy = R.heavy.length ? ((zone === 2 || zone === 5) ? 1 : 0) + (index >= 6 && zone === 4 ? 1 : 0) : 0;
            const slots = [];
            const total = nGround + nElite;
            for (let k = 0; k < total; k++) {
                let f = 0.14 + (k + 0.5) / total * 0.78;
                if (traversal && f > 0.47 && f < 0.64) f = f < 0.555 ? 0.45 : 0.67;   // 避开断桥缺口
                slots.push(f);
            }
            let si = 0;
            for (let k = 0; k < nGround; k++) {
                const type = pick(R.ground, k);
                addEnemy(cursor + Math.round(length * slots[si++]), floorY - 2, type);
            }
            for (let k = 0; k < nElite; k++) {
                const type = pick(R.elite, k);
                const x = cursor + Math.round(length * slots[si++]);
                if (type === 'sentinel') addEnemy(x, floorY - AIR_Y.sentinel, type);
                else addEnemy(x, floorY - 2, type);
                // 医师总和盾兵/枪兵搭配出现
                if (type === 'medic') addEnemy(x + 70, floorY - 2, R.ground.includes('shielder') ? 'shielder' : 'walker');
            }
            for (let k = 0; k < nAir; k++) addAir(cursor + Math.round(length * (0.25 + (k + 0.5) / nAir * 0.6)), floorY, pick(R.air, k));
            for (let k = 0; k < nHeavy; k++) addAir(cursor + Math.round(length * (k ? 0.82 : 0.4)), floorY, 'gunship');
            level.weaponDrops.push({ x: cursor + 90, y: floorY - 4, type: 'health' });
            level.weaponDrops.push({ x: cursor + Math.round(length * .16) + 70, y: floorY - 94,
                type: ['shotgun', 'laser', 'rocket', 'shotgun', 'laser', 'rocket'][zone] });
            level.weaponDrops.push({ x: cursor + Math.round(length * .71) + 60, y: floorY - 109, type: zone % 2 ? 'health' : 'grenade' });
            // 后半程的地面补给，让长关卡的消耗可控。
            level.weaponDrops.push({ x: cursor + length - 130, y: floorY - 4, type: zone % 2 ? 'grenade' : 'health' });
            cursor += length;
        }
        level.arenaStart = cursor;
        level.sectors.push({ x: cursor, name: '首领决战' });
        level.platforms.push({ x: cursor, y: 500, w: 1600, h: 100 });
        level.weaponDrops.push({ x: cursor + 120, y: 496, type: 'health' });
        level.weaponDrops.push({ x: cursor + 220, y: 496, type: 'rocket' });
        level.boss = { ...level.boss, x: cursor + 950, y: 500,
            w: Math.max(level.boss.w, 64), h: Math.max(Math.round(level.boss.h * 1.3), 154), artIndex: index,
            arenaMin: cursor + 60, arenaMax: cursor + 1540 };
        level.levelWidth = cursor + 1600;
        level.cameraBounds = { minX: 0, maxX: level.levelWidth };
        // 一次性的补给点也作为分段推进的地标。
        level.supplyBeacons = level.sectors.slice(1, -1).map(s => ({ x: s.x + 90, y: s.floorY }));
        level.enemies.forEach((enemy, id) => { enemy.spawnId = id; });
    });
})();
