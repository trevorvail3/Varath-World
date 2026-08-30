/**
 * src/content/wildKit.ts
 * ----------------------
 * The shared vocabulary of Varath's wild places: who holds a place, what can be
 * gathered there, and how dangerous either should be at a given level band.
 *
 * Camps and zones are different sizes of the same idea — a place in the open
 * country with foes and resources pitched at how far out it is — so they pick
 * from one table rather than two. A second copy of these pools would drift, and
 * the drift would be invisible: a theme that quietly has nothing near a band
 * produces a place of the wrong difficulty and no error anywhere.
 *
 * RULE 3: pure data + pure pickers.
 */

import { actions } from "./actions.ts";
import { monsters } from "./monsters.ts";

export type WildTheme = "outlaw" | "beast" | "wild" | "cult" | "drowned" | "deep";

/**
 * Who holds what kind of place. Each pool spans the whole level range, and the
 * builder picks the members nearest the camp's band — so a theme is a statement
 * about CHARACTER ("outlaws hold this crossroads") and the band, which comes
 * from geography, decides how dangerous they are.
 */
const THEME_POOL: Record<WildTheme, string[]> = {
  outlaw: ["footpad", "cutpurse", "bandit", "poacher", "hired_blade", "highwayman", "outlaw_archer", "cutthroat", "marauder", "outlaw_captain", "redrun_brigand"],
  beast: ["moor_rat", "hill_wolf", "red_deer", "wild_boar", "forest_bear", "greymane_boar", "mountain_lion", "ridge_wolf", "heartmoor_hound", "hollow_hound", "aerie_harpy"],
  wild: ["gutter_spider", "warren_creeper", "stone_crawler", "mountain_troll", "dusk_stalker", "cave_crawler", "deep_bat", "mire_serpent", "river_serpent", "ancient_orc"],
  cult: ["cult_acolyte", "hollow_hexling", "cult_zealot", "cult_magus", "court_wisp", "storm_wisp", "court_reliquarist", "warren_shade"],
  // The low end matters: this pool started at level 48, so ANY place themed
  // drowned below that overshot its own band — Stillwater at band 38 was holding
  // a level-61 bog knight. A theme has to span the range, or it can only be used
  // in the far country.
  drowned: ["sewer_kobold", "sewer_sludge", "marsh_lurker", "bog_knight", "drowned_thrall", "mire_serpent", "marrow_wraith", "drowned_magistrate"],
  deep: ["spine_wraith", "barrow_sentinel", "deep_golem", "vault_sentinel", "vault_warden", "pale_wight", "sky_warder"],
};

/** The v2 centre of Ironvale — the point every camp's distance is measured from.
 *  Kept here as a plain number so this file stays free of map.ts (see header);
 *  the spread is uniform, so v2 distance is proportional to real distance. */
const CITY_V2 = { x: 81.5, y: 78.5 };

/**
 * A wild place's difficulty band, DERIVED from how far out it is.
 *
 * Hand-assigning bands is how the camp table first got it wrong: the numbers
 * were written against a guessed geography, and `sims/camps.ts` measured the
 * correlation between distance and band at r=0.26 — the gradient the signposts
 * promise did not exist. Deriving it makes the promise true by construction.
 *
 * `nearest`/`farthest` are the real spread of the places being banded, and
 * `lo`/`hi` the levels wanted at each end: a curve anchored to 0 instead of to
 * where the places actually are put a level-26 camp an hour from the gate.
 */
export function bandAt(vx: number, vy: number, nearest: number, farthest: number, lo: number, hi: number): number {
  const d = Math.hypot(vx - CITY_V2.x, vy - CITY_V2.y);
  const t = (d - nearest) / Math.max(1, farthest - nearest);
  return Math.max(8, Math.min(70, Math.round(lo + t * (hi - lo))));
}

/** How far from Ironvale a v2 point is — the only input a band takes. */
export function distanceFromCity(vx: number, vy: number): number {
  return Math.hypot(vx - CITY_V2.x, vy - CITY_V2.y);
}


export type NodeKind = "tree" | "rock" | "forage_spot" | "fishing_spot";

/** Which skill each node kind gathers, for picking a tier from the registry. */
const NODE_SKILL: Record<NodeKind, string> = {
  tree: "forestry", rock: "mining", forage_spot: "survivalist", fishing_spot: "fishing",
};

/**
 * The gatherable of `kind` whose level requirement sits closest to `band`.
 * Derived for the same reason the foes are: a hand-tiered node list drifts the
 * moment a camp's band changes, and a level-8 birch beside a level-63 harpy is
 * a node nobody would ever stop for.
 */
export function nodeFor(kind: NodeKind, band: number, nth: number): { resource: string; species?: string } {
  const pool = actions
    // A gather node has no INPUTS — you walk up and take what is there. Without
    // this the survivalist pool offered "Strip Dusk Bark", which needs a
    // deeproot log in hand: a node that silently refuses everyone who clicks it.
    .filter((a) => a.skill === NODE_SKILL[kind] && !!a.produces
      && !(a as { requires?: unknown }).requires && !(a as { requiresAny?: unknown }).requiresAny
      && (kind !== "forage_spot" || a.group === "forage"))
    .sort((a, b) => Math.abs((a.levelReq ?? 1) - band) - Math.abs((b.levelReq ?? 1) - band));
  const pick = pool[nth % Math.max(1, Math.min(3, pool.length))] ?? pool[0]!;
  // A tree's species is the second half of its action id (fell_greyoak →
  // greyoak), which is what the renderer draws it as.
  const species = kind === "tree" ? /^fell_(.+)$/.exec(pick.id)?.[1] : undefined;
  return species ? { resource: pick.id, species } : { resource: pick.id };
}

/** The `n` foes from a theme whose levels sit closest to `band`. */
export function foesFor(theme: WildTheme, band: number, n: number): string[] {
  const pool = [...THEME_POOL[theme]]
    .filter((id) => !!monsters[id])
    .sort((a, b) => Math.abs((monsters[a]!.level ?? 0) - band) - Math.abs((monsters[b]!.level ?? 0) - band));
  const pick = pool.slice(0, Math.max(2, Math.min(3, pool.length)));
  // Four spawns from up to three kinds, so a camp reads as a group rather than
  // one of everything.
  return Array.from({ length: n }, (_, i) => pick[i % pick.length]!);
}

