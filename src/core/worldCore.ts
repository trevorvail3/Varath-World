/**
 * src/core/worldCore.ts
 * ---------------------
 * The pure "rules engine" of Varath World.
 *
 * RULE 1 — PURITY: there is no DOM, no Date.now(), no Math.random() in this
 * file. The current time and a random-number generator arrive through the
 * `Ctx` argument. That makes the core deterministic: feed it the same inputs
 * and it produces the same outputs, which is exactly what a multiplayer
 * server needs to keep every player in sync.
 *
 * RULE 2 — INTENTS: the only ways to change the world are `applyIntent`
 * (the player asked for something) and `tick` (time passed). Both return a
 * list of WorldEvents describing what happened, so the client can react
 * (log lines, dialogue, hit-splats) without ever touching state itself.
 *
 * RULE 3 — CONTENT IS DATA: all the numbers that describe *what exists*
 * (the map, items, XP curve, where things spawn) come in via the `Content`
 * bundle. This file only holds the *behaviour*.
 */

import type {
  AchievementCond,
  BountyTaskDef,
  CombatStyle,
  Content,
  CropDef,
  Ctx,
  EquipSlot,
  FishRecord,
  FurnitureDef,
  HookedFish,
  Intent,
  ItemDef,
  ItemId,
  MonsterStats,
  ObjKind,
  Player,
  QuestChoice,
  QuestDef,
  QuestObjective,
  QuestState,
  RepChange,
  SkillAction,
  SkillId,
  Vec2,
  WorldEvent,
  WorldObjectDef,
  WorldObjectState,
  WorldState,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Tunable game constants. These are behaviour, so they live here (not content).
// Times are in milliseconds.
// ---------------------------------------------------------------------------

const MOVE_SPEED = 1.8; // tiles per second — a deliberately slow walk
const MOUNT_SPEED_MULT = 1.1; // a worn mount gives a modest travel boost on top of everything

// Run/walk (OSRS-style): running moves SPRINT_MULT× faster but drains run energy
// per tile travelled; energy recovers while walking or standing still. Walking is
// slow on purpose; sprinting (~3.6 tiles/s) is the comfortable pace, so the run
// bar — and Agility, which stretches it — actually matter.
const SPRINT_MULT = 1.55;
const ENERGY_MAX = 100;
const ENERGY_DRAIN = 2.8; // base energy spent per tile sprinted
const ENERGY_REGEN = 4; // base energy recovered per second when not sprinting
const ENERGY_RECOVER = 20; // after running dry, you must regen this much before sprinting again
// Agility MATTERS, hard: the overworld is compact, so a low-level sprint is short
// and its recovery slow — you run dry after a brief dash and have to catch your
// breath, giving a real reason to train — and it scales strongly toward the cap.
// Drain multiplier on ENERGY_DRAIN: 2.8×1.9≈5.3/tile (~19 tiles) at lvl 1 →
// 2.8×0.4≈1.1/tile (~89 tiles) at the cap. Regen multiplier on ENERGY_REGEN:
// 4×0.35=1.4/s (slow, ~71s to full) at lvl 1 → 4×2.2≈8.8/s (~11s) at the cap.
const AGILITY_DRAIN_AT_1 = 1.9;
const AGILITY_DRAIN_AT_CAP = 0.4;
const AGILITY_REGEN_AT_1 = 0.35;
const AGILITY_REGEN_AT_CAP = 2.2;
// Agility is trained on obstacle courses; clearing a full lap pays a bonus equal
// to this multiple of the course's total per-obstacle XP.
const AGILITY_LAP_BONUS_MULT = 1.0;
// The Varathian Trail (whole-map circuit): a lap pays this flat XP dump on top of
// the standard lap bonus, plus this many Agility Marks toward the Trailblazer kit.
// A full lap crosses the entire country — it must out-pay camping the best
// fixed course (Ashfen ~1.8k/min-lap). 20k/lap ≈ 180-260k xp/hr at a 5-7min
// lap: the premier Agility training, and it moves you across the world.
const TRAIL_LAP_XP = 20000;
const TRAIL_LAP_MARKS = 1;
// The Trailblazer outfit: each worn piece eases run-energy this much (drain scaled
// down, regen scaled up); wearing the full set adds a bonus on top.
const TRAIL_PIECES: ItemId[] = ["trail_hood", "trail_vest", "trail_legs", "trail_boots"];
const TRAIL_DRAIN_PER_PIECE = 0.05; // −5% drain each (−20% at 4; −25% full-set)
const TRAIL_REGEN_PER_PIECE = 0.08; // +8% regen each (+32% at 4; +40% full-set)
const TRAIL_FULL_SET_BONUS = 0.05;  // extra 5% both ways for all four

// Predators that strike when you stray too close (everything else waits to be
// attacked). Kept here rather than in content so it's easy to tune.
const AGGRESSIVE = new Set<string>([
  "hill_wolf", "ridge_wolf", "heartmoor_hound", "wild_boar", "greymane_boar",
  "forest_bear", "stone_crawler", "cave_crawler", "mountain_troll", "deep_golem",
  "spine_wraith", "marrow_wraith", "mire_serpent", "outlaw_archer",
  "hollow_warden", "bog_warden", "spine_warlord", "marrow_keeper",
  "cult_zealot", "cult_magus",
]);
// A staff's free basic bolt hits for this fraction of magic max hit — weak
// sustain, so magic's damage comes from autocasting spells (which spend Grace).
// Playtests at 0.7 measured free-bolt magic at ~2× melee xp/hr and DPS; 0.45
// puts unfuelled magic clearly below melee so the Grace/altar loop matters.
const BASIC_BOLT_FACTOR = 0.55;
const AGGRO_RANGE = 1.5; // tiles — only monsters you walk right up to engage you
const FLEE_GRACE_MS = 2500; // after a move, aggressive monsters hold off this long
// Pursuit-on-flee (OSRS aggro): when you run from a fight, an AGGRESSIVE monster
// gives chase for a while instead of instantly disengaging. It moves just under
// the player's walk speed, so a walk doesn't shake it (it stays on your heels
// and re-engages if you stop) but a sprint pulls away. It gives up on a timeout,
// if you break far enough ahead, or if it strays too far from home — then it
// walks back to its spawn.
const PURSUE_MS = 8000;      // how long the chase lasts after you flee
const PURSUE_SPEED = 1.7;    // tiles/sec while chasing (player walk is 1.8)
const PURSUE_GIVEUP = 8;     // give up if the player gets this many tiles ahead
const PURSUE_LEASH = 14;     // never chase further than this from its spawn tile
// On death you drop a tenth of your coin (a real but gentle setback).
const DEATH_GOLD_FRACTION = 0.1;
const DEATH_GOLD_CAP = 250;
// Item risk on death (see the death block in monsterSwing): worn gear is safe,
// the 3 most valuable carried stacks are kept, the rest spills where you fell.
const DEATH_ITEMS_KEPT = 3;
// Total spill value under this is waived — new players never lose their pack.
const DEATH_SPILL_MIN_VALUE = 200;
// How long the spilled pile waits for its corpse run (vs 90s ordinary litter).
const DEATH_SPILL_TTL = 5 * 60_000;
// The Shard of Orun is a rare drop, but this many kills without one guarantees
// the next — so q_first_shard (and the whole main story) can't be RNG-walled.
const SHARD_PITY = 250;
const SHARD_ID = "shard_of_orun" as ItemId;

// Playable level ceiling. The XP table (content) is built a little past this so
// look-ups never fall off the end, but a skill never *reads* above the cap.
// Keep in step with LEVEL_CAP in src/content/xpCurve.ts.
const LEVEL_CAP = 100;

// XP ceiling per skill. Level freezes at 100 (12M XP), but XP keeps accruing
// past that as a prestige/ranking grind — OSRS-style — up to this hard cap.
const XP_CAP = 100_000_000;
// A shrine gives its Grace refill at most once a minute (per stone).
const SHRINE_RECHARGE_MS = 60_000;

// Idle wandering for npcs + monsters. They drift one tile at a time within a
// small box around their spawn, pausing between steps, and hold still when the
// player is right beside them (so you can talk / engage without them sliding
// off). Movement is sub-tile and interpolated, like the player's.
const WANDER = {
  /** Max Chebyshev distance (tiles) a creature may stray from its spawn. */
  radius: 2,
  /** Wander walk speed (tiles/sec) — a slow, unhurried amble. */
  speed: 1.05,
  /** Idle pause between steps is a random ms in [pauseMin, pauseMax]. */
  pauseMin: 1900,
  pauseMax: 5200,
};

// `deplete` is the chance, on a successful gather, that the node runs out and
// the player stops — otherwise they keep gathering until the pack is full.
// Gathering rates (rebalanced): gathering used to lag the processing it feeds by
// ~12× (Mining was a ~160h slog feeding a ~13h Smithing). Faster swings, higher
// success, and less depletion downtime bring it into a healthier ~45–60h band —
// still the input bottleneck, no longer a wall. Mining and Hunter got the most.
const WOODCUTTING = { interval: 1400, success: 0.5, xp: 25, respawn: 7000, deplete: 0.25 };
const MINING = { interval: 1500, success: 0.52, xp: 30, respawn: 7000, deplete: 0.25 };
const FISHING = { interval: 1300, success: 0.55, xp: 20 };
// Fishing reels in on a per-catch timer instead of a fast fixed tick: a low fish
// (ashfin, lvl 1) lands in ~2-4s; richer fish take longer the higher their level
// requirement, so a tier-9 catch is a patient ~5-9s. Each reel is randomised in
// that band so the rhythm isn't metronomic. (Fishing always lands a catch on the
// timer — the wait IS the cost, so there's no separate miss roll.)
function fishCatchInterval(levelReq: number, ctx: Ctx): number {
  const lo = 2000 + levelReq * 40;
  const hi = 4000 + levelReq * 70;
  return Math.round(lo + ctx.rng() * (hi - lo));
}

/**
 * Roll the fish on the line at the Drowned Pier. Species are weighted by their
 * rarity and filtered by Fishing level (the rarer, bigger ones only bite once
 * you're skilled enough). Within a species, the size fraction is biased toward
 * the top of the range by a blend of Fishing level and rod tier — so progress
 * and a finer rod genuinely land heavier fish. Heavier fish fight harder
 * (`strength` drives the client's tension minigame).
 */
/** The Golden Rod of Varath — the cosmetic trophy for the pier's record-holder. */
const GOLD_ROD = "rod_gold" as ItemId;

/** Does the player own the Golden Rod anywhere (hand, pack or bank)? */
function ownsGoldRod(player: Player): boolean {
  if (player.equipment.mainhand === GOLD_ROD) return true;
  if (player.inventory.some((s) => s?.item === GOLD_ROD)) return true;
  return (player.bank[GOLD_ROD] ?? 0) > 0;
}

/** True if the player currently tops the pier's records board. */
function isPierLeader(player: Player): boolean {
  return player.fishingRecords.length > 0 &&
    player.fishingRecords[0]!.angler === player.appearance.name;
}

/** Hand the Golden Rod to the player (pack, or bank if full). */
function grantGoldRod(player: Player, content: Content, events: WorldEvent[]): void {
  if (!content.items[GOLD_ROD]) return;
  if (canAddItem(player, GOLD_ROD)) addItem(player, GOLD_ROD, 1, events);
  else player.bank[GOLD_ROD] = (player.bank[GOLD_ROD] ?? 0) + 1;
}

/**
 * The Golden Rod is the pier champion's trophy, so it can't outlive their reign:
 * if the player no longer tops the board, it "passes to the new champion" and is
 * stripped from hand, pack and bank. Called after a catch updates the records.
 * (Granting it is done in person — you collect it from the warden; see
 * handleNpcTalk.)
 */
function revokeGoldRodIfDethroned(player: Player, content: Content, events: WorldEvent[]): void {
  if (!content.items[GOLD_ROD] || !ownsGoldRod(player) || isPierLeader(player)) return;
  if (player.equipment.mainhand === GOLD_ROD) delete player.equipment.mainhand;
  for (let i = 0; i < player.inventory.length; i++) {
    if (player.inventory[i]?.item === GOLD_ROD) player.inventory[i] = null;
  }
  delete player.bank[GOLD_ROD];
  events.push({ type: "LOG", message: "Your pier record has fallen — the Golden Rod passes to the new champion." });
}

/** True if the player wears a cape that masters fishing (the Angler's Cape, or a
 *  max / Cape of Varath). It lends a small edge to the size of pier catches. */
function fishingCapeWorn(player: Player, content: Content): boolean {
  const cape = player.equipment.cape ? content.items[player.equipment.cape] : undefined;
  const skill = cape?.cat === "Capes" ? cape.meta?.skill : undefined;
  return skill === "fishing" || skill === "max" || skill === "ironvale";
}

/** True if the player wears a cape that masters mining (the Stone Master's Cape,
 *  or a max / Cape of Varath). It lends a miner's edge — ore comes a touch faster,
 *  the perk that finally gives the mining cape a mechanical reason to wear it. */
function miningCapeWorn(player: Player, content: Content): boolean {
  const cape = player.equipment.cape ? content.items[player.equipment.cape] : undefined;
  const skill = cape?.cat === "Capes" ? cape.meta?.skill : undefined;
  return skill === "mining" || skill === "max" || skill === "ironvale";
}

/** True while a grandmaster completion cape — the Cape of Varath or its Ironvale
 *  reskin — is worn. It carries the all-round master bonuses (see grantXp,
 *  syncMaxHp, the combat-stat helpers, and the Bounty-Marks payout). */
function varathCapeWorn(player: Player): boolean {
  const c = player.equipment.cape;
  return c === "cape_max" || c === "cape_ironvale";
}

function rollPierFish(player: Player, content: Content, rodTier: number, ctx: Ctx): HookedFish {
  const level = skillLvl(player, "fishing");
  const skillFrac = Math.min(1, (level / LEVEL_CAP) * 0.6 + (rodTier / 10) * 0.4);
  const pool = content.pierFish.filter((f) => level >= f.minLevel);
  const avail = pool.length > 0 ? pool : [content.pierFish[0]!];

  // Weighted pick by rarity.
  const total = avail.reduce((s, f) => s + f.rarity, 0);
  let roll = ctx.rng() * total;
  let pick = avail[0]!;
  for (const f of avail) { roll -= f.rarity; if (roll <= 0) { pick = f; break; } }

  // Size fraction in [0,1], skewed high with skill (exponent < 1 → bigger). The
  // Angler's Cape adds a small flat nudge toward the top of the range — a bonus
  // that still bites even when level + rod already max the skew.
  const capeBonus = fishingCapeWorn(player, content) ? 0.06 : 0;
  const frac = Math.min(1, Math.pow(ctx.rng(), 1 / (1 + skillFrac * 2)) + capeBonus);
  const weight = Math.round((pick.weight[0] + (pick.weight[1] - pick.weight[0]) * frac) * 10) / 10;
  const length = Math.round(pick.length[0] + (pick.length[1] - pick.length[0]) * (frac * 0.85 + ctx.rng() * 0.15));
  // Absolute-weight difficulty: a 1kg saltgill is gentle, a 50kg leviathan brutal.
  const strength = Math.max(0.2, Math.min(0.95, 0.2 + weight / 60));
  return {
    species: pick.name,
    weight,
    length,
    strength,
    xp: Math.round(weight * pick.xpPerKg),
    gold: Math.round(weight * pick.goldPerKg),
  };
}

/** Insert a landed catch into the pier's top-five board (heaviest first) and
 *  return the rank it took (1..5), or 0 if it didn't make the board. */
function recordCatch(player: Player, f: HookedFish): number {
  const entry: FishRecord = {
    species: f.species,
    weight: f.weight,
    length: f.length,
    angler: player.appearance.name,
  };
  const list = player.fishingRecords;
  list.push(entry);
  list.sort((a, b) => b.weight - a.weight);
  if (list.length > 5) list.length = 5;
  const rank = list.indexOf(entry);
  return rank >= 0 ? rank + 1 : 0;
}
// Hunter: a snare you set and check. A catch "springs" the trap (it depletes),
// then the game wanders back and the trap resets after a short wait. It has no
// tool to speed it, so the constants carry the whole buff.
const HUNTER = { interval: 1900, success: 0.55, respawn: 8000, deplete: 0.3 };
const FORAGE = { interval: 2200, success: 0.6, respawn: 9000, deplete: 0.3 };

/** The step interval for a station recipe. Each recipe's authored `baseTime`
 *  drives its pace (capped so the slowest constructions don't crawl); recipes
 *  without one fall back to a level-scaled beat. Replaces the old flat 1.2s
 *  tick, which playtested at 0.9–1.4M xp/hr — level 100 cooking in 9 hours. */
function craftInterval(action: SkillAction): number {
  return Math.min(action.baseTime ?? (1800 + action.levelReq * 25), 9000);
}

/** Which actions each station offers, by the station's ObjKind. */
export function stationActions(content: Content, station: string): SkillAction[] {
  return content.actions.filter((a) => {
    if (!a.produces) return false;
    if (station === "fire") {
      return a.skill === "cooking" || (a.skill === "survivalist" && a.group === "fire");
    }
    if (station === "furnace") return a.id.startsWith("smelt_");
    // The anvil forges everything smithing that isn't smelting or reforging.
    if (station === "anvil") {
      return a.skill === "smithing" && !a.id.startsWith("smelt_") && !a.meltAll;
    }
    // The cauldron brews all Herblore; the workbench builds all Construction;
    // the crafting table tans leather, blows glass and makes jewellery.
    if (station === "cauldron") return a.skill === "herblore";
    if (station === "workbench") return a.skill === "construction";
    if (station === "crafting_table") return a.skill === "crafting" || (a.skill === "survivalist" && a.group === "seeds");
    if (station === "sawmill") return a.skill === "woodcraft";
    return false;
  });
}

const PLAYER_RESPAWN = 4000;

// Combat math, ported from the Varath idle game (see docs/CANON_LEDGER.md).
const COMBAT = {
  /** Default melee swing interval (ms) when no weapon speed is set. */
  playerMeleeSpeed: 2400,
  /** Fallback monster swing interval (ms) if a monster has no `speed`. */
  monsterSpeed: 3000,
  /** Hit-chance = clamp(att / (att + def·defWeight), floor, cap) — a ratio curve
   *  (att==def·defWeight → 50%) so defence always matters and never saturates. */
  defWeight: 1.35,
  hitFloor: 0.05,
  hitCap: 0.95,
  /** Exploiting a weakness multiplies accuracy / damage. Tuned so the triangle
   *  is REAL: playtests showed 1.2/1.1 vanished under the 95% hit cap (right vs
   *  wrong style differed by <7% TTK). At 1.5/1.4 + the boss off-style penalty
   *  below, bringing the right style is ~2× bringing the wrong one. */
  weaknessAcc: 1.5,
  weaknessDmg: 1.4,
  /** Bosses shrug off attacks that don't exploit a weakness: off-style damage
   *  is multiplied by this. Regular monsters are spared (any style farms trash;
   *  the triangle decides bosses — matching each boss's hint text). */
  bossOffStyleDmg: 0.6,
  /** Ward soaks floor(defence / this) flat damage per hit. */
  wardDivisor: 15,
  /** How long a slain monster stays down before respawning (ms). */
  respawn: 9000,
  /** Tiles a player with a bow can loose an arrow across (Chebyshev). */
  rangedReach: 5,
  // --- Damage feel (combat rebalance) -------------------------------------
  /** How much a combat level adds to max hit. Below 1 so max hit grows slower
   *  than the skill, killing the early one-shots (a level-12 hit can't erase a
   *  near-level foe in one blow) and leaving room for gear to matter. */
  dmgSkillScale: 0.6,
  /** Damage floor as a fraction of max hit: a landed blow rolls in
   *  [dmgMinFrac·max, max], not [1, max]. Tightens the swing so hits feel
   *  consistent instead of "whiff for 1 or crit for everything". */
  dmgMinFrac: 0.4,
  /** Non-boss monsters hit this much harder, so an even fight actually costs HP
   *  and you have to eat / play the weakness triangle. Bosses keep their own
   *  hand-tuned damage (they're excluded). */
  monsterDmgMult: 1.4,
};

// T1·06 — the combat-style toggle is a LIVE tradeoff, not a flat +3. Each stance
// re-weights the SAME accuracy / max-hit / defence you already carry, so the
// choice matters moment-to-moment and switching mid-fight is a real decision:
//   Edge (Accurate)    — more of your blows land, each a shade softer.
//   Vigour (Aggressive)— harder hits at ordinary accuracy: raw DPS.
//   Ward (Defensive)   — trades offence for a real guard, the tank stance.
// The acc/dmg legs only touch MELEE (ranged/magic have their own ratings); the
// def leg applies to whatever you're doing, so Ward tanks for any build. The
// duel snapshot reads the same functions, so PvP inherits the tradeoff for free.
const STYLE_MODS: Record<CombatStyle, { acc: number; dmg: number; def: number }> = {
  edge: { acc: 1.15, dmg: 0.92, def: 1.0 },
  vigour: { acc: 1.0, dmg: 1.12, def: 1.0 },
  ward: { acc: 0.9, dmg: 0.82, def: 1.25 },
};

/** Human names for attack styles, for combat-log lines. */
const STYLE_LABEL: Record<string, string> = {
  slash: "slashing", stab: "stabbing", crush: "crushing", ranged: "ranged", magic: "magic",
};

/** Which weakness phase a wardshift boss is in right now (0 = full HP). */
function wardPhaseOf(stats: MonsterStats, obj: WorldObjectState): { styles: string[]; idx: number } | null {
  const ws = stats.mechanics?.find((m) => m.type === "wardshift");
  if (!ws || ws.type !== "wardshift" || ws.styles.length === 0 || obj.hp === undefined || stats.hp <= 0) return null;
  const frac = Math.max(0, Math.min(1, obj.hp / stats.hp));
  const idx = Math.min(ws.styles.length - 1, Math.floor((1 - frac) * ws.styles.length));
  return { styles: ws.styles, idx };
}

/** The boss's LIVE weakness this instant: a turning ward cycles by HP phase;
 *  everything else uses its fixed list (T1·07). */
function activeWeakness(stats: MonsterStats, obj: WorldObjectState): string[] {
  const ph = wardPhaseOf(stats, obj);
  return ph ? [ph.styles[ph.idx]!] : (stats.weakness ?? []);
}

/** Announce a wardshift turn — only when the ward crosses INTO a deeper phase,
 *  so combat start (phase 0) and any heal-back stay quiet. */
function announceWardshift(stats: MonsterStats, obj: WorldObjectState, events: WorldEvent[]): void {
  const ph = wardPhaseOf(stats, obj);
  if (!ph) return;
  const ws = stats.mechanics!.find((m) => m.type === "wardshift")!;
  const last = obj.wardPhase ?? 0;
  if (ph.idx > last) {
    const style = ph.styles[ph.idx]!;
    events.push({ type: "LOG", message: `${ws.type === "wardshift" ? ws.tell : ""} It is now weak to ${STYLE_LABEL[style] ?? style} attacks.` });
  }
  obj.wardPhase = ph.idx;
}

/** Base max HP before the Vitality level is added. */
const BASE_MAX_HP = 10;

// Special attacks: the bar charges as your blows land and is spent whole on
// one armed finisher — the melee finisher varies by weapon family (Puncture /
// Rending Blow / Shatter), bow TWIN SHOT, staff GRACE SURGE.
// The bounty daily-double window: 20 hours, rolling (see claimBountyTask).
export const DAILY_WINDOW_MS = 20 * 3_600_000;

const SPEC_MAX = 100;
const SPEC_GAIN_PER_HIT = 12;
// Melee specials now differ by the weapon's damage TYPE (its family), not one
// generic Sunder: a stab PUNCTURE finds the gap in armour, a slash RENDING BLOW
// is raw power, a crush SHATTER cracks the target's guard for the whole party.
const SPEC_STAB_MULT = 1.55;   // Puncture: a sure strike that ignores off-style/scale guard
const SPEC_SLASH_MULT = 1.75;  // Rending Blow: the heaviest single hit
const SPEC_CRUSH_MULT = 1.4;   // Shatter: less up-front, but drops the foe's defence
const SPEC_MELEE_MULT = 1.5;   // fallback for an untyped melee weapon
const SPEC_RANGED_MULT = 1.75; // Twin Shot: two shafts strike as one
const SPEC_MAGIC_MULT = 1.8;   // Grace Surge: the bolt arrives ALL at once
const SPEC_SHATTER_DEF = 8;    // Shatter drops the target's defence by this...
const SPEC_SHATTER_MS = 6000;  // ...for this long — a window the whole fight exploits
// Eating costs a beat in combat: your next swing is pushed back, so healing is a
// real DPS trade instead of free tank-and-spam (OSRS's eat-delay tension).
const EAT_DELAY_MS = 1800;

// The PvP ladder: a duel rating everyone starts at, and the swing per result —
// a climbing number that gives a strong duellist a goal past the gold.
const DUEL_RATING_BASE = 1000;
const DUEL_RATING_WIN = 25;
const DUEL_RATING_LOSS = 20;

// The market toll: a fraction of every vendor sale, destroyed (not paid to
// anyone) — the economy's one continuous macro gold-sink at the point of sale.
const SALE_TAX = 0.02;

// The recall tithe: a coin cost on the escape teleport, scaled by combat weight
// so the wealthy meter gold out routinely. Waived when unaffordable (recall must
// still rescue a stuck, broke player).
const RECALL_TITHE_BASE = 150;
const RECALL_TITHE_PER_LVL = 12;
// The Wayfare recall: a PAID return to your last waystone from anywhere (so a
// far region isn't a fresh commute each visit). Cheaper than the escape recall
// but NEVER waived — you must afford the tithe, which keeps it a recurring coin
// sink (T4·04) rather than free omni-teleport, and it runs a short cooldown.
const WAYFARE_TITHE_BASE = 100;
const WAYFARE_TITHE_PER_LVL = 8;
const WAYFARE_COOLDOWN_MS = 5 * 60_000;

const INVENTORY_SIZE = 28;

/** A small starting purse so the market isn't dead on arrival. */
const STARTING_GOLD = 30;

// ---------------------------------------------------------------------------
// Walkability — shared with the client's pathfinder.
// ---------------------------------------------------------------------------

// Fixed solid objects: the player always stops *next to* these, never on them.
// NPCs and monsters block too, but they wander, so their tiles are tracked live
// in state.creatureTiles rather than baked into the static set below.
const BLOCKING_KINDS = new Set([
  "tree",
  "rock",
  "bank",
  "fire",
  "furnace",
  "anvil",
  "shrine",
  "plant_patch",
  "tree_patch",
  "portal",
  "trap",
  "bounty_board",
  "grand_exchange",
  "forage_spot",
  "cauldron",
  "workbench",
  "crafting_table",
  "cart",
  "fountain",
  "sawmill",
  "lamppost",
  "signpost",
  "banner",
  "bone_cairn",
  "waystone",
  "relic",
  "build_hotspot",
  "house_door",
  "record_board",
  "trail_board",
  "pier_gate",
  // Dungeon furniture: gates bar the way until their puzzle flag opens them
  // (a gate spawns with hiddenByFlag, so it stops blocking the moment the flag
  // is set — objectHidden() above already skips hidden objects); levers and
  // chests are solid fixtures you interact with from beside.
  "dungeon_gate",
  "puzzle_lever",
  "dungeon_chest",
  // Surface ruin dressing at the dungeon mouths — solid broken masonry.
  "ruin_prop",
]);

/** A creature's live tile if it's wandering, else its fixed def coordinates. */
export function objectPos(
  def: WorldObjectDef,
  st: WorldObjectState | undefined,
): Vec2 {
  return st?.pos ? { x: st.pos.x, y: st.pos.y } : { x: def.x, y: def.y };
}

/**
 * Build a fast "can I stand on this tile?" function. Water and the deep terrain
 * block movement; fixed solid objects block their tile; and wandering creatures
 * block wherever they currently stand (read live from `state`, which the tick
 * keeps up to date) — so the player always stops *next to* things, even after a
 * creature has drifted from its spawn.
 */
export function buildWalkability(
  content: Content,
  state: WorldState,
): (x: number, y: number) => boolean {
  const blocked = new Set<string>();
  // Sealed add-on doorways block until their extension is built — keyed live, so
  // the wing opens for pathfinding the moment you build it (no rebuild needed).
  const seals = new Map<string, number>(); // doorway tile → tier that unseals it
  for (const obj of content.objects) {
    // Story-gated objects that aren't present for this player don't block — a
    // barrier a quest removes (the pier gate) stops blocking once its flag is
    // set, and a not-yet-revealed object (a quest lair's props) doesn't block
    // before it appears. Rebuild walkability when flags change (see main.ts).
    if (objectHidden(obj, state.player)) continue;
    // Rug footings are floor coverings — you walk over them, so they don't block.
    if (obj.kind === "build_hotspot" && obj.category === "rug") continue;
    if (BLOCKING_KINDS.has(obj.kind)) blocked.add(`${obj.x},${obj.y}`);
    else if (obj.kind === "room_seal") seals.set(`${obj.x},${obj.y}`, obj.tier ?? 1);
  }
  const { map } = content;
  return (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const tile = map.tiles[y * map.width + x];
    if (tile === "water" || tile === "mountain" || tile === "cave_wall" || tile === "deep" || tile === "wall") {
      return false;
    }
    const key = `${x},${y}`;
    if (blocked.has(key)) return false;
    const sealTier = seals.get(key);
    // Read the tier live (not captured) so an in-place upgrade opens the doorway
    // immediately, the way the old per-seal `owned` check did.
    if (sealTier !== undefined && state.player.home.tier < sealTier) return false;
    if (state.creatureTiles.has(key)) return false;
    // A lit campfire occupies its tile — you cook beside it, not on it.
    if (state.campfire && state.campfire.x === x && state.campfire.y === y) return false;
    return true;
  };
}

// ---------------------------------------------------------------------------
// Creating a fresh world.
// ---------------------------------------------------------------------------

export function createWorld(
  content: Content,
  spawn: Vec2,
  ctx: Ctx,
): WorldState {
  activeContent = content;
  const objects: Record<string, WorldObjectState> = {};
  const creatureTiles = new Set<string>();
  for (const def of content.objects) {
    const base: WorldObjectState = {
      id: def.id,
      available: true,
      respawnAt: 0,
    };
    if (def.kind === "monster") base.hp = monsterFor(content, def)?.hp ?? 1;
    // NPCs and monsters start at their spawn tile and amble from there; stagger
    // their first step so they don't all set off in lockstep.
    if (def.kind === "npc" || def.kind === "monster" || def.kind === "critter") {
      base.pos = { x: def.x, y: def.y };
      base.wanderTarget = null;
      base.nextWanderAt = ctx.now + Math.floor(ctx.rng() * WANDER.pauseMax);
      // Only monsters block the player's pathing — you walk through townsfolk
      // (and wildlife) the way you do in OSRS; a monster holds its ground.
      if (def.kind === "monster") creatureTiles.add(`${def.x},${def.y}`);
    }
    objects[def.id] = base;
  }

  const skills = {} as Player["skills"];
  (Object.keys(content.skills) as SkillId[]).forEach((id) => {
    skills[id] = { xp: 0, level: 1 };
  });

  const maxHp = BASE_MAX_HP + (skills.vitality?.level ?? 1);
  // You START at the opening spawn (the tutorial corner by Aldric) but RESPAWN at
  // the city hub — death sends you to town, not back to the tutorial. Building a
  // home bed later moves this respawn to the homestead.
  const respawn = content.respawnPoint ?? spawn;
  const player: Player = {
    pos: { x: spawn.x, y: spawn.y },
    path: [],
    hp: maxHp,
    maxHp,
    spawn: { x: respawn.x, y: respawn.y },
    skills,
    inventory: new Array<Player["inventory"][number]>(INVENTORY_SIZE).fill(null),
    bank: {},
    // Start carrying the basic tier-1 tools (a hatchet in hand, pickaxe and rod
    // in the pack). Gathering auto-wields whichever tool the job needs, so the
    // one mainhand slot is never a chore — and there's a clear upgrade path.
    equipment: { mainhand: "hatchet_1" },
    quiver: 0,
    spec: 0,
    specArmed: false,
    clues: {},
    combatStyle: "vigour",
    running: true,
    energy: ENERGY_MAX,
    grace: 30, // start with a full 30-Grace pool (see graceMax); grows with Faith
    autocastSpell: null,
    winded: false,
    agilityLap: null,
    agilityHop: null,
    trailLaps: 0,
    xpLamps: [],
    collection: ["hatchet_1", "pickaxe_1", "rod_1"],
    quests: {},
    questsDone: [],
    lore: [],
    flags: [],
    gold: STARTING_GOLD,
    reputation: { ashforge: 0, lodge: 0, pale_record: 0, heartmoor_cult: 0 },
    stats: { goldEarned: 0, monstersSlain: 0 },
    bossKills: {},
    bossMilestonesClaimed: [],
    playMs: 0,
    killsSinceShard: 0,
    achievements: [],
    diariesClaimed: [],
    tradesApplied: [],
    appearance: {
      name: "Wanderer", skin: "#e3bd92", hair: "#4a3320", tunic: "#6b6157",
      legColor: "#9a5a2a", shoeColor: "#3a2c20",
      hairStyle: "short", facial: "none", top: "plain", legs: "trousers", shoes: "boots",
    },
    bounty: { marks: 0, guideId: content.bountyGuides[0]?.id ?? "rook", task: null, streak: 0, tasksDone: 0, lastClaimDay: 0, blocked: [], history: [], unlocks: [] },
    home: { storage: {}, placed: [], tier: 0 },
    puzzles: {},
    buffs: {},
    activity: { kind: "idle", targetId: null, actionId: null, nextActionAt: 0, actionInterval: 0 },
    pendingInteractId: null,
    pendingInteractMode: null,
    station: null,
    hooked: null,
    // The pier records board starts seeded with rival anglers to beat; the
    // player's heavier catches push them off, smallest first.
    fishingRecords: content.pierRecords.map((r) => ({ ...r })),
    alive: true,
    respawnAt: 0,
  };

  // The starter pickaxe and rod ride in the pack; the hatchet is in hand.
  player.inventory[0] = { item: "pickaxe_1" as ItemId, qty: 1 };
  player.inventory[1] = { item: "rod_1" as ItemId, qty: 1 };

  return {
    map: content.map,
    player,
    objects,
    creatureTiles,
    ground: [],
    groundSeq: 1,
    lastTick: ctx.now,
  };
}

/** How long loot lingers on the floor before vanishing (ms). */
const GROUND_TTL = 90_000;

// --- Shop stock: each listing has a finite number of units; buying depletes it
//     and it tops back up on a timer, so a shop can't be bought out in one go. ---
const SHOP_RESTOCK_MS = 12 * 60_000; // a full restock about every 12 minutes
// Healing items (cooked food, potions) restock only every 30 minutes and never
// hold more than a handful — so buying meals can't stand in for fishing,
// hunting and cooking your own heals.
const SHOP_FOOD_RESTOCK_MS = 30 * 60_000;
const SHOP_FOOD_STOCK = 5;

/** Is this listing a healing item (food or potion)? Those get the scarce shelf. */
function isHealingItem(content: Content, item: string): boolean {
  return typeof content.items[item as ItemId]?.heals === "number";
}

/** A listing's full stock. Healing items sit shallow (5); otherwise scaled by
 *  price: cheap staples deep (50), premium goods scarce (20). */
function shopMaxStock(content: Content, item: string, price: number): number {
  if (isHealingItem(content, item)) return SHOP_FOOD_STOCK;
  if (price <= 50) return 50;
  if (price <= 200) return 40;
  if (price <= 800) return 30;
  return 20;
}

/** Lazily seed (and time-restock) per-shop stock. Runtime only — resets on a
 *  fresh session, which is fine; within a session it gates rapid buy-outs.
 *  Healing items refresh on their own longer cooldown. */
function ensureShopStock(state: WorldState, content: Content, ctx: Ctx): void {
  if (!state.shopStock) {
    state.shopStock = {};
    state.shopLineRestockAt = {};
    for (const shop of content.shops) {
      const m: Record<string, number> = {};
      for (const line of shop.stock) {
        m[line.item] = line.restockMs ? (line.max ?? 1) : shopMaxStock(content, line.item, line.price);
        if (line.restockMs) state.shopLineRestockAt[`${shop.id}:${line.item}`] = ctx.now + line.restockMs;
      }
      state.shopStock[shop.id] = m;
    }
    state.shopRestockAt = ctx.now + SHOP_RESTOCK_MS;
    state.shopFoodRestockAt = ctx.now + SHOP_FOOD_RESTOCK_MS;
    return;
  }
  const doGeneral = (state.shopRestockAt ?? 0) <= ctx.now;
  const doFood = (state.shopFoodRestockAt ?? 0) <= ctx.now;
  const lineAt = state.shopLineRestockAt ?? (state.shopLineRestockAt = {});
  for (const shop of content.shops) {
    const m = state.shopStock[shop.id] ?? (state.shopStock[shop.id] = {});
    for (const line of shop.stock) {
      // A rationed listing (restockMs) ignores the shared timers and refills to
      // its cap on its own clock — the Devotion Potion's one-every-15-minutes.
      if (line.restockMs) {
        const key = `${shop.id}:${line.item}`;
        if ((lineAt[key] ?? 0) <= ctx.now) {
          m[line.item] = line.max ?? 1;
          lineAt[key] = ctx.now + line.restockMs;
        }
        continue;
      }
      const healing = isHealingItem(content, line.item);
      // General items refresh on the 12-min timer; healing items only on the
      // 30-min one — so each keeps its own cooldown.
      if (healing ? doFood : doGeneral) m[line.item] = shopMaxStock(content, line.item, line.price);
    }
  }
  if (doGeneral) state.shopRestockAt = ctx.now + SHOP_RESTOCK_MS;
  if (doFood) state.shopFoodRestockAt = ctx.now + SHOP_FOOD_RESTOCK_MS;
}

/** Units of a listing currently on the shelf (full if stock hasn't seeded yet). */
export function shopStockLeft(state: WorldState, shopId: string, item: string): number {
  const v = state.shopStock?.[shopId]?.[item];
  return v ?? 50; // unseeded window before the first tick — treat as well-stocked
}

/** Drop a pile of loot on the ground at a tile (a kill's spoils). */
function dropToGround(
  state: WorldState,
  item: ItemId,
  qty: number,
  x: number,
  y: number,
  ctx: Ctx,
  merge = true,
): void {
  // When `merge` (the player dropping items), identical loot on the same tile
  // stacks instead of littering. Kill loot passes merge=false so EACH kill keeps
  // its own pile — fighting wave after wave on the same tile no longer folds
  // every drop onto one ever-growing heap.
  if (merge) {
    const existing = state.ground.find((g) => g.x === x && g.y === y && g.item === item);
    if (existing) {
      existing.qty += qty;
      existing.despawnAt = ctx.now + GROUND_TTL;
      return;
    }
  }
  state.ground.push({ id: state.groundSeq++, item, qty, x, y, despawnAt: ctx.now + GROUND_TTL });
}

/**
 * Pick up the loot on a tile — honoured only when the player is standing on it
 * or right beside it (the client walks them over first). Takes as much as the
 * pack can hold; the rest stays on the floor.
 */
function pickupGround(
  state: WorldState,
  content: Content,
  x: number,
  y: number,
  events: WorldEvent[],
  onlyId?: number,
  wantQty?: number,
): void {
  const player = state.player;
  const dist = Math.max(Math.abs(Math.round(player.pos.x) - x), Math.abs(Math.round(player.pos.y) - y));
  if (dist > 1) return; // not close enough yet
  // Either everything on the tile, or just the one pile the player asked for.
  const here = state.ground.filter((g) => g.x === x && g.y === y && (onlyId === undefined || g.id === onlyId));
  if (here.length === 0) return;
  let anyFull = false;
  for (const g of here) {
    const hasEmpty = player.inventory.some((s) => s === null);
    const cap = isStackable(g.item)
      ? (player.inventory.some((s) => s?.item === g.item) || hasEmpty ? g.qty : 0)
      : player.inventory.filter((s) => s === null).length;
    // Cap to the amount asked for (when taking part of a stack).
    const want = wantQty !== undefined ? Math.min(g.qty, Math.max(0, Math.floor(wantQty))) : g.qty;
    const take = Math.min(want, cap);
    if (take <= 0) { anyFull = true; continue; }
    addItem(player, g.item, take, events);
    g.qty -= take;
    const name = content.items[g.item].name;
    events.push({ type: "LOG", message: `You pick up ${take > 1 ? `${take}× ` : ""}${name}.` });
  }
  state.ground = state.ground.filter((g) => g.qty > 0); // drop empty piles
  if (anyFull) events.push({ type: "INVENTORY_FULL" });
}

/**
 * Open a bird nest: consume it and roll a random farming seed. Lower-tier seeds
 * are common; high-tier and tree seeds are rare — so a nest is a small, hopeful
 * gamble toward better crops, OSRS-style.
 */
function openNest(
  state: WorldState,
  content: Content,
  slot: number,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const player = state.player;
  const held = player.inventory[slot];
  if (!held || held.item !== "bird_nest") return;
  // Weight each crop's seed: common at low level, scarce at high; tree seeds
  // (valuable, slow growers) are rarer still.
  const pool: { seed: ItemId; w: number }[] = [];
  for (const c of Object.values(content.crops)) {
    if (!content.items[c.seed]) continue;
    const base = Math.max(1, 100 - c.levelReq);
    pool.push({ seed: c.seed, w: c.type === "tree" ? Math.max(1, base * 0.18) : base });
  }
  if (pool.length === 0) return;
  removeItems(player, "bird_nest", 1);
  const total = pool.reduce((n, p) => n + p.w, 0);
  let roll = ctx.rng() * total;
  let pick = pool[0]!.seed;
  for (const p of pool) { roll -= p.w; if (roll <= 0) { pick = p.seed; break; } }
  const qty = ctx.rng() < 0.15 ? 3 : ctx.rng() < 0.5 ? 2 : 1;
  addItem(player, pick, qty, events);
  events.push({ type: "LOG", message: `You pick apart the nest and find ${qty}× ${content.items[pick].name}.` });
}

// ---------------------------------------------------------------------------
// Combat draughts off kills — Varath's stat potions (Edge, Vigour, Ward,
// ranging and Devotion brews) seep into EVERY foe's pockets, the way clue
// scrolls do: one global roll on each kill instead of 75 hand-edited tables.
// Rare enough that Herblore stays the real source (~1 kill in 16 sheds a
// dose), generous enough that a session of fighting keeps a few in the pack.
// The pool tiers by the foe's level: low roamers carry single doses of the
// basic three; tougher foes add ranging and grace; past level 30 the full
// two-dose brews (and eventually Deepgrace) join at lower weight.
// ---------------------------------------------------------------------------
const POTION_POOL: { item: ItemId; w: number; minLevel: number }[] = [
  { item: "pot_battlemind_1", w: 3, minLevel: 1 },  // Edge — accuracy
  { item: "pot_warrior_1", w: 3, minLevel: 1 },     // Vigour — damage
  { item: "pot_ironhide_1", w: 3, minLevel: 1 },    // Ward — defence
  { item: "pot_archer_1", w: 3, minLevel: 8 },      // ranging
  { item: "potion_grace_1", w: 2, minLevel: 8 },    // Devotion — grace
  { item: "pot_battlemind", w: 1, minLevel: 30 },   // the full brews, up-tier
  { item: "pot_warrior", w: 1, minLevel: 30 },
  { item: "pot_ironhide", w: 1, minLevel: 30 },
  { item: "pot_archer", w: 1, minLevel: 30 },
  { item: "pot_deepgrace_1", w: 1, minLevel: 45 },
];
const POTION_DROP_ODDS = 16; // 1-in-16 kills sheds a dose

/** Roll a combat draught off a kill: level-gated weighted pick, dropped to the
 *  floor with the rest of the creature's loot. */
function rollPotionDrop(
  state: WorldState,
  x: number,
  y: number,
  stats: MonsterStats,
  ctx: Ctx,
): void {
  if (ctx.rng() >= 1 / POTION_DROP_ODDS) return;
  const lvl = stats.level ?? 1;
  const pool = POTION_POOL.filter((p) => lvl >= p.minLevel);
  if (pool.length === 0) return;
  const total = pool.reduce((n, p) => n + p.w, 0);
  let roll = ctx.rng() * total;
  let pick = pool[0]!.item;
  for (const p of pool) { roll -= p.w; if (roll <= 0) { pick = p.item; break; } }
  dropToGround(state, pick, 1, x, y, ctx, false);
}

// ---------------------------------------------------------------------------
// Herblore secondaries + seeds off bounty quarry — the OSRS slayer/task habit
// of shedding the odd grimy herb, seed, or reagent. Only the creatures the
// Bounty board writes contracts for carry these (kept in sync with the
// bountyTasks pools in content/bounty.ts), so grinding a task quietly stocks
// the Herblore and Farming skills. One global roll per kill, level-tiered:
// low quarry sheds basic mushrooms/ashroot and the cheap seeds; tougher foes
// reach the deep-forage reagents and the rich seeds.
// ---------------------------------------------------------------------------
const BOUNTY_FORAGE_MONSTERS = new Set<string>([
  // Rook's beat + the sewers (the early ladder)
  "moor_rat", "hill_wolf", "red_deer", "sewer_rat", "gutter_spider",
  "sewer_kobold", "sewer_sludge", "footpad", "cutpurse", "poacher",
  "bandit", "highwayman", "cutthroat",
  // Greyoak + Spine + Heartmoor + the roads
  "wild_boar", "greymane_boar", "mountain_lion", "forest_bear",
  "ridge_wolf", "stone_crawler", "mountain_troll", "spine_wraith",
  "marsh_lurker", "heartmoor_hound", "cult_acolyte", "cult_zealot",
  "bog_knight", "mire_serpent", "outlaw_archer", "marauder", "outlaw_captain",
  // The Hunt Warrens
  "warren_creeper", "dusk_stalker", "hollow_hound", "warren_shade", "iron_maw",
  // The Marrow Deeps + the Redrun
  "cave_crawler", "deep_bat", "cult_magus", "marrow_wraith", "deep_golem",
  "river_serpent", "redrun_brigand", "ancient_orc",
  // The old places (Act II ruins)
  "drowned_thrall", "court_wisp", "aerie_harpy", "storm_wisp", "pale_wight",
]);
// item, weight, min creature level to appear, and (for seeds) a small stack.
const BOUNTY_FORAGE_POOL: { item: ItemId; w: number; minLevel: number; min?: number; max?: number }[] = [
  // --- Herblore secondaries (the reagents Herblore actually needs) ---
  { item: "forage_mushroom", w: 4, minLevel: 1 },
  { item: "forage_ashroot", w: 4, minLevel: 1 },
  { item: "forage_thornberry", w: 4, minLevel: 1 },
  { item: "bonemeal", w: 3, minLevel: 1 },
  { item: "forage_hearthroot", w: 3, minLevel: 8 },
  { item: "greyoak_gall", w: 2, minLevel: 20 },
  { item: "forage_nightshade", w: 2, minLevel: 25 },
  { item: "forage_dawnspore", w: 1, minLevel: 40 },
  { item: "forage_deepmoss", w: 1, minLevel: 50 },
  { item: "forage_ashbloom", w: 1, minLevel: 60 },
  // --- Plant seeds (the low ones in small stacks) ---
  { item: "seed_ashweed", w: 5, minLevel: 1, min: 1, max: 2 },
  { item: "seed_thornroot", w: 5, minLevel: 1, min: 1, max: 2 },
  { item: "seed_bloodberry", w: 4, minLevel: 8 },
  { item: "seed_coldmoss", w: 3, minLevel: 15 },
  { item: "seed_ironleaf", w: 3, minLevel: 20 },
  { item: "seed_greybloom", w: 2, minLevel: 28 },
  { item: "seed_spinethistle", w: 2, minLevel: 35 },
  { item: "seed_ruevine", w: 2, minLevel: 45 },
  { item: "seed_duskshade", w: 1, minLevel: 55 },
  { item: "seed_marrowflower", w: 1, minLevel: 65 },
  { item: "seed_hearthbloom", w: 1, minLevel: 72 },
  { item: "seed_orunroot", w: 1, minLevel: 80 },
  // --- The odd grown herb, a rarer prize ---
  { item: "herb_ashweed", w: 2, minLevel: 3 },
  { item: "herb_thornroot", w: 2, minLevel: 10 },
  { item: "herb_coldmoss", w: 1, minLevel: 25 },
  { item: "herb_greybloom", w: 1, minLevel: 35 },
  { item: "herb_duskshade", w: 1, minLevel: 55 },
  // --- Tree seeds, a rare bonus on the tougher quarry ---
  { item: "seed_ashwood", w: 1, minLevel: 15 },
  { item: "seed_greyoak", w: 1, minLevel: 35 },
  { item: "seed_deeproot", w: 1, minLevel: 70 },
];
const BOUNTY_FORAGE_ODDS = 7; // ~1 kill in 7 sheds a herb, seed, or reagent

/** Roll a Herblore secondary / seed off a bounty-quarry kill: only for the
 *  creatures the board hunts, 1-in-ODDS, level-tiered weighted pick. */
function rollBountyForageDrop(
  state: WorldState,
  x: number,
  y: number,
  stats: MonsterStats,
  ctx: Ctx,
): void {
  if (!BOUNTY_FORAGE_MONSTERS.has(stats.id)) return;
  if (ctx.rng() >= 1 / BOUNTY_FORAGE_ODDS) return;
  const lvl = stats.level ?? 1;
  const pool = BOUNTY_FORAGE_POOL.filter((p) => lvl >= p.minLevel);
  if (pool.length === 0) return;
  const total = pool.reduce((n, p) => n + p.w, 0);
  let roll = ctx.rng() * total;
  let pick = pool[0]!;
  for (const p of pool) { roll -= p.w; if (roll <= 0) { pick = p; break; } }
  const min = pick.min ?? 1;
  const max = pick.max ?? min;
  const qty = min + Math.floor(ctx.rng() * (max - min + 1));
  dropToGround(state, pick.item, qty, x, y, ctx, false);
}

// ---------------------------------------------------------------------------
// Trail clues — the treasure-trail repeatable. A monster kill can shed a
// sealed trail scroll (tier by the creature's level, one held per tier);
// its riddle points at one real landmark. Interacting with that landmark
// while carrying the scroll turns it into a casket of the tier.
// ---------------------------------------------------------------------------
const CLUE_TIERS = [
  { tier: "easy" as const, item: "clue_easy" as ItemId, casket: "casket_easy" as ItemId, maxLevel: 29, odds: 35 },
  { tier: "medium" as const, item: "clue_medium" as ItemId, casket: "casket_medium" as ItemId, maxLevel: 69, odds: 45 },
  { tier: "hard" as const, item: "clue_hard" as ItemId, casket: "casket_hard" as ItemId, maxLevel: Infinity, odds: 55 },
];

/** Roll a trail scroll off a kill: tier by monster level, 1-in-odds, and only
 *  when the player isn't already holding (pack or bank) a scroll of that tier. */
function rollClueDrop(
  state: WorldState,
  content: Content,
  stats: MonsterStats,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const t = CLUE_TIERS.find((c) => (stats.level ?? 1) <= c.maxLevel)!;
  if (ctx.rng() >= 1 / t.odds) return;
  if (hasItem(player, t.item) || (player.bank[t.item] ?? 0) > 0) return; // one per tier
  const spots = content.clueSpots[t.tier];
  if (!spots || spots.length === 0 || !canAddItem(player, t.item)) return;
  const pick = spots[Math.floor(ctx.rng() * spots.length)]!;
  player.clues[t.tier] = pick.target;
  // Hard trails run in legs: stash the whole chain (current leg first) so each
  // solve advances to the next riddle and only the last landmark pays out.
  if (t.tier === "hard") {
    player.clueSteps = [{ target: pick.target, riddle: pick.riddle }, ...(pick.then ?? [])];
  }
  addItem(player, t.item, 1, events);
  events.push({ type: "LOG", message: `Tucked in the remains: a sealed ${content.items[t.item].name}. Tap it to read the trail.` });
}

/** Solve a trail at its landmark: the carried scroll becomes a casket. */
function tryClueSolve(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  events: WorldEvent[],
): boolean {
  const { player } = state;
  for (const t of CLUE_TIERS) {
    if (player.clues[t.tier] !== def.id || !hasItem(player, t.item)) continue;
    // A multi-leg hard trail with more legs to walk: solve THIS one, then point
    // the same scroll at the next landmark instead of paying out.
    if (t.tier === "hard" && player.clueSteps && player.clueSteps.length > 1) {
      player.clueSteps.shift();
      const next = player.clueSteps[0]!;
      player.clues.hard = next.target;
      events.push({ type: "LOG", message: `Not the casket — a fresh mark scratched in the stone, and the trail runs on. Read the scroll for the next riddle.` });
      return true;
    }
    // Final leg (or an easy/medium/legacy single-step trail): the scroll pays.
    removeItems(player, t.item, 1);
    delete player.clues[t.tier];
    if (t.tier === "hard") delete player.clueSteps;
    if (canAddItem(player, t.casket)) addItem(player, t.casket, 1, events);
    else player.bank[t.casket] = (player.bank[t.casket] ?? 0) + 1;
    if (!player.flags.includes("clue_solved")) player.flags.push("clue_solved");
    if (t.tier === "hard" && !player.flags.includes("clue_solved_hard")) player.flags.push("clue_solved_hard");
    events.push({ type: "LOG", message: `The riddle meant HERE. Wedged out of sight: a ${content.items[t.casket].name}!` });
    return true;
  }
  return false;
}

/** One weighted line of a container's loot table. */
interface CrateLine { item: ItemId; w: number; min?: number; max?: number }

/** What each openable container holds — a weighted pick per opening (plus a
 *  guaranteed coin purse). Caskets (clue trails) pay better with tier. `rare`
 *  lines roll INDEPENDENTLY after the weighted haul: each is a flat 1-in-`one`
 *  chance, the mechanism behind the hard casket's clue-exclusive cosmetics —
 *  common enough to chase, rare enough to mean something (the "3rd age" hook). */
const CONTAINER_TABLES: Record<string, { rolls: number; coins: [number, number]; lines: CrateLine[]; rare?: { item: ItemId; one: number }[] }> = {
  bounty_crate: {
    rolls: 2, coins: [20, 80],
    lines: [
      { item: "battle_ration", w: 30, min: 2, max: 4 },
      { item: "health_elixir", w: 25, min: 2, max: 3 },
      { item: "arrow_ashiron", w: 18, min: 20, max: 40 },
      { item: "bloodore_arrow", w: 10, min: 10, max: 25 },
      { item: "hunters_kit", w: 8 },
      { item: "cut_gem", w: 6, min: 1, max: 2 },
      { item: "hunters_horn", w: 3 },
    ],
  },
  casket_easy: {
    rolls: 2, coins: [150, 400],
    lines: [
      { item: "battle_ration", w: 25, min: 2, max: 4 },
      { item: "health_elixir", w: 20, min: 1, max: 3 },
      { item: "rough_gem", w: 15, min: 1, max: 2 },
      { item: "seed_ashweed", w: 12, min: 2, max: 4 },
      { item: "ashiron_bar", w: 12, min: 1, max: 3 },
      { item: "bird_nest", w: 8 },
      { item: "wayfarers_hat", w: 3 },
    ],
  },
  casket_medium: {
    rolls: 3, coins: [400, 900],
    lines: [
      { item: "cut_gem", w: 20, min: 1, max: 2 },
      { item: "gold_bar", w: 18, min: 1, max: 2 },
      { item: "bloodore_bar", w: 15, min: 1, max: 2 },
      { item: "health_elixir", w: 14, min: 2, max: 4 },
      { item: "seed_stonewood", w: 10 },
      { item: "bloodore_arrow", w: 12, min: 15, max: 30 },
      { item: "wayfarers_hat", w: 6 },
    ],
  },
  casket_hard: {
    rolls: 3, coins: [900, 2000],
    lines: [
      { item: "cut_gem", w: 20, min: 2, max: 4 },
      { item: "hearthite_bar", w: 16, min: 1, max: 3 },
      { item: "marrow_shard", w: 12 },
      { item: "gold_bar", w: 14, min: 2, max: 4 },
      { item: "arrow_hearthite", w: 12, min: 15, max: 30 },
      { item: "seed_deeproot", w: 8 },
    ],
    // The Pale Regalia (clue-exclusive cosmetic set) rolls independently and
    // rarely; the Underking's Mantle is the ultra-rare apex of the whole trail.
    rare: [
      { item: "pale_mask", one: 48 },
      { item: "pale_cuirass", one: 48 },
      { item: "pale_legwraps", one: 52 },
      { item: "pale_treads", one: 52 },
      { item: "mantle_underking", one: 400 },
    ],
  },
};

/** Prise open a container in the pack: roll its table, hand over the haul. */
function openContainer(
  state: WorldState,
  content: Content,
  slot: number,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const held = player.inventory[slot];
  if (!held) return;
  // The Trailblazer's Lamp: an Agility-Mark sink that pours straight into
  // Agility XP, scaled by level so it stays worth striking at any tier. Bonus
  // XP on top of what the laps already paid — the point is spending SPARE Marks.
  if (held.item === "lamp_agility") {
    removeItems(player, "lamp_agility", 1);
    const lvl = player.skills.agility.level;
    const amount = Math.round(lvl * lvl * 1.2 + 400); // 99 -> ~12,160; 50 -> ~3,400
    grantXp(state, content, "agility", amount, events);
    events.push({ type: "LOG", message: `You crack the Trailblazer's Lamp and its light pours into your stride — ${amount.toLocaleString()} Agility XP.` });
    return;
  }
  const table = CONTAINER_TABLES[held.item];
  if (!table) return;
  removeItems(player, held.item, 1);
  const container = held.item;
  const coins = randInt(ctx, table.coins[0], table.coins[1]);
  player.gold += coins;
  player.stats.goldEarned += coins;
  const got: string[] = [`${coins} gold`];
  const loot: { item: ItemId; qty: number }[] = [];
  for (let r = 0; r < table.rolls; r++) {
    const total = table.lines.reduce((n, l) => n + l.w, 0);
    let roll = ctx.rng() * total;
    let pick = table.lines[0]!;
    for (const l of table.lines) { roll -= l.w; if (roll <= 0) { pick = l; break; } }
    const qty = pick.min !== undefined ? randInt(ctx, pick.min, pick.max ?? pick.min) : 1;
    if (canAddItem(player, pick.item)) addItem(player, pick.item, qty, events);
    else player.bank[pick.item] = (player.bank[pick.item] ?? 0) + qty;
    got.push(`${qty > 1 ? `${qty}× ` : ""}${content.items[pick.item]?.name ?? pick.item}`);
    // Merge repeat rolls of the same item so the popup reads cleanly.
    const ex = loot.find((l) => l.item === pick.item);
    if (ex) ex.qty += qty; else loot.push({ item: pick.item, qty });
  }
  // Independent rare rolls (the hard casket's clue-exclusive cosmetics). Each is
  // its own flat chance on top of the weighted haul; a cosmetic must never be
  // lost to a full pack, so it banks if it won't fit.
  for (const r of table.rare ?? []) {
    if (ctx.rng() >= 1 / r.one) continue;
    if (canAddItem(player, r.item)) addItem(player, r.item, 1, events);
    else player.bank[r.item] = (player.bank[r.item] ?? 0) + 1;
    got.push(content.items[r.item]?.name ?? r.item);
    const ex = loot.find((l) => l.item === r.item);
    if (ex) ex.qty += 1; else loot.push({ item: r.item, qty: 1 });
    events.push({ type: "LOG", message: `Something pale and old, folded at the very bottom: ${content.items[r.item]?.name ?? r.item}!` });
  }
  events.push({ type: "LOG", message: `You prise it open: ${got.join(", ")}.` });
  events.push({ type: "CONTAINER_OPENED", container, coins, items: loot });
}

/** The Founder's Cache: the cosmetic-only items a supporter claims once. The
 *  entitlement is the "founder" flag (stamped at login from the account's
 *  purchase; see FOUNDER.md). Purely cosmetic — no XP, gold, stats, or space. */
const FOUNDER_ITEMS: ItemId[] = ["pet_founder_wisp", "cape_founder"];

function claimFounder(state: WorldState, events: WorldEvent[]): void {
  const player = state.player;
  // Only a founder may claim, and only once.
  if (!player.flags.includes("founder")) return;
  if (player.flags.includes("founder_claimed")) return;
  player.flags.push("founder_claimed");
  for (const id of FOUNDER_ITEMS) {
    if (ownsItem(player, id)) continue; // never duplicate a claim
    // A cosmetic must never be lost to a full pack — bank it if it won't fit.
    if (canAddItem(player, id)) addItem(player, id, 1, events);
    else { player.bank[id] = (player.bank[id] ?? 0) + 1; events.push({ type: "ITEM_GAINED", item: id, qty: 1 }); }
  }
  events.push({ type: "LOG", message: "The First Ember lights at your shoulder. Thank you for standing with Varath at the start." });
}

/**
 * Drop a whole inventory slot onto the player's tile. The pile lingers on the
 * floor (same TTL as loot), so a misclick can be picked back up.
 */
function dropSlot(
  state: WorldState,
  content: Content,
  slot: number,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const player = state.player;
  const data = player.inventory[slot];
  if (!data) return;
  // Quest relics don't hit the ground — dropped tablets and keys despawning is
  // a softlock, not an inventory choice. Bank them if the pack needs the space.
  if (content.items[data.item]?.cat === "Quest") {
    events.push({ type: "LOG", message: `The ${content.items[data.item].name} feels too important to leave in the dirt. (Bank it if it's in the way.)` });
    return;
  }
  const x = Math.round(player.pos.x);
  const y = Math.round(player.pos.y);
  dropToGround(state, data.item, data.qty, x, y, ctx);
  const name = content.items[data.item].name;
  const qty = data.qty;
  player.inventory[slot] = null;
  events.push({ type: "LOG", message: `You drop ${qty > 1 ? `${qty}× ` : ""}${name}.` });
}

/**
 * Claim a completed Area Diary's XP lamp, pouring its reward into the chosen
 * skill. Re-checks every task here (the client only offers it when complete, but
 * the core is the authority) and guards against double-claims.
 */
function claimDiary(
  state: WorldState,
  content: Content,
  diaryId: string,
  skill: SkillId,
  events: WorldEvent[],
): void {
  const player = state.player;
  const diary = content.diaries.find((d) => d.id === diaryId);
  if (!diary) return;
  if (player.diariesClaimed.includes(diaryId)) {
    events.push({ type: "LOG", message: "You've already claimed that diary's reward." });
    return;
  }
  if (!player.skills[skill]) {
    events.push({ type: "LOG", message: "You haven't unlocked that skill yet." });
    return;
  }
  const allMet = diary.tasks.every((t) => evalAchievement(player, content, t.cond).met);
  if (!allMet) {
    events.push({ type: "LOG", message: `${diary.name} diary isn't finished yet.` });
    return;
  }
  player.diariesClaimed.push(diaryId);
  grantXp(state, content, skill, diary.reward, events);
  events.push({
    type: "LOG",
    message: `${diary.name} diary complete! You pour ${diary.reward.toLocaleString()} XP into ${content.skills[skill].name}.`,
  });
}

/** Boss kill-count milestone thresholds, shared by every boss. */
export const BOSS_MILESTONE_KILLS = [10, 25, 50, 100, 250] as const;

/** One milestone tier: the kills needed and what it pays out. */
export interface BossMilestone {
  kills: number;
  /** XP-lamp value — poured into a skill the player chooses on claim. */
  xp: number;
  /** A pet granted at this tier (pity for the rare drop), if not already owned. */
  pet?: ItemId;
}

/** The companion item whose meta.petBoss matches this boss, if any. */
function bossPetItem(content: Content, bossId: string): ItemId | undefined {
  for (const id of Object.keys(content.items) as ItemId[]) {
    const d = content.items[id];
    if (d.slot === "companion" && d.meta?.["petBoss"] === bossId) return id;
  }
  return undefined;
}

/** The milestone ladder for a boss: each tier is an XP lamp at a standard rate
 *  (100 XP per kill needed, so the 250-kill tier caps at 25k), the same for
 *  every boss; the 100-kill tier also grants the boss's pet as a pity guarantee. */
export function bossMilestones(stats: MonsterStats, content: Content): BossMilestone[] {
  const petId = bossPetItem(content, stats.id);
  return BOSS_MILESTONE_KILLS.map((k) => {
    const m: BossMilestone = { kills: k, xp: k * 100 }; // 1k / 2.5k / 5k / 10k / 25k
    if (k === 100 && petId) m.pet = petId;
    return m;
  });
}

function claimBossMilestone(
  state: WorldState,
  content: Content,
  bossId: string,
  kills: number,
  skill: SkillId,
  events: WorldEvent[],
): void {
  const player = state.player;
  const stats = content.monsters[bossId];
  if (!stats || !stats.boss) return;
  if (!player.skills[skill]) {
    events.push({ type: "LOG", message: "You haven't unlocked that skill yet." });
    return;
  }
  const key = `${bossId}:${kills}`;
  if (player.bossMilestonesClaimed.includes(key)) {
    events.push({ type: "LOG", message: "You've already claimed that milestone." });
    return;
  }
  if ((player.bossKills[bossId] ?? 0) < kills) {
    events.push({ type: "LOG", message: `Defeat ${stats.name} ${kills} times to claim that.` });
    return;
  }
  const tier = bossMilestones(stats, content).find((m) => m.kills === kills);
  if (!tier) return;
  player.bossMilestonesClaimed.push(key);
  let petLine = "";
  if (tier.pet && !ownsItem(player, tier.pet)) {
    if (canAddItem(player, tier.pet)) {
      addItem(player, tier.pet, 1, events);
    } else {
      player.bank[tier.pet] = (player.bank[tier.pet] ?? 0) + 1;
      events.push({ type: "ITEM_GAINED", item: tier.pet, qty: 1 });
    }
    petLine = ` and ${content.items[tier.pet].name}`;
  }
  grantXp(state, content, skill, tier.xp, events);
  events.push({
    type: "LOG",
    message: `${stats.name}: ${kills} kills! You pour ${tier.xp.toLocaleString()} XP into ${content.skills[skill].name}${petLine}.`,
  });
}

// ---------------------------------------------------------------------------
// Small internal helpers (all pure).
// ---------------------------------------------------------------------------

function findObjectDef(content: Content, id: string): WorldObjectDef | undefined {
  return content.objects.find((o) => o.id === id);
}

/**
 * Story gate: an object with a `requiresFlag` is treated as absent until the
 * player owns that flag. The client (render, minimap, click-targeting) and the
 * core (interaction) all consult this so a quest boss stays hidden — and
 * un-attackable — until its quest reveals the lair.
 */
export function objectHidden(def: WorldObjectDef, player: Player): boolean {
  if (def.requiresFlag && !player.flags.includes(def.requiresFlag)) return true;
  // Inverse gate: a barrier that a quest REMOVES (e.g. the pier's roped gate,
  // gone once access is granted).
  if (def.hiddenByFlag && player.flags.includes(def.hiddenByFlag)) return true;
  return false;
}

/** The combat stats for a monster object, or undefined for non-monsters. */
function monsterFor(
  content: Content,
  def: WorldObjectDef,
): MonsterStats | undefined {
  return def.monster ? content.monsters[def.monster] : undefined;
}

/** The default tier-1 gathering action for each resource-node kind. */
const DEFAULT_RESOURCE: Record<string, string> = {
  tree: "fell_ashwood",
  rock: "mine_knucklestone",
  fishing_spot: "fish_ashfin",
  trap: "hunt_hare",
};

/** The SkillAction a resource node yields (its `resource`, or the kind default). */
function gatherAction(content: Content, def: WorldObjectDef): SkillAction | undefined {
  const id = def.resource ?? DEFAULT_RESOURCE[def.kind];
  return id ? content.actions.find((a) => a.id === id) : undefined;
}

/**
 * Start gathering a resource node: resolve its action, check the skill level,
 * and set the activity (carrying the action id). Returns false if it can't
 * start (unknown resource or too low a level), having logged why.
 */
function beginGather(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  objId: string,
  kind: "woodcutting" | "mining" | "fishing" | "trapping" | "foraging",
  interval: number,
  ctx: Ctx,
  events: WorldEvent[],
): boolean {
  const { player } = state;
  const action = gatherAction(content, def);
  if (!action) return false;
  if (skillLvl(player, action.skill) < action.levelReq) {
    events.push({
      type: "LOG",
      message: `You need ${content.skills[action.skill].name} level ${action.levelReq} for that.`,
    });
    return false;
  }
  // This kind of gathering needs the matching tool wielded in the mainhand; a
  // better tool tier gathers faster. If the right tool isn't in hand we try to
  // wield one from the pack, so you never have to swap tools by hand. (Trapping
  // needs no tool.)
  const toolKind = GATHER_TOOL[kind];
  let speedMult = 1;
  if (toolKind) {
    const tier = wieldGatherTool(player, content, toolKind, events);
    if (tier === null) {
      events.push({ type: "LOG", message: TOOL_MISSING[toolKind] ?? "You need the right tool for that." });
      return false;
    }
    speedMult = TOOL_TIER_SPEED[tier] ?? 1;
  }
  // A gathering tincture speeds every gather (fishing has no tool but still buffs).
  speedMult *= 1 - Math.min(0.6, buffVal(player, "gather_speed"));
  // The Stone Master's Cape earns its keep: worn, ore comes ~15% faster — the
  // mining cape's first real mechanical perk (see miningCapeWorn).
  if (action.skill === "mining" && miningCapeWorn(player, content)) speedMult *= 0.85;
  // Fishing reels on its own tier-scaled timer (so even the first catch waits the
  // right beat); the gather tincture still trims it.
  const baseInterval = kind === "fishing"
    ? Math.round(fishCatchInterval(action.levelReq, ctx) * speedMult)
    : Math.round(interval * speedMult);
  player.activity = {
    kind,
    targetId: objId,
    actionId: action.id,
    nextActionAt: ctx.now + baseInterval,
    actionInterval: baseInterval,
  };
  return true;
}

/** What to tell the player when they try to gather without the right tool. */
const TOOL_MISSING: Record<string, string> = {
  hatchet: "You need a hatchet to chop here.",
  pickaxe: "You need a pickaxe to mine here.",
  rod: "You need a fishing rod to fish here.",
};

/**
 * Make sure the player is wielding a usable tool of `toolKind`, auto-swapping
 * the best one out of the pack if their hands are empty or holding the wrong
 * thing. Returns the wielded tool's tier, or null if they own no usable tool.
 * "Usable" means the player's gathering level meets the tool's wield requirement.
 */
function wieldGatherTool(
  player: Player,
  content: Content,
  toolKind: "hatchet" | "pickaxe" | "rod",
  events: WorldEvent[],
): number | null {
  const level = skillLvl(player, TOOL_SLOT_SKILL[toolKind]);
  const usable = (id: ItemId | undefined): boolean => {
    if (!id) return false;
    const d = content.items[id];
    if (!d || d.tool !== toolKind) return false;
    return level >= (TOOL_TIER_REQS[d.tier ?? 1] ?? 1);
  };

  // Already holding a usable tool of this kind?
  const inHand = player.equipment.mainhand;
  if (usable(inHand)) return content.items[inHand!].tier ?? 1;

  // Otherwise wield the best usable one from the pack (swap with whatever's
  // in hand). Tools are unique per tier, so this is a clean 1-for-1 swap.
  let bestIdx = -1;
  let bestTier = -1;
  for (let i = 0; i < player.inventory.length; i++) {
    const slot = player.inventory[i];
    if (!slot || !usable(slot.item)) continue;
    const t = content.items[slot.item].tier ?? 1;
    if (t > bestTier) { bestTier = t; bestIdx = i; }
  }
  if (bestIdx === -1) return null;

  const toolId = player.inventory[bestIdx]!.item;
  const displaced = player.equipment.mainhand;
  player.equipment.mainhand = toolId;
  player.inventory[bestIdx] = displaced ? { item: displaced, qty: 1 } : null;
  events.push({ type: "LOG", message: `You ready your ${content.items[toolId].name}.` });
  return bestTier;
}

function levelFromXp(xpTable: number[], xp: number): number {
  let level = 1;
  while (
    level < LEVEL_CAP &&
    level + 1 < xpTable.length &&
    (xpTable[level + 1] ?? Infinity) <= xp
  ) {
    level++;
  }
  return level;
}

function grantXp(
  state: WorldState,
  content: Content,
  skill: SkillId,
  amount: number,
  events: WorldEvent[],
): void {
  const s = state.player.skills[skill];
  const before = s.level;
  // A summoned skilling companion sweetens XP for its own skill. Kept fractional
  // so a small % still accrues on low-XP actions (the display rounds it).
  const comp = activeCompanion(state.player, content);
  if (comp?.meta?.["petSkill"] === skill && typeof comp.meta["bonusAmt"] === "number") {
    amount = amount * (1 + (comp.meta["bonusAmt"] as number));
  }
  // An XP-boost tincture (Herblore) lifts all XP gains while it lasts.
  amount = amount * (1 + buffVal(state.player, "xp_boost"));
  // The Cape of Varath (or its Ironvale reskin) lends +5% to every XP gain.
  if (varathCapeWorn(state.player)) amount = amount * 1.05;
  s.xp = Math.min(s.xp + amount, XP_CAP); // level caps at 100; XP still climbs to 100M
  events.push({ type: "XP_GAINED", skill, amount });
  const after = levelFromXp(content.xpForLevel, s.xp);
  if (after > before) {
    s.level = after;
    events.push({ type: "LEVEL_UP", skill, level: after });
  }
}

/** Add an item to the inventory (items stack by id). Returns success. */
/**
 * The active content, cached at each core entry point (createWorld / applyIntent
 * / tick). Content is static, deterministic data — not time or randomness — so a
 * cached reference doesn't compromise the pure core; it just lets the inventory
 * helpers look up an item's stackability without threading `content` through
 * every caller.
 */
let activeContent: Content | null = null;

/** OSRS rules: items are individual unless flagged stackable (ammo always is). */
function isStackable(item: ItemId): boolean {
  const d = activeContent?.items[item];
  return !!d && (d.stackable === true || d.slot === "ammo" || d.cat === "Seeds");
}

/**
 * Add `qty` of an item to the pack. Stackable items pile into one slot;
 * everything else takes one slot per unit (OSRS-style), filling as many empty
 * slots as it can and reporting a full pack if it can't place them all.
 */
function addItem(
  player: Player,
  item: ItemId,
  qty: number,
  events: WorldEvent[],
): boolean {
  // Log the item in the collection the first time it's ever obtained.
  const coll = (player.collection ??= []);
  if (!coll.includes(item)) coll.push(item);
  if (isStackable(item)) {
    const existing = player.inventory.find((slot) => slot?.item === item);
    if (existing) {
      existing.qty += qty;
      events.push({ type: "ITEM_GAINED", item, qty });
      return true;
    }
    const emptyIndex = player.inventory.findIndex((slot) => slot === null);
    if (emptyIndex === -1) {
      events.push({ type: "INVENTORY_FULL" });
      return false;
    }
    player.inventory[emptyIndex] = { item, qty };
    events.push({ type: "ITEM_GAINED", item, qty });
    return true;
  }
  // Non-stackable: one slot per unit.
  let placed = 0;
  for (let n = 0; n < qty; n++) {
    const emptyIndex = player.inventory.findIndex((slot) => slot === null);
    if (emptyIndex === -1) break;
    player.inventory[emptyIndex] = { item, qty: 1 };
    placed++;
  }
  if (placed > 0) events.push({ type: "ITEM_GAINED", item, qty: placed });
  if (placed < qty) events.push({ type: "INVENTORY_FULL" });
  return placed > 0;
}

function clearActivity(player: Player): void {
  player.activity = { kind: "idle", targetId: null, actionId: null, nextActionAt: 0, actionInterval: 0 };
}

/** Does the player hold at least one USABLE (un-noted) of this item? */
function hasItem(player: Player, item: ItemId): boolean {
  return player.inventory.some((slot) => slot?.item === item && slot.qty > 0 && !slot.noted);
}

/** True (and logs a hint) when a slot holds a note — a note can't be used
 *  directly (eaten, worn, buried, crushed). Bank or deposit it to un-note. */
function notedGuard(player: Player, slot: number, events: WorldEvent[]): boolean {
  if (!player.inventory[slot]?.noted) return false;
  events.push({ type: "LOG", message: "That's a note — bank it to turn it back into the item first." });
  return true;
}

/** Is there room in the pack for this item (a matching stack or an empty slot)? */
function canAddItem(player: Player, item: ItemId): boolean {
  if (isStackable(item)) {
    return player.inventory.some((slot) => slot === null || slot.item === item);
  }
  return player.inventory.some((slot) => slot === null);
}

/** Buy one listing (its whole bundle) from a shop — needs gold and pack room.
 *  Stocked listings deplete by a unit per purchase and refuse when empty. */
function buyFromShop(
  state: WorldState,
  player: Player,
  content: Content,
  shopId: string,
  item: ItemId,
  events: WorldEvent[],
  ctx: Ctx,
): void {
  const shop = content.shops.find((s) => s.id === shopId);
  const line = shop?.stock.find((s) => s.item === item);
  if (!line) return;
  // Ending-gated wares: only sold once the story flag is set.
  if (line.requiresFlag && !player.flags.includes(line.requiresFlag)) return;
  const def = content.items[item];
  // Capes are earned one-offs (level-gated below), so they're never stock-limited.
  const stocked = def.cat !== "Capes";
  if (stocked) {
    ensureShopStock(state, content, ctx);
    if (shopStockLeft(state, shopId, item) <= 0) {
      events.push({ type: "LOG", message: `${def.name} is out of stock — the keeper will have more before long.` });
      return;
    }
  }
  // Skill capes are earned, not just bought: each needs level 100 (mastery) in
  // its skill, and the Cape of Varath needs every skill at 100.
  const capeSkill = def.cat === "Capes" ? def.meta?.skill : undefined;
  if (capeSkill && capeSkill !== "max" && capeSkill !== "ironvale") {
    if (skillLvl(player, capeSkill as SkillId) < 100) {
      events.push({ type: "LOG", message: `You need ${content.skills[capeSkill as SkillId].name} level 100 to claim the ${def.name}.` });
      return;
    }
  }
  if (item === "cape_max" && !allSkillsMaxed(player)) {
    events.push({ type: "LOG", message: "The Cape of Varath is earned only by mastering every skill to 100." });
    return;
  }
  // A listing may be priced in an alternate currency (e.g. Agility Marks) rather
  // than gold. Charge whichever this line uses.
  const payWith = line.costItem;
  const payQty = line.costQty ?? 0;
  if (payWith) {
    if (countItem(player, payWith) < payQty) {
      const cur = content.items[payWith].name;
      events.push({ type: "LOG", message: `You need ${payQty} ${cur}${payQty === 1 ? "" : "s"} for that.` });
      return;
    }
  } else if (player.gold < line.price) {
    events.push({ type: "LOG", message: "You can't afford that." });
    return;
  }
  if (!canAddItem(player, item)) {
    events.push({ type: "INVENTORY_FULL" });
    return;
  }
  if (payWith) removeItems(player, payWith, payQty);
  else player.gold -= line.price;
  addItem(player, item, line.qty, events);
  if (stocked && state.shopStock?.[shopId]) {
    state.shopStock[shopId]![item] = Math.max(0, shopStockLeft(state, shopId, item) - 1);
  }
  const name = content.items[item].name;
  const bundle = line.qty > 1 ? `${line.qty}× ` : "";
  const cost = payWith
    ? `${payQty} ${content.items[payWith].name}${payQty === 1 ? "" : "s"}`
    : `${line.price}g`;
  events.push({ type: "LOG", message: `Bought ${bundle}${name} for ${cost}.` });
}

/** Sell up to `qty` of an item from the pack at the market for its gold value. */
/** The lowest price any shop charges to BUY each item — cached per content.
 *  Used to stop shop arbitrage: you can never sell an item back for more than
 *  you could buy it for, so there's no buy-low-sell-high free gold. */
const shopFloorCache = new WeakMap<Content, Map<string, number>>();
function shopFloor(content: Content): Map<string, number> {
  let m = shopFloorCache.get(content);
  if (!m) {
    m = new Map();
    for (const shop of content.shops) {
      for (const line of shop.stock) {
        // Per-UNIT buy price — shops sell bundles (e.g. 50 arrows for 6g), so the
        // per-item cost is what an arbitrage compares against, not the bundle price.
        const per = line.price / Math.max(1, line.qty);
        const prev = m.get(line.item);
        if (prev === undefined || per < prev) m.set(line.item, per);
      }
    }
    shopFloorCache.set(content, m);
  }
  return m;
}
/** Gold the market pays for an item: its sell value, but never above the
 *  cheapest shop buy price (so a stocked item can't be flipped for profit).
 *  Exported so the shop UI can show the exact payout the core will pay. */
export function marketValue(content: Content, item: ItemId): number {
  const base = content.items[item]?.sell ?? 0;
  const floor = shopFloor(content).get(item);
  return floor !== undefined ? Math.min(base, floor) : base;
}

function sellToMarket(
  player: Player,
  content: Content,
  item: ItemId,
  qty: number,
  events: WorldEvent[],
): void {
  const def = content.items[item];
  const value = marketValue(content, item);
  if (value <= 0) {
    events.push({ type: "LOG", message: `No one will buy the ${def?.name ?? "item"}.` });
    return;
  }
  const toSell = Math.min(Math.max(0, Math.floor(qty)), countItem(player, item));
  if (toSell <= 0) return;
  // Floor the TOTAL (the per-item value may be fractional once capped to a
  // bundle's per-unit buy price), so selling can never out-earn buying.
  const total = Math.floor(value * toSell);
  if (total <= 0) {
    events.push({ type: "LOG", message: `No one will pay for the ${def.name}.` });
    return;
  }
  // A 2% market toll, taken off the top and DESTROYED (no counterparty — the
  // gold simply isn't created). The shared economy's one true macro sink: every
  // faucet in the game meets a small, unavoidable drain at the point of sale.
  // (OSRS-style: tiny sales under the toll's rounding go untaxed.)
  const tax = Math.floor(total * SALE_TAX);
  const net = total - tax;
  for (let i = 0; i < toSell; i++) removeOneItem(player, item);
  player.gold += net;
  player.stats.goldEarned += net;
  const bundle = toSell > 1 ? `${toSell}× ` : "";
  events.push({
    type: "LOG",
    message: tax > 0
      ? `Sold ${bundle}${def.name} for ${net}g (after a ${tax}g market toll).`
      : `Sold ${bundle}${def.name} for ${net}g.`,
  });
}

/** Does the player hold everything a recipe needs (requires + requiresAny)? */
function hasIngredients(player: Player, action: SkillAction): boolean {
  if (action.requires) {
    for (const [item, qty] of Object.entries(action.requires)) {
      if (countItem(player, item as ItemId) < (qty ?? 0)) return false;
    }
  }
  if (action.requiresAny && action.requiresAny.length > 0) {
    if (!action.requiresAny.some((item) => hasItem(player, item))) return false;
  }
  return true;
}

/** Consume one batch of a recipe's inputs from the pack. */
function consumeIngredients(player: Player, action: SkillAction): void {
  if (action.requires) {
    for (const [item, qty] of Object.entries(action.requires)) {
      for (let i = 0; i < (qty ?? 0); i++) removeOneItem(player, item as ItemId);
    }
  }
  if (action.requiresAny && action.requiresAny.length > 0) {
    const choice = action.requiresAny.find((item) => hasItem(player, item));
    if (choice) removeOneItem(player, choice);
  }
}

/** Remove a single unit of an item from the inventory. */
// Notes (bank slips) are NOT usable stock: the helpers below count and consume
// only ordinary (un-noted) slots, so recipes, eating, quest hand-ins and shop
// sales all correctly ignore notes. Banking and the Grand Exchange use the
// noted-inclusive variants (removeAnyItem / countAnyItem) further down.
function removeOneItem(player: Player, item: ItemId): void {
  const idx = player.inventory.findIndex(
    (slot) => slot?.item === item && slot.qty > 0 && !slot.noted,
  );
  if (idx === -1) return;
  const slot = player.inventory[idx]!;
  slot.qty -= 1;
  if (slot.qty <= 0) player.inventory[idx] = null;
}

/** How many usable (un-noted) of an item the player carries, across all stacks. */
function countItem(player: Player, item: ItemId): number {
  let n = 0;
  for (const slot of player.inventory) {
    if (slot?.item === item && !slot.noted) n += slot.qty;
  }
  return n;
}

/** Remove up to `qty` usable (un-noted) of an item; returns how many were removed. */
function removeItems(player: Player, item: ItemId, qty: number): number {
  let left = qty;
  for (let i = 0; i < player.inventory.length && left > 0; i++) {
    const slot = player.inventory[i];
    if (slot?.item === item && !slot.noted) {
      const take = Math.min(slot.qty, left);
      slot.qty -= take;
      left -= take;
      if (slot.qty <= 0) player.inventory[i] = null;
    }
  }
  return qty - left;
}

/** How many of an item the player carries INCLUDING notes (for bank + Exchange). */
function countAnyItem(player: Player, item: ItemId): number {
  let n = 0;
  for (const slot of player.inventory) if (slot?.item === item) n += slot.qty;
  return n;
}

/** Remove up to `qty` of an item taking un-noted first, then notes; returns how
 *  many were removed. Used where a note IS spendable — banking and Exchange sales. */
function removeAnyItem(player: Player, item: ItemId, qty: number): number {
  let removed = removeItems(player, item, qty); // ordinary stock first
  let left = qty - removed;
  for (let i = 0; i < player.inventory.length && left > 0; i++) {
    const slot = player.inventory[i];
    if (slot?.item === item && slot.noted) {
      const take = Math.min(slot.qty, left);
      slot.qty -= take; left -= take; removed += take;
      if (slot.qty <= 0) player.inventory[i] = null;
    }
  }
  return removed;
}

/** Add `qty` of an item to the pack AS A NOTE (bank slip): merges into an
 *  existing note stack of the same item, else takes one empty slot. Notes always
 *  stack. Returns false (and flags a full pack) if there's no slot for a new note. */
function addNoted(player: Player, item: ItemId, qty: number, events: WorldEvent[]): boolean {
  const coll = (player.collection ??= []);
  if (!coll.includes(item)) coll.push(item);
  const existing = player.inventory.find((s) => s?.item === item && s.noted);
  if (existing) { existing.qty += qty; events.push({ type: "ITEM_GAINED", item, qty }); return true; }
  const empty = player.inventory.findIndex((s) => s === null);
  if (empty === -1) { events.push({ type: "INVENTORY_FULL" }); return false; }
  player.inventory[empty] = { item, qty, noted: true };
  events.push({ type: "ITEM_GAINED", item, qty });
  return true;
}

/**
 * Sum a combat stat ("acc", "dmg" or "def") across everything the player is
 * wearing. This is how worn gear feeds into the fight without the core knowing
 * item names — it just reads the numbers content gave each piece.
 */
function equipStat(
  player: Player,
  content: Content,
  field: "acc" | "dmg" | "def" | "rngAcc" | "rngDmg" | "magAcc" | "magDmg",
): number {
  let total = 0;
  for (const [slot, id] of Object.entries(player.equipment)) {
    if (!id) continue;
    // Arrows feed ranged math only — never melee accuracy/damage.
    if (slot === "ammo") continue;
    const idef = content.items[id];
    // A bow in the mainhand is a ranged weapon: its acc/dmg belong to the Draw
    // math (rangedAccuracy/rangedMaxHit), so it must not pad the melee sums.
    if (slot === "mainhand" && idef.ranged && (field === "acc" || field === "dmg")) continue;
    total += idef[field] ?? 0;
    // Skill capes are best-in-slot defensive gear — their worn benefit. The
    // Cape of Varath (and its prestige reskin) gives the most.
    if (field === "def" && idef.cat === "Capes") {
      total += idef.meta?.skill === "max" || idef.meta?.skill === "ironvale" ? 18 : 10;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Handling intents (RULE 2: the only player-driven way to change the world).
// ---------------------------------------------------------------------------

export function applyIntent(
  state: WorldState,
  content: Content,
  intent: Intent,
  ctx: Ctx,
): WorldEvent[] {
  activeContent = content;
  const events: WorldEvent[] = [];
  const { player } = state;
  if (!player.alive) return events; // dead players can't act until they respawn

  switch (intent.type) {
    case "MOVE": {
      // Fleeing a fight? An AGGRESSIVE foe you were trading blows with gives
      // chase (OSRS-style) instead of instantly letting you walk off — stamp a
      // pursuit timer on it before we drop the engagement.
      const foeId = player.activity.kind === "combat" ? player.activity.targetId : undefined;
      if (foeId) {
        const foe = content.objects.find((o) => o.id === foeId);
        const foeObj = state.objects[foeId];
        if (foe?.kind === "monster" && foe.monster && foeObj?.available && AGGRESSIVE.has(foe.monster)) {
          foeObj.pursueUntil = ctx.now + PURSUE_MS;
        }
      }
      player.path = intent.path.map((p) => ({ x: p.x, y: p.y }));
      player.pendingInteractId = null;
      player.pendingInteractMode = null;
      player.station = null; // walking away leaves the counter
      clearActivity(player);
      // Deliberately walking = you're fleeing/moving on; give a grace so an
      // aggressive monster can't re-lock you the instant you step away.
      player.aggroImmuneUntil = ctx.now + FLEE_GRACE_MS;
      break;
    }
    case "INTERACT": {
      player.path = intent.path.map((p) => ({ x: p.x, y: p.y }));
      player.pendingInteractId = intent.objId;
      player.pendingInteractMode = intent.mode ?? null;
      player.station = null; // a fresh interaction; startInteraction re-sets it
      clearActivity(player);
      // If we're already standing next to it, act immediately.
      if (player.path.length === 0) {
        startInteraction(state, content, intent.objId, ctx, events);
      }
      break;
    }
    case "CANCEL": {
      player.path = [];
      player.pendingInteractId = null;
      player.station = null;
      clearActivity(player);
      break;
    }
    case "EAT": {
      if (notedGuard(player, intent.slot, events)) break;
      eatSlot(player, content, intent.slot, ctx, events);
      break;
    }
    case "PICKUP": {
      pickupGround(state, content, intent.x, intent.y, events, intent.id, intent.qty);
      break;
    }
    case "OPEN_NEST": {
      openNest(state, content, intent.slot, ctx, events);
      break;
    }
    case "FERTILIZE": {
      fertilizePatch(state, content, intent.patchId, intent.slot, events);
      break;
    }
    case "OPEN_CONTAINER": {
      openContainer(state, content, intent.slot, ctx, events);
      break;
    }
    case "FOUNDER_CLAIM": {
      claimFounder(state, events);
      break;
    }
    case "LAND_FISH": {
      // Resolve the pier tension minigame. The fish was rolled at the hook, so
      // only WHETHER it's kept is decided here.
      const f = player.hooked;
      player.hooked = null;
      if (!f) break;
      if (!intent.success) {
        events.push({ type: "LOG", message: `The line snaps — the ${f.species} is gone. The deep keeps its own.` });
        break;
      }
      grantXp(state, content, "fishing", f.xp, events);
      if (f.gold > 0) { player.gold += f.gold; player.stats.goldEarned += f.gold; }
      // Jacob cuts an Angler's Chit per ~2kg weighed in (min 1) — spend them at
      // his fish racks by the pier for fresh raw catch.
      const chits = Math.max(1, Math.round(f.weight / 2));
      if (canAddItem(player, "pier_chit")) {
        addItem(player, "pier_chit", chits, events);
        events.push({ type: "LOG", message: `Jacob cuts you ${chits} Angler's Chit${chits === 1 ? "" : "s"}.` });
      }
      // Whoever topped the board before this catch — if it wasn't the player and
      // now is, they've just become a NEW pier champion (worth announcing).
      const prevChamp = player.fishingRecords[0]?.angler;
      const rank = recordCatch(player, f);
      const newChampion = rank === 1 && prevChamp !== player.appearance.name;
      events.push({ type: "FISH_LANDED", species: f.species, weight: f.weight, length: f.length, rank, newChampion });
      events.push({
        type: "LOG",
        message: `Landed a ${f.species} — ${f.weight.toFixed(1)}kg, ${f.length}cm! The warden weighs it and pays ${f.gold}g.`,
      });
      if (rank > 0) {
        events.push({ type: "LOG", message: `A pier record! It takes #${rank} on the board.` });
      }
      // If this catch knocked the player off the top spot, the rod passes on.
      // (Claiming it when you DO top the board is done in person — talk to Jacob.)
      revokeGoldRodIfDethroned(player, content, events);
      break;
    }
    case "SWAP_SLOTS": {
      // Rearranging the pack is free-form housekeeping: swap any two slots
      // (either may be empty) without touching the current activity.
      const { a, b } = intent;
      const inv = player.inventory;
      if (a >= 0 && b >= 0 && a < inv.length && b < inv.length && a !== b) {
        const tmp = inv[a] ?? null;
        inv[a] = inv[b] ?? null;
        inv[b] = tmp;
      }
      break;
    }
    case "DROP": {
      dropSlot(state, content, intent.slot, ctx, events);
      break;
    }
    case "CLAIM_DIARY": {
      claimDiary(state, content, intent.diary, intent.skill, events);
      break;
    }
    case "CLAIM_BOSS_MILESTONE": {
      claimBossMilestone(state, content, intent.boss, intent.kills, intent.skill, events);
      break;
    }
    case "GE_MOVE": {
      // The local side of a Grand Exchange deposit/withdraw. The client validates
      // against live state before dispatching, so a shortfall is a silent no-op.
      const amt = Math.floor(intent.amount);
      if (!(amt > 0)) break;
      if (intent.kind === "gold") {
        if (intent.dir === "take") { if (player.gold >= amt) player.gold -= amt; }
        else player.gold += amt;
      } else if (intent.item) {
        if (intent.dir === "take") {
          // Selling can spend notes too, so take from noted stock as well.
          if (countAnyItem(player, intent.item) >= amt) removeAnyItem(player, intent.item, amt);
        } else if (intent.noted) {
          addNoted(player, intent.item, amt, events); // big collections come as a slip
        } else {
          addItem(player, intent.item, amt, events);
        }
      }
      break;
    }
    case "TRADE_APPLY": {
      // Settle a confirmed player trade: hand over what we offered, take in what
      // we were given. Keyed by tradeId so a re-poll (or a reload) can never
      // apply the same swap twice.
      if (player.tradesApplied.includes(intent.tradeId)) break;
      player.tradesApplied.push(intent.tradeId);
      if (player.tradesApplied.length > 200) player.tradesApplied.shift();
      // Give first, so freed slots make room for what we receive.
      const giveGold = Math.max(0, Math.floor(intent.give.gold));
      if (giveGold > 0) player.gold -= Math.min(player.gold, giveGold);
      for (const g of intent.give.items) {
        const q = Math.floor(g.qty);
        if (q > 0) removeItems(player, g.item, q);
      }
      const getGold = Math.max(0, Math.floor(intent.get.gold));
      if (getGold > 0) player.gold += getGold;
      for (const g of intent.get.items) {
        const q = Math.floor(g.qty);
        if (q > 0 && content.items[g.item]) addItem(player, g.item, q, events);
      }
      events.push({ type: "LOG", message: "Trade complete." });
      break;
    }
    case "SET_PIER_RECORDS": {
      // The client has merged the online board's catches into the local top-five.
      // Sanitise, keep the heaviest five, and re-run the Golden-Rod check so a
      // champion out-fished by a real rival elsewhere loses the trophy.
      const clean = (Array.isArray(intent.records) ? intent.records : [])
        .filter((r) => r && typeof r.species === "string" && typeof r.angler === "string"
          && Number.isFinite(r.weight) && Number.isFinite(r.length) && r.weight > 0)
        .map((r) => ({ species: r.species, angler: r.angler, weight: r.weight, length: Math.round(r.length) }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5);
      if (clean.length > 0) {
        player.fishingRecords = clean;
        revokeGoldRodIfDethroned(player, content, events);
      }
      break;
    }
    case "DUEL_STAKE": {
      // Lock a duel wager into escrow: validate ownership, then move the gold
      // and items OUT of the pack onto player.duelStake. One stake at a time.
      if (player.duelStake) {
        events.push({ type: "LOG", message: "You already have a wager locked in a duel." });
        break;
      }
      const gold = Math.max(0, Math.floor(intent.gold));
      if (gold > player.gold) {
        events.push({ type: "LOG", message: "You don't have that much gold to stake." });
        break;
      }
      const items: { item: ItemId; qty: number }[] = [];
      let short = false;
      for (const s of intent.items) {
        const qty = Math.max(0, Math.floor(s.qty));
        if (qty <= 0) continue;
        if (countItem(player, s.item) < qty) { short = true; break; }
        items.push({ item: s.item, qty });
      }
      if (short) {
        events.push({ type: "LOG", message: "You can't stake what you don't carry." });
        break;
      }
      player.gold -= gold;
      for (const s of items) removeItems(player, s.item, s.qty);
      player.duelStake = { duelId: intent.duelId, gold, items };
      events.push({ type: "LOG", message: "Your wager is locked in. Win, and both purses are yours." });
      break;
    }
    case "DUEL_RESOLVE": {
      // Idempotent by design: only the duel holding my escrow can settle it.
      const stake = player.duelStake;
      if (!stake || stake.duelId !== intent.duelId) break;
      delete player.duelStake;
      // The food eaten during the fight was real — deduct it (all outcomes
      // except a voided fight, which never "happened").
      if (intent.outcome !== "void") {
        for (const f of intent.foodEaten ?? []) {
          const q = Math.floor(f.qty);
          if (q > 0) removeItems(player, f.item, Math.min(q, countItem(player, f.item)));
        }
      }
      const restore = (): void => {
        player.gold += stake.gold;
        for (const s of stake.items) {
          if (canAddItem(player, s.item)) addItem(player, s.item, s.qty, events);
          else {
            player.bank[s.item] = (player.bank[s.item] ?? 0) + s.qty;
            events.push({ type: "LOG", message: `${content.items[s.item]?.name ?? s.item} was returned to your bank.` });
          }
        }
      };
      if (intent.outcome === "won") {
        restore();
        const w = intent.winnings;
        if (w) {
          player.gold += Math.max(0, Math.floor(w.gold));
          player.stats.goldEarned += Math.max(0, Math.floor(w.gold));
          for (const s of w.items) {
            const q = Math.floor(s.qty);
            if (q <= 0 || !content.items[s.item]) continue;
            if (canAddItem(player, s.item)) addItem(player, s.item, q, events);
            else {
              player.bank[s.item] = (player.bank[s.item] ?? 0) + q;
              events.push({ type: "LOG", message: `${content.items[s.item].name} was sent to your bank.` });
            }
          }
        }
        player.stats.duelWins = (player.stats.duelWins ?? 0) + 1;
        const nr = (player.stats.duelRating ?? DUEL_RATING_BASE) + DUEL_RATING_WIN;
        player.stats.duelRating = nr;
        player.stats.duelStreak = (player.stats.duelStreak ?? 0) + 1;
        if ((player.stats.duelBestStreak ?? 0) < player.stats.duelStreak) player.stats.duelBestStreak = player.stats.duelStreak;
        const streak = player.stats.duelStreak;
        events.push({ type: "LOG", message: `VICTORY — the ring is yours, and so are both wagers. (Rating ${nr}${streak >= 2 ? ` · ${streak}-win streak` : ""})` });
      } else if (intent.outcome === "lost") {
        player.stats.duelLosses = (player.stats.duelLosses ?? 0) + 1;
        player.stats.duelRating = Math.max(0, (player.stats.duelRating ?? DUEL_RATING_BASE) - DUEL_RATING_LOSS);
        player.stats.duelStreak = 0;
        events.push({ type: "LOG", message: `Defeated. Your wager crosses the ring. (Rating ${player.stats.duelRating})` });
      } else {
        restore();
        events.push({
          type: "LOG",
          message: intent.outcome === "draw" ? "A dead heat — both wagers walk home." : "The duel was called off. Your wager is returned.",
        });
      }
      break;
    }
    case "DEPOSIT": {
      if (!atStation(player, "bank", "the bank", events)) break;
      depositItem(player, intent.item, intent.qty);
      break;
    }
    case "WITHDRAW": {
      if (!atStation(player, "bank", "the bank", events)) break;
      withdrawItem(player, intent.item, intent.qty ?? 1, events, intent.noted ?? false);
      break;
    }
    case "EQUIP": {
      if (notedGuard(player, intent.slot, events)) break;
      equipSlot(player, content, intent.slot, events);
      break;
    }
    case "UNEQUIP": {
      unequipSlot(player, content, intent.equipSlot, events);
      break;
    }
    case "CRAFT": {
      startCraft(state, content, intent.actionId, intent.objId, ctx, events);
      break;
    }
    case "CHOOSE": {
      applyChoice(state, content, intent.quest, intent.option, events);
      break;
    }
    case "SPEND_XP_LAMP": {
      const lamps = player.xpLamps;
      if (!lamps || lamps.length === 0) break;
      if (!content.skills[intent.skill]) break; // unknown skill — ignore
      const amount = lamps.shift()!;
      grantXp(state, content, intent.skill, amount, events);
      events.push({ type: "LOG", message: `You pour ${amount.toLocaleString()} XP into ${content.skills[intent.skill].name}.` });
      break;
    }
    case "BUY": {
      if (player.station?.kind !== "shop" || player.station.id !== intent.shop) {
        events.push({ type: "LOG", message: "You need to be at that shop to buy." });
        break;
      }
      buyFromShop(state, player, content, intent.shop, intent.item, events, ctx);
      break;
    }
    case "TRAVEL": {
      travelTo(state, content, intent.to, events);
      break;
    }
    case "SELL": {
      if (!atStation(player, "shop", "a shop", events)) break;
      sellToMarket(player, content, intent.item, intent.qty, events);
      break;
    }
    case "PLANT": {
      plantSeed(state, content, intent.patchId, intent.crop, ctx, events);
      break;
    }
    case "BOUNTY_TASK": {
      if (!atStation(player, "bounty", "a bounty guide", events)) break;
      takeBountyTask(state, content, intent.guideId, ctx, events);
      break;
    }
    case "BOUNTY_CLAIM": {
      if (!atStation(player, "bounty", "a bounty guide", events)) break;
      claimBountyTask(state, content, ctx, events);
      break;
    }
    case "BOUNTY_ABANDON": {
      if (!atStation(player, "bounty", "a bounty guide", events)) break;
      abandonBountyTask(player, events);
      break;
    }
    case "BOUNTY_BUY": {
      if (!atStation(player, "bounty", "a bounty guide", events)) break;
      buyBountyItem(player, content, intent.item, events);
      break;
    }
    case "BOUNTY_SKIP": {
      if (!atStation(player, "bounty", "a bounty guide", events)) break;
      skipBountyTask(player, content, events);
      break;
    }
    case "BOUNTY_BLOCK": {
      if (!atStation(player, "bounty", "a bounty guide", events)) break;
      blockBountyTask(player, content, intent.monster, events);
      break;
    }
    case "BOUNTY_UNBLOCK": {
      if (!atStation(player, "bounty", "a bounty guide", events)) break;
      unblockBountyMonster(player, content, intent.monster, events);
      break;
    }
    case "BOUNTY_UNLOCK": {
      if (!atStation(player, "bounty", "a bounty guide", events)) break;
      buyBountyUnlock(player, content, intent.id, events);
      break;
    }
    case "SET_STYLE": {
      player.combatStyle = intent.style;
      events.push({
        type: "LOG",
        message: `Combat style: ${intent.style[0]!.toUpperCase()}${intent.style.slice(1)}.`,
      });
      break;
    }
    case "TOGGLE_RUN": {
      player.running = !player.running;
      break;
    }
    case "CAST_SPELL": {
      castSpell(state, content, intent.spell, ctx, events);
      break;
    }
    case "SET_AUTOCAST": {
      player.autocastSpell = intent.spell;
      const nm = intent.spell ? content.spells.find((s) => s.id === intent.spell)?.name : null;
      events.push({ type: "LOG", message: nm ? `Autocast set: ${nm}.` : "Autocast cleared." });
      break;
    }
    case "START_DELVE": {
      startDelve(state, content, ctx, events);
      break;
    }
    case "TOGGLE_BLESSING": {
      // Light or douse a protection blessing — a held prayer, no staff needed.
      const sp = content.spells.find((s) => s.id === intent.spell);
      if (!sp || sp.kind !== "blessing") break;
      if (player.blessing === sp.id) {
        player.blessing = null;
        events.push({ type: "LOG", message: `You let ${sp.name} go out.` });
        break;
      }
      if (skillLvl(player, "faith") < sp.faithReq) {
        events.push({ type: "LOG", message: `You need Devotion ${sp.faithReq} to hold ${sp.name}.` });
        break;
      }
      if (player.grace < 1) {
        events.push({ type: "LOG", message: "You have no Grace to burn. Pray at a shrine first." });
        break;
      }
      player.blessing = sp.id; // switching replaces — one blessing at a time
      events.push({ type: "LOG", message: `You hold ${sp.name} — it will burn Grace while it lasts.` });
      break;
    }
    case "BURY": {
      if (notedGuard(player, intent.slot, events)) break;
      buryBones(state, content, intent.slot, events);
      break;
    }
    case "GRIND": {
      if (notedGuard(player, intent.slot, events)) break;
      grindBones(state, content, intent.slot, events);
      break;
    }
    case "LIGHT_FIRE": {
      if (notedGuard(player, intent.slot, events)) break;
      lightFire(state, content, intent.slot, ctx, events);
      break;
    }
    case "CLAIM_PLOT": {
      const obj = state.objects[intent.plotId];
      const def = findObjectDef(content, intent.plotId);
      if (obj && def && def.kind === "housing_plot" && !obj.owned) {
        obj.owned = true;
        events.push({ type: "LOG", message: `You claim ${def.name}.` });
      }
      break;
    }
    case "BUILD_FURNITURE": {
      buildFurniture(state, content, intent.hotspotId, intent.furnitureId, events);
      break;
    }
    case "REMOVE_FURNITURE": {
      removeFurniture(state, content, intent.hotspotId, events);
      break;
    }
    case "USE_FURNITURE": {
      useFurniture(state, content, intent.hotspotId, ctx, events);
      break;
    }
    case "BUILD_ROOM": {
      buildRoom(state, content, intent.sealId, events);
      break;
    }
    case "CRAFT_FURNITURE": {
      craftFurniture(state, content, intent.furnitureId, events);
      break;
    }
    case "PLACE_FURNITURE": {
      placeFurniture(state, content, intent.furnitureId, intent.x, intent.y, intent.rot, events);
      break;
    }
    case "MOVE_FURNITURE": {
      moveFurniture(state, content, intent.index, intent.x, intent.y, intent.rot, events);
      break;
    }
    case "STORE_FURNITURE": {
      storeFurniture(state, content, intent.index, events);
      break;
    }
    case "UPGRADE_FURNITURE": {
      upgradeFurniture(state, content, intent.index, events);
      break;
    }
    case "SET_SURFACE": {
      setSurface(state, content, intent.surfaceId, events);
      break;
    }
    case "SPECIAL": {
      // Arm (or disarm) the special: the next swing spends the full bar on the
      // wielded weapon family's finisher. Below full charge it politely waits.
      if (player.specArmed) {
        player.specArmed = false;
        events.push({ type: "LOG", message: "You ease off — the special is stood down." });
      } else if (player.spec >= SPEC_MAX) {
        player.specArmed = true;
        events.push({ type: "LOG", message: "You set yourself — your NEXT blow spends the whole bar." });
      } else {
        events.push({ type: "LOG", message: `Not yet charged — landing blows builds the bar (${Math.floor(player.spec)}/${SPEC_MAX}).` });
      }
      break;
    }
    case "RECALL": {
      // The free escape teleport: no reagents, no requirements, 30-minute
      // wall-clock cooldown. Works from anywhere — its whole job is to save a
      // player who is stuck (a furnished-over doorway, a pinned corner).
      const epoch = ctx.epoch ?? 0;
      const ready = player.recallReadyEpoch ?? 0;
      if (epoch < ready) {
        const mins = Math.ceil((ready - epoch) / 60_000);
        events.push({ type: "LOG", message: `The recall is still gathering — ready in about ${mins} minute${mins === 1 ? "" : "s"}.` });
        break;
      }
      const fountain = content.objects.find((o) => o.id === "fountain_1");
      const dest = fountain ? { x: fountain.x, y: fountain.y + 2 } : { ...player.spawn };
      player.pos = { ...dest };
      player.path = [];
      player.pendingInteractId = null;
      clearActivity(player);
      player.recallReadyEpoch = epoch + 30 * 60_000;
      // A recall tithe, scaled by your combat weight — the strong pay to skip the
      // walk, so routine fast-travel meters coin out continuously (the audit's
      // recurring sink). WAIVED when you can't afford it: recall's real job is to
      // rescue a stuck player, and that must never depend on your purse.
      const tithe = Math.round(RECALL_TITHE_BASE + combatLevel(player) * RECALL_TITHE_PER_LVL);
      const paid = Math.min(tithe, Math.max(0, player.gold));
      player.gold -= paid;
      events.push({
        type: "LOG",
        message: paid >= tithe
          ? `The world folds, and Ironvale's fountain-square opens around you. (${paid}g waystone tithe)`
          : paid > 0
            ? `The world folds you home — you scrape together what you can for the tithe (${paid}g).`
            : "The world folds, and Ironvale's fountain-square opens around you.",
      });
      break;
    }
    case "WAYSTONE_RECALL": {
      // The paid traveller's recall: return to the LAST waystone you rode to,
      // from anywhere, so re-visiting a far region isn't a fresh cross-map
      // commute. Unlike the free Ironvale escape, you must actually afford the
      // tithe (a recurring coin sink, T4·04) and it runs its own cooldown.
      const epoch = ctx.epoch ?? 0;
      const ready = player.wayfareReadyEpoch ?? 0;
      if (epoch < ready) {
        const mins = Math.ceil((ready - epoch) / 60_000);
        events.push({ type: "LOG", message: `The Wayfare stone is still cooling — ready in about ${mins} minute${mins === 1 ? "" : "s"}.` });
        break;
      }
      const ws = player.lastWaystone ? findObjectDef(content, player.lastWaystone) : undefined;
      if (!ws || ws.kind !== "waystone" || !ws.target) {
        events.push({ type: "LOG", message: "You've not ridden the Courier's stones yet — reach a waystone and travel from it once, and the Wayfare will bring you back to it." });
        break;
      }
      const tithe = Math.round(WAYFARE_TITHE_BASE + combatLevel(player) * WAYFARE_TITHE_PER_LVL);
      if (player.gold < tithe) {
        events.push({ type: "LOG", message: `The Wayfare to ${ws.name} asks ${tithe}g in Courier's tithe — you can't cover it. (Recall to Ironvale is free if you're stuck.)` });
        break;
      }
      player.gold -= tithe;
      player.pos = { x: ws.target.x, y: ws.target.y };
      player.path = [];
      player.pendingInteractId = null;
      clearActivity(player);
      player.wayfareReadyEpoch = epoch + WAYFARE_COOLDOWN_MS;
      events.push({ type: "LOG", message: `The Wayfare folds the road, and ${ws.name}'s waystone rises around you. (${tithe}g Courier's tithe)` });
      break;
    }
    case "SOUND_HORN": {
      // A Hunter's Horn (Hunt-Marks ware): carries you straight to your active
      // task's hunting ground — the guides' answer to a long walk back. It's a
      // consumable, so travel convenience stays a marks sink, not a freebie.
      const slot = player.inventory[intent.slot];
      if (!slot || slot.item !== "hunters_horn") break;
      const task = player.bounty.task;
      const ground = task ? content.huntingGrounds[task.monster] : undefined;
      if (!task || !ground) {
        events.push({ type: "LOG", message: "The horn only answers a live contract — take a task from a guide first." });
        break;
      }
      // Warren contracts land at the Warrens' ENTRANCE, not inside a chamber:
      // the guild's grades are walked past in order, not skipped over.
      if (content.monsters[task.monster]?.bountyReq) {
        const wDoor = content.objects.find((o) => o.id === "portal_warrens");
        const wt = wDoor && "target" in wDoor ? (wDoor.target as Vec2 | undefined) : undefined;
        if (wt) {
          removeOneItem(player, "hunters_horn");
          player.pos = { ...wt };
          player.path = [];
          player.pendingInteractId = null;
          clearActivity(player);
          events.push({ type: "LOG", message: "The horn's note drops away below you — and the Warrens' entry hall rises around you." });
          break;
        }
      }
      // Land on the nearest ground-walkable tile to the ground's centre (the
      // centre itself may be a wall/water tile in a dungeon chamber).
      const { map } = content;
      const solid = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
        const t = map.tiles[y * map.width + x];
        return t === "water" || t === "mountain" || t === "cave_wall" || t === "deep" || t === "wall";
      };
      let dest: Vec2 | null = null;
      outer: for (let r = 0; r <= ground.r + 4 && !dest; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!solid(ground.x + dx, ground.y + dy)) { dest = { x: ground.x + dx, y: ground.y + dy }; break outer; }
        }
      }
      if (!dest) {
        events.push({ type: "LOG", message: "The horn falters — the ground it knows is sealed." });
        break;
      }
      removeOneItem(player, "hunters_horn");
      player.pos = { ...dest };
      player.path = [];
      player.pendingInteractId = null;
      clearActivity(player);
      events.push({ type: "LOG", message: `The horn's note hangs in the air — and ${ground.name} rises around you.` });
      break;
    }
  }
  return events;
}

/** The wearable equipment slots (canon `equip` values we support). */
const EQUIP_SLOTS = new Set<string>([
  "mainhand",
  "offhand",
  "helmet",
  "armor",
  "legs",
  "boots",
  "ring",
  "necklace",
  "cape",
  "companion",
  "ranged",
  "ammo",
  "mount",
]);

/** Chance, per successful skill action, of a matching skilling-pet companion.
 *  Skilling pets roll on EVERY action, and maxing a skill is ~100k+ actions, so
 *  this is deliberately OSRS-rare — far rarer than a boss pet (1/500 per kill).
 *  At 1/500,000 per action a full grind to 100 (~120k actions) is only a ~21%
 *  shot, so each skilling pet stays a genuine prestige flex. */
const PET_DROP_CHANCE = 0.000002;

/** The companion currently summoned, or undefined. */
function activeCompanion(player: Player, content: Content): ItemDef | undefined {
  const id = player.equipment.companion;
  return id ? content.items[id] : undefined;
}

/** Does the player already have this companion anywhere (pack/bank/summoned)? */
function ownsItem(player: Player, item: ItemId): boolean {
  if (player.equipment.companion === item) return true;
  if ((player.bank[item] ?? 0) > 0) return true;
  return player.inventory.some((s) => s?.item === item);
}

/**
 * A successful action in a gathering/processing skill can turn up that skill's
 * companion (a rare pet), once. Skilling pets carry meta.petSkill === skill.
 */
function tryPetDrop(
  state: WorldState,
  content: Content,
  skill: SkillId,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  if (ctx.rng() >= PET_DROP_CHANCE) return;
  const player = state.player;
  for (const id of Object.keys(content.items) as ItemId[]) {
    const def = content.items[id];
    if (def.slot !== "companion" || def.meta?.["petSkill"] !== skill) continue;
    if (ownsItem(player, id) || !canAddItem(player, id)) return;
    addItem(player, id, 1, events);
    events.push({ type: "COMPANION_FOUND", item: id });
    events.push({ type: "LOG", message: `A companion has found you: ${def.name}!` });
    return;
  }
}

/** Skill level needed to equip each gear tier (index = tier 1–10). The craftable
 *  ladder is deliberately compressed — Ashiron 10, Ribstone 20, Bloodore 30,
 *  Voidstone 40, Hearthite 50 — so bone (60) and wyrm (75) uniques sit clearly
 *  above everything smithable, and there's headroom for future 50–75 gear. */
const GEAR_TIER_REQS = [0, 1, 5, 10, 20, 25, 30, 35, 40, 40, 50];

/** Which combat skill gates each wearable slot: weapons train/need Edge, armour
 *  needs Ward, bows and arrows need Draw. Other slots (jewellery, capes, mount,
 *  companion) carry no level gate. */
const GEAR_SLOT_SKILL: Partial<Record<string, SkillId>> = {
  mainhand: "edge",
  ranged: "draw",
  ammo: "draw",
  helmet: "ward",
  armor: "ward",
  legs: "ward",
  boots: "ward",
  offhand: "ward",
};

/** Which gathering skill each tool kind serves. */
const TOOL_SLOT_SKILL: Record<"hatchet" | "pickaxe" | "rod", SkillId> = {
  hatchet: "forestry",
  pickaxe: "mining",
  rod: "fishing",
};

/** The tool kind each gather activity needs wielded. */
const GATHER_TOOL: Partial<Record<string, "hatchet" | "pickaxe" | "rod">> = {
  woodcutting: "hatchet",
  mining: "pickaxe",
  fishing: "rod",
};

/** Gathering-skill level needed to wield each tool tier (index = tier 1–10).
 *  Mirrors the compressed gear ladder so a material means the same level across
 *  weapons, armour, and tools: Ashiron 10, Ribstone 20, Bloodore 30,
 *  Voidstone 40, Hearthite 50. */
const TOOL_TIER_REQS = [0, 1, 5, 10, 20, 25, 30, 35, 40, 40, 50];

/** Tool tier → gather-interval multiplier: better tools gather faster. A steeper
 *  ramp so upgrading your pickaxe/hatchet/rod is a real late-game speed reward
 *  (top tier ≈ 2.2× the base rate), giving gathering room to scale with progress. */
const TOOL_TIER_SPEED = [1, 1, 0.93, 0.86, 0.78, 0.72, 0.66, 0.6, 0.55, 0.5, 0.45];

/** Material tier from a gear id's `_<n>` suffix (armor_3 → 3), or undefined. */
function tierFromId(id: string): number | undefined {
  const m = /_(\d+)$/.exec(id);
  return m ? Number(m[1]) : undefined;
}

/**
 * The skill + level a piece of gear or a tool needs before it can be worn.
 * Tools gate on their gathering skill; weapons gate on Edge, armour on Ward,
 * bows/arrows on Draw. Exported so the UI shows the same requirement the equip
 * check enforces.
 */
export function equipRequirement(
  content: Content,
  itemId: ItemId,
): { skill: SkillId; level: number } | null {
  const def = content.items[itemId];
  if (!def) return null;
  // Skill capes are gated at level 100 (mastery) in their skill (read from meta.skill). The
  // max/prestige capes ("max"/"ironvale") are earned outright — no wield gate.
  const capeSkill = def.cat === "Capes" ? def.meta?.skill : undefined;
  if (capeSkill && capeSkill !== "max" && capeSkill !== "ironvale") {
    return { skill: capeSkill as SkillId, level: 100 };
  }
  // Tier comes from an explicit `tier`, else the material `_<n>` id suffix — many
  // ladder items (armor_3, sword_4 …) carry only the suffix, so relying on `tier`
  // alone silently dropped their level gate (Ashiron Mail wieldable at any Ward).
  const tier = def.tier ?? tierFromId(def.id);
  if (def.tool) {
    if (tier === undefined) return null;
    const level = TOOL_TIER_REQS[tier] ?? 1;
    return level > 1 ? { skill: TOOL_SLOT_SKILL[def.tool], level } : null;
  }
  // A bow sits in the mainhand but is a ranged weapon — it gates on Draw, not
  // Edge. A staff likewise gates on Faith. Ranged/magic ARMOUR sets carry an
  // explicit equipSkill (Draw / Faith) so they don't gate on Ward like plate.
  const gearSkill = def.equipSkill ?? (def.magic ? "faith" : def.ranged ? "draw" : (def.slot ? GEAR_SLOT_SKILL[def.slot] : undefined));
  if (!gearSkill) return null; // jewellery, capes, mounts: no level gate
  // An explicit equipLevel (uniques like the dragon set) overrides the tier
  // table; otherwise the level comes from the material tier.
  const level = def.equipLevel ?? (tier !== undefined ? (GEAR_TIER_REQS[tier] ?? 0) : 0);
  return level > 1 ? { skill: gearSkill, level } : null;
}

/** Guard a counter intent: true only while the player stands at that station. */
function atStation(
  player: Player,
  kind: "shop" | "bank" | "bounty",
  what: string,
  events: WorldEvent[],
): boolean {
  if (player.station?.kind === kind) return true;
  events.push({ type: "LOG", message: `You need to be at ${what} to do that.` });
  return false;
}

/** True once every skill has reached the mastery cap (100) — for the max cape. */
function allSkillsMaxed(player: Player): boolean {
  return (Object.keys(player.skills) as SkillId[]).every((id) => skillLvl(player, id) >= 100);
}

/** The player's combat level, from all six combat skills (OSRS-shaped).
 *
 *   combat = floor( base + max(melee, ranged, magic) )
 *     base   = (ward + vitality) / 4        — defence + life, always counted
 *     melee  = (edge + vigour) / 4          — the two melee skills, averaged
 *     ranged = draw / 2                     — one skill; accuracy AND damage
 *     magic  = faith / 2                    — Devotion, likewise one skill
 *
 * The three offensive styles are symmetric: because Ranged (draw) and Devotion
 * (faith) each cover their own accuracy and damage in a single skill, they're
 * weighted /2, matching two melee skills at /4 — so a pure archer, a pure
 * caster and a pure warrior of equal investment reach the same combat level.
 * You're credited for your STRONGEST style, as OSRS does. (Bounty and Agility
 * are non-combat, like Slayer/Agility in OSRS, so they don't count.)
 * Exported for the client (quest journal's recommended-level chips). */
export function combatLevel(player: Player): number {
  const e = skillLvl(player, "edge");
  const v = skillLvl(player, "vigour");
  const w = skillLvl(player, "ward");
  const d = skillLvl(player, "draw");
  const f = skillLvl(player, "faith");
  const vit = skillLvl(player, "vitality");
  return Math.floor((w + vit) / 4 + Math.max((e + v) / 4, d / 2, f / 2));
}

/** Wear the gear in an inventory slot, swapping out anything already worn. */
function equipSlot(
  player: Player,
  content: Content,
  slot: number,
  events: WorldEvent[],
): void {
  const data = player.inventory[slot];
  if (!data) return;
  const def = content.items[data.item];
  const eslot = def.slot;
  if (!eslot || !EQUIP_SLOTS.has(eslot)) {
    events.push({ type: "LOG", message: `You can't wear the ${def.name}.` });
    return;
  }
  // Arrows are worn as a whole stack into the quiver, not one at a time.
  if (eslot === "ammo") {
    equipAmmo(player, content, slot, events);
    return;
  }
  // Honour the level requirement: tools gate on their gathering skill, weapons
  // on Edge, armour on Ward, bows on Draw (e.g. a Ribstone Pickaxe needs Mining
  // 30; a tier-5 sword needs Edge 40).
  const req = equipRequirement(content, data.item);
  if (req) {
    if (skillLvl(player, req.skill) < req.level) {
      events.push({
        type: "LOG",
        message: `You need ${content.skills[req.skill].name} level ${req.level} to wield the ${def.name}.`,
      });
      return;
    }
  }

  const target = eslot as EquipSlot;
  const newItem = data.item;
  const previously = player.equipment[target];

  // Everything that this equip will displace back into the pack: the piece in
  // the target slot, plus any hand-conflict that has to be stowed.
  const offId = player.equipment.offhand;
  const mainId = player.equipment.mainhand;
  const stowOff = target === "mainhand" && !!def.twoHand && !!offId;
  const stowMain =
    target === "offhand" && !!mainId && !!content.items[mainId].twoHand;
  const displaced: ItemId[] = [];
  if (previously) displaced.push(previously);
  if (stowOff) displaced.push(offId!);
  if (stowMain) displaced.push(mainId!);

  // Make sure every displaced item has a home BEFORE touching anything — taking
  // the new item out frees its slot only if it wasn't a stack. If something
  // wouldn't fit, abort the whole swap so a worn item can never be destroyed.
  const sim = player.inventory.map((s) => (s ? { item: s.item, qty: s.qty } : null));
  const src = sim[slot]!;
  src.qty -= 1;
  if (src.qty <= 0) sim[slot] = null;
  for (const it of displaced) {
    const stack = sim.find((s) => s?.item === it);
    if (stack) { stack.qty += 1; continue; }
    const empty = sim.findIndex((s) => s === null);
    if (empty === -1) {
      events.push({ type: "INVENTORY_FULL" });
      events.push({ type: "LOG", message: "You've no room to stow your old gear." });
      return;
    }
    sim[empty] = { item: it, qty: 1 };
  }

  // Feasible — now perform it for real (every addItem below is guaranteed room).
  data.qty -= 1;
  if (data.qty <= 0) player.inventory[slot] = null;
  player.equipment[target] = newItem;
  if (previously) addItem(player, previously, 1, events);
  if (stowOff) {
    delete player.equipment.offhand;
    addItem(player, offId!, 1, events);
  }
  if (stowMain) {
    delete player.equipment.mainhand;
    addItem(player, mainId!, 1, events);
  }
  events.push({ type: "LOG", message: `You equip the ${def.name}.` });
}

/** Nock a whole stack of arrows into the quiver, returning any other type held. */
function equipAmmo(
  player: Player,
  content: Content,
  slot: number,
  events: WorldEvent[],
): void {
  const data = player.inventory[slot];
  if (!data) return;
  const def = content.items[data.item];
  const current = player.equipment.ammo;
  const addQty = data.qty;
  // Take the whole stack out — freeing this slot guarantees room for any arrows
  // of a different type we hand back.
  player.inventory[slot] = null;
  if (current === data.item) {
    player.quiver += addQty;
  } else {
    if (current) addItem(player, current, player.quiver, events);
    player.equipment.ammo = data.item;
    player.quiver = addQty;
  }
  events.push({ type: "LOG", message: `You ready ${player.quiver}× ${def.name}.` });
}

/** Take a worn item off and return it to the pack (if there's room). */
function unequipSlot(
  player: Player,
  content: Content,
  eslot: EquipSlot,
  events: WorldEvent[],
): void {
  const worn = player.equipment[eslot];
  if (!worn) return;
  if (!canAddItem(player, worn)) {
    events.push({ type: "INVENTORY_FULL" });
    return;
  }
  // Arrows return as the whole nocked stack and reset the quiver.
  if (eslot === "ammo") {
    const qty = Math.max(1, player.quiver);
    delete player.equipment.ammo;
    player.quiver = 0;
    addItem(player, worn, qty, events);
    events.push({ type: "LOG", message: `You unstring ${qty}× ${content.items[worn].name}.` });
    return;
  }
  delete player.equipment[eslot];
  addItem(player, worn, 1, events);
  events.push({
    type: "LOG",
    message: `You unequip the ${content.items[worn].name}.`,
  });
}

/**
 * Begin repeating a station recipe (cooking/smelting/smithing). The
 * actual making happens each tick in processActivity; this just validates the
 * choice and starts the activity so the client shows progress on the station.
 */
function startCraft(
  state: WorldState,
  content: Content,
  actionId: string,
  objId: string,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const action = content.actions.find((a) => a.id === actionId);
  if (!action || !action.produces) return;
  if (skillLvl(player, action.skill) < action.levelReq) {
    events.push({
      type: "LOG",
      message: `You need ${content.skills[action.skill].name} level ${action.levelReq}.`,
    });
    return;
  }
  if (!hasIngredients(player, action)) {
    events.push({ type: "LOG", message: "You don't have the materials." });
    return;
  }
  player.activity = {
    kind: "crafting",
    targetId: objId,
    actionId,
    nextActionAt: ctx.now + craftInterval(action),
    actionInterval: craftInterval(action),
  };
}

/** Eat the food in a slot, restoring HP (no-op if it's not food or full). */
function eatSlot(
  player: Player,
  content: Content,
  slot: number,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const data = player.inventory[slot];
  if (!data) return;
  const def = content.items[data.item];
  const canHeal = !!def.heals;
  const canBuff = !!(def.buff && def.buffMs);
  const canGrace = !!def.graceRestore;
  const canEnergy = !!def.energyRestore;
  if (!canHeal && !canBuff && !canGrace && !canEnergy) {
    events.push({ type: "LOG", message: `You can't use the ${def.name}.` });
    return;
  }
  // Don't waste a pure energy restore (Runner's Blend) on full legs.
  if (canEnergy && !canHeal && !canBuff && !canGrace && player.energy >= ENERGY_MAX) {
    events.push({ type: "LOG", message: "Your legs are already fresh." });
    return;
  }
  // Don't waste a pure-heal at full HP; a buffed/Grace item is still worth using.
  if (canHeal && !canBuff && !canGrace && player.hp >= player.maxHp) {
    events.push({ type: "LOG", message: "You are already at full health." });
    return;
  }
  // Don't waste a pure Grace potion at a full Grace pool.
  if (canGrace && !canHeal && !canBuff && player.grace >= graceMax(player)) {
    events.push({ type: "LOG", message: "Your Grace is already full." });
    return;
  }

  let msg = (canHeal && def.buff) || canGrace ? `You drink the ${def.name}.` : `You ${def.cat === "Food" || canHeal ? "eat" : "drink"} the ${def.name}.`;
  if (canHeal) {
    // The Drowned Seal (Sunken Court unique): everything you eat heals half
    // again as much under the Magistrate's old authority.
    const sealed = player.equipment.necklace === "drowned_seal";
    const amount = sealed ? Math.round(def.heals! * 1.5) : def.heals!;
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + amount);
    const healed = player.hp - before;
    if (healed > 0) events.push({ type: "HEALED", amount: healed });
    msg += ` (+${amount}${sealed ? ", the Seal's share included" : ""})`;
  }
  if (canBuff) {
    player.buffs[def.buff!] = { amount: def.buffAmt ?? 0, until: ctx.now + def.buffMs! };
    msg += ` ${BUFF_LABEL[def.buff!] ?? def.buff} for ${Math.round(def.buffMs! / 60000)} min.`;
  }
  if (canGrace) {
    const before = player.grace;
    player.grace = Math.min(graceMax(player), player.grace + def.graceRestore!);
    const gained = Math.round(player.grace - before);
    if (gained > 0) msg += ` (+${gained} Grace)`;
  }
  if (canEnergy) {
    player.energy = Math.min(ENERGY_MAX, player.energy + def.energyRestore!);
    player.winded = false;
    msg += " Your legs feel fresh again.";
  }
  // Multi-dose potions (OSRS): a drink leaves the next dose in the slot
  // instead of consuming the vial outright.
  if (def.doseNext) {
    player.inventory[slot] = { item: def.doseNext, qty: 1 };
  } else {
    data.qty -= 1;
    if (data.qty <= 0) player.inventory[slot] = null;
  }
  // Eating costs a beat in a fight: push the next swing back so healing is a
  // real trade against damage, not a free tank-and-spam (OSRS's eat-delay).
  if (player.activity.kind === "combat") {
    player.activity.nextActionAt = Math.max(player.activity.nextActionAt, ctx.now + EAT_DELAY_MS);
  }
  events.push({ type: "LOG", message: msg });
}

/** Player-facing names for each buff kind (used in the log + HUD). */
const BUFF_LABEL: Record<string, string> = {
  melee_acc: "+Accuracy",
  ranged_acc: "+Accuracy",
  melee_dmg: "+Damage",
  ranged_dmg: "+Damage",
  defence: "+Defence",
  mitigate: "Braced (−damage taken)",
  gather_speed: "+Gathering speed",
  xp_boost: "+XP",
};

/** The amount of an active buff kind, or 0 if none is active. */
function buffVal(player: Player, kind: string): number {
  return player.buffs[kind]?.amount ?? 0;
}

/** Move every one of an item from the pack into the bank. */
/** Deposit up to `want` of an item (undefined = the whole pack's worth). */
function depositItem(player: Player, item: ItemId, want?: number): void {
  let left = want === undefined ? Infinity : Math.max(0, Math.floor(want));
  let moved = 0;
  for (let i = 0; i < player.inventory.length && left > 0; i++) {
    const slot = player.inventory[i];
    if (slot && slot.item === item) {
      const take = Math.min(slot.qty, left);
      slot.qty -= take;
      moved += take;
      left -= take;
      if (slot.qty <= 0) player.inventory[i] = null;
    }
  }
  if (moved > 0) player.bank[item] = (player.bank[item] ?? 0) + moved;
}

/** Withdraw up to `want` of an item from the bank into the pack (room permitting).
 *  As a note, the whole amount lands in one stackable slot (a bank slip). */
function withdrawItem(player: Player, item: ItemId, want: number, events: WorldEvent[], noted = false): void {
  const avail = Math.min(player.bank[item] ?? 0, Math.max(1, Math.floor(want)));
  let pulled = 0;
  if (noted) {
    if (avail > 0 && addNoted(player, item, avail, events)) pulled = avail;
  } else {
    let left = avail;
    while (left > 0) {
      if (!addItem(player, item, 1, events)) break; // pack full; stop
      pulled++;
      left--;
    }
  }
  if (pulled > 0) {
    const have = (player.bank[item] ?? 0) - pulled;
    if (have <= 0) delete player.bank[item];
    else player.bank[item] = have;
  }
}

function startInteraction(
  state: WorldState,
  content: Content,
  objId: string,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const def = findObjectDef(content, objId);
  if (!def) return;
  const obj = state.objects[objId];
  if (!obj) return;
  const { player } = state;
  if (objectHidden(def, player)) return; // story-gated: not here yet
  const mode = player.pendingInteractMode;
  player.pendingInteractId = null;
  player.pendingInteractMode = null;
  // Any fresh interaction abandons a fish still on the line at the pier (the
  // minigame normally resolves it; this guards walking off mid-fight).
  if (player.hooked && def.kind !== "pier_spot") player.hooked = null;

  // Trail clues: if a carried scroll's riddle points at THIS landmark, the
  // interaction solves the trail — the scroll becomes a casket on the spot.
  if (tryClueSolve(state, content, def, events)) return;

  switch (def.kind) {
    case "tree": {
      if (!obj.available) {
        events.push({ type: "LOG", message: "The tree has been felled." });
        return;
      }
      if (!beginGather(state, content, def, objId, "woodcutting", WOODCUTTING.interval, ctx, events)) {
        return;
      }
      events.push({ type: "LOG", message: "You swing your axe at the tree." });
      break;
    }

    case "rock": {
      if (!obj.available) {
        events.push({ type: "LOG", message: "The rock is depleted." });
        return;
      }
      if (!beginGather(state, content, def, objId, "mining", MINING.interval, ctx, events)) {
        return;
      }
      events.push({ type: "LOG", message: "You swing your pick at the rock." });
      break;
    }

    case "fishing_spot": {
      if (!beginGather(state, content, def, objId, "fishing", FISHING.interval, ctx, events)) {
        return;
      }
      events.push({ type: "LOG", message: "You cast your line into the water." });
      break;
    }

    case "trap": {
      if (!obj.available) {
        events.push({ type: "LOG", message: "The trap has sprung — give it time to reset." });
        return;
      }
      if (!beginGather(state, content, def, objId, "trapping", HUNTER.interval, ctx, events)) {
        return;
      }
      events.push({ type: "LOG", message: "You set the snare and wait for game." });
      break;
    }

    case "forage_spot": {
      if (!obj.available) {
        events.push({ type: "LOG", message: "You've picked this clean — give it time to grow back." });
        return;
      }
      if (!beginGather(state, content, def, objId, "foraging", FORAGE.interval, ctx, events)) {
        return;
      }
      events.push({ type: "LOG", message: `You search the ${def.name} for anything useful.` });
      break;
    }

    case "bounty_board": {
      player.station = { kind: "bounty" };
      events.push({ type: "OPEN_BOUNTY", objId });
      break;
    }

    case "pier_spot": {
      // Cast into the deep: auto-wield a rod (better tier → bigger fish), roll
      // the catch, and hand the fight to the client's tension minigame.
      const tier = wieldGatherTool(player, content, "rod", events);
      if (tier === null) {
        events.push({ type: "LOG", message: "You need a fishing rod to cast into the deep." });
        return;
      }
      player.hooked = rollPierFish(player, content, tier, ctx);
      const f = player.hooked;
      events.push({ type: "LOG", message: "You cast far into the deep water… something heavy takes the hook!" });
      events.push({ type: "HOOKED_FISH", species: f.species, weight: f.weight, length: f.length, strength: f.strength });
      break;
    }

    case "record_board": {
      player.station = { kind: "records" };
      events.push({ type: "OPEN_RECORDS", objId });
      break;
    }

    case "trail_board": {
      // The standings board is multiplayer status: the client fetches the
      // shared hiscores and shows every runner ranked by total laps.
      events.push({ type: "OPEN_TRAIL_BOARD" });
      break;
    }

    case "pier_gate": {
      events.push({ type: "LOG", message: "A rope bars the planks. Jacob the Pier-Warden hasn't given you leave — speak with him first." });
      break;
    }

    case "npc": {
      // A bounty guide IS the bounty system: their panel is the only place to
      // take, claim and spend. "talk" still gives their dialogue, and a quest
      // that needs them takes priority over the contract panel.
      if (def.bountyGuide && mode !== "talk" && !questStepTargets(player, content, def.id)) {
        // A guide above your level turns you away at the door, OSRS-style —
        // no browsing a ledger you haven't earned.
        const guide = content.bountyGuides.find((g) => g.id === def.bountyGuide);
        if (guide && skillLvl(player, "bounty") < guide.levelReq) {
          events.push({ type: "LOG", message: `${guide.name} looks you over once and goes back to their ledger. "Come back at Bounty ${guide.levelReq}. The work I post would eat you alive."` });
          break;
        }
        // Opening a guide's ledger highlights them — but never while a task is
        // live, or the contract would appear to belong to the wrong guide.
        if (!player.bounty.task) player.bounty.guideId = def.bountyGuide;
        player.station = { kind: "bounty" };
        events.push({ type: "OPEN_BOUNTY", objId });
        break;
      }
      // A shopkeeper can be talked to OR traded with. "shop" forces the trade
      // window; "talk" forces dialogue (and any quest); with no explicit mode,
      // the shop opens unless a quest step needs them right now.
      const shop = content.shops.find((s) => s.npc === def.id);
      const wantsShop = mode === "shop" || (mode !== "talk" && !questStepTargets(state.player, content, def.id));
      if (shop && wantsShop) {
        player.station = { kind: "shop", id: shop.id };
        events.push({ type: "OPEN_SHOP", shop: shop.id });
        break;
      }
      const lines = handleNpcTalk(state, content, def, events);
      // A guide's small talk acknowledges the ledger: the live contract (their
      // own or another guide's), or a filled one waiting to be claimed. Never
      // over quest dialogue — story beats keep the floor.
      if (def.bountyGuide && lines.length > 0 && !questStepTargets(player, content, def.id)) {
        const g = content.bountyGuides.find((x) => x.id === def.bountyGuide);
        const t = player.bounty.task;
        if (g && t) {
          const mname = content.monsters[t.monster]?.name ?? t.monster;
          const done = t.progress >= t.required;
          const issuer = content.bountyGuides.find((x) => x.id === t.guideId);
          lines.unshift(
            done
              ? `"That ${mname} contract is filled. Open my ledger and claim what you're owed."`
              : t.guideId === g.id
                ? `"My ledger says ${t.progress} of ${t.required} ${mname}. The rest won't die of old age."`
                : `"You carry ${issuer?.name ?? "another guide"}'s contract — ${t.progress} of ${t.required} ${mname}. I honour it the same."`,
          );
        }
      }
      if (lines.length > 0) {
        events.push({ type: "DIALOGUE", npc: def.name, lines });
      }
      break;
    }

    case "shrine": {
      // A one-off exploration find: search the site once for a reward (T6·03).
      if (def.find) { searchLandmark(state, content, def, events); break; }
      // A witness-the-heat devotion event at the Cult's warm seam: offer
      // embercite for Devotion XP + Grace, tying Ashfen's lore to a deed (T6·02).
      if (def.witnessOffering) { witnessSeam(state, content, def, obj, ctx, events); break; }
      // A shrine/altar of Orun: kneel and pray to refill Grace (the Faith fuel).
      // Each stone gives its blessing once a minute — camping one stone as an
      // infinite spell battery doesn't work; running to ANOTHER stone does.
      const gm = graceMax(player);
      if (player.grace >= gm) {
        events.push({ type: "LOG", message: `You kneel at the ${def.name}. Your Grace is already full.` });
      } else if (ctx.now < (obj.graceCooldownUntil ?? 0)) {
        const wait = Math.ceil(((obj.graceCooldownUntil ?? 0) - ctx.now) / 1000);
        events.push({ type: "LOG", message: `The ${def.name} is spent from your last prayer — its grace returns in ${wait}s. Another stone would serve you now.` });
      } else {
        player.grace = gm;
        obj.graceCooldownUntil = ctx.now + SHRINE_RECHARGE_MS;
        events.push({ type: "LOG", message: `You kneel at the ${def.name} and pray. Orun's grace fills you.` });
      }
      break;
    }
    case "cart":
    case "fountain":
    case "critter":
    case "lamppost":
    case "signpost":
    case "banner":
    case "bone_cairn":
    case "ruin_prop":
    case "remains":
      // Examine-only landmark / city dressing / wildlife / signage / heraldry.
      events.push({
        type: "LOG",
        message: def.lines?.[0] ?? `You study the ${def.name}.`,
      });
      break;

    case "waystone":
      events.push({ type: "OPEN_TRAVEL", objId });
      break;

    case "relic":
      readRelic(state, content, def, events);
      break;

    case "agility_obstacle":
      traverseObstacle(state, def, ctx, events);
      break;

    case "monster": {
      if (!obj.available) {
        events.push({ type: "LOG", message: "There is nothing here to fight." });
        return;
      }
      // Warren-bred creatures demand huntcraft, OSRS-Slayer style: without the
      // Bounty level you can't even read their movements well enough to fight.
      const gate = monsterFor(content, def)?.bountyReq;
      if (gate && skillLvl(player, "bounty") < gate) {
        events.push({ type: "LOG", message: `You can't read this creature's movements — it takes Bounty ${gate} to hunt a ${def.name}.` });
        return;
      }
      // Tool gates, OSRS-style (broad arrows, leaf-bladed spears): some quarry
      // can't be harmed without the right ware from a guide's shop — either the
      // consumable (spent on each kill) or its permanent mastery unlock.
      const hg = HUNT_GATES[def.monster ?? ""];
      if (hg && !player.bounty.unlocks.includes(hg.unlock) && !hasItem(player, hg.item)) {
        events.push({ type: "LOG", message: `Your blows just skate off the ${def.name}. The guides sell ${hg.toolName}s for this work — or buy the mastery once and never carry them again.` });
        return;
      }
      // Each side keeps its own swing clock: the player swings on weapon speed,
      // the monster on its own. Both start one interval out.
      const pSpeed = playerSpeed(player, content);
      const mSpeed = monsterFor(content, def)?.speed ?? COMBAT.monsterSpeed;
      player.activity = {
        kind: "combat",
        targetId: objId,
        actionId: null,
        nextActionAt: ctx.now + pSpeed,
        actionInterval: pSpeed,
      };
      obj.nextAttackAt = ctx.now + mSpeed;
      events.push({ type: "LOG", message: `You engage the ${def.name}.` });
      break;
    }

    case "bank":
      player.station = { kind: "bank" };
      events.push({ type: "OPEN_BANK" });
      break;

    case "grand_exchange":
      player.station = { kind: "exchange" };
      events.push({ type: "OPEN_EXCHANGE" });
      break;

    // The processing stations open a recipe menu; the client lists what the
    // player can make (from content.actions) and sends back a CRAFT intent.
    case "fire":
    case "furnace":
    case "anvil":
    case "cauldron":
    case "workbench":
    case "crafting_table":
    case "sawmill":
      events.push({ type: "OPEN_CRAFT", station: def.kind, objId });
      break;

    case "plant_patch":
    case "tree_patch":
      interactPatch(state, content, def, obj, ctx, events);
      break;

    case "housing_plot":
      interactPlot(state, content, def, obj, events);
      break;

    case "build_hotspot":
      interactHotspot(state, def, obj, events);
      break;

    case "house_door": {
      // The outdoor door is gated on owning the plot; the interior door (no
      // plot) always lets you back out. Either way it just teleports you.
      if (def.plot && !state.objects[def.plot]?.owned) {
        events.push({ type: "LOG", message: "You'd need to claim this homestead before you could go in." });
        break;
      }
      // The Garden Door needs a house tier (the backyard unlocks at Manor).
      if (def.tier && state.player.home.tier < def.tier) {
        events.push({ type: "LOG", message: `Raise your home to a ${homeStructureName(def.tier)} to open the garden.` });
        break;
      }
      usePortal(state, content, def, events);
      break;
    }

    case "room_seal": {
      const sealTier = def.tier ?? 1;
      const tier = state.player.home.tier;
      if (sealTier <= tier) { // already unsealed — the doorway stands open
        events.push({ type: "LOG", message: "This doorway already stands open." });
        break;
      }
      if (sealTier > tier + 1) { // a further room — build the ones before it first
        const prev = HOUSE_TIERS[tier + 1];
        events.push({ type: "LOG", message: `Raise your ${prev?.name ?? "next room"} first — you can only extend the house one room at a time.` });
        break;
      }
      const up = HOUSE_TIERS[sealTier]; // the tier this seal unlocks
      if (!up) break;
      events.push({
        type: "OPEN_EXTENSION", sealId: def.id,
        name: up.name, room: up.room, levelReq: up.levelReq, gold: up.gold, materials: up.materials,
      });
      break;
    }

    case "portal":
      usePortal(state, content, def, events);
      break;

    // --- Dungeon furniture (the Act II exploration sites) --------------------
    case "puzzle_lever":
      throwPuzzleLever(state, content, def, events);
      break;

    case "dungeon_gate":
      // A gate object only exists while sealed (hiddenByFlag removes it — and
      // its blocking — the moment its flag is set). A keyed gate opens here,
      // with its key; a puzzle gate only reports itself.
      if (def.keyItem) {
        if (countItem(state.player, def.keyItem) > 0) {
          removeOneItem(state.player, def.keyItem);
          state.player.flags.push(`key_${def.id}`); // its hiddenByFlag — walkability rebuilds
          events.push({ type: "LOG", message: `The ${content.items[def.keyItem]?.name ?? "key"} turns hard, twice — and the way stands open.` });
        } else {
          events.push({ type: "LOG", message: def.lines?.[0] ?? "Locked fast. Somewhere in these halls is the key — or the hand that carries it." });
        }
        break;
      }
      events.push({ type: "LOG", message: def.lines?.[0] ?? "Sealed fast. Something in these halls must open it." });
      break;

    case "dungeon_chest":
      openDungeonChest(state, content, def, events);
      break;
  }
}

/**
 * One lever of an ordered dungeon puzzle. Throw the group's levers in `order`
 * (the plaques nearby recite it) and the flag `pz_<group>` is set — opening any
 * gate hidden by that flag. A wrong lever springs the whole group back.
 * Progress is transient (player.puzzles); completion persists as the flag.
 */
function throwPuzzleLever(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  events: WorldEvent[],
): void {
  const { player } = state;
  const group = def.puzzle ?? def.id;
  const doneFlag = `pz_${group}`;
  if (player.flags.includes(doneFlag)) {
    events.push({ type: "LOG", message: "The lever is thrown, and whatever it once held shut stands open." });
    return;
  }
  const levers = content.objects.filter((o) => o.kind === "puzzle_lever" && (o.puzzle ?? o.id) === group);
  const progress = player.puzzles[group] ?? 0;
  const order = def.order ?? 0;
  if (order === progress) {
    player.puzzles[group] = progress + 1;
    const st = state.objects[def.id];
    if (st) st.thrown = true;
    if (player.puzzles[group] >= levers.length) {
      player.flags.push(doneFlag); // walkability rebuilds off the flag change
      events.push({ type: "LOG", message: "The last lever slams home. Deep in the rock, counterweights fall — a sealed way grinds OPEN." });
    } else {
      events.push({ type: "LOG", message: "The lever grinds over and holds. Somewhere, stone shifts its weight." });
    }
  } else if (order < progress) {
    events.push({ type: "LOG", message: "This lever is already thrown. It waits on the others." });
  } else {
    // Wrong order: the mechanism springs the whole group back.
    player.puzzles[group] = 0;
    for (const l of levers) { const st = state.objects[l.id]; if (st) st.thrown = false; }
    events.push({ type: "LOG", message: "A wrong pull — the levers spring back with a grinding CLACK. The order matters; the carvings will know it." });
  }
}

/** A dungeon reward chest: grants its loot once, remembered by a player flag. */
function openDungeonChest(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  events: WorldEvent[],
): void {
  const { player } = state;
  const flag = `looted_${def.id}`;
  if (player.flags.includes(flag)) {
    // Anti-softlock: a quest relic (a Pale Tablet) that has gone missing — not
    // in the pack, not in the bank, never handed to Maerwen — turns up again
    // under the chest's false bottom. Everything else stays once-only.
    for (const l of def.loot ?? []) {
      const cat = content.items[l.item]?.cat;
      if (cat !== "Quest") continue;
      if (player.flags.includes(`delivered_${l.item}`)) continue;
      if (countItem(player, l.item) > 0 || (player.bank[l.item] ?? 0) > 0) continue;
      if (canAddItem(player, l.item)) addItem(player, l.item, 1, events);
      else player.bank[l.item] = (player.bank[l.item] ?? 0) + 1;
      events.push({ type: "LOG", message: `Under the chest's false bottom: the ${content.items[l.item]?.name ?? l.item}, right where you must have left it.` });
      return;
    }
    events.push({ type: "LOG", message: "The chest stands open and empty — you have already claimed what it kept." });
    return;
  }
  player.flags.push(flag);
  for (const l of def.loot ?? []) {
    // Never lose dungeon loot to a full pack — overflow goes to the bank.
    if (canAddItem(player, l.item)) {
      addItem(player, l.item, l.qty, events);
    } else {
      player.bank[l.item] = (player.bank[l.item] ?? 0) + l.qty;
      events.push({ type: "ITEM_GAINED", item: l.item, qty: l.qty });
      events.push({ type: "LOG", message: `Your pack was full — ${content.items[l.item]?.name ?? l.item} was sent to your bank.` });
    }
  }
  events.push({ type: "LOG", message: "The lid gives with a crack of old wax. You take what the dark kept." });
}

/**
 * A homestead plot. Unclaimed → claim it (free; you're a frontier homesteader).
 * Claimed → report its standing (its tally of comfort across built furniture),
 * a gentle nudge toward the build hotspots that ring it.
 */
function interactPlot(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  obj: WorldObjectState,
  events: WorldEvent[],
): void {
  if (!obj.owned) {
    obj.owned = true;
    if (!state.player.flags.includes("homesteader")) state.player.flags.push("homesteader");
    events.push({ type: "LOG", message: `You claim ${def.name}. Step inside and build to make it your own.` });
    return;
  }
  const comfort = homeComfort(state, content, def.id);
  const tier = state.player.home.tier;
  const structure = homeStructureName(tier);
  const next = HOUSE_TIERS[tier + 1];
  const nextHint = next
    ? ` A ${next.name} (adding the ${next.room}) awaits at Construction ${next.levelReq} — extend it from the sealed doorway inside.`
    : " It stands complete — every room raised.";
  events.push({
    type: "LOG",
    message: comfort > 0
      ? `${def.name} — a ${structure}, ${comfortTitle(comfort)} (comfort ${comfort}).${nextHint}`
      : `${def.name} — a bare ${structure}. Step inside and build to furnish it.${nextHint}`,
  });
}

/** A home's furnishing quality from its total comfort (distinct from its
 *  structure tier) — the visible reward for decorating. */
function comfortTitle(comfort: number): string {
  if (comfort >= 280) return "sumptuously furnished";
  if (comfort >= 190) return "richly furnished";
  if (comfort >= 120) return "handsomely furnished";
  if (comfort >= 60) return "comfortably furnished";
  if (comfort >= 25) return "modestly furnished";
  return "sparsely furnished";
}

/** Set comfort-tier story flags for a home (drive the housing achievements). */
function markHomeStanding(player: Player, content: Content, state: WorldState, plotId: string): void {
  const c = homeComfort(state, content, plotId);
  const set = (f: string) => { if (!player.flags.includes(f)) player.flags.push(f); };
  if (c >= 25) set("home_cottage");
  if (c >= 120) set("home_manor");
  if (c >= 280) set("home_palace");
}

/** Sum the comfort of every placed piece in the player's home (free-placement). */
function homeComfort(state: WorldState, content: Content, _plotId: string): number {
  let total = 0;
  for (const p of state.player.home.placed) total += content.furniture[p.item]?.comfort ?? 0;
  return total;
}

// ===========================================================================
// Free-placement housing (the Homestead) — ESO/Animal-Crossing style: craft a
// piece from materials (the Construction sink), then place / move / store /
// upgrade it anywhere on your home's floor. All in the pure core (RULE 2).
// ===========================================================================

/** The set of floor tiles that make up the room the player is standing in —
 *  a bounded flood-fill over connected interior "plank" tiles. Empty (size 0)
 *  when the player isn't on a home floor. Bounds free placement to your house. */
function homeFloorSet(state: WorldState): Set<string> {
  const out = new Set<string>();
  const { map } = state;
  // Sealed doorways (tier not yet reached) act as walls, so the flood — and
  // thus furniture placement — is bounded to the rooms you've unlocked.
  const closedSeals = new Set<string>();
  for (const obj of activeContent?.objects ?? []) {
    if (obj.kind === "room_seal" && state.player.home.tier < (obj.tier ?? 1)) {
      closedSeals.add(`${obj.x},${obj.y}`);
    }
  }
  const px = Math.round(state.player.pos.x), py = Math.round(state.player.pos.y);
  const at = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < map.width && y < map.height &&
    map.tiles[y * map.width + x] === "plank" && !closedSeals.has(`${x},${y}`);
  if (!at(px, py)) return out; // not standing on a home floor
  const q: [number, number][] = [[px, py]];
  out.add(`${px},${py}`);
  while (q.length && out.size < 400) { // a house is small; cap for safety
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (!out.has(k) && at(nx, ny)) { out.add(k); q.push([nx, ny]); }
    }
  }
  return out;
}

/** A piece's footprint at a rotation: [w, h], swapped for an odd quarter-turn. */
function effFootprint(f: FurnitureDef, rot: number): [number, number] {
  const [w, h] = f.footprint ?? [1, 1];
  return (rot & 1) === 1 ? [h, w] : [w, h];
}

/** The tiles a piece would cover if placed at (x, y) with rotation. */
function footTiles(f: FurnitureDef, x: number, y: number, rot: number): string[] {
  const [w, h] = effFootprint(f, rot);
  const out: string[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push(`${x + dx},${y + dy}`);
  return out;
}

/** Floor tiles already occupied by placed BLOCKING pieces (rugs don't block, so
 *  furniture can sit on a rug). `except` skips one placed index (for a move). */
function occupiedHomeTiles(player: Player, content: Content, except = -1): Set<string> {
  const out = new Set<string>();
  player.home.placed.forEach((p, i) => {
    if (i === except) return;
    const f = content.furniture[p.item];
    // Rugs are walk-over coverings; wall-hung art sits against the wall behind
    // furniture — neither blocks its tile.
    if (!f || f.category === "rug" || f.wall) return;
    for (const t of footTiles(f, p.x, p.y, p.rot)) out.add(t);
  });
  return out;
}

/** Recompute comfort from placed pieces and stamp the cottage/manor/palace flags. */
function refreshHomeStanding(player: Player, content: Content): void {
  let c = 0;
  for (const p of player.home.placed) c += content.furniture[p.item]?.comfort ?? 0;
  const set = (flag: string): void => { if (!player.flags.includes(flag)) player.flags.push(flag); };
  if (c >= 25) set("home_cottage");
  if (c >= 120) set("home_manor");
  if (c >= 280) set("home_palace");
}

/** CRAFT: spend materials + Construction level to make a piece into home storage. */
function craftFurniture(state: WorldState, content: Content, furnitureId: string, events: WorldEvent[]): void {
  const { player } = state;
  const f = content.furniture[furnitureId];
  if (!f) return;
  if (homeFloorSet(state).size === 0) {
    events.push({ type: "LOG", message: "You can only build furniture inside your home." });
    return;
  }
  if (skillLvl(player, "construction") < f.levelReq) {
    events.push({ type: "LOG", message: `You need Construction level ${f.levelReq} to build the ${f.name}.` });
    return;
  }
  for (const [item, qty] of Object.entries(f.materials)) {
    if (countItem(player, item as ItemId) < (qty ?? 0)) {
      events.push({ type: "LOG", message: `You're short of materials for the ${f.name}.` });
      return;
    }
  }
  // Prestige pieces cost coin as well as materials — a mid/late-game gold sink.
  if (f.gold && player.gold < f.gold) {
    events.push({ type: "LOG", message: `The ${f.name} also costs ${f.gold.toLocaleString()}g in commissioned work — you can't afford it yet.` });
    return;
  }
  for (const [item, qty] of Object.entries(f.materials)) {
    for (let i = 0; i < (qty ?? 0); i++) removeOneItem(player, item as ItemId);
  }
  if (f.gold) player.gold -= f.gold;
  player.home.storage[furnitureId] = (player.home.storage[furnitureId] ?? 0) + 1;
  grantXp(state, content, "construction", f.xp, events);
  events.push({ type: "LOG", message: `You build a ${f.name}. It's ready to place in your home.` });
}

/** Validate a placement footprint against the room + existing pieces. */
function canPlaceAt(state: WorldState, content: Content, f: FurnitureDef, x: number, y: number, rot: number, exceptIndex: number): boolean {
  const floor = homeFloorSet(state);
  if (floor.size === 0) return false;
  const tiles = footTiles(f, x, y, rot);
  for (const t of tiles) if (!floor.has(t)) return false; // must sit wholly on the room floor
  if (f.category !== "rug" && !f.wall) {
    const occ = occupiedHomeTiles(state.player, content, exceptIndex);
    for (const t of tiles) if (occ.has(t)) return false; // no blocking overlap
    // Never let a blocking piece seal a doorway: the door tile and the floor
    // tiles beside it stay clear, so a player can't furnish themselves into a
    // room with no way out.
    for (const obj of content.objects) {
      if (obj.kind !== "house_door") continue;
      for (const t of tiles) {
        const [tx, ty] = t.split(",").map(Number);
        if (Math.abs(tx! - obj.x) + Math.abs(ty! - obj.y) <= 1) return false;
      }
    }
  }
  return true;
}

/** PLACE: put a stored piece down at (x, y, rot). */
function placeFurniture(state: WorldState, content: Content, furnitureId: string, x: number, y: number, rot: number, events: WorldEvent[]): void {
  const { player } = state;
  const f = content.furniture[furnitureId];
  if (!f) return;
  if ((player.home.storage[furnitureId] ?? 0) <= 0) {
    events.push({ type: "LOG", message: `You have no ${f.name} to place.` });
    return;
  }
  if (!canPlaceAt(state, content, f, x, y, rot & 3, -1)) {
    events.push({ type: "LOG", message: "It won't fit there." });
    return;
  }
  player.home.storage[furnitureId]! -= 1;
  if (player.home.storage[furnitureId]! <= 0) delete player.home.storage[furnitureId];
  player.home.placed.push({ item: furnitureId, x, y, rot: rot & 3 });
  if (f.bed) player.spawn = { x, y };
  refreshHomeStanding(player, content);
}

/** MOVE: reposition an already-placed piece. */
function moveFurniture(state: WorldState, content: Content, index: number, x: number, y: number, rot: number, events: WorldEvent[]): void {
  const { player } = state;
  const p = player.home.placed[index];
  if (!p) return;
  const f = content.furniture[p.item];
  if (!f) return;
  if (!canPlaceAt(state, content, f, x, y, rot & 3, index)) {
    events.push({ type: "LOG", message: "It won't fit there." });
    return;
  }
  p.x = x; p.y = y; p.rot = rot & 3;
  if (f.bed) player.spawn = { x, y };
}

/** STORE: pick a placed piece back up into home storage. */
function storeFurniture(state: WorldState, content: Content, index: number, events: WorldEvent[]): void {
  const { player } = state;
  const p = player.home.placed[index];
  if (!p) return;
  const f = content.furniture[p.item];
  const wasSpawnBed = !!f?.bed && player.spawn.x === p.x && player.spawn.y === p.y;
  player.home.placed.splice(index, 1);
  player.home.storage[p.item] = (player.home.storage[p.item] ?? 0) + 1;
  // If you pack up the bed you sleep in, move your respawn to another bed you
  // still own, so you don't wake on a bare patch of floor.
  if (wasSpawnBed) {
    const other = player.home.placed.find((q) => content.furniture[q.item]?.bed);
    if (other) player.spawn = { x: other.x, y: other.y };
  }
  refreshHomeStanding(player, content);
  if (f) events.push({ type: "LOG", message: `You pack up the ${f.name}.` });
}

/** UPGRADE: swap a placed piece for the next tier of its category, in place. */
function upgradeFurniture(state: WorldState, content: Content, index: number, events: WorldEvent[]): void {
  const { player } = state;
  const p = player.home.placed[index];
  if (!p) return;
  const cur = content.furniture[p.item];
  if (!cur) return;
  // The next tier is the lowest-comfort piece in the same category AND of the
  // same kind (decor upgrades among decor, a station among stations) whose
  // comfort strictly exceeds the current piece — so an "upgrade" always improves
  // the home and never crosses the decor/station line (Crate ⇏ bank Oak Chest).
  const next = Object.values(content.furniture)
    .filter((g) => g.category === cur.category && !!g.station === !!cur.station && g.comfort > cur.comfort)
    .sort((a, b) => a.comfort - b.comfort || a.levelReq - b.levelReq)[0];
  if (!next) { events.push({ type: "LOG", message: `The ${cur.name} is already the finest of its kind.` }); return; }
  if (skillLvl(player, "construction") < next.levelReq) {
    events.push({ type: "LOG", message: `You need Construction level ${next.levelReq} to upgrade to the ${next.name}.` });
    return;
  }
  for (const [item, qty] of Object.entries(next.materials)) {
    if (countItem(player, item as ItemId) < (qty ?? 0)) {
      events.push({ type: "LOG", message: `You're short of materials to upgrade to the ${next.name}.` });
      return;
    }
  }
  // A bigger tier might not fit where the old one stood — check before committing.
  if (!canPlaceAt(state, content, next, p.x, p.y, p.rot, index)) {
    events.push({ type: "LOG", message: `The ${next.name} is larger — clear space around it first.` });
    return;
  }
  for (const [item, qty] of Object.entries(next.materials)) {
    for (let i = 0; i < (qty ?? 0); i++) removeOneItem(player, item as ItemId);
  }
  p.item = next.id;
  grantXp(state, content, "construction", next.xp, events);
  if (next.bed) player.spawn = { x: p.x, y: p.y };
  refreshHomeStanding(player, content);
  events.push({ type: "LOG", message: `You upgrade the ${cur.name} into a ${next.name}.` });
}

/** SET_SURFACE: recolour the home's floor or walls to a chosen surface. */
function setSurface(state: WorldState, content: Content, surfaceId: string, events: WorldEvent[]): void {
  const { player } = state;
  if (homeFloorSet(state).size === 0) {
    events.push({ type: "LOG", message: "You can only redecorate inside your own home." });
    return;
  }
  const s = content.surfaces[surfaceId];
  if (!s) return;
  if (s.levelReq && skillLvl(player, "construction") < s.levelReq) {
    events.push({ type: "LOG", message: `You need Construction level ${s.levelReq} to lay the ${s.name}.` });
    return;
  }
  if (s.kind === "floor") player.home.floor = surfaceId;
  else player.home.wall = surfaceId;
  events.push({ type: "LOG", message: `You lay the ${s.name}.` });
}

/**
 * A build hotspot. Only usable once its plot is claimed; then it opens the
 * furniture build/replace menu for its category (the client lists the pieces).
 */
function interactHotspot(
  state: WorldState,
  def: WorldObjectDef,
  obj: WorldObjectState,
  events: WorldEvent[],
): void {
  const plot = def.plot ? state.objects[def.plot] : undefined;
  if (!plot?.owned) {
    events.push({ type: "LOG", message: "You'd need to claim this homestead before building on it." });
    return;
  }
  events.push({
    type: "OPEN_BUILD",
    hotspotId: def.id,
    category: def.category ?? "hall",
    current: obj.furniture ?? null,
  });
}

/** Build (or replace) a furniture piece at a hotspot — the Construction sink. */
function buildFurniture(
  state: WorldState,
  content: Content,
  hotspotId: string,
  furnitureId: string,
  events: WorldEvent[],
): void {
  const { player } = state;
  const obj = state.objects[hotspotId];
  const def = findObjectDef(content, hotspotId);
  const f = content.furniture[furnitureId];
  if (!obj || !def || !f) return;
  const plot = def.plot ? state.objects[def.plot] : undefined;
  if (!plot?.owned) {
    events.push({ type: "LOG", message: "You don't own this homestead." });
    return;
  }
  if (f.category !== def.category) {
    events.push({ type: "LOG", message: `A ${f.name} doesn't belong at this footing.` });
    return;
  }
  if (obj.furniture === furnitureId) {
    events.push({ type: "LOG", message: `A ${f.name} already stands here.` });
    return;
  }
  if (skillLvl(player, "construction") < f.levelReq) {
    events.push({ type: "LOG", message: `You need Construction level ${f.levelReq} to build the ${f.name}.` });
    return;
  }
  // Check, then consume, every required material.
  for (const [item, qty] of Object.entries(f.materials)) {
    if (countItem(player, item as ItemId) < (qty ?? 0)) {
      events.push({ type: "LOG", message: `You're short of materials for the ${f.name}.` });
      return;
    }
  }
  for (const [item, qty] of Object.entries(f.materials)) {
    for (let i = 0; i < (qty ?? 0); i++) removeOneItem(player, item as ItemId);
  }
  obj.furniture = furnitureId;
  grantXp(state, content, "construction", f.xp, events);
  if (def.plot) markHomeStanding(player, content, state, def.plot); // comfort-tier flags → achievements
  // A bed makes the homestead your home: you respawn here from now on.
  if (f.bed && def.plot) {
    const plotDef = findObjectDef(content, def.plot);
    if (plotDef?.target) {
      player.spawn = { x: plotDef.target.x, y: plotDef.target.y };
      events.push({ type: "LOG", message: `You build the ${f.name}. This is your home now — you'll wake here.` });
      return;
    }
  }
  events.push({ type: "LOG", message: `You build the ${f.name}.` });
}

/**
 * The house-tier ladder. Index = the tier reached once built (0 = the base
 * Cottage you claim). Each step unseals one room for a Construction level + gold
 * + materials — the Construction money-sink, and the spine the exterior (curb
 * appeal) and the backyard read off. Costs climb steeply so a full Estate is a
 * genuine long-haul goal.
 */
export const HOUSE_TIERS: { name: string; room: string; levelReq: number; gold: number; xp: number; materials: Record<string, number> }[] = [
  { name: "Cottage", room: "living", levelReq: 0, gold: 0, xp: 0, materials: {} },
  { name: "Homestead", room: "kitchen", levelReq: 10, gold: 2000, xp: 200, materials: { plank_greyoak: 8, timber_frame: 4, mortar_basic: 4 } },
  { name: "Manor", room: "bedroom", levelReq: 30, gold: 8000, xp: 480, materials: { plank_ironbark: 10, timber_frame: 6, stone_block: 6, mortar_basic: 6 } },
  { name: "Estate", room: "workshop", levelReq: 50, gold: 25000, xp: 1100, materials: { plank_heartoak: 12, plank_stonewood: 8, stone_block: 10, ashiron_bar: 4, cut_gem: 1 } },
];

/** The structure name for a house at a given tier (Cottage → Estate). */
export function homeStructureName(tier: number): string {
  return (HOUSE_TIERS[tier] ?? HOUSE_TIERS[HOUSE_TIERS.length - 1]!).name;
}

/** Upgrade the house one tier: spend the level + gold + materials, unseal the room. */
function buildRoom(
  state: WorldState,
  content: Content,
  sealId: string,
  events: WorldEvent[],
): void {
  const { player } = state;
  const def = findObjectDef(content, sealId);
  if (!def || def.kind !== "room_seal") return;
  if (def.plot && !state.objects[def.plot]?.owned) {
    events.push({ type: "LOG", message: "You don't own this homestead." });
    return;
  }
  const sealTier = def.tier ?? 1;
  if (sealTier <= player.home.tier) { events.push({ type: "LOG", message: "That room is already part of your house." }); return; }
  if (sealTier !== player.home.tier + 1) { events.push({ type: "LOG", message: "You must extend the house one room at a time." }); return; }
  const up = HOUSE_TIERS[sealTier];
  if (!up) return;
  if (skillLvl(player, "construction") < up.levelReq) {
    events.push({ type: "LOG", message: `Raising your ${up.name} needs Construction level ${up.levelReq}.` });
    return;
  }
  if (player.gold < up.gold) {
    events.push({ type: "LOG", message: `Your ${up.name} costs ${up.gold} gold — you're short.` });
    return;
  }
  for (const [item, qty] of Object.entries(up.materials)) {
    if (countItem(player, item as ItemId) < qty) {
      events.push({ type: "LOG", message: `You're short of materials to raise your ${up.name}.` });
      return;
    }
  }
  player.gold -= up.gold;
  for (const [item, qty] of Object.entries(up.materials)) {
    for (let i = 0; i < qty; i++) removeOneItem(player, item as ItemId);
  }
  player.home.tier = sealTier; // the doorway opens (walkability reads this live)
  grantXp(state, content, "construction", up.xp, events);
  events.push({ type: "LOG", message: `You raise your home to a ${up.name}. The ${up.room} opens onto the house.` });
}

/** Use a built functional piece as a station — bank / cook / build / pray, at home. */
function useFurniture(
  state: WorldState,
  content: Content,
  hotspotId: string,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const obj = state.objects[hotspotId];
  const f = obj?.furniture ? content.furniture[obj.furniture] : undefined;
  if (!obj || !f || !f.station) {
    events.push({ type: "LOG", message: "There's nothing here to use." });
    return;
  }
  if (f.station === "bank") {
    state.player.station = { kind: "bank" };
    events.push({ type: "OPEN_BANK" });
    return;
  }
  // A home Altar of Orun: kneel and pray to refill Grace, exactly like a world
  // shrine (same one-a-minute cooldown, so it can't be camped as a free battery).
  if (f.station === "shrine") {
    const player = state.player;
    const gm = graceMax(player);
    if (player.grace >= gm) {
      events.push({ type: "LOG", message: `You kneel at the ${f.name}. Your Grace is already full.` });
    } else if (ctx.now < (obj.graceCooldownUntil ?? 0)) {
      const wait = Math.ceil(((obj.graceCooldownUntil ?? 0) - ctx.now) / 1000);
      events.push({ type: "LOG", message: `The ${f.name} is spent from your last prayer — its grace returns in ${wait}s.` });
    } else {
      player.grace = gm;
      obj.graceCooldownUntil = ctx.now + SHRINE_RECHARGE_MS;
      events.push({ type: "LOG", message: `You kneel at your ${f.name} and pray. Orun's grace fills you.` });
    }
    return;
  }
  // Any other station value is a crafting-station ObjKind (fire/workbench/etc).
  events.push({ type: "OPEN_CRAFT", station: f.station as ObjKind, objId: hotspotId });
}

/** Clear a hotspot's furniture (no refund — you scrap the piece). */
function removeFurniture(
  state: WorldState,
  content: Content,
  hotspotId: string,
  events: WorldEvent[],
): void {
  const obj = state.objects[hotspotId];
  const def = findObjectDef(content, hotspotId);
  if (!obj || !def) return;
  if (!obj.furniture) {
    events.push({ type: "LOG", message: "There's nothing built here to clear." });
    return;
  }
  const f = content.furniture[obj.furniture];
  delete obj.furniture;
  events.push({ type: "LOG", message: `You clear away the ${f?.name ?? "furniture"}.` });
}

/**
 * Read a relic out in the world. The first time, record the lore fragment in the
 * Archive and pay a small one-time finder's reward; either way, show the passage.
 * The relic stays put so it can be re-read — the reward is gated by player.lore.
 */
function readRelic(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  events: WorldEvent[],
): void {
  const { player } = state;
  const entry = def.loreId ? content.lore.find((l) => l.id === def.loreId) : undefined;
  if (!entry) {
    events.push({ type: "LOG", message: `You study the ${def.name}, but make nothing of it.` });
    return;
  }
  if (!player.lore.includes(entry.id)) {
    player.lore.push(entry.id);
    events.push({ type: "LOG", message: `Archive — you uncover "${entry.title}".` });
    const r = entry.reward;
    if (r?.gold) {
      player.gold += r.gold;
      player.stats.goldEarned += r.gold;
      events.push({ type: "LOG", message: `A finder's reward: ${r.gold} gold.` });
    }
    if (r?.xp) grantXp(state, content, r.xp.skill, r.xp.amount, events);
  }
  // Show the passage in the dialogue box, the relic's title at its head.
  events.push({ type: "DIALOGUE", npc: entry.title, lines: entry.text });
}

/**
 * A repeatable "witness the heat" devotion event at the Cult's warm seam
 * (T6·02). Offering embercite — the Cult's own tribute to the ground — is
 * consumed for Devotion XP and a Grace refill, so Ashfen's lore ("witness, not
 * help; the discomfort is the point") becomes something you DO, not just read.
 * The item cost is the throttle; the first witness sets a one-off flag.
 */
function witnessSeam(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  _obj: WorldObjectState,
  _ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const off = def.witnessOffering!;
  if (!hasItem(player, off.item)) {
    events.push({ type: "LOG", message: `The ${def.name} pulses with a heat that aches to stand near. The Cult witnesses with embercite laid on the stone — you have none to give. Bring embercite ore and stand your witness.` });
    return;
  }
  removeItems(player, off.item, 1);
  grantXp(state, content, "faith", off.faithXp, events);
  const gm = graceMax(player);
  if (player.grace < gm) player.grace = gm;
  if (!player.flags.includes("witnessed_the_seam")) {
    player.flags.push("witnessed_the_seam");
    events.push({ type: "LOG", message: `You set the embercite on the warm stone and stand the discomfort, as the Cult does. The ground answers under your boots — not warmth now, but attention. Something vast and slow marks that you stayed. Orun's grace rises with the heat.` });
  } else {
    events.push({ type: "LOG", message: `You lay embercite on the warm seam and stand your witness. The heat climbs through you, and Orun's grace comes with it.` });
  }
}

/**
 * A one-off exploration find (T6·03): searching a landmark the first time pays
 * a finder's reward — an item, gold and/or XP — and sets its flag, so a
 * curiosity hook rewards DOING, not just reading. Reuses the relic reward loop.
 */
function searchLandmark(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  events: WorldEvent[],
): void {
  const { player } = state;
  const f = def.find!;
  if (player.flags.includes(f.flag)) {
    events.push({ type: "LOG", message: def.lines?.[0] ?? `You search the ${def.name} again, but it has given up what it kept.` });
    return;
  }
  player.flags.push(f.flag);
  events.push({ type: "LOG", message: f.found });
  if (f.item) addItem(player, f.item, f.qty ?? 1, events);
  if (f.gold) {
    player.gold += f.gold;
    player.stats.goldEarned += f.gold;
    events.push({ type: "LOG", message: `A finder's reward: ${f.gold} gold.` });
  }
  if (f.xp) grantXp(state, content, f.xp.skill, f.xp.amount, events);
}

/** Empty patch → pick a seed; growing → time left; ripe → harvest. */
function interactPatch(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  obj: WorldObjectState,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const patchType = def.kind === "tree_patch" ? "tree" : "plant";
  if (!obj.crop) {
    events.push({ type: "OPEN_PLANT", patchId: def.id, patchType });
    return;
  }
  const crop = content.crops[obj.crop];
  if (!crop) { delete obj.crop; return; }
  const readyAt = (obj.plantedAt ?? 0) + crop.growthMs;
  if (ctx.epoch < readyAt) {
    const mins = Math.ceil((readyAt - ctx.epoch) / 60000);
    events.push({ type: "LOG", message: `${crop.name} is still growing — about ${mins} min left.` });
    return;
  }
  harvestPatch(state, content, obj, crop, ctx, events);
}

/** Harvest a ripe patch: roll survival, grant produce + XP, clear the patch. */
function harvestPatch(
  state: WorldState,
  content: Content,
  obj: WorldObjectState,
  crop: CropDef,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  delete obj.crop;
  delete obj.plantedAt;
  // Fertilizer worked into this planting raises the survival roll — the
  // bonus each mix's description promises — and is spent by the harvest.
  const fertBonus = obj.fert === 2 ? 0.35 : obj.fert === 1 ? 0.20 : 0;
  delete obj.fert;
  const survival = Math.min(0.95, crop.baseChance + fertBonus);
  // A failed survival roll is a THIN harvest, not a total loss — you always
  // walk away with something for the wait (OSRS reduces yield; it doesn't
  // routinely take the whole patch).
  if (ctx.rng() >= survival) {
    addItem(player, crop.produce, 1, events);
    grantXp(state, content, "farming", Math.floor(crop.xpHarvest * 0.4), events);
    events.push({ type: "LOG", message: `A thin harvest — the ${crop.name} struggled, but you save one ${content.items[crop.produce].name}.` });
    return;
  }
  const qty = randInt(ctx, crop.produceMin, crop.produceMax);
  addItem(player, crop.produce, qty, events);
  grantXp(state, content, "farming", crop.xpHarvest, events);
  events.push({ type: "LOG", message: `You harvest ${qty}× ${content.items[crop.produce].name}.` });
  if (crop.bonusDrop && crop.bonusChance && ctx.rng() < crop.bonusChance && content.items[crop.bonusDrop]) {
    if (canAddItem(player, crop.bonusDrop)) addItem(player, crop.bonusDrop, 1, events);
  }
}

/** The two fertilizers the Survivalist mixes, and the survival bonus each works
 *  into a patch — exactly what the item descriptions promise (+20% / +35%). */
const FERTILIZERS: Partial<Record<ItemId, { tier: 1 | 2; bonus: number }>> = {
  fertilizer_basic: { tier: 1, bonus: 0.20 },
  fertilizer_rich: { tier: 2, bonus: 0.35 },
};

/** Work a pack slot's fertilizer into a farm patch (empty or growing). One
 *  treatment per planting — spent by the next harvest; a richer mix can
 *  replace a basic one, never the reverse. Small Farming XP for the labour. */
function fertilizePatch(
  state: WorldState,
  content: Content,
  patchId: string,
  slot: number,
  events: WorldEvent[],
): void {
  const { player } = state;
  const held = player.inventory[slot];
  const fert = held ? FERTILIZERS[held.item] : undefined;
  if (!held || !fert) return;
  const obj = state.objects[patchId];
  const def = findObjectDef(content, patchId);
  if (!obj || !def || (def.kind !== "plant_patch" && def.kind !== "tree_patch")) {
    events.push({ type: "LOG", message: "That's no place for fertilizer." });
    return;
  }
  if ((obj.fert ?? 0) >= fert.tier) {
    events.push({ type: "LOG", message: "This soil is already well fed." });
    return;
  }
  obj.fert = fert.tier;
  removeItems(player, held.item, 1);
  grantXp(state, content, "farming", fert.tier === 2 ? 50 : 20, events);
  events.push({
    type: "LOG",
    message: obj.crop
      ? `You work the ${content.items[held.item].name.toLowerCase()} in around the roots — this crop will come through stronger.`
      : `You work the ${content.items[held.item].name.toLowerCase()} into the soil — the next planting here will come through stronger.`,
  });
}

/** Plant a crop's seed in an empty patch (consumes the seed, grants plant XP). */
function plantSeed(
  state: WorldState,
  content: Content,
  patchId: string,
  cropId: string,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const obj = state.objects[patchId];
  const def = findObjectDef(content, patchId);
  const crop = content.crops[cropId];
  if (!obj || !def || !crop) return;
  const patchType = def.kind === "tree_patch" ? "tree" : "plant";
  if (crop.type !== patchType) {
    events.push({ type: "LOG", message: `That seed doesn't belong in this patch.` });
    return;
  }
  if (obj.crop) {
    events.push({ type: "LOG", message: "Something is already growing here." });
    return;
  }
  if (skillLvl(player, "farming") < crop.levelReq) {
    events.push({ type: "LOG", message: `You need Farming level ${crop.levelReq} to plant ${crop.name}.` });
    return;
  }
  if (countItem(player, crop.seed) < 1) {
    events.push({ type: "LOG", message: `You have no ${content.items[crop.seed].name}.` });
    return;
  }
  removeOneItem(player, crop.seed);
  obj.crop = cropId;
  obj.plantedAt = ctx.epoch;
  grantXp(state, content, "farming", crop.xpPlant, events);
  const mins = Math.ceil(crop.growthMs / 60000);
  events.push({ type: "LOG", message: `You plant ${crop.name}. Ready in about ${mins} min.` });
}

/** The Courier's toll between two points — scales with distance, with a floor. */
export function travelFare(from: Vec2, destTarget: Vec2): number {
  const d = Math.max(Math.abs(from.x - destTarget.x), Math.abs(from.y - destTarget.y));
  return Math.max(15, Math.round(d));
}

/** Pay the toll and fast-travel to a waystone's arrival tile. */
function travelTo(
  state: WorldState,
  content: Content,
  toObjId: string,
  events: WorldEvent[],
): void {
  const def = findObjectDef(content, toObjId);
  if (!def || def.kind !== "waystone" || !def.target) return;
  const { player } = state;
  const fare = travelFare(player.pos, def.target);
  if (player.gold < fare) {
    events.push({ type: "LOG", message: `The toll to ${def.name} is ${fare}g — you can't cover it.` });
    return;
  }
  player.gold -= fare;
  player.pos = { x: def.target.x, y: def.target.y };
  player.path = [];
  player.pendingInteractId = null;
  clearActivity(player);
  // Remember this stone as the Wayfare anchor — the paid recall returns here.
  player.lastWaystone = toObjId;
  events.push({ type: "LOG", message: `You pay the Courier ${fare}g and ride to ${def.name}.` });
}

/**
 * Clear one leg of an Agility circuit. Obstacles must be taken in order; the
 * first (order 0) starts a lap, the last pays a lap-completion bonus. Each clear
 * grants Agility XP and hops the player to the obstacle's far side.
 */
// How long (ms) it takes to climb/cross one obstacle — a beat, not instant.
const OBSTACLE_MS = 1000;

function traverseObstacle(
  state: WorldState,
  def: WorldObjectDef,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const course = def.course;
  const order = def.order ?? 0;
  if (player.agilityHop) return; // already mid-climb
  // A free-standing crossing (no course): anyone meeting the level requirement
  // may traverse it any time, either direction — a shortcut, not a lap leg.
  if (!course) {
    const freeReq = def.levelReq ?? 1;
    if (skillLvl(player, "agility") < freeReq) {
      events.push({ type: "LOG", message: `You need Agility level ${freeReq} to cross here.` });
      return;
    }
    player.path = [];
    player.pendingInteractId = null;
    player.agilityHop = { objId: def.id, at: ctx.now + OBSTACLE_MS };
    return;
  }

  // The Varathian Trail is sealed until you've spoken with Cael the Trailkeeper
  // at the trail head and learned its story (mirrors the pier's warden gate).
  if (course === "course_varath_trail" && !player.flags.includes("trail_unlocked")) {
    events.push({ type: "LOG", message: "The Varathian Trail is not yours to run yet — speak with Cael the Trailkeeper at the trail head first." });
    return;
  }

  // Course-wide level gate (every obstacle carries the requirement).
  const req = def.levelReq ?? 1;
  if (skillLvl(player, "agility") < req) {
    events.push({ type: "LOG", message: `You need Agility level ${req} to train here.` });
    return;
  }

  const lap = player.agilityLap;
  const isStart = order === 0;
  const inSequence = lap && lap.course === course && lap.next === order;
  if (!isStart && !inSequence) {
    events.push({ type: "LOG", message: `Start at the beginning of the ${def.name.replace(/:.*$/, "")} course.` });
    return;
  }

  // Begin the climb; it finishes a beat later (processed in tick).
  player.path = [];
  player.pendingInteractId = null;
  player.agilityHop = { objId: def.id, at: ctx.now + OBSTACLE_MS };
}

/** Finish a started obstacle climb: grant XP, hop to the far side, advance lap. */
function finishObstacle(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  events: WorldEvent[],
): void {
  const { player } = state;
  const course = def.course;
  const order = def.order ?? 0;
  // Free-standing crossing: XP + the hop to the far bank, no lap bookkeeping.
  if (!course) {
    grantXp(state, content, "agility", def.xp ?? 10, events);
    if (def.exit) {
      player.pos = { x: def.exit.x, y: def.exit.y };
      player.path = [];
    }
    events.push({ type: "LOG", message: "You cross the fallen log, sure-footed over the water." });
    return;
  }

  const legs = content.objects.filter((o) => o.kind === "agility_obstacle" && o.course === course);
  const lastOrder = legs.reduce((m, o) => Math.max(m, o.order ?? 0), 0);

  grantXp(state, content, "agility", def.xp ?? 10, events);
  if (def.exit) {
    player.pos = { x: def.exit.x, y: def.exit.y };
    player.path = [];
  }

  if (order >= lastOrder) {
    const total = legs.reduce((s, o) => s + (o.xp ?? 0), 0);
    let bonus = Math.round(total * AGILITY_LAP_BONUS_MULT);
    player.agilityLap = null;
    // The Varathian Trail is a whole-map circuit — a lap pays a far larger XP
    // dump and a purse of Agility Marks for the Trailkeeper's outfit.
    if (course === "course_varath_trail") {
      bonus += TRAIL_LAP_XP;
      player.trailLaps = (player.trailLaps ?? 0) + 1;
      // One hard-won Mark per full lap — a full outfit is the work of many laps.
      const gotMark = canAddItem(player, "agility_mark");
      if (gotMark) addItem(player, "agility_mark", TRAIL_LAP_MARKS, events);
      const markLine = gotMark
        ? `You earn ${TRAIL_LAP_MARKS} Agility Mark.`
        : "Your pack is full — no room for the Mark!";
      events.push({ type: "LOG", message: `Varathian Trail lap ${player.trailLaps} complete! A grand run of the whole country. ${markLine}` });
    } else {
      events.push({ type: "LOG", message: "Lap complete! You catch your breath, pleased with the run." });
    }
    if (bonus > 0) grantXp(state, content, "agility", bonus, events);
  } else {
    player.agilityLap = { course, next: order + 1 };
  }
}

/** A portal teleports the player to its paired destination (boss arena ↔ home). */
function usePortal(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  events: WorldEvent[],
): void {
  if (!def.target) return;
  const { player } = state;
  // Never strand the player: if a portal's destination has been flooded or
  // walled off by a later terrain pass, land them on the nearest solid ground.
  player.pos = respawnTile(content, { x: def.target.x, y: def.target.y });
  player.path = [];
  player.pendingInteractId = null;
  clearActivity(player);
  if (def.lines?.[0]) events.push({ type: "LOG", message: def.lines[0] });
}

// ---------------------------------------------------------------------------
// The tick: advancing time. Movement, activities, combat and respawns.
// ---------------------------------------------------------------------------

/** A guaranteed-standable respawn point: the spawn tile, or the nearest land. */
function respawnTile(content: Content, spawn: Vec2): Vec2 {
  const { map } = content;
  const solid = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
    const t = map.tiles[y * map.width + x];
    return t === "water" || t === "mountain" || t === "cave_wall" || t === "deep" || t === "wall";
  };
  if (!solid(spawn.x, spawn.y)) return { x: spawn.x, y: spawn.y };
  for (let r = 1; r <= 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!solid(spawn.x + dx, spawn.y + dy)) return { x: spawn.x + dx, y: spawn.y + dy };
      }
    }
  }
  return { x: spawn.x, y: spawn.y };
}

/**
 * Aggressive monsters strike first. If the player is idle/walking (not already
 * fighting, gathering or crafting) and steps within AGGRO_RANGE of an awake
 * predator, that monster pulls them into combat and gets the first swing — so
 * the wilderness can no longer be strolled through untouched.
 */
function checkAggro(
  state: WorldState,
  content: Content,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  if (!player.alive || player.activity.kind !== "idle") return;
  // Don't pounce on a player who's moving (walking past / fleeing), and honour
  // the post-move flee grace — so you can leave a fight instead of being re-locked.
  if (player.path.length > 0 || ctx.now < (player.aggroImmuneUntil ?? 0)) return;
  for (const def of content.objects) {
    if (def.kind !== "monster" || !AGGRESSIVE.has(def.monster ?? "")) continue;
    const obj = state.objects[def.id];
    if (!obj || !obj.available || obj.hp === undefined) continue;
    const mp = obj.pos ?? { x: def.x, y: def.y };
    // A melee brute only lunges when you're right beside it; an archer/caster
    // opens fire the moment you stray into its (longer) attack range.
    const reach = Math.max(AGGRO_RANGE, monsterFor(content, def)?.attackRange ?? 0);
    if (Math.hypot(mp.x - player.pos.x, mp.y - player.pos.y) > reach) continue;
    const pSpeed = playerSpeed(player, content);
    const mSpeed = monsterFor(content, def)?.speed ?? COMBAT.monsterSpeed;
    player.path = [];
    player.pendingInteractId = null;
    player.station = null;
    player.activity = {
      kind: "combat",
      targetId: def.id,
      actionId: null,
      nextActionAt: ctx.now + pSpeed,
      actionInterval: pSpeed,
    };
    obj.nextAttackAt = ctx.now + Math.floor(mSpeed / 2); // it gets the jump on you
    events.push({ type: "LOG", message: `The ${def.name} attacks!` });
    return; // one engagement per tick
  }
}

export function tick(
  state: WorldState,
  content: Content,
  ctx: Ctx,
): WorldEvent[] {
  activeContent = content;
  const events: WorldEvent[] = [];
  // Clamp dt so a backgrounded tab doesn't teleport everything at once.
  const dt = Math.min(Math.max(ctx.now - state.lastTick, 0), 250);
  state.lastTick = ctx.now;
  // Accumulate active play time. Because dt is clamped, a tab left in the
  // background (where the loop pauses) never inflates the count — this only ever
  // grows while the game is actually running in front of the player.
  state.player.playMs += dt;

  // Loot left on the floor too long fades away.
  if (state.ground.length) {
    state.ground = state.ground.filter((g) => g.despawnAt > ctx.now);
  }

  // A lit campfire burns down to ash after its time is up.
  if (state.campfire && ctx.now >= state.campfire.expiresAt) {
    state.campfire = null;
    events.push({ type: "LOG", message: "Your campfire burns out." });
  }

  // Armed boss slams detonate when their windup elapses — wherever the player
  // is by then. Standing clear means it hits nothing but scorched ground.
  resolveSlams(state, content, ctx, events);

  // Shops top their shelves back up on a timer.
  ensureShopStock(state, content, ctx);

  const { player } = state;

  // 0) Keep max HP in step with the Vitality level (leveling up heals you).
  syncMaxHp(player);

  // 0b) Expire any temporary buffs whose time is up.
  for (const kind of Object.keys(player.buffs)) {
    if (ctx.now >= player.buffs[kind]!.until) {
      delete player.buffs[kind];
      events.push({ type: "LOG", message: `Your ${(BUFF_LABEL[kind] ?? kind).replace(/^\+/, "")} boost fades.` });
    }
  }

  // 0c) A held protection blessing burns Grace steadily; it gutters out when
  // the pool runs dry (refill at a shrine and re-light it).
  if (player.blessing) {
    const sp = content.spells.find((s) => s.id === player.blessing);
    if (!sp) player.blessing = null;
    else {
      player.grace -= (sp.drainPerSec ?? 0.6) * (dt / 1000);
      if (player.grace <= 0) {
        player.grace = 0;
        player.blessing = null;
        events.push({ type: "LOG", message: `${sp.name} gutters out — your Grace is spent.` });
      }
    }
  }

  // A death anywhere ends an active Delve run — the deep keeps its floor.
  if (!player.alive && state.delve) {
    clearDelve(state);
    events.push({ type: "LOG", message: "The Delve claims your run. The Warden writes a second date." });
  }

  // The Greyback wanders: every so often it relocates along its patrol and the
  // sighting is called in the chat feed — a live world event to chase down.
  moveWorldBoss(state, content, ctx, events);

  // 1) Respawn the player if they're dead and their timer is up.
  if (!player.alive) {
    if (ctx.now >= player.respawnAt) {
      player.alive = true;
      player.hp = player.maxHp;
      player.pos = respawnTile(content, player.spawn);
      player.path = [];
      clearActivity(player);
      events.push({ type: "PLAYER_RESPAWNED" });
    }
  } else {
    // 1b) Finish an in-progress obstacle climb once its beat has elapsed.
    if (player.agilityHop) {
      if (player.path.length > 0) {
        player.agilityHop = null; // walked away — cancel the climb
      } else if (ctx.now >= player.agilityHop.at) {
        const odef = content.objects.find((o) => o.id === player.agilityHop!.objId);
        player.agilityHop = null;
        if (odef) finishObstacle(state, content, odef, events);
      }
    }

    // 2) Movement. Sprinting drains run energy; otherwise it recovers.
    const wasMoving = player.path.length > 0;
    const sprintTiles = wasMoving ? stepMovement(player, dt) : 0;
    if (sprintTiles <= 0) {
      if (player.energy < ENERGY_MAX) {
        const regen = (ENERGY_REGEN * agilityRegenMult(player) * dt) / 1000;
        player.energy = Math.min(ENERGY_MAX, player.energy + regen);
      }
      if (player.winded && player.energy >= ENERGY_RECOVER) player.winded = false; // caught your breath
    }
    const arrived = wasMoving && player.path.length === 0;
    if (arrived && player.pendingInteractId) {
      startInteraction(state, content, player.pendingInteractId, ctx, events);
    }

    // 3) Whatever the player is busy doing (only when standing still).
    if (player.path.length === 0) {
      processActivity(state, content, ctx, events);
    }

    // 3b) Auto-advance any "gather X" quest objective now satisfied.
    checkGatherQuests(state, content, events);

    // 3c) Aggressive monsters you've wandered too close to strike first.
    checkAggro(state, content, ctx, events);
  }

  // 4) Respawn depleted resources / dead monsters whose timers are up.
  for (const def of content.objects) {
    const obj = state.objects[def.id];
    if (!obj || obj.available) continue;
    if (ctx.now >= obj.respawnAt) {
      obj.available = true;
      if (def.kind === "monster") {
        obj.hp = monsterFor(content, def)?.hp ?? 1;
        obj.nextAttackAt = 0;
        // A slain monster comes back at its spawn, not where it wandered to die.
        obj.pos = { x: def.x, y: def.y };
        obj.wanderTarget = null;
        obj.nextWanderAt = ctx.now + WANDER.pauseMin;
        // Fresh boss fight: reset its special-move state.
        obj.swings = 0;
        obj.enraged = false;
        obj.healed = false;
        obj.wardPhase = 0;
        // A summoning boss comes back with its adds un-called and sent home.
        const rstats = monsterFor(content, def);
        const summon = rstats?.mechanics?.find((m) => m.type === "summon");
        if (summon && summon.type === "summon") {
          despawnFlaggedSpawns(state, content, summon.flag);
          obj.summoned = false;
        }
      }
      events.push({ type: "OBJECT_RESPAWNED", objId: def.id });
    }
  }

  // 5) Idle wandering: npcs + monsters amble within reach of their spawn.
  wanderCreatures(state, content, ctx, dt);

  // 5b) Fishing spots drift along the shoreline (OSRS-style) — they move on
  // every so often, so you follow them rather than stand on one tile forever.
  moveFishingSpots(state, content, ctx, events);

  // 6) Light up any newly-earned achievements.
  checkAchievements(state, content, events);

  return events;
}

/** OSRS-style: fishing spots periodically relocate to a nearby shore tile, near
 *  their anchor, ending any fishing on a spot that swims off. */
const FISH_MOVE_MIN = 22_000, FISH_MOVE_MAX = 48_000; // ms between relocations
function moveFishingSpots(
  state: WorldState,
  content: Content,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { map } = content;
  const blocked = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
    const t = map.tiles[y * map.width + x];
    return t === "mountain" || t === "cave_wall" || t === "wall" || t === "plank";
  };
  const isWater = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const t = map.tiles[y * map.width + x];
    return t === "water" || t === "deep";
  };
  // A castable shore tile: open water you can stand beside (a walkable land edge).
  const shore = (x: number, y: number): boolean =>
    isWater(x, y) && (
      (!blocked(x, y - 1) && !isWater(x, y - 1)) || (!blocked(x, y + 1) && !isWater(x, y + 1)) ||
      (!blocked(x - 1, y) && !isWater(x - 1, y)) || (!blocked(x + 1, y) && !isWater(x + 1, y))
    );
  for (const def of content.objects) {
    if (def.kind !== "fishing_spot") continue;
    const obj = state.objects[def.id];
    if (!obj || !obj.available) continue;
    if (!obj.nextWanderAt) { obj.nextWanderAt = ctx.now + randRange(ctx, FISH_MOVE_MIN, FISH_MOVE_MAX); continue; }
    if (ctx.now < obj.nextWanderAt) continue;
    // Gather candidate shore tiles within a small radius of the anchor (def), not
    // the current spot, so a spot drifts around its home rather than wandering off.
    const cands: Vec2[] = [];
    const cur = obj.pos ?? { x: def.x, y: def.y };
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = def.x + dx, y = def.y + dy;
      if ((x === Math.round(cur.x) && y === Math.round(cur.y)) || !shore(x, y)) continue;
      cands.push({ x, y });
    }
    obj.nextWanderAt = ctx.now + randRange(ctx, FISH_MOVE_MIN, FISH_MOVE_MAX);
    if (cands.length === 0) continue;
    obj.pos = cands[Math.floor(ctx.rng() * cands.length)]!;
    // If the player was fishing this spot, it swam off — stop and tell them
    // (OSRS-style: moving to the new spot and recasting is the player's call).
    if (state.player.activity.kind === "fishing" && state.player.activity.targetId === def.id) {
      clearActivity(state.player);
      events.push({ type: "LOG", message: `The ${def.name} moves off down the shore.` });
    }
  }
}

/**
 * Step every wandering creature one unhurried tile-walk at a time, within
 * WANDER.radius of its spawn. Creatures hold still while the player is right
 * beside them (so talking / engaging is never a moving target) and while a
 * monster is the player's active combat target. Rebuilds state.creatureTiles
 * from live positions so the player's pathfinder routes around them.
 */
function wanderCreatures(
  state: WorldState,
  content: Content,
  ctx: Ctx,
  dt: number,
): void {
  const { player } = state;
  const walk = baseWalkable(content);
  const pTile = { x: Math.round(player.pos.x), y: Math.round(player.pos.y) };

  // Rebuild the live occupancy set from where creatures currently stand (and the
  // tiles they're stepping into), so reservations are honoured within this pass.
  // Two sets with different customers: `occupied` (npc + monster) keeps creatures
  // from stacking on EACH OTHER; `state.creatureTiles` (monsters only) is what the
  // PLAYER's pathfinder routes around — you brush past townsfolk in a narrow
  // street the way you do in OSRS, but a monster still holds its ground.
  const occupied = new Set<string>();
  const playerBlocked = state.creatureTiles;
  playerBlocked.clear();
  for (const def of content.objects) {
    if (def.kind === "critter") continue; // ambient wildlife doesn't block
    const obj = state.objects[def.id];
    if (!obj || !obj.pos || !obj.available) continue;
    occupied.add(`${Math.round(obj.pos.x)},${Math.round(obj.pos.y)}`);
    if (obj.wanderTarget) occupied.add(`${obj.wanderTarget.x},${obj.wanderTarget.y}`);
    if (def.kind === "monster") {
      playerBlocked.add(`${Math.round(obj.pos.x)},${Math.round(obj.pos.y)}`);
      if (obj.wanderTarget) playerBlocked.add(`${obj.wanderTarget.x},${obj.wanderTarget.y}`);
    }
  }

  for (const def of content.objects) {
    if (def.kind !== "npc" && def.kind !== "monster" && def.kind !== "critter") continue;
    const obj = state.objects[def.id];
    if (!obj || !obj.pos || !obj.available) continue;
    const isCritter = def.kind === "critter";
    // Chasing state — drives both the walk speed and the step logic below.
    if (obj.pursueUntil !== undefined && ctx.now >= obj.pursueUntil) delete obj.pursueUntil;
    const engaged = player.activity.kind === "combat" && player.activity.targetId === def.id;
    let pursuing = obj.pursueUntil !== undefined;

    // Mid-step: keep walking toward the reserved target tile.
    if (obj.wanderTarget) {
      const speed = isCritter ? WANDER.speed * 1.6
        : (engaged || pursuing) ? PURSUE_SPEED : WANDER.speed; // chasers hustle
      const reached = stepToward(obj.pos, obj.wanderTarget, (speed * dt) / 1000);
      if (reached) {
        obj.pos = { x: obj.wanderTarget.x, y: obj.wanderTarget.y };
        obj.wanderTarget = null;
        obj.nextWanderAt = ctx.now + randRange(ctx, WANDER.pauseMin, WANDER.pauseMax);
      }
      continue;
    }

    // Standing still: hold position while engaged or while the player is beside
    // us; otherwise, when the pause elapses, pick the next step.
    const here = { x: Math.round(obj.pos.x), y: Math.round(obj.pos.y) };
    const playerBeside = Math.max(Math.abs(here.x - pTile.x), Math.abs(here.y - pTile.y)) <= 1;

    // An engaged monster that can't yet reach the player closes the distance,
    // instead of standing still to be shot. A melee brute (reach 1) walks right
    // up; an archer/caster (reach >1) only advances until it's within bow-shot,
    // then holds and looses. Leashed a little past its wander radius so a bow-
    // kiting player can't trivially outrange it forever.
    const cheb = Math.max(Math.abs(here.x - pTile.x), Math.abs(here.y - pTile.y));
    const spawnCheb = Math.max(Math.abs(here.x - def.x), Math.abs(here.y - def.y));
    // End a pursuit once the player breaks far enough ahead or we've strayed too
    // far from home — then we fall through to walking back to the spawn.
    if (pursuing && (cheb > PURSUE_GIVEUP || spawnCheb > PURSUE_LEASH)) {
      delete obj.pursueUntil;
      pursuing = false;
    }
    if ((engaged || pursuing) && !isCritter) {
      const mReach = monsterFor(content, def)?.attackRange ?? 1;
      if (cheb > mReach) {
        // A pursuing chaser is off its spawn leash (up to PURSUE_LEASH); an
        // engaged-but-standing fight uses the tighter kite leash as before.
        const leash = pursuing ? PURSUE_LEASH : WANDER.radius + COMBAT.rangedReach + 2;
        const sx = Math.sign(pTile.x - here.x);
        const sy = Math.sign(pTile.y - here.y);
        for (const [nx, ny] of [[here.x + sx, here.y + sy], [here.x + sx, here.y], [here.x, here.y + sy]] as const) {
          if (nx === here.x && ny === here.y) continue;
          if (Math.max(Math.abs(nx - def.x), Math.abs(ny - def.y)) > leash) continue;
          if (!walk(nx, ny) || (nx === pTile.x && ny === pTile.y)) continue;
          if (occupied.has(`${nx},${ny}`)) continue;
          obj.wanderTarget = { x: nx, y: ny };
          occupied.add(`${nx},${ny}`);
          break;
        }
      } else {
        obj.nextWanderAt = ctx.now + WANDER.pauseMin; // in range — hold and swing
      }
      continue;
    }
    // Strayed from home on a pursuit that has now ended — head back to the spawn.
    if (!isCritter && spawnCheb > WANDER.radius) {
      const sx = Math.sign(def.x - here.x);
      const sy = Math.sign(def.y - here.y);
      for (const [nx, ny] of [[here.x + sx, here.y + sy], [here.x + sx, here.y], [here.x, here.y + sy]] as const) {
        if (nx === here.x && ny === here.y) continue;
        if (!walk(nx, ny) || (nx === pTile.x && ny === pTile.y)) continue;
        if (occupied.has(`${nx},${ny}`)) continue;
        obj.wanderTarget = { x: nx, y: ny };
        occupied.add(`${nx},${ny}`);
        break;
      }
      continue;
    }
    if (engaged || playerBeside) {
      // A startled critter bolts a step away instead of freezing.
      if (isCritter && playerBeside && !engaged) {
        const ax = here.x + (here.x === pTile.x ? (ctx.rng() < 0.5 ? 1 : -1) : Math.sign(here.x - pTile.x));
        const ay = here.y + (here.y === pTile.y ? (ctx.rng() < 0.5 ? 1 : -1) : Math.sign(here.y - pTile.y));
        for (const [nx, ny] of [[ax, here.y], [here.x, ay], [ax, ay]] as const) {
          if (Math.max(Math.abs(nx - def.x), Math.abs(ny - def.y)) > WANDER.radius + 3) continue;
          if (!walk(nx, ny) || (nx === pTile.x && ny === pTile.y)) continue;
          obj.wanderTarget = { x: nx, y: ny };
          break;
        }
        continue;
      }
      obj.nextWanderAt = ctx.now + WANDER.pauseMin;
      continue;
    }
    if (ctx.now < (obj.nextWanderAt ?? 0)) continue;

    // Candidate steps: the four neighbours, shuffled, that stay in range and are
    // free of terrain, fixed objects, the player and other creatures.
    const steps = shuffle4(ctx);
    let moved = false;
    for (const [dx, dy] of steps) {
      const nx = here.x + dx;
      const ny = here.y + dy;
      if (Math.max(Math.abs(nx - def.x), Math.abs(ny - def.y)) > WANDER.radius) continue;
      if (!walk(nx, ny)) continue;
      if (nx === pTile.x && ny === pTile.y) continue;
      if (occupied.has(`${nx},${ny}`)) continue;
      obj.wanderTarget = { x: nx, y: ny };
      occupied.add(`${nx},${ny}`); // reserve so the next creature won't pick it
      moved = true;
      break;
    }
    // Boxed in for now — try again after a short pause.
    if (!moved) obj.nextWanderAt = ctx.now + WANDER.pauseMin;
  }
}

/** Move `pos` toward `target` by up to `budget` tiles; true if it arrives. */
function stepToward(pos: Vec2, target: Vec2, budget: number): boolean {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= budget || dist < 1e-6) return true;
  pos.x += (dx / dist) * budget;
  pos.y += (dy / dist) * budget;
  return false;
}

/** Terrain + fixed-object walkability only (ignores creatures), for wandering. */
const baseWalkCache = new WeakMap<Content, (x: number, y: number) => boolean>();
function baseWalkable(content: Content): (x: number, y: number) => boolean {
  let fn = baseWalkCache.get(content);
  if (fn) return fn;
  const blocked = new Set<string>();
  for (const obj of content.objects) {
    // Wandering creatures also steer clear of agility obstacles — those tiles are
    // the player's to use, and an NPC standing on a log/net looks broken. (The
    // player's own walkability is separate, so they can still step on to use it.)
    if (BLOCKING_KINDS.has(obj.kind) || obj.kind === "agility_obstacle") blocked.add(`${obj.x},${obj.y}`);
  }
  const { map } = content;
  fn = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const tile = map.tiles[y * map.width + x];
    if (tile === "water" || tile === "mountain" || tile === "cave_wall" || tile === "deep" || tile === "wall") {
      return false;
    }
    return !blocked.has(`${x},${y}`);
  };
  baseWalkCache.set(content, fn);
  return fn;
}

const STEP4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** The four cardinal steps in a rng-shuffled order. */
function shuffle4(ctx: Ctx): Array<readonly [number, number]> {
  const a = STEP4.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(ctx.rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

/** A random integer ms in [min, max]. */
function randRange(ctx: Ctx, min: number, max: number): number {
  return min + Math.floor(ctx.rng() * (max - min + 1));
}

/** How many Trailblazer pieces are worn (0–4), for the run-energy set bonus. */
function trailPiecesWorn(player: Player): number {
  let n = 0;
  for (const slot of ["helmet", "armor", "legs", "boots"] as const) {
    if (TRAIL_PIECES.includes(player.equipment[slot] as ItemId)) n++;
  }
  return n;
}

/** Higher Agility drains run energy more slowly (harsh at lvl 1 → light at cap).
 *  The Trailblazer outfit slows it further (per piece, with a full-set bonus). */
function agilityDrainMult(player: Player): number {
  const lvl = player.skills.agility?.level ?? 1;
  const t = (lvl - 1) / (LEVEL_CAP - 1);
  const base = AGILITY_DRAIN_AT_1 + (AGILITY_DRAIN_AT_CAP - AGILITY_DRAIN_AT_1) * t;
  const worn = trailPiecesWorn(player);
  const cut = worn * TRAIL_DRAIN_PER_PIECE + (worn === 4 ? TRAIL_FULL_SET_BONUS : 0);
  return base * (1 - cut);
}

/** Higher Agility recovers run energy faster (slow at lvl 1 → fast at cap).
 *  The Trailblazer outfit speeds it further (per piece, with a full-set bonus). */
function agilityRegenMult(player: Player): number {
  const lvl = player.skills.agility?.level ?? 1;
  const t = (lvl - 1) / (LEVEL_CAP - 1);
  const base = AGILITY_REGEN_AT_1 + (AGILITY_REGEN_AT_CAP - AGILITY_REGEN_AT_1) * t;
  const worn = trailPiecesWorn(player);
  const boost = worn * TRAIL_REGEN_PER_PIECE + (worn === 4 ? TRAIL_FULL_SET_BONUS : 0);
  return base * (1 + boost);
}

/** Advance the player along their path; returns the tiles travelled while sprinting. */
function stepMovement(player: Player, dt: number): number {
  const sprinting = player.running && player.energy > 0 && !player.winded;
  const speed =
    MOVE_SPEED * (player.equipment.mount ? MOUNT_SPEED_MULT : 1) * (sprinting ? SPRINT_MULT : 1);
  const startBudget = (speed * dt) / 1000; // tiles of travel allowed this tick
  let budget = startBudget;
  while (budget > 0 && player.path.length > 0) {
    const target = player.path[0]!;
    const dx = target.x - player.pos.x;
    const dy = target.y - player.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= budget || dist < 1e-6) {
      player.pos = { x: target.x, y: target.y };
      player.path.shift();
      budget -= dist;
    } else {
      player.pos = {
        x: player.pos.x + (dx / dist) * budget,
        y: player.pos.y + (dy / dist) * budget,
      };
      budget = 0;
    }
  }
  const moved = startBudget - budget; // tiles actually walked this tick
  if (sprinting && moved > 0) {
    // The Herald's Storm-Mantle (Skyreach unique): the wind carries some of
    // your weight — running drains 30% less energy.
    const mantle = player.equipment.cape === "storm_mantle" ? 0.7 : 1;
    player.energy = Math.max(0, player.energy - moved * ENERGY_DRAIN * agilityDrainMult(player) * mantle);
    if (player.energy <= 0) player.winded = true; // out of breath — walk to recover
    return moved;
  }
  return 0;
}

function processActivity(
  state: WorldState,
  content: Content,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const act = player.activity;
  if (act.kind === "idle" || act.targetId === null) return;

  // Cooking at a player-lit campfire: the fire is transient state, not a world
  // object, so it can't be looked up in content — validate it directly and run
  // the craft loop as long as it still burns.
  if (act.kind === "crafting" && act.targetId === "campfire") {
    if (!state.campfire) {
      events.push({ type: "LOG", message: "Your fire has burnt out." });
      clearActivity(player);
      return;
    }
    if (ctx.now < act.nextActionAt) return;
    processCraft(state, content, ctx, events);
    return;
  }

  const obj = state.objects[act.targetId];
  const def = findObjectDef(content, act.targetId);
  if (!obj || !def) {
    clearActivity(player);
    return;
  }

  // Combat has two independent clocks (player + monster), so it can't use the
  // single-timer gate below — it manages its own timing.
  if (act.kind === "combat") {
    resolveCombat(state, content, def, obj, ctx, events);
    return;
  }

  if (ctx.now < act.nextActionAt) return;

  switch (act.kind) {
    case "woodcutting":
      gatherStep(state, content, obj, ctx, events, WOODCUTTING, true);
      break;
    case "mining":
      gatherStep(state, content, obj, ctx, events, MINING, true);
      break;
    case "fishing":
      gatherStep(state, content, obj, ctx, events, FISHING, false);
      break;
    case "trapping":
      gatherStep(state, content, obj, ctx, events, HUNTER, true);
      break;
    case "foraging":
      gatherStep(state, content, obj, ctx, events, FORAGE, true);
      break;
    case "crafting":
      processCraft(state, content, ctx, events);
      break;
  }
}

/**
 * One gathering "swing": roll for success, give the node's item + XP (read from
 * the action the node yields), roll any rare drop, and — for depleting nodes —
 * roll whether the node runs out. Continuous nodes (fishing) never deplete.
 */
/** Choose what a node yields this step. For a fishing spot with a catch pool,
 *  roll one fish (weighted) from those you meet the level for; otherwise the
 *  node's own action. */
function rollCatch(
  player: Player,
  content: Content,
  obj: WorldObjectState,
  fallback: SkillAction,
  ctx: Ctx,
): SkillAction {
  const def = content.objects.find((d) => d.id === obj.id);
  const pool = def?.catches;
  if (!pool || pool.length === 0) return fallback;
  const lvl = skillLvl(player, fallback.skill);
  const eligible: { a: SkillAction; w: number }[] = [];
  for (const c of pool) {
    const a = content.actions.find((x) => x.id === c.action);
    if (a && a.produces && (a.levelReq ?? 1) <= lvl) eligible.push({ a, w: c.weight });
  }
  if (eligible.length === 0) return fallback;
  let r = ctx.rng() * eligible.reduce((s, e) => s + e.w, 0);
  for (const e of eligible) { r -= e.w; if (r <= 0) return e.a; }
  return eligible[eligible.length - 1]!.a;
}

function gatherStep(
  state: WorldState,
  content: Content,
  obj: WorldObjectState,
  ctx: Ctx,
  events: WorldEvent[],
  beh: { interval: number; success: number; deplete?: number; respawn?: number },
  depletes: boolean,
): void {
  const { player } = state;
  const act = player.activity;
  const action = act.actionId
    ? content.actions.find((a) => a.id === act.actionId)
    : undefined;
  if (!action || !action.produces) {
    clearActivity(player);
    return;
  }
  if (depletes && !obj.available) {
    clearActivity(player);
    return;
  }
  // Fishing lands a catch every (tier-scaled) reel; everything else rolls a
  // success chance on a fixed tick.
  const fishing = action.skill === "fishing";
  if (fishing || ctx.rng() < beh.success) {
    // A fishing spot with a catch pool rolls one fish you meet the level for
    // (weighted) on each catch — OSRS-style mixed spots. Other nodes (and spots
    // with no pool) just yield their single action.
    const yieldAction = rollCatch(player, content, obj, action, ctx);
    if (!canAddItem(player, yieldAction.produces!)) {
      events.push({ type: "INVENTORY_FULL" });
      clearActivity(player);
      return;
    }
    grantXp(state, content, yieldAction.skill, yieldAction.xp, events);
    addItem(player, yieldAction.produces!, yieldAction.produceQty ?? 1, events);
    events.push({
      type: "LOG",
      message: `You get ${content.items[yieldAction.produces!].name}.`,
    });
    tryPetDrop(state, content, yieldAction.skill, ctx, events);
    // A node's rare drop (bird nest, gem, etc.).
    if (
      yieldAction.rareDrop &&
      ctx.rng() < yieldAction.rareDrop.chance &&
      canAddItem(player, yieldAction.rareDrop.item)
    ) {
      addItem(player, yieldAction.rareDrop.item, 1, events);
    }
    if (depletes && ctx.rng() < (beh.deplete ?? 0)) {
      obj.available = false;
      obj.respawnAt = ctx.now + (beh.respawn ?? 7000);
      const dname = content.objects.find((d) => d.id === obj.id)?.name ?? "node";
      events.push({ type: "LOG", message: `The ${dname} is worked out — it'll recover shortly.` });
      events.push({ type: "OBJECT_DEPLETED", objId: obj.id });
      clearActivity(player);
      return;
    }
  }
  // Fishing reels on a per-catch timer scaled to the spot's fish; other skills
  // use the activity interval (already adjusted for tool tier).
  act.nextActionAt = ctx.now + (fishing
    ? fishCatchInterval(action.levelReq ?? 1, ctx)
    : (act.actionInterval || beh.interval));
}

/**
 * Make one unit of the activity's recipe, then keep going. Stops cleanly when
 * the materials run out, the pack is full, or the level no longer qualifies.
 */
function processCraft(
  state: WorldState,
  content: Content,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const act = player.activity;
  const action = act.actionId
    ? content.actions.find((a) => a.id === act.actionId)
    : undefined;
  if (!action || !action.produces) {
    clearActivity(player);
    return;
  }
  if (skillLvl(player, action.skill) < action.levelReq) {
    clearActivity(player);
    return;
  }
  if (!hasIngredients(player, action)) {
    events.push({ type: "LOG", message: "You've run out of materials." });
    clearActivity(player);
    return;
  }
  if (!canAddItem(player, action.produces)) {
    events.push({ type: "INVENTORY_FULL" });
    clearActivity(player);
    return;
  }
  consumeIngredients(player, action);
  // Cooking can BURN (OSRS-style): a chance that falls with your Cooking level
  // above the recipe's requirement, reaching zero once you've mastered the dish.
  // A burn wastes the raw food (yields worthless Burnt Food) and grants no XP.
  if (action.skill === "cooking" && ctx.rng() < cookBurnChance(player, action)) {
    if (canAddItem(player, "burnt_food")) addItem(player, "burnt_food", 1, events);
    events.push({ type: "LOG", message: `You burn the ${content.items[action.produces].name}.` });
    act.nextActionAt = ctx.now + craftInterval(action);
    return;
  }
  grantXp(state, content, action.skill, action.xp, events);
  addItem(player, action.produces, action.produceQty ?? 1, events);
  events.push({
    type: "LOG",
    message: `You make ${content.items[action.produces].name}.`,
  });
  tryPetDrop(state, content, action.skill, ctx, events);
  act.nextActionAt = ctx.now + craftInterval(action);
}

// Cooking burn: highest at the recipe's own level, falling linearly to 0 once
// you're BURN_RANGE levels above it. A dish you can just barely make burns often;
// once mastered it never burns — a real reason to level Cooking.
const BURN_MAX = 0.5;    // burn chance at exactly the recipe's level
const BURN_RANGE = 32;   // levels above the requirement to reach never-burn
function cookBurnChance(player: Player, action: SkillAction): number {
  // Only meals burn — a raw-food recipe with no heal (e.g. an intermediate) or a
  // non-food cooking output shouldn't, but in practice all cooking makes food.
  const lvl = skillLvl(player, "cooking");
  const req = action.levelReq ?? 1;
  const noBurn = req + BURN_RANGE;
  if (lvl >= noBurn) return 0;
  return BURN_MAX * ((noBurn - lvl) / (noBurn - req));
}

// --- Quests --------------------------------------------------------------

/** Does any active quest's current step (talk/deliver/choice) target this NPC? */
function questStepTargets(
  player: Player,
  content: Content,
  npcId: string,
): boolean {
  for (const qid of Object.keys(player.quests)) {
    const def = content.quests.find((q) => q.id === qid);
    if (!def) continue;
    const step = def.steps[player.quests[qid]!.step];
    if (!step) continue;
    if (
      (step.type === "talk" || step.type === "deliver" || step.type === "choice") &&
      step.npc === npcId
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Decide what an NPC says when talked to, handling quest accept / progress /
 * turn-in along the way. Returns the dialogue lines to show.
 */
/** The four Trailblazer outfit pieces, in wearing order. */
const TRAIL_OUTFIT: ItemId[] = ["trail_hood", "trail_vest", "trail_legs", "trail_boots"];

/** The billboard's read-out: laps run, Marks in hand, and outfit progress. */
function trailBoardLines(player: Player, content: Content): string[] {
  const laps = player.trailLaps ?? 0;
  const marks = countItem(player, "agility_mark");
  const owns = (id: ItemId): boolean =>
    hasItem(player, id) || Object.values(player.equipment).includes(id) || (player.bank[id] ?? 0) > 0;
  const shop = content.shops.find((s) => s.id === "shop_trailkeeper");
  const setCost = shop?.stock.reduce((s, l) => s + (l.costQty ?? 0), 0) ?? 0;
  const ownedPieces = TRAIL_OUTFIT.filter(owns).length;
  const lines = [
    "— THE VARATHIAN TRAIL —",
    laps === 0 ? "No laps run yet. A single Mark waits at the end of your first."
      : `Laps run: ${laps}. Each was struck for one Agility Mark.`,
  ];
  if (ownedPieces >= TRAIL_OUTFIT.length) {
    lines.push("The full Trailblazer set is yours. Run on for the joy of it.");
  } else {
    lines.push(`Agility Marks in hand: ${marks}. The full Trailblazer set costs ${setCost} Marks (${ownedPieces}/${TRAIL_OUTFIT.length} pieces earned).`);
  }
  return lines;
}

function handleNpcTalk(
  state: WorldState,
  content: Content,
  npcDef: WorldObjectDef,
  events: WorldEvent[],
): string[] {
  const { player } = state;
  const npcId = npcDef.id;

  // 1) Progress any active quest whose CURRENT step targets THIS npc. Steps may
  //    point at any NPC, not just the quest's giver — a giver can send you to
  //    talk to, deliver to, or be questioned by someone across the map.
  for (const qid of Object.keys(player.quests)) {
    const def = content.quests.find((q) => q.id === qid);
    if (!def) continue;
    const st = player.quests[qid]!;
    const obj = def.steps[st.step];
    if (!obj) continue;
    if (obj.type === "talk" && obj.npc === npcId) {
      return advanceQuest(state, content, def, st, events);
    }
    if (obj.type === "deliver" && obj.npc === npcId) {
      if (countItem(player, obj.item) >= obj.count) {
        for (let i = 0; i < obj.count; i++) removeOneItem(player, obj.item);
        // Mark the relic handed over, so anti-softlock re-grants (a quest
        // chest's false bottom) know it reached its owner and stay shut.
        const df = `delivered_${obj.item}`;
        if (!player.flags.includes(df)) player.flags.push(df);
        return advanceQuest(state, content, def, st, events);
      }
      return [`Bring me ${obj.count} ${content.items[obj.item].name} — ${obj.text.toLowerCase()}.`];
    }
    if (obj.type === "choice" && obj.npc === npcId) {
      // Don't advance — ask the client to present the options (no dialogue box).
      // Options can be gated by flags so a finale only offers the endings the
      // player's story left open (Tier-0 fix). The client picks by index into
      // this same filtered list, so applyChoice re-filters identically.
      events.push({
        type: "QUEST_CHOICE",
        quest: qid,
        prompt: obj.prompt,
        options: visibleChoiceOptions(obj, player).map((o) => o.label),
      });
      return [];
    }
  }

  // 2) A quest from THIS giver is active, but its current step is elsewhere —
  //    nudge the player toward whatever it's asking for.
  for (const qid of Object.keys(player.quests)) {
    const def = content.quests.find((q) => q.id === qid);
    if (!def || def.giver !== npcId) continue;
    const obj = def.steps[player.quests[qid]!.step];
    if (obj) return [`You're not done yet: ${obj.text}.`];
  }

  // 3) Offer the next available quest from this NPC.
  const offer = content.quests.find((q) => q.giver === npcId && questAvailable(player, q));
  if (offer) {
    player.quests[offer.id] = { step: 0, killCount: 0 };
    events.push({ type: "QUEST_STARTED", quest: offer.id });
    events.push({ type: "LOG", message: `Quest started: ${offer.name}.` });
    return offer.intro;
  }

  // 3b) Jacob hands the Golden Rod to whoever now tops the pier's records board —
  //     in person, and only while they still hold the record. (Losing the top
  //     spot strips it automatically; see revokeGoldRodIfDethroned.)
  if (npcId === "pier_warden" && isPierLeader(player) && !ownsGoldRod(player)) {
    grantGoldRod(player, content, events);
    return [
      "Word came down the coast — your catch tops the board. The heaviest the Drowned Pier has ever weighed.",
      "Then this is yours: the Golden Rod of Varath. Hold the record and you hold the rod; lose it, and it passes to whoever beats you. Wear it well, champion.",
    ];
  }

  // 3c) Cael the Trailkeeper opens the Varathian Trail the first time you speak
  //     with him, telling its story — until then the circuit refuses you.
  if (npcId === "trail_keeper" && !player.flags.includes("trail_unlocked")) {
    player.flags.push("trail_unlocked");
    events.push({ type: "LOG", message: "The Varathian Trail is open to you. Run a full lap for a Mark." });
    return [
      "So you'd run the Varathian Trail. Good. Few finish it, fewer come back for more.",
      "It's no yard circuit — eight marks set around the whole of the country: the Spine snows, the Marrow climbs, the Redrun coast, the Estuary, the Ashfen flats, the moor, Greyoak, and home again by the northreach. Clear them in order and you've run a lap.",
      "Every lap the old wardens struck a single Mark for — one, no more, no matter how you ran it. Bring me enough of them and the Trailblazer's gear is yours: gear that a runner scarcely tires in.",
      "The path is open now. Watch the marker — it'll point you to the next leg. Off you go.",
    ];
  }

  // 3d) Cael carries the Trail's ledger himself: his talk always ends with your
  //     laps, Marks and Trailblazer progress (the billboard is now the shared
  //     standings, not an info board).
  if (npcId === "trail_keeper") {
    return [...(npcDef.lines ?? []), ...trailBoardLines(player, content)];
  }

  // 4) The world reacts: if any reactive-chatter entry's conditions are met, the
  //    NPC acknowledges what the player has done instead of the static lines.
  const reactive = pickReactiveLines(player, npcDef);
  if (reactive) return reactive;

  // 5) Otherwise, ordinary chatter.
  return npcDef.lines ?? ["..."];
}

/**
 * Pick the first reactive-chatter entry whose conditions the player currently
 * meets (flags present, flags absent, reputation floor), or null when none do.
 * Pure and order-sensitive: author later story beats before earlier ones so the
 * freshest acknowledgement wins.
 */
function pickReactiveLines(player: Player, npcDef: WorldObjectDef): string[] | null {
  const entries = npcDef.reactiveLines;
  if (!entries) return null;
  for (const e of entries) {
    if (e.requiresFlags && !e.requiresFlags.every((f) => player.flags.includes(f))) continue;
    if (e.blockedByFlags && e.blockedByFlags.some((f) => player.flags.includes(f))) continue;
    if (e.minRep && (player.reputation[e.minRep.faction] ?? 0) < e.minRep.amount) continue;
    return e.lines;
  }
  return null;
}

/**
 * Advance an active quest one step. If that finishes it, grant the reward and
 * return the outro lines; otherwise log the next objective. Returns lines for
 * dialogue (callers that aren't talking just ignore them).
 */
function advanceQuest(
  state: WorldState,
  content: Content,
  def: QuestDef,
  st: QuestState,
  events: WorldEvent[],
): string[] {
  const { player } = state;
  st.step += 1;
  st.killCount = 0;
  if (st.step >= def.steps.length) {
    grantQuestReward(state, content, def, events);
    delete player.quests[def.id];
    if (!player.questsDone.includes(def.id)) player.questsDone.push(def.id);
    events.push({ type: "QUEST_COMPLETED", quest: def.id });
    events.push({ type: "LOG", message: `Quest complete: ${def.name}!` });
    return def.outro;
  }
  events.push({ type: "QUEST_ADVANCED", quest: def.id });
  events.push({ type: "LOG", message: `${def.name}: ${def.steps[st.step]!.text}.` });
  return [`${def.steps[st.step]!.text}.`];
}

function grantQuestReward(
  state: WorldState,
  content: Content,
  def: QuestDef,
  events: WorldEvent[],
): void {
  const { player } = state;
  // Quest XP rewards now honour their skill labels (Tier-0 fix — the labels
  // used to be discarded, making a "60k Vitality / 8k Edge" reward really 68k
  // of pour-anywhere XP). A SINGLE labelled entry grants straight to that skill,
  // so quests can scaffold a specific skill's dead band. A MULTI-entry reward
  // stays a player-choice lamp, but as one honest pooled amount rather than a
  // misleading per-skill list.
  const xp = def.reward.xp ?? [];
  if (xp.length === 1) {
    grantXp(state, content, xp[0]!.skill, xp[0]!.amount, events);
  } else if (xp.length > 1) {
    const pooled = xp.reduce((n, x) => n + x.amount, 0);
    (player.xpLamps ??= []).push(pooled);
    events.push({ type: "XP_LAMP", amount: pooled, pending: player.xpLamps.length });
  }
  for (const it of def.reward.items ?? []) {
    // A reward must never be lost to a full pack — if it won't fit, bank it.
    if (canAddItem(player, it.item)) {
      addItem(player, it.item, it.qty, events);
    } else {
      player.bank[it.item] = (player.bank[it.item] ?? 0) + it.qty;
      events.push({ type: "ITEM_GAINED", item: it.item, qty: it.qty });
      events.push({ type: "LOG", message: `Your pack was full — ${content.items[it.item].name} was sent to your bank.` });
    }
  }
  for (const f of def.reward.flags ?? []) {
    if (!player.flags.includes(f)) player.flags.push(f);
  }
  if (def.reward.gold) {
    player.gold += def.reward.gold;
    player.stats.goldEarned += def.reward.gold;
    events.push({ type: "LOG", message: `You receive ${def.reward.gold}g.` });
  }
  applyRep(player, content, def.reward.rep, events);
}

/** How many distinct companion items the player owns (pack/bank/summoned). */
export function companionCount(player: Player, content: Content): number {
  const owned = new Set<ItemId>();
  for (const s of player.inventory) {
    if (s && content.items[s.item]?.slot === "companion") owned.add(s.item);
  }
  for (const id of Object.keys(player.bank) as ItemId[]) {
    if ((player.bank[id] ?? 0) > 0 && content.items[id]?.slot === "companion") owned.add(id);
  }
  if (player.equipment.companion) owned.add(player.equipment.companion);
  return owned.size;
}

/** Evaluate one achievement condition: current value, target, and met? */
export function evalAchievement(
  player: Player,
  content: Content,
  cond: AchievementCond,
): { cur: number; target: number; met: boolean } {
  const done = (cur: number, target: number) => ({ cur, target, met: cur >= target });
  const skillLevels = Object.values(player.skills).map((s) => s.level);
  switch (cond.type) {
    case "skillLevel":
      return done(skillLvl(player, cond.skill), cond.level);
    case "anySkillLevel":
      return done(Math.max(...skillLevels), cond.level);
    case "totalLevel":
      return done(skillLevels.reduce((n, l) => n + l, 0), cond.total);
    case "combatLevel":
      return done(combatLevel(player), cond.level);
    case "questDone":
      return done(player.questsDone.includes(cond.quest) ? 1 : 0, 1);
    case "flag":
      return done(player.flags.includes(cond.flag) ? 1 : 0, 1);
    case "goldEarned":
      return done(player.stats.goldEarned, cond.amount);
    case "monstersSlain":
      return done(player.stats.monstersSlain, cond.count);
    case "companions":
      return done(companionCount(player, content), cond.count);
    case "anyRepAtLeast":
      return done(Math.max(...Object.values(player.reputation)), cond.amount);
    case "bossKills":
      return done(player.bossKills[cond.boss] ?? 0, cond.count);
    case "bountyTasks":
      return done(player.bounty?.tasksDone ?? 0, cond.count);
  }
}

/** Unlock any newly-earned achievements and announce them. */
function checkAchievements(
  state: WorldState,
  content: Content,
  events: WorldEvent[],
): void {
  const { player } = state;
  for (const a of content.achievements) {
    if (player.achievements.includes(a.id)) continue;
    if (evalAchievement(player, content, a.cond).met) {
      player.achievements.push(a.id);
      events.push({ type: "ACHIEVEMENT", id: a.id, name: a.name });
      // Each achievement pays a small Hunt-Marks bounty — a real currency with a
      // rich shop, so completionism finally buys something (Tier-0 fix).
      if (player.bounty) player.bounty.marks += ACHIEVEMENT_MARKS;
      events.push({ type: "LOG", message: `Achievement unlocked: ${a.name}! (+${ACHIEVEMENT_MARKS} Hunt Marks)` });
    }
  }
  // Reward filling the collection log at quarter milestones, and hand over the
  // grandmaster completion cape once the log AND every achievement are done.
  checkCollectionMilestones(state, content, events);
  maybeGrantCompletionCape(state, content, events);
}

const ACHIEVEMENT_MARKS = 25; // Hunt Marks per achievement unlocked
// Collection-log completion pays an XP lamp at each quarter, once.
const COLLECTION_MILESTONES: { pct: number; flag: string; lamp: number }[] = [
  { pct: 25, flag: "coll_milestone_25", lamp: 10000 },
  { pct: 50, flag: "coll_milestone_50", lamp: 25000 },
  { pct: 75, flag: "coll_milestone_75", lamp: 50000 },
  { pct: 100, flag: "coll_milestone_100", lamp: 100000 },
];

/** Every item the collection log tracks (all catalogued gear/loot — the same
 *  universe the Records tab counts: catalogued, non-Quest items). */
function collectionProgress(player: Player, content: Content): { done: number; total: number } {
  const owned = new Set(player.collection ?? []);
  let done = 0, total = 0;
  for (const id of Object.keys(content.items) as ItemId[]) {
    const d = content.items[id];
    if (!d.cat || d.cat === "Quest") continue;
    total += 1;
    if (owned.has(id)) done += 1;
  }
  return { done, total };
}

/** Pay the collection-log quarter-milestone lamps (once each). */
function checkCollectionMilestones(state: WorldState, content: Content, events: WorldEvent[]): void {
  const { player } = state;
  const { done, total } = collectionProgress(player, content);
  if (total === 0) return;
  const pct = (done / total) * 100;
  for (const m of COLLECTION_MILESTONES) {
    if (pct >= m.pct && !player.flags.includes(m.flag)) {
      player.flags.push(m.flag);
      (player.xpLamps ??= []).push(m.lamp);
      events.push({ type: "XP_LAMP", amount: m.lamp, pending: player.xpLamps.length });
      events.push({ type: "LOG", message: `Collection Log ${m.pct}% complete — a lamp of ${m.lamp.toLocaleString()} XP is yours to spend.` });
    }
  }
}

/** True once the player owns cape_ironvale anywhere (equipped, pack, or bank). */
function ownsCompletionCape(player: Player): boolean {
  if (player.equipment.cape === "cape_ironvale") return true;
  if ((player.bank["cape_ironvale"] ?? 0) > 0) return true;
  return player.inventory.some((s) => s?.item === "cape_ironvale");
}

/** Grant Ironvale's Cape — the true grandmaster prize — the moment the
 *  collection log is full AND every achievement is claimed (Tier-0 fix: the
 *  cape had no code path to be earned). Banked so a full pack never loses it. */
function maybeGrantCompletionCape(state: WorldState, content: Content, events: WorldEvent[]): void {
  const { player } = state;
  if (ownsCompletionCape(player)) return;
  if (player.achievements.length < content.achievements.length) return;
  const { done, total } = collectionProgress(player, content);
  if (total === 0 || done < total) return;
  player.bank["cape_ironvale"] = (player.bank["cape_ironvale"] ?? 0) + 1;
  events.push({ type: "ITEM_GAINED", item: "cape_ironvale", qty: 1 });
  events.push({ type: "LOG", message: "You have filled the collection log and claimed every achievement. Ironvale's Cape is sent to your bank — the mark of a complete Varath." });
}

/** Adjust faction standing and announce each change. */
function applyRep(
  player: Player,
  content: Content,
  changes: RepChange[] | undefined,
  events: WorldEvent[],
): void {
  for (const c of changes ?? []) {
    player.reputation[c.faction] = (player.reputation[c.faction] ?? 0) + c.amount;
    const name = content.factions.find((f) => f.id === c.faction)?.name ?? c.faction;
    const sign = c.amount >= 0 ? "+" : "";
    events.push({ type: "LOG", message: `${name}: ${sign}${c.amount} standing.` });
  }
}

/** Is a quest offerable now (not active/done, prerequisites + flag gates met)? */
function questAvailable(player: Player, q: QuestDef): boolean {
  if (player.quests[q.id] || player.questsDone.includes(q.id)) return false;
  if (q.requires && !player.questsDone.includes(q.requires)) return false;
  if (q.requiresLevel) {
    // A skill-less level gate means COMBAT level, not summed total level — a
    // "recommended level 45" quest should gate on how tough you are, not on the
    // trivially-met sum of every skill (Tier-0 fix).
    const have = q.requiresLevel.skill
      ? skillLvl(player, q.requiresLevel.skill)
      : combatLevel(player);
    if (have < q.requiresLevel.level) return false;
  }
  if (q.requiresFlags && !q.requiresFlags.every((f) => player.flags.includes(f))) return false;
  if (q.blockedByFlags && q.blockedByFlags.some((f) => player.flags.includes(f))) return false;
  return true;
}

/** The choice options a player may actually see, after flag gating. A finale
 *  can thus offer only the endings the player's story left open (Tier-0 fix).
 *  Both the QUEST_CHOICE emit and applyChoice call this so indices always align. */
function visibleChoiceOptions(
  obj: Extract<QuestObjective, { type: "choice" }>,
  player: Player,
): QuestChoice[] {
  return obj.options.filter((o) => {
    if (o.requiresFlags && !o.requiresFlags.every((f) => player.flags.includes(f))) return false;
    if (o.blockedByFlags && o.blockedByFlags.some((f) => player.flags.includes(f))) return false;
    return true;
  });
}

/** Apply a player's pick at a quest's "choice" step, then advance the quest. */
function applyChoice(
  state: WorldState,
  content: Content,
  questId: string,
  option: number,
  events: WorldEvent[],
): void {
  const { player } = state;
  const def = content.quests.find((q) => q.id === questId);
  const st = player.quests[questId];
  if (!def || !st) return;
  const obj = def.steps[st.step];
  if (!obj || obj.type !== "choice") return;
  // Resolve the pick against the SAME flag-filtered list the client was shown,
  // so a gated finale ending can't be selected by a stale index.
  const pick = visibleChoiceOptions(obj, player)[option];
  if (!pick) return;
  // A riddle's wrong answer: speak the hint and stay on the step — the player
  // can come back and try again. Nothing else about the pick applies.
  if (pick.wrong) {
    events.push({ type: "LOG", message: pick.wrong });
    return;
  }
  for (const f of pick.flags) if (!player.flags.includes(f)) player.flags.push(f);
  // A "sell" option hands over an item for coin — only pay if it's in the pack.
  let paid = true;
  if (pick.takeItem) {
    if (countItem(player, pick.takeItem) > 0) removeOneItem(player, pick.takeItem);
    else paid = false;
  }
  if (pick.gold && paid) {
    player.gold += pick.gold;
    player.stats.goldEarned += pick.gold;
    events.push({ type: "LOG", message: `You're paid ${pick.gold}g.` });
  }
  // A choice can hand something over (an ending's cape) — banked if the pack
  // is full, so it can never be lost to a bad moment.
  if (pick.giveItem) {
    if (canAddItem(player, pick.giveItem)) addItem(player, pick.giveItem, 1, events);
    else {
      player.bank[pick.giveItem] = (player.bank[pick.giveItem] ?? 0) + 1;
      events.push({ type: "LOG", message: `${content.items[pick.giveItem].name} was sent to your bank.` });
    }
  }
  applyRep(player, content, pick.rep, events);
  if (pick.reply) events.push({ type: "LOG", message: pick.reply });
  advanceQuest(state, content, def, st, events);
}

/** A kill counts toward any active quest hunting that monster. */
function advanceKillQuests(
  state: WorldState,
  content: Content,
  monster: string | undefined,
  events: WorldEvent[],
): void {
  if (!monster) return;
  const { player } = state;
  for (const qid of Object.keys(player.quests)) {
    const def = content.quests.find((q) => q.id === qid);
    if (!def) continue;
    const st = player.quests[qid]!;
    const obj = def.steps[st.step];
    if (!obj || obj.type !== "kill" || obj.monster !== monster) continue;
    st.killCount += 1;
    if (st.killCount >= obj.count) {
      advanceQuest(state, content, def, st, events);
    } else {
      events.push({
        type: "LOG",
        message: `${obj.text}: ${st.killCount}/${obj.count}.`,
      });
    }
  }
}

// --- Bounty: a slay-task board, ported from the idle game's bounty loop -------

/** OSRS-style hunt-tool gates: quarry that can't be harmed without the right
 *  ware from a guide's shop. The consumable is spent on EACH kill; the
 *  mastery unlock (dear, permanent) retires the consumable forever. */
export const HUNT_GATES: Record<string, { item: ItemId; unlock: string; toolName: string }> = {
  hollow_hound: { item: "flensing_hook", unlock: "flensing_mastery", toolName: "Flensing Hook" },
  iron_maw: { item: "maw_spike", unlock: "spike_mastery", toolName: "Maw-Spike" },
};

/** Twin Marks unlock: this share of on-task kills counts double. */
const TWIN_MARKS_CHANCE = 0.12;
/** The Tracker (the Bounty skilling pet) only ever appears mid-hunt: each
 *  counting kill is a slim roll. On-task kills are far scarcer than gather
 *  actions, so the odds sit between a boss pet (1/500) and a gather pet. */
const TRACKER_PET_CHANCE = 1 / 10_000;

/** A kill counts toward the active bounty task if it targets that monster.
 *  On-task kills are where Bounty LIVES: each one trickles Bounty XP (so the
 *  skill trains while you hunt, not only at the board), can count double with
 *  Twin Marks, and is the only roll for the Tracker pet. */
function trackBountyKill(
  state: WorldState,
  content: Content,
  monster: string | undefined,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  if (!monster) return;
  const { player } = state;
  const task = player.bounty.task;
  if (!task || task.monster !== monster) return;
  if (task.progress >= task.required) return; // already done; don't overcount
  const twin = player.bounty.unlocks.includes("twin_marks") && ctx.rng() < TWIN_MARKS_CHANCE;
  task.progress = Math.min(task.required, task.progress + (twin ? 2 : 1));
  // The trickle: ~35% of the task's XP is paid across the kills themselves,
  // the rest (the full listed reward) still lands on claim.
  grantXp(state, content, "bounty", Math.max(4, Math.round((task.xp * 0.35) / task.required)), events);
  // The Tracker: a silent companion that only the hunt can turn up.
  if (ctx.rng() < TRACKER_PET_CHANCE && !ownsItem(player, "pet_bounty") && canAddItem(player, "pet_bounty")) {
    addItem(player, "pet_bounty", 1, events);
    events.push({ type: "COMPANION_FOUND", item: "pet_bounty" });
    events.push({ type: "LOG", message: `A companion has found you: ${content.items["pet_bounty"]?.name ?? "Tracker"}!` });
  }
  const name = content.monsters[monster]?.name ?? monster;
  const twinNote = twin ? " (Twin Marks — it counts twice!)" : "";
  if (task.progress >= task.required) {
    events.push({ type: "LOG", message: `Bounty complete${twinNote} — see any guide to claim it.` });
  } else {
    events.push({ type: "LOG", message: `Bounty: ${task.progress}/${task.required} ${name}.${twinNote}` });
  }
}

/** Take a fresh task from a guide: roll its zone pool, filtered by Bounty level. */
function takeBountyTask(
  state: WorldState,
  content: Content,
  guideId: string,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  // Don't reassign the active guide while a task is live — the contract stays
  // pinned to whoever issued it, so switching the highlighted guide (or walking
  // up to a different guide's NPC) can never orphan an in-progress bounty.
  if (player.bounty.task) {
    events.push({ type: "LOG", message: "Finish or abandon your current task first." });
    return;
  }
  player.bounty.guideId = guideId;
  const guide = content.bountyGuides.find((g) => g.id === guideId);
  if (!guide) return;
  const level = skillLvl(player, "bounty");
  if (level < guide.levelReq) {
    events.push({ type: "LOG", message: `${guide.name} won't deal with you until Bounty ${guide.levelReq}.` });
    return;
  }
  const pool: BountyTaskDef[] = [];
  const cl = combatLevel(player);
  let heldByCombat = 0; // templates your Bounty rank earned but your arm can't cash
  for (const zone of guide.zones) {
    for (const t of content.bountyTasks[zone] ?? []) {
      if (level < t.minLevel) continue;
      // OSRS-style: a guide sizes you up before writing your name — no
      // contract for quarry far beyond your combat level.
      const mLvl = content.monsters[t.monster]?.level ?? 1;
      if (mLvl > cl + 10) { heldByCombat++; continue; }
      // Boss bounties are gated behind their unlock quest — never assign a task
      // for a boss the hunter can't yet reach.
      if (t.requiresFlag && !player.flags.includes(t.requiresFlag)) continue;
      // Blocked monsters are never rolled.
      if (player.bounty.blocked.includes(t.monster)) continue;
      pool.push(t);
    }
  }
  if (pool.length === 0) {
    // Tell the hunter WHICH wall they hit: rank, or arm.
    events.push({
      type: "LOG",
      message: heldByCombat > 0
        ? `${guide.name} closes the ledger. "Your rank's earned the work, but not the arm to do it — the quarry I post would kill you. Train your combat and come back."`
        : `${guide.name} has nothing at your Bounty rank — train it up, or see a lower-tier guide.`,
    });
    return;
  }
  const pick = pool[Math.floor(ctx.rng() * pool.length)]!;
  const xp = Math.round(pick.xp * guide.xpMult);
  // The veteran's cut: a proven hunter's name is worth more on a contract.
  // Bounty 50/75/90 raise every task's marks by 10/20/30%.
  const vet = level >= 90 ? 1.3 : level >= 75 ? 1.2 : level >= 50 ? 1.1 : 1;
  const marks = Math.round(pick.marks * guide.marksMult * vet);
  player.bounty.task = {
    monster: pick.monster,
    required: pick.required,
    progress: 0,
    xp,
    marks,
    guideId,
  };
  // Remember the assignment (newest first, distinct, capped) so it can be
  // blocked later from the ledger without holding it again.
  player.bounty.history = [pick.monster, ...player.bounty.history.filter((m) => m !== pick.monster)].slice(0, 10);
  const name = content.monsters[pick.monster]?.name ?? pick.monster;
  // The guide names the quarry's ground, OSRS-Slayer style: you're told WHERE
  // to hunt, and the maps ring that ground while the task is live.
  const ground = content.huntingGrounds[pick.monster];
  const where = ground ? ` You'll find them at ${ground.name} — ${ground.hint}.` : "";
  events.push({ type: "LOG", message: `${guide.name}: slay ${pick.required} ${name}.${where}` });
}

/** Milestone claims, OSRS-Slayer style: the Nth lifetime task pays a marks
 *  multiplier — every 100th ×10, every 50th ×6, every 10th ×3. */
export function bountyMilestoneMult(nthTask: number): number {
  if (nthTask <= 0) return 1;
  if (nthTask % 100 === 0) return 10;
  if (nthTask % 50 === 0) return 6;
  if (nthTask % 10 === 0) return 3;
  return 1;
}

/** Claim a finished task: pay Hunt Marks + Bounty XP (Hunter's Kit boosts XP).
 *  Marks stack four ways: milestone claims multiply, the first claim of each
 *  real day doubles, and the hunt streak adds up to +50% (+100% with the
 *  Reckoner's Favour) — so steady hunters get rich and lapsed ones get a
 *  reason to come back to the board. */
function claimBountyTask(
  state: WorldState,
  content: Content,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const task = player.bounty.task;
  if (!task) {
    events.push({ type: "LOG", message: "You have no bounty to claim." });
    return;
  }
  if (task.progress < task.required) {
    const name = content.monsters[task.monster]?.name ?? task.monster;
    events.push({ type: "LOG", message: `Not yet — ${task.required - task.progress} more ${name} to go.` });
    return;
  }
  // A Hunter's Kit in the pack sweetens the XP and is consumed on claim.
  const hasKit = hasItem(player, "hunters_kit");
  const xp = hasKit ? Math.round(task.xp * 1.5) : task.xp;
  if (hasKit) removeOneItem(player, "hunters_kit");
  // Hunt streak: each consecutive claim (past the first) pays escalating bonus
  // marks, +5% per streak. Abandoning a task breaks the streak.
  player.bounty.streak += 1;
  player.bounty.tasksDone += 1;
  const streakCap = player.bounty.unlocks.includes("reckoners_favour") ? 20 : 10;
  const streakPct = Math.min(player.bounty.streak - 1, streakCap) * 0.05;
  const streakBonus = Math.round(task.marks * streakPct);
  // Milestone: the 10th/50th/100th lifetime task pays a multiplier.
  const mult = bountyMilestoneMult(player.bounty.tasksDone);
  const milestoneBonus = task.marks * (mult - 1);
  // Daily: the first claim in any rolling 20 hours pays double base marks —
  // OSRS-style, keyed to your own play rhythm rather than a UTC midnight that
  // could be straddled for two doubles minutes apart. (The field keeps its old
  // save key; pre-window saves hold a small day-index, which reads as "long
  // ago" and simply grants one fresh daily.)
  const epochNow = ctx.epoch ?? 0;
  const daily = epochNow > 0 && epochNow - (player.bounty.lastClaimDay ?? 0) >= DAILY_WINDOW_MS;
  if (daily) player.bounty.lastClaimDay = epochNow;
  const dailyBonus = daily ? task.marks : 0;
  // The Cape of Varath lends +25% to the whole Hunt-Marks payout.
  const subtotal = task.marks + streakBonus + milestoneBonus + dailyBonus;
  const capeBonus = varathCapeWorn(player) ? Math.round(subtotal * 0.25) : 0;
  player.bounty.marks += subtotal + capeBonus;
  player.bounty.task = null;
  grantXp(state, content, "bounty", xp, events);
  const kitNote = hasKit ? " (Hunter's Kit bonus)" : "";
  const streakNote = streakBonus > 0 ? ` · streak ×${player.bounty.streak}: +${streakBonus}` : "";
  const mileNote = mult > 1 ? ` · task #${player.bounty.tasksDone} milestone: +${milestoneBonus}` : "";
  const dayNote = daily ? ` · first hunt of the day: +${dailyBonus}` : "";
  events.push({
    type: "LOG",
    message: `Bounty claimed! +${task.marks} Hunt Marks · +${xp} Bounty XP${kitNote}${streakNote}${mileNote}${dayNote}.`,
  });
}

/** Abandon the current task — no reward, and the hunt streak resets. */
function abandonBountyTask(player: Player, events: WorldEvent[]): void {
  if (!player.bounty.task) return;
  player.bounty.task = null;
  const hadStreak = player.bounty.streak > 0;
  player.bounty.streak = 0;
  events.push({
    type: "LOG",
    message: hadStreak ? "Bounty abandoned — your hunt streak is broken." : "Bounty abandoned.",
  });
}

/** Spend Hunt Marks at the Bounty board's shop. */
function buyBountyItem(
  player: Player,
  content: Content,
  item: ItemId,
  events: WorldEvent[],
): void {
  const line = content.bountyShop.find((l) => l.item === item);
  if (!line) return;
  if (player.bounty.marks < line.cost) {
    events.push({ type: "LOG", message: `You need ${line.cost} Hunt Marks for that.` });
    return;
  }
  if (!canAddItem(player, item)) {
    events.push({ type: "INVENTORY_FULL" });
    return;
  }
  player.bounty.marks -= line.cost;
  addItem(player, item, line.qty, events);
  events.push({ type: "LOG", message: `Bought ${content.items[item]?.name ?? item}.` });
}

/** Hunt Marks to skip (reroll) the current task without breaking the streak. */
const BOUNTY_SKIP_COST = 30;
/** Block slots: a base allotment, widened by the "wider_net" unlock. */
const BLOCK_SLOTS_BASE = 3;
const BLOCK_SLOTS_WIDE = 6;
function blockCap(player: Player): number {
  return player.bounty.unlocks.includes("wider_net") ? BLOCK_SLOTS_WIDE : BLOCK_SLOTS_BASE;
}

/** Skip the current task for a Hunt-Marks fee — a fresh one can be taken, and
 *  the hunt streak survives (unlike an abandon). */
function skipBountyTask(player: Player, content: Content, events: WorldEvent[]): void {
  const task = player.bounty.task;
  if (!task) { events.push({ type: "LOG", message: "You have no task to skip." }); return; }
  if (player.bounty.marks < BOUNTY_SKIP_COST) {
    events.push({ type: "LOG", message: `Skipping a task costs ${BOUNTY_SKIP_COST} Hunt Marks.` });
    return;
  }
  const name = content.monsters[task.monster]?.name ?? task.monster;
  player.bounty.marks -= BOUNTY_SKIP_COST;
  player.bounty.task = null;
  events.push({ type: "LOG", message: `Task skipped (−${BOUNTY_SKIP_COST} Marks). Your ${name} hunt is off the books; take a new one.` });
}

/** Block the current task's monster — never assigned again — using a block slot.
 *  Clears the task (streak survives) so a fresh one can be taken. */
function blockBountyTask(player: Player, content: Content, monster: string | undefined, events: WorldEvent[]): void {
  const task = player.bounty.task;
  // Blocking a RECENT assignment (from the ledger's history row) needs no live
  // task and cancels nothing — unless it names the task you're holding.
  if (monster !== undefined) {
    if (!player.bounty.history.includes(monster)) return;
    if (player.bounty.blocked.includes(monster)) return;
    if (player.bounty.blocked.length >= blockCap(player)) {
      events.push({ type: "LOG", message: `Your block list is full (${blockCap(player)}).` });
      return;
    }
    player.bounty.blocked.push(monster);
    if (task?.monster === monster) player.bounty.task = null;
    events.push({ type: "LOG", message: `${content.monsters[monster]?.name ?? monster} blocked — you'll never be sent after them again.` });
    return;
  }
  if (!task) { events.push({ type: "LOG", message: "You have no task to block." }); return; }
  if (player.bounty.blocked.includes(task.monster)) { player.bounty.task = null; return; }
  if (player.bounty.blocked.length >= blockCap(player)) {
    events.push({ type: "LOG", message: `Your block list is full (${blockCap(player)}). Un-block a monster first${player.bounty.unlocks.includes("wider_net") ? "" : ", or buy the Warden's Ledger for more slots"}.` });
    return;
  }
  const name = content.monsters[task.monster]?.name ?? task.monster;
  player.bounty.blocked.push(task.monster);
  player.bounty.task = null;
  events.push({ type: "LOG", message: `${name} blocked — you'll never be sent after them again.` });
}

/** Remove a monster from the block list, freeing its slot. */
function unblockBountyMonster(player: Player, content: Content, monster: string, events: WorldEvent[]): void {
  const i = player.bounty.blocked.indexOf(monster);
  if (i < 0) return;
  player.bounty.blocked.splice(i, 1);
  const name = content.monsters[monster]?.name ?? monster;
  events.push({ type: "LOG", message: `${name} un-blocked — they can be assigned again.` });
}

/** Buy a permanent Hunt-Marks unlock (owned forever). */
function buyBountyUnlock(player: Player, content: Content, id: string, events: WorldEvent[]): void {
  const unlock = content.bountyUnlocks.find((u) => u.id === id);
  if (!unlock) return;
  if (player.bounty.unlocks.includes(id)) { events.push({ type: "LOG", message: "You already own that unlock." }); return; }
  // The Hunter's Eye sharpens Superior odds — it's meaningless without Superiors.
  if (id === "keen_eye" && !player.bounty.unlocks.includes("superior")) {
    events.push({ type: "LOG", message: "Unlock Bigger & Badder first — there are no Superiors to spot yet." });
    return;
  }
  if (player.bounty.marks < unlock.cost) {
    events.push({ type: "LOG", message: `${unlock.name} costs ${unlock.cost} Hunt Marks.` });
    return;
  }
  player.bounty.marks -= unlock.cost;
  player.bounty.unlocks.push(id);
  events.push({ type: "LOG", message: `Unlocked: ${unlock.name}!` });
}

/** Superior encounters: while on a task and owning "superior", each on-task kill
 *  has a slim chance to be a Superior — a burst of bonus Marks + Bounty XP, and a
 *  rarer shot at an ultra-rare Hunter's trophy dropped where the creature fell. */
const SUPERIOR_ODDS = 100;            // ~1/100 on-task kills (…/65 with keen_eye)
const SUPERIOR_ODDS_KEEN = 65;
const SUPERIOR_HP_MULT = 2.2;         // the risen fight is a real fight
const SUPERIOR_UNIQUE_ODDS = 12;      // …of Superiors yield an ultra-rare (~1/1200 base)
const SUPERIOR_UNIQUES: ItemId[] = ["reckoners_charm", "pet_superior"];

/** After an ordinary on-task kill: maybe raise the corpse as a SUPERIOR — a
 *  visibly bigger, far tougher second fight that stands straight back up and
 *  re-engages. Killing THAT is what pays (see paySuperiorBounty). */
function rollSuperiorRise(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  obj: WorldObjectState,
  ctx: Ctx,
  events: WorldEvent[],
): boolean {
  const { player } = state;
  const task = player.bounty.task;
  if (!def.monster || !task || task.monster !== def.monster) return false;
  if (!player.bounty.unlocks.includes("superior")) return false;
  const odds = player.bounty.unlocks.includes("keen_eye") ? SUPERIOR_ODDS_KEEN : SUPERIOR_ODDS;
  if (ctx.rng() >= 1 / odds) return false;
  const stats = monsterFor(content, def);
  if (!stats) return false;
  obj.available = true;
  obj.superior = true;
  obj.hp = Math.round(stats.hp * SUPERIOR_HP_MULT);
  // It gets straight back up and comes for you.
  const pSpeed = playerSpeed(player, content);
  player.activity = { kind: "combat", targetId: def.id, actionId: null, nextActionAt: ctx.now + pSpeed, actionInterval: pSpeed };
  obj.nextAttackAt = ctx.now + Math.floor((stats.speed ?? COMBAT.monsterSpeed) / 2);
  events.push({ type: "LOG", message: `The ${stats.name} RISES — a Superior, half again its size and twice as angry!` });
  return true;
}

/** A slain Superior pays its burst of Marks + Bounty XP — and rolls the
 *  ultra-rare trophy into the PACK (bank on overflow), never onto the floor
 *  where the despawn timer could eat a once-a-playthrough item. */
function paySuperiorBounty(
  state: WorldState,
  content: Content,
  monster: string,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const task = player.bounty.task;
  const name = content.monsters[monster]?.name ?? monster;
  const bonusMarks = Math.max(30, Math.round((task?.marks ?? 60) * 0.4));
  const bonusXp = Math.max(200, Math.round((task?.xp ?? 400) * 0.5));
  player.bounty.marks += bonusMarks;
  grantXp(state, content, "bounty", bonusXp, events);
  if (!player.flags.includes("slew_superior")) player.flags.push("slew_superior"); // first-Superior achievement
  events.push({ type: "LOG", message: `The Superior ${name} falls! +${bonusMarks} Hunt Marks · +${bonusXp} Bounty XP.` });
  if (ctx.rng() < 1 / SUPERIOR_UNIQUE_ODDS) {
    const unique = SUPERIOR_UNIQUES[Math.floor(ctx.rng() * SUPERIOR_UNIQUES.length)]!;
    if (canAddItem(player, unique)) {
      addItem(player, unique, 1, events);
    } else {
      player.bank[unique] = (player.bank[unique] ?? 0) + 1;
      events.push({ type: "LOG", message: "Your pack is full — the trophy is sent to your bank." });
    }
    events.push({ type: "LOG", message: `The Superior leaves something behind: ${content.items[unique]?.name ?? unique}!` });
  }
}

/** Auto-advance any passive objective ("gather" / "reach") now satisfied. */
function checkGatherQuests(
  state: WorldState,
  content: Content,
  events: WorldEvent[],
): void {
  const { player } = state;
  for (const qid of Object.keys(player.quests)) {
    const def = content.quests.find((q) => q.id === qid);
    if (!def) continue;
    const st = player.quests[qid]!;
    const obj = def.steps[st.step];
    if (!obj) continue;
    if (obj.type === "gather" && countItem(player, obj.item) >= obj.count) {
      advanceQuest(state, content, def, st, events);
    } else if (obj.type === "reach" && skillLvl(player, obj.skill) >= obj.level) {
      advanceQuest(state, content, def, st, events);
    } else if (
      obj.type === "visit" &&
      Math.hypot(player.pos.x - obj.x, player.pos.y - obj.y) <= (obj.radius ?? 3)
    ) {
      advanceQuest(state, content, def, st, events);
    } else if (obj.type === "claim" && ownsAnyPlot(state)) {
      advanceQuest(state, content, def, st, events);
    } else if (obj.type === "build" && hasBuilt(state, content, obj.category)) {
      advanceQuest(state, content, def, st, events);
    } else if (obj.type === "learn" && hasLearned(state, obj.system)) {
      advanceQuest(state, content, def, st, events);
    }
  }
}

/** True once the player has met a core system for the first time — used by the
 *  "learn" teaching objective. Bank/exchange read the live station the player is
 *  standing at; cook/faith read whether the skill has earned any XP at all (a
 *  fresh skill sits at 0), so the step blocks only someone who has genuinely
 *  never cooked or trained Faith and clears itself for anyone who already has. */
function hasLearned(
  state: WorldState,
  system: "bank" | "exchange" | "cook" | "faith",
): boolean {
  const { player } = state;
  switch (system) {
    case "bank":
      return player.station?.kind === "bank";
    case "exchange":
      return player.station?.kind === "exchange";
    case "cook":
      return (player.skills.cooking?.xp ?? 0) > 0;
    case "faith":
      return (player.skills.faith?.xp ?? 0) > 0;
  }
}

/** True once the player has claimed any homestead plot. */
function ownsAnyPlot(state: WorldState): boolean {
  return Object.values(state.objects).some((o) => o.owned);
}

/** True once the player has built a piece (optionally of `category`) for their
 *  home — placed in a room or waiting in home storage. Reads the free-placement
 *  model (player.home), so a quest "build a bed" step completes the moment the
 *  bed is crafted or set down. */
function hasBuilt(state: WorldState, content: Content, category?: string): boolean {
  const { home } = state.player;
  const match = (id: string): boolean => !category || content.furniture[id]?.category === category;
  for (const p of home.placed) if (match(p.item)) return true;
  for (const [id, n] of Object.entries(home.storage)) if ((n ?? 0) > 0 && match(id)) return true;
  return false;
}

// --- Combat math, ported faithfully from the idle game (CANON_LEDGER 1e) -----

/** A skill's current level (1 if somehow absent). */
function skillLvl(player: Player, skill: SkillId): number {
  return player.skills[skill]?.level ?? 1;
}

/** The attack style of the worn main-hand weapon (slash/stab/crush), if any. */
function weaponStyle(player: Player, content: Content): string | undefined {
  const id = player.equipment.mainhand;
  return id ? content.items[id].attackStyle : undefined;
}

/**
 * Player accuracy rating: Edge + summed gear acc (weapon, ring, amulet), then
 * re-weighted by the live combat stance (Accurate lands more; Defensive less).
 * equipStat sums the field across every worn item, and only weapons/rings/
 * amulets carry `acc`, so the base matches the idle game's sum.
 */
function playerAccuracy(player: Player, content: Content): number {
  const cape = varathCapeWorn(player) ? 5 : 0; // Cape of Varath: +5 Edge
  const base = skillLvl(player, "edge") + equipStat(player, content, "acc") + cape + buffVal(player, "melee_acc");
  return Math.max(1, Math.round(base * STYLE_MODS[player.combatStyle].acc));
}

/** Max Hitpoints at a given Vitality level — the skill-info milestone maths
 *  (kept beside the combat formulas it mirrors). */
export function vitalityMaxHp(level: number): number {
  return BASE_MAX_HP + level;
}

/** The bare-handed melee max hit a Vigour level carries; weapons, amulets and
 *  the Vigour style add on top. Skill-info milestone maths. */
export function vigourBaseHit(level: number): number {
  return Math.max(1, Math.round(level * COMBAT.dmgSkillScale));
}

/** Player max hit: Vigour + summed gear dmg (weapon, amulet), re-weighted by the
 *  live stance (Aggressive hits harder; Accurate and Defensive trade damage away). */
function playerMaxHit(player: Player, content: Content): number {
  const str = Math.round(skillLvl(player, "vigour") * COMBAT.dmgSkillScale);
  const cape = varathCapeWorn(player) ? 5 : 0; // Cape of Varath: +5 Vigour
  const base = str + equipStat(player, content, "dmg") + cape + buffVal(player, "melee_dmg");
  return Math.max(1, Math.round(base * STYLE_MODS[player.combatStyle].dmg));
}

/** The bow the player is wielding, if any — a ranged weapon worn in the mainhand. */
function equippedBow(player: Player, content: Content): ItemId | undefined {
  const id = player.equipment.mainhand;
  return id && content.items[id]?.ranged ? id : undefined;
}

/** Is the player set to fight at range? (a bow wielded in the mainhand). */
function isRanged(player: Player, content: Content): boolean {
  return !!equippedBow(player, content);
}

/** Ranged accuracy: Draw + bow + arrow accuracy + any ranged-accuracy buff. */
function rangedAccuracy(player: Player, content: Content): number {
  const bow = equippedBow(player, content);
  const ammo = player.equipment.ammo;
  const ba = bow ? content.items[bow].acc ?? 0 : 0;
  const aa = ammo ? content.items[ammo].acc ?? 0 : 0;
  const cape = varathCapeWorn(player) ? 5 : 0; // Cape of Varath: +5 Draw
  return skillLvl(player, "draw") + ba + aa + equipStat(player, content, "rngAcc") + cape + buffVal(player, "ranged_acc");
}

/** Ranged max hit: Draw + bow + arrow damage + any ranged-damage buff. */
function rangedMaxHit(player: Player, content: Content): number {
  const bow = equippedBow(player, content);
  const ammo = player.equipment.ammo;
  const bd = bow ? content.items[bow].dmg ?? 0 : 0;
  const ad = ammo ? content.items[ammo].dmg ?? 0 : 0;
  const str = Math.round(skillLvl(player, "draw") * COMBAT.dmgSkillScale);
  const cape = varathCapeWorn(player) ? 5 : 0; // Cape of Varath: +5 Draw
  return str + bd + ad + equipStat(player, content, "rngDmg") + cape + buffVal(player, "ranged_dmg");
}

/** The casting staff the player is wielding, if any (a magic weapon in mainhand). */
function equippedStaff(player: Player, content: Content): ItemId | undefined {
  const id = player.equipment.mainhand;
  return id && content.items[id]?.magic ? id : undefined;
}

/** Is the player set to fight with magic? (a staff wielded in the mainhand). */
function isMagic(player: Player, content: Content): boolean {
  return !!equippedStaff(player, content);
}

/** The player's Grace ceiling — their Faith level, floored at 10 so a new caster
 *  can get a few casts off before Faith is trained. */
function graceMax(player: Player): number {
  // A real combat resource: start with a 30-Grace pool so Devotion is a style you
  // can fight with (≈10 Sparks / 5 Emberbolts before you drop to the free bolt),
  // not a three-cast novelty. Each Devotion level adds two more, so the pool keeps
  // pace as the spells get costlier — level 50 = 128, level 100 = 228.
  return 28 + 2 * Math.max(1, skillLvl(player, "faith"));
}

/** Magic accuracy: Faith + staff acc + any magic-accuracy buff. */
function magicAccuracy(player: Player, content: Content): number {
  const st = equippedStaff(player, content);
  const sa = st ? content.items[st].acc ?? 0 : 0;
  return skillLvl(player, "faith") + sa + equipStat(player, content, "magAcc") + buffVal(player, "magic_acc");
}

/** Magic max hit: Faith + staff dmg + any magic-damage buff. */
function magicMaxHit(player: Player, content: Content): number {
  const st = equippedStaff(player, content);
  const sd = st ? content.items[st].dmg ?? 0 : 0;
  const str = Math.round(skillLvl(player, "faith") * COMBAT.dmgSkillScale);
  return str + sd + equipStat(player, content, "magDmg") + buffVal(player, "magic_dmg");
}

/** Player defence rating: Ward + summed armour defence (+ any Defence buff),
 *  then boosted while in the Defensive stance — the tank tradeoff (T1·06). */
function playerDefence(player: Player, content: Content): number {
  const cape = varathCapeWorn(player) ? 5 : 0; // Cape of Varath: +5 Ward
  const base = skillLvl(player, "ward") + equipStat(player, content, "def") + cape + buffVal(player, "defence");
  return Math.round(base * STYLE_MODS[player.combatStyle].def);
}

/**
 * Snapshot a player for the duel ring (see duelCore.ts). Taken the moment
 * stakes lock, so the fight is sealed against mid-duel gear or bank tricks:
 * accuracy/damage/defence through the SAME formulas PvE uses (style bonus,
 * gear sums, live potion buffs), weapon cadence in duel ticks, and the pack's
 * food as a satchel of bites. Both clients exchange these snapshots and then
 * only ever exchange intents.
 */
export function duelFighterFrom(player: Player, content: Content): import("./duelCore.ts").DuelFighter {
  const food: { item: ItemId; heal: number; count: number }[] = [];
  const bench: ItemId[] = [];
  for (const slot of player.inventory) {
    if (!slot) continue;
    const def = content.items[slot.item];
    const heals = def?.heals ?? 0;
    if (heals > 0) {
      const ex = food.find((f) => f.item === slot.item);
      if (ex) ex.count += slot.qty;
      else food.push({ item: slot.item, heal: heals, count: slot.qty });
    }
    // Equippable combat gear carried into the ring becomes the switch pool
    // (arrows/mounts/companions aren't swap targets in a stationary duel).
    const eslot = def?.slot;
    if (eslot && EQUIP_SLOTS.has(eslot) && eslot !== "ammo" && eslot !== "mount" && eslot !== "companion") {
      for (let i = 0; i < slot.qty; i++) bench.push(slot.item);
    }
  }
  const kit: import("./duelCore.ts").DuelKit = {
    skills: player.skills,
    combatStyle: player.combatStyle,
    buffs: player.buffs,
  };
  const stats = duelStatsFor(kit, player.equipment, content);
  return {
    name: player.appearance.name,
    look: player.appearance,
    equipment: { ...player.equipment },
    combatLevel: combatLevel(player),
    maxHp: player.maxHp,
    ...stats,
    food,
    bench,
    kit,
  };
}

/** Re-derive a fighter's combat stats from a frozen kit + a worn-gear set — the
 *  SAME formulas duelFighterFrom uses, factored out so a mid-fight gear swap
 *  recomputes identically on both clients (see duelCore's DuelKit). */
export function duelStatsFor(
  kit: import("./duelCore.ts").DuelKit,
  equipment: Partial<Record<EquipSlot, ItemId>>,
  content: Content,
): { acc: number; dmg: number; def: number; speedTicks: number; ranged: boolean } {
  // A stub with only the fields the combat formulas read (skills/equipment/
  // style/buffs). Cast is safe: playerAccuracy et al. touch nothing else.
  const stub = { skills: kit.skills, equipment, combatStyle: kit.combatStyle, buffs: kit.buffs } as unknown as Player;
  const ranged = isRanged(stub, content);
  return {
    acc: ranged ? rangedAccuracy(stub, content) : playerAccuracy(stub, content),
    dmg: ranged ? rangedMaxHit(stub, content) : playerMaxHit(stub, content),
    def: playerDefence(stub, content),
    speedTicks: Math.max(3, Math.round(playerSpeed(stub, content) / 600)),
    ranged,
  };
}

/**
 * Wear a bench piece mid-duel, mirroring the pack-equip rules (slot target,
 * level requirement, two-hand conflicts) but moving displaced gear back to the
 * bench instead of the pack. Pure and deterministic: both clients run it on
 * identical inputs, so the resulting worn set — and the recomputed stats — match.
 * Returns null if the swap is illegal (wrong slot, level too low, not on bench).
 */
export function duelEquip(
  bench: ItemId[],
  equipment: Partial<Record<EquipSlot, ItemId>>,
  kit: import("./duelCore.ts").DuelKit,
  item: ItemId,
  content: Content,
): { bench: ItemId[]; equipment: Partial<Record<EquipSlot, ItemId>> } | null {
  const def = content.items[item];
  const eslot = def?.slot;
  if (!eslot || !EQUIP_SLOTS.has(eslot) || eslot === "ammo" || eslot === "mount" || eslot === "companion") return null;
  const idx = bench.indexOf(item);
  if (idx === -1) return null; // must be carried into the ring
  // Honour the wield requirement against the frozen kit's skills.
  const req = equipRequirement(content, item);
  if (req && (kit.skills[req.skill]?.level ?? 1) < req.level) return null;

  const target = eslot as EquipSlot;
  const nextBench = bench.slice();
  nextBench.splice(idx, 1);
  const nextEquip = { ...equipment };
  const stow = (id: ItemId | undefined): void => { if (id) nextBench.push(id); };
  // Two-hand conflicts, same as the pack equip: a two-hander clears the offhand;
  // an offhand clears a worn two-hander.
  if (target === "mainhand" && def.twoHand) stow(nextEquip.offhand), delete nextEquip.offhand;
  if (target === "offhand" && nextEquip.mainhand && content.items[nextEquip.mainhand]?.twoHand) {
    stow(nextEquip.mainhand); delete nextEquip.mainhand;
  }
  stow(nextEquip[target]);   // whatever was in the slot goes back to the bench
  nextEquip[target] = item;
  return { bench: nextBench, equipment: nextEquip };
}

/** The player's swing interval (ms): the active weapon's speed, or default. */
function playerSpeed(player: Player, content: Content): number {
  const id = player.equipment.mainhand;
  const speed = id ? content.items[id].speed : undefined;
  return speed || COMBAT.playerMeleeSpeed;
}

/** Keep max HP = base + Vitality level; growing it tops up current HP too. */
function syncMaxHp(player: Player): void {
  const m = BASE_MAX_HP + skillLvl(player, "vitality") + (varathCapeWorn(player) ? 20 : 0);
  if (m > player.maxHp) player.hp += m - player.maxHp;
  player.maxHp = m;
  if (player.hp > player.maxHp) player.hp = player.maxHp;
}

/** A monster's effective defence, dropped while a Faith curse (Marrow Grip) holds. */
function effectiveDef(obj: WorldObjectState, stats: MonsterStats, now: number): number {
  let d = stats.def ?? 0;
  if (obj.defCurse && now < obj.defCurse.until) d = Math.max(0, d - obj.defCurse.amount);
  return d;
}

/**
 * Ratio hit-chance (replaces the old linear `0.5 + (att-def)*slope`, which
 * saturated to the 0.95 cap the moment accuracy outgrew a monster's defence —
 * making defence and the accuracy side of the triangle irrelevant at scale).
 *
 * This scales with the ATT/DEF *ratio*, so raising defence always lowers the
 * chance to be hit, and out-levelling a foe raises but never trivially maxes your
 * hit rate: att == def → ~0.5, att = 2·def → ~0.75, att = 4·def → ~0.87. Clamped
 * to [floor, cap]. The same curve governs both your swings and the monster's.
 */
function hitChance(att: number, def: number): number {
  const a = Math.max(1, att);
  // Defence is weighted a little above raw accuracy so armour and Ward pull real
  // weight — a heavily-armoured target is genuinely hard to land on.
  const d = Math.max(0, def) * COMBAT.defWeight;
  return Math.max(COMBAT.hitFloor, Math.min(COMBAT.hitCap, a / (a + d)));
}

/** A uniform integer in [lo, hi] inclusive, drawn from the injected RNG. */
function randInt(ctx: Ctx, lo: number, hi: number): number {
  return Math.floor(ctx.rng() * (hi - lo + 1)) + lo;
}

/**
 * Resolve combat for this tick. Player and monster each have their own swing
 * clock; we process whichever swings are due, earliest first (player wins ties),
 * exactly like the idle game's timestamp scheduler.
 */
function resolveCombat(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  obj: WorldObjectState,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const stats = monsterFor(content, def);
  if (!obj.available || obj.hp === undefined || !stats) {
    clearActivity(player);
    return;
  }
  if (!obj.nextAttackAt) obj.nextAttackAt = ctx.now + (stats.speed ?? COMBAT.monsterSpeed);

  // Leash: an engagement whose target is far beyond any reach (a death mid-
  // fight, a teleport, a stray intent) breaks cleanly instead of idling in a
  // "combat" that neither side can ever act on.
  {
    const mt = objectPos(def, obj);
    const far = Math.max(Math.abs(player.pos.x - mt.x), Math.abs(player.pos.y - mt.y));
    if (far > 30) {
      clearActivity(player);
      events.push({ type: "LOG", message: `You've lost the ${def.name} — the fight is off.` });
      return;
    }
  }

  // Each side can only land a blow within its own reach: melee is 1 tile, a bow
  // reaches `rangedReach`, and an archer/caster monster reaches its attackRange.
  // Out of reach, the clock still ticks (so neither side stockpiles free swings)
  // but the swing is skipped — closing the gap is the wander logic's job.
  const playerReach = isRanged(player, content) || isMagic(player, content) ? COMBAT.rangedReach : 1;
  const monsterReach = stats.attackRange ?? 1;
  const tileDist = () => {
    const mt = objectPos(def, obj);
    return Math.max(
      Math.abs(Math.round(player.pos.x) - Math.round(mt.x)),
      Math.abs(Math.round(player.pos.y) - Math.round(mt.y)),
    );
  };

  // Bounded loop: at most a handful of swings can come due in one 250ms tick.
  let guard = 0;
  while (
    guard++ < 16 &&
    obj.available &&
    player.alive &&
    obj.hp !== undefined &&
    (ctx.now >= player.activity.nextActionAt || ctx.now >= obj.nextAttackAt)
  ) {
    const playerDue = ctx.now >= player.activity.nextActionAt;
    const monsterDue = ctx.now >= obj.nextAttackAt;
    const doPlayer =
      playerDue && (!monsterDue || player.activity.nextActionAt <= obj.nextAttackAt);

    const dist = tileDist();
    if (doPlayer) {
      player.activity.nextActionAt += playerSpeed(player, content);
      if (dist <= playerReach) playerSwing(state, content, def, obj, stats, ctx, events);
    } else {
      obj.nextAttackAt += stats.speed ?? COMBAT.monsterSpeed;
      if (dist <= monsterReach) monsterSwing(state, content, def, obj, stats, ctx, events);
    }
  }
}

function playerSwing(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  obj: WorldObjectState,
  stats: MonsterStats,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  if (obj.hp === undefined) return;

  const ranged = isRanged(player, content);

  // Ranged fighting spends one arrow per loosed shot; with an empty quiver the
  // attack simply can't continue.
  if (ranged) {
    if (player.quiver <= 0 || !player.equipment.ammo) {
      events.push({ type: "LOG", message: "You're out of arrows." });
      clearActivity(player);
      return;
    }
    player.quiver -= 1;
    if (player.quiver <= 0) delete player.equipment.ammo;
  }

  // The player's attack "style" is the worn weapon's (slash/stab/crush), or
  // "ranged" when fighting with a bow. Matching one of the monster's weaknesses
  // multiplies accuracy and damage — the heart of the combat triangle, and what
  // gives ranged a job: many fliers, wraiths and brutes are weak to it alone.
  // A staff in the mainhand fights with magic (its free basic bolt); the style is
  // "magic", the ratings come off Faith + the staff, and the XP trains Faith.
  const magic = isMagic(player, content);
  const wStyle = ranged ? "ranged" : magic ? "magic" : weaponStyle(player, content);
  const exploits = wStyle !== undefined && activeWeakness(stats, obj).includes(wStyle);
  const baseAcc = ranged ? rangedAccuracy(player, content)
    : magic ? magicAccuracy(player, content) : playerAccuracy(player, content);
  const acc = exploits ? Math.round(baseAcc * COMBAT.weaknessAcc) : baseAcc;
  let maxHit = ranged ? rangedMaxHit(player, content)
    : magic ? magicMaxHit(player, content) : playerMaxHit(player, content);

  // Magic damage: the FREE basic bolt is deliberately weak sustain (BASIC_BOLT
  // factor), so magic's real damage comes from AUTOCASTING a spell — which spends
  // Grace. Autocast fires the selected attack spell (×dmgMult) each swing until
  // Grace runs dry, then drops back to the free bolt. This keeps magic's sustained
  // DPS under melee unless you're spending Grace, and makes the altar loop matter.
  if (magic) {
    let cast = false;
    if (player.autocastSpell) {
      const sp = content.spells.find((s) => s.id === player.autocastSpell);
      if (sp && sp.kind === "attack" && skillLvl(player, "faith") >= sp.faithReq && player.grace >= sp.cost) {
        player.grace -= sp.cost;
        maxHit = Math.max(1, Math.round(maxHit * (sp.dmgMult ?? 1)));
        cast = true;
      }
    }
    if (!cast) maxHit = Math.max(1, Math.round(maxHit * BASIC_BOLT_FACTOR));
  }

  // An armed, fully-charged special turns THIS swing into the weapon family's
  // finisher: a sure hit at the family's multiplier. Twin Shot looses a second
  // arrow (spent if you have one); Grace Surge amplifies whatever bolt this is.
  const special = player.specArmed && player.spec >= SPEC_MAX;
  // A stab finisher (Puncture) is a sure strike that finds the gap — it waives
  // the off-style and scaleguard penalties, so a spear can pick apart a boss it
  // isn't weakness-matched to. Slash (Rending Blow) is the heaviest raw hit;
  // crush (Shatter) trades peak damage to cave the target's guard for a window.
  const puncture = special && !ranged && !magic && wStyle === "stab";
  if (special) {
    player.specArmed = false;
    player.spec = 0;
    if (ranged && player.quiver > 0) player.quiver -= 1; // the paired shaft
    events.push({
      type: "LOG",
      message: ranged ? "TWIN SHOT — two shafts leave the string as one!"
        : magic ? "GRACE SURGE — the whole casting arrives at once!"
        : wStyle === "stab" ? "PUNCTURE — you find the gap and drive clean through!"
        : wStyle === "crush" ? "SHATTER — the blow caves their guard wide open!"
        : "RENDING BLOW — you put the whole bar behind one savage cut!",
    });
  }

  const mechs = stats.mechanics ?? [];
  if (special || ctx.rng() < hitChance(acc, effectiveDef(obj, stats, ctx.now))) {
    const top = Math.max(1, maxHit);
    const floor = Math.max(1, Math.round(top * COMBAT.dmgMinFrac));
    const base = randInt(ctx, Math.min(floor, top), top);
    let dmg = exploits ? Math.ceil(base * COMBAT.weaknessDmg) : base;
    // Thick hide (scaleguard): melee shrugs off most of the blow UNLESS the hit
    // exploits the boss's weakness — so bringing the right style really matters.
    const guard = mechs.find((m) => m.type === "scaleguard");
    if (guard && guard.type === "scaleguard" && !exploits && !puncture) {
      dmg = Math.max(1, Math.round(dmg * (1 - guard.reduce)));
    } else if (stats.boss && !exploits && !puncture) {
      // Off-style vs a boss: the blow lands but can't find purchase. Together
      // with the weakness multipliers this makes the triangle decide boss
      // fights (right style ≈ 2× wrong style), as every bossHint promises.
      dmg = Math.max(1, Math.round(dmg * COMBAT.bossOffStyleDmg));
    }
    // Bounty Helm: a tracker's edge. While worn it adds damage against the
    // exact creature your active bounty names — so it speeds the task you're
    // on. The Greater helm (a Hunt-Marks chase item) sharpens the edge.
    const helmEdge =
      player.equipment.helmet === "bounty_helm_g" ? 1.18 :
      player.equipment.helmet === "bounty_helm" ? 1.1 : 1;
    if (helmEdge > 1 && player.bounty.task?.monster === stats.id) {
      dmg = Math.round(dmg * helmEdge);
    }
    // The special's payoff — each weapon family finishes differently — and an
    // ordinary landed blow feeds the next bar.
    if (special) {
      const mult = ranged ? SPEC_RANGED_MULT
        : magic ? SPEC_MAGIC_MULT
        : wStyle === "stab" ? SPEC_STAB_MULT
        : wStyle === "crush" ? SPEC_CRUSH_MULT
        : wStyle === "slash" ? SPEC_SLASH_MULT
        : SPEC_MELEE_MULT;
      dmg = Math.max(1, Math.round(dmg * mult));
      // Shatter caves the target's guard: their defence drops for a short
      // window, so the crush special sets up the whole fight rather than just
      // spiking one hit. Keep whichever curse leaves the foe softest.
      if (!ranged && !magic && wStyle === "crush") {
        const held = obj.defCurse && ctx.now < obj.defCurse.until ? obj.defCurse.amount : 0;
        obj.defCurse = { amount: Math.max(held, SPEC_SHATTER_DEF), until: ctx.now + SPEC_SHATTER_MS };
      }
    } else player.spec = Math.min(SPEC_MAX, player.spec + SPEC_GAIN_PER_HIT);
    obj.hp -= dmg;
    events.push({ type: "DAMAGE", targetId: obj.id, amount: dmg, weak: exploits });
    // A turning ward announces itself when this blow pushes the boss into a
    // deeper weakness phase (still alive) — telling you which style to swap to.
    if (obj.hp > 0) announceWardshift(stats, obj, events);
    // OSRS-style combat XP, earned per point of damage dealt (not on the kill):
    // 1.5 xp to the attack skill (Draw for ranged, the chosen melee style else),
    // and 0.5 xp to Vitality. Trimmed again (from 3 + 1) after the armed-combat
    // playtest measured 450–700k xp/hr with real weapons — damage-based XP is
    // invariant to monster-HP scaling, so the rate itself had to come down for
    // combat to sit alongside the gathering skills instead of lapping them.
    grantXp(state, content, ranged ? "draw" : magic ? "faith" : player.combatStyle, dmg * 1.5, events);
    grantXp(state, content, "vitality", dmg * 0.5, events);
    // Searing hide (recoil): a melee blow burns you back. Never lethal on its
    // own — it can't drop you below 1 — but it forces you to keep healing.
    // Ranged and magic strike from a distance, so they're spared the recoil.
    if (!ranged && !magic) {
      const rec = mechs.find((m) => m.type === "recoil");
      if (rec && rec.type === "recoil" && player.hp > 1) {
        const burn = Math.min(player.hp - 1, Math.max(1, Math.round(dmg * rec.frac)));
        if (burn > 0) {
          player.hp -= burn;
          events.push({ type: "DAMAGE", targetId: "player", amount: burn });
          if (ctx.rng() < 0.45) events.push({ type: "LOG", message: rec.tell });
        }
      }
    }
  } else {
    events.push({ type: "DAMAGE", targetId: obj.id, amount: 0 });
  }

  if (obj.hp <= 0) checkKill(state, content, def, obj, stats, ctx, events);
}

/**
 * A monster has (maybe) dropped to 0 HP: finalise the kill — loot, respawn
 * timer, shard pity, quest/bounty progress and the log. Shared by the auto-swing
 * and by damaging spell casts, so a killing Emberbolt drops loot too.
 */
function checkKill(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  obj: WorldObjectState,
  stats: MonsterStats,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  if (obj.hp === undefined || obj.hp > 0) return;
  obj.hp = 0;
  obj.available = false;
  obj.respawnAt = ctx.now + COMBAT.respawn;
  obj.nextAttackAt = 0;
  // Combat XP is granted per hit (see above), OSRS-style — not on the kill.
  player.killsSinceShard += 1;
  // Delve monsters never respawn on their own — the run's waves control them.
  if (def.id.startsWith("delve_")) {
    obj.respawnAt = ctx.now + 1e12;
    onDelveKill(state, content, ctx, events);
  }
  // Loot falls to the floor where the creature stood — the player walks over
  // and picks it up (OSRS-style), it isn't auto-collected.
  const drop = objectPos(def, obj);
  rollDrops(state, content, drop.x, drop.y, stats, ctx, events); // resets killsSinceShard if the shard drops
  // Pity guarantee: once the count crosses the threshold without a shard, the
  // next kill yields one and the count resets — a rare drop that can't wall you.
  if (player.killsSinceShard >= SHARD_PITY) {
    dropToGround(state, SHARD_ID, 1, drop.x, drop.y, ctx);
    player.killsSinceShard = 0;
    events.push({ type: "LOG", message: `The ${def.name} drops a warm black Shard of Orun.` });
  }
  player.stats.monstersSlain += 1;
  if (stats.boss) player.bossKills[stats.id] = (player.bossKills[stats.id] ?? 0) + 1;
  // A trail scroll can be tucked in any creature's remains (tier by level).
  rollClueDrop(state, content, stats, ctx, events);
  // Bounty quarry sheds the odd Herblore secondary, seed, or grimy herb.
  rollBountyForageDrop(state, drop.x, drop.y, stats, ctx);
  // UNIQUE — the Barrow-King's Signet: every kill knits the wearer's wounds.
  if (player.equipment.ring === "barrow_king_signet" && player.hp < player.maxHp) {
    const heal = Math.max(3, Math.round(player.maxHp * 0.08));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    events.push({ type: "LOG", message: `The Barrow-King's Signet warms — your wounds knit (+${heal}).` });
  }
  // A summoning boss falls: send any adds home and re-arm the summon for next
  // time, so the fight resets to single-target (T1·07).
  const summon = stats.mechanics?.find((m) => m.type === "summon");
  if (summon && summon.type === "summon") {
    despawnFlaggedSpawns(state, content, summon.flag);
    obj.summoned = false;
  }
  events.push({ type: "MONSTER_KILLED", objId: obj.id });
  // "the The Boneman" reads badly — names that carry their own article skip ours.
  events.push({ type: "LOG", message: `You defeat ${/^The /.test(def.name) ? def.name : `the ${def.name}`}.` });
  advanceKillQuests(state, content, def.monster, events);
  trackBountyKill(state, content, def.monster, ctx, events);
  // Warren-bred quarry trains huntcraft even OFF-task (a modest flat trickle,
  // strictly worse than contract pay) — so the guild grounds are never
  // XP-dead between assignments, e.g. a Bounty-20 hunter grinding creepers
  // before Serath will deal with them at 30.
  const wstats = monsterFor(content, def);
  if (wstats?.bountyReq && state.player.bounty.task?.monster !== def.monster) {
    grantXp(state, content, "bounty", Math.round(wstats.bountyReq * 0.8), events);
  }
  // Superiors are a real second fight: an ordinary on-task kill can RAISE the
  // corpse (rollSuperiorRise re-engages both sides); slaying the risen one is
  // what pays. A superior never chains into another superior.
  let rose = false;
  if (obj.superior) {
    obj.superior = false;
    paySuperiorBounty(state, content, def.monster ?? "", ctx, events);
  } else {
    rose = rollSuperiorRise(state, content, def, obj, ctx, events);
  }
  // A tool-gated kill spends its consumable — unless the mastery is owned.
  const hgk = HUNT_GATES[def.monster ?? ""];
  if (hgk && !player.bounty.unlocks.includes(hgk.unlock)) {
    removeOneItem(player, hgk.item);
    if (!hasItem(player, hgk.item)) {
      events.push({ type: "LOG", message: `That was your last ${hgk.toolName} — buy more from a guide, or the mastery to be done with them.` });
    }
  }
  // A risen Superior has already locked the player back into combat — don't
  // clear the very engagement it just set up.
  if (!rose) clearActivity(player);
}

/**
 * Cast a Faith spell: gate on a staff + Faith level + Grace, spend the Grace,
 * apply the effect by kind, and train Faith. Attack spells hit the current combat
 * target (and can finish it, dropping loot via checkKill).
 */
function castSpell(
  state: WorldState,
  content: Content,
  spellId: string,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const spell = content.spells.find((s) => s.id === spellId);
  if (!spell) return;
  if (!isMagic(player, content)) {
    events.push({ type: "LOG", message: "You need a staff in hand to cast." });
    return;
  }
  if (skillLvl(player, "faith") < spell.faithReq) {
    events.push({ type: "LOG", message: `You need Faith ${spell.faithReq} to cast ${spell.name}.` });
    return;
  }
  if (player.grace < spell.cost) {
    events.push({ type: "LOG", message: `Not enough Grace for ${spell.name}. Pray at a shrine or drink a Faith Potion.` });
    return;
  }

  switch (spell.kind) {
    case "attack": {
      const targetId = player.activity.kind === "combat" ? player.activity.targetId : null;
      const def = targetId ? content.objects.find((o) => o.id === targetId) : undefined;
      const obj = targetId ? state.objects[targetId] : undefined;
      const stats = def ? monsterFor(content, def) : undefined;
      if (!def || !obj || !stats || obj.hp === undefined || !obj.available) {
        events.push({ type: "LOG", message: "You have no target to strike." });
        return;
      }
      player.grace -= spell.cost;
      const top = Math.max(1, magicMaxHit(player, content));
      const dmg = Math.max(1, Math.round(top * (spell.dmgMult ?? 1)));
      obj.hp -= dmg;
      events.push({ type: "DAMAGE", targetId: obj.id, amount: dmg, weak: true });
      events.push({ type: "LOG", message: `You cast ${spell.name}! (${dmg})` });
      grantXp(state, content, "faith", spell.xp, events);
      if (obj.hp <= 0) checkKill(state, content, def, obj, stats, ctx, events);
      break;
    }
    case "heal": {
      if (player.hp >= player.maxHp) {
        events.push({ type: "LOG", message: "You are already at full health." });
        return;
      }
      player.grace -= spell.cost;
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + (spell.heal ?? 0));
      events.push({ type: "HEALED", amount: player.hp - before });
      events.push({ type: "LOG", message: `You cast ${spell.name}.` });
      grantXp(state, content, "faith", spell.xp, events);
      break;
    }
    case "ward": {
      player.grace -= spell.cost;
      player.buffs["defence"] = { amount: spell.wardAmt ?? 0, until: ctx.now + (spell.wardMs ?? 15000) };
      events.push({ type: "LOG", message: `You cast ${spell.name}. A ward shimmers around you.` });
      grantXp(state, content, "faith", spell.xp, events);
      break;
    }
    case "teleport": {
      player.grace -= spell.cost;
      player.path = [];
      player.pendingInteractId = null;
      player.pendingInteractMode = null;
      player.station = null;
      clearActivity(player);
      const t = content.respawnPoint;
      player.pos = { x: t.x, y: t.y };
      player.aggroImmuneUntil = ctx.now + FLEE_GRACE_MS;
      events.push({ type: "LOG", message: `You cast ${spell.name} and step through Orun's light.` });
      grantXp(state, content, "faith", spell.xp, events);
      break;
    }
    case "curse": {
      const targetId = player.activity.kind === "combat" ? player.activity.targetId : null;
      const obj = targetId ? state.objects[targetId] : undefined;
      if (!targetId || !obj || obj.hp === undefined || !obj.available) {
        events.push({ type: "LOG", message: "You have no target to curse." });
        return;
      }
      player.grace -= spell.cost;
      obj.defCurse = { amount: spell.curseAmt ?? 0, until: ctx.now + (spell.curseMs ?? 15000) };
      events.push({ type: "LOG", message: `You cast ${spell.name}! Your foe's guard weakens.` });
      grantXp(state, content, "faith", spell.xp, events);
      break;
    }
    case "kindle": {
      // Superheat: find a smithing smelt recipe (produces a *_bar) you can fulfil.
      const recipe = content.actions.find((a) =>
        a.skill === "smithing" && !!a.produces && a.produces.endsWith("_bar") && hasIngredients(player, a));
      if (!recipe || !recipe.produces) {
        events.push({ type: "LOG", message: "You have no ore to superheat." });
        return;
      }
      if (!canAddItem(player, recipe.produces)) {
        events.push({ type: "INVENTORY_FULL" });
        return;
      }
      player.grace -= spell.cost;
      consumeIngredients(player, recipe);
      addItem(player, recipe.produces, recipe.produceQty ?? 1, events);
      events.push({ type: "LOG", message: `You cast ${spell.name} — the ore melts into a ${content.items[recipe.produces].name}.` });
      grantXp(state, content, "faith", spell.xp, events);
      grantXp(state, content, "smithing", recipe.xp ?? 0, events);
      break;
    }
    case "enchant": {
      // Cut/enchant the cheapest raw gem you hold into a valuable cut gem.
      const RAW: ItemId[] = ["rough_gem", "uncut_sapphire", "uncut_emerald", "uncut_ruby"];
      const gem = RAW.find((g) => hasItem(player, g));
      if (!gem) {
        events.push({ type: "LOG", message: "You have no rough or uncut gem to enchant." });
        return;
      }
      if (!canAddItem(player, "cut_gem")) {
        events.push({ type: "INVENTORY_FULL" });
        return;
      }
      player.grace -= spell.cost;
      removeOneItem(player, gem);
      addItem(player, "cut_gem", 1, events);
      events.push({ type: "LOG", message: `You cast ${spell.name} — the ${content.items[gem].name} becomes a Cut Gem.` });
      grantXp(state, content, "faith", spell.xp, events);
      break;
    }
  }
}

/** Bury the bones in a slot for Faith XP (Grace is untouched — bones are XP only). */
function buryBones(
  state: WorldState,
  content: Content,
  slot: number,
  events: WorldEvent[],
): void {
  const { player } = state;
  const data = player.inventory[slot];
  if (!data) return;
  const def = content.items[data.item];
  if (!def.buryXp) {
    events.push({ type: "LOG", message: `You can't bury the ${def.name}.` });
    return;
  }
  data.qty -= 1;
  if (data.qty <= 0) player.inventory[slot] = null;
  events.push({ type: "LOG", message: `You bury the ${def.name}. You murmur a rite to Orun.` });
  grantXp(state, content, "faith", def.buryXp, events);
}

/** Crush the bones in a slot into bonemeal with a Pestle & Mortar. Big bones give
 *  two; needs a pestle in the pack (an in-pack action, no station). */
function grindBones(
  state: WorldState,
  content: Content,
  slot: number,
  events: WorldEvent[],
): void {
  const { player } = state;
  const data = player.inventory[slot];
  if (!data) return;
  const def = content.items[data.item];
  if (!def.buryXp) {
    events.push({ type: "LOG", message: `You can't grind the ${def.name}.` });
    return;
  }
  if (!hasItem(player, "pestle")) {
    events.push({ type: "LOG", message: "You need a Pestle & Mortar to crush bones." });
    return;
  }
  const yieldN = data.item === "big_bones" ? 2 : 1;
  if (!canAddItem(player, "bonemeal")) {
    events.push({ type: "INVENTORY_FULL" });
    return;
  }
  data.qty -= 1;
  if (data.qty <= 0) player.inventory[slot] = null;
  addItem(player, "bonemeal", yieldN, events);
  events.push({ type: "LOG", message: `You grind the ${def.name} into bonemeal.` });
}

/** Fire-lighting data per log id: the Survivalist level to burn it, the XP it
 *  grants, and how long its fire lasts. Tougher logs burn longer and pay far
 *  more — mirrors the Forestry ladder that produces them. */
const FIRE_LOGS: Record<string, { level: number; xp: number; burnMs: number }> = {
  ashwood_log: { level: 1, xp: 40, burnMs: 60_000 },
  coldpine_log: { level: 20, xp: 90, burnMs: 75_000 },
  stonewood_log: { level: 30, xp: 125, burnMs: 90_000 },
  greyoak_log: { level: 45, xp: 165, burnMs: 105_000 },
  ironbark_log: { level: 55, xp: 200, burnMs: 120_000 },
  ruewood_log: { level: 60, xp: 230, burnMs: 135_000 },
  heartoak_log: { level: 80, xp: 300, burnMs: 165_000 },
  deeproot_log: { level: 90, xp: 360, burnMs: 195_000 },
};

/** Strike flint against a log to set a campfire at the player's feet, OSRS-style:
 *  the log is consumed, Survivalist XP is granted, a transient `state.campfire` is
 *  lit (a cooking source that burns for a while), and — if there's room — the
 *  player steps clear onto an adjacent tile so they aren't standing in the flames. */
function lightFire(
  state: WorldState,
  content: Content,
  slot: number,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const data = player.inventory[slot];
  if (!data) return;
  const spec = FIRE_LOGS[data.item];
  if (!spec) {
    events.push({ type: "LOG", message: `You can't set fire to the ${content.items[data.item].name}.` });
    return;
  }
  if (!hasItem(player, "flint")) {
    events.push({ type: "LOG", message: "You need Flint & Steel to light a fire." });
    return;
  }
  if (player.skills.survivalist.level < spec.level) {
    events.push({ type: "LOG", message: `You need Survivalist level ${spec.level} to burn ${content.items[data.item].name}.` });
    return;
  }
  if (state.campfire) {
    events.push({ type: "LOG", message: "There's already a fire burning here." });
    return;
  }

  const px = Math.round(player.pos.x);
  const py = Math.round(player.pos.y);
  // Find a free tile to step onto so the fire lights where the player stood.
  const walk = buildWalkability(content, state);
  const step = [[-1, 0], [1, 0], [0, -1], [0, 1]].find(([dx, dy]) => walk(px + dx!, py + dy!));

  data.qty -= 1;
  if (data.qty <= 0) player.inventory[slot] = null;
  grantXp(state, content, "survivalist", spec.xp, events);
  if (step) {
    player.pos = { x: px + step[0]!, y: py + step[1]! };
    player.path = [];
  }
  state.campfire = { x: px, y: py, expiresAt: ctx.now + spec.burnMs };
  events.push({ type: "LOG", message: `The ${content.items[data.item].name} catches and a fire roars up.` });
}

function monsterSwing(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  obj: WorldObjectState,
  stats: MonsterStats,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const mechanics = stats.mechanics ?? [];

  // --- HP-threshold triggers (each fires once): enrage, self-heal ---
  if (mechanics.length && obj.hp !== undefined) {
    const frac = obj.hp / stats.hp;
    for (const m of mechanics) {
      if (m.type === "enrage" && !obj.enraged && frac < m.below) {
        obj.enraged = true;
        events.push({ type: "LOG", message: m.tell });
      }
      if (m.type === "selfheal" && !obj.healed && frac < m.below) {
        obj.healed = true;
        obj.hp = Math.min(stats.hp, obj.hp + m.amount);
        events.push({ type: "LOG", message: m.tell });
      }
      // Adds: the boss calls its kin once, turning the duel into a melee.
      if (m.type === "summon" && !obj.summoned && frac < m.below) {
        obj.summoned = true;
        const n = standUpFlaggedSpawns(state, content, m.flag, ctx);
        if (n > 0) events.push({ type: "LOG", message: m.tell });
      }
    }
  }

  // --- This swing's damage multiplier: a periodic "heavy" blow + enrage ---
  obj.swings = (obj.swings ?? 0) + 1;
  let dmgMult = 1;
  for (const m of mechanics) {
    if (m.type === "heavy" && obj.swings % m.every === 0) {
      dmgMult *= m.mult;
      events.push({ type: "LOG", message: m.tell });
    }
    if (m.type === "enrage" && obj.enraged) dmgMult *= m.mult;
    // A ground SLAM replaces this swing entirely: the tiles around where the
    // player is standing RIGHT NOW are marked, and detonate after the windup.
    // Step off the marked ground and it hits nothing — the one boss move you
    // beat by moving, not eating. Resolved in resolveSlams (tick).
    if (m.type === "slam" && obj.swings % m.every === 0 && !obj.slam) {
      obj.slam = {
        x: Math.round(player.pos.x),
        y: Math.round(player.pos.y),
        radius: m.radius,
        at: ctx.now + m.windupMs,
        mult: m.mult,
      };
      events.push({ type: "LOG", message: m.tell });
      return; // the slam IS this attack — no regular swing on top
    }
    // A directional CLEAVE: mark a length-deep, 3-wide swath in front of the
    // boss, aimed at where the player stands. Dodge by stepping to its FLANK.
    if (m.type === "cleave" && obj.swings % m.every === 0 && !obj.slam) {
      const bp = objectPos(def, obj);
      const bx = Math.round(bp.x), by = Math.round(bp.y);
      const px = Math.round(player.pos.x), py = Math.round(player.pos.y);
      const ax = px - bx, ay = py - by;
      const horiz = Math.abs(ax) >= Math.abs(ay);
      const dir = horiz ? Math.sign(ax) || 1 : Math.sign(ay) || 1;
      const tiles: { x: number; y: number }[] = [];
      for (let i = 1; i <= m.length; i++) {
        for (let j = -1; j <= 1; j++) {
          tiles.push(horiz ? { x: bx + dir * i, y: by + j } : { x: bx + j, y: by + dir * i });
        }
      }
      obj.slam = { x: bx, y: by, radius: 0, at: ctx.now + m.windupMs, mult: m.mult, tiles };
      events.push({ type: "LOG", message: m.tell });
      return; // the cleave IS this attack
    }
  }
  // Endless Delve DEPTH: every floor past the cache presses harder (+12%/floor).
  // Self-limiting — you descend until it kills you; the depth reached is the score.
  if (state.delve?.depth && def.id.startsWith("delve_")) {
    dmgMult *= 1 + 0.12 * state.delve.depth;
  }

  if (ctx.rng() < hitChance(stats.acc ?? 0, playerDefence(player, content))) {
    const raw = randInt(ctx, 1, stats.maxHit);
    const soak = Math.floor(playerDefence(player, content) / COMBAT.wardDivisor);
    // Ordinary monsters hit harder now (so an even fight bites); bosses keep
    // their own hand-tuned damage and are exempt from the global bump.
    const offense = stats.boss ? 1 : COMBAT.monsterDmgMult;
    let dmg = Math.max(1, Math.round((raw - soak) * dmgMult * offense));
    // A held protection blessing halves damage of its style — the counterplay
    // layer: read the boss's attack style and light the right deflection.
    const bless = player.blessing ? content.spells.find((s) => s.id === player.blessing) : undefined;
    if (bless?.deflectStyle) {
      const incoming = stats.attackStyle === "ranged" ? "ranged"
        : stats.attackStyle === "magic" ? "magic" : "melee";
      if (bless.deflectStyle === incoming) dmg = Math.max(1, Math.ceil(dmg * 0.5));
    }
    // The Warden's Pale Greaves (Undergate unique): every blow lands a tenth softer.
    if (player.equipment.boots === "pale_greaves") dmg = Math.max(1, Math.round(dmg * 0.9));
    // A Bracing Draught (the universal, Faith-free protection layer): while braced,
    // every incoming blow lands `mitigate` softer — a weaker, buildless echo of
    // the Devotion blessings, so a pure-combat main can still buy some defence.
    const brace = buffVal(player, "mitigate");
    if (brace > 0) dmg = Math.max(1, Math.round(dmg * (1 - Math.min(0.6, brace))));
    const before = player.hp;
    player.hp -= dmg;
    events.push({ type: "DAMAGE", targetId: "player", amount: dmg });
    // A one-time warning the moment you drop into the danger zone.
    const lowAt = player.maxHp * 0.3;
    if (before > lowAt && player.hp > 0 && player.hp <= lowAt) {
      events.push({ type: "LOG", message: "You're badly wounded — heal or run!" });
    }
    // Life-drain: the boss heals a fraction of the harm it does.
    const ld = mechanics.find((m) => m.type === "lifedrain");
    if (ld && ld.type === "lifedrain" && obj.hp !== undefined && obj.hp < stats.hp) {
      obj.hp = Math.min(stats.hp, obj.hp + Math.max(1, Math.round(dmg * ld.frac)));
      if (ctx.rng() < 0.4) events.push({ type: "LOG", message: ld.tell });
    }
  } else {
    events.push({ type: "DAMAGE", targetId: "player", amount: 0 });
  }

  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
    player.respawnAt = ctx.now + PLAYER_RESPAWN;
    player.path = [];
    clearActivity(player);
    // Coin setback: a tenth of your carried gold (capped).
    const lost = Math.min(DEATH_GOLD_CAP, Math.floor(player.gold * DEATH_GOLD_FRACTION));
    if (lost > 0) player.gold -= lost;
    // Item risk, OSRS-style: your gear stays on your back and your THREE most
    // valuable carried stacks are kept — the rest spills where you fell, and
    // you have a recovery window to run back for it. New players carry little,
    // so this self-scales: trivial at level 5, a real corpse-run at the Wyrm.
    const px = Math.round(player.pos.x);
    const py = Math.round(player.pos.y);
    const slots = player.inventory
      .map((s, i) => ({ s, i, v: s ? marketValue(content, s.item) * s.qty : -1 }))
      .filter((r) => r.s !== null)
      .sort((a, b) => b.v - a.v);
    const spilled = slots.slice(DEATH_ITEMS_KEPT).filter((r) => r.v > 0);
    // Below a pocket-change total the spill is waived — a newbie's first deaths
    // sting (coin) but never strip their pack.
    const spillValue = spilled.reduce((n, r) => n + r.v, 0);
    let droppedCount = 0;
    if (spillValue >= DEATH_SPILL_MIN_VALUE) {
      for (const r of spilled) {
        dropToGround(state, r.s!.item, r.s!.qty, px, py, ctx, true);
        player.inventory[r.i] = null;
        droppedCount++;
      }
      // Death drops get a LONGER window than ordinary litter — enough to
      // respawn, re-gear and run back across the map.
      for (const g of state.ground) {
        if (g.x === px && g.y === py) g.despawnAt = ctx.now + DEATH_SPILL_TTL;
      }
    }
    // Record the spill for the death overlay's reassurance line (0 = kept all).
    player.deathSpillStacks = droppedCount;
    const bits = [
      lost > 0 ? `You lose ${lost}g` : "",
      droppedCount > 0 ? `your pack spills where you fell (${droppedCount} stack${droppedCount === 1 ? "" : "s"} — run back within ${Math.round(DEATH_SPILL_TTL / 60000)} minutes!)` : "",
    ].filter(Boolean).join(" and ");
    events.push({ type: "LOG", message: `The ${def.name} knocks you out!${bits ? ` ${bits}.` : ""}` });
    events.push({ type: "PLAYER_DIED" });
  }
}

// How often the wandering world boss relocates along its patrol.
const WORLD_BOSS_MOVE_MIN = 12 * 60_000, WORLD_BOSS_MOVE_MAX = 20 * 60_000;

/** Relocate the wandering world boss along its patrol on a slow clock. Each
 *  move heals it (a fresh sighting is a fresh fight) and is announced. */
function moveWorldBoss(state: WorldState, content: Content, ctx: Ctx, events: WorldEvent[]): void {
  const def = content.objects.find((o) => o.kind === "monster" && o.patrol && o.patrol.length > 1);
  if (!def?.patrol) return;
  const obj = state.objects[def.id];
  if (!obj) return;
  if (state.worldBossMoveAt === undefined) {
    state.worldBossMoveAt = ctx.now + WORLD_BOSS_MOVE_MIN + ctx.rng() * (WORLD_BOSS_MOVE_MAX - WORLD_BOSS_MOVE_MIN);
    return;
  }
  if (ctx.now < state.worldBossMoveAt) return;
  state.worldBossMoveAt = ctx.now + WORLD_BOSS_MOVE_MIN + ctx.rng() * (WORLD_BOSS_MOVE_MAX - WORLD_BOSS_MOVE_MIN);
  // Never teleport out from under an active fight — it moves when left alone.
  if (state.player.activity.kind === "combat" && state.player.activity.targetId === def.id) return;
  const cur = objectPos(def, obj);
  const options = def.patrol.filter((p) => p.x !== Math.round(cur.x) || p.y !== Math.round(cur.y));
  const next = options[Math.floor(ctx.rng() * options.length)]!;
  state.creatureTiles.delete(`${Math.round(cur.x)},${Math.round(cur.y)}`);
  obj.pos = { x: next.x, y: next.y };
  obj.wanderTarget = null;
  obj.nextWanderAt = ctx.now + 5000;
  state.creatureTiles.add(`${next.x},${next.y}`);
  const stats = monsterFor(content, def);
  // On relocation it licks its wounds but no longer heals to FULL — a committed
  // chase now lands, instead of resetting the beast every time it wanders off
  // (it recovers ~35% of its health, and its fight state resets).
  if (obj.available && stats) {
    obj.hp = Math.min(stats.hp, (obj.hp ?? stats.hp) + Math.round(stats.hp * 0.35));
    obj.enraged = false; obj.slam = null; obj.swings = 0;
  }
  events.push({ type: "WORLD_BOSS_MOVED", name: def.name, hint: compassHint(content, next) });
}

/** A coarse "where" for a world-boss sighting — a compass corner of the map.
 *  Exported for the client (the quest tab's Today panel names the wilds). */
export function compassHint(content: Content, p: Vec2): string {
  const { width, height } = content.map;
  const ns = p.y < height / 3 ? "north" : p.y > (2 * height) / 3 ? "south" : "";
  const ew = p.x < width / 3 ? "west" : p.x > (2 * width) / 3 ? "east" : "";
  const dir = ns && ew ? `${ns}-${ew}` : ns || ew || "heart";
  return dir === "heart" ? "the heart of Varath" : `the ${dir}ern wilds`;
}

// ---------------------------------------------------------------------------
// The Marrow Delve: a four-wave gauntlet run inside the vault. Wave spawns are
// flag-gated (delve_wave_N); the core sets/clears the flags as waves fall, and
// the Delve Cache pays out when the Horror dies. Dying ends the run.
// ---------------------------------------------------------------------------
const DELVE_WAVES = 4;
/** Full cache once per this much PLAYED time (can't be gamed by the clock). */
export const DELVE_FULL_LOCKOUT_MS = 90 * 60_000; // exported for the Today panel

function delveFlag(w: number): string { return `delve_wave_${w}`; }

/** All spawn defs belonging to a delve wave. */
function delveWaveDefs(content: Content, w: number): WorldObjectDef[] {
  return content.objects.filter((o) => o.requiresFlag === delveFlag(w));
}

/** Arm a wave: set its flag and stand its monsters up fresh. */
function armDelveWave(state: WorldState, content: Content, w: number, ctx: Ctx): number {
  const { player } = state;
  if (!player.flags.includes(delveFlag(w))) player.flags.push(delveFlag(w));
  const defs = delveWaveDefs(content, w);
  for (const d of defs) {
    const obj = state.objects[d.id];
    if (!obj) continue;
    obj.available = true;
    obj.hp = monsterFor(content, d)?.hp ?? 1;
    obj.pos = { x: d.x, y: d.y };
    obj.respawnAt = 0;
    obj.nextAttackAt = 0;
    obj.swings = 0;
    obj.enraged = false;
    obj.healed = false;
    obj.slam = null;
    obj.nextWanderAt = ctx.now + 1500;
  }
  return defs.length;
}

/** Stand up the pre-placed spawns gated behind `flag` (boss adds, T1·07) — the
 *  generic form of armDelveWave: set the flag so they clear their requiresFlag
 *  gate, then activate each one fresh. Returns how many stood up. */
function standUpFlaggedSpawns(state: WorldState, content: Content, flag: string, ctx: Ctx): number {
  const { player } = state;
  if (!player.flags.includes(flag)) player.flags.push(flag);
  let n = 0;
  for (const d of content.objects) {
    if (d.requiresFlag !== flag || d.kind !== "monster") continue;
    const obj = state.objects[d.id];
    if (!obj) continue;
    obj.available = true;
    obj.respawnAt = 0;
    obj.hp = monsterFor(content, d)?.hp ?? 1;
    obj.pos = { x: d.x, y: d.y };
    obj.wanderTarget = null;
    obj.nextAttackAt = 0;
    obj.swings = 0;
    obj.nextWanderAt = ctx.now + 800;
    n++;
  }
  return n;
}

/** Send the adds home: drop the summon flag (which hides their spawns again) and
 *  park them, so the fight resets to single-target once the boss falls. */
function despawnFlaggedSpawns(state: WorldState, content: Content, flag: string): void {
  const i = state.player.flags.indexOf(flag);
  if (i >= 0) state.player.flags.splice(i, 1);
  for (const d of content.objects) {
    if (d.requiresFlag !== flag) continue;
    const obj = state.objects[d.id];
    // Park them far in the future so the respawn loop can't revive a hidden add;
    // a fresh summon (standUpFlaggedSpawns) resets respawnAt when the boss calls again.
    if (obj) { obj.available = false; obj.respawnAt = Number.MAX_SAFE_INTEGER; }
  }
}

/** Tear the run down (finished, died, or restarting): clear every wave flag. */
function clearDelve(state: WorldState): void {
  state.delve = null;
  for (let w = 1; w <= DELVE_WAVES; w++) {
    const i = state.player.flags.indexOf(delveFlag(w));
    if (i >= 0) state.player.flags.splice(i, 1);
  }
}

function startDelve(state: WorldState, content: Content, ctx: Ctx, events: WorldEvent[]): void {
  clearDelve(state); // restarting mid-run just resets to wave 1
  const remaining = armDelveWave(state, content, 1, ctx);
  state.delve = { wave: 1, remaining };
  events.push({ type: "LOG", message: "The Warden opens the way down. WAVE 1 — the dark answers." });
}

/** A delve monster died: advance the wave, pay the cache after the last fixed
 *  wave, then descend into endless DEPTH — the maxed-delver long tail. */
function onDelveKill(state: WorldState, content: Content, ctx: Ctx, events: WorldEvent[]): void {
  const d = state.delve;
  if (!d) return;
  d.remaining -= 1;
  if (d.remaining > 0) return;
  // Descend one floor deeper: re-arm the hardest wave, harder still (see the
  // depth damage scaling in monsterSwing), and remember the record.
  const descend = (): void => {
    const i = state.player.flags.indexOf(delveFlag(DELVE_WAVES));
    if (i >= 0) state.player.flags.splice(i, 1);
    d.depth = (d.depth ?? 0) + 1;
    if ((state.player.delveDepthRecord ?? 0) < d.depth) state.player.delveDepthRecord = d.depth;
    d.remaining = armDelveWave(state, content, DELVE_WAVES, ctx);
  };
  if (d.depth) {
    descend();
    events.push({ type: "LOG", message: `The floor gives way. DEPTH ${d.depth} — the dark presses harder. Leave with your record, or feed it.` });
    return;
  }
  if (d.wave < DELVE_WAVES) {
    const done = d.wave;
    const i = state.player.flags.indexOf(delveFlag(done));
    if (i >= 0) state.player.flags.splice(i, 1);
    d.wave += 1;
    d.remaining = armDelveWave(state, content, d.wave, ctx);
    events.push({ type: "LOG", message: `Wave ${done} falls. WAVE ${d.wave} rises from the deep…` });
    return;
  }
  // The fixed gauntlet is cleared: claim the cache once (the daily), then the way
  // keeps going down — endless depth, escalating, until you leave or fall.
  grantDelveCache(state, content, ctx, events);
  descend();
  events.push({ type: "LOG", message: "The cache is yours — but the stair keeps descending. DEPTH 1. The deeper you go the harder it bites, and the Record remembers how far." });
}

function grantDelveCache(state: WorldState, _content: Content, ctx: Ctx, events: WorldEvent[]): void {
  const { player } = state;
  const full = player.playMs - (player.delveLastFullPlayMs ?? -Infinity) >= DELVE_FULL_LOCKOUT_MS;
  if (full) player.delveLastFullPlayMs = player.playMs;
  const give = (item: ItemId, qty: number): void => {
    if (canAddItem(player, item)) addItem(player, item, qty, events);
    else {
      player.bank[item] = (player.bank[item] ?? 0) + qty;
      events.push({ type: "ITEM_GAINED", item, qty });
    }
  };
  const gold = full ? 4000 + randInt(ctx, 0, 3000) : 800 + randInt(ctx, 0, 700);
  player.gold += gold;
  player.stats.goldEarned += gold;
  give("voidstone_bar", full ? randInt(ctx, 2, 3) : 1);
  give("cut_gem", full ? randInt(ctx, 2, 3) : 1);
  if (full) {
    give("hearthite_bar", randInt(ctx, 1, 2));
    if (ctx.rng() < 1 / 12) { give("shard_of_orun", 1); player.killsSinceShard = 0; }
    if (ctx.rng() < 1 / 25) {
      give("horror_lantern", 1);
      events.push({ type: "LOG", message: "Something in the cache still glows — the HORROR'S LANTERN is yours!" });
    }
  }
  events.push({
    type: "LOG",
    message: full
      ? `The Delve is cleared! The cache pays in full — ${gold}g and the deep's own goods.`
      : `The Delve is cleared again. The cache pays light this soon (${gold}g) — its best waits for a rested delver.`,
  });
}

/**
 * Detonate any boss ground-slams whose windup has elapsed. The marked tiles
 * were fixed when the slam was armed (where the player then stood); if the
 * player has stepped clear, it wastes itself — dodging is the counterplay.
 * A held blessing still halves it (the ground burns with the boss's style).
 */
function resolveSlams(
  state: WorldState,
  content: Content,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  for (const def of content.objects) {
    if (def.kind !== "monster") continue;
    const obj = state.objects[def.id];
    if (!obj?.slam || ctx.now < obj.slam.at) continue;
    const slam = obj.slam;
    obj.slam = null;
    const stats = monsterFor(content, def);
    if (!stats || !obj.available || !player.alive) continue;
    const ppx = Math.round(player.pos.x), ppy = Math.round(player.pos.y);
    // A cleave marks an explicit swath (slam.tiles); a slam marks an (x,y)-radius
    // box. Either way the player is hit only if still standing in the marked ground.
    const caught = slam.tiles
      ? slam.tiles.some((t) => t.x === ppx && t.y === ppy)
      : Math.max(Math.abs(ppx - slam.x), Math.abs(ppy - slam.y)) <= slam.radius;
    if (!caught) {
      const kind = slam.tiles ? "cleave whistles past" : "slam shatters empty ground";
      events.push({ type: "LOG", message: `${def.name}'s ${kind} — you stepped clear!` });
      continue;
    }
    let dmg = Math.max(1, Math.round(stats.maxHit * slam.mult));
    const bless = player.blessing ? content.spells.find((s) => s.id === player.blessing) : undefined;
    if (bless?.deflectStyle) {
      const incoming = stats.attackStyle === "ranged" ? "ranged"
        : stats.attackStyle === "magic" ? "magic" : "melee";
      if (bless.deflectStyle === incoming) dmg = Math.max(1, Math.ceil(dmg * 0.5));
    }
    if (player.equipment.boots === "pale_greaves") dmg = Math.max(1, Math.round(dmg * 0.9));
    player.hp -= dmg;
    events.push({ type: "DAMAGE", targetId: "player", amount: dmg });
    events.push({ type: "LOG", message: `${def.name}'s ${slam.tiles ? "cleave catches" : "slam catches"} you square — ${dmg} damage!` });
    if (player.hp <= 0) {
      // Same stakes as any killing blow (coin + pack spill live in monsterSwing's
      // death block; a slam death keeps it simple: coin only, pack intact).
      player.hp = 0;
      player.alive = false;
      player.respawnAt = ctx.now + PLAYER_RESPAWN;
      player.path = [];
      clearActivity(player);
      const lost = Math.min(DEATH_GOLD_CAP, Math.floor(player.gold * DEATH_GOLD_FRACTION));
      if (lost > 0) player.gold -= lost;
      events.push({ type: "LOG", message: `${def.name}'s slam knocks you out!${lost > 0 ? ` You lose ${lost}g.` : ""}` });
      events.push({ type: "PLAYER_DIED" });
    }
  }
}

/** Roll a monster's loot table; each drop is an independent chance, to the floor. */
function rollDrops(
  state: WorldState,
  content: Content,
  x: number,
  y: number,
  stats: MonsterStats,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  // Boss familiarity (T5·04): each PRIOR clear of a boss nudges the odds of its
  // legendary uniques up a little, hard-capped — so a repeatable apex (Vorlag)
  // and the gap boss reward the grind without the drop ever becoming a sure
  // thing. bossKills is incremented AFTER this roll, so the first kill gets +0.
  const priorClears = stats.boss ? (state.player.bossKills[stats.id] ?? 0) : 0;
  const legendaryBoost = Math.min(0.6, priorClears * 0.05); // +5%/clear, capped +60% relative
  for (const drop of stats.drops) {
    const chance = drop.tier === "legendary" ? drop.chance * (1 + legendaryBoost) : drop.chance;
    if (ctx.rng() >= chance) continue;
    const min = drop.min ?? 1;
    const max = drop.max ?? min;
    const qty = min + Math.floor(ctx.rng() * (max - min + 1));
    // A quest relic — a dungeon key or tablet — must NEVER hit the ground: the
    // 90s ground TTL would despawn it and seal the door it opens (the same
    // softlock dropSlot already guards against for manual drops). Route it into
    // the pack, or the bank if the pack is full.
    if (content.items[drop.item]?.cat === "Quest") {
      const player = state.player;
      if (canAddItem(player, drop.item)) {
        addItem(player, drop.item, qty, events);
      } else {
        player.bank[drop.item] = (player.bank[drop.item] ?? 0) + qty;
        events.push({ type: "ITEM_GAINED", item: drop.item, qty });
        events.push({ type: "LOG", message: `Your pack was full — the ${content.items[drop.item]?.name ?? drop.item} was sent to your bank.` });
      }
      continue;
    }
    dropToGround(state, drop.item, qty, x, y, ctx, false); // each kill = its own pile
    if (drop.item === "shard_of_orun") {
      state.player.killsSinceShard = 0; // a natural drop re-arms the pity timer
      events.push({
        type: "LOG",
        message: "A Shard of Orun — warm and black — falls to the ground.",
      });
    }
  }
  // Every foe can shed a combat draught on top of its own table.
  rollPotionDrop(state, x, y, stats, ctx);
}
