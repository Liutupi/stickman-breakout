# Generated art prompts

Generated with the built-in image_gen tool on 2026-10-09. Assets are project-local files; the game does not depend on a generation service at runtime. Original outputs are retained in Codex generated_images.

| Asset | Runtime use |
|---|---|
| assets/generated/environments-v2.png | Nine environment panoramas; 3 × 3 atlas, separate procedural depth layers |
| assets/generated/bosses-v2.png | Nine transparent Boss sprites; 3 × 3 atlas |
| assets/generated/enemies-v2.png | Seventeen transparent infantry/aircraft sprites; 6 × 3 atlas, final cell empty |
| assets/generated/hero-evolution-concepts.png | Six evolution illustrations in the growth center; 3 × 2 atlas. Gameplay uses animated IK limbs and attached armor in hero-appearance.js. |

Atlas dimensions are read from the actual files, rather than assumed from the prompts. Boss and enemy frames are normalized to alpha bounds at load time. Source crops use padding to avoid adjacent cells. Missing sprite images use the original vector drawing.

## Environment atlas

```text
Use case: stylized-concept
Asset type: production environment atlas for a side-scrolling stickman action game.
Create ONE 3072 x 1728 image with EXACTLY NINE equally sized landscape panels in a strict 3 by 3 grid. Each panel fills its 1024x576 cell edge to edge. No gutters, borders, labels, text, characters, HUD or logos. The nine scenes must be independent and must not cross cell boundaries.
Consistent premium 2.5D game art: sculpted low-poly forms, painted atmospheric depth, cinematic volumetric light, rich material surfaces, readable layered silhouettes, dark foreground and luminous distant landmarks. Straight horizontal side-on camera, no isometric top-down view. Bottom quarter subdued with no bright focal objects; space for gameplay sprites. Environment only, no playable platforms in the foreground.
Row 1 left to right: abandoned industrial foundry with teal haze and amber furnaces; ancient dark forest with enormous roots, jade bioluminescence and distant moonlight; volcanic cavern with basalt arches, rivers of molten orange lava and smoke.
Row 2 left to right: frozen mountain ruins with blue ice, aurora and deep crevasses; violet cosmic void with levitating fractured monoliths and a distant eclipse; crimson chaos citadel with shattered gothic spires, scarlet storm and golden energy.
Row 3 left to right: cyberpunk city rooftops in rain, cyan magenta neon and towering megastructures; desert pharaoh ruins with huge golden pyramids, weathered stone and dusty sunset; floating sky fortress above peach clouds, ivory and blue mechanical architecture with gold light.
Make the lighting beautifully dimensional and atmospheric. Each panorama should be suitable behind simple small game characters, with detailed scenery but clear value separation. Exact regular grid, no white margins.
```

## Boss atlas

```text
Use case: stylized-concept
Asset type: transparent production boss character sprite atlas for a side-scrolling stickman action game.
Create ONE 1536x1536 transparent PNG containing exactly NINE independent full-body boss characters in a perfectly regular 3x3 grid, each cell 512x512. Absolutely transparent background, no backdrop, ground, panels, frames, lettering, numbers, drop shadows or UI. Every character entirely inside its own cell, centered at x=256 in cell, feet at y=464, head or horn top near y=52, maximum silhouette width 420. Generous empty padding between characters. All full bodies and weapons visible; never overlap cell boundaries.
Cohesive premium 2.5D stylized game art: black slender stickman-like limbs and faceless round masked heads, surrounded by exquisitely sculpted angular armor, rich brushed metal, crisp rim lighting, hand-painted game illustration. Chunky readable silhouettes at small size, high contrast glowing eyes and energy core, left-facing three-quarter side combat stance. Not cute. Not photorealistic.
Exact cell order:
Top left: STEEL GUARDIAN, massive gunmetal mechanical shoulder plates, amber furnace chest and red visor, heavy hammer.
Top middle: SHADOW KING, slender black knight, jade eyes, thorn crown, torn emerald spectral cape and sickle.
Top right: INFERNO DEMON, obsidian armor, curling basalt horns, flaming orange core, enormous lava blade.
Middle left: FROST BEAST, bulky white and cobalt crystalline armor, ice antlers, clawed arms, icy blue core.
Middle middle: VOID LORD, slender black and violet mage with levitating crescent pauldrons, purple star core and orbital rings.
Middle right: CHAOS CREATOR, black and crimson warlord, radiant golden cracked core, six short floating blade shards.
Bottom left: NEON ASSASSIN, sleek black armor, cyan visor, magenta scarf, twin cyan and pink energy blades.
Bottom middle: SAND COLOSSUS, huge sandstone and gold pharaoh construct, lapis stripes, turquoise eyes, stone fists.
Bottom right: SKY JUDICATOR, ivory and navy armored automaton, gold halo, wide segmented mechanical wings, cyan reactor.
Consistent body scale within cells, premium polished silhouettes, all nine transparent isolated character sprites, exact regular layout.
```

