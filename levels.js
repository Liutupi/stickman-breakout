// ==================== 关卡设计 ====================
const Levels = [
    // ---- 第一关：废弃工厂（入门级）----
    // 特点：地面连续，平台间距小，敌人少，容易上手
    {
        name: '第一关 · 废弃工厂',
        bgGradient: (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#1a1a2e');
            g.addColorStop(0.5, '#16213e');
            g.addColorStop(1, '#0f3460');
            return g;
        },
        groundColor: '#2c3e50',
        groundDetail: '#34495e',
        platformColor: '#4a6080',
        platformDetail: '#5a7090',
        playerStart: { x: 100, y: 400 },
        cameraBounds: { minX: 0, maxX: 4200 },
        platforms: [
            // 连续地面（无断层）
            { x: 0, y: 500, w: 4200, h: 100 },
            // 平台（间距小，高度低，容易跳上）
            { x: 250, y: 440, w: 130, h: 16 },
            { x: 450, y: 400, w: 120, h: 16 },
            { x: 650, y: 360, w: 110, h: 16, moving: { ampX: 60, speedX: 1.0 } },
            { x: 850, y: 400, w: 130, h: 16 },
            { x: 1050, y: 440, w: 120, h: 16 },
            { x: 1300, y: 400, w: 140, h: 16, moving: { ampX: 80, speedX: 0.9 } },
            { x: 1550, y: 360, w: 120, h: 16, moving: { ampY: 50, speedY: 1.2 } },
            { x: 1800, y: 400, w: 130, h: 16 },
            { x: 2050, y: 440, w: 140, h: 16 },
            { x: 2300, y: 400, w: 120, h: 16 },
            { x: 2550, y: 360, w: 130, h: 16 },
            { x: 2800, y: 400, w: 140, h: 16 },
            { x: 3050, y: 440, w: 120, h: 16, moving: { ampX: 70, speedX: 1.1 } },
            { x: 3300, y: 400, w: 130, h: 16 },
            { x: 3550, y: 440, w: 140, h: 16 },
            { x: 3800, y: 400, w: 150, h: 16 },
        ],
        enemies: [
            // 敌人较少，血量低
            { x: 500, y: 496, type: 'walker', health: 30, speed: 80, score: 50, color: '#e74c3c' },
            { x: 900, y: 496, type: 'walker', health: 35, speed: 85, score: 55, color: '#e74c3c' },
            { x: 1100, y: 436, type: 'shooter', health: 25, speed: 60, canShoot: true, attackRate: 1.5, aggroRange: 350, score: 80, color: '#e67e22' },
            { x: 1500, y: 496, type: 'runner', health: 25, speed: 150, score: 60, color: '#c0392b' },
            { x: 1900, y: 496, type: 'walker', health: 40, speed: 80, score: 60, color: '#e74c3c' },
            { x: 2200, y: 396, type: 'shooter', health: 30, speed: 65, canShoot: true, attackRate: 1.3, aggroRange: 380, score: 85, color: '#e67e22' },
            { x: 2600, y: 496, type: 'runner', health: 28, speed: 160, score: 65, color: '#c0392b' },
            { x: 3000, y: 496, type: 'walker', health: 45, speed: 75, score: 65, color: '#e74c3c' },
            { x: 3200, y: 496, type: 'kamikaze', health: 15, speed: 220, damage: 35, score: 90, color: '#f39c12', aggroRange: 350 },
            { x: 3400, y: 496, type: 'walker', health: 50, speed: 70, score: 70, color: '#e74c3c' },
            { x: 3600, y: 496, type: 'kamikaze', health: 18, speed: 230, damage: 38, score: 95, color: '#f39c12', aggroRange: 360 },
            { x: 1700, y: 499, type: 'turret', health: 50, speed: 0, canShoot: true, attackRate: 0.8, aggroRange: 400, score: 100, color: '#e74c3c' },
            { x: 2800, y: 499, type: 'turret', health: 55, speed: 0, canShoot: true, attackRate: 0.7, aggroRange: 420, score: 110, color: '#e74c3c' },
            { x: 1300, y: 350, type: 'flyer', health: 30, speed: 120, canShoot: true, attackRate: 1.5, aggroRange: 400, score: 90, color: '#00bcd4', baseY: 350 },
            { x: 2500, y: 330, type: 'flyer', health: 35, speed: 130, canShoot: true, attackRate: 1.4, aggroRange: 420, score: 95, color: '#00bcd4', baseY: 330 },
            { x: 2000, y: 280, type: 'bomber', health: 40, speed: 80, canShoot: true, attackRate: 2.0, aggroRange: 450, score: 120, color: '#ff8800', baseY: 280 },
            { x: 3100, y: 300, type: 'drone', health: 20, speed: 150, canShoot: true, attackRate: 0.8, aggroRange: 350, score: 80, color: '#00ffff', baseY: 300 },
        ],
        weaponDrops: [
            { x: 350, y: 396, type: 'shotgun' },
            { x: 750, y: 356, type: 'smg' },
            { x: 1100, y: 496, type: 'health' },
            { x: 1350, y: 396, type: 'laser' },
            { x: 1800, y: 496, type: 'molotov' },
            { x: 2000, y: 436, type: 'shotgun' },
            { x: 2650, y: 356, type: 'rocket' },
            { x: 3000, y: 496, type: 'health' },
            { x: 3350, y: 396, type: 'smg' },
        ],
        boss: {
            x: 4000, y: 496,
            name: '钢铁守卫',
            health: 500,
            damage: 15,
            speed: 70,
            w: 45, h: 70,
            color: '#e74c3c',
            level: 1,
            score: 500,
        },
        levelWidth: 4200,
    },

    // ---- 第二关：黑暗森林（中等难度）----
    // 特点：地面有断层，平台间距大，需要跳跃技巧
    {
        name: '第二关 · 黑暗森林',
        bgGradient: (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#0a1a0a');
            g.addColorStop(0.4, '#1a2f1a');
            g.addColorStop(1, '#2d4a2d');
            return g;
        },
        groundColor: '#2d4a2d',
        groundDetail: '#3a5f3a',
        platformColor: '#4a6b4a',
        platformDetail: '#5a7b5a',
        playerStart: { x: 100, y: 400 },
        cameraBounds: { minX: 0, maxX: 5000 },
        platforms: [
            // 地面有断层（间隔150-250像素，掉下去会死）
            { x: 0, y: 500, w: 800, h: 100 },       // 第一段地面
            // 断层！
            { x: 1050, y: 500, w: 600, h: 100 },    // 第二段地面
            // 断层！
            { x: 1900, y: 500, w: 500, h: 100 },    // 第三段地面
            // 断层！
            { x: 2650, y: 500, w: 600, h: 100 },    // 第四段地面
            // 断层！
            { x: 3500, y: 500, w: 500, h: 100 },    // 第五段地面
            // 断层！
            { x: 4250, y: 500, w: 750, h: 100 },    // 第六段地面

            // 平台（间距大，需要精准跳跃）
            { x: 200, y: 430, w: 100, h: 16, moving: { ampX: 70, speedX: 1.0 } },
            { x: 400, y: 370, w: 90, h: 16, moving: { ampY: 45, speedY: 1.3 } },
            { x: 600, y: 430, w: 100, h: 16 },
            // 跨越第一个断层的平台
            { x: 850, y: 420, w: 80, h: 16, moving: { ampX: 60, speedX: 1.2 } },
            { x: 1000, y: 380, w: 90, h: 16 },
            { x: 1200, y: 430, w: 100, h: 16 },
            { x: 1400, y: 370, w: 90, h: 16 },
            // 跨越第二个断层的平台
            { x: 1650, y: 400, w: 80, h: 16, moving: { ampX: 65, speedX: 0.9, ampY: 35, speedY: 1.5 } },
            { x: 1800, y: 360, w: 90, h: 16 },
            { x: 2000, y: 430, w: 100, h: 16 },
            { x: 2200, y: 380, w: 90, h: 16 },
            // 跨越第三个断层的平台
            { x: 2450, y: 410, w: 80, h: 16, moving: { ampX: 75, speedX: 1.3 } },
            { x: 2600, y: 370, w: 90, h: 16 },
            { x: 2800, y: 430, w: 100, h: 16 },
            { x: 3000, y: 380, w: 90, h: 16 },
            { x: 3200, y: 340, w: 80, h: 16 },
            // 跨越第四个断层的平台
            { x: 3350, y: 400, w: 80, h: 16 },
            { x: 3500, y: 360, w: 90, h: 16 },
            { x: 3700, y: 430, w: 100, h: 16 },
            { x: 3900, y: 380, w: 90, h: 16 },
            // 跨越第五个断层的平台
            { x: 4100, y: 410, w: 80, h: 16 },
            { x: 4250, y: 370, w: 90, h: 16 },
            { x: 4450, y: 430, w: 100, h: 16 },
            { x: 4650, y: 380, w: 90, h: 16 },
        ],
        enemies: [
            // 敌人更多，分布在地面和平台上
            { x: 400, y: 496, type: 'walker', health: 45, speed: 90, score: 60, color: '#27ae60' },
            { x: 700, y: 496, type: 'jumper', health: 35, speed: 110, score: 70, color: '#1abc9c' },
            { x: 900, y: 376, type: 'shooter', health: 35, speed: 65, canShoot: true, attackRate: 1.2, aggroRange: 400, score: 100, color: '#2ecc71' },
            { x: 1200, y: 496, type: 'runner', health: 30, speed: 180, score: 75, color: '#16a085' },
            { x: 1500, y: 496, type: 'walker', health: 55, speed: 85, score: 70, color: '#27ae60' },
            { x: 1700, y: 366, type: 'shooter', health: 40, speed: 60, canShoot: true, attackRate: 1.0, aggroRange: 420, score: 110, color: '#2ecc71' },
            { x: 2000, y: 496, type: 'jumper', health: 40, speed: 120, score: 80, color: '#1abc9c' },
            { x: 2300, y: 496, type: 'runner', health: 35, speed: 185, score: 80, color: '#16a085' },
            { x: 2500, y: 376, type: 'shooter', health: 45, speed: 60, canShoot: true, attackRate: 0.9, aggroRange: 440, score: 120, color: '#2ecc71' },
            { x: 2800, y: 496, type: 'walker', health: 60, speed: 80, score: 80, color: '#27ae60' },
            { x: 3100, y: 496, type: 'jumper', health: 45, speed: 125, score: 85, color: '#1abc9c' },
            { x: 3500, y: 496, type: 'runner', health: 38, speed: 190, score: 85, color: '#16a085' },
            { x: 3700, y: 366, type: 'shooter', health: 48, speed: 65, canShoot: true, attackRate: 0.8, aggroRange: 450, score: 130, color: '#2ecc71' },
            { x: 3850, y: 496, type: 'walker', health: 65, speed: 85, score: 90, color: '#27ae60' },
            { x: 4000, y: 496, type: 'missile', health: 55, speed: 55, canShoot: true, attackRate: 2.5, aggroRange: 500, score: 150, color: '#9b59b6', bulletSpeed: 220 },
            { x: 4200, y: 496, type: 'kamikaze', health: 25, speed: 250, damage: 45, score: 110, color: '#f39c12', aggroRange: 400 },
            { x: 4350, y: 496, type: 'jumper', health: 50, speed: 130, score: 90, color: '#1abc9c' },
            { x: 4500, y: 496, type: 'kamikaze', health: 28, speed: 260, damage: 48, score: 115, color: '#f39c12', aggroRange: 420 },
            { x: 4600, y: 496, type: 'runner', health: 42, speed: 195, score: 95, color: '#16a085' },
            { x: 1300, y: 499, type: 'turret', health: 60, speed: 0, canShoot: true, attackRate: 0.7, aggroRange: 450, score: 120, color: '#27ae60' },
            { x: 2800, y: 499, type: 'turret', health: 65, speed: 0, canShoot: true, attackRate: 0.6, aggroRange: 460, score: 130, color: '#27ae60' },
            { x: 4400, y: 499, type: 'turret', health: 70, speed: 0, canShoot: true, attackRate: 0.6, aggroRange: 480, score: 140, color: '#27ae60' },
            { x: 600, y: 330, type: 'flyer', health: 40, speed: 130, canShoot: true, attackRate: 1.3, aggroRange: 440, score: 110, color: '#00bcd4', baseY: 330 },
            { x: 2200, y: 310, type: 'flyer', health: 45, speed: 140, canShoot: true, attackRate: 1.2, aggroRange: 460, score: 120, color: '#00bcd4', baseY: 310 },
            { x: 3600, y: 320, type: 'flyer', health: 50, speed: 145, canShoot: true, attackRate: 1.1, aggroRange: 480, score: 130, color: '#00bcd4', baseY: 320 },
            { x: 1500, y: 290, type: 'bomber', health: 55, speed: 90, canShoot: true, attackRate: 1.8, aggroRange: 500, score: 150, color: '#ff8800', baseY: 290 },
            { x: 3000, y: 270, type: 'bomber', health: 60, speed: 95, canShoot: true, attackRate: 1.6, aggroRange: 520, score: 160, color: '#ff8800', baseY: 270 },
            { x: 1000, y: 350, type: 'swooper', health: 35, speed: 140, aggroRange: 380, score: 130, color: '#ff4488', baseY: 250 },
            { x: 2800, y: 330, type: 'swooper', health: 40, speed: 150, aggroRange: 400, score: 140, color: '#ff4488', baseY: 240 },
            { x: 4200, y: 300, type: 'drone', health: 25, speed: 160, canShoot: true, attackRate: 0.7, aggroRange: 380, score: 100, color: '#00ffff', baseY: 300 },
            { x: 4400, y: 310, type: 'drone', health: 25, speed: 165, canShoot: true, attackRate: 0.7, aggroRange: 380, score: 100, color: '#00ffff', baseY: 310 },
        ],
        weaponDrops: [
            { x: 300, y: 426, type: 'shotgun' },
            { x: 600, y: 496, type: 'molotov' },
            { x: 850, y: 416, type: 'laser' },
            { x: 1300, y: 426, type: 'rocket' },
            { x: 1600, y: 496, type: 'health' },
            { x: 1800, y: 356, type: 'smg' },
            { x: 2300, y: 426, type: 'shotgun' },
            { x: 2600, y: 496, type: 'molotov' },
            { x: 2850, y: 426, type: 'laser' },
            { x: 3200, y: 496, type: 'health' },
            { x: 3400, y: 396, type: 'rocket' },
            { x: 3950, y: 426, type: 'smg' },
            { x: 4200, y: 496, type: 'molotov' },
            { x: 4500, y: 426, type: 'shotgun' },
        ],
        boss: {
            x: 4800, y: 496,
            name: '暗影之王',
            health: 800,
            damage: 20,
            speed: 90,
            w: 50, h: 80,
            color: '#2ecc71',
            level: 2,
            score: 800,
        },
        levelWidth: 5000,
    },

    // ---- 第三关：熔岩地穴（高难度）----
    // 特点：地形复杂，多层平台，大量断层，需要二段跳技巧
    {
        name: '第三关 · 熔岩地穴',
        bgGradient: (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#1a0a0a');
            g.addColorStop(0.4, '#2e1010');
            g.addColorStop(1, '#4a1515');
            return g;
        },
        groundColor: '#4a2020',
        groundDetail: '#5a2828',
        platformColor: '#6a3030',
        platformDetail: '#7a3838',
        playerStart: { x: 100, y: 400 },
        cameraBounds: { minX: 0, maxX: 6300 },
        platforms: [
            // 地面有大量断层（间隔200-350像素）
            { x: 0, y: 500, w: 600, h: 100 },        // 第一段
            // 断层！
            { x: 900, y: 500, w: 400, h: 100 },      // 第二段
            // 断层！
            { x: 1500, y: 500, w: 350, h: 100 },     // 第三段
            // 断层！
            { x: 2100, y: 500, w: 400, h: 100 },     // 第四段
            // 断层！
            { x: 2800, y: 500, w: 350, h: 100 },     // 第五段
            // 断层！
            { x: 3400, y: 500, w: 400, h: 100 },     // 第六段
            // 断层！
            { x: 4100, y: 500, w: 350, h: 100 },     // 第七段
            // 断层！
            { x: 4700, y: 500, w: 400, h: 100 },     // 第八段
            // 断层！
            { x: 5400, y: 500, w: 800, h: 100 },     // 最后一段

            // 复杂多层平台系统
            // 第一区域：阶梯式上升
            { x: 150, y: 440, w: 80, h: 16, moving: { ampX: 50, speedX: 1.5 } },
            { x: 300, y: 380, w: 70, h: 16 },
            { x: 450, y: 320, w: 80, h: 16, moving: { ampY: 40, speedY: 1.8 } },
            { x: 550, y: 260, w: 70, h: 16 },
            // 跨越第一个断层（需要二段跳）
            { x: 700, y: 350, w: 70, h: 16, moving: { ampX: 60, speedX: 1.4 } },
            { x: 820, y: 300, w: 80, h: 16, moving: { ampX: 55, speedX: 0.9, ampY: 30, speedY: 2.0 } },
            { x: 950, y: 420, w: 90, h: 16 },
            // 第二区域：交错平台
            { x: 1100, y: 360, w: 70, h: 16 },
            { x: 1250, y: 440, w: 80, h: 16 },
            { x: 1400, y: 320, w: 70, h: 16 },
            // 跨越第二个断层
            { x: 1550, y: 380, w: 70, h: 16, moving: { ampX: 80, speedX: 1.2 } },
            { x: 1680, y: 320, w: 80, h: 16, moving: { ampY: 50, speedY: 1.6 } },
            { x: 1800, y: 260, w: 70, h: 16 },
            { x: 1950, y: 400, w: 90, h: 16 },
            // 第三区域：高空平台
            { x: 2150, y: 300, w: 70, h: 16, moving: { ampX: 70, speedX: 1.3 } },
            { x: 2300, y: 240, w: 80, h: 16, moving: { ampX: 60, speedX: 1.0, ampY: 35, speedY: 1.7 } },
            { x: 2450, y: 350, w: 70, h: 16 },
            { x: 2600, y: 280, w: 80, h: 16, moving: { ampY: 45, speedY: 1.4 } },
            // 跨越第三个断层
            { x: 2750, y: 380, w: 70, h: 16 },
            { x: 2880, y: 320, w: 80, h: 16 },
            { x: 3000, y: 260, w: 70, h: 16 },
            { x: 3150, y: 400, w: 90, h: 16 },
            // 第四区域：连续跳跃
            { x: 3300, y: 340, w: 70, h: 16 },
            { x: 3450, y: 280, w: 80, h: 16 },
            { x: 3600, y: 350, w: 70, h: 16 },
            { x: 3750, y: 420, w: 80, h: 16 },
            { x: 3900, y: 300, w: 70, h: 16 },
            // 跨越第四个断层
            { x: 4050, y: 380, w: 70, h: 16 },
            { x: 4180, y: 320, w: 80, h: 16 },
            { x: 4300, y: 260, w: 70, h: 16 },
            { x: 4450, y: 400, w: 90, h: 16 },
            // 第五区域：最终考验
            { x: 4600, y: 340, w: 70, h: 16 },
            { x: 4750, y: 280, w: 80, h: 16 },
            { x: 4900, y: 220, w: 70, h: 16 },
            { x: 5050, y: 350, w: 80, h: 16 },
            { x: 5200, y: 420, w: 90, h: 16 },
            // 跨越最后断层
            { x: 5350, y: 360, w: 70, h: 16 },
            { x: 5500, y: 300, w: 80, h: 16 },
            { x: 5650, y: 380, w: 90, h: 16 },
            { x: 5850, y: 420, w: 100, h: 16 },
            { x: 6050, y: 380, w: 110, h: 16 },
        ],
        enemies: [
            // 敌人密集，血量高，分布在各层平台
            // 第一段地面 (0-600)
            { x: 300, y: 496, type: 'walker', health: 60, speed: 100, score: 80, color: '#e74c3c' },
            { x: 500, y: 256, type: 'shooter', health: 50, speed: 70, canShoot: true, attackRate: 1.0, aggroRange: 500, score: 150, color: '#ff6b6b' },
            // 第二段地面 (900-1300)
            { x: 950, y: 496, type: 'runner', health: 45, speed: 200, score: 90, color: '#d35400' },
            { x: 1100, y: 496, type: 'shooter', health: 55, speed: 75, canShoot: true, attackRate: 0.9, aggroRange: 480, score: 160, color: '#ff6b6b' },
            // 第三段地面 (1500-1850)
            { x: 1550, y: 496, type: 'walker', health: 70, speed: 90, score: 100, color: '#e74c3c' },
            { x: 1700, y: 316, type: 'jumper', health: 60, speed: 140, score: 110, color: '#e67e22' },
            // 第四段地面 (2100-2500)
            { x: 2200, y: 496, type: 'walker', health: 75, speed: 95, score: 110, color: '#e74c3c' },
            { x: 2400, y: 236, type: 'shooter', health: 65, speed: 65, canShoot: true, attackRate: 0.7, aggroRange: 520, score: 200, color: '#ff6b6b' },
            // 第五段地面 (2800-3150)
            { x: 2850, y: 496, type: 'runner', health: 55, speed: 215, score: 120, color: '#d35400' },
            { x: 3050, y: 496, type: 'shooter', health: 70, speed: 70, canShoot: true, attackRate: 0.6, aggroRange: 530, score: 210, color: '#ff6b6b' },
            { x: 3100, y: 496, type: 'kamikaze', health: 40, speed: 280, damage: 55, score: 200, color: '#f39c12', aggroRange: 450 },
            // 第六段地面 (3400-3800)
            { x: 3450, y: 496, type: 'walker', health: 80, speed: 100, score: 130, color: '#e74c3c' },
            { x: 3550, y: 496, type: 'missile', health: 80, speed: 60, canShoot: true, attackRate: 2.0, aggroRange: 550, score: 250, color: '#9b59b6', bulletSpeed: 250 },
            { x: 3600, y: 276, type: 'jumper', health: 70, speed: 150, score: 130, color: '#e67e22' },
            { x: 3750, y: 496, type: 'runner', health: 58, speed: 220, score: 130, color: '#d35400' },
            // 第七段地面 (4100-4450)
            { x: 4150, y: 496, type: 'shooter', health: 75, speed: 75, canShoot: true, attackRate: 0.5, aggroRange: 550, score: 220, color: '#ff6b6b' },
            { x: 4250, y: 496, type: 'kamikaze', health: 45, speed: 290, damage: 58, score: 210, color: '#f39c12', aggroRange: 460 },
            { x: 4300, y: 496, type: 'walker', health: 85, speed: 90, score: 140, color: '#e74c3c' },
            // 第八段地面 (4700-5100)
            { x: 4750, y: 496, type: 'jumper', health: 75, speed: 155, score: 140, color: '#e67e22' },
            { x: 4850, y: 496, type: 'missile', health: 90, speed: 65, canShoot: true, attackRate: 1.8, aggroRange: 560, score: 270, color: '#9b59b6', bulletSpeed: 260 },
            { x: 4950, y: 496, type: 'shooter', health: 85, speed: 80, canShoot: true, attackRate: 0.4, aggroRange: 560, score: 240, color: '#ff6b6b' },
            // 最后一段地面 (5400-6200)
            { x: 5450, y: 496, type: 'walker', health: 90, speed: 95, score: 150, color: '#e74c3c' },
            { x: 5550, y: 496, type: 'kamikaze', health: 50, speed: 300, damage: 60, score: 220, color: '#f39c12', aggroRange: 480 },
            { x: 5650, y: 496, type: 'runner', health: 65, speed: 230, score: 150, color: '#d35400' },
            { x: 5800, y: 496, type: 'kamikaze', health: 50, speed: 300, damage: 60, score: 220, color: '#f39c12', aggroRange: 480 },
            { x: 5900, y: 496, type: 'walker', health: 95, speed: 85, score: 160, color: '#e74c3c' },
            { x: 6050, y: 496, type: 'jumper', health: 80, speed: 160, score: 160, color: '#e67e22' },
            { x: 1200, y: 499, type: 'turret', health: 80, speed: 0, canShoot: true, attackRate: 0.5, aggroRange: 500, score: 180, color: '#e74c3c' },
            { x: 2600, y: 499, type: 'turret', health: 90, speed: 0, canShoot: true, attackRate: 0.5, aggroRange: 520, score: 200, color: '#e74c3c' },
            { x: 3400, y: 499, type: 'turret', health: 95, speed: 0, canShoot: true, attackRate: 0.4, aggroRange: 540, score: 210, color: '#e74c3c' },
            { x: 4800, y: 499, type: 'turret', health: 100, speed: 0, canShoot: true, attackRate: 0.4, aggroRange: 560, score: 230, color: '#e74c3c' },
            { x: 700, y: 280, type: 'flyer', health: 60, speed: 150, canShoot: true, attackRate: 1.0, aggroRange: 500, score: 180, color: '#00bcd4', baseY: 280 },
            { x: 1900, y: 300, type: 'flyer', health: 65, speed: 155, canShoot: true, attackRate: 0.9, aggroRange: 520, score: 190, color: '#00bcd4', baseY: 300 },
            { x: 3100, y: 260, type: 'flyer', health: 70, speed: 160, canShoot: true, attackRate: 0.8, aggroRange: 540, score: 200, color: '#00bcd4', baseY: 260 },
            { x: 4300, y: 280, type: 'flyer', health: 75, speed: 165, canShoot: true, attackRate: 0.8, aggroRange: 550, score: 220, color: '#00bcd4', baseY: 280 },
            { x: 5600, y: 250, type: 'flyer', health: 80, speed: 170, canShoot: true, attackRate: 0.7, aggroRange: 560, score: 240, color: '#00bcd4', baseY: 250 },
            { x: 1200, y: 260, type: 'bomber', health: 70, speed: 100, canShoot: true, attackRate: 1.5, aggroRange: 550, score: 200, color: '#ff8800', baseY: 260 },
            { x: 2500, y: 240, type: 'bomber', health: 75, speed: 105, canShoot: true, attackRate: 1.4, aggroRange: 560, score: 220, color: '#ff8800', baseY: 240 },
            { x: 3800, y: 250, type: 'bomber', health: 80, speed: 110, canShoot: true, attackRate: 1.3, aggroRange: 580, score: 240, color: '#ff8800', baseY: 250 },
            { x: 5200, y: 230, type: 'bomber', health: 85, speed: 115, canShoot: true, attackRate: 1.2, aggroRange: 600, score: 260, color: '#ff8800', baseY: 230 },
            { x: 800, y: 300, type: 'swooper', health: 50, speed: 160, aggroRange: 420, score: 180, color: '#ff4488', baseY: 200 },
            { x: 2000, y: 280, type: 'swooper', health: 55, speed: 170, aggroRange: 440, score: 200, color: '#ff4488', baseY: 190 },
            { x: 3500, y: 260, type: 'swooper', health: 60, speed: 180, aggroRange: 460, score: 220, color: '#ff4488', baseY: 180 },
            { x: 4900, y: 270, type: 'swooper', health: 65, speed: 185, aggroRange: 480, score: 240, color: '#ff4488', baseY: 170 },
            { x: 1400, y: 320, type: 'drone', health: 30, speed: 180, canShoot: true, attackRate: 0.6, aggroRange: 400, score: 150, color: '#00ffff', baseY: 320 },
            { x: 1600, y: 330, type: 'drone', health: 30, speed: 185, canShoot: true, attackRate: 0.6, aggroRange: 400, score: 150, color: '#00ffff', baseY: 330 },
            { x: 2800, y: 290, type: 'drone', health: 35, speed: 190, canShoot: true, attackRate: 0.5, aggroRange: 420, score: 170, color: '#00ffff', baseY: 290 },
            { x: 3000, y: 300, type: 'drone', health: 35, speed: 195, canShoot: true, attackRate: 0.5, aggroRange: 420, score: 170, color: '#00ffff', baseY: 300 },
            { x: 4500, y: 280, type: 'drone', health: 40, speed: 200, canShoot: true, attackRate: 0.5, aggroRange: 440, score: 190, color: '#00ffff', baseY: 280 },
            { x: 4700, y: 290, type: 'drone', health: 40, speed: 200, canShoot: true, attackRate: 0.5, aggroRange: 440, score: 190, color: '#00ffff', baseY: 290 },
        ],
        weaponDrops: [
            { x: 200, y: 436, type: 'shotgun' },
            { x: 400, y: 496, type: 'molotov' },
            { x: 550, y: 256, type: 'laser' },
            { x: 700, y: 496, type: 'health' },    // 第一区域血包(flyer+shooter密集)
            { x: 850, y: 296, type: 'rocket' },
            { x: 1050, y: 496, type: 'health' },
            { x: 1200, y: 356, type: 'smg' },
            { x: 1400, y: 496, type: 'health' },   // 第二区域血包(turret+drone密集)
            { x: 1600, y: 376, type: 'shotgun' },
            { x: 1850, y: 496, type: 'molotov' },
            { x: 2000, y: 396, type: 'laser' },
            { x: 2200, y: 496, type: 'health' },   // 第三区域血包(flyer+swooper+bomber密集)
            { x: 2400, y: 236, type: 'rocket' },
            { x: 2700, y: 496, type: 'health' },
            { x: 2850, y: 376, type: 'smg' },
            { x: 3000, y: 496, type: 'health' },   // 第四区域血包(2drone+flyer+shooter密集)
            { x: 3300, y: 336, type: 'shotgun' },
            { x: 3500, y: 496, type: 'molotov' },
            { x: 3650, y: 496, type: 'health' },   // 第五区域血包(swooper+bomber+missile密集)
            { x: 3700, y: 346, type: 'laser' },
            { x: 4150, y: 376, type: 'rocket' },
            { x: 4400, y: 496, type: 'health' },
            { x: 4500, y: 496, type: 'health' },   // 第六区域血包(flyer+2drone密集)
            { x: 4600, y: 336, type: 'smg' },
            { x: 4900, y: 496, type: 'health' },   // 第七区域血包(swooper+bomber+shooter+turret密集)
            { x: 5100, y: 346, type: 'shotgun' },
            { x: 5300, y: 496, type: 'molotov' },
            { x: 5550, y: 296, type: 'laser' },
            { x: 5800, y: 496, type: 'health' },
            { x: 5950, y: 416, type: 'rocket' },
        ],
        boss: {
            x: 6100, y: 496,
            name: '炎魔·最终形态',
            health: 1200,
            damage: 25,
            speed: 100,
            w: 60, h: 90,
            color: '#e74c3c',
            level: 3,
            score: 1500,
        },
        levelWidth: 6300,
    },
    // ---- 第四关：极寒冰原（极高难度）----
    {
        name: '第四关 · 极寒冰原',
        bgGradient: (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#0a192f');
            g.addColorStop(0.5, '#112240');
            g.addColorStop(1, '#1c2f5b');
            return g;
        },
        groundColor: '#1c2f5b',
        groundDetail: '#283e6b',
        platformColor: '#4b6e8e',
        platformDetail: '#5c7f9f',
        playerStart: { x: 100, y: 400 },
        cameraBounds: { minX: 0, maxX: 7700 },
        platforms: [
            // 第一段地面
            { x: 0, y: 500, w: 700, h: 100 },
            // 过渡平台（跨越断层1）
            { x: 850, y: 480, w: 90, h: 16 },
            { x: 1000, y: 460, w: 80, h: 16, moving: { ampX: 50, speedX: 1.0 } },
            { x: 1150, y: 490, w: 90, h: 16 },
            // 第二段地面
            { x: 1300, y: 500, w: 450, h: 100 },
            // 过渡平台（跨越断层2）
            { x: 1900, y: 460, w: 90, h: 16 },
            { x: 2050, y: 430, w: 110, h: 16, moving: { ampX: 80, speedX: 1.6 } },
            { x: 2250, y: 390, w: 100, h: 16, moving: { ampX: 70, speedX: 1.3 } },
            { x: 2450, y: 440, w: 90, h: 16, moving: { ampY: 55, speedY: 1.5 } },
            // 移动平台区
            { x: 2650, y: 380, w: 110, h: 16, moving: { ampX: 65, speedX: 1.2 } },
            { x: 2900, y: 430, w: 90, h: 16, moving: { ampY: 50, speedY: 1.4 } },
            { x: 3100, y: 370, w: 110, h: 16, moving: { ampX: 75, speedX: 1.1 } },
            { x: 3300, y: 410, w: 100, h: 16, moving: { ampX: 60, speedX: 1.0, ampY: 40, speedY: 1.2 } },
            // 后半段平台（从 3340 → 7400）
            { x: 3550, y: 450, w: 100, h: 16 },
            { x: 3850, y: 390, w: 110, h: 16, moving: { ampX: 65, speedX: 1.2 } },
            { x: 4150, y: 460, w: 100, h: 16 },
            { x: 4400, y: 400, w: 110, h: 16, moving: { ampY: 55, speedY: 1.5 } },
            { x: 4650, y: 440, w: 100, h: 16, moving: { ampX: 75, speedX: 1.3 } },
            { x: 4950, y: 380, w: 110, h: 16 },
            { x: 5250, y: 430, w: 100, h: 16, moving: { ampX: 65, speedX: 1.0, ampY: 40, speedY: 1.3 } },
            { x: 5550, y: 370, w: 110, h: 16, moving: { ampX: 60, speedX: 1.4 } },
            { x: 5850, y: 450, w: 100, h: 16 },
            { x: 6150, y: 390, w: 110, h: 16, moving: { ampY: 50, speedY: 1.6 } },
            { x: 6450, y: 440, w: 100, h: 16 },
            { x: 6750, y: 380, w: 110, h: 16, moving: { ampX: 70, speedX: 1.2 } },
            // Boss前落脚点
            { x: 7050, y: 460, w: 300, h: 100 },
        ],
        enemies: [
            // 第一段地面 (0-700)
            { x: 350, y: 496, type: 'walker', health: 55, speed: 100, score: 100, color: '#5c7f9f' },
            { x: 550, y: 496, type: 'runner', health: 45, speed: 180, score: 120, color: '#1c7ed6' },
            // 过渡区 (850-1300)
            { x: 1000, y: 456, type: 'jumper', health: 45, speed: 170, score: 110, color: '#8ecae6' },
            // 第二段地面 (1300-1750)
            { x: 1450, y: 496, type: 'walker', health: 60, speed: 105, score: 110, color: '#5c7f9f' },
            { x: 1600, y: 496, type: 'shooter', health: 55, speed: 72, canShoot: true, attackRate: 1.0, aggroRange: 500, score: 160, color: '#00bfff' },
            // 高速移动区 (1900-3340)
            { x: 2050, y: 426, type: 'flyer', health: 50, speed: 150, canShoot: true, attackRate: 1.1, aggroRange: 480, score: 150, color: '#00bcd4', baseY: 350 },
            { x: 2450, y: 436, type: 'drone', health: 35, speed: 185, canShoot: true, attackRate: 0.8, aggroRange: 450, score: 140, color: '#00ffff', baseY: 350 },
            { x: 2700, y: 496, type: 'kamikaze', health: 35, speed: 260, damage: 50, score: 180, color: '#ff6348', aggroRange: 420 },
            { x: 3000, y: 496, type: 'jumper', health: 50, speed: 160, score: 120, color: '#8ecae6' },
            { x: 3300, y: 406, type: 'shooter', health: 60, speed: 75, canShoot: true, attackRate: 0.9, aggroRange: 520, score: 170, color: '#00bfff' },
            // 后半段 (3550-7050)
            { x: 3700, y: 496, type: 'walker', health: 70, speed: 110, score: 120, color: '#5c7f9f' },
            { x: 3950, y: 496, type: 'missile', health: 70, speed: 65, canShoot: true, attackRate: 2.0, aggroRange: 550, score: 210, color: '#9b59b6', bulletSpeed: 250 },
            { x: 4250, y: 496, type: 'runner', health: 55, speed: 190, score: 130, color: '#1c7ed6' },
            { x: 4500, y: 496, type: 'jumper', health: 55, speed: 175, score: 130, color: '#8ecae6' },
            { x: 4700, y: 496, type: 'drone', health: 40, speed: 195, canShoot: true, attackRate: 0.7, aggroRange: 480, score: 160, color: '#00ffff', baseY: 350 },
            { x: 5100, y: 496, type: 'shooter', health: 65, speed: 78, canShoot: true, attackRate: 0.8, aggroRange: 530, score: 190, color: '#00bfff' },
            { x: 5300, y: 426, type: 'flyer', health: 60, speed: 160, canShoot: true, attackRate: 0.9, aggroRange: 520, score: 180, color: '#00bcd4', baseY: 320 },
            { x: 5650, y: 496, type: 'kamikaze', health: 40, speed: 275, damage: 55, score: 200, color: '#ff6348', aggroRange: 450 },
            { x: 5950, y: 496, type: 'walker', health: 75, speed: 100, score: 120, color: '#5c7f9f' },
            { x: 6200, y: 496, type: 'missile', health: 80, speed: 65, canShoot: true, attackRate: 1.7, aggroRange: 560, score: 230, color: '#9b59b6', bulletSpeed: 260 },
            { x: 6500, y: 496, type: 'runner', health: 60, speed: 195, score: 140, color: '#1c7ed6' },
            { x: 6800, y: 496, type: 'shooter', health: 70, speed: 80, canShoot: true, attackRate: 0.7, aggroRange: 550, score: 200, color: '#00bfff' },
            { x: 7150, y: 496, type: 'walker', health: 85, speed: 95, score: 130, color: '#5c7f9f' },
        ],
        weaponDrops: [
            { x: 300, y: 436, type: 'shotgun' },
            { x: 650, y: 496, type: 'molotov' },
            { x: 850, y: 476, type: 'rocket' },
            { x: 1150, y: 486, type: 'health' },
            { x: 1450, y: 436, type: 'smg' },
            { x: 1750, y: 496, type: 'laser' },
            { x: 2050, y: 426, type: 'health' },
            { x: 2450, y: 436, type: 'molotov' },
            { x: 2850, y: 426, type: 'shotgun' },
            { x: 3300, y: 406, type: 'rocket' },
            { x: 3700, y: 446, type: 'health' },
            { x: 4050, y: 386, type: 'smg' },
            { x: 4400, y: 396, type: 'laser' },
            { x: 4750, y: 496, type: 'health' },
            { x: 5100, y: 376, type: 'molotov' },
            { x: 5550, y: 366, type: 'shotgun' },
            { x: 5950, y: 446, type: 'health' },
            { x: 6250, y: 386, type: 'rocket' },
            { x: 6650, y: 436, type: 'smg' },
            { x: 7050, y: 456, type: 'health' },
        ],
        boss: {
            x: 7400, y: 496,
            name: '霜冻巨兽',
            health: 1600,
            damage: 30,
            speed: 110,
            w: 50, h: 80,
            color: '#00bfff',
            level: 4,
            score: 2000,
        },
        levelWidth: 7700,
    },
    // ---- 第五关：虚空幻境（地狱难度）----
    {
        name: '第五关 · 虚空幻境',
        bgGradient: (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#05000a');
            g.addColorStop(0.5, '#1a0033');
            g.addColorStop(1, '#330066');
            return g;
        },
        groundColor: '#000000', // 实际无连续地面，仅用于渲染
        groundDetail: '#0a0015',
        platformColor: '#4b0066',
        platformDetail: '#660099',
        playerStart: { x: 100, y: 400 },
        cameraBounds: { minX: 0, maxX: 9300 },
        platforms: [
            // 空中平台"孤岛"
            { x: 150, y: 380, w: 80, h: 16 },
            { x: 300, y: 340, w: 120, h: 16, moving: { ampX: 60, speedX: 1.5 } },
            { x: 800, y: 300, w: 130, h: 16, moving: { ampY: 60, speedY: 1.5 } },
            { x: 1300, y: 370, w: 110, h: 16, moving: { ampX: 80, speedX: 1.8, ampY: 50, speedY: 1.3 } },
            { x: 1600, y: 340, w: 80, h: 16, moving: { ampX: 45, speedX: 1.4 } },
            { x: 1800, y: 320, w: 140, h: 16, moving: { ampX: 100, speedX: 2.0 } },
            { x: 2150, y: 350, w: 80, h: 16, moving: { ampY: 45, speedY: 1.6 } },
            { x: 2400, y: 360, w: 110, h: 16, moving: { ampY: 80, speedY: 1.8 } },
            { x: 2750, y: 340, w: 80, h: 16, moving: { ampX: 55, speedX: 1.5 } },
            { x: 3000, y: 310, w: 150, h: 16, moving: { ampX: 120, speedX: 2.2, ampY: 70, speedY: 1.8 } },
            { x: 3400, y: 360, w: 80, h: 16, moving: { ampX: 55, speedX: 1.3 } },
            { x: 3600, y: 390, w: 80, h: 16 },
            { x: 3800, y: 400, w: 180, h: 16 },
            { x: 4200, y: 370, w: 80, h: 16, moving: { ampY: 50, speedY: 1.6 } },
            { x: 4400, y: 340, w: 80, h: 16, moving: { ampX: 50, speedX: 1.4 } },
            { x: 4600, y: 350, w: 200, h: 16, moving: { ampX: 140, speedX: 2.4 } },
            { x: 5100, y: 340, w: 80, h: 16, moving: { ampX: 60, speedX: 1.5 } },
            { x: 5350, y: 370, w: 70, h: 16 },
            { x: 5600, y: 300, w: 220, h: 16, moving: { ampY: 90, speedY: 2.0 } },
            { x: 6100, y: 350, w: 80, h: 16, moving: { ampY: 50, speedY: 1.5 } },
            { x: 6300, y: 380, w: 80, h: 16 },
            { x: 6550, y: 340, w: 80, h: 16, moving: { ampX: 50, speedX: 1.3 } },
            { x: 6800, y: 370, w: 240, h: 16, moving: { ampX: 160, speedX: 2.6, ampY: 100, speedY: 2.2 } },
            { x: 7300, y: 350, w: 80, h: 16, moving: { ampX: 60, speedX: 1.5 } },
            { x: 7550, y: 320, w: 80, h: 16 },
            { x: 7800, y: 360, w: 80, h: 16, moving: { ampY: 50, speedY: 1.4 } },
            { x: 8050, y: 340, w: 80, h: 16, moving: { ampX: 55, speedX: 1.4 } },
            { x: 8300, y: 380, w: 80, h: 16 },
            { x: 8550, y: 350, w: 80, h: 16, moving: { ampX: 50, speedX: 1.6 } },
            // Boss 战场地面
            { x: 8600, y: 500, w: 400, h: 100 },
        ],
        enemies: [
            // 起始区
            { x: 250, y: 336, type: 'flyer', health: 60, speed: 160, canShoot: true, attackRate: 1.2, aggroRange: 500, score: 170, color: '#bb44ff', baseY: 280 },
            // 前半段：导弹+自爆
            { x: 650, y: 296, type: 'missile', health: 50, speed: 150, canShoot: true, attackRate: 2.0, aggroRange: 550, score: 210, color: '#9b59b6', bulletSpeed: 300 },
            { x: 1200, y: 366, type: 'kamikaze', health: 35, speed: 260, damage: 48, score: 190, color: '#f39c12', aggroRange: 500 },
            { x: 1500, y: 336, type: 'drone', health: 35, speed: 190, canShoot: true, attackRate: 0.7, aggroRange: 460, score: 160, color: '#00ffff', baseY: 300 },
            { x: 1900, y: 316, type: 'missile', health: 55, speed: 155, canShoot: true, attackRate: 1.8, aggroRange: 560, score: 230, color: '#9b59b6', bulletSpeed: 310 },
            { x: 2250, y: 346, type: 'swooper', health: 55, speed: 170, aggroRange: 460, score: 200, color: '#ff4488', baseY: 220 },
            { x: 2750, y: 336, type: 'kamikaze', health: 40, speed: 270, damage: 52, score: 210, color: '#f39c12', aggroRange: 510 },
            { x: 3100, y: 306, type: 'bomber', health: 70, speed: 110, canShoot: true, attackRate: 1.4, aggroRange: 560, score: 230, color: '#ff8800', baseY: 260 },
            // 中段：炮塔+精英敌人
            { x: 3600, y: 386, type: 'turret', health: 85, speed: 0, canShoot: true, attackRate: 0.45, aggroRange: 600, score: 260, color: '#bb44ff' },
            { x: 4300, y: 336, type: 'flyer', health: 70, speed: 170, canShoot: true, attackRate: 1.0, aggroRange: 540, score: 200, color: '#bb44ff', baseY: 280 },
            { x: 4700, y: 346, type: 'missile', health: 70, speed: 160, canShoot: true, attackRate: 1.6, aggroRange: 580, score: 250, color: '#9b59b6', bulletSpeed: 330 },
            { x: 5200, y: 336, type: 'kamikaze', health: 45, speed: 280, damage: 55, score: 230, color: '#f39c12', aggroRange: 530 },
            { x: 5700, y: 296, type: 'drone', health: 40, speed: 200, canShoot: true, attackRate: 0.6, aggroRange: 480, score: 180, color: '#00ffff', baseY: 260 },
            // 后半段：密集精英
            { x: 6200, y: 376, type: 'shooter', health: 80, speed: 80, canShoot: true, attackRate: 0.6, aggroRange: 580, score: 260, color: '#ff6b6b' },
            { x: 6650, y: 336, type: 'swooper', health: 65, speed: 180, aggroRange: 500, score: 240, color: '#ff4488', baseY: 200 },
            { x: 6900, y: 366, type: 'missile', health: 80, speed: 165, canShoot: true, attackRate: 1.5, aggroRange: 600, score: 280, color: '#9b59b6', bulletSpeed: 350 },
            { x: 7400, y: 346, type: 'kamikaze', health: 50, speed: 290, damage: 58, score: 250, color: '#f39c12', aggroRange: 540 },
            { x: 7650, y: 316, type: 'drone', health: 45, speed: 210, canShoot: true, attackRate: 0.6, aggroRange: 500, score: 190, color: '#00ffff', baseY: 280 },
            { x: 7900, y: 356, type: 'flyer', health: 75, speed: 175, canShoot: true, attackRate: 0.9, aggroRange: 560, score: 220, color: '#bb44ff', baseY: 290 },
            { x: 8150, y: 336, type: 'missile', health: 85, speed: 170, canShoot: true, attackRate: 1.4, aggroRange: 620, score: 290, color: '#9b59b6', bulletSpeed: 360 },
            { x: 8450, y: 346, type: 'kamikaze', health: 55, speed: 300, damage: 60, score: 260, color: '#f39c12', aggroRange: 550 },
            { x: 8600, y: 346, type: 'swooper', health: 70, speed: 185, aggroRange: 520, score: 260, color: '#ff4488', baseY: 210 },
        ],
        weaponDrops: [
            // 起始
            { x: 150, y: 376, type: 'health' },
            { x: 400, y: 336, type: 'laser' },
            // 前半
            { x: 800, y: 296, type: 'rocket' },
            { x: 1300, y: 366, type: 'smg' },
            { x: 1600, y: 336, type: 'health' },
            { x: 1800, y: 316, type: 'molotov' },
            { x: 2150, y: 346, type: 'laser' },
            { x: 2400, y: 356, type: 'shotgun' },
            { x: 2750, y: 336, type: 'health' },
            // 中段
            { x: 3400, y: 356, type: 'rocket' },
            { x: 3600, y: 386, type: 'smg' },
            { x: 4200, y: 366, type: 'molotov' },
            { x: 4400, y: 336, type: 'health' },
            { x: 4600, y: 346, type: 'laser' },
            { x: 5100, y: 336, type: 'shotgun' },
            { x: 5350, y: 366, type: 'health' },
            // 后半
            { x: 6100, y: 346, type: 'rocket' },
            { x: 6300, y: 376, type: 'molotov' },
            { x: 6550, y: 336, type: 'smg' },
            { x: 6800, y: 366, type: 'health' },
            { x: 7300, y: 346, type: 'laser' },
            { x: 7550, y: 316, type: 'shotgun' },
            { x: 7800, y: 356, type: 'health' },
            { x: 8050, y: 336, type: 'rocket' },
            { x: 8550, y: 346, type: 'health' },
        ],
        boss: {
            x: 8800, y: 496,
            name: '虚空领主·终结者',
            health: 2500,
            damage: 40,
            speed: 120,
            w: 70, h: 100,
            color: '#ff00ff',
            level: 5,
            score: 3000,
        },
        levelWidth: 9000,
    },

    // ---- 第六关：终焉之境（终极关卡）----
    // 特点：混沌融合，全浮动平台，极速移动，终极考验
    {
        name: '第六关 · 终焉之境',
        bgGradient: (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#0a000a');
            g.addColorStop(0.3, '#1a0020');
            g.addColorStop(0.6, '#0a001a');
            g.addColorStop(1, '#000010');
            return g;
        },
        groundColor: '#0a0015',
        groundDetail: '#150020',
        platformColor: '#3a0050',
        platformDetail: '#500070',
        playerStart: { x: 100, y: 300 },
        cameraBounds: { minX: 0, maxX: 11000 },
        platforms: [
            // 起始平台
            { x: 50, y: 400, w: 120, h: 16 },
            // 第一区域：极速漂移区
            { x: 250, y: 350, w: 80, h: 16, moving: { ampX: 100, speedX: 2.5 } },
            { x: 450, y: 300, w: 90, h: 16, moving: { ampY: 80, speedY: 2.2 } },
            { x: 650, y: 380, w: 70, h: 16, moving: { ampX: 120, speedX: 2.8, ampY: 60, speedY: 2.0 } },
            { x: 900, y: 320, w: 100, h: 16, moving: { ampX: 80, speedX: 2.3 } },
            { x: 1150, y: 280, w: 80, h: 16, moving: { ampY: 90, speedY: 2.5 } },
            { x: 1400, y: 360, w: 90, h: 16, moving: { ampX: 110, speedX: 2.6, ampY: 70, speedY: 2.1 } },
            // 第二区域：螺旋升降区
            { x: 1650, y: 400, w: 80, h: 16, moving: { ampX: 70, speedX: 2.0 } },
            { x: 1850, y: 340, w: 90, h: 16, moving: { ampY: 100, speedY: 2.8 } },
            { x: 2050, y: 280, w: 80, h: 16, moving: { ampX: 90, speedX: 2.4 } },
            { x: 2250, y: 350, w: 100, h: 16, moving: { ampY: 80, speedY: 2.3 } },
            { x: 2450, y: 420, w: 80, h: 16, moving: { ampX: 100, speedX: 2.7 } },
            { x: 2650, y: 360, w: 90, h: 16, moving: { ampY: 90, speedY: 2.6 } },
            { x: 2850, y: 300, w: 80, h: 16, moving: { ampX: 80, speedX: 2.2, ampY: 70, speedY: 2.4 } },
            // 第三区域：混沌矩阵区
            { x: 3100, y: 380, w: 70, h: 16, moving: { ampX: 130, speedX: 3.0 } },
            { x: 3300, y: 320, w: 80, h: 16, moving: { ampY: 110, speedY: 3.0 } },
            { x: 3500, y: 260, w: 90, h: 16, moving: { ampX: 100, speedX: 2.8, ampY: 80, speedY: 2.5 } },
            { x: 3750, y: 400, w: 70, h: 16, moving: { ampX: 90, speedX: 2.5 } },
            { x: 3950, y: 340, w: 80, h: 16, moving: { ampY: 100, speedY: 2.9 } },
            { x: 4150, y: 280, w: 90, h: 16, moving: { ampX: 120, speedX: 3.2 } },
            { x: 4350, y: 360, w: 80, h: 16, moving: { ampX: 80, speedX: 2.4, ampY: 90, speedY: 2.7 } },
            // 第四区域：深渊跳跃区
            { x: 4600, y: 400, w: 100, h: 16 },
            { x: 4800, y: 350, w: 80, h: 16, moving: { ampX: 150, speedX: 3.5 } },
            { x: 5050, y: 300, w: 90, h: 16, moving: { ampY: 120, speedY: 3.2 } },
            { x: 5300, y: 380, w: 70, h: 16, moving: { ampX: 100, speedX: 2.8, ampY: 80, speedY: 2.6 } },
            { x: 5550, y: 320, w: 80, h: 16, moving: { ampX: 130, speedX: 3.0 } },
            { x: 5800, y: 260, w: 90, h: 16, moving: { ampY: 100, speedY: 3.0 } },
            { x: 6050, y: 400, w: 100, h: 16 },
            // 第五区域：终焉走廊
            { x: 6300, y: 350, w: 80, h: 16, moving: { ampX: 140, speedX: 3.2 } },
            { x: 6550, y: 300, w: 90, h: 16, moving: { ampY: 110, speedY: 3.1 } },
            { x: 6800, y: 380, w: 70, h: 16, moving: { ampX: 110, speedX: 2.9, ampY: 90, speedY: 2.8 } },
            { x: 7050, y: 320, w: 80, h: 16, moving: { ampX: 120, speedX: 3.3 } },
            { x: 7300, y: 260, w: 90, h: 16, moving: { ampY: 130, speedY: 3.4 } },
            { x: 7550, y: 400, w: 100, h: 16 },
            // Boss前缓冲区
            { x: 7800, y: 350, w: 120, h: 16 },
            { x: 8000, y: 400, w: 200, h: 16 },
            // Boss 战场地面
            { x: 7900, y: 500, w: 500, h: 100 },
        ],
        enemies: [
            // 第一区域 (0-1650)
            { x: 300, y: 346, type: 'missile', health: 80, speed: 180, canShoot: true, attackRate: 1.5, aggroRange: 600, score: 300, color: '#ff00ff', bulletSpeed: 380 },
            { x: 500, y: 296, type: 'kamikaze', health: 55, speed: 320, damage: 65, score: 280, color: '#ff3300', aggroRange: 550 },
            { x: 750, y: 376, type: 'drone', health: 50, speed: 220, canShoot: true, attackRate: 0.5, aggroRange: 500, score: 250, color: '#00ffff', baseY: 300 },
            { x: 1000, y: 316, type: 'swooper', health: 75, speed: 200, aggroRange: 550, score: 300, color: '#ff4488', baseY: 200 },
            { x: 1250, y: 276, type: 'bomber', health: 90, speed: 130, canShoot: true, attackRate: 1.2, aggroRange: 600, score: 320, color: '#ff8800', baseY: 200 },
            { x: 1500, y: 356, type: 'missile', health: 85, speed: 190, canShoot: true, attackRate: 1.4, aggroRange: 620, score: 310, color: '#ff00ff', bulletSpeed: 400 },
            // 第二区域 (1650-3100)
            { x: 1750, y: 396, type: 'kamikaze', health: 60, speed: 330, damage: 68, score: 290, color: '#ff3300', aggroRange: 560 },
            { x: 1950, y: 336, type: 'turret', health: 100, speed: 0, canShoot: true, attackRate: 0.35, aggroRange: 650, score: 350, color: '#ff00ff' },
            { x: 2150, y: 276, type: 'flyer', health: 85, speed: 190, canShoot: true, attackRate: 0.8, aggroRange: 580, score: 280, color: '#bb44ff', baseY: 250 },
            { x: 2350, y: 346, type: 'drone', health: 55, speed: 230, canShoot: true, attackRate: 0.4, aggroRange: 520, score: 260, color: '#00ffff', baseY: 280 },
            { x: 2550, y: 416, type: 'swooper', health: 80, speed: 210, aggroRange: 570, score: 310, color: '#ff4488', baseY: 200 },
            { x: 2750, y: 356, type: 'missile', health: 90, speed: 200, canShoot: true, attackRate: 1.3, aggroRange: 630, score: 320, color: '#ff00ff', bulletSpeed: 420 },
            { x: 2950, y: 296, type: 'bomber', health: 95, speed: 140, canShoot: true, attackRate: 1.1, aggroRange: 620, score: 340, color: '#ff8800', baseY: 220 },
            // 第三区域 (3100-4600)
            { x: 3200, y: 376, type: 'kamikaze', health: 65, speed: 340, damage: 70, score: 300, color: '#ff3300', aggroRange: 580 },
            { x: 3400, y: 316, type: 'turret', health: 110, speed: 0, canShoot: true, attackRate: 0.3, aggroRange: 680, score: 370, color: '#ff00ff' },
            { x: 3600, y: 256, type: 'drone', health: 60, speed: 240, canShoot: true, attackRate: 0.4, aggroRange: 540, score: 270, color: '#00ffff', baseY: 260 },
            { x: 3850, y: 396, type: 'swooper', health: 85, speed: 220, aggroRange: 590, score: 320, color: '#ff4488', baseY: 190 },
            { x: 4050, y: 336, type: 'missile', health: 95, speed: 210, canShoot: true, attackRate: 1.2, aggroRange: 650, score: 330, color: '#ff00ff', bulletSpeed: 440 },
            { x: 4250, y: 276, type: 'flyer', health: 90, speed: 200, canShoot: true, attackRate: 0.7, aggroRange: 600, score: 300, color: '#bb44ff', baseY: 240 },
            { x: 4450, y: 356, type: 'bomber', health: 100, speed: 150, canShoot: true, attackRate: 1.0, aggroRange: 640, score: 350, color: '#ff8800', baseY: 210 },
            // 第四区域 (4600-6300)
            { x: 4700, y: 396, type: 'kamikaze', health: 70, speed: 350, damage: 72, score: 310, color: '#ff3300', aggroRange: 600 },
            { x: 4900, y: 346, type: 'turret', health: 120, speed: 0, canShoot: true, attackRate: 0.28, aggroRange: 700, score: 390, color: '#ff00ff' },
            { x: 5150, y: 296, type: 'drone', health: 65, speed: 250, canShoot: true, attackRate: 0.35, aggroRange: 560, score: 280, color: '#00ffff', baseY: 250 },
            { x: 5400, y: 376, type: 'swooper', health: 90, speed: 230, aggroRange: 610, score: 330, color: '#ff4488', baseY: 180 },
            { x: 5650, y: 316, type: 'missile', health: 100, speed: 220, canShoot: true, attackRate: 1.1, aggroRange: 670, score: 340, color: '#ff00ff', bulletSpeed: 460 },
            { x: 5900, y: 256, type: 'flyer', health: 95, speed: 210, canShoot: true, attackRate: 0.6, aggroRange: 620, score: 310, color: '#bb44ff', baseY: 230 },
            { x: 6150, y: 396, type: 'bomber', health: 105, speed: 160, canShoot: true, attackRate: 0.9, aggroRange: 660, score: 360, color: '#ff8800', baseY: 200 },
            // 第五区域 (6300-8000)
            { x: 6400, y: 346, type: 'kamikaze', health: 75, speed: 360, damage: 75, score: 320, color: '#ff3300', aggroRange: 620 },
            { x: 6650, y: 296, type: 'turret', health: 130, speed: 0, canShoot: true, attackRate: 0.25, aggroRange: 720, score: 410, color: '#ff00ff' },
            { x: 6900, y: 376, type: 'drone', health: 70, speed: 260, canShoot: true, attackRate: 0.3, aggroRange: 580, score: 290, color: '#00ffff', baseY: 240 },
            { x: 7150, y: 316, type: 'swooper', health: 95, speed: 240, aggroRange: 630, score: 340, color: '#ff4488', baseY: 170 },
            { x: 7400, y: 256, type: 'missile', health: 105, speed: 230, canShoot: true, attackRate: 1.0, aggroRange: 690, score: 350, color: '#ff00ff', bulletSpeed: 480 },
            { x: 7650, y: 396, type: 'flyer', health: 100, speed: 220, canShoot: true, attackRate: 0.5, aggroRange: 640, score: 320, color: '#bb44ff', baseY: 220 },
        ],
        weaponDrops: [
            // 第一区域
            { x: 250, y: 346, type: 'rocket' },
            { x: 500, y: 296, type: 'health' },
            { x: 750, y: 376, type: 'laser' },
            { x: 1000, y: 316, type: 'health' },
            { x: 1250, y: 276, type: 'smg' },
            { x: 1500, y: 356, type: 'health' },
            // 第二区域
            { x: 1750, y: 396, type: 'rocket' },
            { x: 1950, y: 336, type: 'health' },
            { x: 2150, y: 276, type: 'laser' },
            { x: 2350, y: 346, type: 'molotov' },
            { x: 2550, y: 416, type: 'health' },
            { x: 2750, y: 356, type: 'shotgun' },
            { x: 2950, y: 296, type: 'health' },
            // 第三区域
            { x: 3200, y: 376, type: 'rocket' },
            { x: 3400, y: 316, type: 'health' },
            { x: 3600, y: 256, type: 'laser' },
            { x: 3850, y: 396, type: 'molotov' },
            { x: 4050, y: 336, type: 'health' },
            { x: 4250, y: 276, type: 'smg' },
            { x: 4450, y: 356, type: 'health' },
            // 第四区域
            { x: 4700, y: 396, type: 'rocket' },
            { x: 4900, y: 346, type: 'health' },
            { x: 5150, y: 296, type: 'laser' },
            { x: 5400, y: 376, type: 'molotov' },
            { x: 5650, y: 316, type: 'health' },
            { x: 5900, y: 256, type: 'shotgun' },
            { x: 6150, y: 396, type: 'health' },
            // 第五区域
            { x: 6400, y: 346, type: 'rocket' },
            { x: 6650, y: 296, type: 'health' },
            { x: 6900, y: 376, type: 'laser' },
            { x: 7150, y: 316, type: 'molotov' },
            { x: 7400, y: 256, type: 'health' },
            { x: 7650, y: 396, type: 'smg' },
            // Boss前
            { x: 7800, y: 346, type: 'health' },
            { x: 7900, y: 396, type: 'rocket' },
        ],
        boss: {
            x: 8100, y: 496,
            name: '混沌之源·创世者',
            health: 4000,
            damage: 50,
            speed: 140,
            w: 80, h: 110,
            color: '#ff00aa',
            level: 6,
            score: 5000,
        },
        levelWidth: 8500,
    },

];
