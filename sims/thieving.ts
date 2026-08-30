/**
 * sims/thieving.ts
 * ----------------
 * Checks the Thieving skill.
 *
 *   npx tsx sims/thieving.ts
 *
 * A skill built on a success roll is easy to get wrong in ways nobody notices
 * for weeks: a level gate that never opens, a success rate that does not improve
 * with level, a stun that does not actually hold you. Exits non-zero on failure.
 */

import { content, makeWorld, SimClock, setLevel, levelOf, round } from "./harness.ts";
import { applyIntent, tick, TICK_MS } from "../src/core/worldCore.ts";
import type { WorldState } from "../src/core/types.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

/** Stand next to a target and try to rob it once. Returns what happened. */
function steal(
  targetId: string,
  level: number,
  seed: number,
): { ok: boolean; denied: boolean; stunned: boolean; gold: number } {
  const clock = new SimClock(seed);
  const st = makeWorld(clock);
  const p = st.player;
  setLevel(p, "thieving", level);
  const def = content.objects.find((o) => o.id === targetId);
  if (!def) return { ok: false, denied: true, stunned: false, gold: 0 };
  p.pos = { x: def.x + 1, y: def.y };
  p.prevPos = { ...p.pos };
  p.path = [];
  const before = p.gold;
  const mode = def.kind === "npc" ? ("steal" as const) : undefined;
  const ev = applyIntent(st, content, { type: "INTERACT", objId: targetId, path: [], ...(mode ? { mode } : {}) }, clock.ctx());
  const logs = ev.filter((e) => e.type === "LOG").map((e) => (e as { message: string }).message);
  return {
    ok: logs.some((m) => /you lift|you get a hand in/i.test(m)),
    denied: logs.some((m) => /you need Thieving/i.test(m)),
    stunned: p.stunnedUntil !== undefined,
    gold: p.gold - before,
  };
}

/** Success rate over many attempts at a given level. */
function rate(targetId: string, level: number, n = 120): number {
  let ok = 0;
  for (let i = 0; i < n; i++) if (steal(targetId, level, 1000 + i * 7).ok) ok++;
  return ok / n;
}

// --- 1. Every roster entry points at something that exists ------------------
for (const t of content.thieveTargets) {
  const def = content.objects.find((o) => o.id === t.id);
  check(!!def, `thieve target "${t.id}" has no world object`);
  if (!def) continue;
  const wantKind = t.kind === "stall" ? "stall" : "npc";
  check(def.kind === wantKind, `${t.id} is a ${def.kind}, expected ${wantKind}`);
  check(t.successCap > t.success, `${t.id}: success cap must beat its floor`);
  check(t.levelReq >= 1 && t.levelReq <= 99, `${t.id}: odd level requirement`);
}
console.log(`targets: ${content.thieveTargets.length} (${content.thieveTargets.filter((t) => t.kind === "stall").length} stalls)`);

// --- 2. The level gate actually gates, and actually opens -------------------
{
  const hard = [...content.thieveTargets].sort((a, b) => b.levelReq - a.levelReq)[0]!;
  check(steal(hard.id, hard.levelReq - 1, 3).denied, `${hard.id} should refuse a player one level short`);
  check(!steal(hard.id, hard.levelReq, 3).denied, `${hard.id} should allow a player at its own level`);
}

// --- 3. Getting better at the skill actually helps --------------------------
{
  const t = content.thieveTargets.find((x) => x.kind === "pocket" && x.levelReq <= 10)!;
  const atReq = rate(t.id, t.levelReq);
  const atMax = rate(t.id, 100);
  console.log(`${t.id}: ${round(atReq * 100, 1)}% at level ${t.levelReq} -> ${round(atMax * 100, 1)}% at 100`);
  check(atMax > atReq + 0.1, `outlevelling ${t.id} should clearly improve it (${atReq} -> ${atMax})`);
  check(atReq > 0.2 && atReq < 0.9, `${t.id} at its own level should be a real gamble, is ${atReq}`);
}

// --- 4. A botched pickpocket holds you; a stall never does ------------------
{
  const pocket = content.thieveTargets.find((t) => t.kind === "pocket")!;
  let sawStun = false;
  for (let i = 0; i < 60 && !sawStun; i++) sawStun = steal(pocket.id, pocket.levelReq, 500 + i).stunned;
  check(sawStun, "a failed pickpocket should be able to stun");

  const stall = content.thieveTargets.find((t) => t.kind === "stall")!;
  let stallStun = false;
  for (let i = 0; i < 60; i++) if (steal(stall.id, stall.levelReq, 700 + i).stunned) stallStun = true;
  check(!stallStun, "a stall has no owner willing to hold you — it should never stun");
}

// --- 5. The stun genuinely stops you moving ---------------------------------
{
  const clock = new SimClock(9);
  const st: WorldState = makeWorld(clock);
  const p = st.player;
  setLevel(p, "thieving", 1);
  const start = { ...p.pos };
  p.stunnedUntil = clock.now + 3000;
  p.path = [{ x: p.pos.x + 1, y: p.pos.y }, { x: p.pos.x + 2, y: p.pos.y }];
  for (let i = 0; i < 4; i++) { clock.now += TICK_MS; tick(st, content, clock.ctx()); }
  check(p.pos.x === start.x && p.pos.y === start.y, "a stunned player must not move");
  // ...and lets go afterwards.
  for (let i = 0; i < 10; i++) { clock.now += TICK_MS; tick(st, content, clock.ctx()); }
  check(p.stunnedUntil === undefined, "the stun should wear off");
}

// --- 6. A theft pays, and the target goes quiet afterwards ------------------
{
  const t = content.thieveTargets.find((x) => x.kind === "stall")!;
  let paid = 0, tries = 0;
  for (let i = 0; i < 60 && paid === 0; i++) { tries++; paid = steal(t.id, 100, 900 + i).gold; }
  check(paid > 0, `a successful theft from ${t.id} should pay something (in ${tries} tries)`);

  // Immediately trying the same target again must be refused.
  const clock = new SimClock(11);
  const st = makeWorld(clock);
  setLevel(st.player, "thieving", 100);
  const def = content.objects.find((o) => o.id === t.id)!;
  st.player.pos = { x: def.x + 1, y: def.y };
  st.player.prevPos = { ...st.player.pos };
  applyIntent(st, content, { type: "INTERACT", objId: t.id, path: [] }, clock.ctx());
  const second = applyIntent(st, content, { type: "INTERACT", objId: t.id, path: [] }, clock.ctx());
  const refused = second.some((e) => e.type === "LOG" && /nothing left|watching you/i.test((e as { message: string }).message));
  check(refused, "a target just robbed should refuse a second lift until it recovers");
}

// --- 7. The skill is real: it appears, and it levels -------------------------
{
  const clock = new SimClock(13);
  const st = makeWorld(clock);
  check(levelOf(st.player, "thieving") === 1, "a new character should start at Thieving 1");
  check("thieving" in content.skills, "Thieving should appear in the skills panel");
}

if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("\nOK");
export {};