## Infantry atlas

```text
Use case: stylized-concept
Asset type: transparent enemy sprite atlas for a premium 2.5D side-scrolling stickman shooter.
ONE 3072x1536 transparent PNG. STRICT 6 COLUMNS by 3 ROWS of equally sized 512x512 cells, exactly 17 full-body enemy sprites and the last cell EMPTY TRANSPARENT. Each sprite centered in its own cell, feet or bottom at cell y=460, top near y=75, contained within x=55..457. Do not overlap cells. No backdrop, ground, shadows, borders, frames, text, numbers or UI. Clear empty padding between cells.
Cohesive polished 2.5D sculpted game illustration, black thin stickman limbs, round black masked heads, compact dimensional brushed-metal armor, glowing colored visors, crisp rim light. Consistent left-facing three-quarter side combat view. Distinct READABLE silhouettes at tiny game size, dark armored foot soldiers and mechanical flying enemies; not cute, no photographic humans. Same game art universe as premium armored stickman bosses but less ornate, simple infantry shapes.
Exact order, left to right:
ROW 1: red armored rifleless patrol soldier; slender crimson speed runner with blade; amber rifle gunner; violet jumping trooper with spring boots; purple missile soldier with shoulder launcher; orange explosive trooper with round glowing bomb backpack.
ROW 2: cyan flying mechanical bat with two wings; orange broad heavy bomber drone with underside bomb pods; pink swept-wing diving drone; small teal quadrotor drone; red fixed heavy twin-barrel turret on tripod; blue heavy soldier holding large riot shield.
ROW 3: red sniper with long scoped rifle and dark hood; gold lancer with long energy spear; rose shotgun heavy soldier with chunky short shotgun; jade medic with cross-marked healing backpack; violet prism-shaped floating sentry drone; final bottom-right cell entirely transparent blank.
Keep all 17 independent complete sprites sharp and clean with consistent lighting and full weapons visible. Transparent alpha background everywhere around the sprites.
```

## Hero evolution concepts

```text
Use case: stylized-concept
Asset type: six character progression skins for the PLAYER hero of a 2.5D stickman action game, transparent PNG atlas.
ONE 1536x1024 transparent image with exactly 3 columns x 2 rows of equal 512x512 cells. One FULL BODY character in each cell, head near cell y=60, feet y=465, centered, all gear contained inside own cell, transparent margins. No background, text, numbers, frames, shadows, ground, weapons or guns.
All six are the SAME recognizable heroic stickman evolving through levels: smooth simple ROUND WHITE head with a narrow cyan visor, slim white stick limbs and visible elbow/knee joints, minimal black undersuit, an ice-blue scarf. Right-facing three-quarter side neutral combat-ready stance. Preserve round head and long slender stick limbs even at highest tier; never become a bulky humanoid robot or a human face. Premium sculpted 2.5D game illustration, brushed navy/ivory armor and luminous cyan, silver then gold highlights, legible clean shapes.
Exact order:
Top left: rookie, nearly bare white round head and thin white stick limbs, tiny dark tactical vest, short cyan scarf, simple dark boots.
Top middle: agile ranger, white round head, small cyan visor, light silver bracers, a longer blue scarf and single navy shoulder guard, slender white legs.
Top right: azure vanguard, round white head with partial silver helmet, symmetric compact navy/cyan shoulder plates, bright cyan chest core, forearm guards, still white thin legs.
Bottom left: star commander, round white mask, refined ivory/gold breastplate and pauldrons, long ice-blue scarf, golden accents on knees and cuffs, small cyan back fins.
Bottom middle: sky guardian, elegant ivory/silver armor over very slim stick frame, gold visor rim, two luminous cyan mechanical wing fins behind shoulders, cyan scarf and slim armored boots.
Bottom right: dawn legend, same ROUND WHITE head and visible slender stick limbs, magnificent ivory/gold armor, restrained golden halo, four slim radiant cyan/gold floating wing blades and a long flowing pale blue scarf, ultimate elegant heroic form.
Make the progression very clear through more beautiful gear and light, but preserve the iconic white stickman silhouette in all six cells. No text. True transparent alpha.
```


## Boss animation sheets

Nine transparent 4 × 4 sheets (144 poses total) were generated using the built-in image_gen tool, referencing the original Boss atlas. Runtime files are `assets/generated/boss-motion/*.png`. Exact per-sheet prompts, reference, original output paths and runtime destinations are preserved in [BOSS-MOTION-ASSETS.json](BOSS-MOTION-ASSETS.json). All originals are retained.

Animation uses a common scale based on each Boss’s idle frame: crouches remain shorter rather than being stretched to standing height. Alpha boundaries align feet, transparent row valleys protect against minor grid spacing drift. Each sheet supports running, preparation, strike, follow-through, jump, descent, landing, casting, hurt and recovery. The attack timeline determines which frame appears and when hitboxes or projectiles become active.
