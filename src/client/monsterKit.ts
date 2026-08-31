/**
 * src/client/monsterKit.ts
 * ------------------------
 * What a humanoid foe is turned out in — derived from its own stat block.
 *
 * Pure data and arithmetic, no DOM: the renderer draws from it and a sim can
 * import it to assert on it.
 */

import { monsters } from "../content/monsters.ts";

/**
 * The kit a humanoid foe is turned out in.
 *
 * Sixty of the eighty-five monsters route through `drawHumanoid`, and they used
 * to differ by exactly two hex values: a town guard, a barrow king and a pale
 * warden were the same figure in three shades. Writing sixty draw functions
 * would be sixty places to keep in step, so instead the figure reads a kit —
 * and the kit is DERIVED from the stat block the monster already has. A caster
 * caster's `attackStyle` is already "magic", so it gets a hood and a staff; an
 * archer's is "ranged", so it gets a cap and a bow; "crush" gets a great helm
 * and a maul, "stab" a kettle helm and a spear. Level decides the build, and a
 * boss gets a cloak.
 *
 * Nothing new is authored for the common case. The override table below is only
 * for the handful whose silhouette is part of who they are.
 */
export interface HumanoidKit {
  helm: "none" | "hood" | "cap" | "kettle" | "great" | "crown";
  weapon: "none" | "sword" | "spear" | "maul" | "staff" | "bow" | "axe";
  cloak: boolean;
  /** Body scale — a level-10 footpad is not the size of a level-90 warlord. */
  build: number;
}

/** The few whose silhouette IS their character; everything else is derived. */
const KIT_OVERRIDE: Record<string, Partial<HumanoidKit>> = {
  barrow_king: { helm: "crown", weapon: "sword", cloak: true },
  drowned_magistrate: { helm: "crown", weapon: "staff", cloak: true },
  outlaw_captain: { helm: "kettle", weapon: "sword", cloak: true },
  marrow_keeper: { helm: "hood", weapon: "staff", cloak: true },
  quartermaster_brann: { helm: "kettle", weapon: "axe" },
  pale_warden: { helm: "hood", weapon: "none", cloak: true },
  pale_herald: { helm: "hood", weapon: "none", cloak: true },
  master_farmer: { helm: "none", weapon: "none" },
  field_farmer: { helm: "none", weapon: "none" },
  outlaw_archer: { helm: "cap", weapon: "bow" },
  storm_herald: { helm: "hood", weapon: "staff", cloak: true },
  hollow_prophet: { helm: "hood", weapon: "staff", cloak: true },
  green_baron: { helm: "cap", weapon: "bow", cloak: true },
};

export function humanoidKit(id: string | undefined): HumanoidKit {
  const m = id ? monsters[id] : undefined;
  const lvl = m?.level ?? 10;
  // Derived from what the foe already is.
  const style = m?.attackStyle;
  const base: HumanoidKit = {
    helm: style === "magic" ? "hood" : style === "ranged" ? "cap"
      : style === "crush" ? "great"
      : style === "stab" ? "kettle"
      : lvl >= 40 ? "great" : "cap",
    weapon: style === "magic" ? "staff" : style === "ranged" ? "bow"
      : style === "crush" ? "maul"
      : style === "stab" ? "spear" : "sword",
    cloak: !!m?.boss || lvl >= 60,
    // 0.88 at level 1 → 1.16 at level 100: a real spread without cartooning it.
    build: 0.88 + Math.min(1, lvl / 100) * 0.28,
  };
  return { ...base, ...(id ? KIT_OVERRIDE[id] : undefined) };
}
