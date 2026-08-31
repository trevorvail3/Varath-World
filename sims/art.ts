/**
 * sims/art.ts
 * -----------
 * Checks the art layer the way the content layer is checked.
 *
 *   npx tsx sims/art.ts
 *
 * The visual pass found four defects by hand that no gate would ever have
 * caught: seven monsters with no drawing at all (they shipped as rats), three
 * CSS custom properties referenced eleven times and defined nowhere (the shop's
 * Sell button rendered as an empty outline), thirty weapons with no silhouette
 * (bows and staves held swords), and four world-map labels left in the old
 * coordinate space after the world was spread, naming places two hundred tiles
 * from where they are.
 *
 * Every one of those is mechanically checkable. None of them should ever have
 * to be found by looking again. Exits non-zero on failure.
 */

import { readFileSync } from "node:fs";
import { content } from "./harness.ts";
import { BUILDINGS, CITY, REGIONS } from "../src/content/map.ts";
import { materialOf, MATERIALS, TERRAIN } from "../src/client/palette.ts";
import { humanoidKit } from "../src/client/monsterKit.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };
const read = (p: string): string => readFileSync(p, "utf8");

// --- 1) Every monster has a body -------------------------------------------
// `drawMonsterBody`'s default used to be `drawRat`, so a foe with no case of its
// own walked into the world as a rat and nothing said so. The default is now a
// magenta checker, which is loud — but loud in a screenshot nobody takes is
// still silent, so assert it here.
const render = read("src/client/render.ts");
const dispatch = render.slice(
  render.indexOf("function drawMonsterBody"),
  render.indexOf("function drawUnknownBody"),
);
const drawn = new Set([...dispatch.matchAll(/case "([a-z0-9_]+)"/g)].map((m) => m[1]!));
const noBody = Object.keys(content.monsters).filter((m) => !drawn.has(m)).sort();
check(noBody.length === 0, `${noBody.length} monsters have no drawing: ${noBody.join(", ")}`);

// --- 2) Every weapon has a silhouette ---------------------------------------
// `wepType` is authored only on the melee families, so a plain `?? "sword"` put
// a blade in every bow and every staff. gearLook derives the shape instead; this
// asserts the derivation actually covers the armoury.
const RANGED = new Set<string>();
const MAGIC = new Set<string>();
let swordish = 0;
for (const it of Object.values(content.items)) {
  if (!it || it.slot !== "mainhand" || it.tool) continue;
  if (it.ranged) RANGED.add(it.id);
  else if (it.magic) MAGIC.add(it.id);
  else swordish++;
}
check(RANGED.size > 0 && MAGIC.size > 0, "no ranged or magic mainhands found — is the probe reading the right field?");
const gearLook = read("src/client/gearLook.ts");
check(
  /if \(item\.ranged\) return "bow"/.test(gearLook) && /if \(item\.magic\) return "staff"/.test(gearLook),
  "gearLook no longer derives bow/staff shapes — every one of them will draw as a sword",
);
check(!/main\.wepType \?\? "sword"/.test(gearLook), "the bare `wepType ?? \"sword\"` fallback is back in gearLook");

