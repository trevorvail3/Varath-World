/**
 * src/content/items.ts
 * --------------------
 * The full item registry, ported faithfully from the Varath idle game's
 * `ITEMS` table (+ `GOLD_VALUES` for sell prices). 467 items. Names,
 * descriptions, icons, categories and stats are copied verbatim.
 *
 * GENERATED from varath_21.html — see docs/CANON_LEDGER.md. `ironbark_shard` /
 * `heartoak_amber` fill two rare-drop refs the idle game left undefined.
 * Equippable gear declares a canon `slot` (mainhand/armor/helmet/…); see ItemDef.
 */

import type { ItemDef, ItemId } from "../core/types.ts";

export const items: Record<ItemId, ItemDef> = {
  "knucklestone_ore": {
    "id": "knucklestone_ore",
    "name": "Knucklestone",
    "description": "The most common stone of the Knuckle Hills. Soft and grey-brown, worked easily by any hand.",
    "icon": "🪨",
    "cat": "Ores",
    "sell": 3
  },
  "embercite_ore": {
    "id": "embercite_ore",
    "name": "Embercite",
    "description": "A dark, coal-black ore with a faint inner heat. Used as flux to smelt higher-quality metals. Without it, the metal runs too brittle.",
    "icon": "🪨",
    "cat": "Ores",
    "sell": 14
  },
  "ashiron_ore": {
    "id": "ashiron_ore",
    "name": "Ashiron",
    "description": "Heavy and grey with a faint metallic sheen. The first ore that feels like real metal in the hand.",
    "icon": "🪨",
    "cat": "Ores",
    "sell": 18
  },
  "ribstone_ore": {
    "id": "ribstone_ore",
    "name": "Ribstone",
    "description": "Dense, grey-brown stone from the Ribvault ridges. Believers say its hardness comes from sitting close to the bone.",
    "icon": "🪨",
    "cat": "Ores",
    "sell": 35
  },
  "spinite_ore": {
    "id": "spinite_ore",
    "name": "Spinite",
    "description": "Cold blue-grey ore cut from the Spine's own rock. Fractures true when the seam is sound. The metal between ribstone and bloodore — the one the old smiths kept for their own tools.",
    "icon": "🪨",
    "cat": "Ores",
    "sell": 60
  },
  "gold_ore": {
    "id": "gold_ore",
    "name": "Gold Ore",
    "description": "Soft and heavy. Too brittle for weaponry but essential to the jeweller's craft.",
    "icon": "🟡",
    "cat": "Ores",
    "sell": 30
  },
  "bloodore_ore": {
    "id": "bloodore_ore",
    "name": "Bloodore",
    "description": "Deep red-brown from its mineral content. Mined near the Redrun river. The myth follows the name everywhere.",
    "icon": "🪨",
    "cat": "Ores",
    "sell": 110
  },
  "hearthite_ore": {
    "id": "hearthite_ore",
    "name": "Hearthite",
    "description": "Jet black and almost warm to the touch — or so miners claim. The rarest ore in Varath. Cults gather near every known seam.",
    "icon": "🪨",
    "cat": "Ores",
    "sell": 280
  },
  "voidstone_ore": {
    "id": "voidstone_ore",
    "name": "Voidstone",
    "description": "A near-black ore from the deepest Marrow Deeps shafts. Cold to the touch despite the depth. Miners who spend long hours near it report unusual dreams.",
    "icon": "🪨",
    "cat": "Ores",
    "sell": 85
  },
  "knucklestone_bar": {
    "id": "knucklestone_bar",
    "name": "Knucklestone Bar",
    "description": "Brittle but workable. A beginner's first bar, smelted from the grey stone of the Knuckle Hills.",
    "icon": "▪️",
    "cat": "Bars",
    "sell": 12
  },
  "ashiron_bar": {
    "id": "ashiron_bar",
    "name": "Ashiron Bar",
    "description": "Solid grey iron. The backbone of a working warrior's first real equipment.",
    "icon": "▪️",
    "cat": "Bars",
    "sell": 60
  },
  "ribstone_bar": {
    "id": "ribstone_bar",
    "name": "Ribstone Bar",
    "description": "Dense and heavy in the hand. Difficult to work but worth the effort.",
    "icon": "▪️",
    "cat": "Bars",
    "sell": 120
  },
  "spinite_bar": {
    "id": "spinite_bar",
    "name": "Spinite Bar",
    "description": "Cold steel with a faint blue cast. Holds an edge longer than ribstone and takes a plate's shape without complaint. The mid-smith's workhorse.",
    "icon": "▪️",
    "cat": "Bars",
    "sell": 200
  },
  "gold_bar": {
    "id": "gold_bar",
    "name": "Gold Bar",
    "description": "A refined gold bar. The currency of fine craftwork — every ring and chain starts here.",
    "icon": "🟨",
    "cat": "Bars",
    "sell": 120
  },
  "bloodore_bar": {
    "id": "bloodore_bar",
    "name": "Bloodore Bar",
    "description": "Carries a reddish cast from the ore. Said by some to never fully cool, no matter how long it sits.",
    "icon": "▪️",
    "cat": "Bars",
    "sell": 350
  },
  "hearthite_bar": {
    "id": "hearthite_bar",
    "name": "Hearthite Bar",
    "description": "Black metal with a faint inner warmth. The finest material a smith of Varath can work.",
    "icon": "▪️",
    "cat": "Bars",
    "sell": 880
  },
  "voidstone_bar": {
    "id": "voidstone_bar",
    "name": "Voidstone Bar",
    "description": "Smelted voidstone. Cold, heavy, and dark. Takes Embercite to work. Smiths say it holds an edge unlike anything else.",
    "icon": "🔲",
    "cat": "Bars",
    "sell": 280
  },
  "pickaxe_1": {
    "id": "pickaxe_1",
    "name": "Knucklestone Pickaxe",
    "description": "Rough-forged from knucklestone. Gets the job done, slowly.",
    "icon": "⛏️",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "pickaxe",
    "tier": 1,
    "sell": 15
  },
  "pickaxe_3": {
    "id": "pickaxe_3",
    "name": "Ashiron Pickaxe",
    "description": "Ashiron head on a stonewood handle. A significant step up.",
    "icon": "⛏️",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "pickaxe",
    "tier": 3,
    "sell": 80
  },
  "pickaxe_4": {
    "id": "pickaxe_4",
    "name": "Ribstone Pickaxe",
    "description": "Heavy, dense, noticeably faster in the seam.",
    "icon": "⛏️",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "pickaxe",
    "tier": 4,
    "sell": 150
  },
  "pickaxe_5": {
    "id": "pickaxe_5",
    "name": "Goldbound Pickaxe",
    "description": "A ribstone head banded in gold. Rich man's steel — it bites clean and holds its edge.",
    "icon": "⛏️",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "pickaxe",
    "tier": 5,
    "sell": 290
  },
  "pickaxe_6": {
    "id": "pickaxe_6",
    "name": "Bloodore Pickaxe",
    "description": "The reddish head cuts through stone with unsettling ease.",
    "icon": "⛏️",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "pickaxe",
    "tier": 6,
    "sell": 420
  },
  "pickaxe_7": {
    "id": "pickaxe_7",
    "name": "Palesteel Pickaxe",
    "description": "Twice-forged bloodore, quenched pale. The Record's surveyors swear by them in the deeps.",
    "icon": "⛏️",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "pickaxe",
    "tier": 7,
    "sell": 700
  },
  "pickaxe_9": {
    "id": "pickaxe_9",
    "name": "Voidstone Pickaxe",
    "description": "Near-black, cold in the hand. The finest mineable pick before Hearthite.",
    "icon": "⛏️",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "pickaxe",
    "tier": 9,
    "sell": 840
  },
  "pickaxe_10": {
    "id": "pickaxe_10",
    "name": "Hearthite Pickaxe",
    "description": "Warm in the hand even in the deep cold. The finest pick in Varath.",
    "icon": "⛏️",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "pickaxe",
    "tier": 10,
    "sell": 1050
  },
  "hatchet_1": {
    "id": "hatchet_1",
    "name": "Knucklestone Hatchet",
    "description": "A crude hatchet. Works, but slowly.",
    "icon": "🪓",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "hatchet",
    "tier": 1,
    "sell": 15
  },
  "hatchet_3": {
    "id": "hatchet_3",
    "name": "Ashiron Hatchet",
    "description": "Splits most logs cleanly. A journeyman forester's companion.",
    "icon": "🪓",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "hatchet",
    "tier": 3,
    "sell": 80
  },
  "hatchet_4": {
    "id": "hatchet_4",
    "name": "Ribstone Hatchet",
    "description": "Heavy and reliable. Good for the denser timbers.",
    "icon": "🪓",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "hatchet",
    "tier": 4,
    "sell": 150
  },
  "hatchet_5": {
    "id": "hatchet_5",
    "name": "Goldbound Hatchet",
    "description": "A ribstone bit banded in gold. Swings true and never chips.",
    "icon": "🪓",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "hatchet",
    "tier": 5,
    "sell": 290
  },
  "hatchet_6": {
    "id": "hatchet_6",
    "name": "Bloodore Hatchet",
    "description": "The reddish edge bites deep. Ancient wood offers little resistance.",
    "icon": "🪓",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "hatchet",
    "tier": 6,
    "sell": 420
  },
  "hatchet_7": {
    "id": "hatchet_7",
    "name": "Palesteel Hatchet",
    "description": "Twice-forged bloodore, quenched pale. Fells old growth like young saplings.",
    "icon": "🪓",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "hatchet",
    "tier": 7,
    "sell": 700
  },
  "hatchet_9": {
    "id": "hatchet_9",
    "name": "Voidstone Hatchet",
    "description": "Dark and perfectly weighted. Deeproot yields to it easily.",
    "icon": "🪓",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "hatchet",
    "tier": 9,
    "sell": 840
  },
  "hatchet_10": {
    "id": "hatchet_10",
    "name": "Hearthite Hatchet",
    "description": "The finest felling tool made in Varath. Deeproot yields to it like softwood.",
    "icon": "🪓",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "hatchet",
    "tier": 10,
    "sell": 1050
  },
  "rod_1": {
    "id": "rod_1",
    "name": "Ashwood Rod",
    "description": "A simple ashwood rod. Slow, but it catches fish.",
    "icon": "🎣",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "rod",
    "tier": 1,
    "sell": 50
  },
  "rod_2": {
    "id": "rod_2",
    "name": "Coldpine Rod",
    "description": "Coldpine bends without snapping. Better casting, better catch.",
    "icon": "🎣",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "rod",
    "tier": 3,
    "sell": 120
  },
  "rod_3": {
    "id": "rod_3",
    "name": "Ruewood Rod",
    "description": "The red wood is oddly supple. Good for deep pools.",
    "icon": "🎣",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "rod",
    "tier": 4,
    "sell": 220
  },
  "rod_4": {
    "id": "rod_4",
    "name": "Reinforced Ashwood Rod",
    "description": "Ashwood braced with ashiron. Handles stronger fish with ease.",
    "icon": "🎣",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "rod",
    "tier": 6,
    "sell": 600
  },
  "rod_5": {
    "id": "rod_5",
    "name": "Reinforced Coldpine Rod",
    "description": "A coldpine rod reinforced with bloodore. Favored by serious anglers.",
    "icon": "🎣",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "rod",
    "tier": 9,
    "sell": 1000
  },
  "rod_6": {
    "id": "rod_6",
    "name": "Reinforced Ruewood Rod",
    "description": "Ruewood and voidstone. The finest fishing rod in Varath. Even the Eyeless Pike cannot resist it.",
    "icon": "🎣",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "rod",
    "tier": 10,
    "sell": 1800
  },
  "rod_gold": {
    "id": "rod_gold",
    "name": "Golden Rod of Varath",
    "description": "Solid gold, awarded to whoever holds the Drowned Pier's heaviest catch. It fishes no better than the finest rod — but everyone knows whose hands it belongs in. Lose your record and it passes to the new champion.",
    "icon": "🎣",
    "cat": "Tools",
    "slot": "mainhand",
    "tool": "rod",
    "tier": 10,
    "sell": 0
  },
  "plank_ashwood": {
    "id": "plank_ashwood",
    "name": "Ashwood Plank",
    "description": "Rough-sawn ashwood boards. The backbone of any basic build.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 8
  },
  "plank_briarwood": {
    "id": "plank_briarwood",
    "name": "Briarwood Plank",
    "description": "Dense-grained boards. Takes nails cleanly.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 18
  },
  "plank_coldpine": {
    "id": "plank_coldpine",
    "name": "Coldpine Plank",
    "description": "Clean, straight-grained softwood. Good for interior work.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 35
  },
  "plank_stonewood": {
    "id": "plank_stonewood",
    "name": "Stonewood Plank",
    "description": "Near-petrified boards. Used for load-bearing walls.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 65
  },
  "plank_greyoak": {
    "id": "plank_greyoak",
    "name": "Greyoak Plank",
    "description": "Hard-wearing and dense. The preferred wood of serious builders.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 110
  },
  "plank_ruewood": {
    "id": "plank_ruewood",
    "name": "Ruewood Plank",
    "description": "Ruddy-tinted boards. Unusually resilient to damp.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 180
  },
  "plank_ironbark": {
    "id": "plank_ironbark",
    "name": "Ironbark Plank",
    "description": "Unyielding and dense. Even a saw protests.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 145
  },
  "plank_heartoak": {
    "id": "plank_heartoak",
    "name": "Heartoak Plank",
    "description": "Rich amber boards, almost too beautiful to bury in a wall.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 260
  },
  "stone_block": {
    "id": "stone_block",
    "name": "Stone Block",
    "description": "Dressed knucklestone. The basic unit of any serious construction.",
    "icon": "🧱",
    "cat": "Materials",
    "sell": 15
  },
  "cut_coldvein": {
    "id": "cut_coldvein",
    "name": "Cut Coldvein",
    "description": "Trimmed coldvein stone. Harder wearing than knucklestone; used for walls.",
    "icon": "🧱",
    "cat": "Materials",
    "sell": 35
  },
  "cut_ribstone": {
    "id": "cut_ribstone",
    "name": "Cut Ribstone",
    "description": "Dense ribstone, shaped and faced. Believers say it sets harder because it knows what it once was.",
    "icon": "🪨",
    "cat": "Materials",
    "sell": 35
  },
  "ashiron_rivet": {
    "id": "ashiron_rivet",
    "name": "Ashiron Rivet",
    "description": "Iron fasteners for timber frames. Each upgrade needs a hundred of these.",
    "icon": "🔩",
    "cat": "Materials",
    "sell": 12
  },
  "mortar_basic": {
    "id": "mortar_basic",
    "name": "Basic Mortar",
    "description": "Ground limestone and ash. Binds stone well enough for a cottage.",
    "icon": "🪣",
    "cat": "Materials",
    "sell": 20
  },
  "mortar_refined": {
    "id": "mortar_refined",
    "name": "Refined Mortar",
    "description": "Finer grind, stronger bond. Mid-tier construction staple.",
    "icon": "🪣",
    "cat": "Materials",
    "sell": 45
  },
  "mortar_spinite": {
    "id": "mortar_spinite",
    "name": "Spinite Mortar",
    "description": "Ground spinite mixed with ash. Sets like iron. Required for large structures.",
    "icon": "🪣",
    "cat": "Materials",
    "sell": 90
  },
  "timber_frame": {
    "id": "timber_frame",
    "name": "Timber Frame",
    "description": "Pre-cut ashwood framing. Goes up fast.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 25
  },
  "stonewood_beam": {
    "id": "stonewood_beam",
    "name": "Stonewood Beam",
    "description": "Load-bearing timber. Required for stone house tiers and above.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 60
  },
  "watchtower_frame": {
    "id": "watchtower_frame",
    "name": "Watchtower Frame",
    "description": "The skeleton of a watchtower. Assembled from deep-cut stone and ironwood. The last serious construction project most men attempt.",
    "icon": "🗼",
    "cat": "Infrastructure",
    "sell": 1200
  },
  "vault_stone": {
    "id": "vault_stone",
    "name": "Vault Stone",
    "description": "Dressed spinite stone, precisely cut for load-bearing vault work. Requires a patient hand and steady tools.",
    "icon": "🏛️",
    "cat": "Infrastructure",
    "sell": 800
  },
  "heartoak_beam": {
    "id": "heartoak_beam",
    "name": "Heartoak Beam",
    "description": "Massive structural timber. Dense enough to hold a keep roof without bowing.",
    "icon": "🪵",
    "cat": "Infrastructure",
    "sell": 900
  },
  "ashwood_log": {
    "id": "ashwood_log",
    "name": "Ashwood Log",
    "description": "Pale and light. Common as dirt across Varath. Burns fast; works fast.",
    "icon": "🪵",
    "cat": "Logs",
    "sell": 5
  },
  "alder_log": {
    "id": "alder_log",
    "name": "Alderwood Log",
    "description": "Soft, russet timber from the streambanks. Catches a spark eagerly — a firemaker's first friend after ashwood.",
    "icon": "🪵",
    "cat": "Logs",
    "sell": 9
  },
  "birch_log": {
    "id": "birch_log",
    "name": "Silverbirch Log",
    "description": "Pale, paper-barked and clean-burning. The bark peels off in ribbons that light in a breath.",
    "icon": "🪵",
    "cat": "Logs",
    "sell": 16
  },
  "coldpine_log": {
    "id": "coldpine_log",
    "name": "Coldpine Log",
    "description": "Straight-grained highland timber. Smells sharp when freshly cut.",
    "icon": "🪵",
    "cat": "Logs",
    "sell": 25
  },
  "stonewood_log": {
    "id": "stonewood_log",
    "name": "Stonewood Log",
    "description": "Dense and heavy — sinks in water. Makes the toughest handles.",
    "icon": "🪵",
    "cat": "Logs",
    "sell": 50
  },
  "greyoak_log": {
    "id": "greyoak_log",
    "name": "Greyoak Log",
    "description": "Wide rings speak of a long life. Reliable and well-balanced.",
    "icon": "🪵",
    "cat": "Logs",
    "sell": 90
  },
  "ruewood_log": {
    "id": "ruewood_log",
    "name": "Ruewood Log",
    "description": "Deep red-brown heartwood. Sought by bowyers for its natural flex.",
    "icon": "🪵",
    "cat": "Logs",
    "sell": 155
  },
  "deeproot_log": {
    "id": "deeproot_log",
    "name": "Deeproot Log",
    "description": "Enormous and ancient. Its rings lose count. Taking one is not done lightly.",
    "icon": "🪵",
    "cat": "Logs",
    "sell": 395
  },
  "ironbark_log": {
    "id": "ironbark_log",
    "name": "Ironbark Log",
    "description": "Near-black bark, flesh like stone. Blunts axes and outlasts the men who fell it.",
    "icon": "🪵",
    "cat": "Logs",
    "sell": 120
  },
  "heartoak_log": {
    "id": "heartoak_log",
    "name": "Heartoak Log",
    "description": "Golden-amber wood. Found only in deep old-growth. A fallen one smells of honey and iron.",
    "icon": "🪵",
    "cat": "Logs",
    "sell": 220
  },
  "flint": {
    "id": "flint",
    "name": "Flint & Steel",
    "description": "A striker and a shard of flint. Strike it against a log to set a fire. Doesn't wear out.",
    "icon": "🔥",
    "cat": "Tools",
    "sell": 15
  },
  "ashwood_shaft": {
    "id": "ashwood_shaft",
    "name": "Ashwood Shaft",
    "description": "A simple arrow shaft. Light, straight, and disposable.",
    "icon": "🥢",
    "cat": "Materials",
    "sell": 6
  },
  "coldpine_shaft": {
    "id": "coldpine_shaft",
    "name": "Coldpine Shaft",
    "description": "The preferred shaft for most archers. Straight-grained and consistent.",
    "icon": "🥢",
    "cat": "Materials",
    "sell": 28
  },
  "greyoak_shaft": {
    "id": "greyoak_shaft",
    "name": "Greyoak Shaft",
    "description": "A reliable mid-range shaft. Even grain makes for predictable flight.",
    "icon": "🥢",
    "cat": "Materials",
    "sell": 55
  },
  "ruewood_shaft": {
    "id": "ruewood_shaft",
    "name": "Ruewood Shaft",
    "description": "Dense and heavy. Carries more force on impact.",
    "icon": "🥢",
    "cat": "Materials",
    "sell": 90
  },
  "deeproot_shaft": {
    "id": "deeproot_shaft",
    "name": "Deeproot Shaft",
    "description": "The finest shaft in Varath. Each one is worth something.",
    "icon": "🥢",
    "cat": "Materials",
    "sell": 230
  },
  "stonewood_haft": {
    "id": "stonewood_haft",
    "name": "Stonewood Haft",
    "description": "A dense handle blank for hafted weapons. Heavy but enduring.",
    "icon": "🥢",
    "cat": "Materials",
    "sell": 60
  },
  "crude_shortbow": {
    "id": "crude_shortbow",
    "name": "Ashwood Shortbow",
    "description": "Cut from green ashwood and strung tight. Every archer starts here.",
    "icon": "🏹",
    "cat": "Weapons",
    "slot": "mainhand",
    "ranged": true,
    "twoHand": true,
    "equipLevel": 1,
    "acc": 2,
    "dmg": 3,
    "sell": 20
  },
  "shortbow": {
    "id": "shortbow",
    "name": "Briarwood Shortbow",
    "description": "Briarwood is springy and unforgiving — a good teacher.",
    "icon": "🏹",
    "cat": "Weapons",
    "slot": "mainhand",
    "ranged": true,
    "twoHand": true,
    "equipLevel": 10,
    "acc": 5,
    "dmg": 4,
    "sell": 50
  },
  "longbow": {
    "id": "longbow",
    "name": "Coldpine Longbow",
    "description": "Straight-grained coldpine, shaped for reach. A bowyer's favourite first real bow.",
    "icon": "🏹",
    "cat": "Weapons",
    "slot": "mainhand",
    "ranged": true,
    "twoHand": true,
    "equipLevel": 20,
    "acc": 9,
    "dmg": 8,
    "sell": 100
  },
  "greyoak_longbow": {
    "id": "greyoak_longbow",
    "name": "Greyoak Warbow",
    "description": "Old-growth wood shaped by someone who knows what patience produces. A serious weapon.",
    "icon": "🏹",
    "cat": "Weapons",
    "slot": "mainhand",
    "ranged": true,
    "twoHand": true,
    "equipLevel": 30,
    "acc": 16,
    "dmg": 16,
    "sell": 200
  },
  "ruewood_shortbow": {
    "id": "ruewood_shortbow",
    "name": "Ruewood Hunter's Bow",
    "description": "Red-barked wood that holds tension unlike anything cheaper. Fast draw, hard hit.",
    "icon": "🏹",
    "cat": "Weapons",
    "slot": "mainhand",
    "ranged": true,
    "twoHand": true,
    "equipLevel": 40,
    "acc": 24,
    "dmg": 22,
    "sell": 380
  },
  "duskwood_warbow": {
    "id": "duskwood_warbow",
    "name": "Duskwood Warbow",
    "description": "Cut from dusk-dark wood and strung at night, they say. Those who shoot it note the arrows find their mark quietly.",
    "icon": "🏹",
    "cat": "Weapons",
    "slot": "mainhand",
    "ranged": true,
    "twoHand": true,
    "equipLevel": 45,
    "acc": 36,
    "dmg": 32,
    "sell": 600
  },
  "deeproot_warbow": {
    "id": "deeproot_warbow",
    "name": "Deeproot Warbow",
    "description": "The deepest wood in Varath made into the finest bow. Whatever it was before, it is this now.",
    "icon": "🏹",
    "cat": "Weapons",
    "slot": "mainhand",
    "ranged": true,
    "twoHand": true,
    "equipLevel": 50,
    "acc": 48,
    "dmg": 42,
    "sell": 950
  },
  "ashfin_raw": {
    "id": "ashfin_raw",
    "name": "Raw Ashfin",
    "description": "Small and silver. Every child in Varath has caught one. Barely worth cleaning alone.",
    "icon": "🐟",
    "cat": "Fish",
    "sell": 2
  },
  "greyfin_raw": {
    "id": "greyfin_raw",
    "name": "Raw Greyfin",
    "description": "A fish of the lower Redrun, where the river broadens and slows. Bigger than the hill-stream catch, with firm flesh.",
    "icon": "🐟",
    "cat": "Fish",
    "sell": 10
  },
  "ribperch_raw": {
    "id": "ribperch_raw",
    "name": "Raw Ribperch",
    "description": "Named by believers who note its ribcage shape. Common in the Ribvault basin, where the estuary spreads into brackish shallows. Those who fish there return the first catch of the season.",
    "icon": "🐟",
    "cat": "Fish",
    "sell": 18
  },
  "redgill_raw": {
    "id": "redgill_raw",
    "name": "Raw Redgill",
    "description": "A sea fish with vivid red gill-plates. Prized for the richness of its flesh.",
    "icon": "🐟",
    "cat": "Fish",
    "sell": 50
  },
  "deepscale_raw": {
    "id": "deepscale_raw",
    "name": "Raw Deepscale",
    "description": "A heavily-armoured fish from the deep coastal waters. Ugly to look at, worth the work to prepare. Its scales are harder than some metals.",
    "icon": "🐡",
    "cat": "Fish",
    "sell": 80
  },
  "eyeless_pike_raw": {
    "id": "eyeless_pike_raw",
    "name": "Raw Eyeless Pike",
    "description": "Enormous, ancient, and blind. Found only in the deepest waters of the Eyeless Sea. Most fishermen see one in a lifetime. The rest see none.",
    "icon": "🦈",
    "cat": "Fish",
    "sell": 125
  },
  "river_stone": {
    "id": "river_stone",
    "name": "Smooth River Stone",
    "description": "A river-worn stone, perfectly smooth. Some collect them. Crafting can use these as simple jewelry components.",
    "icon": "🪨",
    "cat": "Finds",
    "sell": 8
  },
  "old_hook": {
    "id": "old_hook",
    "name": "Old Hook",
    "description": "A bent, rusted hook from some earlier fisherman's line. Old Varath iron, maybe older.",
    "icon": "🪝",
    "cat": "Finds",
    "sell": 15
  },
  "waterlogged_coin": {
    "id": "waterlogged_coin",
    "name": "Waterlogged Coin",
    "description": "A coin softened by long immersion. The face is unreadable. Old Varath mintage, like the worn coins on the barrow-things.",
    "icon": "🪙",
    "cat": "Finds",
    "sell": 20
  },
  "redrun_pearl": {
    "id": "redrun_pearl",
    "name": "Redrun Pearl",
    "description": "A small, reddish pearl from the Redrun estuary. More red than white. Jewellers find these remarkable.",
    "icon": "🔵",
    "cat": "Gems",
    "sell": 180
  },
  "eyeless_scale": {
    "id": "eyeless_scale",
    "name": "Eyeless Scale",
    "description": "A single scale from the Eyeless Pike. Translucent and hard as stone. Those who fish the Eyeless Sea keep these. No one is sure why.",
    "icon": "⬜",
    "cat": "Rare Drops",
    "sell": 500
  },
  "burnt_food": {
    "id": "burnt_food",
    "name": "Burnt Food",
    "description": "Charred past saving. A cook's shame — worth nothing, and it won't heal a thing. Train Cooking and you'll burn less, until one day you never do.",
    "icon": "🍖",
    "cat": "Food",
    "sell": 0
  },
  "ashfin_cooked": {
    "id": "ashfin_cooked",
    "name": "Cooked Ashfin",
    "description": "Barely a meal, but warm. Better than nothing on a cold night.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 3,
    "sell": 8
  },
  "speckletrout_cooked": {
    "id": "speckletrout_cooked",
    "name": "Cooked Speckletrout",
    "description": "The standard trail food of Men. Reliable, filling, easy to prepare.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 5,
    "sell": 18
  },
  "greyfin_cooked": {
    "id": "greyfin_cooked",
    "name": "Cooked Greyfin",
    "description": "A decent meal. Salted and cooked well, it keeps a man going through a long day.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 7,
    "sell": 35
  },
  "ribperch_cooked": {
    "id": "ribperch_cooked",
    "name": "Cooked Ribperch",
    "description": "A proper meal. Worth the bones. First food worth stockpiling before hard work.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 9,
    "sell": 60
  },
  "coldwater_eel_cooked": {
    "id": "coldwater_eel_cooked",
    "name": "Cooked Coldwater Eel",
    "description": "Rich and dense. Hard to cook well; punishing when burnt.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 11,
    "sell": 100
  },
  "redgill_cooked": {
    "id": "redgill_cooked",
    "name": "Cooked Redgill",
    "description": "The benchmark meal for serious work. Good flesh, good recovery.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 14,
    "sell": 165
  },
  "deepscale_cooked": {
    "id": "deepscale_cooked",
    "name": "Cooked Deepscale",
    "description": "Time-consuming to prepare, but the effort shows in every bite.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 17,
    "sell": 260
  },
  "eyeless_pike_cooked": {
    "id": "eyeless_pike_cooked",
    "name": "Cooked Eyeless Pike",
    "description": "The finest meal in Varath. One fish, many servings, full recovery.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 20,
    "sell": 410
  },

  // --- Second wave of catches: more variety across every water and level band. ---
  "silverdart_raw": {
    "id": "silverdart_raw",
    "name": "Raw Silverdart",
    "description": "A quick, glinting minnow of the hill-streams. Darts faster than the eye, but a patient line lands plenty.",
    "icon": "🐟",
    "cat": "Fish",
    "sell": 5
  },
  "silverdart_cooked": {
    "id": "silverdart_cooked",
    "name": "Cooked Silverdart",
    "description": "A light, quick meal — a handful of these keeps a young angler moving.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 4,
    "sell": 14
  },
  "bramblecarp_raw": {
    "id": "bramblecarp_raw",
    "name": "Raw Bramblecarp",
    "description": "A stout carp of the still moor-ponds, its scales snagged with weed. Muddy, but it fries up well.",
    "icon": "🐟",
    "cat": "Fish",
    "sell": 8
  },
  "bramblecarp_cooked": {
    "id": "bramblecarp_cooked",
    "name": "Cooked Bramblecarp",
    "description": "Earthy and filling once the mud's cooked out. Honest moorland fare.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 6,
    "sell": 24
  },
  "copperling_raw": {
    "id": "copperling_raw",
    "name": "Raw Copperling",
    "description": "A coastal fish burnished copper along the flank. Schools thick where the tide turns.",
    "icon": "🐟",
    "cat": "Fish",
    "sell": 14
  },
  "copperling_cooked": {
    "id": "copperling_cooked",
    "name": "Cooked Copperling",
    "description": "Sweet-fleshed and reliable. A staple on the coast road.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 8,
    "sell": 44
  },
  "bristlepike_raw": {
    "id": "bristlepike_raw",
    "name": "Raw Bristlepike",
    "description": "A spined river-hunter, all teeth and temper. Takes a firm hand to land.",
    "icon": "🐟",
    "cat": "Fish",
    "sell": 26
  },
  "bristlepike_cooked": {
    "id": "bristlepike_cooked",
    "name": "Cooked Bristlepike",
    "description": "Lean and firm. The meat rewards the fight it gave.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 10,
    "sell": 70
  },
  "gloomshad_raw": {
    "id": "gloomshad_raw",
    "name": "Raw Gloomshad",
    "description": "A dark shad from the peat-black moor waters. Bites best under cloud.",
    "icon": "🐟",
    "cat": "Fish",
    "sell": 40
  },
  "gloomshad_cooked": {
    "id": "gloomshad_cooked",
    "name": "Cooked Gloomshad",
    "description": "Rich, dark flesh with a smoky note from the peat. Prized by moor-folk.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 12,
    "sell": 100
  },
  "runestout_raw": {
    "id": "runestout_raw",
    "name": "Raw Runestout",
    "description": "A heavy, deep-bodied sea fish marked with pale whorls the old fishers call runes. A real catch.",
    "icon": "🐡",
    "cat": "Fish",
    "sell": 62
  },
  "runestout_cooked": {
    "id": "runestout_cooked",
    "name": "Cooked Runestout",
    "description": "Dense and satisfying — a meal that carries you through the hardest day.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 16,
    "sell": 185
  },
  "frostgill_raw": {
    "id": "frostgill_raw",
    "name": "Raw Frostgill",
    "description": "A pallid fish from the coldest deep water, cool to the touch long after it's landed. Few anglers reach the depths it favours.",
    "icon": "🦈",
    "cat": "Fish",
    "sell": 95
  },
  "frostgill_cooked": {
    "id": "frostgill_cooked",
    "name": "Cooked Frostgill",
    "description": "Clean, cold-water flesh that all but restores a body outright. A master angler's meal.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 19,
    "sell": 300
  },
  "sword_1": {
    "id": "sword_1",
    "name": "Knucklestone Sword",
    "description": "A blunt, heavy blade. Better than fists, barely.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "acc": 2,
    "dmg": 1,
    "attackStyle": "slash",
    "sell": 25
  },
  "sword_3": {
    "id": "sword_3",
    "name": "Ashiron Sword",
    "description": "Solid iron, well balanced. Trustworthy in a fight.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "acc": 9,
    "dmg": 4,
    "attackStyle": "slash",
    "sell": 130
  },
  "sword_4": {
    "id": "sword_4",
    "name": "Ribstone Sword",
    "description": "Heavy and punishing. Demands a strong arm.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "acc": 14,
    "dmg": 6,
    "attackStyle": "slash",
    "sell": 250
  },
  "sword_5": {
    "id": "sword_5",
    "name": "Spinite Sword",
    "description": "Cold blue-grey steel, light and true. The blade that carries a smith from journeyman to master.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 5,
    "acc": 21,
    "dmg": 9,
    "attackStyle": "slash",
    "sell": 460
  },
  "sword_6": {
    "id": "sword_6",
    "name": "Bloodore Sword",
    "description": "The red blade is said to thirst. Superstition, surely.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "acc": 28,
    "dmg": 12,
    "attackStyle": "slash",
    "sell": 700
  },
  "sword_9": {
    "id": "sword_9",
    "name": "Voidstone Sword",
    "description": "Cold to the touch and razor-edged. Few things stop it.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 9,
    "acc": 44,
    "dmg": 20,
    "attackStyle": "slash",
    "sell": 1350
  },
  "sword_10": {
    "id": "sword_10",
    "name": "Hearthite Sword",
    "description": "The finest blade in Varath. Warm, even in killing weather.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "acc": 48,
    "dmg": 21,
    "attackStyle": "slash",
    "sell": 1750
  },
  "armor_1": {
    "id": "armor_1",
    "name": "Knucklestone Mail",
    "description": "Roughly riveted plates. Turns the occasional blow.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "armor",
    "def": 2,
    "sell": 35
  },
  "armor_3": {
    "id": "armor_3",
    "name": "Ashiron Mail",
    "description": "Solid iron mail. Reliable and reassuring.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "armor",
    "def": 9,
    "sell": 180
  },
  "armor_4": {
    "id": "armor_4",
    "name": "Ribstone Plate",
    "description": "Heavy plate. Slows you, but you live.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "armor",
    "def": 14,
    "sell": 345
  },
  "armor_5": {
    "id": "armor_5",
    "name": "Spinite Plate",
    "description": "Cold-steel plate, lighter than it looks. The armour a smith earns the right to wear.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "armor",
    "tier": 5,
    "def": 21,
    "sell": 620
  },
  "armor_6": {
    "id": "armor_6",
    "name": "Bloodore Plate",
    "description": "The red plate is unnerving to face across a field.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "armor",
    "def": 28,
    "sell": 965
  },
  "armor_9": {
    "id": "armor_9",
    "name": "Voidstone Plate",
    "description": "Cold and dark. Absorbs blows with unsettling stillness.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "armor",
    "tier": 9,
    "def": 40,
    "sell": 1900
  },
  "armor_10": {
    "id": "armor_10",
    "name": "Hearthite Plate",
    "description": "The finest armor in Varath. It seems to shrug off the cold itself.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "armor",
    "def": 48,
    "sell": 2430
  },
  "raw_rat_meat": {
    "id": "raw_rat_meat",
    "name": "Raw Rat Meat",
    "description": "Stringy and unappealing. Food is food.",
    "icon": "🥩",
    "cat": "Meat",
    "sell": 3
  },
  "raw_wolf_meat": {
    "id": "raw_wolf_meat",
    "name": "Raw Wolf Meat",
    "description": "Lean and gamey. Cooks into a decent meal.",
    "icon": "🥩",
    "cat": "Meat",
    "sell": 8
  },
  "raw_boar_meat": {
    "id": "raw_boar_meat",
    "name": "Raw Boar Meat",
    "description": "Rich and fatty. A real meal for a working man.",
    "icon": "🥩",
    "cat": "Meat",
    "sell": 16
  },
  "raw_bear_meat": {
    "id": "raw_bear_meat",
    "name": "Raw Bear Meat",
    "description": "Heavy, dark meat. Sustains a fighter through hard days.",
    "icon": "🥩",
    "cat": "Meat",
    "sell": 30
  },
  "raw_meat": {
    "id": "raw_meat",
    "name": "Raw Meat",
    "description": "A cut of wild game — venison, boar, whatever the hunt gave up. Cook it before you eat it.",
    "icon": "🥩",
    "cat": "Meat",
    "sell": 18
  },
  "cooked_meat": {
    "id": "cooked_meat",
    "name": "Cooked Meat",
    "description": "Game roasted over a fire. Honest food for the road.",
    "icon": "🍗",
    "cat": "Food",
    "heals": 7,
    "sell": 30
  },
  "rat_meat_cooked": {
    "id": "rat_meat_cooked",
    "name": "Cooked Rat Meat",
    "description": "Charred and tough, but it fills a hole.",
    "icon": "🍗",
    "cat": "Food",
    "heals": 4,
    "sell": 12
  },
  "wolf_meat_cooked": {
    "id": "wolf_meat_cooked",
    "name": "Cooked Wolf Meat",
    "description": "Gamey but satisfying. A hunter's staple.",
    "icon": "🍗",
    "cat": "Food",
    "heals": 6,
    "sell": 28
  },
  "boar_meat_cooked": {
    "id": "boar_meat_cooked",
    "name": "Cooked Boar Meat",
    "description": "Roasted boar — one of the better meals a Man can want.",
    "icon": "🍗",
    "cat": "Food",
    "heals": 8,
    "sell": 55
  },
  "bear_meat_cooked": {
    "id": "bear_meat_cooked",
    "name": "Cooked Bear Meat",
    "description": "Dense and restorative. Eaten before hard fights.",
    "icon": "🍗",
    "cat": "Food",
    "heals": 11,
    "sell": 100
  },
  "venison_cooked": {
    "id": "venison_cooked",
    "name": "Venison",
    "description": "Roasted prime stag. Lean, rich, and deeply restorative.",
    "icon": "🍗",
    "cat": "Food",
    "heals": 14,
    "sell": 160
  },
  "aurochs_cooked": {
    "id": "aurochs_cooked",
    "name": "Aurochs Steak",
    "description": "A thick steak from the largest game on the moor. A feast in itself.",
    "icon": "🍗",
    "cat": "Food",
    "heals": 19,
    "sell": 240
  },
  "wolf_pelt": {
    "id": "wolf_pelt",
    "name": "Wolf Pelt",
    "description": "A grey wolf's hide. Tan it at the Crafting bench — yields 2 tanned leather.",
    "icon": "🟤",
    "cat": "Hides",
    "sell": 30
  },
  "boar_hide": {
    "id": "boar_hide",
    "name": "Boar Hide",
    "description": "Thick, bristled boar hide. Tougher to work than wolf pelt, but yields more durable leather.",
    "icon": "🟤",
    "cat": "Hides",
    "sell": 45
  },
  "bear_pelt": {
    "id": "bear_pelt",
    "name": "Bear Pelt",
    "description": "A heavy bear pelt. When hardened by a skilled craftsman it rivals light plate for protection.",
    "icon": "🟤",
    "cat": "Hides",
    "sell": 75
  },
  "venison": {
    "id": "venison",
    "name": "Venison",
    "description": "Prime stag meat from a Pale Stag. Darker and richer than boar. Cooks well.",
    "icon": "🥩",
    "cat": "Meat",
    "sell": 45
  },
  "aurochs_cut": {
    "id": "aurochs_cut",
    "name": "Aurochs Cut",
    "description": "A thick cut from an Ashen Aurochs. The largest game on the moor. Dense and sustaining.",
    "icon": "🥩",
    "cat": "Meat",
    "sell": 95
  },
  "thick_hide": {
    "id": "thick_hide",
    "name": "Thick Hide",
    "description": "A heavy, dense hide from an Ashen Aurochs. Requires master leatherwork to process.",
    "icon": "🟫",
    "cat": "Materials",
    "sell": 140
  },
  "sinew": {
    "id": "sinew",
    "name": "Sinew",
    "description": "Tough sinew from a Pale Stag. Used in bowcraft and fine cordage.",
    "icon": "〰️",
    "cat": "Materials",
    "stackable": true,
    "sell": 65
  },
  "trophy": {
    "id": "trophy",
    "name": "Hunter's Trophy",
    "description": "A rare keepsake from a great hunt. Sought by collectors.",
    "icon": "🏆",
    "cat": "Materials",
    "sell": 500
  },
  "rat_tail": {
    "id": "rat_tail",
    "name": "Rat Tail",
    "description": "A scrawny rat's tail. You kept it. You're not sure why.",
    "icon": "〰️",
    "cat": "Drops",
    "sell": 2
  },
  "worn_coin": {
    "id": "worn_coin",
    "name": "Worn Coin",
    "description": "An old, eroded coin. The face on it is not a denomination anyone recognises. Old Varath mintage — or something older.",
    "icon": "🪙",
    "cat": "Drops",
    "sell": 20,
    "stackable": true
  },
  "wolf_fang": {
    "id": "wolf_fang",
    "name": "Wolf Fang",
    "description": "A large grey wolf fang. Sharp, dense. Useful for something, surely.",
    "icon": "🦷",
    "cat": "Drops",
    "sell": 20
  },
  "boar_tusk": {
    "id": "boar_tusk",
    "name": "Boar Tusk",
    "description": "A curved boar tusk, heavy and solid. Harder than it looks.",
    "icon": "🦷",
    "cat": "Drops",
    "sell": 35
  },
  "bear_claw": {
    "id": "bear_claw",
    "name": "Bear Claw",
    "description": "A forest bear claw, long and curved. Good for trade or tools.",
    "icon": "🐾",
    "cat": "Drops",
    "sell": 60
  },
  "rat_king_ear": {
    "id": "rat_king_ear",
    "name": "Rat King's Ear",
    "description": "A desiccated ear from a Rat King — a rat that grew fat enough to lead others. Alchemists pay well for these.",
    "icon": "👂",
    "cat": "Rare Drops",
    "sell": 250
  },
  "silver_wolf_pelt": {
    "id": "silver_wolf_pelt",
    "name": "Silver Wolf Pelt",
    "description": "An albino wolf pelt, silver-white and remarkably fine. These are not often seen on the hills.",
    "icon": "⬜",
    "cat": "Rare Drops",
    "sell": 400
  },
  "bristle_crown": {
    "id": "bristle_crown",
    "name": "Bristle Crown",
    "description": "A peculiar trophy — a boar with a crown-like ring of stiffened bristles. One in many hundreds.",
    "icon": "👑",
    "cat": "Rare Drops",
    "sell": 600
  },
  "forest_bear_skull": {
    "id": "forest_bear_skull",
    "name": "Forest Bear Skull",
    "description": "A great bear skull, heavy and intact. Few hunters take these home. The bone gleams faintly.",
    "icon": "💀",
    "cat": "Rare Drops",
    "sell": 800
  },
  "pet_mining": {
    "id": "pet_mining",
    "name": "Rockling",
    "description": "A small stone creature that formed around your pick one morning. You did not notice until it blinked. +2% chance of double ore.",
    "icon": "🪨",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "petSkill": "mining",
      "bonus": "ore_yield",
      "bonusAmt": 0.02
    }
  },
  "pet_smithing": {
    "id": "pet_smithing",
    "name": "Cinder",
    "description": "A coal-black creature that lives in the forge heat. It keeps your fire even. +3% Smithing XP.",
    "icon": "🔥",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "petSkill": "smithing",
      "bonus": "smithing_xp",
      "bonusAmt": 0.03
    }
  },
  "pet_forestry": {
    "id": "pet_forestry",
    "name": "Barkback",
    "description": "A small creature made of bark and moss that rides your shoulder. The trees do not seem to mind. +3% Forestry speed.",
    "icon": "🌿",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "petSkill": "forestry",
      "bonus": "gather_speed",
      "bonusAmt": 0.03
    }
  },
  "pet_woodcraft": {
    "id": "pet_woodcraft",
    "name": "Splinter",
    "description": "A small creature assembled from offcuts. It organises your workspace without being asked. +3% Woodcraft XP.",
    "icon": "🪵",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "petSkill": "woodcraft",
      "bonus": "woodcraft_xp",
      "bonusAmt": 0.03
    }
  },
  "pet_fishing": {
    "id": "pet_fishing",
    "name": "Bobber",
    "description": "A fish that does not leave. It circles your line and seems to attract the others. +3% Fishing speed.",
    "icon": "🐟",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "petSkill": "fishing",
      "bonus": "gather_speed",
      "bonusAmt": 0.03
    }
  },
  "pet_cooking": {
    "id": "pet_cooking",
    "name": "Ashling",
    "description": "A small creature that lives near the fire and watches the pot. Food burns less with it around. +3% Cooking XP.",
    "icon": "🍖",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "petSkill": "cooking",
      "bonus": "cooking_xp",
      "bonusAmt": 0.03
    }
  },
  "pet_farming": {
    "id": "pet_farming",
    "name": "Seedling",
    "description": "A green creature that walks the patch rows and seems to encourage things to grow. +5% crop survival.",
    "icon": "🌱",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "petSkill": "farming",
      "bonus": "crop_survival",
      "bonusAmt": 0.05
    }
  },
  "pet_survivalist": {
    "id": "pet_survivalist",
    "name": "Duskwing",
    "description": "A moth with ember-coloured wings. It leads you to things. +5% forage yield chance.",
    "icon": "🦋",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "petSkill": "survivalist",
      "bonus": "forage_yield",
      "bonusAmt": 0.05
    }
  },
  "pet_herblore": {
    "id": "pet_herblore",
    "name": "Sprig",
    "description": "A creature that smells like every herb at once. It sits on the bench and the potions come out cleaner. +3% Herblore XP.",
    "icon": "🌾",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "petSkill": "herblore",
      "bonus": "herblore_xp",
      "bonusAmt": 0.03
    }
  },
  "pet_bounty": {
    "id": "pet_bounty",
    "name": "Tracker",
    "description": "A silent creature that appears only on the hunt. You have never seen it eat. +5% Bounty XP.",
    "icon": "🐾",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "petSkill": "bounty",
      "bonus": "bounty_xp",
      "bonusAmt": 0.05
    }
  },
  "pet_construction": {
    "id": "pet_construction",
    "name": "Mortar",
    "description": "A small creature made entirely of set stone. It fits in the palm and weighs more than it should. +3% Construction XP.",
    "icon": "🧱",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "petSkill": "construction",
      "bonus": "construction_xp",
      "bonusAmt": 0.03
    }
  },
  "pet_crafting": {
    "id": "pet_crafting",
    "name": "Thimble",
    "description": "A tiny creature that sorts thread, polishes tools, and tidies the bench. It asks for nothing. +3% Crafting XP.",
    "icon": "✂️",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "petSkill": "crafting",
      "bonus": "crafting_xp",
      "bonusAmt": 0.03
    }
  },
  "pet_hunter": {
    "id": "pet_hunter",
    "name": "Quicksnare",
    "description": "A hare that escaped its own snare. It now rides your pack and guides quarry into range. +5% chance of double meat yield.",
    "icon": "🐇",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "meta": {
      "petSkill": "hunter",
      "bonus": "meat_yield",
      "bonusAmt": 0.05
    }
  },
  "pet_hollow_warden": {
    "id": "pet_hollow_warden",
    "name": "Barrowkin",
    "description": "A small hollow thing that followed you out of the barrow. It does not disagree with you. Yet.",
    "icon": "🦴",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "meta": {
      "petBoss": "hollow_warden"
    }
  },
  "pet_bog_warden": {
    "id": "pet_bog_warden",
    "name": "Mirewisp",
    "description": "It rose out of the bog water when the Warden fell and has not gone back down.",
    "icon": "💧",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "meta": {
      "petBoss": "bog_warden"
    }
  },
  "pet_greyback": {
    "id": "pet_greyback",
    "name": "Greycub",
    "description": "A grey-furred cub that padded out of the wilds the season the old beast fell. It answers to no one — but it walks where you walk now.",
    "icon": "🐻",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "meta": {
      "petBoss": "greyback"
    }
  },
  "pet_spine_warlord": {
    "id": "pet_spine_warlord",
    "name": "Cairn",
    "description": "A knot of stone and old bone from the vault. It has been waiting longer than you have been alive.",
    "icon": "⛰️",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "meta": {
      "petBoss": "spine_warlord"
    }
  },
  "pet_marrow_keeper": {
    "id": "pet_marrow_keeper",
    "name": "Keepsake",
    "description": "It stayed when everything else was carried out. It seems to think you are the last instruction.",
    "icon": "💀",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "meta": {
      "petBoss": "marrow_keeper"
    }
  },
  "pet_ashen_wyrm": {
    "id": "pet_ashen_wyrm",
    "name": "Emberling",
    "description": "A hatchling wyrm no bigger than a cat, scales still forge-warm. It imprinted on whoever felled its parent — you.",
    "icon": "🐉",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "meta": {
      "petBoss": "ashen_wyrm"
    }
  },
  "pet_boneman": {
    "id": "pet_boneman",
    "name": "Little Marrow",
    "description": "A knee-high figure of stitched bone that took up the Boneman's habits — and his shadow. It follows you now, saw and all.",
    "icon": "💀",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "meta": {
      "petBoss": "boneman"
    }
  },
  "pet_green_baron": {
    "id": "pet_green_baron",
    "name": "The Little Hood",
    "description": "A knee-high outlaw in miniature greens, a toy bow slung on its back. It swears it robs from the rich. It does not.",
    "icon": "🏹",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "lore": "green_baron",
    "meta": {
      "petBoss": "green_baron"
    }
  },
  "pet_hollow_prophet": {
    "id": "pet_hollow_prophet",
    "name": "Little Hollow",
    "description": "A tiny robed figure with a pinprick of pale light where its face should be. It murmurs sermons at your ankles, to a god only it can hear.",
    "icon": "🔮",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "lore": "hollow_prophet",
    "meta": {
      "petBoss": "hollow_prophet"
    }
  },
  // === Superior-encounter ultra-rares — only from a Superior bounty kill ======
  "reckoners_charm": {
    "id": "reckoners_charm",
    "name": "Reckoner's Charm",
    "description": "A blackened coin on a cord, one face worn smooth by a hunter's thumb. Kaeda strikes only a handful, and only a Superior kill ever gives one up. It sharpens every blow you land.",
    "icon": "📿",
    "cat": "Jewellery",
    "slot": "necklace",
    "acc": 8,
    "dmg": 5,
    "def": 5,
    "rngAcc": 6,
    "magAcc": 6,
    "rarity": "legendary",
    "lore": "bounty",
    "sell": 5000
  },
  "pet_superior": {
    "id": "pet_superior",
    "name": "The Superior",
    "description": "A palm-sized creature that came up snarling out of a Superior kill and simply… decided to follow you. It thinks it's much bigger than it is. So did the one it came from.",
    "icon": "🐾",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "lore": "bounty",
    "meta": {
      "petSuperior": true
    }
  },
  "pet_founder_wisp": {
    "id": "pet_founder_wisp",
    "name": "The First Ember",
    "description": "A warm mote of lantern-light that keeps to your shoulder. It was lit for those who walked the Knuckle Hills before the roads were made — and it remembers. Purely a companion; it asks nothing and grants nothing but its light. A Founder's mark, and never sold, dropped, or given again.",
    "icon": "🔥",
    "cat": "Founder",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0,
    "meta": {
      "founder": true
    }
  },
  "ribstone_arrow": {
    "id": "ribstone_arrow",
    "name": "Ribstone Arrow",
    "description": "Heavier than iron. Carries more force.",
    "icon": "➶",
    "cat": "Arrows",
    "slot": "ammo",
    "sell": 38
  },
  "bloodore_arrow": {
    "id": "bloodore_arrow",
    "name": "Bloodore Arrow",
    "description": "Red-tipped. Unsettling to face.",
    "icon": "➶",
    "cat": "Arrows",
    "slot": "ammo",
    "sell": 105
  },
  "voidstone_arrow": {
    "id": "voidstone_arrow",
    "name": "Voidstone Arrow",
    "description": "Dark and heavy. Built for the hardest encounters.",
    "icon": "➶",
    "cat": "Arrows",
    "slot": "ammo",
    "sell": 230
  },
  "wood_ash": {
    "id": "wood_ash",
    "name": "Wood Ash",
    "description": "Fine grey ash from burning softwood. Used in fertilizers and as a base ingredient.",
    "icon": "🌫️",
    "cat": "Materials",
    "sell": 4
  },
  "fine_charcoal": {
    "id": "fine_charcoal",
    "name": "Fine Charcoal",
    "description": "High-grade charcoal from the densest ancient woods. Rare and versatile.",
    "icon": "◼",
    "cat": "Materials",
    "sell": 60
  },
  "ashroot_compound": {
    "id": "ashroot_compound",
    "name": "Ashroot Compound",
    "description": "Dense and restorative. Takes skill to prepare correctly.",
    "icon": "🧪",
    "cat": "Food",
    "heals": 24,
    "sell": 180
  },
  "dawnspore_elixir": {
    "id": "dawnspore_elixir",
    "name": "Dawnspore Elixir",
    "description": "Extraordinarily rare. Tastes of morning air and cold stone.",
    "icon": "🧪",
    "cat": "Food",
    "heals": 33,
    "sell": 300
  },
  "smoked_speckletrout": {
    "id": "smoked_speckletrout",
    "name": "Smoked Speckletrout",
    "description": "Slow-smoked over charcoal. Worth the wait.",
    "icon": "🥩",
    "cat": "Food",
    "heals": 10,
    "sell": 45
  },
  "smoked_greyfin": {
    "id": "smoked_greyfin",
    "name": "Smoked Greyfin",
    "description": "A coastal fish cured over hardwood coals.",
    "icon": "🥩",
    "cat": "Food",
    "heals": 14,
    "sell": 80
  },
  "smoked_ribperch": {
    "id": "smoked_ribperch",
    "name": "Smoked Ribperch",
    "description": "Smoked ribperch is considered a delicacy even by the well-fed.",
    "icon": "🥩",
    "cat": "Food",
    "heals": 19,
    "sell": 120
  },
  "smoked_redgill": {
    "id": "smoked_redgill",
    "name": "Smoked Redgill",
    "description": "The best sea fish improves markedly with smoke.",
    "icon": "🥩",
    "cat": "Food",
    "heals": 26,
    "sell": 200
  },
  "hill_stew": {
    "id": "hill_stew",
    "name": "Hill Stew",
    "description": "Wolf meat and mushrooms, long-cooked. A proper hunter's meal. Better than the sum of its parts.",
    "icon": "🍲",
    "cat": "Food",
    "heals": 13,
    "sell": 80
  },
  "forest_roast": {
    "id": "forest_roast",
    "name": "Forest Roast",
    "description": "Boar and thornberries, slow-roasted. The kind of meal that turns a camp into a home.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 18,
    "sell": 140
  },
  "bone_broth": {
    "id": "bone_broth",
    "name": "Bone Broth",
    "description": "Bear bones and hearthroot, simmered all day. Old medicine. Remarkable recovery.",
    "icon": "🥣",
    "cat": "Food",
    "heals": 22,
    "sell": 200
  },
  "redrun_chowder": {
    "id": "redrun_chowder",
    "name": "Redrun Chowder",
    "description": "Redgill and river greens, reduced over charcoal. The cook's version of the finest fish in Varath.",
    "icon": "🍲",
    "cat": "Food",
    "heals": 28,
    "sell": 320
  },
  "deepmeat_stew": {
    "id": "deepmeat_stew",
    "name": "Deepmeat Stew",
    "description": "Deepscale and ashroot, a difficult preparation that rewards serious cooks. Near-complete recovery.",
    "icon": "🍲",
    "cat": "Food",
    "heals": 35,
    "sell": 500
  },
  "battle_ration": {
    "id": "battle_ration",
    "name": "Battle Ration",
    "description": "A dense, purpose-made ration for sustained combat. Not pleasant, effective.",
    "icon": "🎒",
    "cat": "Food",
    "heals": 9,
    "sell": 50
  },
  "warriors_draught": {
    "id": "warriors_draught",
    "name": "Vigour Draught",
    "description": "A bitter brew that sharpens the arm for a short time. +6 melee damage for 60 seconds.",
    "icon": "🧪",
    "cat": "Combat",
    "buff": "melee_dmg",
    "buffAmt": 6,
    "buffMs": 60000,
    "sell": 80
  },
  "shield_oil": {
    "id": "shield_oil",
    "name": "Ward Oil",
    "description": "Rubbed into armor before battle. The blow still lands, but softer. +8 defence for 60 seconds.",
    "icon": "🛢️",
    "cat": "Combat",
    "buff": "defence",
    "buffAmt": 8,
    "buffMs": 60000,
    "sell": 70
  },
  "hunters_kit": {
    "id": "hunters_kit",
    "name": "Hunter's Kit",
    "description": "A bounty hunter toolkit. Improves the next task reward.",
    "icon": "🎯",
    "cat": "Combat",
    "sell": 150
  },
  "flensing_hook": {
    "id": "flensing_hook",
    "name": "Flensing Hook",
    "description": "A barbed guild hook that finds the seam in a Hollow Hound's impossible hide. One is spent on every hound felled — unless you own the Flensing Mastery.",
    "icon": "🪝",
    "cat": "Combat",
    "sell": 0
  },
  "maw_spike": {
    "id": "maw_spike",
    "name": "Maw-Spike",
    "description": "A hardened spike the guild forges for one job: wedging an Iron Maw's plates apart. One is spent on every Maw felled — unless you own the Spike Mastery.",
    "icon": "🗡️",
    "cat": "Combat",
    "sell": 0
  },
  "hunters_horn": {
    "id": "hunters_horn",
    "name": "Hunter's Horn",
    "description": "A guild signal-horn keyed to your ledger. Sound it and be carried straight to your active task's hunting ground. One use.",
    "icon": "📯",
    "cat": "Combat",
    "sell": 0
  },
  "vane_badge": {
    "id": "vane_badge",
    "name": "Serjeant Vane's Badge",
    "description": "An Ironvale watch badge, polished to a shine even in hiding. The ninth bell is scratched into the back \u2014 the hour Vane rang the alarm nobody logged.",
    "icon": "\ud83c\udf96",
    "cat": "Quest",
    "sell": 0
  },
  "vane_letter": {
    "id": "vane_letter",
    "name": "Vane's Letter",
    "description": "Written fast and buried deep: 'I rang the ninth bell the night the chest was emptied. The ledgers say no bell rang. Only one man keeps the ledgers. If you're reading this, tell Hesta \u2014 the ninth bell was true.'",
    "icon": "\ud83d\udcdc",
    "cat": "Quest",
    "sell": 0
  },
  "guards_signet": {
    "id": "guards_signet",
    "name": "Guard's Signet",
    "description": "Captain Morn's own signet, given to the one who found the truth the watch-book missed. Weighty for a ring \u2014 most thanks are.",
    "icon": "\ud83d\udc8d",
    "cat": "Jewellery",
    "slot": "ring",
    "acc": 6,
    "def": 4,
    "sell": 0
  },
  "witch_ward_sprig": {
    "id": "witch_ward_sprig",
    "name": "Warding Sprig",
    "description": "A twist of rowan, iron-filing and duskshade that Calla pressed into your hand. It won't turn a blade, but the hollow's binding slides off it like water off a stone — enough to walk the ward-ring without losing your way.",
    "icon": "🌿",
    "cat": "Quest",
    "sell": 0
  },
  "widow_staff": {
    "id": "widow_staff",
    "name": "The Widow's Besom",
    "description": "The Ashen Widow's own staff — a besom of bound birch and bog-iron, its head a knot of black candle-wax that never quite goes cold. It channels Grace like a wick draws flame.",
    "icon": "🧹",
    "cat": "Weapons",
    "slot": "mainhand",
    "magic": true,
    "twoHand": true,
    "equipSkill": "faith",
    "equipLevel": 35,
    "acc": 40,
    "dmg": 37,
    "speed": 2600,
    "rarity": "rare",
    "lore": "ashen_widow",
    "sell": 1600
  },
  "ashen_witch_hat": {
    "id": "ashen_witch_hat",
    "name": "Ashen Witch-Hat",
    "description": "The Widow's tall, ash-grey hat, its brim gone soft with bog-damp and its point a little bent. Lighter than it looks, and it keeps the hex-cold off a caster's ears.",
    "icon": "🧙",
    "cat": "Ashen Regalia",
    "slot": "helmet",
    "equipSkill": "faith",
    "equipLevel": 35,
    "def": 10,
    "magAcc": 9,
    "rarity": "rare",
    "lore": "ashen_widow",
    "sell": 1400
  },
  "watchmans_buckler": {
    "id": "watchmans_buckler",
    "name": "Watchman's Buckler",
    "description": "A guard-issue buckler from the garrison stores Brann bled dry \u2014 the arms he sold are how the hired blades got theirs. Solid early protection, and a story to tell.",
    "icon": "\ud83d\udee1\ufe0f",
    "cat": "Armour",
    "slot": "offhand",
    "tier": 3,
    "def": 13,
    "sell": 420
  },
  "watchmans_sallet": {
    "id": "watchmans_sallet",
    "name": "Watchman's Sallet",
    "description": "A garrison-issue sallet from the same stores Brann bled dry. With the buckler it makes half a watchman \u2014 the honest half.",
    "icon": "\ud83e\ude96",
    "cat": "Armour",
    "slot": "helmet",
    "tier": 3,
    "def": 15,
    "sell": 460
  },
  "pet_brann": {
    "id": "pet_brann",
    "name": "The Little Quartermaster",
    "description": "A knee-high figure in tarnished guard plate that counts everything you pick up and disapproves of most of it. It followed you home from the Coldstep Shack, ledger and all.",
    "icon": "\ud83d\udee1\ufe0f",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "meta": {
      "petBoss": "quartermaster_brann"
    }
  },
  "helm_1": {
    "id": "helm_1",
    "name": "Knucklestone Helm",
    "description": "A crude helmet. Protects the head.",
    "icon": "⛑️",
    "cat": "Armour",
    "slot": "helmet",
    "tier": 1,
    "def": 2,
    "sell": 20
  },
  "helm_3": {
    "id": "helm_3",
    "name": "Ashiron Helm",
    "description": "A ashiron helmet. Protects the head.",
    "icon": "⛑️",
    "cat": "Armour",
    "slot": "helmet",
    "tier": 3,
    "def": 7,
    "sell": 95
  },
  "helm_4": {
    "id": "helm_4",
    "name": "Ribstone Helm",
    "description": "A ribstone helmet. Protects the head.",
    "icon": "⛑️",
    "cat": "Armour",
    "slot": "helmet",
    "tier": 4,
    "def": 11,
    "sell": 160
  },
  "helm_5": {
    "id": "helm_5",
    "name": "Spinite Helm",
    "description": "A spinite helmet. Cold to the brow, but it turns a blow.",
    "icon": "⛑️",
    "cat": "Armour",
    "slot": "helmet",
    "tier": 5,
    "def": 17,
    "sell": 290
  },
  "helm_6": {
    "id": "helm_6",
    "name": "Bloodore Helm",
    "description": "A bloodore helmet. Protects the head.",
    "icon": "⛑️",
    "cat": "Armour",
    "slot": "helmet",
    "tier": 6,
    "def": 23,
    "sell": 440
  },
  "helm_9": {
    "id": "helm_9",
    "name": "Voidstone Helm",
    "description": "A dark, cold helm. Unsettling to look at.",
    "icon": "⛑️",
    "cat": "Armour",
    "slot": "helmet",
    "tier": 9,
    "def": 32,
    "sell": 850
  },
  "helm_10": {
    "id": "helm_10",
    "name": "Hearthite Helm",
    "description": "A hearthite helmet. Protects the head.",
    "icon": "⛑️",
    "cat": "Armour",
    "slot": "helmet",
    "tier": 10,
    "def": 36,
    "sell": 1100
  },
  "bounty_helm": {
    "id": "bounty_helm",
    "name": "Bounty Helm",
    "description": "A hunter's helm strung with old trophies. +10% damage against the creature your active bounty names. Bought with Hunt Marks.",
    "icon": "🪖",
    "cat": "Armour",
    "slot": "helmet",
    "tier": 6,
    "def": 22,
    "sell": 0
  },
  "bounty_helm_g": {
    "id": "bounty_helm_g",
    "name": "Greater Bounty Helm",
    "description": "The Bounty Helm remade around a Superior's skull-plate. +18% damage against the creature your active bounty names. The mark of a hunter the guides talk about.",
    "icon": "🪖",
    "cat": "Armour",
    "slot": "helmet",
    "tier": 7,
    "def": 30,
    "rarity": "rare",
    "sell": 0
  },
  "hunters_cloak": {
    "id": "hunters_cloak",
    "name": "Hunter's Cloak",
    "description": "Oiled hide lined with the pelts of a hundred contracts. Worn only by hunters who earned it at the board — it cannot be bought with coin.",
    "icon": "🧥",
    "cat": "Capes",
    "slot": "cape",
    "def": 6,
    "acc": 3,
    "rngAcc": 3,
    "magAcc": 3,
    "rarity": "rare",
    "sell": 0
  },
  "creeper_eye": {
    "id": "creeper_eye",
    "name": "Creeper's Eye",
    "description": "A Warren Creeper's clouded eye, set in a copper band. It sees the gaps in a guard the way its owner saw pulses through stone. Dropped only in the Burrows of the Hunt Warrens.",
    "icon": "📿",
    "cat": "Jewellery",
    "slot": "necklace",
    "acc": 4,
    "rngAcc": 4,
    "magAcc": 4,
    "def": 2,
    "rarity": "rare",
    "lore": "bounty",
    "sell": 900
  },
  "stalker_fangs": {
    "id": "stalker_fangs",
    "name": "Stalker Fangs",
    "description": "A Dusk Stalker's twin fangs hafted into a whistling twin-blade. Faster than any smithed sword of its weight. Dropped only in the Dens of the Hunt Warrens.",
    "icon": "🗡️",
    "cat": "Legendary Weapons",
    "slot": "mainhand",
    "acc": 44,
    "dmg": 19,
    "speed": 2000,
    "attackStyle": "stab",
    "wepType": "dagger",
    "equipLevel": 40,
    "rarity": "rare",
    "lore": "bounty",
    "sell": 2400
  },
  "houndhide_cloak": {
    "id": "houndhide_cloak",
    "name": "Houndhide Cloak",
    "description": "The impossible hide of a Hollow Hound, tanned whole. Blades slide from it the way they slid from the hound. Dropped only in the Kennels of the Hunt Warrens.",
    "icon": "🧥",
    "cat": "Capes",
    "slot": "cape",
    "def": 9,
    "acc": 4,
    "rngAcc": 4,
    "magAcc": 4,
    "rarity": "legendary",
    "lore": "bounty",
    "sell": 3200
  },
  "wraithbone_staff": {
    "id": "wraithbone_staff",
    "name": "Wraithbone Staff",
    "icon": "🔮",
    "cat": "Legendary Weapons",
    "slot": "mainhand",
    "magic": true,
    "twoHand": true,
    "equipLevel": 60,
    "acc": 62,
    "dmg": 50,
    "speed": 2600,
    "rarity": "legendary",
    "lore": "bounty",
    "sell": 4200,
    "description": "A casting staff of fused wraithbone, cold in the hand and hungry for Grace. The finest channel in Varath — surrendered only by the Shades of the Warren Crypt."
  },
  "mawplate": {
    "id": "mawplate",
    "name": "Mawplate",
    "description": "A breastplate beaten from the Iron Maw's own shed plates. It has already survived everything once. Dropped only at the bottom of the Hunt Warrens.",
    "icon": "🛡️",
    "cat": "Legendary Armour",
    "slot": "armor",
    "def": 50,
    "equipLevel": 70,
    "rarity": "legendary",
    "lore": "bounty",
    "sell": 5200
  },
  "legs_1": {
    "id": "legs_1",
    "name": "Knucklestone Leg Plate",
    "description": "A crude leg plate.",
    "icon": "🦿",
    "cat": "Armour",
    "slot": "legs",
    "tier": 1,
    "def": 3,
    "sell": 25
  },
  "legs_3": {
    "id": "legs_3",
    "name": "Ashiron Leg Plate",
    "description": "A ashiron leg plate.",
    "icon": "🦿",
    "cat": "Armour",
    "slot": "legs",
    "tier": 3,
    "def": 10,
    "sell": 115
  },
  "legs_4": {
    "id": "legs_4",
    "name": "Ribstone Leg Plate",
    "description": "A ribstone leg plate.",
    "icon": "🦿",
    "cat": "Armour",
    "slot": "legs",
    "tier": 4,
    "def": 16,
    "sell": 195
  },
  "legs_5": {
    "id": "legs_5",
    "name": "Spinite Leg Plate",
    "description": "A spinite leg plate. Cold steel, honestly made.",
    "icon": "🦿",
    "cat": "Armour",
    "slot": "legs",
    "tier": 5,
    "def": 25,
    "sell": 380
  },
  "legs_6": {
    "id": "legs_6",
    "name": "Bloodore Leg Plate",
    "description": "A bloodore leg plate.",
    "icon": "🦿",
    "cat": "Armour",
    "slot": "legs",
    "tier": 6,
    "def": 34,
    "sell": 540
  },
  "legs_8": {
    "id": "legs_8",
    "name": "Hearthite Leg Plate",
    "description": "A hearthite leg plate.",
    "icon": "🦿",
    "cat": "Armour",
    "slot": "legs",
    "tier": 10,
    "def": 63,
    "sell": 1350
  },
  "boot_1": {
    "id": "boot_1",
    "name": "Knucklestone Boots",
    "description": "Crude boots. A solid foundation.",
    "icon": "🥾",
    "cat": "Armour",
    "slot": "boots",
    "tier": 1,
    "def": 1,
    "sell": 12
  },
  "boot_3": {
    "id": "boot_3",
    "name": "Ashiron Boots",
    "description": "Ashiron boots. A solid foundation.",
    "icon": "🥾",
    "cat": "Armour",
    "slot": "boots",
    "tier": 3,
    "def": 4,
    "sell": 55
  },
  "boot_4": {
    "id": "boot_4",
    "name": "Ribstone Boots",
    "description": "Ribstone boots. A solid foundation.",
    "icon": "🥾",
    "cat": "Armour",
    "slot": "boots",
    "tier": 4,
    "def": 6,
    "sell": 90
  },
  "boot_5": {
    "id": "boot_5",
    "name": "Spinite Boots",
    "description": "Spinite boots. Cold steel, a solid foundation.",
    "icon": "🥾",
    "cat": "Armour",
    "slot": "boots",
    "tier": 5,
    "def": 10,
    "sell": 170
  },
  "boot_6": {
    "id": "boot_6",
    "name": "Bloodore Boots",
    "description": "Bloodore boots. A solid foundation.",
    "icon": "🥾",
    "cat": "Armour",
    "slot": "boots",
    "tier": 6,
    "def": 14,
    "sell": 255
  },
  "boot_9": {
    "id": "boot_9",
    "name": "Voidstone Boots",
    "description": "Dark and cold underfoot.",
    "icon": "🥾",
    "cat": "Armour",
    "slot": "boots",
    "tier": 9,
    "def": 20,
    "sell": 510
  },
  "boot_10": {
    "id": "boot_10",
    "name": "Hearthite Boots",
    "description": "Hearthite boots. A solid foundation.",
    "icon": "🥾",
    "cat": "Armour",
    "slot": "boots",
    "tier": 10,
    "def": 22,
    "sell": 650
  },
  "shield_1": {
    "id": "shield_1",
    "name": "Knucklestone Shield",
    "description": "A crude shield. Usable with one-handed weapons.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "offhand",
    "tier": 1,
    "def": 3,
    "twoHand": false,
    "sell": 25
  },
  "shield_3": {
    "id": "shield_3",
    "name": "Ashiron Shield",
    "description": "A ashiron shield. Usable with one-handed weapons.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "offhand",
    "tier": 3,
    "def": 10,
    "twoHand": false,
    "sell": 115
  },
  "shield_4": {
    "id": "shield_4",
    "name": "Ribstone Shield",
    "description": "A ribstone shield. Usable with one-handed weapons.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "offhand",
    "tier": 4,
    "def": 16,
    "twoHand": false,
    "sell": 195
  },
  "shield_5": {
    "id": "shield_5",
    "name": "Spinite Shield",
    "description": "A spinite shield. Usable with one-handed weapons. Cold steel, well balanced.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "offhand",
    "tier": 5,
    "def": 25,
    "twoHand": false,
    "sell": 380
  },
  "shield_6": {
    "id": "shield_6",
    "name": "Bloodore Shield",
    "description": "A bloodore shield. Usable with one-handed weapons.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "offhand",
    "tier": 6,
    "def": 34,
    "twoHand": false,
    "sell": 540
  },
  "shield_9": {
    "id": "shield_9",
    "name": "Voidstone Shield",
    "description": "Darkly reflective. Absorbs blows well.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "offhand",
    "tier": 9,
    "def": 48,
    "twoHand": false,
    "sell": 1050
  },
  "shield_10": {
    "id": "shield_10",
    "name": "Hearthite Shield",
    "description": "A hearthite shield. Usable with one-handed weapons.",
    "icon": "🛡️",
    "cat": "Armour",
    "slot": "offhand",
    "tier": 10,
    "def": 63,
    "twoHand": false,
    "sell": 1350
  },
  "spear_1": {
    "id": "spear_1",
    "name": "Knucklestone Spear",
    "description": "A crude spear. Two-handed, fast, accurate.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 1,
    "acc": 5,
    "dmg": 2,
    "attackStyle": "stab",
    "wepType": "spear",
    "speed": 1800,
    "twoHand": true,
    "sell": 28
  },
  "spear_3": {
    "id": "spear_3",
    "name": "Ashiron Spear",
    "description": "An ashiron spear. Two-handed, fast, accurate.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 3,
    "acc": 15,
    "dmg": 7,
    "attackStyle": "stab",
    "wepType": "spear",
    "speed": 1800,
    "twoHand": true,
    "sell": 145
  },
  "spear_4": {
    "id": "spear_4",
    "name": "Ribstone Spear",
    "description": "A ribstone spear. Two-handed, fast, accurate.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 4,
    "acc": 23,
    "dmg": 11,
    "attackStyle": "stab",
    "wepType": "spear",
    "speed": 1800,
    "twoHand": true,
    "sell": 280
  },
  "spear_6": {
    "id": "spear_6",
    "name": "Bloodore Spear",
    "description": "A bloodore spear. Two-handed, fast, accurate.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 6,
    "acc": 46,
    "dmg": 23,
    "attackStyle": "stab",
    "wepType": "spear",
    "speed": 1800,
    "twoHand": true,
    "sell": 775
  },
  "spear_9": {
    "id": "spear_9",
    "name": "Voidstone Spear",
    "description": "Dark and precise.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 9,
    "acc": 78,
    "dmg": 41,
    "attackStyle": "stab",
    "wepType": "spear",
    "speed": 1800,
    "twoHand": true,
    "sell": 1530
  },
  "spear_10": {
    "id": "spear_10",
    "name": "Hearthite Spear",
    "description": "A hearthite spear. Two-handed, fast, accurate.",
    "icon": "🗡️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 10,
    "acc": 83,
    "dmg": 44,
    "attackStyle": "stab",
    "wepType": "spear",
    "speed": 1800,
    "twoHand": true,
    "sell": 1950
  },
  "dagger_1": {
    "id": "dagger_1",
    "name": "Knucklestone Dagger",
    "description": "A crude iron shiv. Fast and disposable.",
    "icon": "🔪",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 1,
    "acc": 3,
    "dmg": 1,
    "attackStyle": "stab",
    "wepType": "dagger",
    "speed": 1600,
    "sell": 20
  },
  "dagger_3": {
    "id": "dagger_3",
    "name": "Ashiron Dagger",
    "description": "Well-balanced and quick. Favoured by scouts.",
    "icon": "🔪",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 3,
    "acc": 12,
    "dmg": 4,
    "attackStyle": "stab",
    "wepType": "dagger",
    "speed": 1700,
    "sell": 110
  },
  "dagger_4": {
    "id": "dagger_4",
    "name": "Ribstone Dagger",
    "description": "Dense and sharp. Punches through gaps in armour.",
    "icon": "🔪",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 4,
    "acc": 18,
    "dmg": 6,
    "attackStyle": "stab",
    "wepType": "dagger",
    "speed": 1800,
    "sell": 210
  },
  "dagger_5": {
    "id": "dagger_5",
    "name": "Spinite Dagger",
    "description": "Cold-steel point, quick in the hand. Finds the gaps ribstone never could.",
    "icon": "🔪",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 5,
    "acc": 26,
    "dmg": 9,
    "attackStyle": "stab",
    "wepType": "dagger",
    "speed": 1850,
    "sell": 400
  },
  "dagger_6": {
    "id": "dagger_6",
    "name": "Bloodore Dagger",
    "description": "The red dagger stains everything it touches.",
    "icon": "🔪",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 6,
    "acc": 34,
    "dmg": 12,
    "attackStyle": "stab",
    "wepType": "dagger",
    "speed": 1900,
    "sell": 590
  },
  "dagger_9": {
    "id": "dagger_9",
    "name": "Voidstone Dagger",
    "description": "Cold-edged, faster.",
    "icon": "🔪",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 9,
    "acc": 54,
    "dmg": 19,
    "attackStyle": "stab",
    "wepType": "dagger",
    "speed": 2000,
    "sell": 1160
  },
  "dagger_10": {
    "id": "dagger_10",
    "name": "Hearthite Dagger",
    "description": "A warm, living edge. The fastest blade in Varath.",
    "icon": "🔪",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 10,
    "acc": 58,
    "dmg": 21,
    "attackStyle": "stab",
    "wepType": "dagger",
    "speed": 2000,
    "sell": 1480
  },
  "hammer_1": {
    "id": "hammer_1",
    "name": "Knucklestone Mace",
    "description": "A heavy lump of crude iron. Slow, but it lands hard.",
    "icon": "🔨",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 1,
    "acc": 1,
    "dmg": 3,
    "attackStyle": "crush",
    "wepType": "hammer",
    "speed": 3200,
    "sell": 28
  },
  "hammer_3": {
    "id": "hammer_3",
    "name": "Ashiron Mace",
    "description": "A warhammer for real fights. Dents armour like clay.",
    "icon": "🔨",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 3,
    "acc": 6,
    "dmg": 12,
    "attackStyle": "crush",
    "wepType": "hammer",
    "speed": 3400,
    "sell": 145
  },
  "hammer_4": {
    "id": "hammer_4",
    "name": "Ribstone Mace",
    "description": "The weight alone is threatening. Bone-breaking on impact.",
    "icon": "🔨",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 4,
    "acc": 10,
    "dmg": 18,
    "attackStyle": "crush",
    "wepType": "hammer",
    "speed": 3400,
    "sell": 280
  },
  "hammer_6": {
    "id": "hammer_6",
    "name": "Bloodore Mace",
    "description": "A brutal red maul. Stone and armour crumble under it.",
    "icon": "🔨",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 6,
    "acc": 22,
    "dmg": 36,
    "attackStyle": "crush",
    "wepType": "hammer",
    "speed": 3600,
    "sell": 775
  },
  "hammer_9": {
    "id": "hammer_9",
    "name": "Voidstone Mace",
    "description": "Cold and crushing.",
    "icon": "🔨",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 9,
    "acc": 36,
    "dmg": 60,
    "attackStyle": "crush",
    "wepType": "hammer",
    "speed": 3800,
    "sell": 1530
  },
  "hammer_10": {
    "id": "hammer_10",
    "name": "Hearthite Mace",
    "description": "The mightiest crushing weapon in Varath. The ground shakes.",
    "icon": "🔨",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 10,
    "acc": 40,
    "dmg": 64,
    "attackStyle": "crush",
    "wepType": "hammer",
    "speed": 3800,
    "sell": 1950
  },
  "claymore_1": {
    "id": "claymore_1",
    "name": "Knucklestone Greatsword",
    "description": "A crude two-handed blade. Unwieldy, but devastating.",
    "icon": "⚔️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 1,
    "acc": 1,
    "dmg": 5,
    "attackStyle": "slash",
    "wepType": "claymore",
    "speed": 3200,
    "twoHand": true,
    "sell": 32
  },
  "claymore_3": {
    "id": "claymore_3",
    "name": "Ashiron Greatsword",
    "description": "A proper greatsword. Requires both hands and real conviction.",
    "icon": "⚔️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 3,
    "acc": 7,
    "dmg": 17,
    "attackStyle": "slash",
    "wepType": "claymore",
    "speed": 3400,
    "twoHand": true,
    "sell": 165
  },
  "claymore_4": {
    "id": "claymore_4",
    "name": "Ribstone Greatsword",
    "description": "Immense and merciless. Takes practice just to lift cleanly.",
    "icon": "⚔️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 4,
    "acc": 12,
    "dmg": 25,
    "attackStyle": "slash",
    "wepType": "claymore",
    "speed": 3400,
    "twoHand": true,
    "sell": 320
  },
  "claymore_6": {
    "id": "claymore_6",
    "name": "Bloodore Greatsword",
    "description": "The red greatsword leaves a trail. Not all of it is the enemy's.",
    "icon": "⚔️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 6,
    "acc": 24,
    "dmg": 48,
    "attackStyle": "slash",
    "wepType": "claymore",
    "speed": 3500,
    "twoHand": true,
    "sell": 890
  },
  "claymore_9": {
    "id": "claymore_9",
    "name": "Voidstone Greatsword",
    "description": "Cold and terrifyingly sharp.",
    "icon": "⚔️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 9,
    "acc": 40,
    "dmg": 80,
    "attackStyle": "slash",
    "wepType": "claymore",
    "speed": 3600,
    "twoHand": true,
    "sell": 1750
  },
  "claymore_10": {
    "id": "claymore_10",
    "name": "Hearthite Greatsword",
    "description": "The greatest blade in Varath. One swing reshapes the field.",
    "icon": "⚔️",
    "cat": "Weapons",
    "slot": "mainhand",
    "tier": 10,
    "acc": 43,
    "dmg": 86,
    "attackStyle": "slash",
    "wepType": "claymore",
    "speed": 3600,
    "twoHand": true,
    "sell": 2230
  },
  "ring_1": {
    "id": "ring_1",
    "name": "Knucklestone Ring",
    "description": "A crude hammered ring. Modest accuracy.",
    "icon": "💍",
    "cat": "Jewellery",
    "slot": "ring",
    "acc": 3,
    "sell": 35
  },
  "ring_3": {
    "id": "ring_3",
    "name": "Ashiron Ring",
    "description": "A well-forged ring of ashiron.",
    "icon": "💍",
    "cat": "Jewellery",
    "slot": "ring",
    "acc": 7,
    "sell": 90
  },
  "ring_5": {
    "id": "ring_5",
    "name": "Spinite Ring",
    "description": "A dark ring that sits unnaturally still on the finger.",
    "icon": "💍",
    "cat": "Jewellery",
    "slot": "ring",
    "acc": 13,
    "sell": 220
  },
  "ring_8": {
    "id": "ring_8",
    "name": "Hearthite Ring",
    "description": "Warm to the touch. The finest ring a smith can produce.",
    "icon": "💍",
    "cat": "Jewellery",
    "slot": "ring",
    "acc": 22,
    "sell": 800
  },
  "mount_pony": {
    "id": "mount_pony",
    "name": "Knuckle Pony",
    "description": "A stocky moorland pony — calm in a collapsing shaft. Cuts Descent hazard by 25%.",
    "icon": "🐴",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 200,
    "meta": {
      "rideReq": 1,
      "cost": 500,
      "perk": "descent_hazard",
      "perkAmt": 0.25
    }
  },
  "mount_horse": {
    "id": "mount_horse",
    "name": "Greyoak Stallion",
    "description": "A tall forest horse that hauls more out than it should. +10% chance of an extra resource per gather.",
    "icon": "🐴",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 800,
    "meta": {
      "rideReq": 20,
      "cost": 2000,
      "perk": "gather_extra",
      "perkAmt": 0.1
    }
  },
  "mount_destrier": {
    "id": "mount_destrier",
    "name": "War Destrier",
    "description": "A battle-bred charger that keeps the advance. −40% respawn pause between kills.",
    "icon": "🐎",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 3200,
    "meta": {
      "rideReq": 40,
      "cost": 8000,
      "perk": "respawn_speed",
      "perkAmt": 0.4
    }
  },
  "mount_hound": {
    "id": "mount_hound",
    "name": "Shadow Hound",
    "description": "Not a horse. Tireless while you are away. +15% offline progress.",
    "icon": "🐕",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 32000,
    "meta": {
      "rideReq": 80,
      "cost": 80000,
      "perk": "offline_boost",
      "perkAmt": 0.15
    }
  },
  "mount_runemarked": {
    "id": "mount_runemarked",
    "name": "The Runemarked",
    "description": "A creature from old stories. Varath musters to it — +1 expedition member slot.",
    "icon": "✨",
    "cat": "Mounts",
    "slot": "mount",
    "meta": {
      "rideReq": 90,
      "perk": "expedition_slot",
      "perkAmt": 1
    }
  },
  "mount_mule": {
    "id": "mount_mule",
    "name": "Knuckle Mule",
    "description": "A stubborn hill mule, sure on loose scree. −30% Descent hazard.",
    "icon": "🫏",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 600,
    "meta": {
      "rideReq": 10,
      "cost": 1200,
      "perk": "descent_hazard",
      "perkAmt": 0.3
    }
  },
  "mount_palecrawler": {
    "id": "mount_palecrawler",
    "name": "Saddled Crawler",
    "description": "A cave crawler broken to the saddle. It knows where the rock is sound. −55% Descent hazard.",
    "icon": "🕷️",
    "cat": "Mounts",
    "slot": "mount",
    "meta": {
      "rideReq": 60,
      "perk": "descent_hazard",
      "perkAmt": 0.55
    }
  },
  "mount_deepstrider": {
    "id": "mount_deepstrider",
    "name": "Deepstone Strider",
    "description": "A walking fragment of the Marrow's making. The deep does not threaten what the deep built. −70% Descent hazard.",
    "icon": "🗿",
    "cat": "Mounts",
    "slot": "mount",
    "meta": {
      "rideReq": 80,
      "perk": "descent_hazard",
      "perkAmt": 0.7
    }
  },
  "mount_ox": {
    "id": "mount_ox",
    "name": "Moor Ox",
    "description": "A broad-backed ox that carries more than it should. +6% chance of an extra resource per gather.",
    "icon": "🐂",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 350,
    "meta": {
      "rideReq": 5,
      "cost": 700,
      "perk": "gather_extra",
      "perkAmt": 0.06
    }
  },
  "mount_bristleback": {
    "id": "mount_bristleback",
    "name": "Bristleback Boar",
    "description": "Roots up more than you'd think. +13% extra-gather chance.",
    "icon": "🐗",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 3000,
    "meta": {
      "rideReq": 30,
      "cost": 6000,
      "perk": "gather_extra",
      "perkAmt": 0.13
    }
  },
  "mount_aurochs": {
    "id": "mount_aurochs",
    "name": "Ashen Aurochs",
    "description": "Hauls a full day's gather without complaint. +16% extra-gather chance.",
    "icon": "🐃",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 11000,
    "meta": {
      "rideReq": 55,
      "cost": 22000,
      "perk": "gather_extra",
      "perkAmt": 0.16
    }
  },
  "mount_packbear": {
    "id": "mount_packbear",
    "name": "Crag Pack-Bear",
    "description": "A crag bear that carries instead of mauls. Mostly. +22% extra-gather chance.",
    "icon": "🐻",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 37000,
    "meta": {
      "rideReq": 75,
      "cost": 75000,
      "perk": "gather_extra",
      "perkAmt": 0.22
    }
  },
  "mount_greymane": {
    "id": "mount_greymane",
    "name": "Greymane Boar",
    "description": "The great grey boar hunted in the deepest Greyoak. Ride it and the wood gives more freely. +20% extra-gather chance.",
    "icon": "🐗",
    "cat": "Mounts",
    "slot": "mount",
    "meta": {
      "rideReq": 65,
      "perk": "gather_extra",
      "perkAmt": 0.2
    }
  },
  "mount_ridgewolf": {
    "id": "mount_ridgewolf",
    "name": "Dire Ridgewolf",
    "description": "Won't let a kill cool. −25% respawn pause.",
    "icon": "🐺",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 2500,
    "meta": {
      "rideReq": 25,
      "cost": 5000,
      "perk": "respawn_speed",
      "perkAmt": 0.25
    }
  },
  "mount_ironboar": {
    "id": "mount_ironboar",
    "name": "Ironside Boar",
    "description": "A boar bred for the charge, plated at the shoulder. −35% respawn pause.",
    "icon": "🐗",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 7000,
    "meta": {
      "rideReq": 45,
      "cost": 14000,
      "perk": "respawn_speed",
      "perkAmt": 0.35
    }
  },
  "mount_silverwolf": {
    "id": "mount_silverwolf",
    "name": "Silver Wolf",
    "description": "The pale rare of the Knuckle Hills. It hunts beside you and never tires of it. −55% respawn pause.",
    "icon": "🐺",
    "cat": "Mounts",
    "slot": "mount",
    "meta": {
      "rideReq": 60,
      "perk": "respawn_speed",
      "perkAmt": 0.55
    }
  },
  "mount_courier": {
    "id": "mount_courier",
    "name": "Courier Pony",
    "description": "The Ironvale Courier's own breed. Born to run the roads. −10% expedition time.",
    "icon": "🐴",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 1500,
    "meta": {
      "rideReq": 15,
      "cost": 3000,
      "perk": "expedition_time",
      "perkAmt": 0.1
    }
  },
  "mount_stormhound": {
    "id": "mount_stormhound",
    "name": "Storm Hound",
    "description": "Runs ahead of the weather. −18% expedition time.",
    "icon": "🐕",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 15000,
    "meta": {
      "rideReq": 50,
      "cost": 30000,
      "perk": "expedition_time",
      "perkAmt": 0.18
    }
  },
  "mount_dustrunner": {
    "id": "mount_dustrunner",
    "name": "Redrun Courser",
    "description": "Bred along the red river for distance and speed. −25% expedition time.",
    "icon": "🐎",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 45000,
    "meta": {
      "rideReq": 75,
      "cost": 90000,
      "perk": "expedition_time",
      "perkAmt": 0.25
    }
  },
  "mount_ferryman": {
    "id": "mount_ferryman",
    "name": "Ferryman's Steed",
    "description": "It crosses what others can't, and asks the same toll. −30% expedition time.",
    "icon": "🐴",
    "cat": "Mounts",
    "slot": "mount",
    "meta": {
      "rideReq": 85,
      "perk": "expedition_time",
      "perkAmt": 0.3
    }
  },
  "mount_nighthound": {
    "id": "mount_nighthound",
    "name": "Night Hound",
    "description": "Works the dark while you rest. +8% offline progress.",
    "icon": "🐕‍🦺",
    "cat": "Mounts",
    "slot": "mount",
    "sell": 3200,
    "meta": {
      "rideReq": 30,
      "cost": 6500,
      "perk": "offline_boost",
      "perkAmt": 0.08
    }
  },
  "mount_deepwing": {
    "id": "mount_deepwing",
    "name": "Deepwing Bat",
    "description": "A bat of the Marrow Deeps, never still in the dark. +12% offline progress.",
    "icon": "🦇",
    "cat": "Mounts",
    "slot": "mount",
    "meta": {
      "rideReq": 55,
      "perk": "offline_boost",
      "perkAmt": 0.12
    }
  },
  "mount_wraithsteed": {
    "id": "mount_wraithsteed",
    "name": "Wraith-Steed",
    "description": "A remnant that does not sleep, and lets you do the same work through it. +18% offline progress.",
    "icon": "👻",
    "cat": "Mounts",
    "slot": "mount",
    "meta": {
      "rideReq": 85,
      "perk": "offline_boost",
      "perkAmt": 0.18
    }
  },
  "mount_lodgeoutrider": {
    "id": "mount_lodgeoutrider",
    "name": "Lodge Outrider",
    "description": "Granted to those the Wayfarers' Lodge trusts to ride point. +1 expedition member slot.",
    "icon": "🐎",
    "cat": "Mounts",
    "slot": "mount",
    "meta": {
      "rideReq": 50,
      "perk": "expedition_slot",
      "perkAmt": 1
    }
  },
  "mount_hollowsteed": {
    "id": "mount_hollowsteed",
    "name": "Hollow Steed",
    "description": "It musters the unaccounted to ride with you. +1 expedition member slot.",
    "icon": "💀",
    "cat": "Mounts",
    "slot": "mount",
    "meta": {
      "rideReq": 70,
      "perk": "expedition_slot",
      "perkAmt": 1
    }
  },
  "prosp_helmet": {
    "id": "prosp_helmet",
    "name": "Prospector Helmet",
    "description": "+0.5% Mining XP. Part of the Prospector's Set (5% total when complete).",
    "icon": "⛏️",
    "cat": "Gathering Gear",
    "slot": "helmet",
    "meta": {
      "skillBonus": "mining",
      "xpPct": 0.005
    }
  },
  "prosp_jacket": {
    "id": "prosp_jacket",
    "name": "Prospector Jacket",
    "description": "+0.5% Mining XP. Part of the Prospector's Set (5% total when complete).",
    "icon": "🦺",
    "cat": "Gathering Gear",
    "slot": "armor",
    "meta": {
      "skillBonus": "mining",
      "xpPct": 0.005
    }
  },
  "prosp_trousers": {
    "id": "prosp_trousers",
    "name": "Prospector Trousers",
    "description": "+0.5% Mining XP. Part of the Prospector's Set (5% total when complete).",
    "icon": "👖",
    "cat": "Gathering Gear",
    "slot": "legs",
    "meta": {
      "skillBonus": "mining",
      "xpPct": 0.005
    }
  },
  "prosp_boots": {
    "id": "prosp_boots",
    "name": "Prospector Boots",
    "description": "+0.5% Mining XP. Part of the Prospector's Set (5% total when complete).",
    "icon": "🥾",
    "cat": "Gathering Gear",
    "slot": "boots",
    "meta": {
      "skillBonus": "mining",
      "xpPct": 0.005
    }
  },
  "lumber_hat": {
    "id": "lumber_hat",
    "name": "Lumberjack Hat",
    "description": "+0.5% Forestry XP. Part of the Lumberjack's Set (5% total when complete).",
    "icon": "🪖",
    "cat": "Gathering Gear",
    "slot": "helmet",
    "meta": {
      "skillBonus": "forestry",
      "xpPct": 0.005
    }
  },
  "lumber_top": {
    "id": "lumber_top",
    "name": "Lumberjack Top",
    "description": "+0.5% Forestry XP. Part of the Lumberjack's Set (5% total when complete).",
    "icon": "🧥",
    "cat": "Gathering Gear",
    "slot": "armor",
    "meta": {
      "skillBonus": "forestry",
      "xpPct": 0.005
    }
  },
  "lumber_legs": {
    "id": "lumber_legs",
    "name": "Lumberjack Legs",
    "description": "+0.5% Forestry XP. Part of the Lumberjack's Set (5% total when complete).",
    "icon": "👖",
    "cat": "Gathering Gear",
    "slot": "legs",
    "meta": {
      "skillBonus": "forestry",
      "xpPct": 0.005
    }
  },
  "lumber_boots": {
    "id": "lumber_boots",
    "name": "Lumberjack Boots",
    "description": "+0.5% Forestry XP. Part of the Lumberjack's Set (5% total when complete).",
    "icon": "🥾",
    "cat": "Gathering Gear",
    "slot": "boots",
    "meta": {
      "skillBonus": "forestry",
      "xpPct": 0.005
    }
  },
  "angler_hat": {
    "id": "angler_hat",
    "name": "Angler Hat",
    "description": "+0.5% Fishing XP. Part of the Angler's Set (5% total when complete).",
    "icon": "🎩",
    "cat": "Gathering Gear",
    "slot": "helmet",
    "meta": {
      "skillBonus": "fishing",
      "xpPct": 0.005
    }
  },
  "angler_top": {
    "id": "angler_top",
    "name": "Angler Top",
    "description": "+0.5% Fishing XP. Part of the Angler's Set (5% total when complete).",
    "icon": "🧥",
    "cat": "Gathering Gear",
    "slot": "armor",
    "meta": {
      "skillBonus": "fishing",
      "xpPct": 0.005
    }
  },
  "angler_waders": {
    "id": "angler_waders",
    "name": "Angler Waders",
    "description": "+0.5% Fishing XP. Part of the Angler's Set (5% total when complete).",
    "icon": "👖",
    "cat": "Gathering Gear",
    "slot": "legs",
    "meta": {
      "skillBonus": "fishing",
      "xpPct": 0.005
    }
  },
  "angler_boots": {
    "id": "angler_boots",
    "name": "Angler Boots",
    "description": "+0.5% Fishing XP. Part of the Angler's Set (5% total when complete).",
    "icon": "🥾",
    "cat": "Gathering Gear",
    "slot": "boots",
    "meta": {
      "skillBonus": "fishing",
      "xpPct": 0.005
    }
  },
  "farmer_hat": {
    "id": "farmer_hat",
    "name": "Farmer Hat",
    "description": "+0.5% Farming XP. Part of the Farmer's Set (5% total when complete).",
    "icon": "👒",
    "cat": "Gathering Gear",
    "slot": "helmet",
    "meta": {
      "skillBonus": "farming",
      "xpPct": 0.005
    }
  },
  "farmer_jacket": {
    "id": "farmer_jacket",
    "name": "Farmer Jacket",
    "description": "+0.5% Farming XP. Part of the Farmer's Set (5% total when complete).",
    "icon": "🦺",
    "cat": "Gathering Gear",
    "slot": "armor",
    "meta": {
      "skillBonus": "farming",
      "xpPct": 0.005
    }
  },
  "farmer_legs": {
    "id": "farmer_legs",
    "name": "Farmer Legs",
    "description": "+0.5% Farming XP. Part of the Farmer's Set (5% total when complete).",
    "icon": "👖",
    "cat": "Gathering Gear",
    "slot": "legs",
    "meta": {
      "skillBonus": "farming",
      "xpPct": 0.005
    }
  },
  "farmer_boots": {
    "id": "farmer_boots",
    "name": "Farmer Boots",
    "description": "+0.5% Farming XP. Part of the Farmer's Set (5% total when complete).",
    "icon": "🥾",
    "cat": "Gathering Gear",
    "slot": "boots",
    "meta": {
      "skillBonus": "farming",
      "xpPct": 0.005
    }
  },

  // --- Agility Marks + the Trailblazer outfit (earned on the Varathian Trail) ---
  "pier_chit": {
    "id": "pier_chit",
    "name": "Angler's Chit",
    "description": "Jacob's tally token, cut for every catch weighed off the Drowned Pier — the heavier the fish, the more chits. Trade them at his fish racks for fresh raw catch.",
    "icon": "🎫",
    "cat": "Finds",
    "stackable": true,
    "sell": 0
  },
  "pet_pier_crab": {
    "id": "pet_pier_crab",
    "name": "Pier Crab",
    "description": "A stout red shore-crab that took up under Jacob's racks and never left. Fifty chits' worth of loyalty — it sidles after you now, claws up, defending a pier it will never see again.",
    "icon": "🦀",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0
  },
  "agility_mark": {
    "id": "agility_mark",
    "name": "Agility Mark",
    "description": "A runner's token, struck for each full lap of the Varathian Trail. Cael the Trailkeeper trades these for the Trailblazer outfit.",
    "icon": "🎗️",
    "cat": "Finds",
    "stackable": true,
    "sell": 0
  },
  "lamp_agility": {
    "id": "lamp_agility",
    "name": "Trailblazer's Lamp",
    "description": "A runner's lantern Cael strikes from spare Marks. Open it to pour its light straight into your Agility — the more seasoned the runner, the brighter it burns. Cael keeps striking them for anyone with Marks to spare.",
    "icon": "🏮",
    "cat": "Finds",
    "container": true,
    "stackable": true,
    "sell": 0
  },
  "trail_hood": {
    "id": "trail_hood",
    "name": "Trailblazer Hood",
    "description": "Light running gear. Each worn piece slows how fast you tire and speeds your recovery — the full set of four saves the most breath.",
    "icon": "🏃",
    "cat": "Gathering Gear",
    "slot": "helmet",
    "meta": { "agilityGear": true }
  },
  "trail_vest": {
    "id": "trail_vest",
    "name": "Trailblazer Vest",
    "description": "Light running gear. Each worn piece slows how fast you tire and speeds your recovery — the full set of four saves the most breath.",
    "icon": "🎽",
    "cat": "Gathering Gear",
    "slot": "armor",
    "meta": { "agilityGear": true }
  },
  "trail_legs": {
    "id": "trail_legs",
    "name": "Trailblazer Leggings",
    "description": "Light running gear. Each worn piece slows how fast you tire and speeds your recovery — the full set of four saves the most breath.",
    "icon": "👖",
    "cat": "Gathering Gear",
    "slot": "legs",
    "meta": { "agilityGear": true }
  },
  "trail_boots": {
    "id": "trail_boots",
    "name": "Trailblazer Boots",
    "description": "Light running gear. Each worn piece slows how fast you tire and speeds your recovery — the full set of four saves the most breath.",
    "icon": "🥾",
    "cat": "Gathering Gear",
    "slot": "boots",
    "meta": { "agilityGear": true }
  },
  "cape_mining": {
    "id": "cape_mining",
    "name": "Stone Master's Cape",
    "description": "The mark of a master miner. The stone yields to your eye.",
    "icon": "🪨",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "mining"
    }
  },
  "cape_smithing": {
    "id": "cape_smithing",
    "name": "Forgemaster's Cape",
    "description": "The mark of a master smith. The forge obeys your hands.",
    "icon": "🔨",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "smithing"
    }
  },
  "cape_forestry": {
    "id": "cape_forestry",
    "name": "Old Growth Cape",
    "description": "The mark of a master forester. The oldest trees bow for you.",
    "icon": "🌲",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "forestry"
    }
  },
  "cape_woodcraft": {
    "id": "cape_woodcraft",
    "name": "Bowwright's Cape",
    "description": "The mark of a master bowyer. Every shaft runs true.",
    "icon": "🪚",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "woodcraft"
    }
  },
  "cape_fishing": {
    "id": "cape_fishing",
    "name": "Angler's Cape",
    "description": "The mark of a master angler. The fish come to you.",
    "icon": "🎣",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "fishing"
    }
  },
  "cape_cooking": {
    "id": "cape_cooking",
    "name": "Hearthkeeper's Cape",
    "description": "The mark of a master cook. Nothing burns.",
    "icon": "🍳",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "cooking"
    }
  },
  "cape_farming": {
    "id": "cape_farming",
    "name": "Harvest Cape",
    "description": "The mark of a master farmer. Every seed takes root.",
    "icon": "🌾",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "farming"
    }
  },
  "cape_survivalist": {
    "id": "cape_survivalist",
    "name": "Wayfarer's Cape",
    "description": "The mark of a true survivalist. Varath holds no secrets from you.",
    "icon": "🏕️",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "survivalist"
    }
  },
  "cape_bounty": {
    "id": "cape_bounty",
    "name": "Hunter's Cape",
    "description": "The mark of a master hunter. Every task is a certainty.",
    "icon": "🎯",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "bounty"
    }
  },
  "cape_vitality": {
    "id": "cape_vitality",
    "name": "Life's Cape",
    "description": "The mark of a hardened warrior. You endure what others cannot.",
    "icon": "❤️",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "vitality"
    }
  },
  "cape_edge": {
    "id": "cape_edge",
    "name": "Edgemaster's Cape",
    "description": "The mark of a master swordsman. The edge never dulls.",
    "icon": "⚔️",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "edge"
    }
  },
  "cape_vigour": {
    "id": "cape_vigour",
    "name": "Vigour Cape",
    "description": "The mark of the strongest fighter. Each strike carries weight.",
    "icon": "💪",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "vigour"
    }
  },
  "cape_ward": {
    "id": "cape_ward",
    "name": "Shield-Ward Cape",
    "description": "The mark of an unbreakable defender. Blows glance off you.",
    "icon": "🛡️",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "ward"
    }
  },
  "cape_draw": {
    "id": "cape_draw",
    "name": "Marksmanship Cape",
    "description": "The mark of the finest archer in Varath. The shot is always true.",
    "icon": "🏹",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "draw"
    }
  },
  "cape_faith": {
    "id": "cape_faith",
    "name": "Devotion's Cape",
    "description": "The mark of a soul at one hundred. Grace moves through the weave like breath.",
    "icon": "🔮",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "faith"
    }
  },
  "cape_construction": {
    "id": "cape_construction",
    "name": "Builder's Cape",
    "description": "The mark of the master builder of Varath. Every stone is set true.",
    "icon": "🏗️",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "construction"
    }
  },
  "cape_herblore": {
    "id": "cape_herblore",
    "name": "Alchemist's Cape",
    "description": "The mark of a master herbalist. Every potion runs true and strong.",
    "icon": "⚗️",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "herblore"
    }
  },
  "cape_crafting": {
    "id": "cape_crafting",
    "name": "Artisan's Cape",
    "description": "The mark of Varath's master craftsman. Leather, glass, and gem yield to your hands.",
    "icon": "✂️",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "crafting"
    }
  },
  "cape_hunter": {
    "id": "cape_hunter",
    "name": "Trapper's Cape",
    "description": "The mark of a master hunter. The moor gives up what it holds.",
    "icon": "🪤",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "hunter"
    }
  },
  "cape_max": {
    "id": "cape_max",
    "name": "Cape of Varath",
    "description": "The master's cape, worn: +5% to all XP, +20 max HP, +5 Edge, Vigour, Draw and Ward, +25% Hunt Marks, and a master angler's edge at the pier. The mark of a complete Varath.",
    "icon": "🌟",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "max"
    }
  },
  "cape_ashforge": {
    "id": "cape_ashforge",
    "name": "Ashforge Mantle",
    "description": "The Brotherhood's own cloak, given only to those the smiths call Allied. Worn ash-grey and ember-lined — a cosmetic mark of standing at the anvil.",
    "icon": "⚒️",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0
  },
  "cape_lodge": {
    "id": "cape_lodge",
    "name": "Warden's Greatcloak",
    "description": "The deep-green cloak of the Warden's Lodge, cut for those who keep Greyoak. A cosmetic mark that the wardens count you one of their own.",
    "icon": "🌲",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0
  },
  "cape_pale_record": {
    "id": "cape_pale_record",
    "name": "Pale Record Shroud",
    "description": "The bone-white shroud of the Order that remembers. Worn by those the Pale Record trusts with what the world forgets — a cosmetic mark of allegiance.",
    "icon": "📜",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0
  },
  "cape_heartmoor": {
    "id": "cape_heartmoor",
    "name": "Heartmoor Veil",
    "description": "The candle-warm veil of the Heartmoor faithful, given to allies of the warm stone. It carries no power — only the standing of the road it keeps.",
    "icon": "🕯️",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0
  },
  "cape_ironvale": {
    "id": "cape_ironvale",
    "name": "Ironvale's Cape",
    "description": "A prestige reskin of the Cape of Varath. Carries every benefit of the Cape of Varath — it is the same power, differently dressed. Awarded only to those who have filled the collection log and claimed every achievement.",
    "icon": "✨",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "skill": "ironvale"
    }
  },
  "cape_founder": {
    "id": "cape_founder",
    "name": "Founder's Mantle",
    "description": "A deep ember-and-black cape worn by those who backed Varath in its first days. It carries no power at all — it never will — only the standing of having been here at the start. Never sold, dropped, or given again.",
    "icon": "🔥",
    "cat": "Founder",
    "slot": "cape",
    "sell": 0,
    "meta": {
      "founder": true
    }
  },
  "charcoal": {
    "id": "charcoal",
    "name": "Charcoal",
    "description": "Produced by burning wood. Used as a cheaper substitute for Embercite in smelting, at two charcoal per ore.",
    "icon": "⬛",
    "cat": "Materials",
    "sell": 22
  },
  "raw_hide": {
    "id": "raw_hide",
    "name": "Raw Hide",
    "description": "A scraped, untreated hide from a moor rat. Tan it at the Crafting bench.",
    "icon": "🟤",
    "cat": "Leathers",
    "sell": 8
  },
  "tanned_leather": {
    "id": "tanned_leather",
    "name": "Tanned Leather",
    "description": "Cured and softened hide. The foundation of leatherwork.",
    "icon": "🟫",
    "cat": "Leathers",
    "sell": 20
  },
  "cured_leather": {
    "id": "cured_leather",
    "name": "Cured Leather",
    "description": "Cured wolf hide, supple and durable. Good for serious armour.",
    "icon": "🟫",
    "cat": "Leathers",
    "sell": 55
  },
  "hardened_leather": {
    "id": "hardened_leather",
    "name": "Hardened Leather",
    "description": "Bear hide treated and hardened over fire. Rivals light plate in protection.",
    "icon": "🟫",
    "cat": "Leathers",
    "sell": 130
  },
  "master_leather": {
    "id": "master_leather",
    "name": "Master Leather",
    "description": "Hardened leather reinforced with ashiron rivets. The pinnacle of the leatherworker's craft.",
    "icon": "🟫",
    "cat": "Leathers",
    "sell": 350
  },
  "silica_sand": {
    "id": "silica_sand",
    "name": "Silica Sand",
    "description": "Quartz-rich sand found in certain rock veins. Melted down by glassblowers into raw glass.",
    "icon": "🪨",
    "cat": "Materials",
    "sell": 12
  },
  "glass_vial": {
    "id": "glass_vial",
    "name": "Glass Vial",
    "description": "A small glass vial. Herblore can use these to stretch potions further.",
    "icon": "🧪",
    "cat": "Glass",
    "sell": 28
  },
  "glass_bead": {
    "id": "glass_bead",
    "name": "Glass Bead",
    "description": "A polished glass bead. Jewellers prize these for setting into rings and necklaces.",
    "icon": "🔵",
    "cat": "Glass",
    "sell": 45
  },
  "glass_flask": {
    "id": "glass_flask",
    "name": "Glass Flask",
    "description": "A wide-mouthed flask. Holds double the volume of a vial — potions brewed in these last far longer.",
    "icon": "🫙",
    "cat": "Glass",
    "sell": 90
  },
  "rough_gem": {
    "id": "rough_gem",
    "name": "Rough Gem",
    "description": "An uncut gemstone pulled from deep rock. A skilled craftsman can cut and polish it.",
    "icon": "💎",
    "cat": "Gems",
    "sell": 80
  },
  "cut_gem": {
    "id": "cut_gem",
    "name": "Cut Gem",
    "description": "A faceted, polished gem. Set into rings and necklaces for exceptional power.",
    "icon": "💎",
    "cat": "Gems",
    "sell": 300
  },
  "leath_helm": {
    "id": "leath_helm",
    "name": "Tanned Leather Helm",
    "description": "A simple leather cap. Lighter than metal but protection enough.",
    "icon": "🪖",
    "cat": "Leather Armour",
    "slot": "helmet",
    "def": 3,
    "craftTier": 1,
    "sell": 35
  },
  "leath_body": {
    "id": "leath_body",
    "name": "Tanned Leather Coat",
    "description": "A stitched leather jerkin. Flexible and decent protection.",
    "icon": "🥋",
    "cat": "Leather Armour",
    "slot": "armor",
    "def": 6,
    "craftTier": 1,
    "sell": 70
  },
  "leath_legs": {
    "id": "leath_legs",
    "name": "Tanned Leather Legs",
    "description": "Leather breeches, reinforced at the knees.",
    "icon": "🩲",
    "cat": "Leather Armour",
    "slot": "legs",
    "def": 4,
    "craftTier": 1,
    "sell": 55
  },
  "leath_boots": {
    "id": "leath_boots",
    "name": "Tanned Leather Boots",
    "description": "Soft leather boots. Quiet on stone.",
    "icon": "🥾",
    "cat": "Leather Armour",
    "slot": "boots",
    "def": 2,
    "craftTier": 1,
    "sell": 25
  },
  "cured_helm": {
    "id": "cured_helm",
    "name": "Cured Leather Helm",
    "description": "A shaped, cured leather helm with studded reinforcement.",
    "icon": "🪖",
    "cat": "Leather Armour",
    "slot": "helmet",
    "def": 7,
    "craftTier": 2,
    "sell": 95
  },
  "cured_body": {
    "id": "cured_body",
    "name": "Cured Leather Coat",
    "description": "A tough cured leather coat. Mid-tier protection and no rattle.",
    "icon": "🥋",
    "cat": "Leather Armour",
    "slot": "armor",
    "def": 14,
    "craftTier": 2,
    "sell": 190
  },
  "cured_legs": {
    "id": "cured_legs",
    "name": "Cured Leather Legs",
    "description": "Cured leather legguards. Substantial and flexible.",
    "icon": "🩲",
    "cat": "Leather Armour",
    "slot": "legs",
    "def": 10,
    "craftTier": 2,
    "sell": 145
  },
  "cured_boots": {
    "id": "cured_boots",
    "name": "Cured Leather Boots",
    "description": "Thick cured boots with a dense sole.",
    "icon": "🥾",
    "cat": "Leather Armour",
    "slot": "boots",
    "def": 5,
    "craftTier": 2,
    "sell": 70
  },
  "hard_helm": {
    "id": "hard_helm",
    "name": "Hardened Leather Helm",
    "description": "Bear-hide helm hardened over fire. Heavy for leather — protective as light plate.",
    "icon": "🪖",
    "cat": "Leather Armour",
    "slot": "helmet",
    "def": 13,
    "craftTier": 3,
    "sell": 230
  },
  "hard_body": {
    "id": "hard_body",
    "name": "Hardened Leather Coat",
    "description": "Overlapping hardened panels. Slashing weapons lose their edge on this.",
    "icon": "🥋",
    "cat": "Leather Armour",
    "slot": "armor",
    "def": 26,
    "craftTier": 3,
    "sell": 460
  },
  "hard_legs": {
    "id": "hard_legs",
    "name": "Hardened Leather Legs",
    "description": "Hardened leather greaves. Solid and silent.",
    "icon": "🩲",
    "cat": "Leather Armour",
    "slot": "legs",
    "def": 19,
    "craftTier": 3,
    "sell": 350
  },
  "hard_boots": {
    "id": "hard_boots",
    "name": "Hardened Leather Boots",
    "description": "Dense, reinforced boots. The stone does not bite through.",
    "icon": "🥾",
    "cat": "Leather Armour",
    "slot": "boots",
    "def": 10,
    "craftTier": 3,
    "sell": 170
  },
  "master_helm": {
    "id": "master_helm",
    "name": "Master Leather Helm",
    "description": "Iron-riveted master craftwork. The finest leather helm in Varath.",
    "icon": "🪖",
    "cat": "Leather Armour",
    "slot": "helmet",
    "def": 22,
    "craftTier": 4,
    "sell": 650
  },
  "master_body": {
    "id": "master_body",
    "name": "Master Leather Coat",
    "description": "Master-grade layered leather and iron. Between a coat of plates and full plate in protection.",
    "icon": "🥋",
    "cat": "Leather Armour",
    "slot": "armor",
    "def": 44,
    "craftTier": 4,
    "sell": 1300
  },
  "master_legs": {
    "id": "master_legs",
    "name": "Master Leather Legs",
    "description": "Master-crafted leg armour. The rivets are set by hand.",
    "icon": "🩲",
    "cat": "Leather Armour",
    "slot": "legs",
    "def": 32,
    "craftTier": 4,
    "sell": 975
  },
  "master_boots": {
    "id": "master_boots",
    "name": "Master Leather Boots",
    "description": "The finest leather boots — thick soles, iron toecaps, hardened uppers.",
    "icon": "🥾",
    "cat": "Leather Armour",
    "slot": "boots",
    "def": 17,
    "craftTier": 4,
    "sell": 480
  },
  "craft_ring_1": {
    "id": "craft_ring_1",
    "name": "Knucklestone Ring",
    "description": "A simple stone-set ring. Modest accuracy.",
    "icon": "💍",
    "cat": "Jewellery",
    "slot": "ring",
    "acc": 4,
    "sell": 45
  },
  "craft_ring_2": {
    "id": "craft_ring_2",
    "name": "Glass-Set Ring",
    "description": "A coldvein band set with a polished glass bead.",
    "icon": "💍",
    "cat": "Jewellery",
    "slot": "ring",
    "acc": 9,
    "sell": 120
  },
  "craft_ring_3": {
    "id": "craft_ring_3",
    "name": "Ashiron Band",
    "description": "A solid ashiron ring with twin glass-bead settings.",
    "icon": "💍",
    "cat": "Jewellery",
    "slot": "ring",
    "acc": 15,
    "sell": 280
  },
  "craft_ring_gem": {
    "id": "craft_ring_gem",
    "name": "Gem-Set Ring",
    "description": "A master ring set with a cut gem. The finest crafted ring in Varath.",
    "icon": "💍",
    "cat": "Jewellery",
    "slot": "ring",
    "acc": 24,
    "sell": 900
  },
  "pearl_ring": {
    "id": "pearl_ring",
    "name": "River Pearl Ring",
    "description": "A coldvein band set with a reddish Redrun pearl. An uncommon find made into an uncommon ring.",
    "icon": "💍",
    "cat": "Jewellery",
    "slot": "ring",
    "acc": 7,
    "sell": 280
  },
  "stone_ring": {
    "id": "stone_ring",
    "name": "River Stone Ring",
    "description": "A smooth river stone set simply in clay and fired. The first ring many crafters make.",
    "icon": "💍",
    "cat": "Jewellery",
    "slot": "ring",
    "acc": 2,
    "sell": 25
  },
  "craft_neck_power": {
    "id": "craft_neck_power",
    "name": "Ironweave Chain",
    "description": "A heavy ashiron chain — the dense links add striking force.",
    "icon": "📿",
    "cat": "Jewellery",
    "slot": "necklace",
    "dmg": 10,
    "sell": 200
  },
  "craft_neck_shield": {
    "id": "craft_neck_shield",
    "name": "Wardstone Pendant",
    "description": "A ribstone pendant carved into a ward-glyph. Bolsters defence.",
    "icon": "📿",
    "cat": "Jewellery",
    "slot": "necklace",
    "def": 14,
    "sell": 250
  },
  "craft_neck_hunter": {
    "id": "craft_neck_hunter",
    "name": "Glass-Eye Pendant",
    "description": "A glass-bead pendant on a fine chain. The bead catches light like an eye.",
    "icon": "📿",
    "cat": "Jewellery",
    "slot": "necklace",
    "acc": 13,
    "sell": 220
  },
  "craft_neck_gem": {
    "id": "craft_neck_gem",
    "name": "Gemstone Necklace",
    "description": "A polished cut gem on a master chain. The pinnacle of craftwork jewellery.",
    "icon": "📿",
    "cat": "Jewellery",
    "slot": "necklace",
    "acc": 18,
    "sell": 1100
  },
  "neck_warden": {
    "id": "neck_warden",
    "name": "Warden's Amulet",
    "description": "A gold amulet set with a single cut gem, struck for the Lodge's senior wardens. A craftsman's late work.",
    "icon": "📿",
    "cat": "Jewellery",
    "slot": "necklace",
    "acc": 22,
    "def": 6,
    "sell": 2200
  },
  "neck_amber": {
    "id": "neck_amber",
    "name": "Heartoak Amber Amulet",
    "description": "A bead of fossil heartoak resin set in gold. Warm to hold, and warmer to wear — the wood's long patience lent to its bearer.",
    "icon": "📿",
    "cat": "Jewellery",
    "slot": "necklace",
    "acc": 20,
    "def": 3,
    "sell": 1800
  },
  "neck_orun": {
    "id": "neck_orun",
    "name": "Orunwrought Amulet",
    "description": "Twin gems on a heavy gold chain, joined by a jeweller at the height of the craft. The finest chain in Varath.",
    "icon": "📿",
    "cat": "Jewellery",
    "slot": "necklace",
    "acc": 30,
    "def": 10,
    "sell": 5000
  },
  "marsh_eel_raw": {
    "id": "marsh_eel_raw",
    "name": "Raw Marsh Eel",
    "description": "A fat, silt-dark eel hauled from the Heartmoor pools. Slippery work, and worth the trouble.",
    "icon": "🐟",
    "cat": "Fish",
    "sell": 34
  },
  "marsh_eel_cooked": {
    "id": "marsh_eel_cooked",
    "name": "Marsh Eel",
    "description": "Smoked over moor-peat until the flesh flakes. Restores 50 HP.",
    "icon": "🍢",
    "cat": "Food",
    "heals": 10,
    "sell": 60
  },
  "moorhart_raw": {
    "id": "moorhart_raw",
    "name": "Raw Moorhart",
    "description": "A cut from the great moor-hart, the wary grey deer of the deep Heartmoor. Few hunters get close enough.",
    "icon": "🥩",
    "cat": "Meat",
    "sell": 44
  },
  "moorhart_cooked": {
    "id": "moorhart_cooked",
    "name": "Moorhart Steak",
    "description": "A dark, rich venison steak, seared through. Restores 68 HP.",
    "icon": "🍖",
    "cat": "Food",
    "heals": 13,
    "sell": 78
  },
  "sigil_knuckle": {
    "id": "sigil_knuckle",
    "name": "Knuckle Sigil",
    "description": "A pressed knucklestone seal — the mark of a Hill man who knows his roots.",
    "icon": "🔰",
    "cat": "Heraldry",
    "slot": "ring",
    "acc": 6,
    "sell": 120
  },
  "sigil_spine": {
    "id": "sigil_spine",
    "name": "Spine Sigil",
    "description": "A spinite-etched insignia. Mountain-born or mountain-tested.",
    "icon": "🔰",
    "cat": "Heraldry",
    "slot": "ring",
    "acc": 14,
    "sell": 380
  },
  "crest_shield": {
    "id": "crest_shield",
    "name": "Crested Shield",
    "description": "A coldvein shield painted with bloodore heraldry. Defence and declaration.",
    "icon": "🛡️",
    "cat": "Heraldry",
    "slot": "offhand",
    "def": 18,
    "twoHand": false,
    "sell": 450
  },
  "crest_shield_master": {
    "id": "crest_shield_master",
    "name": "Master Crest Shield",
    "description": "A ribstone shield with void-pigment insignia. The heraldist's final word on defence.",
    "icon": "🛡️",
    "cat": "Heraldry",
    "slot": "offhand",
    "def": 30,
    "twoHand": false,
    "sell": 900
  },
  "herald_cape_ash": {
    "id": "herald_cape_ash",
    "name": "Ashmark Cape",
    "description": "A grey-dyed travelling cape marked with the ash sigil. +4% gathering speed.",
    "icon": "🧣",
    "cat": "Heraldry",
    "slot": "cape",
    "sell": 200,
    "meta": {
      "gatherBonus": 0.04
    }
  },
  "herald_cape_deep": {
    "id": "herald_cape_deep",
    "name": "Deepmark Cape",
    "description": "A deeproot-dyed cape bearing the old mark. Those who know, nod. +8% gathering speed.",
    "icon": "🧣",
    "cat": "Heraldry",
    "slot": "cape",
    "sell": 600,
    "meta": {
      "gatherBonus": 0.08
    }
  },
  "tip_knucklestone": {
    "id": "tip_knucklestone",
    "name": "Knucklestone Tips",
    "description": "Crude stone arrowheads. They hold a basic edge.",
    "icon": "◁",
    "cat": "Materials",
    "sell": 3
  },
  "tip_ashiron": {
    "id": "tip_ashiron",
    "name": "Ashiron Tips",
    "description": "Proper iron arrowheads. These bite.",
    "icon": "◁",
    "cat": "Materials",
    "sell": 14
  },
  "tip_ribstone": {
    "id": "tip_ribstone",
    "name": "Ribstone Tips",
    "description": "Dense tips that punch through lighter armour.",
    "icon": "◁",
    "cat": "Materials",
    "sell": 22
  },
  "tip_bloodore": {
    "id": "tip_bloodore",
    "name": "Bloodore Tips",
    "description": "Reddish, heavy. They carry momentum well.",
    "icon": "◁",
    "cat": "Materials",
    "sell": 55
  },
  "tip_hearthite": {
    "id": "tip_hearthite",
    "name": "Hearthite Tips",
    "description": "The finest arrowheads in Varath. Warm to the touch.",
    "icon": "◁",
    "cat": "Materials",
    "sell": 120
  },
  "tip_voidstone": {
    "id": "tip_voidstone",
    "name": "Voidstone Tips",
    "description": "Dark, cold tips. Frighteningly sharp.",
    "icon": "◁",
    "cat": "Materials",
    "sell": 12
  },
  "arrow_knucklestone": {
    "id": "arrow_knucklestone",
    "name": "Knucklestone Arrow",
    "description": "A basic arrow tipped with knucklestone. Better than nothing.",
    "icon": "🏹",
    "cat": "Arrows",
    "slot": "ammo",
    "acc": 3,
    "dmg": 5,
    "sell": 12
  },
  "arrow_ashiron": {
    "id": "arrow_ashiron",
    "name": "Ashiron Arrow",
    "description": "A proper war arrow. Reliable in the field.",
    "icon": "🏹",
    "cat": "Arrows",
    "slot": "ammo",
    "acc": 8,
    "dmg": 10,
    "sell": 40
  },
  "arrow_ashiron_resin": {
    "id": "arrow_ashiron_resin",
    "name": "Resin Ashiron Arrow",
    "description": "A well-made arrow with resin-treated shaft. Consistent in flight.",
    "icon": "🏹",
    "cat": "Arrows",
    "slot": "ammo",
    "acc": 10,
    "dmg": 10,
    "sell": 44
  },
  "arrow_hearthite": {
    "id": "arrow_hearthite",
    "name": "Hearthite Arrow",
    "description": "The finest arrow in Varath. Warm even in flight.",
    "icon": "🏹",
    "cat": "Arrows",
    "slot": "ammo",
    "acc": 28,
    "dmg": 16,
    "sell": 200
  },
  "plant_fiber": {
    "id": "plant_fiber",
    "name": "Plant Fiber",
    "description": "Stripped fibers from wild plants. Used to string bows and craft rope.",
    "icon": "🪢",
    "cat": "Materials",
    "sell": 12
  },
  "unstrung_crude": {
    "id": "unstrung_crude",
    "name": "Unstrung Shortbow",
    "description": "A rough shortbow shape, no string yet.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 10
  },
  "unstrung_short": {
    "id": "unstrung_short",
    "name": "Unstrung Shortbow (B)",
    "description": "A shaped briarwood bow. Needs stringing.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 25
  },
  "unstrung_long": {
    "id": "unstrung_long",
    "name": "Unstrung Longbow",
    "description": "A coldpine longbow shape, not yet strung.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 55
  },
  "unstrung_greyoak": {
    "id": "unstrung_greyoak",
    "name": "Unstrung Greyoak Longbow",
    "description": "Greyoak bow without a string.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 110
  },
  "unstrung_ruewood": {
    "id": "unstrung_ruewood",
    "name": "Unstrung Ruewood Shortbow",
    "description": "The red wood, shaped. Needs stringing.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 200
  },
  "unstrung_dusk": {
    "id": "unstrung_dusk",
    "name": "Unstrung Duskwood Warbow",
    "description": "Dark warbow, unfinished without its string.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 320
  },
  "unstrung_deep": {
    "id": "unstrung_deep",
    "name": "Unstrung Deeproot Warbow",
    "description": "The finest wood, shaped but awaiting its string.",
    "icon": "🪵",
    "cat": "Materials",
    "sell": 500
  },
  "clue_easy": {
    "id": "clue_easy",
    "name": "Trail Scroll (easy)",
    "description": "A sealed scroll of riddling directions, dropped by something that had no business carrying it. Tap to read the trail; solve it where it points.",
    "icon": "📜",
    "cat": "Trails",
    "sell": 0
  },
  "clue_medium": {
    "id": "clue_medium",
    "name": "Trail Scroll (medium)",
    "description": "A sealed scroll of riddling directions — a proper walk's worth. Tap to read the trail; solve it where it points.",
    "icon": "📜",
    "cat": "Trails",
    "sell": 0
  },
  "clue_hard": {
    "id": "clue_hard",
    "name": "Trail Scroll (hard)",
    "description": "A sealed scroll of riddling directions into the deep places. Tap to read the trail; solve it where it points — and go armed.",
    "icon": "📜",
    "cat": "Trails",
    "sell": 0
  },
  "casket_easy": {
    "id": "casket_easy",
    "name": "Trail Casket (easy)",
    "description": "A little strongbox that was waiting where the riddle said. Tap to prise it open.",
    "icon": "🎁",
    "cat": "Trails",
    "container": true,
    "sell": 100
  },
  "casket_medium": {
    "id": "casket_medium",
    "name": "Trail Casket (medium)",
    "description": "A banded strongbox that was waiting where the riddle said. Tap to prise it open.",
    "icon": "🎁",
    "cat": "Trails",
    "container": true,
    "sell": 300
  },
  "casket_hard": {
    "id": "casket_hard",
    "name": "Trail Casket (hard)",
    "description": "An iron-bound strongbox from the deep places. Heavy in the good way. Tap to prise it open.",
    "icon": "🎁",
    "cat": "Trails",
    "container": true,
    "sell": 800
  },
  "wayfarers_hat": {
    "id": "wayfarers_hat",
    "name": "Wayfarer's Hat",
    "description": "A traveller's hat with a jaunty brim, found only at the end of a trail. Proof you can read a riddle and walk a road.",
    "icon": "👒",
    "cat": "Trails",
    "slot": "helmet",
    "def": 3,
    "rarity": "rare",
    "sell": 1200
  },
  "pale_mask": {
    "id": "pale_mask",
    "name": "Pale Mask",
    "description": "A smooth mask of pale stone in the old north style, found only at the end of the hardest trails. Wearing a nameless face is an Underloft courtesy; on the living it simply unsettles everyone. The head-piece of the Pale Regalia.",
    "icon": "🎭",
    "cat": "Trails",
    "slot": "helmet",
    "def": 6,
    "acc": 2,
    "rarity": "legendary",
    "sell": 4000
  },
  "pale_cuirass": {
    "id": "pale_cuirass",
    "name": "Pale Cuirass",
    "description": "A breastplate of the same pale northern stone as the mask, chased with a dead king's tally-marks. Light as bone and cold to the touch. Won only from the hardest trails — the body of the Pale Regalia.",
    "icon": "🥋",
    "cat": "Trails",
    "slot": "armor",
    "def": 8,
    "rarity": "legendary",
    "sell": 5000
  },
  "pale_legwraps": {
    "id": "pale_legwraps",
    "name": "Pale Legwraps",
    "description": "Leg-wraps of pale Underloft cloth and stone, worn smooth at the knee as if by centuries of kneeling. The legs of the Pale Regalia, found only at a hard trail's end.",
    "icon": "🦵",
    "cat": "Trails",
    "slot": "legs",
    "def": 7,
    "rarity": "legendary",
    "sell": 4500
  },
  "pale_treads": {
    "id": "pale_treads",
    "name": "Pale Treads",
    "description": "Silent boots of soft pale hide and stone, made for walking a barrow without waking it. The feet of the Pale Regalia, drawn only from the hardest caskets.",
    "icon": "🥾",
    "cat": "Trails",
    "slot": "boots",
    "def": 4,
    "rarity": "legendary",
    "sell": 3000
  },
  "mantle_underking": {
    "id": "mantle_underking",
    "name": "The Underking's Mantle",
    "description": "A mantle of pale feathers and old gold that no living hand stitched, clasped at the throat with a coin that predates coins. The rarest thing any trail has ever given up — the crown-jewel of the whole chase. Wearing it, you understand exactly why the moor rats keep digging.",
    "icon": "👑",
    "cat": "Trails",
    "slot": "cape",
    "def": 5,
    "acc": 3,
    "rarity": "legendary",
    "sell": 25000
  },
  "bounty_crate": {
    "id": "bounty_crate",
    "name": "Bounty Supply Crate",
    "description": "A guide-stamped crate of field supplies — rations, elixirs, arrows, and now and then something better. Tap to prise it open.",
    "icon": "📦",
    "cat": "Combat Items",
    "container": true,
    "sell": 40
  },
  "pet_bloodhound": {
    "id": "pet_bloodhound",
    "name": "Old Bay",
    "description": "A grizzled bloodhound retired from the guides' service, sold for Marks alone to a hunter with a hundred contracts behind them. He knows every trail in Varath and follows yours now.",
    "icon": "🐕",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0
  },
  "pet_trail_wren": {
    "id": "pet_trail_wren",
    "name": "Trailwing Wren",
    "description": "A quick brown wren that paces the Varathian Trail's runners for the joy of it. Sold by the trailkeeper for marks alone — proof of a hundred laps.",
    "icon": "🐦",
    "cat": "Skilling Pets",
    "slot": "companion",
    "rarity": "legendary",
    "sell": 0
  },
  "bird_nest": {
    "id": "bird_nest",
    "name": "Bird Nest",
    "description": "A nest shaken loose from the canopy. Often contains seeds or the odd small item.",
    "icon": "🪹",
    "cat": "Forage",
    "sell": 15
  },
  "bark_strip": {
    "id": "bark_strip",
    "name": "Bark Strip",
    "description": "A strip of dried bark. Useful for tinder, binding, and certain tinctures.",
    "icon": "🟫",
    "cat": "Materials",
    "sell": 8
  },
  "pine_resin": {
    "id": "pine_resin",
    "name": "Pine Resin",
    "description": "Sticky resin tapped from coldpine. Used in bowcraft and as a wood preservative.",
    "icon": "🟡",
    "cat": "Materials",
    "sell": 22
  },
  "ironwood_sap": {
    "id": "ironwood_sap",
    "name": "Ironwood Sap",
    "description": "Thick, dark sap from stonewood. Hardens on contact with air. Useful as a natural adhesive.",
    "icon": "🟤",
    "cat": "Materials",
    "sell": 25
  },
  "greyoak_gall": {
    "id": "greyoak_gall",
    "name": "Greyoak Gall",
    "description": "A hard growth on a greyoak trunk. Crushed, it produces a brown-black dye used by those who don't trade with heraldists.",
    "icon": "🟤",
    "cat": "Materials",
    "sell": 18
  },
  "ruewood_splinter": {
    "id": "ruewood_splinter",
    "name": "Ruewood Splinter",
    "description": "A blood-red splinter from ruewood heartwood. Fletchers prize these for arrow nocking.",
    "icon": "🔴",
    "cat": "Materials",
    "sell": 30
  },
  "dusk_bark": {
    "id": "dusk_bark",
    "name": "Dusk Bark",
    "description": "Peeled from duskwood at twilight. Darker than normal bark. Survivalists use it in fire prep.",
    "icon": "⬛",
    "cat": "Materials",
    "sell": 20
  },
  "deeproot_chip": {
    "id": "deeproot_chip",
    "name": "Deeproot Chip",
    "description": "A fragment of deeproot heartwood. Dense, ancient, and faintly warm. Uses unknown beyond obvious fuel value.",
    "icon": "🟫",
    "cat": "Materials",
    "sell": 45
  },
  "resin_shaft": {
    "id": "resin_shaft",
    "name": "Resin-Treated Shaft",
    "description": "A coldpine shaft treated with pine resin. Fletchers say the arrow flies cleaner.",
    "icon": "🏹",
    "cat": "Materials",
    "sell": 18
  },
  "mushroom_broth": {
    "id": "mushroom_broth",
    "name": "Mushroom Broth",
    "description": "A thin broth of wild mushrooms. Warming rather than filling.",
    "icon": "🥣",
    "cat": "Food",
    "heals": 4,
    "sell": 25
  },
  "thornberry_tonic": {
    "id": "thornberry_tonic",
    "name": "Thornberry Tonic",
    "description": "A tart, staining tonic from thornberries. Clears the head.",
    "icon": "🥣",
    "cat": "Food",
    "heals": 6,
    "sell": 40
  },
  "hearthroot_tea": {
    "id": "hearthroot_tea",
    "name": "Hearthroot Tea",
    "description": "A deep, earthy tea. Warm in the belly long after drinking.",
    "icon": "🥣",
    "cat": "Food",
    "heals": 9,
    "sell": 70
  },
  "nightshade_brew": {
    "id": "nightshade_brew",
    "name": "Nightshade Brew",
    "description": "A dark brew of nightshade. Dangerous in the wrong hands. Effective in the right ones.",
    "icon": "🥣",
    "cat": "Food",
    "heals": 11,
    "sell": 100
  },
  "ashroot_elixir": {
    "id": "ashroot_elixir",
    "name": "Ashroot Elixir",
    "description": "A rare elixir. Tastes of ash and cold smoke. Remarkable healing.",
    "icon": "🥣",
    "cat": "Food",
    "heals": 15,
    "sell": 150
  },
  "dawnspore_draught": {
    "id": "dawnspore_draught",
    "name": "Dawnspore Draught",
    "description": "A luminous draught brewed at dawn. The finest foraged medicine in Varath.",
    "icon": "🥣",
    "cat": "Food",
    "heals": 19,
    "sell": 220
  },
  "deepmoss_broth": {
    "id": "deepmoss_broth",
    "name": "Deepmoss Broth",
    "description": "A cold, dark broth of deepmoss. It should not taste good. It does.",
    "icon": "🥣",
    "cat": "Food",
    "heals": 16,
    "sell": 160
  },
  "ashbloom_tea": {
    "id": "ashbloom_tea",
    "name": "Ashbloom Tea",
    "description": "Brewed from pale ashbloom. Smells of old fires. Remarkable recovery for something so slight.",
    "icon": "🥣",
    "cat": "Food",
    "heals": 24,
    "sell": 240
  },
  "health_elixir": {
    "id": "health_elixir",
    "name": "Health Potion",
    "description": "A concentrated healing potion bought with Hunt Marks. Restores 50 HP instantly.",
    "icon": "🧪",
    "cat": "Combat Items",
    "heals": 50,
    "sell": 150
  },
  "shard_of_orun": {
    "id": "shard_of_orun",
    "name": "Shard of Orun",
    "description": "A fragment of warm black stone. Found rarely, on the bodies of the slain. The name is what the cult calls it — the stone does not confirm anything. Believers say it is a piece of the dead god. Unbelievers have no better explanation.",
    "icon": "🖤",
    "cat": "Legendary",
    "sell": 10000
  },
  "blade_of_graves": {
    "id": "blade_of_graves",
    "name": "Blade of Graves",
    "description": "Forged beneath the Knuckle Hills in a time before smelting was a trade. It has never been fully clean.",
    "icon": "🗡️",
    "cat": "Legendary Weapons",
    "slot": "mainhand",
    "acc": 28,
    "dmg": 18,
    "attackStyle": "slash",
    "lore": "barrows",
    "sell": 3000
  },
  "marrow_flail": {
    "id": "marrow_flail",
    "name": "Marrow Flail",
    "description": "Heavy, brutal, effective. The chain is older than the head. The head is very old.",
    "icon": "⚔️",
    "cat": "Legendary Weapons",
    "slot": "mainhand",
    "acc": 22,
    "dmg": 24,
    "attackStyle": "crush",
    "lore": "barrows",
    "sell": 3000
  },
  "ashward_shield": {
    "id": "ashward_shield",
    "name": "Ashward Shield",
    "description": "Obsidian-edged ashiron. Blocks things that should not be blockable.",
    "icon": "🛡️",
    "cat": "Legendary Armour",
    "slot": "offhand",
    "def": 28,
    "lore": "barrows",
    "sell": 3000
  },
  "greymail_plate": {
    "id": "greymail_plate",
    "name": "Greymail Plate",
    "description": "Hammered from a single iron bloom. No two rings are alike. It has never rusted.",
    "icon": "🧥",
    "cat": "Legendary Armour",
    "slot": "armor",
    "def": 35,
    "lore": "barrows",
    "sell": 3000
  },
  "barrow_helm": {
    "id": "barrow_helm",
    "name": "Barrow Helm",
    "description": "The visor is permanently lowered. No one has seen the face of whoever wore it last.",
    "icon": "⛑️",
    "cat": "Legendary Armour",
    "slot": "helmet",
    "def": 22,
    "lore": "barrows",
    "sell": 3000
  },
  "orun_reaver": {
    "id": "orun_reaver",
    "name": "Orun's Reaver",
    "description": "A weapon from the age when believers fought openly. It still carries that argument.",
    "icon": "🗡️",
    "cat": "Legendary Weapons",
    "slot": "mainhand",
    "acc": 38,
    "dmg": 28,
    "attackStyle": "slash",
    "lore": "spine",
    "sell": 6000
  },
  "coldbone_bow": {
    "id": "coldbone_bow",
    "name": "Coldbone Bow",
    "description": "Carved from a tree that grew through a tomb. The string hums at a pitch only animals react to.",
    "icon": "🏹",
    "cat": "Legendary Weapons",
    "slot": "mainhand",
    "ranged": true,
    "twoHand": true,
    "equipLevel": 60,
    "acc": 40,
    "dmg": 44,
    "lore": "spine",
    "sell": 6000
  },
  "stoneguard_plate": {
    "id": "stoneguard_plate",
    "name": "Stoneguard Plate",
    "description": "Recovered from the Spine summit. Heavy as consequence.",
    "icon": "🧥",
    "cat": "Legendary Armour",
    "slot": "armor",
    "def": 52,
    "lore": "spine",
    "sell": 6000
  },
  "ironveil_legs": {
    "id": "ironveil_legs",
    "name": "Ironveil Legs",
    "description": "Interlocked spinite rings over an ashiron core. Nothing gets through.",
    "icon": "🦿",
    "cat": "Legendary Armour",
    "slot": "legs",
    "def": 38,
    "lore": "spine",
    "sell": 6000
  },
  "warden_ring": {
    "id": "warden_ring",
    "name": "Warden Ring",
    "description": "Warm. Always warm. The stone at its centre is the same black as a Shard of Orun.",
    "icon": "💍",
    "cat": "Legendary Jewellery",
    "slot": "ring",
    "acc": 18,
    "lore": "spine",
    "sell": 6000
  },
  "bog_ward_helm": {
    "id": "bog_ward_helm",
    "name": "Bog Warden Helm",
    "description": "The helm of whatever the Bog Warden was before the mire took it. Heavy and cold. Does not rust.",
    "icon": "🪖",
    "cat": "Legendary Armour",
    "slot": "helmet",
    "def": 20,
    "lore": "bogbarrow",
    "sell": 1800
  },
  "marrow_keep_plate": {
    "id": "marrow_keep_plate",
    "name": "Marrow Keeper Plate",
    "description": "Plate armour from the Marrow Vault. Pale as the stone around it. Heavier than it looks.",
    "icon": "🧥",
    "cat": "Legendary Armour",
    "slot": "armor",
    "def": 52,
    "lore": "marrowvault",
    "sell": 4500
  },
  "wyrm_helm": {
    "id": "wyrm_helm",
    "name": "Wyrmscale Helm",
    "description": "A crested helm forged from the Ashen Wyrm's own plating. The scales still hold a furnace warmth.",
    "icon": "⛑️",
    "cat": "Legendary Armour",
    "slot": "helmet",
    "def": 52,
    "equipLevel": 75,
    "rarity": "legendary",
    "lore": "ashen_wyrm",
    "sell": 6000
  },
  "wyrm_body": {
    "id": "wyrm_body",
    "name": "Wyrmscale Cuirass",
    "description": "Overlapping dragon scales over blackened steel. Turns a blade — and most of a flame.",
    "icon": "🛡️",
    "cat": "Legendary Armour",
    "slot": "armor",
    "def": 70,
    "equipLevel": 75,
    "rarity": "legendary",
    "lore": "ashen_wyrm",
    "sell": 9500
  },
  "wyrm_legs": {
    "id": "wyrm_legs",
    "name": "Wyrmscale Greaves",
    "description": "Scaled tassets that glow at the seams. The finest leg armour ever drawn from Varath.",
    "icon": "🦿",
    "cat": "Legendary Armour",
    "slot": "legs",
    "def": 84,
    "equipLevel": 75,
    "rarity": "legendary",
    "lore": "ashen_wyrm",
    "sell": 8500
  },
  "wyrm_shield": {
    "id": "wyrm_shield",
    "name": "Wyrmscale Bulwark",
    "description": "A shield of fused dragon plate. Heat rolls off its face. Few will ever carry one.",
    "icon": "🛡️",
    "cat": "Legendary Armour",
    "slot": "offhand",
    "def": 52,
    "equipLevel": 75,
    "rarity": "legendary",
    "lore": "ashen_wyrm",
    "sell": 6000
  },
  "hunger_fang": {
    "id": "hunger_fang",
    "name": "Hunger's Fang",
    "description": "A tooth of Vorlag ground to a point that never dulls, because it remembers being hungry. The finest stabbing blade in Varath.",
    "icon": "🗡️",
    "cat": "Legendary Weapons",
    "slot": "mainhand",
    "acc": 70,
    "dmg": 33,
    "speed": 2000,
    "attackStyle": "stab",
    "wepType": "dagger",
    "equipLevel": 85,
    "rarity": "legendary",
    "lore": "vorlag",
    "sell": 8000
  },
  "sealbreaker_bulwark": {
    "id": "sealbreaker_bulwark",
    "name": "Sealbreaker Bulwark",
    "description": "A shield cut whole from a plate of Vorlag's hide. It held five seals' worth of patience; it will hold a blow or two of yours.",
    "icon": "🛡️",
    "cat": "Legendary Armour",
    "slot": "offhand",
    "def": 58,
    "equipLevel": 85,
    "rarity": "legendary",
    "lore": "vorlag",
    "sell": 8000
  },
  "mantle_of_the_below": {
    "id": "mantle_of_the_below",
    "name": "Mantle of the Below",
    "description": "A cape woven from the dark that lives under the mountain. It weighs nothing and remembers everything. The strongest back in Varath wears this.",
    "icon": "🧥",
    "cat": "Legendary Armour",
    "slot": "cape",
    "def": 9,
    "acc": 5,
    "rngAcc": 5,
    "magAcc": 5,
    "equipLevel": 85,
    "rarity": "legendary",
    "lore": "vorlag",
    "sell": 8000
  },
  "pet_vorlag": {
    "id": "pet_vorlag",
    "name": "The Little Hunger",
    "description": "A fist-sized bud of the Hunger Below that imprinted on whoever felled its parent. It eats one pebble a day and looks at you like you hung the moon it has never seen.",
    "icon": "🕳️",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "meta": {
      "petBoss": "vorlag"
    }
  },
  "gaunt_maul": {
    "id": "gaunt_maul",
    "name": "The Gaunt Maul",
    "description": "A head of black seal-stone lashed to a climber's broken haft, torn from the thing that clawed up the Hollow's throat ahead of Vorlag. It is too heavy to swing quickly and hits like the roof coming down. The endgame's on-ramp — a step short of Vorlag's own leavings.",
    "icon": "🔨",
    "cat": "Legendary Weapons",
    "slot": "mainhand",
    "acc": 58,
    "dmg": 42,
    "speed": 3000,
    "attackStyle": "crush",
    "wepType": "hammer",
    "equipLevel": 100,
    "rarity": "legendary",
    "lore": "gaunt_below",
    "sell": 6500
  },
  "pet_gaunt": {
    "id": "pet_gaunt",
    "name": "The Lesser Hunger",
    "description": "A knuckle of the Gaunt Below that followed you up out of the dark, mistaking the one who ended it for the one who made it. Smaller than the Little Hunger, and endlessly, quietly jealous of it.",
    "icon": "🦴",
    "cat": "Boss Pets",
    "slot": "companion",
    "rarity": "legendary",
    "meta": {
      "petBoss": "gaunt_below"
    }
  },
  "wyrm_blade": {
    "id": "wyrm_blade",
    "name": "Wyrmfang",
    "description": "A sword forged from a fang of the Ashen Wyrm, edged in living ember. The most coveted blade in all Varath.",
    "icon": "🗡️",
    "cat": "Legendary Weapons",
    "slot": "mainhand",
    "acc": 66,
    "dmg": 31,
    "speed": 2200,
    "attackStyle": "slash",
    "wepType": "sword",
    "equipLevel": 75,
    "rarity": "legendary",
    "lore": "ashen_wyrm",
    "sell": 13000
  },
  "bone_helm": {
    "id": "bone_helm",
    "name": "Bonewrought Helm",
    "description": "A skull-cap of fused human bone, lacquered pale. It was someone, once — the Boneman doesn't waste a thing.",
    "icon": "💀",
    "cat": "Bone Armour",
    "slot": "helmet",
    "def": 33,
    "equipLevel": 60,
    "rarity": "rare",
    "lore": "boneman",
    "sell": 2200
  },
  "bone_body": {
    "id": "bone_body",
    "name": "Ribcage Cuirass",
    "description": "A breastplate laced from rib and spine. Cold against the chest, and unsettlingly light. The grisliest armour in Varath — and among the toughest.",
    "icon": "🦴",
    "cat": "Bone Armour",
    "slot": "armor",
    "def": 46,
    "equipLevel": 60,
    "rarity": "rare",
    "lore": "boneman",
    "sell": 3600
  },
  "bone_legs": {
    "id": "bone_legs",
    "name": "Marrowbone Greaves",
    "description": "Tassets of split femur bound in pale sinew. They rattle faintly when you walk — a killer's calling card.",
    "icon": "🦴",
    "cat": "Bone Armour",
    "slot": "legs",
    "def": 40,
    "equipLevel": 60,
    "rarity": "rare",
    "lore": "boneman",
    "sell": 3200
  },
  "bone_shield": {
    "id": "bone_shield",
    "name": "Ossuary Ward",
    "description": "A round shield of plated skullbone, faces still half-recognisable in the grain. Few can stand to carry it.",
    "icon": "🛡️",
    "cat": "Bone Armour",
    "slot": "offhand",
    "def": 33,
    "equipLevel": 60,
    "rarity": "rare",
    "lore": "boneman",
    "sell": 2200
  },
  "bonesaw": {
    "poison": 4,
    "id": "bonesaw",
    "name": "The Bonesaw",
    "description": "The Boneman's own tool — a long, toothed saw, the handle wrapped in cured hide. It does its grim work as well on the living as the dead.",
    "icon": "🪚",
    "cat": "Bone Weapons",
    "slot": "mainhand",
    "acc": 50,
    "dmg": 24,
    "speed": 2600,
    "attackStyle": "slash",
    "wepType": "sword",
    "equipLevel": 60,
    "rarity": "rare",
    "lore": "boneman",
    "sell": 4200
  },

  // === GREENHOOD SET + The Baron's Yew — drops from The Green Baron (RANGED) ===
  // The outlaw legend's own gear: forest-worn leather and a black-fletched yew
  // longbow. Gates on Draw 55 — a notch above the craftable Master Ranger set,
  // below the Coldbone Bow. All share lore "green_baron".
  "greenhood_hood": {
    "id": "greenhood_hood", "name": "Greenhood Cowl", "icon": "🪖", "cat": "Greenhood Armour",
    "slot": "helmet", "equipSkill": "draw", "equipLevel": 55, "rngAcc": 12, "def": 12,
    "rarity": "rare", "lore": "green_baron", "sell": 2200,
    "description": "The Baron's own cowl, dark forest green and cut to vanish in leaf-shadow. It smells of woodsmoke and old blood."
  },
  "greenhood_cloak": {
    "id": "greenhood_cloak", "name": "Greenhood Cloak", "icon": "🥋", "cat": "Greenhood Armour",
    "slot": "armor", "equipSkill": "draw", "equipLevel": 55, "rngAcc": 16, "rngDmg": 7, "def": 17,
    "rarity": "rare", "lore": "green_baron", "sell": 3600,
    "description": "A layered leather cloak, quiet as moss and quicker than it looks. The finest ranger armour in Varath — taken off a man who called himself a hero."
  },
  "greenhood_chaps": {
    "id": "greenhood_chaps", "name": "Greenhood Chaps", "icon": "🩲", "cat": "Greenhood Armour",
    "slot": "legs", "equipSkill": "draw", "equipLevel": 55, "rngAcc": 13, "def": 13,
    "rarity": "rare", "lore": "green_baron", "sell": 3200,
    "description": "Supple green chaps that never snag a drawn string. Built for a man who spent his life running the wood."
  },
  "greenhood_boots": {
    "id": "greenhood_boots", "name": "Greenhood Boots", "icon": "🥾", "cat": "Greenhood Armour",
    "slot": "boots", "equipSkill": "draw", "equipLevel": 55, "rngAcc": 6, "def": 8,
    "rarity": "rare", "lore": "green_baron", "sell": 2000,
    "description": "Soft-soled boots that leave no track worth following. The Baron was never caught in these."
  },
  "baron_longbow": {
    "id": "baron_longbow", "name": "The Baron's Yew", "icon": "🏹", "cat": "Greenhood Weapons",
    "slot": "mainhand", "ranged": true, "twoHand": true, "equipSkill": "draw", "equipLevel": 55,
    "acc": 52, "dmg": 48, "speed": 2400, "rarity": "rare", "lore": "green_baron", "sell": 4400,
    "description": "A tall black-yew longbow, the grip worn pale by one hand over many years. It puts a black-fletched arrow through anything the Baron decided didn't deserve to keep breathing."
  },

  // === PROPHET'S REGALIA + The Hollow Staff — drops from The Hollow Prophet ====
  // (DEVOTION). The cult founder's hex-woven robes and burnt-bone staff. Gates on
  // Faith 55 — a notch above the craftable Archon set. All share lore
  // "hollow_prophet".
  "prophet_hood": {
    "id": "prophet_hood", "name": "Hollow Prophet's Hood", "icon": "🎓", "cat": "Prophet's Regalia",
    "slot": "helmet", "equipSkill": "faith", "equipLevel": 55, "magAcc": 12, "def": 7,
    "rarity": "rare", "lore": "hollow_prophet", "sell": 2200,
    "description": "A deep hood of hex-woven cloth, the inside stained pale where the light leaked out of him. It hums against your scalp."
  },
  "prophet_robe": {
    "id": "prophet_robe", "name": "Hollow Prophet's Robe", "icon": "🥋", "cat": "Prophet's Regalia",
    "slot": "armor", "equipSkill": "faith", "equipLevel": 55, "magAcc": 16, "magDmg": 7, "def": 10,
    "rarity": "rare", "lore": "hollow_prophet", "sell": 3600,
    "description": "The Prophet's own robe, threaded through with hex cloth and something finer that catches no light. The strongest caster's vestment in Varath."
  },
  "prophet_skirt": {
    "id": "prophet_skirt", "name": "Hollow Prophet's Skirt", "icon": "🩲", "cat": "Prophet's Regalia",
    "slot": "legs", "equipSkill": "faith", "equipLevel": 55, "magAcc": 13, "def": 7,
    "rarity": "rare", "lore": "hollow_prophet", "sell": 3200,
    "description": "Lower robes heavy with woven hex-thread. They drag faintly, as if the seam beneath still reaches for them."
  },
  "prophet_sandals": {
    "id": "prophet_sandals", "name": "Hollow Prophet's Sandals", "icon": "🥿", "cat": "Prophet's Regalia",
    "slot": "boots", "equipSkill": "faith", "equipLevel": 55, "magAcc": 6, "def": 4,
    "rarity": "rare", "lore": "hollow_prophet", "sell": 2000,
    "description": "Plain bound sandals, worn thin walking the same moor circle ten thousand times in prayer to a god that stopped listening."
  },
  "prophet_staff": {
    "id": "prophet_staff", "name": "The Hollow Staff", "icon": "🔮", "cat": "Prophet's Weapons",
    "slot": "mainhand", "magic": true, "twoHand": true, "equipSkill": "faith", "equipLevel": 55,
    "acc": 62, "dmg": 52, "speed": 2600, "rarity": "rare", "lore": "hollow_prophet", "sell": 4400,
    "description": "A staff of burnt bone capped with a shard of Orun's seam. It pulls Grace straight out of the world's wound — the finest, and the worst, staff a faithful hand can hold."
  },

  "serpent_scale": {
    "id": "serpent_scale", "name": "Serpent Scale", "icon": "🐍", "cat": "Drops", "sell": 45,
    "description": "A hard, iridescent scale prised from a swamp serpent. Leather-workers pay for these."
  },
  "spider_silk": {
    "id": "spider_silk", "name": "Crawler Silk", "icon": "🕸️", "cat": "Drops", "sell": 55,
    "description": "Tough, gluey strands from a cave crawler. Weavers and fletchers prize it."
  },
  "bat_wing": {
    "id": "bat_wing", "name": "Bat Wing", "icon": "🦇", "cat": "Drops", "sell": 30,
    "description": "A leathery wing membrane. Light, strong, and faintly foul-smelling."
  },
  "golem_dust": {
    "id": "golem_dust", "name": "Golem Dust", "icon": "🪨", "cat": "Drops", "sell": 90,
    "description": "Fine grit left where a stone thing crumbled. Masons bind it into mortar."
  },
  "wraith_fragment": {
    "id": "wraith_fragment", "name": "Wraith Fragment", "icon": "💠", "cat": "Drops", "sell": 130,
    "description": "A shard of something that was never quite solid. Cold, and dear to the curious."
  },
  "orc_tooth": {
    "id": "orc_tooth", "name": "Orc Tooth", "icon": "🦷", "cat": "Drops", "sell": 70,
    "description": "A heavy tooth from an old warrior of the deep. Carved into talismans and trophies."
  },
  "tarnished_ring": {
    "id": "tarnished_ring", "name": "Tarnished Ring", "icon": "💍", "cat": "Drops", "sell": 40,
    "description": "A stolen ring gone dull. Not worth wearing, but any fence will take it."
  },
  "marrow_shard": {
    "id": "marrow_shard", "name": "Marrow Shard", "icon": "🦴", "cat": "Drops", "sell": 200,
    "description": "A splinter of pale bone from the deep places. Cold to the touch, and dear to collectors."
  },

  // === Batch 7: expanded drop-table loot ====================================
  // Bones, an uncut-gem ladder, jewellery and everyday junk — the OSRS texture
  // that makes each kill a small gamble. All sellable; the gems and jewellery
  // are the "rare drop table" spice shared across many foes.
  "bones": {
    "id": "bones", "name": "Bones", "icon": "🦴", "cat": "Drops", "sell": 3,
    "buryXp": 30,
    "description": "A pile of picked-clean bones. Bury them for Devotion, or grind them into bonemeal for potions."
  },
  "big_bones": {
    "id": "big_bones", "name": "Big Bones", "icon": "🦴", "cat": "Drops", "sell": 14,
    "buryXp": 110,
    "description": "The heavy bones of a large beast. Bury for a big lump of Devotion, or grind into bonemeal."
  },
  "chipped_tooth": {
    "id": "chipped_tooth", "name": "Chipped Tooth", "icon": "🦷", "cat": "Drops", "sell": 6,
    "description": "A cracked tooth pried from some snarling thing. Curios collectors pay for oddities."
  },
  "beast_horn": {
    "id": "beast_horn", "name": "Beast Horn", "icon": "🦬", "cat": "Drops", "sell": 45,
    "description": "A thick, curved horn. Ground for powders or mounted as a trophy."
  },
  "cracked_shell": {
    "id": "cracked_shell", "name": "Cracked Shell", "icon": "🐚", "cat": "Drops", "sell": 10,
    "description": "A plate of chitinous shell, split from a crawling thing. Light and surprisingly strong."
  },
  "uncut_sapphire": {
    "id": "uncut_sapphire", "name": "Uncut Sapphire", "icon": "💎", "cat": "Gems", "sell": 55,
    "description": "A rough blue gem. The commonest stone off the rare drop table — still worth a purse."
  },
  "uncut_emerald": {
    "id": "uncut_emerald", "name": "Uncut Emerald", "icon": "💎", "cat": "Gems", "sell": 95,
    "description": "A rough green gem, clearer than a sapphire and worth the more for it."
  },
  "uncut_ruby": {
    "id": "uncut_ruby", "name": "Uncut Ruby", "icon": "💎", "cat": "Gems", "sell": 175,
    "description": "A rough red gem, deep as an ember. A fine find from any foe's purse."
  },
  "uncut_diamond": {
    "id": "uncut_diamond", "name": "Uncut Diamond", "icon": "💎", "cat": "Gems", "sell": 450,
    "description": "A rough white gem of the first water. The prize of the rare drop table."
  },
  "tarnished_amulet": {
    "id": "tarnished_amulet", "name": "Tarnished Amulet", "icon": "📿", "cat": "Drops", "sell": 60,
    "description": "A looted amulet gone dull and green. No power left in it, but a fence will pay."
  },
  "gold_ring": {
    "id": "gold_ring", "name": "Gold Signet Ring", "icon": "💍", "cat": "Drops", "sell": 130,
    "description": "A heavy gold ring, someone's mark worn into the band. Any trader will pay well for the metal."
  },
  "broken_arrow": {
    "id": "broken_arrow", "name": "Broken Arrow", "icon": "🏹", "cat": "Drops", "sell": 2,
    "description": "A snapped shaft with the head still on. Scrap, but scrap sells."
  },
  "bent_nail": {
    "id": "bent_nail", "name": "Bent Nail", "icon": "🔩", "cat": "Drops", "sell": 1, "stackable": true,
    "description": "A rusted, bent nail. The sort of thing that falls out of a bandit's pocket."
  },
  "rusty_key": {
    "id": "rusty_key", "name": "Rusty Key", "icon": "🔑", "cat": "Drops", "sell": 6,
    "description": "An old key to no lock you know. Traders buy them by the handful, no questions asked."
  },
  "scrap_cloth": {
    "id": "scrap_cloth", "name": "Scrap of Cloth", "icon": "🧵", "cat": "Drops", "sell": 4,
    "description": "A torn strip of dirty cloth. Fit for rags, bandages, or a few coppers."
  },

  // === FAITH: wooden staff ladder (2H mainhand casting weapons) ==============
  // Rod-style tiers — each a flat casting boost (acc + dmg). Wielding one makes
  // your basic attack a free magic bolt and routes combat XP to Faith. Gated by
  // Devotion level via equipLevel.
  "staff_ashwood": {
    "id": "staff_ashwood", "name": "Ashwood Staff", "icon": "🔮", "cat": "Weapons",
    "slot": "mainhand", "magic": true, "twoHand": true, "equipLevel": 1,
    "acc": 6, "dmg": 8, "speed": 2600, "sell": 60,
    "description": "A plain ashwood casting staff. Channels Orun's spark for the newly faithful."
  },
  "staff_coldpine": {
    "id": "staff_coldpine", "name": "Coldpine Staff", "icon": "🔮", "cat": "Weapons",
    "slot": "mainhand", "magic": true, "twoHand": true, "equipLevel": 10,
    "acc": 12, "dmg": 14, "speed": 2600, "sell": 180,
    "description": "A pale coldpine staff, cool to the grip. Steadier channel than ashwood."
  },
  "staff_stonewood": {
    "id": "staff_stonewood", "name": "Stonewood Staff", "icon": "🔮", "cat": "Weapons",
    "slot": "mainhand", "magic": true, "twoHand": true, "equipLevel": 20,
    "acc": 20, "dmg": 20, "speed": 2600, "sell": 420,
    "description": "A dense stonewood staff. Its weight lends real force to a bolt."
  },
  "staff_greyoak": {
    "id": "staff_greyoak", "name": "Greyoak Staff", "icon": "🔮", "cat": "Weapons",
    "slot": "mainhand", "magic": true, "twoHand": true, "equipLevel": 30,
    "acc": 30, "dmg": 28, "speed": 2600, "sell": 900,
    "description": "An old-growth greyoak staff. A caster's proper working tool."
  },
  "staff_ruewood": {
    "id": "staff_ruewood", "name": "Ruewood Staff", "icon": "🔮", "cat": "Weapons",
    "slot": "mainhand", "magic": true, "twoHand": true, "equipLevel": 40,
    "acc": 42, "dmg": 36, "speed": 2600, "sell": 1800,
    "description": "A dark ruewood staff that hums when Grace runs through it."
  },
  "staff_deeproot": {
    "id": "staff_deeproot", "name": "Deeproot Staff", "icon": "🔮", "cat": "Weapons",
    "slot": "mainhand", "magic": true, "twoHand": true, "equipLevel": 50,
    "acc": 56, "dmg": 46, "speed": 2600, "sell": 3600,
    "description": "Cut from the deeproot at the world's bottom. The finest staff a faithful hand can wield."
  },

  // === FAITH: bonemeal + the Grace (Faith) potion ===========================
  "bonemeal": {
    "id": "bonemeal", "name": "Bonemeal", "icon": "🦴", "cat": "Materials", "sell": 6,
    "description": "Ground bone, pale and fine. The base of a Devotion Potion."
  },
  "pestle": {
    "id": "pestle", "name": "Pestle & Mortar", "icon": "🥣", "cat": "Tools", "sell": 8,
    "description": "A stone bowl and grinder. Crush bones in your pack into bonemeal with it."
  },

  // === RANGED + MAGIC GEAR RESOURCES ========================================
  // (Sinew already exists — dropped by beasts and sold at the general store.)
  "hex_cloth": {
    "id": "hex_cloth", "name": "Hex Cloth", "icon": "🧵", "cat": "Materials", "sell": 40,
    "description": "Dark cloth woven by the cult, humming faintly with Orun's borrowed power. The base of enchanted robes."
  },

  // === RANGED ARMOUR (gate on Draw) — Tanned → Studded → Hardened → Master ===
  "rng_hood_1": { "id": "rng_hood_1", "name": "Tanned Ranger Hood", "icon": "🪖", "cat": "Ranged Armour", "slot": "helmet", "equipSkill": "draw", "equipLevel": 1, "rngAcc": 2, "def": 2, "sell": 40, "description": "A soft leather hood for a hunter's quiet approach." },
  "rng_body_1": { "id": "rng_body_1", "name": "Tanned Ranger Body", "icon": "🥋", "cat": "Ranged Armour", "slot": "armor", "equipSkill": "draw", "equipLevel": 1, "rngAcc": 3, "rngDmg": 1, "def": 4, "sell": 80, "description": "A stitched leather jerkin cut for drawing a bow." },
  "rng_legs_1": { "id": "rng_legs_1", "name": "Tanned Ranger Chaps", "icon": "🩲", "cat": "Ranged Armour", "slot": "legs", "equipSkill": "draw", "equipLevel": 1, "rngAcc": 2, "def": 3, "sell": 55, "description": "Light leather chaps that never snag the string." },
  "rng_hood_2": { "id": "rng_hood_2", "name": "Studded Ranger Hood", "icon": "🪖", "cat": "Ranged Armour", "slot": "helmet", "equipSkill": "draw", "equipLevel": 20, "rngAcc": 4, "def": 4, "sell": 130, "description": "Cured leather set with iron studs." },
  "rng_body_2": { "id": "rng_body_2", "name": "Studded Ranger Body", "icon": "🥋", "cat": "Ranged Armour", "slot": "armor", "equipSkill": "draw", "equipLevel": 20, "rngAcc": 6, "rngDmg": 2, "def": 7, "sell": 260, "description": "Studded leather that turns a glancing blow." },
  "rng_legs_2": { "id": "rng_legs_2", "name": "Studded Ranger Chaps", "icon": "🩲", "cat": "Ranged Armour", "slot": "legs", "equipSkill": "draw", "equipLevel": 20, "rngAcc": 5, "def": 5, "sell": 180, "description": "Reinforced chaps for the long hunt." },
  "rng_hood_3": { "id": "rng_hood_3", "name": "Hardened Ranger Hood", "icon": "🪖", "cat": "Ranged Armour", "slot": "helmet", "equipSkill": "draw", "equipLevel": 40, "rngAcc": 7, "def": 7, "sell": 400, "description": "Boiled, hardened leather, light and strong." },
  "rng_body_3": { "id": "rng_body_3", "name": "Hardened Ranger Body", "icon": "🥋", "cat": "Ranged Armour", "slot": "armor", "equipSkill": "draw", "equipLevel": 40, "rngAcc": 10, "rngDmg": 4, "def": 11, "sell": 800, "description": "A hardened hide coat prized by marksmen." },
  "rng_legs_3": { "id": "rng_legs_3", "name": "Hardened Ranger Chaps", "icon": "🩲", "cat": "Ranged Armour", "slot": "legs", "equipSkill": "draw", "equipLevel": 40, "rngAcc": 8, "def": 8, "sell": 560, "description": "Hardened chaps, quiet and quick." },
  "rng_hood_4": { "id": "rng_hood_4", "name": "Master Ranger Hood", "icon": "🪖", "cat": "Ranged Armour", "slot": "helmet", "equipSkill": "draw", "equipLevel": 50, "rngAcc": 11, "def": 11, "sell": 1200, "description": "The hood of a master archer — supple and deadly." },
  "rng_body_4": { "id": "rng_body_4", "name": "Master Ranger Body", "icon": "🥋", "cat": "Ranged Armour", "slot": "armor", "equipSkill": "draw", "equipLevel": 50, "rngAcc": 15, "rngDmg": 6, "def": 16, "sell": 2400, "description": "Master-worked hide, the finest a bowyer can wear." },
  "rng_legs_4": { "id": "rng_legs_4", "name": "Master Ranger Chaps", "icon": "🩲", "cat": "Ranged Armour", "slot": "legs", "equipSkill": "draw", "equipLevel": 50, "rngAcc": 12, "def": 12, "sell": 1600, "description": "Master chaps for the surest hunter in Varath." },

  // === MAGIC ROBES (gate on Faith) — Acolyte → Adept → Warden → Archon ======
  "mag_hood_1": { "id": "mag_hood_1", "name": "Acolyte Hood", "icon": "🎓", "cat": "Magic Robes", "slot": "helmet", "equipSkill": "faith", "equipLevel": 1, "magAcc": 2, "def": 1, "sell": 40, "description": "A plain hood for a novice of Orun." },
  "mag_robe_1": { "id": "mag_robe_1", "name": "Acolyte Robe", "icon": "🥋", "cat": "Magic Robes", "slot": "armor", "equipSkill": "faith", "equipLevel": 1, "magAcc": 3, "magDmg": 1, "def": 2, "sell": 80, "description": "Simple woven robes that steady a cast." },
  "mag_skirt_1": { "id": "mag_skirt_1", "name": "Acolyte Skirt", "icon": "🩲", "cat": "Magic Robes", "slot": "legs", "equipSkill": "faith", "equipLevel": 1, "magAcc": 2, "def": 1, "sell": 55, "description": "The lower robes of a devotee." },
  "mag_hood_2": { "id": "mag_hood_2", "name": "Adept Hood", "icon": "🎓", "cat": "Magic Robes", "slot": "helmet", "equipSkill": "faith", "equipLevel": 20, "magAcc": 4, "def": 2, "sell": 130, "description": "The hood of a practised caster." },
  "mag_robe_2": { "id": "mag_robe_2", "name": "Adept Robe", "icon": "🥋", "cat": "Magic Robes", "slot": "armor", "equipSkill": "faith", "equipLevel": 20, "magAcc": 6, "magDmg": 2, "def": 4, "sell": 260, "description": "Silk-woven robes that focus Grace." },
  "mag_skirt_2": { "id": "mag_skirt_2", "name": "Adept Skirt", "icon": "🩲", "cat": "Magic Robes", "slot": "legs", "equipSkill": "faith", "equipLevel": 20, "magAcc": 5, "def": 2, "sell": 180, "description": "Fine lower robes, hex-threaded." },
  "mag_hood_3": { "id": "mag_hood_3", "name": "Warden Hood", "icon": "🎓", "cat": "Magic Robes", "slot": "helmet", "equipSkill": "faith", "equipLevel": 40, "magAcc": 7, "def": 4, "sell": 400, "description": "A warden's hood, heavy with woven power." },
  "mag_robe_3": { "id": "mag_robe_3", "name": "Warden Robe", "icon": "🥋", "cat": "Magic Robes", "slot": "armor", "equipSkill": "faith", "equipLevel": 40, "magAcc": 10, "magDmg": 4, "def": 6, "sell": 800, "description": "Warden robes that pour Orun's light into every bolt." },
  "mag_skirt_3": { "id": "mag_skirt_3", "name": "Warden Skirt", "icon": "🩲", "cat": "Magic Robes", "slot": "legs", "equipSkill": "faith", "equipLevel": 40, "magAcc": 8, "def": 4, "sell": 560, "description": "Warden lower robes, thick with hex cloth." },
  "mag_hood_4": { "id": "mag_hood_4", "name": "Archon Hood", "icon": "🎓", "cat": "Magic Robes", "slot": "helmet", "equipSkill": "faith", "equipLevel": 50, "magAcc": 11, "def": 6, "sell": 1200, "description": "The crowning hood of an archon of Orun." },
  "mag_robe_4": { "id": "mag_robe_4", "name": "Archon Robe", "icon": "🥋", "cat": "Magic Robes", "slot": "armor", "equipSkill": "faith", "equipLevel": 50, "magAcc": 15, "magDmg": 6, "def": 9, "sell": 2400, "description": "Archon robes — the finest vessel for a caster's will." },
  "mag_skirt_4": { "id": "mag_skirt_4", "name": "Archon Skirt", "icon": "🩲", "cat": "Magic Robes", "slot": "legs", "equipSkill": "faith", "equipLevel": 50, "magAcc": 12, "def": 6, "sell": 1600, "description": "Archon lower robes, woven for the highest devotion." },

  // --- T1·05: ranged & magic armour, brought up to the melee slot/tier grid ---
  // Both lines gain the missing BOOTS slot at every tier, and climb two tiers
  // past the old level-50 cap (Sentinel ≈62, Peerless/Luminary ≈78) so a bow or
  // staff build doesn't plateau while plate keeps going. Ranged leans accuracy
  // (rngAcc), magic leans spell power (magAcc/magDmg) — the stat identities.
  // Ranged boots, tiers 1–4 (the slot that never existed for archers):
  "rng_boots_1": { "id": "rng_boots_1", "name": "Tanned Ranger Boots", "icon": "🥾", "cat": "Ranged Armour", "slot": "boots", "equipSkill": "draw", "equipLevel": 1, "rngAcc": 1, "def": 2, "sell": 40, "description": "Soft leather boots that fall quiet on the approach." },
  "rng_boots_2": { "id": "rng_boots_2", "name": "Studded Ranger Boots", "icon": "🥾", "cat": "Ranged Armour", "slot": "boots", "equipSkill": "draw", "equipLevel": 20, "rngAcc": 2, "def": 4, "sell": 130, "description": "Iron-studded boots for the long hunt." },
  "rng_boots_3": { "id": "rng_boots_3", "name": "Hardened Ranger Boots", "icon": "🥾", "cat": "Ranged Armour", "slot": "boots", "equipSkill": "draw", "equipLevel": 40, "rngAcc": 4, "def": 7, "sell": 400, "description": "Boiled-leather boots, light and sure-footed." },
  "rng_boots_4": { "id": "rng_boots_4", "name": "Master Ranger Boots", "icon": "🥾", "cat": "Ranged Armour", "slot": "boots", "equipSkill": "draw", "equipLevel": 50, "rngAcc": 6, "def": 10, "sell": 1200, "description": "Master boots — never a snapped twig, never a missed step." },
  // Ranged tier 5 — Sentinel (≈62):
  "rng_hood_5": { "id": "rng_hood_5", "name": "Sentinel Hood", "icon": "🪖", "cat": "Ranged Armour", "slot": "helmet", "equipSkill": "draw", "equipLevel": 62, "rngAcc": 14, "def": 15, "sell": 2600, "description": "A frontier sentinel's hood, cut for the deep-country watch." },
  "rng_body_5": { "id": "rng_body_5", "name": "Sentinel Body", "icon": "🥋", "cat": "Ranged Armour", "slot": "armor", "equipSkill": "draw", "equipLevel": 62, "rngAcc": 20, "rngDmg": 8, "def": 22, "sell": 5200, "description": "Layered, oiled hide that turns a blade and never fights the draw." },
  "rng_legs_5": { "id": "rng_legs_5", "name": "Sentinel Chaps", "icon": "🩲", "cat": "Ranged Armour", "slot": "legs", "equipSkill": "draw", "equipLevel": 62, "rngAcc": 15, "def": 16, "sell": 3400, "description": "Sentinel chaps for the long patrols beyond the last village." },
  "rng_boots_5": { "id": "rng_boots_5", "name": "Sentinel Boots", "icon": "🥾", "cat": "Ranged Armour", "slot": "boots", "equipSkill": "draw", "equipLevel": 62, "rngAcc": 7, "def": 13, "sell": 2200, "description": "Sentinel boots, silent over stone and root alike." },
  // Ranged tier 6 — Peerless (≈78):
  "rng_hood_6": { "id": "rng_hood_6", "name": "Peerless Hood", "icon": "🪖", "cat": "Ranged Armour", "slot": "helmet", "equipSkill": "draw", "equipLevel": 78, "rngAcc": 18, "def": 19, "sell": 4200, "description": "The hood of a marksman without equal in Varath." },
  "rng_body_6": { "id": "rng_body_6", "name": "Peerless Body", "icon": "🥋", "cat": "Ranged Armour", "slot": "armor", "equipSkill": "draw", "equipLevel": 78, "rngAcc": 26, "rngDmg": 10, "def": 28, "sell": 8400, "description": "The finest hide a bowyer can wear — every seam serves the shot." },
  "rng_legs_6": { "id": "rng_legs_6", "name": "Peerless Chaps", "icon": "🩲", "cat": "Ranged Armour", "slot": "legs", "equipSkill": "draw", "equipLevel": 78, "rngAcc": 19, "def": 20, "sell": 5600, "description": "Peerless chaps, worn only by those who never miss." },
  "rng_boots_6": { "id": "rng_boots_6", "name": "Peerless Boots", "icon": "🥾", "cat": "Ranged Armour", "slot": "boots", "equipSkill": "draw", "equipLevel": 78, "rngAcc": 9, "def": 16, "sell": 3600, "description": "Peerless boots — the last quiet step before the loosed string." },
  // Magic boots, tiers 1–4 (the slot Devotion casters never had):
  "mag_boots_1": { "id": "mag_boots_1", "name": "Acolyte Slippers", "icon": "🥾", "cat": "Magic Robes", "slot": "boots", "equipSkill": "faith", "equipLevel": 1, "magAcc": 1, "def": 1, "sell": 40, "description": "Soft slippers for the shrine floor." },
  "mag_boots_2": { "id": "mag_boots_2", "name": "Adept Slippers", "icon": "🥾", "cat": "Magic Robes", "slot": "boots", "equipSkill": "faith", "equipLevel": 20, "magAcc": 2, "def": 2, "sell": 130, "description": "Hex-threaded slippers that steady a cast." },
  "mag_boots_3": { "id": "mag_boots_3", "name": "Warden Slippers", "icon": "🥾", "cat": "Magic Robes", "slot": "boots", "equipSkill": "faith", "equipLevel": 40, "magAcc": 4, "def": 4, "sell": 400, "description": "Warden slippers, heavy with woven Grace." },
  "mag_boots_4": { "id": "mag_boots_4", "name": "Archon Slippers", "icon": "🥾", "cat": "Magic Robes", "slot": "boots", "equipSkill": "faith", "equipLevel": 50, "magAcc": 6, "def": 6, "sell": 1200, "description": "Archon slippers, woven for the highest devotion." },
  // Magic tier 5 — Hierophant (≈62):
  "mag_hood_5": { "id": "mag_hood_5", "name": "Hierophant Hood", "icon": "🎓", "cat": "Magic Robes", "slot": "helmet", "equipSkill": "faith", "equipLevel": 62, "magAcc": 14, "def": 8, "sell": 2600, "description": "The hood of a hierophant, thick with Orun's light." },
  "mag_robe_5": { "id": "mag_robe_5", "name": "Hierophant Robe", "icon": "🥋", "cat": "Magic Robes", "slot": "armor", "equipSkill": "faith", "equipLevel": 62, "magAcc": 20, "magDmg": 8, "def": 12, "sell": 5200, "description": "Hierophant robes that pour the whole shrine's warmth into a cast." },
  "mag_skirt_5": { "id": "mag_skirt_5", "name": "Hierophant Skirt", "icon": "🩲", "cat": "Magic Robes", "slot": "legs", "equipSkill": "faith", "equipLevel": 62, "magAcc": 15, "def": 8, "sell": 3400, "description": "Hierophant lower robes, hex-woven to the hem." },
  "mag_boots_5": { "id": "mag_boots_5", "name": "Hierophant Slippers", "icon": "🥾", "cat": "Magic Robes", "slot": "boots", "equipSkill": "faith", "equipLevel": 62, "magAcc": 7, "def": 8, "sell": 2200, "description": "Hierophant slippers, blessed sole to seam." },
  // Magic tier 6 — Luminary (≈78):
  "mag_hood_6": { "id": "mag_hood_6", "name": "Luminary Hood", "icon": "🎓", "cat": "Magic Robes", "slot": "helmet", "equipSkill": "faith", "equipLevel": 78, "magAcc": 18, "def": 10, "sell": 4200, "description": "The crowning hood of a luminary of Orun." },
  "mag_robe_6": { "id": "mag_robe_6", "name": "Luminary Robe", "icon": "🥋", "cat": "Magic Robes", "slot": "armor", "equipSkill": "faith", "equipLevel": 78, "magAcc": 26, "magDmg": 10, "def": 15, "sell": 8400, "description": "Luminary robes — the finest vessel a caster's will has ever filled." },
  "mag_skirt_6": { "id": "mag_skirt_6", "name": "Luminary Skirt", "icon": "🩲", "cat": "Magic Robes", "slot": "legs", "equipSkill": "faith", "equipLevel": 78, "magAcc": 19, "def": 10, "sell": 5600, "description": "Luminary lower robes, woven for the brightest devotion in Varath." },
  "mag_boots_6": { "id": "mag_boots_6", "name": "Luminary Slippers", "icon": "🥾", "cat": "Magic Robes", "slot": "boots", "equipSkill": "faith", "equipLevel": 78, "magAcc": 9, "def": 10, "sell": 3600, "description": "Luminary slippers, the last light step before the word is spoken." },

  "seed_ashweed": {
    "id": "seed_ashweed",
    "name": "Ashweed Seed",
    "description": "A common weed seed. Grows quickly and reliably.",
    "icon": "🫘",
    "cat": "Seeds",
    "sell": 5
  },
  "seed_thornroot": {
    "id": "seed_thornroot",
    "name": "Thornroot Seed",
    "description": "A hardy seed with a barbed shell. Scrapes the fingers when planted.",
    "icon": "🫘",
    "cat": "Seeds",
    "sell": 10
  },
  "seed_bloodberry": {
    "id": "seed_bloodberry",
    "name": "Bloodberry Seed",
    "description": "A seed that yields a red-stained fruit. Said to taste of copper and sweetness.",
    "icon": "🫘",
    "cat": "Seeds",
    "sell": 18
  },
  "seed_coldmoss": {
    "id": "seed_coldmoss",
    "name": "Coldmoss Spore",
    "description": "A pale spore from highland moss. Needs cool soil to take root.",
    "icon": "🫘",
    "cat": "Seeds",
    "sell": 28
  },
  "seed_ironleaf": {
    "id": "seed_ironleaf",
    "name": "Ironleaf Seed",
    "description": "The seed of a plant with metal-grey leaves. Alchemists value the dried leaf.",
    "icon": "🫘",
    "cat": "Seeds",
    "sell": 42
  },
  "seed_greybloom": {
    "id": "seed_greybloom",
    "name": "Greybloom Seed",
    "description": "A grey, dusty seed from the open moors. Slow but reliable.",
    "icon": "🫘",
    "cat": "Seeds",
    "sell": 60
  },
  "seed_spinethistle": {
    "id": "seed_spinethistle",
    "name": "Spinethistle Seed",
    "description": "A seed wrapped in protective spines. The plant is just as unwelcoming.",
    "icon": "🫘",
    "cat": "Seeds",
    "sell": 85
  },
  "seed_ruevine": {
    "id": "seed_ruevine",
    "name": "Ruevine Seed",
    "description": "A seed from a climbing vine with red-veined leaves.",
    "icon": "🫘",
    "cat": "Seeds",
    "sell": 120
  },
  "seed_duskshade": {
    "id": "seed_duskshade",
    "name": "Duskshade Seed",
    "description": "A seed from a plant that only opens at dusk. Rare in the daylight.",
    "icon": "🫘",
    "cat": "Seeds",
    "sell": 170
  },
  "seed_marrowflower": {
    "id": "seed_marrowflower",
    "name": "Marrowflower Seed",
    "description": "A pale seed, fragile to the touch. The flower it yields is palest white.",
    "icon": "🫘",
    "cat": "Seeds",
    "sell": 240
  },
  "seed_hearthbloom": {
    "id": "seed_hearthbloom",
    "name": "Hearthbloom Seed",
    "description": "A warm-toned seed that smells faintly of embers even when unplanted.",
    "icon": "🫘",
    "cat": "Seeds",
    "sell": 340
  },
  "seed_orunroot": {
    "id": "seed_orunroot",
    "name": "Orunroot Seed",
    "description": "A jet-black seed of unknown origin. Takes root in stone. Believers do not plant it lightly.",
    "icon": "🫘",
    "cat": "Seeds",
    "sell": 500
  },
  "seed_ashwood": {
    "id": "seed_ashwood",
    "name": "Ashwood Seed",
    "description": "A seed for growing an ashwood tree.",
    "icon": "🌱",
    "cat": "Seeds",
    "sell": 15,
    "meta": {
      "val": 15
    }
  },
  "seed_coldpine": {
    "id": "seed_coldpine",
    "name": "Coldpine Seed",
    "description": "A seed for growing a coldpine tree.",
    "icon": "🌱",
    "cat": "Seeds",
    "sell": 50,
    "meta": {
      "val": 50
    }
  },
  "seed_stonewood": {
    "id": "seed_stonewood",
    "name": "Stonewood Seed",
    "description": "A seed for growing a stonewood tree.",
    "icon": "🌱",
    "cat": "Seeds",
    "sell": 110,
    "meta": {
      "val": 110
    }
  },
  "seed_greyoak": {
    "id": "seed_greyoak",
    "name": "Greyoak Seed",
    "description": "A seed for growing a greyoak tree.",
    "icon": "🌱",
    "cat": "Seeds",
    "sell": 170,
    "meta": {
      "val": 170
    }
  },
  "seed_ruewood": {
    "id": "seed_ruewood",
    "name": "Ruewood Seed",
    "description": "A seed for growing a ruewood tree.",
    "icon": "🌱",
    "cat": "Seeds",
    "sell": 265,
    "meta": {
      "val": 265
    }
  },
  "seed_deeproot": {
    "id": "seed_deeproot",
    "name": "Deeproot Seed",
    "description": "A seed for growing a deeproot tree.",
    "icon": "🌱",
    "cat": "Seeds",
    "sell": 620,
    "meta": {
      "val": 620
    }
  },
  "herb_ashweed": {
    "id": "herb_ashweed",
    "name": "Ashweed",
    "description": "A common weed with mild medicinal properties. The base of most simple remedies.",
    "icon": "🌿",
    "cat": "Herbs",
    "sell": 15
  },
  "herb_thornroot": {
    "id": "herb_thornroot",
    "name": "Thornroot",
    "description": "A spiky root with a bitter taste. Useful in poultices and traded well.",
    "icon": "🌿",
    "cat": "Herbs",
    "sell": 28
  },
  "herb_bloodberry": {
    "id": "herb_bloodberry",
    "name": "Bloodberry",
    "description": "A red-stained fruit. Tastes of copper and sweetness. Alchemists prize it.",
    "icon": "🍒",
    "cat": "Herbs",
    "sell": 45
  },
  "herb_coldmoss": {
    "id": "herb_coldmoss",
    "name": "Coldmoss",
    "description": "A pale, soft moss from highland patches. Cooling in application.",
    "icon": "🌿",
    "cat": "Herbs",
    "sell": 70
  },
  "herb_ironleaf": {
    "id": "herb_ironleaf",
    "name": "Ironleaf",
    "description": "A metal-grey leaf, stiff and sharply edged. Highly valued by herbalists.",
    "icon": "🌿",
    "cat": "Herbs",
    "sell": 105
  },
  "herb_greybloom": {
    "id": "herb_greybloom",
    "name": "Greybloom",
    "description": "A moor flower, grey-petaled and faintly aromatic. Dries into potent powder.",
    "icon": "🌸",
    "cat": "Herbs",
    "sell": 150
  },
  "herb_spinethistle": {
    "id": "herb_spinethistle",
    "name": "Spinethistle",
    "description": "A thorned herb requiring gloves to harvest. Its spines are useful in their own right.",
    "icon": "🌿",
    "cat": "Herbs",
    "sell": 210
  },
  "herb_ruevine": {
    "id": "herb_ruevine",
    "name": "Ruevine",
    "description": "Red-veined vine leaves, pungent and staining. Rare and valuable.",
    "icon": "🌿",
    "cat": "Herbs",
    "sell": 290
  },
  "herb_duskshade": {
    "id": "herb_duskshade",
    "name": "Duskshade",
    "description": "A twilight herb of uncertain properties. Traders ask few questions.",
    "icon": "🌿",
    "cat": "Herbs",
    "sell": 400
  },
  "herb_marrowflower": {
    "id": "herb_marrowflower",
    "name": "Marrowflower",
    "description": "Palest white petals, almost translucent. Extraordinarily rare.",
    "icon": "🌸",
    "cat": "Herbs",
    "sell": 560
  },
  "herb_hearthbloom": {
    "id": "herb_hearthbloom",
    "name": "Hearthbloom",
    "description": "A warm, ember-scented bloom. Petal dust glows faintly orange in the dark.",
    "icon": "🌸",
    "cat": "Herbs",
    "sell": 780
  },
  "herb_orunroot": {
    "id": "herb_orunroot",
    "name": "Orunroot",
    "description": "A black, warm root that grows in stone. Believers handle it with reverence. No one knows what it does.",
    "icon": "🖤",
    "cat": "Herbs",
    "sell": 5000
  },
  "fertilizer_basic": {
    "id": "fertilizer_basic",
    "name": "Basic Fertilizer",
    "description": "A simple mix of foraged materials worked into the soil. Improves crop survival by 20%.",
    "icon": "🪣",
    "cat": "Farming",
    "sell": 50
  },
  "fertilizer_rich": {
    "id": "fertilizer_rich",
    "name": "Rich Fertilizer",
    "description": "A dense, pungent fertilizer from rare foraged ingredients. Improves crop survival by 35%.",
    "icon": "🪣",
    "cat": "Farming",
    "sell": 200
  },
  "forage_mushroom": {
    "id": "forage_mushroom",
    "name": "Wild Mushroom",
    "description": "A common mushroom from the forest floor. Edible and useful in composts.",
    "icon": "🍄",
    "cat": "Foraged",
    "sell": 8
  },
  "forage_thornberry": {
    "id": "forage_thornberry",
    "name": "Thornberries",
    "description": "Small, dark berries from bramble thickets. Tart and staining.",
    "icon": "🫐",
    "cat": "Foraged",
    "sell": 15
  },
  "forage_hearthroot": {
    "id": "forage_hearthroot",
    "name": "Hearthroot",
    "description": "A root that grows near old fire pits. Warm to the touch. Used in fertilizers.",
    "icon": "🌿",
    "cat": "Foraged",
    "sell": 40
  },
  "forage_nightshade": {
    "id": "forage_nightshade",
    "name": "Nightshade",
    "description": "A plant of the deep wood. Handled carefully. Valuable to the right buyers.",
    "icon": "🌿",
    "cat": "Foraged",
    "sell": 65
  },
  "forage_ashroot": {
    "id": "forage_ashroot",
    "name": "Ashroot",
    "description": "A root found in ash-rich soils, often near old fires. Rare and sought after.",
    "icon": "🌿",
    "cat": "Foraged",
    "sell": 100
  },
  "forage_dawnspore": {
    "id": "forage_dawnspore",
    "name": "Dawnspore",
    "description": "A rare spore that appears only at dawn in old-growth areas. Highly prized.",
    "icon": "🍄",
    "cat": "Foraged",
    "sell": 160
  },
  "forage_deepmoss": {
    "id": "forage_deepmoss",
    "name": "Deepmoss",
    "description": "A dense, dark moss found on cave walls near the Marrow Deeps entrance. Cold to the touch. Used in slow-cooked stews and certain draughts.",
    "icon": "🌿",
    "cat": "Foraged",
    "sell": 35
  },
  "forage_ashbloom": {
    "id": "forage_ashbloom",
    "name": "Ashbloom",
    "description": "A pale flower that grows in the ash of old fire pits — the same sites where Hearthroot clusters. Rarer than it looks.",
    "icon": "🌸",
    "cat": "Foraged",
    "sell": 55
  },
  "forage_orunbloom": {
    "id": "forage_orunbloom",
    "name": "Orunbloom",
    "description": "A gold-hearted bloom that opens only where Orun's seam runs near the surface — the rarest forage in Varath. Eat it and its light kindles your Grace; a master forager's find.",
    "icon": "🌼",
    "cat": "Foraged",
    "sell": 240,
    "graceRestore": 25
  },
  "forge_token": {
    "id": "forge_token",
    "name": "Forge Token",
    "description": "A stamped disc of knucklestone. The Ashforge Guild uses these as proof of rank. This one is Berric's.",
    "icon": "🔖",
    "cat": "Quest"
  },
  "pale_record_pass": {
    "id": "pale_record_pass",
    "name": "Pale Record Pass",
    "description": "A wax-sealed letter from the Pale Record archive granting access to a restricted reading room.",
    "icon": "📜",
    "cat": "Quest"
  },
  "seam_marker": {
    "id": "seam_marker",
    "name": "Seam Marker",
    "description": "An iron spike with a lodge sigil. Marks a site of interest to the Warden's Lodge. Someone placed this at the seam before you arrived.",
    "icon": "⚑",
    "cat": "Quest"
  },
  "greyoak_bough": {
    "id": "greyoak_bough",
    "name": "Greyoak Bough",
    "description": "A branch cut from the greyoak at the Lodge threshold. Maret handed it to you. You're not sure what it means yet.",
    "icon": "🌿",
    "cat": "Quest"
  },
  "orun_shard_large": {
    "id": "orun_shard_large",
    "name": "The Shard",
    "description": "Larger than the first fragment. Heavier in the hand than it looks. The cult says this one has a name.",
    "icon": "🖤",
    "cat": "Quest"
  },
  "cult_offering": {
    "id": "cult_offering",
    "name": "Cult Offering",
    "description": "A carefully wrapped bundle left at the seam site. The Heartmoor Cult leaves these when they cannot stay.",
    "icon": "🕯️",
    "cat": "Quest"
  },
  "berric_notes": {
    "id": "berric_notes",
    "name": "Berric's Notes",
    "description": "Folded papers in Berric's hand. Delivery schedules, a name, and a price that doesn't add up to anything honest.",
    "icon": "📋",
    "cat": "Quest"
  },
  "maret_key": {
    "id": "maret_key",
    "name": "Maret's Key",
    "description": "A Lodge master key. Maret gave it to you with two conditions. She didn't write them down.",
    "icon": "🗝️",
    "cat": "Quest"
  },
  "sera_lens": {
    "id": "sera_lens",
    "name": "Pale Record Lens",
    "description": "A brass and glass tool from Sera's archive kit. Used to read script that's been deliberately obscured.",
    "icon": "🔍",
    "cat": "Quest"
  },
  "lenne_token": {
    "id": "lenne_token",
    "name": "Lenne's Hunting Token",
    "description": "A small carved token Lenne uses to mark a trail. She gave you one. That's not nothing.",
    "icon": "🪶",
    "cat": "Quest"
  },
  "lodge_badge": {
    "id": "lodge_badge",
    "name": "Lodge Badge",
    "description": "The Warden's Lodge emblem. Signifies you've completed the trial and are considered kin by the woodwardens.",
    "icon": "🛡️",
    "cat": "Quest"
  },
  "greymane_pelt": {
    "id": "greymane_pelt",
    "name": "Greymane Pelt",
    "description": "The pelt of the Greymane Boar. Massive. Carries a smell that other animals don't like. The Lodge will want this.",
    "icon": "🐗",
    "cat": "Quest"
  },
  "greymane_tusk": {
    "id": "greymane_tusk",
    "name": "Greymane Tusk",
    "description": "A great curved tusk from the Greymane Boar. Lenne says the old hunters kept these. She'd like one.",
    "icon": "🦷",
    "cat": "Quest"
  },
  "ashforge_hammer": {
    "id": "ashforge_hammer",
    "name": "Ashforge Hammer",
    "description": "A Brotherhood hammer, stamped with the guild mark. Heavier than a common smith's tool. Faster at the strike for it.",
    "icon": "🔨",
    "cat": "Tools"
  },
  "intact_burial_shard": {
    "id": "intact_burial_shard",
    "name": "Intact Burial Shard",
    "description": "A Shard of Orun still set in its burial position, untouched since the Underloft. The Marrow Keeper gave you this. It is a question someone died asking.",
    "icon": "🖤",
    "cat": "Quest"
  },
  "sera_cipher_pendant": {
    "id": "sera_cipher_pendant",
    "name": "Cipher Pendant",
    "description": "Sera's personal cipher key. Her locked research notes open for whoever holds this. She gave it to you. That means something specific to her.",
    "icon": "🔑",
    "cat": "Quest"
  },
  "lodge_token": {
    "id": "lodge_token",
    "name": "Lodge Token",
    "description": "A carved wooden disc stamped with the Lodge mark. Proof of standing with the Warden's Lodge. Not given lightly.",
    "icon": "🌲",
    "cat": "Quest"
  },
  "order_cipher_key": {
    "id": "order_cipher_key",
    "name": "Order Cipher Key",
    "description": "A small brass key etched with Pale Record notation. Unlocks the Order's first tier of sealed lore entries.",
    "icon": "🗝️",
    "cat": "Quest"
  },
  "apprentice_mark_blade": {
    "id": "apprentice_mark_blade",
    "name": "Apprentice Mark Blade",
    "description": "A ribstone blade forged to Brotherhood standard. The Mark is stamped into the tang. Proof you can work the difficult metals.",
    "icon": "🗡️",
    "cat": "Tools"
  },
  "berric_ledger": {
    "id": "berric_ledger",
    "name": "Berric's Ledger",
    "description": "Berric's personal accounts. Names, figures, and arrangements the Order would find very interesting. Evidence, depending on who holds it.",
    "icon": "📒",
    "cat": "Quest"
  },
  "warden_longbow": {
    "id": "warden_longbow",
    "name": "Warden Longbow",
    "description": "A proper Lodge bow, fitted and balanced for the deep wood. Maret doesn't give these to people she doesn't trust with the range.",
    "icon": "🏹",
    "cat": "Weapons"
  },
  "chronicler_seal": {
    "id": "chronicler_seal",
    "name": "Chronicler's Seal",
    "description": "The Pale Record's mark of authorship. Grants full access to Order archives and identifies the bearer as a trusted chronicler.",
    "icon": "📜",
    "cat": "Quest"
  },
  "ironbark_shard": {
    "id": "ironbark_shard",
    "name": "Ironbark Shard",
    "description": "A splinter of ironbark hard enough to strike sparks. Prized by fletchers and smiths alike.",
    "icon": "🪵",
    "cat": "Rare Drops",
    "sell": 40
  },
  "heartoak_amber": {
    "id": "heartoak_amber",
    "name": "Heartoak Amber",
    "description": "A bead of fossil resin from the deepest heartoak. Warm-coloured, and warm to hold \u2014 a crafter can set it in gold.",
    "icon": "🟠",
    "cat": "Rare Drops",
    "sell": 120
  },

  "mount_blanket": {
    "id": "mount_blanket",
    "name": "Striped Saddle Blanket",
    "description": "A woven blanket in Ironvale stripes, laid under the saddle of any steed you ride. Keeps the beast warm and the rider proud.",
    "icon": "🧣",
    "cat": "Mounts",
    "sell": 1000
  },
  "mount_plume": {
    "id": "mount_plume",
    "name": "Scarlet Plume",
    "description": "A tall dyed crest fixed to the headstall of any steed you ride. Visible across a battlefield, which is rather the point.",
    "icon": "🪶",
    "cat": "Mounts",
    "sell": 2000
  },
  "saddle_silver": {
    "id": "saddle_silver",
    "name": "Silvered Saddle",
    "description": "Pale-worked leather chased with silver. Any steed you ride wears it — moonlight where the gilded saddle is sun.",
    "icon": "🏇",
    "cat": "Mounts",
    "sell": 4000
  },
  "vial_water": {
    "id": "vial_water",
    "name": "Vial of Water",
    "description": "A stoppered glass vial of clean water — the base of every potion. Fill your own from a glass vial at a cauldron, or buy them from the apothecary.",
    "icon": "🧴",
    "cat": "Potions",
    "stackable": true,
    "sell": 4
  },
  "potion_grace": {
      "id": "potion_grace",
      "name": "Grace Potion (2)",
      "description": "Ashweed and bonemeal in blessed water. Each dose restores 50 Grace. Two doses.",
      "icon": "🙏",
      "cat": "Potions",
      "sell": 60,
      "graceRestore": 50,
      "doseNext": "potion_grace_1"
    },
  "potion_grace_1": {
      "id": "potion_grace_1",
      "name": "Grace Potion (1)",
      "description": "Ashweed and bonemeal in blessed water. Each dose restores 50 Grace. One dose left.",
      "icon": "🙏",
      "cat": "Potions",
      "sell": 30,
      "graceRestore": 50
    },
  "pot_gatherer": {
      "id": "pot_gatherer",
      "name": "Gathering Potion (2)",
      "description": "Thornroot sharpens the eye. Each dose quickens gathering for 4 minutes. Two doses.",
      "icon": "🧪",
      "cat": "Potions",
      "sell": 90,
      "buff": "gather_speed",
      "buffAmt": 0.12,
      "buffMs": 240000,
      "doseNext": "pot_gatherer_1"
    },
  "pot_gatherer_1": {
      "id": "pot_gatherer_1",
      "name": "Gathering Potion (1)",
      "description": "Thornroot sharpens the eye. Each dose quickens gathering for 4 minutes. One dose left.",
      "icon": "🧪",
      "cat": "Potions",
      "sell": 45,
      "buff": "gather_speed",
      "buffAmt": 0.12,
      "buffMs": 240000
    },
  "pot_warrior": {
      "id": "pot_warrior",
      "name": "Vigour Potion (2)",
      "description": "Bloodberry heat in the arm. Each dose raises melee damage for 4 minutes. Two doses.",
      "icon": "🔴",
      "cat": "Potions",
      "sell": 120,
      "buff": "melee_dmg",
      "buffAmt": 4,
      "buffMs": 240000,
      "doseNext": "pot_warrior_1"
    },
  "pot_warrior_1": {
      "id": "pot_warrior_1",
      "name": "Vigour Potion (1)",
      "description": "Bloodberry heat in the arm. Each dose raises melee damage for 4 minutes. One dose left.",
      "icon": "🔴",
      "cat": "Potions",
      "sell": 60,
      "buff": "melee_dmg",
      "buffAmt": 4,
      "buffMs": 240000
    },
  "pot_runner": {
      "id": "pot_runner",
      "name": "Energy Potion (2)",
      "description": "Coldmoss cools the burn in the legs. Each dose restores your run energy in full. Two doses.",
      "icon": "🥤",
      "cat": "Potions",
      "sell": 150,
      "energyRestore": 100,
      "doseNext": "pot_runner_1"
    },
  "pot_runner_1": {
      "id": "pot_runner_1",
      "name": "Energy Potion (1)",
      "description": "Coldmoss cools the burn in the legs. Each dose restores your run energy in full. One dose left.",
      "icon": "🥤",
      "cat": "Potions",
      "sell": 75,
      "energyRestore": 100
    },
  "pot_ironhide": {
      "id": "pot_ironhide",
      "name": "Ward Potion (2)",
      "description": "Ironleaf stiffens the skin. Each dose raises defence for 4 minutes. Two doses.",
      "icon": "🛡",
      "cat": "Potions",
      "sell": 180,
      "buff": "defence",
      "buffAmt": 6,
      "buffMs": 240000,
      "doseNext": "pot_ironhide_1"
    },
  "pot_ironhide_1": {
      "id": "pot_ironhide_1",
      "name": "Ward Potion (1)",
      "description": "Ironleaf stiffens the skin. Each dose raises defence for 4 minutes. One dose left.",
      "icon": "🛡",
      "cat": "Potions",
      "sell": 90,
      "buff": "defence",
      "buffAmt": 6,
      "buffMs": 240000
    },
  "brace_tonic": {
      "id": "brace_tonic",
      "name": "Bracing Draught (2)",
      "description": "Ashweed steeped over greyoak gall — a hedge-brewer's guard-tonic. Each dose braces you against harm: every blow you take lands 10% softer for 3 minutes. No Faith required — the one protection any fighter can carry. Two doses.",
      "icon": "🩹",
      "cat": "Potions",
      "sell": 55,
      "buff": "mitigate",
      "buffAmt": 0.1,
      "buffMs": 180000,
      "doseNext": "brace_tonic_1"
    },
  "brace_tonic_1": {
      "id": "brace_tonic_1",
      "name": "Bracing Draught (1)",
      "description": "Ashweed steeped over greyoak gall — a hedge-brewer's guard-tonic. Each dose braces you against harm: every blow you take lands 10% softer for 3 minutes. No Faith required — the one protection any fighter can carry. One dose left.",
      "icon": "🩹",
      "cat": "Potions",
      "sell": 28,
      "buff": "mitigate",
      "buffAmt": 0.1,
      "buffMs": 180000
    },
  "pot_deepgrace": {
      "id": "pot_deepgrace",
      "name": "Super Grace Potion (2)",
      "description": "Greybloom steeped over double bonemeal. Each dose restores 120 Grace. Two doses.",
      "icon": "✨",
      "cat": "Potions",
      "sell": 260,
      "graceRestore": 120,
      "doseNext": "pot_deepgrace_1"
    },
  "pot_deepgrace_1": {
      "id": "pot_deepgrace_1",
      "name": "Super Grace Potion (1)",
      "description": "Greybloom steeped over double bonemeal. Each dose restores 120 Grace. One dose left.",
      "icon": "✨",
      "cat": "Potions",
      "sell": 130,
      "graceRestore": 120
    },
  "pot_archer": {
      "id": "pot_archer",
      "name": "Draw Potion (2)",
      "description": "Spinethistle steadies the draw. Each dose raises ranged damage for 4 minutes. Two doses.",
      "icon": "🟢",
      "cat": "Potions",
      "sell": 320,
      "buff": "ranged_dmg",
      "buffAmt": 5,
      "buffMs": 240000,
      "doseNext": "pot_archer_1"
    },
  "pot_archer_1": {
      "id": "pot_archer_1",
      "name": "Draw Potion (1)",
      "description": "Spinethistle steadies the draw. Each dose raises ranged damage for 4 minutes. One dose left.",
      "icon": "🟢",
      "cat": "Potions",
      "sell": 160,
      "buff": "ranged_dmg",
      "buffAmt": 5,
      "buffMs": 240000
    },
  "pot_battlemind": {
      "id": "pot_battlemind",
      "name": "Edge Potion (2)",
      "description": "Ruevine clears the red mist. Each dose raises melee accuracy for 4 minutes. Two doses.",
      "icon": "🧠",
      "cat": "Potions",
      "sell": 420,
      "buff": "melee_acc",
      "buffAmt": 12,
      "buffMs": 240000,
      "doseNext": "pot_battlemind_1"
    },
  "pot_battlemind_1": {
      "id": "pot_battlemind_1",
      "name": "Edge Potion (1)",
      "description": "Ruevine clears the red mist. Each dose raises melee accuracy for 4 minutes. One dose left.",
      "icon": "🧠",
      "cat": "Potions",
      "sell": 210,
      "buff": "melee_acc",
      "buffAmt": 12,
      "buffMs": 240000
    },
  "pot_sage": {
      "id": "pot_sage",
      "name": "Experience Potion (2)",
      "description": "Duskshade opens the mind. Each dose lifts ALL experience gains 5% for 8 minutes. Two doses.",
      "icon": "📘",
      "cat": "Potions",
      "sell": 550,
      "buff": "xp_boost",
      "buffAmt": 0.05,
      "buffMs": 480000,
      "doseNext": "pot_sage_1"
    },
  "pot_sage_1": {
      "id": "pot_sage_1",
      "name": "Experience Potion (1)",
      "description": "Duskshade opens the mind. Each dose lifts ALL experience gains 5% for 8 minutes. One dose left.",
      "icon": "📘",
      "cat": "Potions",
      "sell": 275,
      "buff": "xp_boost",
      "buffAmt": 0.05,
      "buffMs": 480000
    },
  "pot_mastergather": {
      "id": "pot_mastergather",
      "name": "Super Gathering Potion (2)",
      "description": "Marrowflower under the fingernails. Each dose greatly quickens gathering for 4 minutes. Two doses.",
      "icon": "⚗",
      "cat": "Potions",
      "sell": 700,
      "buff": "gather_speed",
      "buffAmt": 0.25,
      "buffMs": 240000,
      "doseNext": "pot_mastergather_1"
    },
  "pot_mastergather_1": {
      "id": "pot_mastergather_1",
      "name": "Super Gathering Potion (1)",
      "description": "Marrowflower under the fingernails. Each dose greatly quickens gathering for 4 minutes. One dose left.",
      "icon": "⚗",
      "cat": "Potions",
      "sell": 350,
      "buff": "gather_speed",
      "buffAmt": 0.25,
      "buffMs": 240000
    },
  "pot_hearthfire": {
      "id": "pot_hearthfire",
      "name": "Super Experience Potion (2)",
      "description": "Hearthbloom's warmth in the blood. Each dose lifts ALL experience gains 10% for 8 minutes. Two doses.",
      "icon": "🟠",
      "cat": "Potions",
      "sell": 950,
      "buff": "xp_boost",
      "buffAmt": 0.1,
      "buffMs": 480000,
      "doseNext": "pot_hearthfire_1"
    },
  "pot_hearthfire_1": {
      "id": "pot_hearthfire_1",
      "name": "Super Experience Potion (1)",
      "description": "Hearthbloom's warmth in the blood. Each dose lifts ALL experience gains 10% for 8 minutes. One dose left.",
      "icon": "🟠",
      "cat": "Potions",
      "sell": 475,
      "buff": "xp_boost",
      "buffAmt": 0.1,
      "buffMs": 480000
    },
  "pot_antidote": {
    "id": "pot_antidote",
    "name": "Antidote (2)",
    "description": "Spinethistle steeped over nightshade — bitter enough to make the blood refuse anything else. Each dose draws out poison AND venom outright. Two doses.",
    "icon": "\ud83e\uddea",
    "cat": "Potions",
    "sell": 320,
    "curePoison": true,
    "doseNext": "pot_antidote_1"
  },
  "pot_antidote_1": {
    "id": "pot_antidote_1",
    "name": "Antidote (1)",
    "description": "One bitter mouthful left. Draws out poison and venom outright.",
    "icon": "\ud83e\uddea",
    "cat": "Potions",
    "sell": 160,
    "curePoison": true
  },
  "pot_orunstears": {
      "id": "pot_orunstears",
      "name": "Restore Potion (2)",
      "description": "Orunroot and nightshade — the master's brew. Each dose fills your Grace outright and knits 40 health. Two doses.",
      "icon": "🖤",
      "cat": "Potions",
      "sell": 1400,
      "graceRestore": 999,
      "heals": 40,
      "doseNext": "pot_orunstears_1"
    },
  "pot_orunstears_1": {
      "id": "pot_orunstears_1",
      "name": "Restore Potion (1)",
      "description": "Orunroot and nightshade — the master's brew. Each dose fills your Grace outright and knits 40 health. One dose left.",
      "icon": "🖤",
      "cat": "Potions",
      "sell": 700,
      "graceRestore": 999,
      "heals": 40
    },
  "saddle_gold": {
    "id": "saddle_gold",
    "name": "Gilded Saddle",
    "description": "Tooled leather worked with gold leaf. Any steed you ride wears it — pure swagger, zero speed.",
    "icon": "🏇",
    "cat": "Mounts",
    "sell": 8000
  },
  "horse_armor": {
    "id": "horse_armor",
    "name": "Steel Barding",
    "description": "A chest plate and chamfron fitted to any steed you ride. The horse hates the weight and loves the drama.",
    "icon": "🛡️",
    "cat": "Mounts",
    "sell": 12000
  },
  "horror_lantern": {
    "id": "horror_lantern",
    "name": "Horror's Lantern",
    "description": "Cut from the Delve Horror's crown — it burns without fuel and without warmth. Proof you walked down all four waves and back out.",
    "icon": "🏮",
    "cat": "Armour",
    "slot": "offhand",
    "def": 8,
    "magAcc": 6,
    "lore": "delve",
    "sell": 4200
  },
  "cloak_greyback": {
    "id": "cloak_greyback",
    "name": "Greyback Mantle",
    "description": "A mantle cut from the wandering beast's grey hide. Warm as a hearth and heavy as a debt — you don't buy one, you catch one.",
    "icon": "🧥",
    "cat": "Capes",
    "slot": "cape",
    "def": 5,
    "sell": 6500
  },
  "cape_ending_flame": {
    "id": "cape_ending_flame",
    "name": "Cape of the Unlit Flame",
    "description": "Black cloth, ash-hemmed. For the one who broke the Shard rather than let anyone hold it. The moor is colder now, and freer.",
    "icon": "🖤",
    "cat": "Capes",
    "slot": "cape",
    "def": 3,
    "sell": 0
  },
  "cape_ending_vault": {
    "id": "cape_ending_vault",
    "name": "Cape of the Sealed Vault",
    "description": "Record-grey, clasped with a vault-key sigil. For the one who locked the warmth away where no faith or forge could spend it.",
    "icon": "🗝️",
    "cat": "Capes",
    "slot": "cape",
    "def": 3,
    "sell": 0
  },
  "cape_ending_dawn": {
    "id": "cape_ending_dawn",
    "name": "Cape of the Answered Dawn",
    "description": "Ember-orange, warm to the touch, always. For the one who used the Shard and heard the warmth answer back.",
    "icon": "🌅",
    "cat": "Capes",
    "slot": "cape",
    "def": 3,
    "sell": 0
  },
  "cape_ending_road": {
    "id": "cape_ending_road",
    "name": "Cape of the Long Road",
    "description": "Travel-worn wool, no sigil at all. For the one who set the Shard down and walked away with the only thing worth keeping — the question.",
    "icon": "🛤️",
    "cat": "Capes",
    "slot": "cape",
    "def": 3,
    "sell": 0
  },
  "cape_agility": {
    "id": "cape_agility",
    "name": "Free Runner's Cape",
    "description": "The mark of a master of Agility. The ground scarcely slows you.",
    "icon": "👟",
    "cat": "Capes",
    "slot": "cape",
    "sell": 0,
    "meta": { "skill": "agility" }
  }
  ,
  "barrow_king_signet": {
    "id": "barrow_king_signet",
    "name": "Barrow-King's Signet",
    "description": "UNIQUE. The Barrow-King's stubborn vigour lives in the band: every foe you fell knits your wounds a little. Taken from the chest in his resting hall.",
    "icon": "💍",
    "cat": "Jewellery",
    "slot": "ring",
    "acc": 6,
    "sell": 0
  },
  "delvers_lantern": {
    "id": "delvers_lantern",
    "name": "Delver's Lantern",
    "description": "UNIQUE. A wick that burns without oil, cased in vault-glass. Night and the deep places brighten around whoever bears it.",
    "icon": "🏮",
    "cat": "Armour",
    "slot": "offhand",
    "tier": 3,
    "def": 2,
    "twoHand": false,
    "sell": 0
  },
  "tablet_barrow": {
    "id": "tablet_barrow",
    "name": "Pale Tablet: The Wolf",
    "description": "A grave-tablet cut in the Pale script — the running wolf, over and over, and a road going north. Someone learned should see this.",
    "icon": "🪨",
    "cat": "Quest",
    "sell": 0
  },
  "tablet_vault": {
    "id": "tablet_vault",
    "name": "Pale Tablet: The Mountain",
    "description": "A ledger-tablet in the Pale script — tallies, seals, and a mountain split by a gate. Someone learned should see this.",
    "icon": "🪨",
    "cat": "Quest",
    "sell": 0
  },
  "barrow_key": {
    "id": "barrow_key",
    "name": "Barrow-King's Key",
    "description": "A long iron key from a grave-sentinel's belt, cold as the halls it was forged for.",
    "icon": "🗝️",
    "cat": "Quest",
    "sell": 0
  },
  "vault_key": {
    "id": "vault_key",
    "name": "Wardens' Key",
    "description": "A toothed key of vault-steel. The strongdoor it answers has waited a long time.",
    "icon": "🗝️",
    "cat": "Quest",
    "sell": 0
  },
  "drowned_seal": {
    "id": "drowned_seal",
    "name": "The Drowned Seal",
    "description": "UNIQUE. The Magistrate's seal of office on a chain of river-silver. Bread broken under its authority goes further: everything you eat heals half again as much.",
    "icon": "📿",
    "cat": "Jewellery",
    "slot": "necklace",
    "def": 2,
    "sell": 0
  },
  "storm_mantle": {
    "id": "storm_mantle",
    "name": "Herald's Storm-Mantle",
    "description": "UNIQUE. The Storm-Herald's own mantle, woven of high wind. It carries some of your weight as you run — your legs tire far slower.",
    "icon": "🌀",
    "cat": "Capes",
    "slot": "cape",
    "def": 3,
    "sell": 0
  },
  "tablet_court": {
    "id": "tablet_court",
    "name": "Pale Tablet: The Tide",
    "description": "A court-tablet in the Pale script — a seated figure, a rising waterline, and the same road north. Someone learned should see this.",
    "icon": "🪨",
    "cat": "Quest",
    "sell": 0
  },
  "tablet_sky": {
    "id": "tablet_sky",
    "name": "Pale Tablet: The Storm",
    "description": "A chart-tablet in the Pale script — stars, beacons, a mountain pass drawn again and again, and the road north through it. Someone learned should see this.",
    "icon": "🪨",
    "cat": "Quest",
    "sell": 0
  },
  "court_key": {
    "id": "court_key",
    "name": "Reliquary Key",
    "description": "A ceremonial key, green with the moor's long patience. The Reliquarist carried it to the last.",
    "icon": "🗝️",
    "cat": "Quest",
    "sell": 0
  },
  "sky_key": {
    "id": "sky_key",
    "name": "Aerie Key",
    "description": "A key of storm-iron, light as a feather and cold as the high pass. The Warder of the traverse kept it.",
    "icon": "🗝️",
    "cat": "Quest",
    "sell": 0
  },
  "pale_greaves": {
    "id": "pale_greaves",
    "name": "Warden's Pale Greaves",
    "description": "UNIQUE. The Pale Warden stood on the last seal for a thousand years, and the standing is in the steel: while you wear them, every blow that lands on you lands a tenth softer.",
    "icon": "🥾",
    "cat": "Armour",
    "slot": "boots",
    "tier": 6,
    "def": 8,
    "equipLevel": 70,
    "rarity": "rare",
    "sell": 0
  },
  "undergate_key_1": {
    "id": "undergate_key_1",
    "name": "Gatewright's Key",
    "description": "A mason's key of pale stone, heavy as guilt. The Underway's Gatewright carried it through the long silence.",
    "icon": "🗝️",
    "cat": "Quest",
    "sell": 0
  },
  "undergate_key_2": {
    "id": "undergate_key_2",
    "name": "Deepway Key",
    "description": "A sliver of pale iron that hums faintly, as if it remembers the psalm. The Herald of the deep stair kept it to the last verse.",
    "icon": "🗝️",
    "cat": "Quest",
    "sell": 0
  }
};
