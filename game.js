// ==================== 涓绘父鎴忛€昏緫 ====================
const Game = (() => {
    let state = 'menu'; // menu, playing, paused, dead, levelComplete, victory
    let player = null;
    let enemies = [];
    let boss = null;
    let drops = [];
    let currentLevel = 0;
    let levelData = null;
    let gameTime = 0;
    let healthBonus = 0;
    let animFrame = null;
    let lastTime = 0;
    let frameDt = 1 / 60;
    let canvas, ctx;
    let bossSpawned = false;
    let bossWarningTimer = 0;
    let bossAnnounceTimer = 0;
    let initialized = false;
    let pendingTransitionTimeout = null;
    let transitionToken = 0;
    let ui = null;
    let menus = null;
    let bootScreenDismissed = false;

    const $ = id => document.getElementById(id);

    function ensureUIRefs() {
        if (ui) return ui;

        menus = Array.from(document.querySelectorAll('.menu'));
        const weaponSlots = Array.from(document.querySelectorAll('.weapon-slot')).map(slot => ({
            root: slot,
            name: slot.querySelector('.slot-name'),
            ammo: slot.querySelector('.slot-ammo'),
        }));

        ui = {
            hud: $('hud'),
            bootScreen: $('boot-screen'),
            healthBarFill: $('health-bar-fill'),
            healthText: $('health-text'),
            scoreDisplay: $('score-display'),
            currentWeaponLevel: $('current-weapon-level'),
            upgradeHint: $('upgrade-hint'),
            upgradeCost: $('upgrade-cost'),
            bossHealthContainer: $('boss-health-container'),
            bossName: $('boss-name'),
            bossHealthBarFill: $('boss-health-bar-fill'),
            pickupHint: $('pickup-hint'),
            grenadeCount: $('grenade-count'),
            molotovCount: $('molotov-count'),
            thrownGrenade: $('thrown-grenade'),
            thrownMolotov: $('thrown-molotov'),
            stagnationWarning: $('stagnation-warning'),
            levelName: $('level-name'),
            levelCompleteTitle: $('level-complete-title'),
            levelCompleteInfo: $('level-complete-info'),
            nextLevelBtn: $('next-level-btn'),
            victoryInfo: $('victory-info'),
            deathInfo: $('death-info'),
            weaponSlots,
        };

        return ui;
    }

    function initializeSystems() {
        if (initialized) return;

        canvas = $('gameCanvas');
        ctx = canvas.getContext('2d');
        Renderer.init(canvas);
        Input.init(canvas);
        ensureUIRefs();
        initialized = true;
    }

    function doDismissBoot() {
        if (bootScreenDismissed || !ui.bootScreen) return;
        bootScreenDismissed = true;
        ui.bootScreen.classList.add('is-fading');
        setTimeout(() => {
            if (ui.bootScreen) {
                ui.bootScreen.classList.add('hidden');
                ui.bootScreen.classList.remove('is-fading');
            }
        }, 700);
    }

    function dismissBootScreen() {
        ensureUIRefs();
        doDismissBoot();
        showMenu('start-menu');
    }

    function bootStart() {
        ensureUIRefs();
        doDismissBoot();
        showMenu('start-menu');
    }

    function bindBootScreen() {
        ensureUIRefs();
        if (!ui.bootScreen) return;

        window.addEventListener('keydown', () => {
            bootStart();
        }, { once: true });
    }

    function clearPendingTransition() {
        transitionToken++;
        if (pendingTransitionTimeout) {
            clearTimeout(pendingTransitionTimeout);
            pendingTransitionTimeout = null;
        }
    }

    function schedulePostBossTransition() {
        clearPendingTransition();
        const token = transitionToken;

        pendingTransitionTimeout = setTimeout(() => {
            pendingTransitionTimeout = null;
            if (transitionToken !== token || state !== 'playing' || !player) return;

            if (currentLevel < Levels.length - 1) {
                showLevelComplete();
            } else {
                showVictory();
            }
        }, 2500);
    }

    function bulletHitsRect(bullet, rect) {
        return bullet.x > rect.x && bullet.x < rect.x + rect.w && bullet.y > rect.y && bullet.y < rect.y + rect.h;
    }

    function handleEnemyBulletHitsPlayer(bullets, playerRect) {
        for (const bullet of bullets) {
            if (bulletHitsRect(bullet, playerRect)) {
                if (player.shieldActive) {
                    bullet.life = 0;
                    Particles.spawn(bullet.x, bullet.y, 5, '#00d2ff', 60, 0.25);
                    continue;
                }
                player.takeDamage(bullet.damage);
                bullet.life = 0;
                Renderer.shake(4, 0.1);
            }
        }
    }

    function showMenu(id) {
        const menuList = menus || document.querySelectorAll('.menu');
        menuList.forEach(menu => menu.classList.add('hidden'));
        if (id) $(id).classList.remove('hidden');
    }

    function hideAllMenus() {
        const menuList = menus || document.querySelectorAll('.menu');
        menuList.forEach(menu => menu.classList.add('hidden'));
    }

    function showLevelSelect() {
        showMenu('level-select-menu');
        initLevelCards();
    }

    function hideLevelSelect() {
        showMenu('start-menu');
    }

    function initLevelCards() {
        const grid = $('level-grid');
        if (!grid) return;
        
        // 清空现有内容
        grid.innerHTML = '';
        
        // 关卡描述
        const levelDescs = [
            { desc: '入门级关卡，地面连续，敌人较少，适合新手熟悉操作。', boss: '钢铁守卫' },
            { desc: '中等难度，地面有断层，需要跳跃技巧，敌人更多。', boss: '暗影之王' },
            { desc: '高难度关卡，地形复杂，多层平台，需要二段跳技巧。', boss: '炎魔·最终形态' },
            { desc: '极高难度，极寒冰原，高速移动平台，考验反应力。', boss: '霜冻巨兽' },
            { desc: '地狱难度，虚空幻境，全浮动平台，极速移动。', boss: '虚空领主·终结者' },
            { desc: '终极关卡，混沌融合，全浮动平台，终极考验。', boss: '混沌之源·创世者' },
        ];
        
        // 生成关卡卡片
        Levels.forEach((level, index) => {
            const card = document.createElement('div');
            card.className = 'level-card';
            card.setAttribute('data-level', index);
            card.onclick = () => Game.selectLevel(index);
            
            const desc = levelDescs[index] || { desc: '未知关卡', boss: '未知Boss' };
            
            card.innerHTML = `
                <div class="level-card__number">${index + 1}</div>
                <span class="level-card__name">${level.name}</span>
                <span class="level-card__desc">${desc.desc}</span>
                <div class="level-card__boss">
                    <span class="level-card__boss-icon"></span>
                    Boss: ${desc.boss}
                </div>
            `;
            
            grid.appendChild(card);
        });
    }

    function selectLevel(index) {
        Audio.init();
        initializeSystems();

        healthBonus = 0;
        loadLevel(index);
        state = 'playing';
        hideAllMenus();
        ui.hud.classList.remove('hidden');

        lastTime = performance.now();
        gameTime = 0;
        if (animFrame) cancelAnimationFrame(animFrame);
        animFrame = requestAnimationFrame(gameLoop);
    }

    function updateHUD() {
        if (!player) return;
        ensureUIRefs();

        const hpPct = (player.health / player.maxHealth) * 100;
        ui.healthBarFill.style.width = hpPct + '%';
        ui.healthText.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;

        if (hpPct < 25) {
            ui.healthBarFill.style.background = 'linear-gradient(90deg, #c0392b, #e74c3c)';
        } else if (hpPct < 50) {
            ui.healthBarFill.style.background = 'linear-gradient(90deg, #e67e22, #f39c12)';
        } else {
            ui.healthBarFill.style.background = 'linear-gradient(90deg, #e74c3c, #ff6b6b)';
        }

        ui.scoreDisplay.textContent = `分数: ${player.score}`;

        const slotWeaponNames = ['手枪', '霰弹枪', '冲锋枪', '激光枪', '火箭筒'];
        for (let i = 0; i < 5; i++) {
            const slot = ui.weaponSlots[i];
            if (!slot) continue;

            const weapon = player.weapons[i];
            slot.root.classList.toggle('active', i === player.currentWeapon);
            if (weapon) {
                slot.name.textContent = weapon.name;
                slot.ammo.textContent = weapon.infinite ? '∞' : weapon.ammo;
            } else {
                slot.name.textContent = slotWeaponNames[i] || '—';
                slot.ammo.textContent = '';
            }
        }

        if (player.weapon) {
            ui.currentWeaponLevel.textContent = `Lv.${player.weapon.level}`;
            if (player.weapon.level < player.weapon.maxLevel) {
                ui.upgradeHint.classList.remove('hidden');
                ui.upgradeCost.textContent = player.weapon.getUpgradeCost();
            } else {
                ui.upgradeHint.classList.add('hidden');
            }
        } else {
            ui.currentWeaponLevel.textContent = 'Lv.1';
            ui.upgradeHint.classList.add('hidden');
        }

        if (boss && !boss.dead) {
            ui.bossHealthContainer.classList.remove('hidden');
            ui.bossName.textContent = boss.name;
            const bossPct = (boss.health / boss.maxHealth) * 100;
            ui.bossHealthBarFill.style.width = bossPct + '%';
        } else {
            ui.bossHealthContainer.classList.add('hidden');
        }

        let nearDrop = false;
        let pickupHintText = '按 E 拾取';
        for (const drop of drops) {
            if (Utils.dist(player.x, player.y, drop.x, drop.y) < 65) {
                nearDrop = true;
                if (drop.type === 'health') {
                    pickupHintText = '按 E 拾取血包';
                } else if (drop.type === 'grenade') {
                    pickupHintText = '按 E 拾取手雷';
                } else if (drop.type === 'molotov') {
                    pickupHintText = '按 E 拾取燃烧瓶';
                } else if (drop.type === 'shield') {
                    pickupHintText = '按 E 拾取护盾 (Shift释放)';
                } else {
                    const slotIndex = player.weaponSlotMap[drop.type];
                    const existingWeapon = player.weapons.find(weapon => weapon && weapon.type === drop.type);
                    if (existingWeapon) {
                        pickupHintText = `按 E 补充 ${WeaponData[drop.type].name} 弹药`;
                    } else if (slotIndex !== undefined) {
                        pickupHintText = `按 E 拾取 ${WeaponData[drop.type].name} → 槽位${slotIndex + 1}`;
                    } else {
                        pickupHintText = `按 E 拾取 ${WeaponData[drop.type].name}`;
                    }
                }
                break;
            }
        }

        ui.pickupHint.textContent = pickupHintText;
        ui.pickupHint.classList.toggle('hidden', !nearDrop);
        ui.grenadeCount.textContent = `x${player.grenadeCount}`;
        ui.molotovCount.textContent = `x${player.molotovCount}`;
        ui.thrownGrenade.classList.toggle('active', player.selectedThrown === 'grenade' && player.grenadeCount > 0);
        ui.thrownMolotov.classList.toggle('active', player.selectedThrown === 'molotov' && player.molotovCount > 0);
        ui.stagnationWarning.classList.toggle('hidden', player.stagnationTimer <= 1.5);
    }

    function loadLevel(index) {
        clearPendingTransition();
        ensureUIRefs();

        currentLevel = index;
        levelData = Levels[index];

        player = new Player(levelData.playerStart.x, levelData.playerStart.y);
        if (healthBonus > 0) player.increaseMaxHealth(healthBonus);
        enemies = levelData.enemies.map(enemy => new Enemy(enemy.x, enemy.y, { ...enemy }));
        boss = null;
        bossSpawned = false;
        bossWarningTimer = 0;
        bossAnnounceTimer = 0;
        drops = levelData.weaponDrops.map(drop => new WeaponDrop(drop.x, drop.y, drop.type));

        Particles.clear();
        Renderer.generateBackground(levelData);
        Audio.startAmbient(index);

        if (index === 0) {
            Audio.playBgm('bgm_level1');
        } else if (index === 1) {
            Audio.playBgm('bgm_level2');
        } else if (index === 2) {
            Audio.playBgm('bgm_level3');
        } else if (index === 3) {
            Audio.playBgm('bgm_level4');
        } else if (index === 4) {
            Audio.playBgm('bgm_level5');
        } else if (index === 5) {
            Audio.playBgm('bgm_level5'); // 第6关复用第5关BGM
        } else {
            Audio.stopBgm();
        }

        ui.levelName.textContent = levelData.name;
        ui.bossHealthContainer.classList.add('hidden');

        Utils.camera.x = 0;
        Utils.camera.y = 0;
    }

    function gameLoop(timestamp) {
        animFrame = requestAnimationFrame(gameLoop);

        const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;
        frameDt = dt;
        gameTime += dt;

        if (state === 'playing') {
            update(dt);
        }

        render();
        Input.endFrame();
    }

    function update(dt) {
        // 鏇存柊杈撳叆绯荤粺锛堟寜閿寜浣忔椂闂达級
        Input.update(dt);

        // 绉诲姩骞冲彴鏇存柊
        for (const p of levelData.platforms) {
            if (p.moving) {
                if (p._startX === undefined) {
                    p._startX = p.x;
                    p._startY = p.y;
                    p._phase = Math.random() * Math.PI * 2;
                }
                const prevX = p.x, prevY = p.y;
                if (p.moving.ampX && p.moving.speedX) {
                    p.x = p._startX + Math.sin(gameTime * p.moving.speedX + p._phase) * p.moving.ampX;
                }
                if (p.moving.ampY && p.moving.speedY) {
                    p.y = p._startY + Math.sin(gameTime * p.moving.speedY + p._phase + 0.5) * p.moving.ampY;
                }
                p._dx = p.x - prevX;
                p._dy = p.y - prevY;
            } else {
                p._dx = 0;
                p._dy = 0;
            }
        }

        // 鐜╁
        player.update(dt, levelData.platforms);

        // 浣庤閲忓績璺?+ 鍋滄粸璀﹀憡闊虫晥
        Audio.updateLowHealth(dt, player.health / player.maxHealth);
        Audio.updateWarning(dt, player.stagnationTimer);

        // 鐩告満
        const targetX = player.x - Renderer.width() * 0.35;
        Utils.camera.x = Utils.lerp(Utils.camera.x, targetX, 0.08);
        Utils.camera.x = Utils.clamp(Utils.camera.x, levelData.cameraBounds.minX, levelData.cameraBounds.maxX);
        const targetY = player.y - Renderer.height() * 0.55;
        Utils.camera.y = Utils.lerp(Utils.camera.y, Utils.clamp(targetY, -200, 200), 0.06);

        // 鏁屼汉
        for (let i = enemies.length - 1; i >= 0; i--) {
            const alive = enemies[i].update(dt, levelData.platforms, player.x, player.y);
            if (!alive) {
                if (enemies[i].type === 'kamikaze' && !enemies[i].exploded) {
                    enemies[i].exploded = true;
                    Particles.spawnExplosion(enemies[i].x, enemies[i].y - enemies[i].h / 2);
                    Audio.play('explode');
                    if (!player.dead) {
                        const dist = Utils.dist(enemies[i].x, enemies[i].y, player.x, player.y);
                        if (dist < 120) {
                            const dmg = dist < 60 ? enemies[i].damage : enemies[i].damage * 0.6;
                            player.takeDamage(dmg);
                        }
                    }
                } else {
                    Particles.spawn(
                        enemies[i].x, enemies[i].y - enemies[i].h / 2,
                        6, enemies[i].color, 120, 0.4, 3
                    );
                }
                player.addScore(enemies[i].score);
                if (Math.random() < 0.30) {
                    const types = Object.keys(WeaponData).filter(t => !['pistol', 'grenade', 'molotov', 'health'].includes(t));
                    drops.push(new WeaponDrop(
                        enemies[i].x, enemies[i].y - 20,
                        types[Utils.randInt(0, types.length - 1)]
                    ));
                }
                if (Math.random() < 0.15) {
                    const thrownType = Math.random() < 0.5 ? 'grenade' : 'molotov';
                    drops.push(new WeaponDrop(enemies[i].x, enemies[i].y - 20, thrownType));
                }
                if (Math.random() < 0.15) {
                    drops.push(new WeaponDrop(enemies[i].x, enemies[i].y - 20, 'health'));
                }
                if (currentLevel >= 3 && Math.random() < 0.12) {
                    drops.push(new WeaponDrop(enemies[i].x, enemies[i].y - 20, 'shield'));
                }
                enemies.splice(i, 1);
            }
        }

        for (const t of player.thrown) {
            if (t.type === 'grenade' && t.exploded && !t.dead) {
                for (const e of enemies) {
                    if (e.dead) continue;
                    const dist = Utils.dist(t.x, t.y, e.x, e.y - e.h / 2);
                    if (dist < t.radius) {
                        const dmg = t.damage * (dist < t.radius * 0.5 ? 1 : 0.6);
                        e.takeDamage(dmg);
                        Particles.spawnDamageNum(e.x, e.y - e.h / 2, dmg);
                    }
                }
                if (boss && !boss.dead) {
                    const dist = Utils.dist(t.x, t.y, boss.x, boss.y - boss.h / 2);
                    if (dist < t.radius) {
                        boss.takeDamage(t.damage * (dist < t.radius * 0.5 ? 1 : 0.6));
                    }
                }
                t.dead = true;
            }
            if (t.type === 'molotov' && t.exploded && !t.dead) {
                for (const e of enemies) {
                    if (e.dead) continue;
                    const dist = Utils.dist(t.x, t.y, e.x, e.y - e.h / 2);
                    if (dist < t.radius) {
                        e.takeDamage(18 * dt);
                    }
                }
                if (boss && !boss.dead) {
                    const dist = Utils.dist(t.x, t.y, boss.x, boss.y - boss.h / 2);
                    if (dist < t.radius) {
                        boss.takeDamage(12 * dt);
                    }
                }
                if (!player.dead) {
                    const dist = Utils.dist(t.x, t.y, player.x, player.y - 25);
                    if (dist < t.radius * 0.7) {
                        if (!player.shieldActive) {
                            player.health -= 10 * dt;
                            if (Math.random() < 0.1) Particles.spawn(player.x, player.y - 25, 1, '#ff6600', 30, 0.3);
                            if (player.health <= 0) {
                                player.health = 0;
                                player.dead = true;
                                Audio.play('death');
                                Audio.playMp3('deathVoice');
                            }
                        }
                    }
                }
            }
        }

        // Boss 鐢熸垚閫昏緫锛氬綋鎵€鏈夊皬鎬娑堢伃鍚庯紝鏄剧ず璀﹀憡骞剁敓鎴?Boss
        if (!bossSpawned && enemies.length === 0 && !player.dead) {
            bossWarningTimer += dt;

            // 璀﹀憡闃舵锛?绉掞級
            if (bossWarningTimer > 0 && bossWarningTimer < 2) {
                // 灞忓箷闂儊璀﹀憡鏁堟灉
                if (Math.sin(bossWarningTimer * 10) > 0) {
                    Renderer.shake(3, 0.05);
                }
            }

            // 鐢熸垚 Boss
            if (bossWarningTimer >= 2) {
                boss = new Boss(levelData.boss.x, levelData.boss.y, { ...levelData.boss });
                bossSpawned = true;
                bossAnnounceTimer = 3; // 鏄剧ず3绉払oss鍑虹幇鎻愮ず
                Audio.play('boss');
                Particles.spawnExplosion(levelData.boss.x, levelData.boss.y - 40);
                Renderer.shake(8, 0.3);
            }
        }

        // Boss
        if (boss) {
            const bossAlive = boss.update(dt, levelData.platforms, player.x, player.y);
            if (!bossAlive && boss.dead) {
                boss = null;
                player.addScore(levelData.boss.score);
                Audio.play('levelup');
                if (currentLevel === 0) {
                    Audio.stopBgm();
                    Audio.setMasterGainBoost(3);
                    Audio.playMp3WithCallback('bossExplode', 1, function() {
                        Audio.restoreMasterGain();
                        schedulePostBossTransition();
                    });
                } else if (currentLevel === 1) {
                    Audio.stopBgm();
                    Audio.setMasterGainBoost(3);
                    Audio.playMp3WithCallback('bossLaugh', 1, function() {
                        Audio.restoreMasterGain();
                        schedulePostBossTransition();
                    });
                } else if (currentLevel === 2) {
                    Audio.stopBgm();
                    Audio.setMasterGainBoost(3);
                    Audio.playMp3WithCallback('bossLuck', 1, function() {
                        Audio.restoreMasterGain();
                        schedulePostBossTransition();
                    });
                } else if (currentLevel === 3) {
                    Audio.stopBgm();
                    Audio.setMasterGainBoost(3);
                    Audio.playMp3WithCallback('bossRespect', 1, function() {
                        Audio.restoreMasterGain();
                        schedulePostBossTransition();
                    });
                } else if (currentLevel === 4) {
                    Audio.stopBgm();
                    Audio.setMasterGainBoost(3);
                    Audio.playMp3WithCallback('bossBad', 1, function() {
                        Audio.restoreMasterGain();
                        schedulePostBossTransition();
                    });
                } else if (currentLevel === 5) {
                    Audio.stopBgm();
                    Audio.setMasterGainBoost(3);
                    Audio.playMp3WithCallback('bossSurrender', 1, function() {
                        Audio.restoreMasterGain();
                        schedulePostBossTransition();
                    });
                } else if (currentLevel === 6) {
                    Audio.stopBgm();
                    Audio.setMasterGainBoost(3);
                    Audio.playMp3WithCallback('bossSurrender', 1, function() {
                        Audio.restoreMasterGain();
                        schedulePostBossTransition();
                    });
                } else {
                    schedulePostBossTransition();
                }
            }
        }

        // 姝﹀櫒鎺夎惤鏇存柊
        for (let i = drops.length - 1; i >= 0; i--) {
            drops[i].update(dt);
            if (drops[i].dead) drops.splice(i, 1);
        }

        // 鎷惧彇
        if (Input.wasPressed('KeyE')) {
            player.tryPickup(drops);
        }

        // 鍗囩骇
        if (Input.wasPressed('KeyR')) {
            if (player.upgradeWeapon()) {
                Particles.spawn(player.x, player.y - 30, 15, '#f1c40f', 200, 0.6);
            }
        }

        // 纰版挒妫€娴? 鐜╁瀛愬脊 vs 鏁屼汉/Boss
        for (let i = player.bullets.length - 1; i >= 0; i--) {
            const b = player.bullets[i];
            let hit = false;

            // vs 鏁屼汉
            for (const e of enemies) {
                if (e.dead) continue;
                const er = e.getRect();
                if (b.x > er.x && b.x < er.x + er.w && b.y > er.y && b.y < er.y + er.h) {
                    e.takeDamage(b.damage);
                    Particles.spawnHitImpact(b.x, b.y);
                    Particles.spawnDamageNum(b.x, b.y - er.h / 2, b.damage);
                    if (b.explosion) {
                        Particles.spawnExplosion(b.x, b.y);
                        Renderer.shake(5, 0.15);
                    }
                    player.addScore(5);
                    hit = true;
                    break;
                }
            }

            // vs Boss
            if (!hit && boss && !boss.dead) {
                const br = boss.getRect();
                if (b.x > br.x && b.x < br.x + br.w && b.y > br.y && b.y < br.y + br.h) {
                    boss.takeDamage(b.damage);
                    Particles.spawnHitImpact(b.x, b.y);
                    Particles.spawnDamageNum(b.x, b.y - 15, b.damage);
                    if (b.explosion) {
                        Particles.spawnExplosion(b.x, b.y);
                        Renderer.shake(6, 0.2);
                    }
                    hit = true;
                }
            }

            if (hit) {
                Particles.spawnSparks(b.x, b.y, 4);
                player.bullets.splice(i, 1);
            }
        }

        for (let i = player.bullets.length - 1; i >= 0; i--) {
            const b = player.bullets[i];
            let missileHit = false;
            for (const e of enemies) {
                if (e.dead) continue;
                for (let j = e.bullets.length - 1; j >= 0; j--) {
                    const mb = e.bullets[j];
                    if (!mb.homing) continue;
                    const dx = b.x - mb.x, dy = b.y - mb.y;
                    if (dx * dx + dy * dy < (b.size + mb.size + 4) * (b.size + mb.size + 4)) {
                        e.bullets.splice(j, 1);
                        missileHit = true;
                        Particles.spawnExplosion(mb.x, mb.y);
                        player.addScore(10);
                        break;
                    }
                }
                if (missileHit) break;
            }
            if (missileHit) {
                player.bullets.splice(i, 1);
            }
        }

        // 纰版挒妫€娴? 鏁屼汉瀛愬脊 vs 鐜╁
        if (!player.dead) {
            const playerRect = player.getRect();

            for (const enemy of enemies) {
                handleEnemyBulletHitsPlayer(enemy.bullets, playerRect);
            }
            if (boss) handleEnemyBulletHitsPlayer(boss.bullets, playerRect);

            for (const enemy of enemies) {
                if (enemy.dead) continue;
                const enemyRect = enemy.getRect();
                if (Utils.rectCollide(enemyRect, playerRect)) {
                    if (!player.shieldActive) {
                        player.takeDamage(enemy.damage * 0.5);
                    }
                }
            }

            if (boss && !boss.dead) {
                const bossRect = boss.getRect();
                if (Utils.rectCollide(bossRect, playerRect)) {
                    if (!player.shieldActive) {
                        player.takeDamage(boss.damage * 0.3);
                    }
                }
            }
        }

        // 鐜╁姝讳骸
        if (player.dead && player.deathTimer > 1.5) {
            state = 'dead';
            showMenu('death-menu');
            ui.deathInfo.textContent = `得分: ${player.score} | 关卡: ${levelData.name}`;
        }

        // 鏆傚仠
        if (Input.wasPressed('Escape')) {
            if (state === 'playing') {
                state = 'paused';
                Audio.play('pause');
                showMenu('pause-menu');
            }
        }

        // 绮掑瓙
        Particles.update(dt);

        // Boss 鍑虹幇鍏憡璁℃椂
        if (bossAnnounceTimer > 0) {
            bossAnnounceTimer = Math.max(0, bossAnnounceTimer - dt);
        }

        // HUD
        updateHUD();
    }

    // ---- 娓叉煋 ----
    function render() {
        ctx = Renderer.ctx();
        if (!ctx) return;

        const shakeApplied = Renderer.applyShake(frameDt);

        if (levelData) {
            Renderer.drawBackground(levelData, gameTime);
            Renderer.drawPlatforms(levelData);
        }

        if (state === 'playing' || state === 'paused' || state === 'dead') {
            drops.forEach(drop => drop.draw(ctx));
            enemies.forEach(enemy => enemy.draw(ctx));
            if (boss) boss.draw(ctx);

            if (player) {
                player.draw(ctx);
                player.bullets.forEach(bullet => bullet.draw(ctx));
                player.thrown.forEach(thrown => thrown.draw(ctx));
            }

            Particles.draw(ctx);
            drawCrosshair();

            if (!bossSpawned && enemies.length === 0 && player && !player.dead && bossWarningTimer > 0) {
                drawBossWarning();
            }

            if (bossAnnounceTimer > 0 && boss) {
                drawBossAnnounce();
            }

            if (player && !player.dead) {
                Renderer.drawVignette(player.health / player.maxHealth, gameTime);
            }
        }

        if (shakeApplied) Renderer.endShake();
    }

    function drawCrosshair() {
        const mouse = Input.getMouse();
        const mx = mouse.x, my = mouse.y;
        const size = 8;
        const gap = 4;
        const pulse = 1 + Math.sin(gameTime * 8) * 0.2;

        ctx.save();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;

        const lineSize = size * pulse;
        const lineGap = gap * pulse;
        ctx.beginPath();
        ctx.moveTo(mx - lineSize, my);
        ctx.lineTo(mx - lineGap, my);
        ctx.moveTo(mx + lineGap, my);
        ctx.lineTo(mx + lineSize, my);
        ctx.moveTo(mx, my - lineSize);
        ctx.lineTo(mx, my - lineGap);
        ctx.moveTo(mx, my + lineGap);
        ctx.lineTo(mx, my + lineSize);
        ctx.stroke();

        ctx.fillStyle = '#e74c3c';
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(mx, my, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawBossWarning() {
        const centerX = Renderer.width() / 2;
        const centerY = Renderer.height() / 2;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const alpha = 0.5 + Math.sin(bossWarningTimer * 8) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
        ctx.fillRect(0, centerY - 80, Renderer.width(), 160);

        ctx.font = 'bold 56px sans-serif';
        ctx.fillStyle = '#ff0000';
        ctx.fillText('⚠', centerX, centerY - 60);

        ctx.font = 'bold 42px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#ff4444';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText('BOSS 即将出现!', centerX, centerY);
        ctx.fillText('BOSS 即将出现!', centerX, centerY);

        ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#ffaaaa';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText('准备战斗!', centerX, centerY + 45);
        ctx.fillText('准备战斗!', centerX, centerY + 45);

        ctx.restore();
    }

    function drawBossAnnounce() {
        const centerX = Renderer.width() / 2;
        const centerY = Renderer.height() / 2;

        ctx.save();

        if (bossAnnounceTimer > 2.5) {
            const flashAlpha = (bossAnnounceTimer - 2.5) * 0.8;
            ctx.fillStyle = `rgba(255, 0, 0, ${flashAlpha})`;
            ctx.fillRect(0, 0, Renderer.width(), Renderer.height());
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let alpha = 1;
        if (bossAnnounceTimer > 2.5) {
            alpha = (3 - bossAnnounceTimer) * 2;
        } else if (bossAnnounceTimer < 0.5) {
            alpha = bossAnnounceTimer * 2;
        }
        ctx.globalAlpha = Math.min(1, Math.max(0, alpha));

        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, centerY - 70, Renderer.width(), 140);

        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20;
        ctx.font = 'bold 60px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#ff0000';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 5;
        ctx.strokeText(boss.name, centerX, centerY - 25);
        ctx.fillText(boss.name, centerX, centerY - 25);
        ctx.shadowBlur = 0;

        ctx.font = 'bold 36px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#ff6666';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText('出现了!', centerX, centerY + 30);
        ctx.fillText('出现了!', centerX, centerY + 30);

        ctx.restore();
    }

    // ---- 鍏紑鏂规硶 ----
    function start() {
        Audio.init();
        initializeSystems();

        healthBonus = 0;
        loadLevel(0);
        state = 'playing';
        hideAllMenus();
        ui.hud.classList.remove('hidden');

        lastTime = performance.now();
        gameTime = 0;
        if (animFrame) cancelAnimationFrame(animFrame);
        animFrame = requestAnimationFrame(gameLoop);
    }

    function resume() {
        Audio.play('unpause');
        state = 'playing';
        hideAllMenus();
    }

    function restart() {
        hideAllMenus();
        loadLevel(currentLevel);
        state = 'playing';
    }

    function restartLevel() {
        hideAllMenus();
        loadLevel(currentLevel);
        state = 'playing';
    }

    function nextLevel() {
        hideAllMenus();
        if (currentLevel < Levels.length - 1) {
            healthBonus += 20;
            loadLevel(currentLevel + 1);
            state = 'playing';
        } else {
            showVictory();
        }
    }

    function showLevelComplete() {
        state = 'levelComplete';
        showMenu('level-complete-menu');
        ui.levelCompleteTitle.textContent = `${levelData.name} 通过!`;
        ui.levelCompleteInfo.textContent = `当前得分: ${player.score}`;
        Audio.playMp3('levelComplete');
        if (currentLevel >= Levels.length - 1) {
            ui.nextLevelBtn.classList.add('hidden');
        } else {
            ui.nextLevelBtn.classList.remove('hidden');
        }
    }

    function showVictory() {
        Audio.stopAmbient();
        Audio.play('victory');
        state = 'victory';
        showMenu('victory-menu');
        ui.victoryInfo.textContent = `最终得分: ${player.score}\n恭喜你击败了所有 Boss!`;
    }

    function backToTitle() {
        clearPendingTransition();
        Audio.stopAmbient();
        Audio.stopBgm();
        state = 'menu';
        hideAllMenus();
        showMenu('start-menu');
        ui.hud.classList.add('hidden');
        if (animFrame) cancelAnimationFrame(animFrame);
    }

    function showControls() {
        showMenu('controls-menu');
    }

    function hideControls() {
        showMenu('start-menu');
    }

    bindBootScreen();

    return {
        dismissBootScreen,
        bootStart,
        start, resume, restart, restartLevel, nextLevel,
        backToTitle, showControls, hideControls,
        showLevelSelect, hideLevelSelect, selectLevel,
    };
})();


