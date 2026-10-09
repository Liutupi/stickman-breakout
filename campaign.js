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
    };

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
                baseY: type === 'sentinel' ? y : undefined,
            });
        };
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
            const encounters = [
                [[.19,'lancer'],[.37,'walker'],[.56,'scattergun'],[.75,'lancer'],[.88,'shooter']],
                [[.18,'jumper'],[.34,'sentinel'],[.44,'shooter'],[.69,'jumper'],[.84,'scattergun']],
                [[.18,'scattergun'],[.32,'shooter'],[.46,'sentinel'],[.64,'lancer'],[.76,'shooter'],[.89,'scattergun']],
                [[.18,'shielder'],[.25,'medic'],[.42,'lancer'],[.61,'shielder'],[.68,'medic'],[.85,'scattergun']],
                [[.17,'sentinel'],[.30,'jumper'],[.43,'lancer'],[.68,'sentinel'],[.79,'jumper'],[.9,'scattergun']],
                [[.15,'shielder'],[.24,'medic'],[.37,'scattergun'],[.48,'sentinel'],[.63,'lancer'],[.73,'shielder'],[.82,'medic'],[.91,'scattergun']],
            ][zone];
            for (const [fraction, type] of encounters) {
                addEnemy(cursor + Math.round(length * fraction), type === 'sentinel' ? floorY - 180 : floorY - 2, type);
            }
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