// --- 3) Every CSS custom property resolves ----------------------------------
// --btn, --btn-hi and --edge were used eleven times and never defined, so real
// controls rendered as unfilled outlines with dead hovers.
const css = read("src/style.css");
const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]!));
const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]!));
// A var() with its own fallback (`var(--x, #ccc)`) is allowed to be undefined.
const withFallback = new Set(
  [...css.matchAll(/var\((--[a-z0-9-]+)\s*,/g)].map((m) => m[1]!),
);
const undef = [...used].filter((v) => !defined.has(v) && !withFallback.has(v)).sort();
check(undef.length === 0, `${undef.length} CSS custom properties are used but never defined: ${undef.join(", ")}`);

// --- 4) The world map names places where they are ---------------------------
// Four labels were legacy coordinates never put through the expansion. They are
// derived from the world now; this asserts the derivation lands.
const minimap = read("src/client/minimap.ts");
check(
  /function extraLabels/.test(minimap) && !/const EXTRA_LABELS/.test(minimap),
  "the world map's hamlet labels are hardcoded again — they will drift the next time the map moves",
);
for (const pal of ["redmouth", "drover", "fold"]) {
  const parts = BUILDINGS.filter((b) => b.palette === pal);
  check(parts.length > 0, `no buildings carry the "${pal}" palette — its map label has nothing to derive from`);
  if (parts.length === 0) continue;
  let sx = 0, sy = 0;
  for (const b of parts) { sx += (b.x0 + b.x1) / 2; sy += (b.y0 + b.y1) / 2; }
  const cx = sx / parts.length, cy = sy / parts.length;
  // The label must land on top of the buildings it names, not near them.
  const near = parts.some((b) => Math.hypot((b.x0 + b.x1) / 2 - cx, (b.y0 + b.y1) / 2 - cy) < 8);
  check(near, `the "${pal}" label sits clear of every building it names`);
}
const keeper = content.objects.find((o) => o.id === "trail_keeper");
check(!!keeper, "trail_keeper is gone — the Varathian Trail label has no anchor");

// --- 5) One palette, read by everyone ---------------------------------------
// The world renderer and the minimap each kept their own tile table, and the
// pack icons knew twenty-eight materials while the worn figure knew seven.
check(
  render.includes('from "./palette.ts"') && minimap.includes('from "./palette.ts"'),
  "the world and the map no longer share a terrain table",
);
check(MATERIALS.length >= 27, `the material table has shrunk to ${MATERIALS.length}`);
check(Object.keys(TERRAIN).length >= 16, "the terrain table is missing tile types");
for (const [key] of MATERIALS) {
  check(materialOf(`a ${key} thing`)?.base === MATERIALS.find(([k]) => k === key)![1].base,
    `materialOf cannot find "${key}" — its ordering has broken`);
}

// --- 6) The humanoid foes are not one foe ------------------------------------
// Forty-seven of the eighty-five monsters share `drawHumanoid` and used to
// differ by exactly two hex values. The kit is derived from the stat block, so
// this asserts the derivation actually produces a spread rather than collapsing
// everything onto one silhouette again.
const dispatchSrc = render.slice(
  render.indexOf("function drawMonsterBody"), render.indexOf("function drawUnknownBody"),
);
const humanoids = [...dispatchSrc.matchAll(/case "([a-z0-9_]+)":[\s\S]{0,40}?return H\(/g)].map((m) => m[1]!);
check(humanoids.length > 30, `only ${humanoids.length} humanoid foes found — is the dispatch still shaped like this?`);
const kits = new Set<string>();
for (const id of humanoids) {
  const k = humanoidKit(id);
  kits.add(`${k.helm}|${k.weapon}|${k.cloak}`);
}
check(kits.size >= 12, `the humanoid foes collapse onto ${kits.size} silhouettes`);
check(render.includes('from "./monsterKit.ts"'), "the renderer no longer reads the humanoid kit — every human foe is one figure again");

// --- 7) Items do not all look the same ---------------------------------------
// 710 items are classified into shapes by keyword. The measure that matters is
// how many distinct SILHOUETTES that produces — colour alone does not tell a
// cape from a cape at icon size. Thirty-seven cooked dishes were one portion and
// thirty-six cloaks were one outline; both are broken up by the item's own hash.
const icon = read("src/client/itemIcon.ts");
check(/const ARMOUR_SHAPES/.test(icon), "worn armour no longer routes through the tier ladder — the arbitrary brown is back");
check(/function armourRank/.test(icon), "armourRank is gone; armour with no authored tier falls back to a hash again");
for (const sh of ["pickaxe", "hatchet", "bow", "staff", "cape", "ring", "amulet"]) {
  check(new RegExp(`"${sh}"`).test(icon.slice(icon.indexOf("const TIER_SHAPES"), icon.indexOf("function armourRank"))),
    `"${sh}" has lost its tier flourish — its whole ladder is one picture again`);
}
for (const sh of ["helmHood", "helmCoif", "bodyRobe", "bodyJerkin"]) {
  check(icon.includes(`case "${sh}":`), `the "${sh}" silhouette is gone — helms and bodies collapse back to one shape each`);
}

// --- 8) The world's moods cover the world ------------------------------------
// The whole point of the atmosphere step: `hills` was 97.4% of the overworld
// and had no grade and no weather. Assert every biome the renderer can return
// has a tint, and that the open country is genuinely split up.
const tintBlock = render.slice(render.indexOf("const BIOME_TINT"), render.indexOf("function tintLum"));
const biomeType = render.slice(render.indexOf("export type Biome ="), render.indexOf("/** The centre of Ironvale"));
const biomes = [...biomeType.matchAll(/"([a-z]+)"/g)].map((m) => m[1]!);
check(biomes.length >= 13, `only ${biomes.length} biomes — the open country is not split up`);
for (const b of biomes) {
  check(new RegExp(`\\b${b}:`).test(tintBlock), `biome "${b}" has no colour grade`);
}
check(REGIONS.length === 6 && CITY.x1 > CITY.x0, "the regions/city the biome map is built on have moved");

console.log(
  `monsters ${Object.keys(content.monsters).length} (${humanoids.length} humanoid → ${kits.size} silhouettes)` +
  ` · weapons ${RANGED.size} ranged / ${MAGIC.size} magic / ${swordish} melee` +
  ` · css vars ${defined.size} defined, ${used.size} used · materials ${MATERIALS.length} · biomes ${biomes.length}`,
);
if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails.slice(0, 12)) console.error("  - " + f);
  if (fails.length > 12) console.error(`  … and ${fails.length - 12} more`);
  process.exit(1);
}
console.log("\nPASS");
