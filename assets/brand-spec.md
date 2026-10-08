# 果沐兄弟 · 火柴人：突围行动 — Brand Spec
> 采集日期：2026-05-10
> 资产来源：title-key-art-guomu.png 主色提取
> 资产完整度：部分（基于现有 key art 推断）

## 🎯 核心资产

### 主视觉
- 主视觉：`assets/title-key-art-guomu.png`（1672×941）
- 使用场景：Boot screen、Title scene 背景、宣传物料
- 色调：藏青夜空 + 冰蓝探照灯 + 琥珀地面反光

### Logo
- **当前缺失** — 建议补充 `assets/logo.svg`
- 方向建议：以火柴人剪影 + "果沐"篆刻感文字为基底

## 🎨 辅助资产

### 色板（基于 key art 提取）

| 角色 | 色值 | 来源 |
|------|------|------|
| Background | `#080e1a` | 夜空暗部 + 加蓝倾向 |
| Surface | `#0a1220` | 面板底色 |
| Primary (冰蓝) | `#4db8e8` | key art 探照灯主色降饱和 |
| Primary Strong | `#6dd0f5` | hover / glow 状态 |
| Accent (琥珀) | `#d4953a` | 地面反光/火花主色 |
| Danger (暗红) | `#a83035` | 机械兽眼睛/激光，更沉稳 |
| Success (墨绿) | `#4a9e78` | 平衡色，低饱和 |
| Text | `#eef5ff` | 偏冷白 |
| Muted | `#8494a8` | 偏冷灰 |

**旧色 → 新色映射**：
- `#00e5ff` (默认霓虹青) → `#4db8e8` (品牌冰蓝)
- `#c9a44b` (旧金) → `#d4953a` (琥珀金)
- `#c41e3a` (亮红) → `#a83035` (暗红)
- `#5eb896` (薄荷绿) → `#4a9e78` (墨绿)
- `#9b8ec4` (淡紫) → `#8a7ab0` (沉紫)

### 字型
- **Display / Title / Label**：`Orbitron`（英文）+ `Noto Sans SC`（中文）
  - 用于：菜单 kicker、HUD label、按键标签、难度统计
- **Body**：`Noto Sans SC` → `Microsoft YaHei` → 系统黑体栈
- **Mono**：`Orbitron` → `Consolas` → `monospace`（按键标签与数据）
- 加载源：Google Fonts CDN（`family=Orbitron:wght@400;500;600;700;800;900&family=Noto+Sans+SC:wght@400;500;700;900`）

### 签名细节
- **冰蓝 glow** 用于信息/科技类 UI（菜单边框、HUD 线框）
- **琥珀 glow** 用于奖励/升级/成就类 UI（武器 active、分数、升级卡）
- 暗红仅用于危险状态（血量低、Boss、死亡菜单）

### 禁区
- ❌ 不使用高饱和霓虹青 `#00e5ff` 作为主 accent（默认赛博 cliché）
- ❌ 不使用 emoji 作为功能性图标
- ❌ 不在所有 HUD 卡片上同时加闪烁动画
- ❌ 关卡颜色不跳跃使用洋红 `#ff00ff`

### 气质关键词
- 冷峻、精密、少年感、突围、暗夜行动
