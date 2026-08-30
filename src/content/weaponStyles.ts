/**
 * src/content/weaponStyles.ts
 * ---------------------------
 * OSRS attack options: each weapon family offers a handful of ways to swing it,
 * and each option picks BOTH the damage type and the stance (which decides the
 * accuracy/damage/defence weighting and where the XP goes).
 *
 * This is what turns the weakness triangle into a live decision. Until now the
 * triangle was settled by which weapon you brought — a sword dealt slash and
 * that was that. With attack options you meet a crush-weak foe and switch to
 * Pound, mid-fight, without going back to the bank. The triangle machinery
 * (weakness multipliers, the wardshift bosses that rotate their weakness by HP
 * phase) already existed and was waiting for this.
 *
 * An option's `stance` is one of the EXISTING CombatStyle values on purpose, so
 * the stance weighting, the kill-XP split and the duel snapshot all keep working
 * untouched — this adds a damage-type choice on top of the stance choice rather
 * than replacing the stance system.
 *
 * RULE 1 SAFE: pure data and pure functions. No clock, no RNG, no DOM.
 */

import type { CombatStyle, ItemDef } from "../core/types.ts";

/** The weapon families that have their own set of attack options. */
export type WepType =
  | "sword" | "dagger" | "spear" | "hammer" | "claymore"
  | "bow" | "staff" | "tool" | "unarmed";

export interface AttackOption {
  /** Stable id, used by the save and the intent. */
  id: string;
  /** What the button says — OSRS names these after the motion, not the stat. */
  name: string;
  /** The damage type this swing deals; what the weakness triangle reads. */
  type: "stab" | "slash" | "crush" | "ranged" | "magic";
  /** The stance weighting + XP destination (an existing CombatStyle). */
  stance: CombatStyle;
}

/**
 * Work out a weapon's family.
 *
 * A deriver is required, not a convenience: only 30 of the game's ~58 weapons
 * carry an explicit `wepType`, and NONE of the bows or staves do. A bare lookup
 * table would silently leave half the arsenal with no attack options at all.
 * Falls through progressively: explicit field, then the ranged/magic flags, then
 * the material-tier id prefix, then the weapon's own attackStyle.
 */
export function wepTypeOf(def: ItemDef | undefined): WepType {
  if (!def) return "unarmed";
  if (def.tool) return "tool";
  const explicit = def.wepType;
  if (explicit === "sword" || explicit === "dagger" || explicit === "spear"
    || explicit === "hammer" || explicit === "claymore") return explicit;
  if (def.ranged) return "bow";
  if (def.magic) return "staff";
  const id = def.id;
  if (id.startsWith("claymore_")) return "claymore";
  if (id.startsWith("sword_")) return "sword";
  if (id.startsWith("dagger_")) return "dagger";
  if (id.startsWith("spear_")) return "spear";
  if (id.startsWith("hammer_")) return "hammer";
  switch (def.attackStyle) {
    case "stab": return "dagger";
    case "crush": return "hammer";
    case "slash": return "sword";
    default: return def.slot === "mainhand" ? "sword" : "unarmed";
  }
}

const o = (id: string, name: string, type: AttackOption["type"], stance: CombatStyle): AttackOption =>
  ({ id, name, type, stance });

/**
 * The options each family offers.
 *
 * Every melee family gets a way to reach at least two of the three melee damage
 * types, so no weapon is ever locked out of a fight it brought the wrong edge
 * to — it just does it less well, because an off-style attack bonus is a
 * fraction of the weapon's own (see equipBonus.ts).
 */
export const WEAPON_STYLES: Record<WepType, AttackOption[]> = {
  sword: [
    o("chop", "Chop", "slash", "edge"),
    o("slash", "Slash", "slash", "vigour"),
    o("lunge", "Lunge", "stab", "controlled"),
    o("block", "Block", "slash", "ward"),
  ],
  dagger: [
    o("stab", "Stab", "stab", "edge"),
    o("gouge", "Gouge", "stab", "vigour"),
    o("slice", "Slice", "slash", "controlled"),
    o("block", "Block", "stab", "ward"),
  ],
  // The spear is THE triangle weapon: it can reach all three melee types, and
  // pays for the flexibility by being controlled (a jack of all trades) on each.
  spear: [
    o("lunge", "Lunge", "stab", "controlled"),
    o("swipe", "Swipe", "slash", "controlled"),
    o("pound", "Pound", "crush", "controlled"),
    o("block", "Block", "stab", "ward"),
  ],
  hammer: [
    o("pound", "Pound", "crush", "edge"),
    o("pummel", "Pummel", "crush", "vigour"),
    o("spike", "Spike", "stab", "controlled"),
    o("block", "Block", "crush", "ward"),
  ],
  claymore: [
    o("chop", "Chop", "slash", "edge"),
    o("hack", "Hack", "slash", "vigour"),
    o("smash", "Smash", "crush", "vigour"),
    o("block", "Block", "slash", "ward"),
  ],
  bow: [
    o("accurate", "Accurate", "ranged", "edge"),
    o("rapid", "Rapid", "ranged", "vigour"),
    o("longrange", "Longrange", "ranged", "ward"),
  ],
  staff: [
    o("accurate", "Accurate", "magic", "edge"),
    o("focused", "Focused", "magic", "vigour"),
    o("defensive", "Defensive", "magic", "ward"),
  ],
  // A pickaxe is not a weapon, but you can still swing it at something.
  tool: [
    o("bash", "Bash", "crush", "edge"),
    o("block", "Block", "crush", "ward"),
  ],
  unarmed: [
    o("punch", "Punch", "crush", "edge"),
    o("kick", "Kick", "crush", "vigour"),
    o("block", "Block", "crush", "ward"),
  ],
};

/**
 * The option a weapon starts on.
 *
 * It must reproduce what that weapon did BEFORE attack options existed —
 * the first option whose damage type matches the weapon's own `attackStyle`.
 * Defaulting to a fixed index instead silently re-styled half the arsenal: a
 * spear authored as `stab` would have defaulted to Swipe and started dealing
 * slash, changing which monsters it exploited without the player touching
 * anything.
 */
export function defaultOptionIndex(wt: WepType, def?: ItemDef): number {
  const opts = WEAPON_STYLES[wt];
  const own = def?.attackStyle;
  if (own) {
    const i = opts.findIndex((op) => op.type === own);
    if (i >= 0) return i;
  }
  // No authored style (bows, staves, fists): the plain aggressive swing.
  const agg = opts.findIndex((op) => op.stance === "vigour");
  return agg >= 0 ? agg : 0;
}

/**
 * The index of the option on `wt` that uses `stance` — preferring one that also
 * matches the weapon's own damage type, so restoring a saved stance does not
 * quietly re-style the weapon.
 */
export function optionIndexForStance(wt: WepType, stance: CombatStyle, def?: ItemDef): number {
  const opts = WEAPON_STYLES[wt];
  const own = def?.attackStyle;
  if (own) {
    const exact = opts.findIndex((op) => op.stance === stance && op.type === own);
    if (exact >= 0) return exact;
  }
  const i = opts.findIndex((op) => op.stance === stance);
  return i >= 0 ? i : defaultOptionIndex(wt, def);
}
