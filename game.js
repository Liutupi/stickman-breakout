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

    // ---- 连击 / 狂暴 / 评级 ----
    const COMBO_WINDOW = 3.2;
    const OVERDRIVE_DURATION = 7;
    let combo = 0;
    let comboTimer = 0;
    let maxCombo = 0;
    let levelKills = 0;
    let levelTime = 0;          // 本关纯战斗时间（暂停不计）
    let orbPitch = 0;
    let orbPitchTimer = 0;
    let lastBossPhase = 0;
    let highestSector = 0;
    let arenaSweepDone = false;
    let continuesUsed = 0;
    let lastBossHealthPct = 100;
    let bossChipPct = 100;
    let rageReadyAnnounced = false;
    const COMBO_CALLS = { 2: '双杀', 3: '三杀', 4: '四杀', 5: '暴走', 8: '无人能挡', 12: '主宰战场', 16: '无双', 20: '超神' };

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
            baseScoreMul: 0.8,
            bonusMul: 0.8,
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
            baseScoreMul: 1.0,
            bonusMul: 1.0,
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
            baseScoreMul: 1.2,
            bonusMul: 1.8,
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
            mUpgrade: $('m-btn-upgrade'), mUpgradeLabel: $('m-upgrade-label'), mUpgradeCost: $('m-upgrade-cost'),
            mShield: $('m-btn-shield'), mShieldCount: $('m-shield-count'),
            mThrown: $('m-btn-thrown'), mThrownName: $('m-thrown-name'), mThrownCount: $('m-thrown-count'),
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
            healthChip: $('health-bar-chip'),
            bossChip: $('boss-health-bar-chip'),
            rageBar: $('rage-bar'),
            rageFill: $('rage-fill'),
            rageText: $('rage-text'),
            sectorLabel: $('sector-label'),
            routePercent: $('route-percent'),
            routeFill: $('route-fill'),
            enemyObjective: $('enemy-objective'),
            comboDisplay: $('combo-display'),
            comboNum: $('combo-num'),
            comboMult: $('combo-mult'),
            comboTimerFill: $('combo-timer-fill'),
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
        const rawBaseScore = player ? player.score : 0;
        const healthRatio = player ? Math.max(0, player.health / player.maxHealth) : 0;
        const rawHealthBonus = Math.round(healthRatio * 2000);
        const route = Levels[levelIndex];
        const durationScale = route && route.originalWidth ? route.levelWidth / route.originalWidth : 1;
        const rawTimeBonus = Math.max(0, Math.round(3000 - time / durationScale * 15));
        const baseScore = Math.round(rawBaseScore * config.baseScoreMul);
        const healthBonus = Math.round(rawHealthBonus * config.bonusMul);
        const timeBonus = Math.round(rawTimeBonus * config.bonusMul);
        const rawTotal = rawBaseScore + rawHealthBonus + rawTimeBonus;
        const total = baseScore + healthBonus + timeBonus;
        const diffBonus = total - rawTotal;
        return { total, baseScore, healthBonus, timeBonus, healthRatio, diffBonus, baseScoreMul: config.baseScoreMul, bonusMul: config.bonusMul };
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
        const rankEl = $('agent-rank');
        if (rankEl && typeof Progression !== 'undefined') {
            const prog = Progression.get(currentPlayerName);
            const lv = Progression.levelInfo(prog.xp);
            rankEl.textContent = `Lv.${lv.level} ${lv.rank} · ${prog.coins} 金币`;
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
                Renderer.addFlash('rgba(168, 48, 53, 0.25)', 0.8, 0.2);
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
            } else if (h.type === 'melee_swing') {
                if (Utils.rectCollide({ x:h.x-h.w/2, y:h.y-h.h, w:h.w, h:h.h }, playerRect)) player.takeDamage(h.damage);
            } else if (h.type === 'ice_wall') {
                const wallRect = { x: h.x - h.w / 2, y: h.y - h.h, w: h.w, h: h.h };
                if (Utils.rectCollide(wallRect, playerRect)) {
                    player.takeDamage(h.damage);
                }
            } else if (h.type === 'laser_beam') {
                if (playerRect.y < h.y + 9 && playerRect.y + playerRect.h > h.y - 9) player.takeDamage(h.damage);
            } else if (h.type === 'boulder') {
                const px = playerRect.x + playerRect.w / 2;
                if (Math.abs(px - h.x) < h.radius && playerRect.y + playerRect.h > h.y - 90) player.takeDamage(h.damage);
            }
        }
    }

    // ==================== 永久养成 ====================
    let rewardGranted = false;
    let growthReturnMenu = 'start-menu';

    function applyProgression(p) {
        const st = Progression.stats(Progression.get(currentPlayerName));
        p.prog = st;
        p.appearance = st.appearance;
        if (st.hp) { p.maxHealth += st.hp; p.health = p.maxHealth; }
        p.upgradeStats.dashCooldownMul *= st.dashMul;
        p.grenadeCount += st.grenades;
        p.molotovCount += st.grenades;
        for (const o of st.loadout) {
            if (!p.weapons[o.slot]) {
                const w = p.makeWeapon(o.type);
                w.ammo = Math.round(w.maxAmmo * 0.6);
                p.weapons[o.slot] = w;
            }
        }
    }

    function grantRewards(opts) {
        if (rewardGranted || !player) return null;
        rewardGranted = true;
        const res = Progression.grant(currentPlayerName, { scoreGained: player.earned || 0, ...opts });
        updatePlayerDisplay();
        if (res.leveledUp) setTimeout(() => Audio.play('agentLevelUp'), 500);
        else setTimeout(() => Audio.play('coin'), 300);
        return res;
    }

    function rewardHTML(res) {
        if (!res) return '';
        const pct = Math.round(res.after.cur / res.after.need * 100);
        let html = `<div class="reward-box">
            <div class="reward-box__row"><span class="reward-coin">+${res.coins} 金币</span><span class="reward-xp">+${res.xp} 经验</span></div>
            <div class="reward-box__level">特工 Lv.${res.after.level} · ${res.after.rank}<div class="reward-xpbar"><div style="width:${pct}%"></div></div><span>${res.after.cur} / ${res.after.need}</span></div>`;
        if (res.leveledUp) html += `<div class="reward-box__up">特工升级！Lv.${res.before.level} → Lv.${res.after.level}</div>`;
        for (const a of res.appearanceUnlocks || []) html += `<div class="reward-box__unlock">外观进化：${a.name} · ${a.detail}</div>`;
        for (const u of res.unlocks) html += `<div class="reward-box__unlock">解锁开局装备：${u.name}</div>`;
        html += `<div class="reward-box__hint">金币可在「成长中心」永久强化特工</div></div>`;
        return html;
    }

    function showGrowth(returnTo) {
        growthReturnMenu = returnTo || 'start-menu';
        showMenu('growth-menu');
        renderGrowth();
    }

    function hideGrowth() {
        showMenu(growthReturnMenu);
    }

    function renderGrowth(flashId) {
        const box = $('growth-content');
        if (!box) return;
        const prog = Progression.get(currentPlayerName);
        const lv = Progression.levelInfo(prog.xp);
        const pct = Math.round(lv.cur / lv.need * 100);
        const cards = Progression.UPGRADES.map(u => {
            const l = prog.up[u.id] || 0;
            const maxed = l >= u.max;
            const c = Progression.cost(u, l);
            const afford = prog.coins >= c;
            const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
            return `<div class="g-card ${maxed ? 'maxed' : ''} ${flashId === u.id ? 'flash' : ''}">
                <div class="g-card__tag">${u.tag}</div>
                <div class="g-card__body">
                    <div class="g-card__name">${u.name}<span>Lv.${l}/${u.max}</span></div>
                    <div class="g-card__pips">${pips}</div>
                    <div class="g-card__desc">${l > 0 ? u.desc(l) : '尚未强化'}${maxed ? '' : `<em>下一级：${u.next}</em>`}</div>
                </div>
                <button class="g-card__buy" ${maxed || !afford ? 'disabled' : ''} onclick="Game.buyUpgrade('${u.id}')">${maxed ? '已满级' : `${c} 金币`}</button>
            </div>`;
        }).join('');
        const loadout = Progression.LOADOUT.map(o => `<div class="g-loadout ${lv.level >= o.level ? 'on' : ''}"><b>${o.name}</b><span>${lv.level >= o.level ? '已解锁 · 开局携带' : `特工 Lv.${o.level} 解锁`}</span></div>`).join('');
        box.innerHTML = `
            <div class="g-head">
                <div class="g-agent">
                    <div class="g-agent__name">${currentPlayerName}</div>
                    <div class="g-agent__rank">Lv.${lv.level} · ${lv.rank}</div>
                    <div class="g-xpbar"><div style="width:${pct}%"></div></div>
                    <div class="g-agent__xp">经验 ${lv.cur} / ${lv.need}</div>
                </div>
                <div class="g-coins"><span>金币</span><strong>${prog.coins}</strong></div>
            </div>
            <div class="g-appearance">
                <div class="g-sub">特工形态 · ${HeroAppearance.forLevel(lv.level).name}</div>
                <p class="g-appearance__hint">${HeroAppearance.next(lv.level) ? `特工 Lv.${HeroAppearance.next(lv.level).level} 解锁「${HeroAppearance.next(lv.level).name}」` : '已觉醒最终形态'} · 外观随经验等级自动进化</p>
                <div class="g-skins">${HeroAppearance.TIERS.map(t => `<div class="g-skin ${t.index === HeroAppearance.forLevel(lv.level).index ? 'current' : ''} ${lv.level < t.level ? 'locked' : ''}">
                    <div class="g-skin__art" style="background-position:${t.index % 3 * 50}% ${Math.floor(t.index / 3) * 100}%"></div>
                    <b>${t.name}</b><span>${lv.level < t.level ? `Lv.${t.level} 解锁` : t.index === HeroAppearance.forLevel(lv.level).index ? '当前形态' : '已解锁'}</span>
                </div>`).join('')}</div>
                <div class="g-battle-preview"><canvas id="hero-battle-preview" width="200" height="190" aria-label="当前战斗外观"></canvas><div><b>当前战斗外观</b><p>${HeroAppearance.forLevel(lv.level).detail}</p><span>保留火柴人关节动作 · 装甲随角色运动</span></div></div>
            </div>
            <div class="g-grid">${cards}</div>
            <div class="g-sub">开局装备（随特工等级解锁）</div>
            <div class="g-loadouts">${loadout}</div>`;
        const preview = $('hero-battle-preview');
        if (preview) {
            const c = preview.getContext('2d');
            const model = new Player(0, 0);
            model.appearance = HeroAppearance.forLevel(lv.level);
            model.onGround = true; model.animTime = 1; model.armAngle = -0.1;
            c.translate(88, 169); c.scale(2.4, 2.4);
            model.updateScarf(1 / 60);
            c.save(); c.translate(Utils.camera.x, Utils.camera.y); model.drawScarf(c); c.restore();
            model.drawBody(c);
        }
    }

    function buyUpgrade(id) {
        const r = Progression.buy(currentPlayerName, id);
        if (r.ok) {
            Audio.play('upgrade');
            renderGrowth(id);
            updatePlayerDisplay();
        } else {
            Audio.play('dry');
        }
    }

    // ==================== 战斗核心：击杀 / 连击 / 狂暴 / 爆炸 ====================
    // 声像：根据世界坐标在屏幕上的左右位置
    function panOf(x) {
        return Utils.clamp(((x - Utils.camera.x) / Renderer.width()) * 2 - 1, -1, 1) * 0.7;
    }

    function comboMultiplier() {
        return 1 + Math.min(combo, 40) * 0.05;
    }

    function addRage(amount) {
        if (!player || player.overdriveTimer > 0) return;
        const before = player.rage;
        player.rage = Math.min(100, player.rage + amount * (player.prog ? player.prog.rageMul : 1));
        if (before < 100 && player.rage >= 100 && !rageReadyAnnounced) {
            rageReadyAnnounced = true;
            FX.banner('怒气已满', { sub: '按 V 释放狂暴模式', color: '#ffb347', glow: '#ff5a1f', size: 40, y: 0.36, life: 1.6, channel: 'rage' });
            Audio.play('upgrade');
        }
    }

    function registerKill(enemy) {
        combo++;
        comboTimer = COMBO_WINDOW + (player.overdriveTimer > 0 ? 1 : 0);
        maxCombo = Math.max(maxCombo, combo);
        levelKills++;
        const call = COMBO_CALLS[combo] || (combo > 20 && combo % 10 === 0 ? `超神 ×${combo / 10}` : null);
        if (call) {
            const hot = combo >= 8;
            FX.banner(call, {
                sub: `${combo} 连击 · 分数 x${comboMultiplier().toFixed(2)}`,
                color: hot ? '#ffe14a' : '#ffffff',
                glow: hot ? '#ff4a1f' : '#4db8e8',
                size: hot ? 62 : 50,
                life: 1.3,
                channel: 'combo',
            });
            Audio.play('combo', Math.min(8, Math.floor(combo / 2)));
            if (combo >= 5) FX.slowMo(0.45, 0.18);
        }
    }

    function handleEnemyKilled(enemy) {
        enemy._killHandled = true;
        if (enemy.fellToAbyss) return;
        const cx = enemy.x, cy = enemy.y - enemy.h / 2;
        const dirX = enemy.deathAngle !== undefined ? Math.sign(Math.cos(enemy.deathAngle)) || 1 : (enemy.x > player.x ? 1 : -1);

        // 自爆兵：死亡瞬间引爆，可连锁炸死周围敌人
        if (enemy.type === 'kamikaze' && !enemy.exploded) {
            enemy.exploded = true;
            explodeAt(cx, cy, 120, enemy.damage, { hurtPlayer: true, source: 'kamikaze', scale: 1.1 });
        }
        if (enemy.selfDetonated) return; // 自爆兵冲脸自爆不算击杀

        // 视觉：肢体飞散 + 能量喷射 + 冲击环 + 光
        const isFlyer = ['flyer', 'drone', 'bomber', 'swooper'].includes(enemy.type);
        if (enemy.type !== 'turret' && !isFlyer) {
            FX.stickGibs(enemy.x, enemy.y, enemy.h, enemy.color, dirX, enemy._overkill ? 1.4 : 1);
        } else {
            Particles.spawnExplosion(cx, cy, 0.6);
        }
        Particles.spray(cx, cy, 16, enemy.color, enemy.deathAngle !== undefined ? enemy.deathAngle : -Math.PI / 2, 1.4, 150, 480, 0.4, 2.4);
        Particles.spray(cx, cy, 8, '#ffffff', enemy.deathAngle !== undefined ? enemy.deathAngle : -Math.PI / 2, 0.8, 300, 700, 0.18, 1.6);
        FX.shockwave(cx, cy, 70, '255,120,90', 4, 0.28);
        FX.light(cx, cy, 160, '255,120,70', 0.18, 0.5);
        FX.hitStop(0.045);
        Renderer.shake(4, 0.12);
        Audio.play('kill', panOf(enemy.x));

        registerKill(enemy);
        const mult = comboMultiplier();
        const value = Math.round(enemy.score * mult * (player.prog ? player.prog.orbMul : 1));
        if (player.prog && player.prog.regen > 0 && player.health < player.maxHealth) {
            player.health = Math.min(player.maxHealth, player.health + player.prog.regen);
        }
        const orbCount = Utils.clamp(Math.round(enemy.score / 25), 3, 7);
        FX.spawnOrbs(cx, cy, orbCount, Math.max(1, Math.round(value / orbCount)), 'score');
        if (Math.random() < 0.18 || (player.health < player.maxHealth * 0.35 && Math.random() < 0.35)) {
            FX.spawnOrbs(cx, cy, 1, 6, 'heal');
        }
        addRage(enemy.type === 'turret' ? 10 : 7);
        player.tryRecycleAmmo();

        // 掉落（略收敛，避免满屏装备）
        if (Math.random() < 0.22) {
            const types = Object.keys(WeaponData).filter(t => !['pistol', 'grenade', 'molotov', 'health', 'shield'].includes(t));
            drops.push(new WeaponDrop(enemy.x, enemy.y - 20, types[Utils.randInt(0, types.length - 1)]));
        }
        if (Math.random() < 0.13) {
            drops.push(new WeaponDrop(enemy.x, enemy.y - 20, Math.random() < 0.5 ? 'grenade' : 'molotov'));
        }
        if (Math.random() < 0.10) {
            drops.push(new WeaponDrop(enemy.x, enemy.y - 20, 'health'));
        }
        if (currentLevel >= 3 && Math.random() < 0.10) {
            drops.push(new WeaponDrop(enemy.x, enemy.y - 20, 'shield'));
        }
    }

    // 范围爆炸：伤害 + 击退 + 冲击波 + 焦痕
    function explodeAt(x, y, radius, damage, opts = {}) {
        const scale = opts.scale || radius / 110;
        Particles.spawnExplosion(x, y, Math.min(1.6, scale));
        FX.shockwave(x, y, radius * 1.3, '255,200,120', 10, 0.4);
        FX.scorch(x, y + 10, radius * 0.7);
        FX.hitStop(0.06);
        Renderer.shake(9 * Math.min(1.5, scale), 0.3);
        Renderer.addFlash('rgba(255, 190, 110, 0.22)', 0.6, 0.15);
        Audio.play(scale > 1.3 ? 'bigExplode' : 'explode', panOf(x));
        for (const e of enemies) {
            if (e.dead || e === opts.exclude) continue;
            const d = Utils.dist(x, y, e.x, e.y - e.h / 2);
            if (d < radius) {
                const dmg = Math.round(damage * (d < radius * 0.5 ? 1 : 0.6));
                const ang = Math.atan2(e.y - e.h / 2 - y, e.x - x);
                e.takeDamage(dmg, ang, 3.5 * (1 - d / radius) + 1);
                if (e.onGround) e.vy = -280;
                Particles.spawnDamageNum(e.x, e.y - e.h, dmg);
                addRage(dmg * 0.04);
            }
        }
        if (boss && !boss.dead && opts.source !== 'boss') {
            const d = Utils.dist(x, y, boss.x, boss.y - boss.h / 2);
            if (d < radius + boss.w * 0.5) {
                let dmg = damage * (d < radius * 0.5 ? 1 : 0.6) * (opts.bossMul || 1);
                if (boss.isVulnerable && boss.isVulnerable()) dmg *= player.upgradeStats.bossWeakDamageMul;
                boss.takeDamage(dmg);
                Particles.spawnDamageNum(boss.x, boss.y - boss.h, dmg);
            }
        }
        if (opts.hurtPlayer && player && !player.dead) {
            const d = Utils.dist(x, y, player.x, player.y - 25);
            if (d < radius) player.takeDamage(d < radius * 0.5 ? damage : damage * 0.6);
        }
    }

    function activateOverdrive() {
        if (!player || player.dead || player.rage < 100 || player.overdriveTimer > 0) return;
        player.rage = 0;
        rageReadyAnnounced = false;
        player.overdriveMax = OVERDRIVE_DURATION + (player.prog ? player.prog.odBonus : 0);
        player.overdriveTimer = player.overdriveMax;
        player.invincibleTimer = Math.max(player.invincibleTimer, 0.6);
        FX.slowMo(0.3, 0.55);
        FX.hitStop(0.08);
        FX.shockwave(player.x, player.y - 26, 300, '255,170,70', 14, 0.55);
        FX.shockwave(player.x, player.y - 26, 180, '255,255,220', 6, 0.35);
        FX.light(player.x, player.y - 26, 420, '255,140,40', 0.6, 0.9);
        Renderer.shake(12, 0.4);
        Renderer.addFlash('rgba(255, 170, 60, 0.45)', 0.9, 0.25);
        Audio.play('overdrive');
        FX.banner('狂暴模式', { sub: '伤害 ×1.5 · 攻速翻倍 · 子弹穿透 · 无限弹药', color: '#ffe14a', glow: '#ff3b1f', size: 64, life: 1.8, channel: 'rage' });
        Particles.spray(player.x, player.y - 26, 40, '#ffb347', 0, Math.PI * 2, 300, 800, 0.5, 2.6);
        // 释放瞬间震退并伤害周围敌人
        for (const e of enemies) {
            if (e.dead) continue;
            const d = Utils.dist(player.x, player.y, e.x, e.y);
            if (d < 260) {
                const ang = Math.atan2(e.y - e.h / 2 - (player.y - 26), e.x - player.x);
                e.takeDamage(40, ang, 4);
                if (e.onGround) e.vy = -320;
                Particles.spawnDamageNum(e.x, e.y - e.h, 40);
            }
        }
        if (boss && !boss.dead && Utils.dist(player.x, player.y, boss.x, boss.y) < 300) {
            boss.takeDamage(60);
            Particles.spawnDamageNum(boss.x, boss.y - boss.h, 60);
        }
    }

    function onOrbCollect(o) {
        if (!player) return;
        if (o.kind === 'heal') {
            player.health = Math.min(player.maxHealth, player.health + o.value);
            Particles.spawnAmmoText(player.x, player.y - 46, `+${o.value}`, '#5dff9e');
            Audio.play('orb', 12);
        } else {
            player.addScore(o.value);
            orbPitch = Math.min(orbPitch + 1, 14);
            orbPitchTimer = 0.5;
            Audio.play('orb', orbPitch);
        }
        Particles.spray(player.x, player.y - 26, 3, o.kind === 'heal' ? '#7dffb5' : '#ffd36b', -Math.PI / 2, 1.6, 60, 160, 0.25, 1.6);
    }

    function onPlayerHurt(amount) {
        FX.hitStop(0.06);
        Renderer.shake(7, 0.2);
        Renderer.addKick(0, 0.15);
        Renderer.addFlash('rgba(168, 48, 53, 0.3)', 0.8, 0.2);
        Particles.spawnDamageNum(player.x, player.y - 60, amount, {});
        comboTimer = Math.min(comboTimer, Math.max(0.6, comboTimer - 1.2));
        addRage(amount * 0.35);
    }

    // ==================== 评级 ====================
    const GRADE_ORDER = ['C', 'B', 'A', 'S'];
    function computeGrade() {
        const par = (levelData.levelWidth || 5000) / 70 + 45;
        const timeScore = Utils.clamp(1.35 - levelTime / par, 0, 1) * 35;
        const hpScore = Utils.clamp(1 - player.damageTaken / (player.maxHealth * 1.6), 0, 1) * 35;
        const comboScore = Utils.clamp(maxCombo / 14, 0, 1) * 30;
        const total = timeScore + hpScore + comboScore;
        const grade = total >= 82 ? 'S' : total >= 66 ? 'A' : total >= 48 ? 'B' : 'C';
        return { grade, total: Math.round(total) };
    }

    function getBestGrades() {
        try { return JSON.parse(localStorage.getItem('stickman_grades')) || {}; } catch { return {}; }
    }

    function saveBestGrade(levelIndex, grade) {
        try {
            const data = getBestGrades();
            const prev = data[levelIndex];
            if (!prev || GRADE_ORDER.indexOf(grade) > GRADE_ORDER.indexOf(prev)) {
                data[levelIndex] = grade;
                localStorage.setItem('stickman_grades', JSON.stringify(data));
                return true;
            }
        } catch { /* 存储不可用时忽略 */ }
        return false;
    }

    function gradeHTML(g, isNewBest) {
        return `<div class="grade-stamp grade-stamp--${g.grade}"><span class="grade-stamp__letter">${g.grade}</span><span class="grade-stamp__meta">评级 · 最高连击 ${maxCombo} · 击杀 ${levelKills} · 用时 ${Math.round(levelTime)}s${continuesUsed ? ' · 续关 ' + continuesUsed + ' 次' : ''}${isNewBest ? ' · <b>新纪录</b>' : ''}</span></div>`;
    }

    function showMenu(id) {
        const menuList = menus || document.querySelectorAll('.menu');
        menuList.forEach(menu => menu.classList.add('hidden'));
        if (id) $(id).classList.remove('hidden');
        document.body.classList.toggle('menu-open', !!id);
        if (ui && ui.mobileControls) ui.mobileControls.classList.add('hidden');
    }

    function hideAllMenus() {
        const menuList = menus || document.querySelectorAll('.menu');
        menuList.forEach(menu => menu.classList.add('hidden'));
        document.body.classList.remove('menu-open');
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
            { desc: '雨夜屋顶跑酷，新敌人「持盾兵」「狙击手」登场。', boss: '霓虹刺客·影刃' },
            { desc: '风沙废墟，断层与石柱，巨石从天而降。', boss: '沙暴巨像·法老之怒' },
            { desc: '终章：云海之上的浮空要塞，最强 Boss 等你挑战。', boss: '天穹审判者·终焉战舰' },
        ];
        
        const bestGrades = getBestGrades();
        // 生成关卡卡片
        Levels.forEach((level, index) => {
            const card = document.createElement('div');
            card.className = 'level-card';
            card.setAttribute('data-level', index);
            const unlocked = Progression.isUnlocked(currentPlayerName, index, bestGrades);
            card.onclick = () => {
                if (!unlocked) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); Audio.play('dry'); return; }
                Game.selectLevel(index);
            };
            if (!unlocked) card.classList.add('locked');
            
            const desc = levelDescs[index] || { desc: '未知关卡', boss: '未知Boss' };
            
            card.innerHTML = `
                <div class="level-card__scene" style="background-position: ${index % 3 * 50}% ${Math.floor(index / 3) * 50}%"></div>
                <div class="level-card__number">${index + 1}</div>
                ${!unlocked ? '<div class="level-card__lock">通关上一关解锁</div>' : ''}
                ${bestGrades[index] ? `<div class="level-card__grade grade--${bestGrades[index]}">${bestGrades[index]}</div>` : ''}
                <span class="level-card__name">${level.name}</span>
                <span class="level-card__desc">${desc.desc}</span>
                <div class="level-card__route">${level.sectors.length} 个区域 · ${level.enemies.length} 名敌人 · 扩展路线</div>
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
        // 出生点保护：若出生点下方没有平台（第五关原本会开局直接坠亡），补一个出生平台
        const sp = rawLevel.playerStart;
        const hasFloor = level.platforms.some(p => sp.x >= p.x && sp.x <= p.x + p.w && p.y >= sp.y - 10 && p.y < 600);
        if (!hasFloor) level.platforms.unshift({ x: Math.max(0, sp.x - 90), y: sp.y + 40, w: 200, h: 18 });
        level._rightEdge = Math.max(...level.platforms.map(p => p.x + p.w), rawLevel.levelWidth || 0);

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
        document.body.classList.add('in-game');
        requestLandscape();

        lastTime = performance.now();
        gameTime = 0;
        if (animFrame) cancelAnimationFrame(animFrame);
        animFrame = requestAnimationFrame(gameLoop);
    }

    function selectLevel(index) {
        showDifficultySelect(index);
    }

    let lastHudScore = -1;
    let lastHudHealth = -1;
    let lastHudWeaponLevel = -1;
    let lastHudActiveSlot = -1;

    function triggerPop(el) {
        if (!el) return;
        el.classList.remove('pop');
        void el.offsetWidth; // force reflow
        el.classList.add('pop');
        setTimeout(() => el.classList.remove('pop'), 450);
    }

    function updateHUD() {
        if (!player) return;
        ensureUIRefs();

        if (levelData && ui.routeFill) {
            const progress = Utils.clamp(player.x / (levelData.levelWidth - 100), 0, 1);
            ui.routeFill.style.width = `${progress * 100}%`;
            ui.routePercent.textContent = `${Math.floor(progress * 100)}%`;
            const sectors = levelData.sectors || [{ x: 0, name: '外围突破' }];
            let sector = 0;
            sectors.forEach((item, i) => { if (player.x >= item.x) sector = i; });
            ui.sectorLabel.textContent = `${sector + 1} / ${sectors.length} · ${sectors[sector].name}`;
            const remaining = enemies.filter(e => !e.dead);
            const nearest = remaining.reduce((best, e) => !best || Math.abs(e.x - player.x) < Math.abs(best.x - player.x) ? e : best, null);
            ui.enemyObjective.textContent = boss && !boss.dead ? '首领交战中 · 留意地面攻击预警'
                : nearest ? `剩余 ${remaining.length} 名敌人 · 最近目标 ${nearest.x < player.x ? '←' : '→'} ${Math.round(Math.abs(nearest.x - player.x) / 10)}m`
                : bossSpawned ? '区域威胁已清除' : '敌军已清除 · 前往首领决战区 →';
        }
        const hpPct = Math.max(0, (player.health / player.maxHealth) * 100);
        ui.healthBarFill.style.width = hpPct + '%';
        if (ui.healthChip) ui.healthChip.style.width = hpPct + '%';

        // 怒气条
        if (ui.rageFill) {
            const od = player.overdriveTimer > 0;
            const ragePct = od ? (player.overdriveTimer / (player.overdriveMax || OVERDRIVE_DURATION)) * 100 : player.rage;
            ui.rageFill.style.width = ragePct + '%';
            const rageLabel = od ? `狂暴中 ${player.overdriveTimer.toFixed(1)}s` : player.rage >= 100 ? '按 V 释放狂暴！' : `怒气 ${Math.floor(player.rage)}%`;
            if (ui.rageText.textContent !== rageLabel) ui.rageText.textContent = rageLabel;
            ui.rageBar.classList.toggle('ready', !od && player.rage >= 100);
            ui.rageBar.classList.toggle('active', od);
            document.body.classList.toggle('rage-ready', !od && player.rage >= 100);
        }

        // 连击面板
        if (ui.comboDisplay) {
            const show = combo >= 2;
            ui.comboDisplay.classList.toggle('hidden', !show);
            if (show) {
                if (ui.comboNum.textContent !== String(combo)) {
                    ui.comboNum.textContent = combo;
                    ui.comboNum.classList.remove('bump');
                    void ui.comboNum.offsetWidth;
                    ui.comboNum.classList.add('bump');
                }
                ui.comboMult.textContent = `分数 x${comboMultiplier().toFixed(2)}`;
                ui.comboTimerFill.style.width = Utils.clamp(comboTimer / COMBO_WINDOW, 0, 1) * 100 + '%';
                ui.comboDisplay.classList.toggle('tier-2', combo >= 5 && combo < 12);
                ui.comboDisplay.classList.toggle('tier-3', combo >= 12);
            }
        }
        const healthText = `${Math.ceil(player.health)} / ${player.maxHealth}`;
        if (ui.healthText.textContent !== healthText) {
            ui.healthText.textContent = healthText;
            if (Math.ceil(player.health) !== lastHudHealth) {
                triggerPop(ui.healthText);
                triggerPop(ui.healthBarFill.parentElement);
                lastHudHealth = Math.ceil(player.health);
            }
        }

        if (hpPct < 25) {
            ui.healthBarFill.style.background = 'linear-gradient(90deg, #a83035, #c05050)';
        } else if (hpPct < 50) {
            ui.healthBarFill.style.background = 'linear-gradient(90deg, #c07830, #d4953a)';
        } else {
            ui.healthBarFill.style.background = 'linear-gradient(90deg, #c05050, #d85050)';
        }

        if (player.score !== lastHudScore) {
            ui.scoreDisplay.textContent = `分数: ${player.score}`;
            triggerPop(ui.scoreDisplay);
            lastHudScore = player.score;
        }

        if (ui.difficultyDisplay) {
            const diffLabel = DIFFICULTY_CONFIG[currentDifficulty]?.label || '普通';
            ui.difficultyDisplay.textContent = diffLabel;
        }

        const slotWeaponNames = ['手枪', '霰弹枪', '冲锋枪', '激光枪', '火箭筒'];
        for (let i = 0; i < 5; i++) {
            const slot = ui.weaponSlots[i];
            if (!slot) continue;

            const weapon = player.weapons[i];
            const isActive = i === player.currentWeapon;
            slot.root.classList.toggle('active', isActive);
            if (isActive && i !== lastHudActiveSlot) {
                triggerPop(slot.root);
                lastHudActiveSlot = i;
            }
            if (weapon) {
                slot.name.textContent = weapon.name;
                slot.ammo.textContent = weapon.infinite ? '∞' : weapon.ammo;
            } else {
                slot.name.textContent = slotWeaponNames[i] || '—';
                slot.ammo.textContent = '';
            }
        }

        if (player.weapon) {
            const wlv = `Lv.${player.weapon.level}`;
            if (ui.currentWeaponLevel.textContent !== wlv) {
                ui.currentWeaponLevel.textContent = wlv;
                if (player.weapon.level !== lastHudWeaponLevel) {
                    triggerPop(ui.currentWeaponLevel);
                    lastHudWeaponLevel = player.weapon.level;
                }
            }
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
            if (ui.bossChip) ui.bossChip.style.width = bossPct + '%';
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
        if (ui.mUpgrade && Input.isTouch()) updateMobileContext();
    }

    // 手机端情境按钮：升级武器 / 护盾 / 投掷物切换（只在状态变化时改 DOM）
    let mCtxKey = '';
    function updateMobileContext() {
        const w = player.weapon;
        const maxed = !w || w.level >= w.maxLevel;
        const cost = w && !maxed ? w.getUpgradeCost() : 0;
        const can = !maxed && player.score >= cost;
        const isG = player.selectedThrown === 'grenade';
        const tCount = isG ? player.grenadeCount : player.molotovCount;
        const key = [maxed, cost, can, player.shieldStorage, player.shieldActive, isG, tCount].join('|');
        if (key === mCtxKey) return;
        mCtxKey = key;
        ui.mUpgrade.classList.toggle('is-ready', can);
        ui.mUpgrade.classList.toggle('is-max', maxed);
        ui.mUpgradeLabel.textContent = maxed ? '武器满级' : can ? '升级武器' : '升级';
        ui.mUpgradeCost.textContent = maxed ? '' : cost + '分';
        const showShield = player.shieldStorage > 0 && !player.shieldActive;
        ui.mShield.classList.toggle('hidden', !showShield);
        ui.mShieldCount.textContent = 'x' + player.shieldStorage;
        ui.mThrownName.textContent = isG ? '手雷' : '燃烧瓶';
        ui.mThrownCount.textContent = 'x' + tCount;
        ui.mThrown.classList.toggle('is-empty', tCount <= 0);
    }

    function typewriterLevelName(text) {
        if (!ui || !ui.levelName) return;
        ui.levelName.textContent = '';
        let i = 0;
        const speed = 45;
        function tick() {
            if (!ui.levelName) return;
            ui.levelName.textContent += text[i];
            i++;
            if (i < text.length) {
                setTimeout(tick, speed);
            }
        }
        tick();
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
        applyProgression(player);
        rewardGranted = false;
        enemies = levelData.enemies.map(enemy => new Enemy(enemy.x, enemy.y, { ...enemy }));
        boss = null;
        bossSpawned = false;
        bossWarningTimer = 0;
        bossAnnounceTimer = 0;
        highestSector = 0;
        arenaSweepDone = false;
        continuesUsed = 0;
        drops = levelData.weaponDrops.map(drop => new WeaponDrop(drop.x, drop.y, drop.type));

        Particles.clear();
        FX.clear();
        Renderer.generateBackground(levelData);
        Renderer.setAmbient(index);
        if (typeof GameArt !== 'undefined' && GameArt.prepareLevel) GameArt.prepareLevel(Levels[index].artIndex ?? index);
        combo = 0; comboTimer = 0; maxCombo = 0; levelKills = 0; levelTime = 0;
        orbPitch = 0; lastBossPhase = 0; bossChipPct = 100; rageReadyAnnounced = false;
        player.onHurt = onPlayerHurt;
        if (options.carryRage) player.rage = options.carryRage;
        Audio.startAmbient(index);

        // BGM 映射表
        const bgmMap = ['bgm_level1', 'bgm_level2', 'bgm_level3', 'bgm_level4', 'bgm_level5', 'bgm_level5', 'bgm_level3', 'bgm_level2', 'bgm_level5'];
        if (bgmMap[index]) {
            Audio.playBgm(bgmMap[index]);
        } else {
            Audio.stopBgm();
        }

        typewriterLevelName(levelData.name);
        ui.bossHealthContainer.classList.add('hidden');

        Utils.camera.x = 0;
        Utils.camera.y = 0;
    }

    // 手机瞄准：拖动右摇杆按方向瞄准；只按住不拖时自动锁定最近的敌人，没有敌人就朝移动方向
    let touchAimTarget = null;
    function updateTouchAim() {
        const ox = player.x, oy = player.y - (player.crouching ? 14 : 30);
        const aim = Input.getTouchAim();
        let tx, ty;
        if (aim.vec) {
            tx = ox + aim.vec.x * 420; ty = oy + aim.vec.y * 420;
            touchAimTarget = null;
        } else {
            const moveDir = Input.isDown('KeyA') ? -1 : Input.isDown('KeyD') ? 1 : 0;
            const viewW = Renderer.width(), viewH = Renderer.height();
            let best = null, bestScore = Infinity;
            const consider = (e, w) => {
                if (!e || e.dead || e.health <= 0) return;
                const cx = e.x, cy = e.y - (e.h || 60) / 2;
                const sx = cx - Utils.camera.x, sy = cy - Utils.camera.y;
                if (sx < -20 || sx > viewW + 20 || sy < -40 || sy > viewH + 40) return;
                const dx = cx - ox, dy = cy - oy;
                if (Math.abs(dx) > 760 || Math.abs(dy) > 420) return;
                let score = Math.hypot(dx, dy * 1.4) * w;
                if (moveDir && Math.sign(dx) !== moveDir) score += 260;          // 优先前进方向
                if (e === touchAimTarget) score *= 0.7;                          // 锁定粘滞，避免来回跳
                if (score < bestScore) { bestScore = score; best = e; }
            };
            for (const e of enemies) consider(e, 1);
            if (boss) consider(boss, 0.9);
            touchAimTarget = best;
            if (best) { tx = best.x; ty = best.y - (best.h || 60) / 2; }
            else { const dir = moveDir || player.facing || 1; tx = ox + dir * 420; ty = oy; }
        }
        Input.setAimOverride({ x: tx - Utils.camera.x, y: ty - Utils.camera.y });
    }

    function isPortraitTouch() {
        return document.body.classList.contains('touch-device') && window.innerHeight > window.innerWidth;
    }

    // 安卓浏览器支持全屏后锁定横屏；iOS / 微信不支持则静默跳过，由横屏提示引导
    function requestLandscape() {
        if (!document.body.classList.contains('touch-device')) return;
        if (/MicroMessenger|QQ\//i.test(navigator.userAgent)) return;
        try {
            const el = document.documentElement;
            const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignore */ } };
            if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lock).catch(() => {});
            else lock();
        } catch (e) { /* ignore */ }
    }

    function gameLoop(timestamp) {
        animFrame = requestAnimationFrame(gameLoop);

        Settings.tick((timestamp - lastTime) / 1000, state === 'playing');
        const realDt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;
        frameDt = realDt;

        let frozen = false;
        // 手机竖屏时暂停战斗，提示横屏（转回横屏自动继续）
        const portraitBlocked = isPortraitTouch();
        if (state === 'playing' && !portraitBlocked) {
            const dt = FX.stepTime(realDt);   // 顿帧时为 0，慢动作时缩放
            frozen = dt === 0;
            gameTime += dt;                   // 仅战斗中计时（修复：暂停/菜单不再计入）
            levelTime += dt;
            update(dt, realDt);
        } else {
            if (state === 'paused' && Input.wasPressed('Escape')) {
                resume();
            }
            FX.update(0, realDt, null, null, null);
        }

        render();
        // 顿帧期间保留按键输入，避免吞掉玩家操作
        if (!frozen) Input.endFrame();
    }

    function update(dt, realDt) {
        if (dt <= 0) {
            // 顿帧：世界冻结，仅屏幕层特效推进
            FX.update(0, realDt, null, null, null);
            return;
        }
        Input.update(dt);

        // ---- 狂暴 / 连击计时 ----
        if ((Input.wasPressed('KeyV') || Input.wasPressed('KeyX')) && player && !player.dead) {
            if (player.rage >= 100) activateOverdrive();
            else if (player.overdriveTimer <= 0) Particles.spawnAmmoText(player.x, player.y - 50, `怒气 ${Math.floor(player.rage)}%`, '#ffb347');
        }
        if (player.overdriveTimer > 0) {
            player.overdriveTimer -= dt;
            FX.setTint('255,120,30', 0.28);
            if (Math.random() < 0.5) Particles.spray(player.x + Utils.rand(-10, 10), player.y - Utils.rand(0, 50), 1, '#ffb347', -Math.PI / 2, 0.6, 60, 160, 0.4, 2);
            if (player.overdriveTimer <= 0) {
                player.overdriveTimer = 0;
                FX.setTint('255,120,30', 0);
                Particles.spawnAmmoText(player.x, player.y - 50, '狂暴结束', '#ffb347');
            }
        }
        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) {
                if (combo >= 5) Particles.spawnAmmoText(player.x, player.y - 60, `连击结束 ×${combo}`, '#8fd8ff');
                combo = 0;
            }
        }
        if (orbPitchTimer > 0) {
            orbPitchTimer -= dt;
            if (orbPitchTimer <= 0) orbPitch = 0;
        }

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
        if (Input.isTouch()) updateTouchAim();
        player.update(dt, levelData.platforms);
        // 关卡左右边界（修复：冲刺/走出关卡尽头会掉出地图直接死亡）
        const rightEdge = levelData._rightEdge - 16;
        if (player.x < 16) { player.x = 16; if (player.vx < 0) player.vx = 0; }
        if (player.x > rightEdge) { player.x = rightEdge; if (player.vx > 0) player.vx = 0; }

        const sectors = levelData.sectors || [];
        sectors.forEach((sector, i) => {
            if (i > highestSector && player.x >= sector.x) {
                highestSector = i;
                FX.banner(sector.name, { sub: (i === sectors.length - 1 ? '清除剩余敌人，准备首领战' : `${sector.rhythm || '深入区域'} · 前方设有补给`) + ' · 检查点已记录',
                    color: '#d9e9ee', glow: '#5f9aa7', size: 36, life: 1.8, channel: 'sector' });
            }
        });

        // 下砸冲击落地伤害
        if (player.groundPoundJustLanded) {
            player.groundPoundJustLanded = false;
            Renderer.shake(9, 0.25);
            Renderer.addKick(0, 0.35);
            Renderer.addFlash('rgba(212, 149, 58, 0.2)', 0.7, 0.25);
            Audio.play('slam');
            FX.hitStop(0.05);
            FX.shockwave(player.x, player.y, player.groundPoundRadius * 1.1, '255,180,90', 10, 0.35);
            FX.scorch(player.x, player.y + 4, 70);
            Particles.spray(player.x, player.y, 18, '#ffcc66', -Math.PI / 2, Math.PI, 200, 520, 0.35, 2);
            Particles.spawn(player.x, player.y, 20, '#ff9500', 350, 0.6, 5);
            const radius = player.groundPoundRadius;
            const damage = player.groundPoundDamage;
            for (const enemy of enemies) {
                if (enemy.dead) continue;
                const dist = Utils.dist(player.x, player.y, enemy.x, enemy.y);
                if (dist < radius) {
                    const dmg = Math.round(damage * (1 - dist / radius));
                    enemy.takeDamage(dmg, enemy.x > player.x ? -0.6 : Math.PI + 0.6, 2.5);
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
        const camMax = Math.max(levelData.cameraBounds.minX, Math.min(levelData.cameraBounds.maxX, levelData._rightEdge - Renderer.width() + 60));
        Utils.camera.x = Utils.clamp(Utils.camera.x, levelData.cameraBounds.minX, camMax);
        const targetY = player.y - Renderer.height() * 0.55;
        const smoothY = 1 - Math.pow(0.03, dt);
        Utils.camera.y = Utils.lerp(Utils.camera.y, Utils.clamp(targetY, -200, 200), smoothY);

        // 敌人
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (!enemy.dead && !enemy.activated) {
                if (Math.abs(enemy.x - player.x) > Math.max(900, enemy.aggroRange + 100)) continue;
                enemy.activated = true;
            }
            const alive = enemy.update(dt, levelData.platforms, player.x, player.y, enemies);
            if (!alive) {
                const last = enemies.pop();
                if (i < enemies.length) enemies[i] = last;
            }
        }

        for (const t of player.thrown) {
            if (t.type === 'grenade' && t.exploded && !t.dead) {
                explodeAt(t.x, t.y, t.radius, t.damage, { scale: t.radius / 110 });
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
        // 进入决战区：远远落在后方的掉队敌人（悬停飞行兵、卡在断层的步兵等）直接撤离，
        // 否则玩家必须折返上万像素去找它们，首领永远不出现。
        if (!bossSpawned && !arenaSweepDone && levelData.arenaStart && player.x >= levelData.arenaStart - 180) {
            arenaSweepDone = true;
            let retreated = 0;
            for (const e of enemies) {
                if (!e.dead && e.x < levelData.arenaStart - 900) {
                    e.dead = true; e.health = 0; e._killHandled = true; e.fellToAbyss = true;
                    retreated++;
                }
            }
            if (retreated) FX.banner('残敌撤退', { sub: `${retreated} 名掉队敌人已撤离 · 首领即将现身`, color: '#d9e9ee', glow: '#5f9aa7', size: 36, life: 1.8, channel: 'sector' });
        }
        if (!bossSpawned && enemies.length === 0 && !player.dead && player.x >= (levelData.arenaStart || 0) - 180) {
            if (bossWarningTimer === 0) {
                FX.setLetterbox(true);
                FX.banner('区域清空', { sub: '强敌正在逼近…', color: '#ffffff', glow: '#a83035', size: 40, y: 0.2, life: 1.6 });
            }
            bossWarningTimer += dt;

            // 璀﹀憡闃舵锛?绉掞級
            if (bossWarningTimer > 0 && bossWarningTimer < 2) {
                // 灞忓箷闂儊璀﹀憡鏁堟灉
                if (Math.sin(bossWarningTimer * 10) > 0) {
                    Renderer.shake(3, 0.05);
                    Renderer.addFlash('rgba(168, 48, 53, 0.08)', 0.5, 0.08);
                }
            }

            // 生成 Boss
            if (bossWarningTimer >= 2) {
                boss = new Boss(levelData.boss.x, levelData.boss.y, { ...levelData.boss });
                bossSpawned = true;
                bossAnnounceTimer = 3; // 显示3秒Boss出现提示
                lastBossPhase = 0;
                bossChipPct = 100;
                Audio.play('boss');
                Audio.play('bigExplode');
                Particles.spawnExplosion(levelData.boss.x, levelData.boss.y - 40, 1.5);
                FX.shockwave(levelData.boss.x, levelData.boss.y - 40, 420, '255,80,80', 12, 0.7);
                Renderer.shake(12, 0.5);
                Renderer.addFlash('rgba(168, 48, 53, 0.35)', 1.0, 0.35);
            }
        }

        // Boss
        if (boss) {
            const bossAlive = boss.update(dt, levelData.platforms, player.x, player.y);
            if (boss.phase > lastBossPhase && !boss.dead) {
                lastBossPhase = boss.phase;
                FX.hitStop(0.15);
                FX.slowMo(0.4, 0.5);
                FX.shockwave(boss.x, boss.y - boss.h / 2, 320, '255,60,60', 12, 0.5);
                Renderer.shake(12, 0.4);
                Renderer.addFlash('rgba(200, 40, 40, 0.3)', 0.8, 0.25);
                FX.banner(boss.phase >= 2 ? '狂怒形态' : '第二阶段', { sub: boss.name + (boss.phase >= 2 ? ' 进入最终阶段！' : ' 改变了攻势'), color: '#ff6b6b', glow: '#ff1f1f', size: 52, life: 1.6, channel: 'boss' });
            }
            if (boss.dead && !boss._killFxDone) {
                boss._killFxDone = true;
                FX.hitStop(0.22);
                FX.slowMo(0.22, 1.8);
                FX.shockwave(boss.x, boss.y - boss.h / 2, 600, '255,230,180', 18, 1.0);
                FX.shockwave(boss.x, boss.y - boss.h / 2, 360, '255,120,60', 10, 0.7);
                FX.light(boss.x, boss.y - boss.h / 2, 700, '255,200,120', 1.0, 1.0);
                Renderer.shake(18, 0.8);
                Renderer.addFlash('rgba(255, 245, 220, 0.8)', 1.0, 0.35);
                Audio.play('bigExplode');
                FX.banner('BOSS 击破', { sub: boss.name + ' 已被消灭', color: '#ffe14a', glow: '#ff7a1f', size: 70, life: 2.4, y: 0.32, channel: 'boss' });
                FX.spawnOrbs(boss.x, boss.y - boss.h / 2, 30, 10, 'score');
                FX.stickGibs(boss.x, boss.y, boss.h * 1.3, boss.color, 1, 1.6);
                FX.stickGibs(boss.x, boss.y, boss.h * 1.3, boss.accentColor || boss.color, -1, 1.6);
                registerKill(boss);
            }
            if (!bossAlive && boss.dead) {
                boss = null;
                player.addScore(Math.round(levelData.boss.score * comboMultiplier()));
                Audio.play('levelup');
                // Boss 击败音效映射表
                const BOSS_SOUNDS = {
                    0: 'bossExplode', 1: 'bossLaugh', 2: 'bossLuck',
                    3: 'bossRespect', 4: 'bossBad', 5: 'bossSurrender', 6: 'bossLaugh', 7: 'bossRespect', 8: 'bossSurrender'
                };
                const bossSound = BOSS_SOUNDS[currentLevel];
                if (bossSound) {
                    Audio.stopBgm();
                    // 不再放大音效母线（之前会让击杀 Boss 时所有音效突然变成 3 倍响）
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
            if (!drops[i].dead && distToPlayer < 38 && !player.dead && player.canAutoPickup(drops[i])) {
                player.pickupDrop(drops[i]);
                drops[i].dead = true;
            }
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
                Particles.spawnAmmoText(player.x, player.y - player.h - 14, `武器升级 Lv.${player.weapon.level}`, '#ffd36b');
            } else if (player.weapon && player.weapon.level < player.weapon.maxLevel) {
                Particles.spawnAmmoText(player.x, player.y - player.h - 14, `分数不足（需要 ${player.weapon.getUpgradeCost()}）`, '#ff8a8a');
                Audio.play('dry');
            }
        }

        // 碰撞检测：玩家子弹 vs 敌人 / 冰墙 / Boss
        for (let i = player.bullets.length - 1; i >= 0; i--) {
            const b = player.bullets[i];
            let consumed = false;
            const bAngle = Math.atan2(b.vy, b.vx);

            // vs 敌人
            for (const e of enemies) {
                if (e.dead) continue;
                if (b.hitIds && b.hitIds.includes(e)) continue;
                const er = e.getRect();
                if (b.x > er.x && b.x < er.x + er.w && b.y > er.y && b.y < er.y + er.h) {
                    // 持盾兵：正面护盾挡下子弹（爆炸 / 打头 / 绕背可破）
                    const headZone = b.y < er.y + er.h * 0.28;
                    if (e.type === 'shielder' && e.shieldHP > 0 && !b.explosion && !headZone && b.vx * e.facing < 0) {
                        e.shieldHP -= b.damage;
                        e.shieldFlash = 1;
                        e.kbx += Math.sign(b.vx) * 40;
                        Particles.spray(b.x, b.y, 6, '#9fe8ff', bAngle + Math.PI, 1.0, 160, 360, 0.2, 1.6);
                        Audio.play('shieldBlock', panOf(b.x));
                        if (e.shieldHP <= 0) {
                            e.shieldHP = 0;
                            Particles.spray(e.x + e.facing * 14, e.y - 24, 18, '#7ce7ff', -Math.PI / 2, Math.PI * 1.4, 120, 380, 0.5, 2.5, 'square');
                            FX.shockwave(e.x + e.facing * 14, e.y - 24, 60, '124,231,255', 4, 0.3);
                            Particles.spawnAmmoText(e.x, e.y - e.h - 10, '护盾破碎', '#7ce7ff');
                            Audio.play('impact_armor', panOf(b.x));
                            FX.hitStop(0.04);
                        } else if (Math.random() < 0.15) {
                            Particles.spawnAmmoText(e.x, e.y - e.h - 6, '格挡', '#9fe8ff');
                        }
                        if (b.pierce > 0) { b.pierce = 0; }
                        consumed = true;
                        break;
                    }
                    // 爆头（上 28%）与随机暴击
                    const headshot = headZone && !b.explosion;
                    const crit = Math.random() < 0.1 + (player.prog ? player.prog.critBonus : 0);
                    const dmg = b.damage * (headshot ? 1.6 : 1) * (crit ? 2 : 1);
                    const hpBefore = e.health;
                    const feel = player.weapon ? WEAPON_FEEL[player.weapon.type] : null;
                    const knock = b.explosion ? 3 : (feel ? feel.kick : 0.05) * 10 + 0.6;
                    e.takeDamage(dmg, bAngle, knock);
                    player.stagnationTimer = Math.min(player.stagnationTimer, 0.5);   // 原地交火打中目标不算“停滞”
                    if (e.dead && dmg > hpBefore * 2) e._overkill = true;
                    Particles.spawnHitImpact(b.x, b.y, bAngle + Math.PI);
                    Particles.spawnDamageNum(b.x, b.y - er.h / 2, dmg, { crit, headshot });
                    Audio.play(headshot ? 'impact_headshot' : crit ? 'impact_crit' : 'impact_' + (b.wtype || 'pistol'), panOf(b.x));
                    if (crit || headshot) {
                        FX.hitStop(0.025);
                        FX.light(b.x, b.y, 90, '255,230,120', 0.1, 0.6);
                    }
                    addRage(dmg * 0.045);
                    if (b.explosion) {
                        explodeAt(b.x, b.y, 95, b.damage * 0.6, { exclude: e, scale: 1 });
                    }
                    player.addScore(5);
                    if (b.pierce > 0 && !b.explosion) {
                        b.pierce--;
                        b.hitIds = b.hitIds || [];
                        b.hitIds.push(e);
                        b.damage *= 0.85;
                        continue;
                    }
                    consumed = true;
                    break;
                }
            }

            if (!consumed && boss && boss.hazards) {
                for (const h of boss.hazards) {
                    if (h.type !== 'ice_wall') continue;
                    const hr = { x: h.x - h.w / 2, y: h.y - h.h, w: h.w, h: h.h };
                    if (b.x > hr.x && b.x < hr.x + hr.w && b.y > hr.y && b.y < hr.y + hr.h) {
                        h.health -= b.damage * (b.explosion ? 2.5 : 1);
                        Audio.play('impact_armor', panOf(b.x));
                        Particles.spawnSparks(b.x, b.y, 6);
                        Particles.spray(b.x, b.y, 5, '#cfefff', bAngle + Math.PI, 1.2, 100, 260, 0.3, 2, 'square');
                        consumed = true;
                        break;
                    }
                }
            }

            // vs Boss
            if (!consumed && boss && !boss.dead) {
                const br = boss.getRect();
                if (b.x > br.x && b.x < br.x + br.w && b.y > br.y && b.y < br.y + br.h) {
                    const crit = Math.random() < 0.1 + (player.prog ? player.prog.critBonus : 0);
                    let bossDamage = b.damage * (crit ? 2 : 1);
                    const weak = boss.isVulnerable && boss.isVulnerable();
                    if (weak) bossDamage *= player.upgradeStats.bossWeakDamageMul;
                    boss.takeDamage(bossDamage);
                    player.stagnationTimer = Math.min(player.stagnationTimer, 0.5);   // 原地交火打中目标不算“停滞”
                    Particles.spawnHitImpact(b.x, b.y, bAngle + Math.PI);
                    Particles.spawnDamageNum(b.x, b.y - 15, bossDamage, { crit, weak });
                    Audio.play(crit ? 'impact_crit' : 'impact_armor', panOf(b.x));
                    if (crit) FX.hitStop(0.02);
                    addRage(bossDamage * 0.03);
                    if (b.explosion) {
                        explodeAt(b.x, b.y, 95, b.damage * 0.4, { scale: 1 });
                    }
                    consumed = true;
                }
            }

            if (consumed) {
                Particles.spawnSparks(b.x, b.y, 3);
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
        if (player.dead && !player._deathFx) {
            player._deathFx = true;
            FX.slowMo(0.3, 1.2);
            FX.setTint('255,120,30', 0);
            Renderer.shake(10, 0.4);
            FX.stickGibs(player.x, player.y, 52, '#9fe8ff', player.facing, 1.1);
        }
        if (player.dead && player.deathTimer > 1.5) {
            FX.setLetterbox(false);
            state = 'dead';
            showMenu('death-menu');
            const final = calculateFinalScore(player, levelTime, currentLevel);
            recordScore(currentLevel, final);
            const diffLabel = DIFFICULTY_CONFIG[currentDifficulty]?.label || '普通';
            const diffText = final.diffBonus !== 0 ? ` | 难度加成: 基础×${final.baseScoreMul} 奖励×${final.bonusMul} ${final.diffBonus > 0 ? '(+' + final.diffBonus + ')' : '(' + final.diffBonus + ')'}` : '';
            const deathReward = grantRewards({ grade: null, bossKilled: false, clearedLevel: null });
            const cpBtn = $('checkpoint-btn');
            if (cpBtn) cpBtn.textContent = `从检查点继续 · ${checkpointName()}`;
            ui.deathInfo.innerHTML = rewardHTML(deathReward) + `<span class="result-stats">关卡: ${levelData.name}<br>特工: ${currentPlayerName} · ${diffLabel}<br>基础得分: ${final.baseScore} | 血量奖励: ${final.healthBonus} | 时间奖励: ${final.timeBonus}${diffText}<br></span><strong style="color:var(--gold)">总积分: ${final.total}</strong>`;
        }

        // 暂停
        if (Input.wasPressed('Escape')) {
            if (state === 'playing') {
                state = 'paused';
                Audio.play('pause');
                showMenu('pause-menu');
            }
        }

        // 击杀结算（每个敌人只结算一次）
        if (player && !player.dead) {
            for (const e of enemies) {
                if (e.dead && !e._killHandled) handleEnemyKilled(e);
            }
        }

        // 粒子 / 特效更新
        Particles.update(dt);
        FX.update(dt, realDt, levelData.platforms, player, onOrbCollect);

        // Boss 鍑虹幇鍏憡璁℃椂
        if (bossAnnounceTimer > 0) {
            bossAnnounceTimer = Math.max(0, bossAnnounceTimer - dt);
            if (bossAnnounceTimer <= 0.6) FX.setLetterbox(false);
        }

        // HUD
        updateHUD();
    }

    // ---- 渲染 ----
    function render() {
        ctx = Renderer.ctx();
        if (!ctx) return;

        const shakeApplied = Renderer.applyShake(frameDt);
        Renderer.updateFlash(frameDt);
        Renderer.updateTransition(frameDt);
        Renderer.updateAudioPulse(frameDt);

        if (levelData) {
            Renderer.drawBackground(levelData, gameTime);
            Renderer.drawPlatforms(levelData);
            GameArt.drawWorldDetails(ctx, levelData, enemies, boss, player, gameTime);
            FX.drawUnder(ctx);
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

            GameArt.drawForeground(ctx, levelData, gameTime);
            Particles.draw(ctx);
            FX.drawOver(ctx);
            Particles.drawTexts(ctx);
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

        if (levelData) FX.drawScreen(ctx, Renderer.width(), Renderer.height());
        Renderer.drawFlash();
        Renderer.drawAudioPulse();
        Renderer.drawTransition();
        if (shakeApplied) Renderer.endShake();
    }

    function drawCrosshair() {
        const mouse = Input.getMouse();
        const mx = mouse.x, my = mouse.y;
        const recoil = player ? player.recoil : 0;
        const size = 8 + recoil * 6;
        const gap = 4 + recoil * 6;
        const pulse = 1 + Math.sin(gameTime * 8) * 0.12;

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

        const dotColor = player && player.overdriveTimer > 0 ? '#ffb347' : '#e74c3c';
        ctx.fillStyle = dotColor;
        ctx.shadowColor = dotColor;
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
        ctx.fillStyle = 'rgba(200, 48, 48, 0.15)';
        ctx.fillRect(0, centerY - 80, Renderer.width(), 160);

        // Warning triangle icon
        ctx.save();
        ctx.translate(centerX, centerY - 60);
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(24, 16);
        ctx.lineTo(-24, 16);
        ctx.closePath();
        ctx.fillStyle = '#d85050';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Exclamation mark
        ctx.fillStyle = '#000';
        ctx.fillRect(-2, -14, 4, 12);
        ctx.beginPath();
        ctx.arc(0, 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.font = 'bold 42px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#d85050';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText('BOSS 即将出现!', centerX, centerY);
        ctx.fillText('BOSS 即将出现!', centerX, centerY);

        ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#d0a0a0';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText('准备战斗!', centerX, centerY + 45);
        ctx.fillText('准备战斗!', centerX, centerY + 45);

        ctx.restore();
    }

    function drawBossAnnounce() {
        const W = Renderer.width(), H = Renderer.height();
        const t = 3 - bossAnnounceTimer;               // 0 → 3
        const slideIn = Math.min(1, t / 0.35);
        const ease = 1 - Math.pow(1 - slideIn, 3);
        const fade = bossAnnounceTimer < 0.5 ? bossAnnounceTimer / 0.5 : 1;
        const cy = H * 0.5;

        ctx.save();
        if (t < 0.25) {
            ctx.fillStyle = `rgba(200, 40, 40, ${(0.25 - t) * 1.6})`;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.globalAlpha = fade;
        // 斜切名牌
        const bandH = 120;
        const offset = (1 - ease) * W;
        ctx.fillStyle = 'rgba(6, 8, 14, 0.82)';
        ctx.beginPath();
        ctx.moveTo(offset + 0, cy - bandH / 2);
        ctx.lineTo(offset + W, cy - bandH / 2 - 26);
        ctx.lineTo(offset + W, cy + bandH / 2 - 26);
        ctx.lineTo(offset + 0, cy + bandH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = boss.color || '#e03030';
        ctx.fillRect(0, cy + bandH / 2 - 4 - (1 - ease) * 30, W * ease, 4);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 16px "Orbitron", "Noto Sans SC", sans-serif';
        ctx.fillStyle = '#ff8080';
        ctx.fillText('— WARNING · 目标威胁 —', W / 2 - offset * 0.3, cy - 40);
        const nameScale = 1 + Math.max(0, 0.3 - t) * 1.5;
        ctx.save();
        ctx.translate(W / 2 + offset * 0.6, cy + 4);
        ctx.scale(nameScale, nameScale);
        ctx.font = '900 58px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#000';
        ctx.strokeText(boss.name, 0, 0);
        ctx.shadowColor = boss.color || '#e03030';
        ctx.shadowBlur = 26;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(boss.name, 0, 0);
        ctx.restore();
        ctx.font = '700 14px "Noto Sans SC", sans-serif';
        ctx.fillStyle = 'rgba(230, 236, 255, 0.8)';
        ctx.fillText(`HP ${Math.round(boss.maxHealth)} · 击破它即可突围`, W / 2 + offset, cy + 44);
        ctx.restore();
    }

    // ---- 鍏紑鏂规硶 ----
    function start() {
        showDifficultySelect(0);
    }

    function resume() {
        Audio.play('unpause');
        state = 'playing';
        hideAllMenus();
    }

    function restart() {
        hideAllMenus();
        clearPendingTransition();
        state = 'transition';
        Renderer.startTransition('scanline', 0.7);
        const token = transitionToken;
        pendingTransitionTimeout = setTimeout(() => {
            pendingTransitionTimeout = null;
            if (token !== transitionToken) return;
            carryOverScore = 0;
            gameTime = 0;
            loadLevel(currentLevel);
            state = 'playing';
        }, 350);
    }

    // ==================== 检查点：死亡后从最近到达的区域复活 ====================
    function checkpointName() {
        if (!levelData) return '';
        if (bossSpawned) return '首领决战区';
        const sectors = levelData.sectors || [];
        return highestSector > 0 && sectors[highestSector] ? sectors[highestSector].name : '关卡起点';
    }

    function checkpointPosition() {
        const sectors = levelData.sectors || [];
        let x = levelData.playerStart.x;
        if (bossSpawned && levelData.arenaStart) x = levelData.arenaStart + 120;
        else if (highestSector > 0 && sectors[highestSector]) x = sectors[highestSector].x + 60;
        // 找脚下的地面（优先厚地面，其次最高的平台）
        const under = levelData.platforms.filter(p => x >= p.x + 10 && x <= p.x + p.w - 10 && p.y < 620);
        under.sort((a, b) => ((b.h > 50) - (a.h > 50)) || (a.y - b.y));
        const y = under.length ? under[0].y - 2 : levelData.playerStart.y;
        return { x, y };
    }

    function continueFromCheckpoint() {
        if (!player || state !== 'dead') return;
        const cp = checkpointPosition();
        player.dead = false;
        player.deathTimer = 0;
        player._deathFx = false;
        player.health = player.maxHealth;
        player.x = cp.x; player.y = cp.y;
        player.vx = 0; player.vy = 0;
        player.invincibleTimer = 2.5;
        player.stagnationTimer = 0;
        player.overdriveTimer = 0;
        player.groundPounding = false;
        player.bullets = [];
        // 复活代价：本次死亡前的收益已在死亡时结算；评级按“受伤”计入
        player.earned = 0;
        player.damageTaken += player.maxHealth * 0.5;
        rewardGranted = false;
        continuesUsed++;
        // 清掉场上敌方子弹和首领地面攻击，避免复活瞬间被秒
        for (const e of enemies) e.bullets.length = 0;
        if (boss) { boss.bullets.length = 0; if (boss.hazards) boss.hazards.length = 0; boss.windup = null; }
        // 把贴身的敌人推开一点
        for (const e of enemies) {
            if (!e.dead && Math.abs(e.x - cp.x) < 220) e.x = cp.x + (e.x >= cp.x ? 260 : -260);
        }
        Utils.camera.x = cp.x - Renderer.width() * 0.35;
        FX.setTint('255,120,30', 0);
        FX.shockwave(cp.x, cp.y - 26, 120, '124,231,255', 6, 0.5);
        FX.banner('检查点复活', { sub: `${checkpointName()} · 第 ${continuesUsed} 次续战`, color: '#d9f6ff', glow: '#4db8e8', size: 40, life: 1.6, channel: 'sector' });
        Audio.play('upgrade');
        hideAllMenus();
        state = 'playing';
    }

    // restartLevel 与 restart 逻辑完全一致，作为别名保留兼容
    const restartLevel = restart;

    function nextLevel() {
        if (currentLevel < Levels.length - 1 && !selectedUpgradeThisReward) return;
        hideAllMenus();
        if (currentLevel < Levels.length - 1) {
            Renderer.startTransition('scanline', 0.9);
            const prevScore = player ? player.score : 0;
            const prevRage = player ? player.rage : 0;
            const nextIdx = currentLevel + 1;
            clearPendingTransition();
            state = 'transition';
            const token = transitionToken;
            pendingTransitionTimeout = setTimeout(() => {
                pendingTransitionTimeout = null;
                if (token !== transitionToken) return;
                healthBonus += 20;
                carryOverScore = prevScore;
                currentLevel = nextIdx;
                loadLevel(currentLevel, { carryOverScore, carryRage: prevRage });
                state = 'playing';
            }, 450);
        } else {
            showVictory();
        }
    }

    function showLevelComplete() {
        state = 'levelComplete';
        FX.setTint('255,120,30', 0);
        FX.setLetterbox(false);
        showMenu('level-complete-menu');
        ui.levelCompleteTitle.textContent = `${levelData.name} 通过!`;
        const final = calculateFinalScore(player, levelTime, currentLevel);
        const diffLabel = DIFFICULTY_CONFIG[currentDifficulty]?.label || '普通';
        const diffText = final.diffBonus !== 0 ? ` | 难度加成: 基础×${final.baseScoreMul} 奖励×${final.bonusMul} ${final.diffBonus > 0 ? '(+' + final.diffBonus + ')' : '(' + final.diffBonus + ')'}` : '';
        const grade = computeGrade();
        const isNewBest = saveBestGrade(currentLevel, grade.grade);
        const lcReward = grantRewards({ grade: grade.grade, bossKilled: true, clearedLevel: currentLevel });
        ui.levelCompleteInfo.innerHTML = gradeHTML(grade, isNewBest) + rewardHTML(lcReward) + `<span class="result-stats">特工: ${currentPlayerName} · ${diffLabel}<br>当前累计得分: ${final.baseScore} | 血量奖励: ${final.healthBonus} | 时间奖励: ${final.timeBonus}${diffText}<br></span><strong style="color:var(--gold)">当前总积分: ${final.total}</strong><span class="result-stats"><br><span style="color:var(--muted);font-size:12px">进入下一关继续累计分数...</span></span>`;
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
        FX.setTint('255,120,30', 0);
        FX.setLetterbox(false);
        Audio.stopAmbient();
        Audio.play('victory');
        state = 'victory';
        showMenu('victory-menu');
        const final = calculateFinalScore(player, levelTime, currentLevel);
        recordScore(currentLevel, final);
        const diffLabel = DIFFICULTY_CONFIG[currentDifficulty]?.label || '普通';
        const diffText = final.diffBonus !== 0 ? ` | 难度加成: 基础×${final.baseScoreMul} 奖励×${final.bonusMul} ${final.diffBonus > 0 ? '(+' + final.diffBonus + ')' : '(' + final.diffBonus + ')'}` : '';
        const grade = computeGrade();
        const isNewBest = saveBestGrade(currentLevel, grade.grade);
        const vReward = grantRewards({ grade: grade.grade, bossKilled: true, clearedLevel: currentLevel });
        ui.victoryInfo.innerHTML = gradeHTML(grade, isNewBest) + rewardHTML(vReward) + `特工: ${currentPlayerName} · ${diffLabel}<br>基础得分: ${final.baseScore} | 血量奖励: ${final.healthBonus} | 时间奖励: ${final.timeBonus}${diffText}<br><strong style="color:var(--gold)">总积分: ${final.total}</strong><br>恭喜你击败了所有 Boss!`;
    }

    function backToTitle() {
        clearPendingTransition();
        Audio.stopAmbient();
        Audio.stopBgm();
        state = 'menu';
        FX.clear();
        levelData = null; // 清理渲染状态，避免菜单状态下无谓渲染
        player = null;
        enemies = [];
        boss = null;
        drops = [];
        hideAllMenus();
        showMenu('start-menu');
        ui.hud.classList.add('hidden');
        document.body.classList.remove('in-game');
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
        showGrowth, hideGrowth, buyUpgrade, continueFromCheckpoint,
        // 调试用（控制台可查看当前状态）
        _debug: () => ({ player, enemies, boss, state, combo, maxCombo, levelData, currentLevel, levelTime }),
    };
})();


