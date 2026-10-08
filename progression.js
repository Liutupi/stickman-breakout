// ==================== 永久养成系统 ====================
// 每位特工（玩家代号）独立存档：金币、经验、永久强化等级、已通关关卡
const Progression = (() => {
    const KEY = 'stickman_progress';

    const UPGRADES = [
        { id: 'hp',      tag: '命', name: '生命强化', max: 10, base: 120, desc: l => `最大生命 +${l * 15}`,           next: '+15 最大生命' },
        { id: 'dmg',     tag: '攻', name: '火力强化', max: 10, base: 150, desc: l => `全部伤害 +${l * 6}%`,           next: '+6% 伤害' },
        { id: 'crit',    tag: '暴', name: '暴击训练', max: 10, base: 140, desc: l => `暴击率 ${10 + l * 2}%`,          next: '+2% 暴击率' },
        { id: 'rage',    tag: '怒', name: '怒气充能', max: 8,  base: 130, desc: l => `怒气获取 +${l * 10}%`,          next: '+10% 怒气获取' },
        { id: 'od',      tag: '狂', name: '狂暴延长', max: 5,  base: 200, desc: l => `狂暴时长 ${(7 + l * 0.7).toFixed(1)} 秒`, next: '+0.7 秒狂暴' },
        { id: 'dash',    tag: '冲', name: '疾风冲刺', max: 6,  base: 110, desc: l => `冲刺冷却 -${l * 7}%`,           next: '-7% 冲刺冷却' },
        { id: 'ammo',    tag: '弹', name: '弹药扩容', max: 8,  base: 100, desc: l => `弹药上限 +${l * 15}%`,          next: '+15% 弹药上限' },
        { id: 'magnet',  tag: '磁', name: '磁力晶片', max: 6,  base: 120, desc: l => `吸附范围 +${l * 20}% · 晶片价值 +${l * 6}%`, next: '+20% 吸附 · +6% 价值' },
        { id: 'grenade', tag: '雷', name: '战术背包', max: 5,  base: 160, desc: l => `开局手雷/燃烧瓶各 +${l}`,       next: '+1 手雷 +1 燃烧瓶' },
        { id: 'regen',   tag: '愈', name: '嗜血回复', max: 6,  base: 180, desc: l => `每次击杀回复 ${(l * 1.5).toFixed(1)} 生命`, next: '+1.5 击杀回血' },
    ];

    const RANKS = ['新兵', '列兵', '上等兵', '下士', '中士', '上士', '军士长', '少尉', '中尉', '上尉', '少校', '中校', '上校', '大校', '少将', '中将', '上将', '传奇特工'];

    // 特工等级解锁的开局装备
    const LOADOUT = [
        { level: 2, type: 'smg',     slot: 2, name: '冲锋枪' },
        { level: 4, type: 'shotgun', slot: 1, name: '霰弹枪' },
        { level: 6, type: 'laser',   slot: 3, name: '激光枪' },
        { level: 9, type: 'rocket',  slot: 4, name: '火箭筒' },
    ];

    const GRADE_COINS = { S: 160, A: 100, B: 60, C: 30 };

    function loadAll() {
        try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
    }
    function saveAll(all) {
        try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* 存储不可用时忽略 */ }
    }
    function get(name) {
        const all = loadAll();
        const p = all[name] || {};
        return {
            coins: p.coins || 0,
            xp: p.xp || 0,
            up: p.up || {},
            cleared: p.cleared || [],
            totalCoins: p.totalCoins || 0,
        };
    }
    function save(name, prog) {
        const all = loadAll();
        all[name] = prog;
        saveAll(all);
    }

    function cost(u, lvl) { return Math.round(u.base * Math.pow(1.45, lvl)); }

    // 经验 → 等级
    function xpForLevel(lvl) { return Math.round(400 * Math.pow(lvl, 1.35)); }   // 从 lvl 升到 lvl+1 所需
    function levelInfo(xp) {
        let lvl = 1, rest = xp;
        while (rest >= xpForLevel(lvl) && lvl < 99) { rest -= xpForLevel(lvl); lvl++; }
        return { level: lvl, cur: rest, need: xpForLevel(lvl), rank: RANKS[Math.min(RANKS.length - 1, lvl - 1)] };
    }

    // 汇总成战斗数值
    function stats(prog) {
        const l = id => prog.up[id] || 0;
        const lv = levelInfo(prog.xp).level;
        return {
            hp: l('hp') * 15,
            dmgMul: 1 + l('dmg') * 0.06,
            critBonus: l('crit') * 0.02,
            rageMul: 1 + l('rage') * 0.1,
            odBonus: l('od') * 0.7,
            dashMul: 1 - l('dash') * 0.07,
            ammoMul: 1 + l('ammo') * 0.15,
            magnetMul: 1 + l('magnet') * 0.2,
            orbMul: 1 + l('magnet') * 0.06,
            grenades: l('grenade'),
            regen: l('regen') * 1.5,
            loadout: LOADOUT.filter(o => lv >= o.level),
        };
    }

    function buy(name, id) {
        const prog = get(name);
        const u = UPGRADES.find(x => x.id === id);
        if (!u) return { ok: false };
        const lvl = prog.up[id] || 0;
        if (lvl >= u.max) return { ok: false, reason: 'max' };
        const c = cost(u, lvl);
        if (prog.coins < c) return { ok: false, reason: 'coins' };
        prog.coins -= c;
        prog.up[id] = lvl + 1;
        save(name, prog);
        return { ok: true, prog };
    }

    // 一局结束结算：返回奖励详情（含是否升级、解锁）
    function grant(name, { scoreGained, grade, bossKilled, clearedLevel }) {
        const prog = get(name);
        const before = levelInfo(prog.xp);
        const coins = Math.max(10, Math.round(scoreGained / 12)) + (grade ? GRADE_COINS[grade] || 0 : 0) + (bossKilled ? 80 : 0);
        const xp = Math.max(20, Math.round(scoreGained / 4)) + (bossKilled ? 150 : 0);
        prog.coins += coins;
        prog.totalCoins += coins;
        prog.xp += xp;
        if (clearedLevel !== undefined && clearedLevel !== null && !prog.cleared.includes(clearedLevel)) prog.cleared.push(clearedLevel);
        save(name, prog);
        const after = levelInfo(prog.xp);
        const unlocks = LOADOUT.filter(o => o.level > before.level && o.level <= after.level);
        return { coins, xp, before, after, leveledUp: after.level > before.level, unlocks, prog };
    }

    // 原有 6 关保持开放；新增关卡需通关上一关解锁
    const FREE_LEVELS = 6;
    function isUnlocked(name, levelIndex, grades) {
        if (levelIndex < FREE_LEVELS) return true;
        const prog = get(name);
        return prog.cleared.includes(levelIndex - 1) || !!(grades && grades[levelIndex - 1]);
    }

    return { UPGRADES, LOADOUT, RANKS, get, save, cost, levelInfo, stats, buy, grant, isUnlocked };
})();
