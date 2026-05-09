// ==================== 主游戏逻辑 ====================
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
    let bootScreenDismissed = true;
    let currentDifficulty = 'normal';
    let pendingLevelIndex = null;
    let currentPlayerName = '匿名特工';
    let carryOverScore = 0;
    let persistentUpgradeIds = [];
    let pendingUpgradeChoices = [];
    let selectedUpgradeThisReward = false;

    const DIFFICULTY_CONFIG = {
        easy: {
            label: '简单',
            enemyHealthMul: 0.7,
            enemyDamageMul: 0.7,
            enemySpeedMul: 0.8,
            enemyAttackRateMul: 1.3,
            bossHealthMul: 0.7,
            bossDamageMul: 0.7,
            bossSpeedMul: 0.85,
            scoreMul: 0.8,
        },
        normal: {
            label: '普通',
            enemyHealthMul: 1.0,
            enemyDamageMul: 1.0,
            enemySpeedMul: 1.0,
            enemyAttackRateMul: 1.0,
            bossHealthMul: 1.0,
            bossDamageMul: 1.0,
            bossSpeedMul: 1.0,
            scoreMul: 1.0,
        },
        hard: {
            label: '困难',
            enemyHealthMul: 1.5,
            enemyDamageMul: 1.4,
            enemySpeedMul: 1.15,
            enemyAttackRateMul: 0.75,
            bossHealthMul: 1.5,
            bossDamageMul: 1.4,
            bossSpeedMul: 1.1,
            scoreMul: 1.5,
        },
    };

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
            difficultyDisplay: $('difficulty-display'),
            currentPlayerNameEl: $('current-player-name'),
            playerNameInput: $('player-name-input'),
            playerList: $('player-list'),
            leaderboardList: $('leaderboard-list'),
            levelCompleteTitle: $('level-complete-title'),
            levelCompleteInfo: $('level-complete-info'),
            nextLevelBtn: $('next-level-btn'),
            upgradeChoices: $('upgrade-choices'),
            victoryInfo: $('victory-info'),
            deathInfo: $('death-info'),
            weaponSlots,
            mobileControls: $('mobile-controls'),
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

    // ---- 玩家数据与排行榜 ----
    function getPlayersData() {
        try {
            return JSON.parse(localStorage.getItem('stickman_players')) || {};
        } catch {
            return {};
        }
    }

    function savePlayersData(data) {
        localStorage.setItem('stickman_players', JSON.stringify(data));
    }

    function getSavedCurrentPlayer() {
        try {
            return localStorage.getItem('stickman_current_player') || '';
        } catch {
            return '';
        }
    }

    function saveCurrentPlayer(name) {
        localStorage.setItem('stickman_current_player', name);
    }

    function calculateFinalScore(player, time, levelIndex) {
        const config = DIFFICULTY_CONFIG[currentDifficulty] || DIFFICULTY_CONFIG.normal;
        const baseScore = player ? player.score : 0;
        const healthRatio = player ? Math.max(0, player.health / player.maxHealth) : 0;
        const healthBonus = Math.round(healthRatio * 2000);
        const timeBonus = Math.max(0, Math.round(3000 - time * 15));
        const rawTotal = baseScore + healthBonus + timeBonus;
        const total = Math.round(rawTotal * config.scoreMul);
        const diffBonus = total - rawTotal;
        return { total, baseScore, healthBonus, timeBonus, healthRatio, diffBonus, scoreMul: config.scoreMul };
    }

    function recordScore(levelIndex, finalScoreObj) {
        const data = getPlayersData();
        if (!data[currentPlayerName]) {
            data[currentPlayerName] = { scores: [] };
        }
        data[currentPlayerName].scores.push({
            level: levelIndex,
            levelName: Levels[levelIndex]?.name || `关卡 ${levelIndex + 1}`,
            score: finalScoreObj.total,
            baseScore: finalScoreObj.baseScore,
            healthBonus: finalScoreObj.healthBonus,
            timeBonus: finalScoreObj.timeBonus,
            healthRatio: finalScoreObj.healthRatio,
            time: Math.round(gameTime * 10) / 10,
            difficulty: currentDifficulty,
            date: new Date().toLocaleString('zh-CN'),
        });
        savePlayersData(data);
    }

    function getLeaderboardEntries(levelFilter = 'all') {
        const data = getPlayersData();
        const entries = [];
        for (const [name, playerData] of Object.entries(data)) {
            const scores = playerData.scores || [];
            for (const s of scores) {
                if (levelFilter !== 'all' && s.level !== parseInt(levelFilter)) continue;
                entries.push({ name, ...s });
            }
        }
        return entries.sort((a, b) => b.score - a.score);
    }

    function getAvailableUpgradeChoices() {
        const ids = Object.keys(PlayerUpgradeData || {}).filter(id => !persistentUpgradeIds.includes(id));
        const pool = ids.length ? ids : Object.keys(PlayerUpgradeData || {});
        const choices = [];
        const copy = [...pool];
        while (choices.length < 3 && copy.length) {
            const index = Utils.randInt(0, copy.length - 1);
            choices.push(copy.splice(index, 1)[0]);
        }
        return choices;
    }

    function renderUpgradeChoices() {
        if (!ui.upgradeChoices || !PlayerUpgradeData) return;
        if (currentLevel >= Levels.length - 1) {
            ui.upgradeChoices.classList.add('hidden');
            ui.upgradeChoices.innerHTML = '';
            return;
        }

        pendingUpgradeChoices = getAvailableUpgradeChoices();
        selectedUpgradeThisReward = false;
        ui.upgradeChoices.classList.remove('hidden');
        ui.upgradeChoices.innerHTML = `
            <div class="upgrade-choice-title">选择一项战术强化</div>
            <div class="upgrade-choice-grid">
                ${pendingUpgradeChoices.map(id => {
                    const item = PlayerUpgradeData[id];
                    return `
                        <button class="upgrade-choice-card" onclick="Game.chooseUpgrade('${id}')">
                            <strong>${item.name}</strong>
                            <span>${item.desc}</span>
                        </button>
                    `;
                }).join('')}
            </div>
        `;
        if (ui.nextLevelBtn) {
            ui.nextLevelBtn.disabled = true;
            ui.nextLevelBtn.textContent = '先选择强化';
        }
    }

    function chooseUpgrade(id) {
        if (!player || selectedUpgradeThisReward || !pendingUpgradeChoices.includes(id)) return;
        if (!persistentUpgradeIds.includes(id)) persistentUpgradeIds.push(id);
        player.applyUpgrade(id);
        selectedUpgradeThisReward = true;
        if (ui.upgradeChoices) {
            const cards = ui.upgradeChoices.querySelectorAll('.upgrade-choice-card');
            cards.forEach(card => {
                const selected = card.getAttribute('onclick')?.includes(`'${id}'`);
                card.classList.toggle('selected', selected);
                card.disabled = true;
            });
        }
        if (ui.nextLevelBtn) {
            ui.nextLevelBtn.disabled = false;
            ui.nextLevelBtn.textContent = '进入下一关';
        }
    }

    function initPlayerSystem() {
        const saved = getSavedCurrentPlayer();
        if (saved) {
            currentPlayerName = saved;
        }
        updatePlayerDisplay();

        // 支持回车键新增玩家
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && ui.playerNameInput && document.activeElement === ui.playerNameInput) {
                addNewPlayer();
            }
        });
    }

    function updatePlayerDisplay() {
        ensureUIRefs();
        if (ui.currentPlayerNameEl) {
            ui.currentPlayerNameEl.textContent = currentPlayerName;
        }
    }

    function renderPlayerList() {
        if (!ui.playerList) return;
        const data = getPlayersData();
        const names = Object.keys(data);
        ui.playerList.innerHTML = '';

        if (names.length === 0) {
            ui.playerList.innerHTML = '<div class="leaderboard-empty">暂无记录，输入代号新增玩家</div>';
            return;
        }

        names.forEach(name => {
            const item = document.createElement('div');
            item.className = 'player-list-item' + (name === currentPlayerName ? ' active' : '');
            item.innerHTML = `<span class="player-list-item__name">${name}</span>` +
                (name === currentPlayerName ? '<span class="player-list-item__tag">当前</span>' : '');
            item.onclick = () => {
                currentPlayerName = name;
                saveCurrentPlayer(name);
                updatePlayerDisplay();
                renderPlayerList();
            };
            ui.playerList.appendChild(item);
        });
    }

    function renderLeaderboard() {
        if (!ui.leaderboardList) return;
        const entries = getLeaderboardEntries('all');
        ui.leaderboardList.innerHTML = '';

        if (entries.length === 0) {
            ui.leaderboardList.innerHTML = '<div class="leaderboard-empty">暂无作战记录，开始行动吧！</div>';
            return;
        }

        entries.slice(0, 50).forEach((entry, index) => {
            const item = document.createElement('div');
            const rankClass = index === 0 ? 'leaderboard-item--top1' : index === 1 ? 'leaderboard-item--top2' : index === 2 ? 'leaderboard-item--top3' : '';
            item.className = `leaderboard-item ${rankClass}`;
            const diffLabel = DIFFICULTY_CONFIG[entry.difficulty]?.label || '普通';
            item.innerHTML = `
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-info">
                    <span class="leaderboard-name">${entry.name} · ${entry.levelName}</span>
                    <span class="leaderboard-meta">${entry.date} · ${diffLabel} · 用时 ${entry.time}s</span>
                </div>
                <div class="leaderboard-score">${entry.score}</div>
            `;
            ui.leaderboardList.appendChild(item);
        });
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
        if (!ui.bootScreen || ui.bootScreen.classList.contains('hidden')) return;

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
            if (bullet.reflected) continue;
            if (bulletHitsRect(bullet, playerRect)) {
                if (player.shieldActive) {
                    // 子弹反弹
                    bullet.vx = -bullet.vx * 1.3;
                    bullet.vy = -bullet.vy * 1.3;
                    bullet.reflected = true;
                    bullet.damage = (bullet.damage || 10) * 2;
                    if (bullet.homing) bullet.homing = false;
                    Particles.spawn(bullet.x, bullet.y, 6, '#00d2ff', 100, 0.3);
                    if (player.upgradeStats.shieldPulseDamage > 0) {
                        Particles.spawn(player.x, player.y - 25, 10, '#7ce7ff', 120, 0.25);
                        for (const enemy of enemies) {
                            if (!enemy.dead && Utils.dist(enemy.x, enemy.y, player.x, player.y) < 105) {
                                enemy.takeDamage(player.upgradeStats.shieldPulseDamage);
                            }
                        }
                        if (boss && !boss.dead && Utils.dist(boss.x, boss.y, player.x, player.y) < 125) {
                            boss.takeDamage(player.upgradeStats.shieldPulseDamage);
                        }
                    }
                    continue;
                }
                // 完美闪避判定
                if (player.perfectDodgeWindow > 0) {
                    player.perfectDodgeWindow = 0;
                    player.perfectDodgeActive = true;
                    player.perfectDodgeTimer = 1.5;
                    player.invincibleTimer = 1.5;
                    bullet.life = 0;
                    Renderer.shake(2, 0.1);
                    Particles.spawn(player.x, player.y - 25, 15, '#00d2ff', 200, 0.5);
                    Particles.spawnAmmoText(player.x, player.y - 55, '完美闪避！', '#00d2ff');
                    Audio.play('upgrade');
                    continue;
                }
                player.takeDamage(bullet.damage);
                bullet.life = 0;
                Renderer.shake(4, 0.1);
            }
        }
    }

    function handleBossHazardsPlayer(hazards, playerRect) {
        if (!player || player.dead) return;
        for (const h of hazards) {
            if (h.timer && h.timer > 0) continue;
            if (h.type === 'fire_pillar' || h.type === 'ice_spike') {
                const px = playerRect.x + playerRect.w / 2;
                const py = playerRect.y + playerRect.h;
                if (Utils.dist(px, py, h.x, h.y) < h.radius) {
                    player.takeDamage(h.damage);
                    Renderer.shake(3, 0.08);
                }
            } else if (h.type === 'ice_wall') {
                const wallRect = { x: h.x - h.w / 2, y: h.y - h.h, w: h.w, h: h.h };
                if (Utils.rectCollide(wallRect, playerRect)) {
                    player.takeDamage(h.damage);
                }
            }
        }
    }

    function showMenu(id) {
        const menuList = menus || document.querySelectorAll('.menu');
        menuList.forEach(menu => menu.classList.add('hidden'));
        if (id) $(id).classList.remove('hidden');
        if (ui && ui.mobileControls) ui.mobileControls.classList.add('hidden');
    }

    function hideAllMenus() {
        const menuList = menus || document.querySelectorAll('.menu');
        menuList.forEach(menu => menu.classList.add('hidden'));
        if (ui && ui.mobileControls) ui.mobileControls.classList.remove('hidden');
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

    function cloneLevelWithDifficulty(rawLevel, difficulty) {
        const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.normal;

        const level = { ...rawLevel };
        level.platforms = rawLevel.platforms.map(p => ({ ...p }));
        level.enemies = rawLevel.enemies.map(e => {
            const copy = { ...e };
            if (config.enemyHealthMul !== 1.0 && copy.health) {
                copy.health = Math.round(copy.health * config.enemyHealthMul);
            }
            if (config.enemyDamageMul !== 1.0 && copy.damage) {
                copy.damage = Math.round(copy.damage * config.enemyDamageMul);
            }
            if (config.enemySpeedMul !== 1.0 && copy.speed) {
                copy.speed = Math.round(copy.speed * config.enemySpeedMul);
            }
            if (config.enemyAttackRateMul !== 1.0 && copy.attackRate) {
                copy.attackRate = copy.attackRate * config.enemyAttackRateMul;
            }
            return copy;
        });
        level.weaponDrops = rawLevel.weaponDrops.map(d => ({ ...d }));
        level.boss = { ...rawLevel.boss };
        if (config.bossHealthMul !== 1.0 && level.boss.health) {
            level.boss.health = Math.round(level.boss.health * config.bossHealthMul);
        }
        if (config.bossDamageMul !== 1.0 && level.boss.damage) {
            level.boss.damage = Math.round(level.boss.damage * config.bossDamageMul);
        }
        if (config.bossSpeedMul !== 1.0 && level.boss.speed) {
            level.boss.speed = Math.round(level.boss.speed * config.bossSpeedMul);
        }
        level.bgGradient = rawLevel.bgGradient;

        return level;
    }

    function showDifficultySelect(forLevelIndex) {
        pendingLevelIndex = forLevelIndex;
        const desc = $('difficulty-select-desc');
        if (desc) {
            const levelName = forLevelIndex !== null && Levels[forLevelIndex]
                ? Levels[forLevelIndex].name
                : '第一关';
            desc.textContent = `为「${levelName}」选择合适的难度等级。`;
        }
        showMenu('difficulty-select-menu');
    }

    function hideDifficultySelect() {
        pendingLevelIndex = null;
        if (state === 'menu') {
            showMenu('start-menu');
        } else {
            showMenu('level-select-menu');
        }
    }

    function selectDifficulty(difficulty) {
        currentDifficulty = difficulty;
        const levelIndex = pendingLevelIndex !== null ? pendingLevelIndex : 0;
        pendingLevelIndex = null;

        Audio.init();
        initializeSystems();

        healthBonus = 0;
        carryOverScore = 0;
        persistentUpgradeIds = [];
        pendingUpgradeChoices = [];
        selectedUpgradeThisReward = false;
        gameTime = 0;
        loadLevel(levelIndex);
        state = 'playing';
        hideAllMenus();
        ui.hud.classList.remove('hidden');

        lastTime = performance.now();
        gameTime = 0;
        if (animFrame) cancelAnimationFrame(animFrame);
        animFrame = requestAnimationFrame(gameLoop);
    }

    function selectLevel(index) {
        pendingLevelIndex = index;
        selectDifficulty(currentDifficulty);
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

        if (ui.difficultyDisplay) {
            const diffLabel = DIFFICULTY_CONFIG[currentDifficulty]?.label || '普通';
            ui.difficultyDisplay.textContent = diffLabel;
        }

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

    function loadLevel(index, options = {}) {
        clearPendingTransition();
        ensureUIRefs();

        currentLevel = index;
        levelData = cloneLevelWithDifficulty(Levels[index], currentDifficulty);

        player = new Player(levelData.playerStart.x, levelData.playerStart.y);
        for (const id of persistentUpgradeIds) player.applyUpgrade(id, true);
        if (healthBonus > 0) player.increaseMaxHealth(healthBonus);
        if (options.carryOverScore && player) {
            player.score = options.carryOverScore;
        }
        enemies = levelData.enemies.map(enemy => new Enemy(enemy.x, enemy.y, { ...enemy }));
        boss = null;
        bossSpawned = false;
        bossWarningTimer = 0;
        bossAnnounceTimer = 0;
        drops = levelData.weaponDrops.map(drop => new WeaponDrop(drop.x, drop.y, drop.type));

        Particles.clear();
        Renderer.generateBackground(levelData);
        Audio.startAmbient(index);

        // BGM 映射表
        const bgmMap = ['bgm_level1', 'bgm_level2', 'bgm_level3', 'bgm_level4', 'bgm_level5', 'bgm_level5'];
        if (bgmMap[index]) {
            Audio.playBgm(bgmMap[index]);
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
        } else if (state === 'paused') {
            // 暂停状态下按 Escape 恢复游戏
            if (Input.wasPressed('Escape')) {
                resume();
            }
        }

        render();
        Input.endFrame();
    }

    function update(dt) {
        // 鏇存柊杈撳叆绯荤粺锛堟寜閿寜浣忔椂闂达級
        Input.update(dt);

        // 移动平台更新
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

        // 玩家更新
        player.update(dt, levelData.platforms);

        // 下砸冲击落地伤害
        if (player.groundPoundJustLanded) {
            player.groundPoundJustLanded = false;
            Renderer.shake(6, 0.2);
            Audio.play('explode');
            Particles.spawnExplosion(player.x, player.y);
            Particles.spawn(player.x, player.y, 20, '#ff9500', 350, 0.6, 5);
            const radius = player.groundPoundRadius;
            const damage = player.groundPoundDamage;
            for (const enemy of enemies) {
                if (enemy.dead) continue;
                const dist = Utils.dist(player.x, player.y, enemy.x, enemy.y);
                if (dist < radius) {
                    const dmg = Math.round(damage * (1 - dist / radius));
                    enemy.takeDamage(dmg);
                    enemy.vy = -350;
                    enemy.vx = (enemy.x - player.x) > 0 ? 250 : -250;
                    Particles.spawnDamageNum(enemy.x, enemy.y - enemy.h / 2, dmg);
                }
            }
            if (boss && !boss.dead) {
                const dist = Utils.dist(player.x, player.y, boss.x, boss.y);
                if (dist < radius + 40) {
                    const dmg = Math.round(damage * 0.8);
                    boss.takeDamage(dmg);
                    Particles.spawnDamageNum(boss.x, boss.y - 20, dmg);
                }
            }
        }

        // 反弹子弹伤害敌人
        for (const enemy of enemies) {
            if (enemy.dead) continue;
            for (let i = enemy.bullets.length - 1; i >= 0; i--) {
                const b = enemy.bullets[i];
                if (!b.reflected) continue;
                const er = enemy.getRect();
                if (bulletHitsRect(b, er)) {
                    enemy.takeDamage(b.damage);
                    Particles.spawnHitImpact(b.x, b.y, Math.atan2(b.vy, b.vx));
                    Particles.spawnDamageNum(b.x, b.y - er.h / 2, b.damage);
                    const last = enemy.bullets.pop();
                    if (i < enemy.bullets.length) enemy.bullets[i] = last;
                }
            }
        }
        if (boss && !boss.dead && boss.bullets) {
            for (let i = boss.bullets.length - 1; i >= 0; i--) {
                const b = boss.bullets[i];
                if (!b.reflected) continue;
                const br = boss.getRect();
                if (bulletHitsRect(b, br)) {
                    boss.takeDamage(b.damage);
                    Particles.spawnHitImpact(b.x, b.y, Math.atan2(b.vy, b.vx));
                    Particles.spawnDamageNum(b.x, b.y - 15, b.damage);
                    const last = boss.bullets.pop();
                    if (i < boss.bullets.length) boss.bullets[i] = last;
                }
            }
        }

        // 浣庤閲忓績璺?+ 鍋滄粸璀﹀憡闊虫晥
        Audio.updateLowHealth(dt, player.health / player.maxHealth);
        Audio.updateWarning(dt, player.stagnationTimer);

        // 相机
        const targetX = player.x - Renderer.width() * 0.35;
        const smoothX = 1 - Math.pow(0.02, dt);
        Utils.camera.x = Utils.lerp(Utils.camera.x, targetX, smoothX);
        Utils.camera.x = Utils.clamp(Utils.camera.x, levelData.cameraBounds.minX, levelData.cameraBounds.maxX);
        const targetY = player.y - Renderer.height() * 0.55;
        const smoothY = 1 - Math.pow(0.03, dt);
        Utils.camera.y = Utils.lerp(Utils.camera.y, Utils.clamp(targetY, -200, 200), smoothY);

        // 敌人
        for (let i = enemies.length - 1; i >= 0; i--) {
            const alive = enemies[i].update(dt, levelData.platforms, player.x, player.y);
            if (!alive) {
                if (!enemies[i].fellToAbyss) {
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
                    player.tryRecycleAmmo();
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
                }
                const last = enemies.pop();
                if (i < enemies.length) enemies[i] = last;
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
                        let dmg = t.damage * (dist < t.radius * 0.5 ? 1 : 0.6);
                        if (boss.isVulnerable && boss.isVulnerable()) dmg *= player.upgradeStats.bossWeakDamageMul;
                        boss.takeDamage(dmg);
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
                        let dmg = 12 * dt;
                        if (boss.isVulnerable && boss.isVulnerable()) dmg *= player.upgradeStats.bossWeakDamageMul;
                        boss.takeDamage(dmg);
                    }
                }
                if (boss && boss.hazards) {
                    for (const h of boss.hazards) {
                        if (h.type !== 'ice_wall') continue;
                        const wallCenterY = h.y - h.h / 2;
                        if (Utils.dist(t.x, t.y, h.x, wallCenterY) < t.radius + h.w) {
                            h.health -= (player.hasUpgrade('fire_control') ? 55 : 32) * dt;
                        }
                    }
                }
                if (!player.dead) {
                    const dist = Utils.dist(t.x, t.y, player.x, player.y - 25);
                    if (dist < t.radius * 0.7) {
                        if (!player.shieldActive) {
                            // 燃烧瓶自伤：直接扣血（绕过无敌帧，持续灼烧不中断）
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

            // 生成 Boss
            if (bossWarningTimer >= 2) {
                boss = new Boss(levelData.boss.x, levelData.boss.y, { ...levelData.boss });
                bossSpawned = true;
                bossAnnounceTimer = 3; // 显示3秒Boss出现提示
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
                // Boss 击败音效映射表
                const BOSS_SOUNDS = {
                    0: 'bossExplode', 1: 'bossLaugh', 2: 'bossLuck',
                    3: 'bossRespect', 4: 'bossBad', 5: 'bossSurrender', 6: 'bossSurrender'
                };
                const bossSound = BOSS_SOUNDS[currentLevel];
                if (bossSound) {
                    Audio.stopBgm();
                    Audio.setMasterGainBoost(3);
                    Audio.playMp3WithCallback(bossSound, 1, function() {
                        Audio.restoreMasterGain();
                        schedulePostBossTransition();
                    });
                } else {
                    schedulePostBossTransition();
                }
            }
        }

        // 武器掉落更新
        for (let i = drops.length - 1; i >= 0; i--) {
            const distToPlayer = player ? Utils.dist(player.x, player.y, drops[i].x, drops[i].y) : Infinity;
            drops[i].nearPlayer = distToPlayer < 110;
            drops[i].pickupReady = distToPlayer < 65;
            drops[i].pickupVector = player
                ? { x: player.x - drops[i].x, y: player.y - drops[i].y }
                : { x: 0, y: 0 };
            drops[i].update(dt);
            if (drops[i].dead) {
                const last = drops.pop();
                if (i < drops.length) drops[i] = last;
            }
        }

        // 拾取
        if (Input.wasPressed('KeyE')) {
            player.tryPickup(drops);
        }

        // 升级
        if (Input.wasPressed('KeyR')) {
            if (player.upgradeWeapon()) {
                Particles.spawn(player.x, player.y - 30, 15, '#f1c40f', 200, 0.6);
            }
        }

        // 纰版挒妫€娴? 鐜╁瀛愬脊 vs 鏁屼汉/Boss
        for (let i = player.bullets.length - 1; i >= 0; i--) {
            const b = player.bullets[i];
            let hit = false;

            // vs 敌人
            for (const e of enemies) {
                if (e.dead) continue;
                const er = e.getRect();
                if (b.x > er.x && b.x < er.x + er.w && b.y > er.y && b.y < er.y + er.h) {
                    e.takeDamage(b.damage);
                    Particles.spawnHitImpact(b.x, b.y, Math.atan2(b.vy, b.vx));
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

            if (!hit && boss && boss.hazards) {
                for (const h of boss.hazards) {
                    if (h.type !== 'ice_wall') continue;
                    const hr = { x: h.x - h.w / 2, y: h.y - h.h, w: h.w, h: h.h };
                    if (b.x > hr.x && b.x < hr.x + hr.w && b.y > hr.y && b.y < hr.y + hr.h) {
                        h.health -= b.damage * (b.explosion ? 2.5 : 1);
                        Particles.spawnSparks(b.x, b.y, 6);
                        hit = true;
                        break;
                    }
                }
            }

            // vs Boss
            if (!hit && boss && !boss.dead) {
                const br = boss.getRect();
                if (b.x > br.x && b.x < br.x + br.w && b.y > br.y && b.y < br.y + br.h) {
                    let bossDamage = b.damage;
                    if (boss.isVulnerable && boss.isVulnerable()) bossDamage *= player.upgradeStats.bossWeakDamageMul;
                    boss.takeDamage(bossDamage);
                    Particles.spawnHitImpact(b.x, b.y, Math.atan2(b.vy, b.vx));
                    Particles.spawnDamageNum(b.x, b.y - 15, bossDamage);
                    if (b.explosion) {
                        Particles.spawnExplosion(b.x, b.y);
                        Renderer.shake(6, 0.2);
                    }
                    hit = true;
                }
            }

            if (hit) {
                Particles.spawnSparks(b.x, b.y, 4);
                const last = player.bullets.pop();
                if (i < player.bullets.length) player.bullets[i] = last;
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
                        const last = e.bullets.pop();
                        if (j < e.bullets.length) e.bullets[j] = last;
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

        // 碰撞检测：敌人子弹 vs 玩家
        if (!player.dead) {
            const playerRect = player.getRect();

            for (const enemy of enemies) {
                handleEnemyBulletHitsPlayer(enemy.bullets, playerRect);
            }
            if (boss) handleEnemyBulletHitsPlayer(boss.bullets, playerRect);
            if (boss) handleBossHazardsPlayer(boss.hazards, playerRect);

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
            const final = calculateFinalScore(player, gameTime, currentLevel);
            recordScore(currentLevel, final);
            const diffLabel = DIFFICULTY_CONFIG[currentDifficulty]?.label || '普通';
            const diffText = final.diffBonus !== 0 ? ` | 难度倍率: ${final.scoreMul}x ${final.diffBonus > 0 ? '(+' + final.diffBonus + ')' : '(' + final.diffBonus + ')'}` : '';
            ui.deathInfo.innerHTML = `关卡: ${levelData.name}<br>特工: ${currentPlayerName} · ${diffLabel}<br>基础得分: ${final.baseScore} | 血量奖励: ${final.healthBonus} | 时间奖励: ${final.timeBonus}${diffText}<br><strong style="color:var(--gold)">总积分: ${final.total}</strong>`;
        }

        // 暂停
        if (Input.wasPressed('Escape')) {
            if (state === 'playing') {
                state = 'paused';
                Audio.play('pause');
                showMenu('pause-menu');
            }
        }

        // 粒子更新
        Particles.update(dt);

        // Boss 鍑虹幇鍏憡璁℃椂
        if (bossAnnounceTimer > 0) {
            bossAnnounceTimer = Math.max(0, bossAnnounceTimer - dt);
        }

        // HUD
        updateHUD();
    }

    // ---- 渲染 ----
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
        pendingLevelIndex = 0;
        selectDifficulty(currentDifficulty);
    }

    function resume() {
        Audio.play('unpause');
        state = 'playing';
        hideAllMenus();
    }

    function restart() {
        hideAllMenus();
        carryOverScore = 0;
        gameTime = 0;
        loadLevel(currentLevel);
        state = 'playing';
    }

    // restartLevel 与 restart 逻辑完全一致，作为别名保留兼容
    const restartLevel = restart;

    function nextLevel() {
        if (currentLevel < Levels.length - 1 && !selectedUpgradeThisReward) return;
        hideAllMenus();
        if (currentLevel < Levels.length - 1) {
            healthBonus += 20;
            const prevScore = player ? player.score : 0;
            carryOverScore = prevScore;
            loadLevel(currentLevel + 1, { carryOverScore });
            state = 'playing';
        } else {
            showVictory();
        }
    }

    function showLevelComplete() {
        state = 'levelComplete';
        showMenu('level-complete-menu');
        ui.levelCompleteTitle.textContent = `${levelData.name} 通过!`;
        const final = calculateFinalScore(player, gameTime, currentLevel);
        const diffLabel = DIFFICULTY_CONFIG[currentDifficulty]?.label || '普通';
        const diffText = final.diffBonus !== 0 ? ` | 难度倍率: ${final.scoreMul}x ${final.diffBonus > 0 ? '(+' + final.diffBonus + ')' : '(' + final.diffBonus + ')'}` : '';
        ui.levelCompleteInfo.innerHTML = `特工: ${currentPlayerName} · ${diffLabel}<br>当前累计得分: ${final.baseScore} | 血量奖励: ${final.healthBonus} | 时间奖励: ${final.timeBonus}${diffText}<br><strong style="color:var(--gold)">当前总积分: ${final.total}</strong><br><span style="color:var(--muted);font-size:12px">进入下一关继续累计分数...</span>`;
        Audio.playMp3('levelComplete');
        if (currentLevel >= Levels.length - 1) {
            ui.nextLevelBtn.classList.add('hidden');
            if (ui.upgradeChoices) ui.upgradeChoices.classList.add('hidden');
        } else {
            ui.nextLevelBtn.classList.remove('hidden');
            renderUpgradeChoices();
        }
    }

    function showVictory() {
        Audio.stopAmbient();
        Audio.play('victory');
        state = 'victory';
        showMenu('victory-menu');
        const final = calculateFinalScore(player, gameTime, currentLevel);
        recordScore(currentLevel, final);
        const diffLabel = DIFFICULTY_CONFIG[currentDifficulty]?.label || '普通';
        const diffText = final.diffBonus !== 0 ? ` | 难度倍率: ${final.scoreMul}x ${final.diffBonus > 0 ? '(+' + final.diffBonus + ')' : '(' + final.diffBonus + ')'}` : '';
        ui.victoryInfo.innerHTML = `特工: ${currentPlayerName} · ${diffLabel}<br>基础得分: ${final.baseScore} | 血量奖励: ${final.healthBonus} | 时间奖励: ${final.timeBonus}${diffText}<br><strong style="color:var(--gold)">总积分: ${final.total}</strong><br>恭喜你击败了所有 Boss!`;
    }

    function backToTitle() {
        clearPendingTransition();
        Audio.stopAmbient();
        Audio.stopBgm();
        state = 'menu';
        levelData = null; // 清理渲染状态，避免菜单状态下无谓渲染
        player = null;
        enemies = [];
        boss = null;
        drops = [];
        hideAllMenus();
        showMenu('start-menu');
        ui.hud.classList.add('hidden');
        carryOverScore = 0;
        gameTime = 0;
        if (animFrame) cancelAnimationFrame(animFrame);
    }

    function showControls() {
        showMenu('controls-menu');
    }

    function hideControls() {
        showMenu('start-menu');
    }

    function showPlayerMenu() {
        showMenu('player-menu');
        renderPlayerList();
        if (ui.playerNameInput) ui.playerNameInput.value = '';
    }

    function hidePlayerMenu() {
        showMenu('start-menu');
    }

    function addNewPlayer() {
        if (!ui.playerNameInput) return;
        const name = ui.playerNameInput.value.trim();
        if (!name) {
            alert('请输入特工代号');
            return;
        }
        if (name.length > 12) {
            alert('代号最多12个字符');
            return;
        }
        currentPlayerName = name;
        saveCurrentPlayer(name);
        updatePlayerDisplay();
        renderPlayerList();
        ui.playerNameInput.value = '';
    }

    function showLeaderboard() {
        showMenu('leaderboard-menu');
        renderLeaderboard();
    }

    function hideLeaderboard() {
        showMenu('start-menu');
    }

    initPlayerSystem();
    bindBootScreen();

    return {
        dismissBootScreen,
        bootStart,
        start, resume, restart, restartLevel, nextLevel,
        backToTitle, showControls, hideControls,
        showLevelSelect, hideLevelSelect, selectLevel,
        showDifficultySelect, hideDifficultySelect, selectDifficulty,
        showPlayerMenu, hidePlayerMenu, addNewPlayer,
        showLeaderboard, hideLeaderboard, chooseUpgrade,
    };
})();


