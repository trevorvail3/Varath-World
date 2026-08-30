/**
 * src/core/duelCore.ts
 * --------------------
 * The duel engine: a tiny, PURE, deterministic player-vs-player fight that two
 * clients can run in lockstep. Each side exchanges only INTENTS (eat, arm the
 * special) tagged with tick numbers; both machines simulate the identical
 * fight from a shared seed, so neither client can lie about damage or HP —
 * the opponent's machine computes the same fight, and state hashes catch any
 * divergence. OSRS-style tick cadence makes this latency-proof: a duel tick is
 * 600ms and swings land seconds apart, so even a slow connection feels right.
 *
 * The fight itself is a stationary ring duel (no movement): swing timers by
 * weapon speed, the same hit-chance curve as PvE (att / (att + def·1.35)),
 * food on a cooldown, and the special-attack bar. PvP tuning flattens damage
 * (PVP_DMG) and softens the special so fights are decided by tempo — eating,
 * spec timing — rather than one lucky one-shot.
 *
 * Nothing here touches WorldState: fighters are SNAPSHOTS (built by
 * duelFighterFrom in worldCore), and the outcome is applied to each player's
 * own save afterwards through the idempotent DUEL_RESOLVE intent — the same
 * "each client applies its own half" trust model live trading already uses.
 */

import type { Appearance, CombatStyle, EquipSlot, ItemId, Player } from "./types.ts";

/** One duel tick, in real milliseconds (matches the world's combat feel). */
export const DUEL_TICK_MS = 600;
/** A duel that somehow outlives this many ticks is called on remaining HP. */
export const DUEL_MAX_TICKS = 300; // 3 minutes
/** Eating is throttled so a stocked pack can't stall a duel forever. */
export const DUEL_EAT_CD_TICKS = 3; // one bite per 1.8s
/** PvP damage is flattened: multipliers tuned against monster HP pools would
 *  one-shot a same-level player. */
export const PVP_DMG = 0.65;
/** The special hits harder, not obliterates (PvE melee spec is 1.5×). */
export const PVP_SPEC_MULT = 1.25;
const SPEC_GAIN_PER_HIT = 12;
const SPEC_MAX = 100;
/**
 * The combat maths a fighter snapshot was built with. Folded into the desync
 * fingerprint and checked at duel start: two clients on different builds would
 * otherwise compute different damage from the same inputs and desync mid-fight —
 * over real staked gold. Bump this whenever the PvE formulas change.
 */
export const COMBAT_FORMULA_VERSION = 2;

/** A bite of food carried into the ring: what it heals and what it was. */
export interface DuelFood { item: ItemId; heal: number; count: number }

/**
 * The recompute kit: the player state the combat formulas read, frozen at
 * snapshot time, so BOTH clients can re-derive a fighter's stats when they swap
 * gear mid-fight. Skills/style/buffs never change during a duel; only the worn
 * `equipment` does, and equipment lives on the fighter itself. Because the kit
 * and the swap intent are identical on both machines, the recompute agrees.
 */
export interface DuelKit {
  skills: Player["skills"];
  combatStyle: CombatStyle;
  buffs: Record<string, { amount: number; until: number }>;
}

/** Everything the fight needs to know about one combatant. Stats are a SNAPSHOT
 *  taken when the stakes lock (no mid-duel bank runs), but the OSRS switch game
 *  is preserved: `bench` is the swappable gear carried into the ring, and `kit`
 *  lets both sims recompute acc/dmg/def/speed when a piece is equipped. */
export interface DuelFighter {
  name: string;
  /** Cosmetics so the ring can draw the real person (look + worn gear ids). */
  look: Appearance;
  equipment: Partial<Record<EquipSlot, ItemId>>;
  combatLevel: number;
  maxHp: number;
  acc: number;
  dmg: number;
  def: number;
  /** Swing interval in duel ticks (weapon speed / DUEL_TICK_MS, min 3). */
  speedTicks: number;
  ranged: boolean;
  /** Which combat maths built this snapshot — see COMBAT_FORMULA_VERSION. */
  formulaVersion: number;
  food: DuelFood[];
  /** Equippable gear brought into the ring but not worn — the switch pool. */
  bench: ItemId[];
  /** Frozen player state for recomputing stats on a mid-fight gear swap. */
  kit: DuelKit;
}

/** The live, replicated state of one side. */
export interface DuelSideState {
  hp: number;
  nextSwing: number;   // tick of the next swing
  eatReadyAt: number;  // tick when the next bite is allowed
  spec: number;        // 0–100 charge
  specArmed: boolean;
  eaten: DuelFood[];   // consumed bites, settled against the real pack after
}

