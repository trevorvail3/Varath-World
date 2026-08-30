/**
 * sims/rates.ts
 * -------------
 * Measures GATHERING and CRAFTING throughput through the real core, so a change
 * to the tick or to gather cadence can be checked against a recorded baseline.
 *
 *   npx tsx sims/rates.ts            # print a table
 *   npx tsx sims/rates.ts --json     # emit the fixture
 *
 * The player's pack is emptied every tick so a full inventory never throttles
 * the measurement — we are measuring cadence, not carrying capacity.
 */

import { content, makeWorld, SimClock, setLevel, round, TICK_MS } from "./harness.ts";
import { applyIntent, tick } from "../src/core/worldCore.ts";
import type { ItemId, WorldState } from "../src/core/types.ts";

const MINUTES = 10;
const SEEDS = [7, 19, 43];

/** Tool tiers that actually exist as items, per tool kind. */
function toolsFor(kind: "pickaxe" | "hatchet" | "rod"): { id: ItemId; tier: number }[] {
  return Object.entries(content.items)
    .filter(([, d]) => d.tool === kind)
    .map(([id, d]) => ({ id: id as ItemId, tier: d.tier ?? 1 }))
    .filter((t, i, a) => a.findIndex((o) => o.tier === t.tier) === i)
    .sort((a, b) => a.tier - b.tier);
}

/**
 * Stand the player next to `objId` and issue the INTERACT that begins a gather.
 * `path: []` means "I am already adjacent" — the core skips the walk.
 */
function gatherAt(state: WorldState, objId: string, clock: SimClock): void {
  const def = content.objects.find((o) => o.id === objId);
  if (!def) return;
  state.player.pos = { x: def.x + 1, y: def.y };
  state.player.prevPos = { ...state.player.pos };
  state.player.path = [];
  applyIntent(state, content, { type: "INTERACT", objId, path: [] }, clock.ctx());
}

/**
 * Run one gather measurement: returns items gathered per minute.
 * `restart` re-issues the gather whenever the activity stops (node depleted),
 * so we measure the sustained rate including respawn downtime.
 */
function measureGather(
  skill: "mining" | "forestry",
  objId: string,
  toolId: ItemId,
  level: number,
  seed: number,
): number {
  const clock = new SimClock(seed);
  const state = makeWorld(clock);
  const p = state.player;
  setLevel(p, skill, level);
  // Equip the tool DIRECTLY rather than leaving it in the pack to be auto-wielded.
  // `wieldGatherTool` (worldCore.ts:1560) returns early on any usable tool already
  // in hand and never checks the pack for a better tier — so a pack-carried tool
  // would be ignored whenever the starting hatchet is equipped, and we would be
  // measuring tier 1 every time. Equipping isolates the ladder itself.
  p.inventory = p.inventory.map(() => null);
  p.equipment.mainhand = toolId;

  const want = skill === "mining" ? "mining" : "woodcutting";
  let gained = 0;
  const totalMs = MINUTES * 60_000;
  const slice = 16;
  gatherAt(state, objId, clock);
  while (clock.now < totalMs) {
    clock.now += slice;
    for (const e of tick(state, content, clock.ctx())) {
      if (e.type === "ITEM_GAINED") gained += e.qty;
    }
    // Keep the pack empty (slot 0 holds the tool) so capacity never throttles us.
    for (let i = 1; i < p.inventory.length; i++) p.inventory[i] = null;
    // Node depleted (or we were interrupted) — start again, so the measured rate
    // includes respawn downtime the way real play does.
    if (p.activity.kind !== want) gatherAt(state, objId, clock);
  }
  return round(gained / MINUTES, 2);
}

// ---------------------------------------------------------------------------

/**
 * `intervalMs` is the swing cadence the core actually chose — deterministic, and
 * the precise thing tick quantization distorts. `perMin` is sustained throughput
 * on one node including depletion + respawn downtime, averaged over seeds; it is
 * the realistic number but a noisy one, so assert it loosely.
 */
interface Row {
  skill: string; tier: number; tool: string; level: number;
  intervalMs: number | null; perMin: number | null;
}

/** Gathering level needed to wield a tool of this tier (mirrors TOOL_TIER_REQS). */
const TOOL_REQ = [0, 1, 5, 10, 20, 25, 30, 35, 40, 40, 50];

/** The swing interval the core picks for this tool/level — one INTERACT, no ticks. */
function measureInterval(
  skill: "mining" | "forestry",
  objId: string,
  toolId: ItemId,
  level: number,
): number | null {
  const clock = new SimClock(1);
  const state = makeWorld(clock);
  const p = state.player;
  setLevel(p, skill, level);
  p.inventory = p.inventory.map(() => null);
  p.equipment.mainhand = toolId;
  gatherAt(state, objId, clock);
  return p.activity.actionInterval ?? null;
}

function run(): Row[] {
  const rows: Row[] = [];
  const cases: { skill: "mining" | "forestry"; obj: string; tool: "pickaxe" | "hatchet" }[] = [
    { skill: "mining", obj: "rock_knuckle", tool: "pickaxe" },
    { skill: "forestry", obj: "tree_1", tool: "hatchet" },
  ];
  for (const c of cases) {
    const objExists = content.objects.some((o) => o.id === c.obj);
    if (!objExists) { console.error(`!! missing object ${c.obj}`); continue; }
    for (const t of toolsFor(c.tool)) {
      for (const level of [50, 100]) {
        // Skip combinations the level gate makes impossible — a 0.00 there would
        // mean "denied", not "slow", and would poison the fixture.
        const wieldable = level >= (TOOL_REQ[t.tier] ?? 1);
        let perMin: number | null = null;
        if (wieldable) {
          const runs = SEEDS.map((sd) => measureGather(c.skill, c.obj, t.id, level, sd));
          perMin = round(runs.reduce((a, b) => a + b, 0) / runs.length, 2);
        }
        rows.push({
          skill: c.skill, tier: t.tier, tool: t.id, level,
          intervalMs: wieldable ? measureInterval(c.skill, c.obj, t.id, level) : null,
          perMin,
        });
      }
    }
  }
  return rows;
}

const rows = run();
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ tickMs: TICK_MS, minutes: MINUTES, rows }, null, 2));
} else {
  console.log(`TICK_MS=${TICK_MS}  window=${MINUTES}min`);
  for (const r of rows) {
    const v = r.perMin === null ? "  —  (level-gated)" : `${String(r.intervalMs).padStart(5)}ms  ${r.perMin.toFixed(2)}/min`;
    console.log(`${r.skill.padEnd(9)} t${String(r.tier).padStart(2)} ${r.tool.padEnd(11)} lvl${String(r.level).padStart(3)}  ${v}`);
  }
}
export {};