export type DuelIntent =
  | { t: "eat"; item?: ItemId }   // eat a specific food, or the biggest bite
  | { t: "spec" }
  | { t: "equip"; item: ItemId }; // swap a bench piece into its slot

export interface DuelEvent {
  tick: number;
  side: "a" | "b";        // who ACTED (swung / ate / armed / swapped)
  kind: "hit" | "miss" | "eat" | "spec" | "equip" | "end";
  value?: number;         // damage dealt or HP healed
  item?: ItemId;          // the food eaten or the gear equipped
}

export interface DuelState {
  tick: number;
  a: DuelSideState;
  b: DuelSideState;
  over: boolean;
  /** "a" | "b" | null — null while running, or a draw at the tick cap. */
  winner: "a" | "b" | null;
  rngState: number;
}

/** The shared PRNG: both clients seed from the duel id, so the fight is one
 *  agreed sequence of rolls no matter whose machine runs it. */
export function duelSeed(duelId: string): number {
  let h = 2166136261;
  for (let i = 0; i < duelId.length; i++) {
    h ^= duelId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

/**
 * A standalone mulberry32 generator: `mulberry32(seed)` returns an rng closure
 * suitable for a `Ctx`. Used by the headless sims under `sims/`, which need a
 * deterministic `ctx.rng` so a run is reproducible.
 *
 * NOTE: this deliberately duplicates the five lines of arithmetic in `nextRng`
 * below rather than having `nextRng` delegate to it. `nextRng` keeps its state
 * on `DuelState.rngState` because that field is serialized and folded into the
 * lockstep desync hash — routing it through a closure would decouple the two.
 * If you change the algorithm, change BOTH.
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextRng(state: DuelState): number {
  // mulberry32 — tiny, fast, and identical everywhere.
  state.rngState = (state.rngState + 0x6d2b79f5) | 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function duelCreate(seed: number): DuelState {
  const side = (): DuelSideState => ({
    hp: 0, nextSwing: 2, eatReadyAt: 0, spec: 0, specArmed: false, eaten: [],
  });
  return { tick: 0, a: side(), b: side(), over: false, winner: null, rngState: seed | 0 || 1 };
}

/** Initialise both sides' HP from their snapshots (kept out of duelCreate so
 *  the state can be built before the opponent's snapshot arrives). */
/**
 * True when two snapshots were built by the same combat maths. A duel between
 * mismatched builds would compute different damage from identical inputs and
 * desync mid-fight, with real staked gold on the line — the caller must refuse
 * the duel rather than start one it cannot finish fairly.
 */
export function duelFormulasMatch(a: DuelFighter, b: DuelFighter): boolean {
  return (a.formulaVersion ?? 0) === (b.formulaVersion ?? 0)
    && (a.formulaVersion ?? 0) === COMBAT_FORMULA_VERSION;
}

export function duelStart(state: DuelState, a: DuelFighter, b: DuelFighter): void {
  state.a.hp = a.maxHp;
  state.b.hp = b.maxHp;
  // The slower weapon swings first a beat later; both start on tick 2 so the
  // opening exchange never lands before the countdown clears.
  state.a.nextSwing = 2;
  state.b.nextSwing = 2;
}


/** OSRS's accuracy curve, mirroring worldCore's `accuracyFrom` exactly. Both
 *  arguments are ROLLS (effective level x (bonus + 64)), not ratings. */
function hitChance(att: number, def: number): number {
  const a = Math.max(1, att);
  const d = Math.max(1, def);
  return a > d ? 1 - (d + 2) / (2 * (a + 1)) : a / (2 * (d + 1));
}

/** Bites of a given food still left in the satchel. */
function bitesLeft(f: DuelFighter, s: DuelSideState, item: ItemId): number {
  const total = f.food.filter((fd) => fd.item === item).reduce((n, fd) => n + fd.count, 0);
  const eaten = s.eaten.filter((e) => e.item === item).reduce((n, e) => n + e.count, 0);
  return total - eaten;
}

/** The bite to eat: a specific food if asked (and any remains), else the biggest
 *  heal still in the satchel. */
function nextBite(f: DuelFighter, s: DuelSideState, prefer?: ItemId): DuelFood | null {
  if (prefer) {
    const fd = f.food.find((x) => x.item === prefer);
    if (fd && bitesLeft(f, s, prefer) > 0) return fd;
  }
  let best: DuelFood | null = null;
  for (const fd of f.food) {
    if (bitesLeft(f, s, fd.item) <= 0) continue;
    if (!best || fd.heal > best.heal) best = fd;
  }
  return best;
}

/**
 * Advance the duel by ONE tick, applying each side's intents for that tick.
 * Deterministic: same state + same intents (in a-then-b order) = same result
 * on every machine. Returns the tick's events for presentation.
 */
export function duelStep(
  state: DuelState,
  fighters: { a: DuelFighter; b: DuelFighter },
  intents: { a: DuelIntent[]; b: DuelIntent[] },
): DuelEvent[] {
  if (state.over) return [];
  const events: DuelEvent[] = [];
  state.tick += 1;
  const t = state.tick;

  // 1) Intents, side A first ALWAYS (the deterministic order both sims share).
  for (const side of ["a", "b"] as const) {
    const s = state[side];
    const f = fighters[side];
    for (const it of intents[side]) {
      if (it.t === "eat" && t >= s.eatReadyAt && s.hp < f.maxHp) {
        const bite = nextBite(f, s, it.item);
        if (!bite) continue;
        s.eaten.push({ item: bite.item, heal: bite.heal, count: 1 });
        s.hp = Math.min(f.maxHp, s.hp + bite.heal);
        s.eatReadyAt = t + DUEL_EAT_CD_TICKS;
        events.push({ tick: t, side, kind: "eat", value: bite.heal, item: bite.item });
      } else if (it.t === "spec" && !s.specArmed && s.spec >= SPEC_MAX) {
        s.specArmed = true;
        s.spec = 0;
        events.push({ tick: t, side, kind: "spec" });
      }
    }
  }

  // 2) Swings, side A first (same shared order; a KO stops the return blow).
  for (const side of ["a", "b"] as const) {
    if (state.over) break;
    const other = side === "a" ? "b" : "a";
    const me = state[side];
    const foe = state[other];
    const f = fighters[side];
    const g = fighters[other];
    if (t < me.nextSwing) continue;
    me.nextSwing = t + f.speedTicks;
    const special = me.specArmed;
    me.specArmed = false;
    if (special || nextRng(state) < hitChance(f.acc, g.def)) {
      const maxHit = Math.max(1, Math.round(f.dmg * PVP_DMG * (special ? PVP_SPEC_MULT : 1)));
      // Uniform from ZERO like PvE, except a spent special always does something.
      const dmg = special
        ? 1 + Math.floor(nextRng(state) * maxHit)
        : Math.floor(nextRng(state) * (maxHit + 1));
      foe.hp = Math.max(0, foe.hp - dmg);
      me.spec = Math.min(SPEC_MAX, me.spec + SPEC_GAIN_PER_HIT);
      events.push({ tick: t, side, kind: "hit", value: dmg });
      if (foe.hp <= 0) {
        state.over = true;
        state.winner = side;
        events.push({ tick: t, side, kind: "end" });
      }
    } else {
      events.push({ tick: t, side, kind: "miss" });
    }
  }

  // 3) The tick cap: call it on remaining HP fraction; a dead heat is a draw.
  if (!state.over && t >= DUEL_MAX_TICKS) {
    state.over = true;
    const fa = state.a.hp / fighters.a.maxHp;
    const fb = state.b.hp / fighters.b.maxHp;
    state.winner = fa > fb ? "a" : fb > fa ? "b" : null;
    events.push({ tick: t, side: state.winner ?? "a", kind: "end" });
  }
  return events;
}

/** A cheap replicated-state fingerprint: compare across clients each few ticks
 *  to catch desyncs (a mismatch voids the duel and returns both stakes). */
export function duelHash(state: DuelState): number {
  let h = state.tick;
  for (const s of [state.a, state.b]) {
    h = (Math.imul(h, 31) + s.hp) | 0;
    h = (Math.imul(h, 31) + s.spec + (s.specArmed ? 7 : 0)) | 0;
    h = (Math.imul(h, 31) + s.eaten.length) | 0;
  }
  h = (Math.imul(h, 31) + state.rngState) | 0;
  return h | 0;
}

/** A fingerprint of a fighter's LIVE combat stats — folded into the desync hash
 *  so a gear swap that lands differently on the two clients is caught (the base
 *  state hash doesn't see equipment). */
export function fighterFingerprint(f: DuelFighter): number {
  let h = 0;
  h = (Math.imul(h, 31) + Math.round(f.acc)) | 0;
  h = (Math.imul(h, 31) + Math.round(f.dmg)) | 0;
  h = (Math.imul(h, 31) + Math.round(f.def)) | 0;
  h = (Math.imul(h, 31) + f.speedTicks + (f.ranged ? 101 : 0)) | 0;
  h = (Math.imul(h, 31) + (f.formulaVersion ?? 0)) | 0;
  h = (Math.imul(h, 31) + f.bench.length) | 0;
  return h | 0;
}
