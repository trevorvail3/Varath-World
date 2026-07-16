/**
 * src/client/tutorial.ts
 * ----------------------
 * The "First Steps" checklist — a proper, do-it-yourself tutorial for a
 * brand-new hero. Where the Primer teaches the three taps on a card, and the
 * guide banner points at the current quest, this is the OSRS Tutorial-Island
 * beat: an ordered list of the core actions (walk, speak, gather, bank, fight)
 * that each tick off the moment the player actually DOES them, ending in a
 * short graduation.
 *
 * It only ever READS world state (RULE 2): a step completes because the world
 * shows it happened, never because the tutorial made it happen. It runs once —
 * a localStorage flag retires it on completion or skip, and any character who
 * already looks past the basics is opted out on sight.
 */

import type { Player, SkillId, WorldState } from "../core/types.ts";
import { glyph } from "./glyph.ts";

/** Set once the tutorial is finished (or skipped), so it never runs again. */
const DONE_KEY = "varath-tutorial-done";

/** Gathering skills — any XP gained here counts as "you gathered something". */
const GATHER_SKILLS: SkillId[] = ["mining", "forestry", "fishing", "hunter"];

/** The player's state when the tutorial began — steps compare against this so a
 *  mid-progress character (rare) still measures fresh actions, not old totals. */
interface Baseline {
  spawn: { x: number; y: number };
  gatherXp: number;
  monstersSlain: number;
}

interface Step {
  id: string;
  icon: string; // a glyph.ts name
  label: string; // the checklist line
  hint: string; // the instruction shown under the list while this step is active
  done: (s: WorldState, b: Baseline) => boolean;
}

function gatherXp(p: Player): number {
  return GATHER_SKILLS.reduce((n, id) => n + (p.skills[id]?.xp ?? 0), 0);
}

function bankCount(p: Player): number {
  let n = 0;
  for (const v of Object.values(p.bank)) n += v ?? 0;
  return n;
}

/** The five first-run beats, in the order a newcomer meets them. */
const STEPS: Step[] = [
  {
    id: "move",
    icon: "boot",
    label: "Take a walk",
    hint: "Tap the ground a few tiles away to walk there.",
    done: (s, b) =>
      Math.abs(s.player.pos.x - b.spawn.x) + Math.abs(s.player.pos.y - b.spawn.y) >= 3,
  },
  {
    id: "talk",
    icon: "speech",
    label: "Speak to a local",
    hint: "Tap the old man waving in the clearing — he has work for you.",
    done: (s) => Object.keys(s.player.quests).length >= 1 || s.player.questsDone.length >= 1,
  },
  {
    id: "gather",
    icon: "pickaxe",
    label: "Gather a resource",
    hint: "Follow the gold arrow and mine a rock (or chop a tree) to fill your pack.",
    done: (s, b) => gatherXp(s.player) > b.gatherXp,
  },
  {
    id: "bank",
    icon: "backpack",
    label: "Bank an item",
    hint: "Find a bank (the bank icon on the map), tap the banker and deposit something.",
    done: (s) => bankCount(s.player) > 0,
  },
  {
    id: "fight",
    icon: "swords",
    label: "Win a fight",
    hint: "Tap a moor beast to strike it — and eat food if your Hitpoints run low.",
    done: (s, b) => (s.player.stats?.monstersSlain ?? 0) > b.monstersSlain,
  },
];

/** Would this character look like a beginner who still wants the tutorial? Any
 *  quest done, a few kills, or a raised total level means they're past it. */
function looksAdvanced(p: Player): boolean {
  if (p.questsDone.length >= 1) return true;
  if ((p.stats?.monstersSlain ?? 0) >= 3) return true;
  const total = Object.values(p.skills).reduce((n, sk) => n + sk.level, 0);
  return total >= 40;
}

export class Tutorial {
  private panel: HTMLElement;
  private stepsEl: HTMLElement;
  private hintEl: HTMLElement;
  private active = false;
  private baseline: Baseline | null = null;
  /** Ids already ticked off — so a step that toggles back (e.g. bank emptied)
   *  stays complete, and we only re-render when the frontier actually moves. */
  private cleared = new Set<string>();
  private graduating = false;

  constructor(root: HTMLElement) {
    this.panel = document.createElement("div");
    this.panel.className = "tutorial-panel hidden";
    this.panel.innerHTML =
      `<div class="tutorial-head">` +
      `<span class="tutorial-head-ic">${glyph("compass")}</span>` +
      `<span class="tutorial-head-t">First Steps</span>` +
      `<button class="tutorial-skip" type="button">Skip</button>` +
      `</div>` +
      `<div class="tutorial-steps"></div>` +
      `<div class="tutorial-hint"></div>`;
    root.appendChild(this.panel);
    this.stepsEl = this.panel.querySelector(".tutorial-steps") as HTMLElement;
    this.hintEl = this.panel.querySelector(".tutorial-hint") as HTMLElement;
    (this.panel.querySelector(".tutorial-skip") as HTMLElement).addEventListener(
      "click",
      () => this.finish(false),
    );
  }

  /** Begin the tutorial for a brand-new hero. Self-guards: no-op if it has
   *  already run, or the character already looks past the basics. */
  start(player: Player): void {
    try { if (localStorage.getItem(DONE_KEY)) return; } catch { /* storage blocked */ }
    if (looksAdvanced(player)) {
      try { localStorage.setItem(DONE_KEY, "1"); } catch { /* ignore */ }
      return;
    }
    this.baseline = {
      spawn: { x: player.pos.x, y: player.pos.y },
      gatherXp: gatherXp(player),
      monstersSlain: player.stats?.monstersSlain ?? 0,
    };
    this.active = true;
    this.panel.classList.remove("hidden");
    this.render(0);
  }

  /** Re-evaluate against the latest state. Called every tick; only touches the
   *  DOM when the completed-frontier moves. */
  update(state: WorldState): void {
    if (!this.active || !this.baseline || this.graduating) return;
    const b = this.baseline;
    let changed = false;
    for (const step of STEPS) {
      if (this.cleared.has(step.id)) continue;
      if (step.done(state, b)) { this.cleared.add(step.id); changed = true; }
    }
    if (!changed) return;
    if (this.cleared.size >= STEPS.length) { this.graduate(); return; }
    // The active step is the first one not yet cleared.
    const idx = STEPS.findIndex((s) => !this.cleared.has(s.id));
    this.render(idx);
  }

  private render(activeIdx: number): void {
    this.stepsEl.innerHTML = STEPS.map((s, i) => {
      const done = this.cleared.has(s.id);
      const cls = done ? "done" : i === activeIdx ? "active" : "";
      const mark = done ? glyph("check") : glyph(s.icon);
      return (
        `<div class="tutorial-step ${cls}">` +
        `<span class="tutorial-step-ic">${mark}</span>` +
        `<span class="tutorial-step-t">${s.label}</span>` +
        `</div>`
      );
    }).join("");
    const active = STEPS[activeIdx];
    this.hintEl.textContent = active ? active.hint : "";
  }

  /** All five done: swap to a short graduation, then retire for good. */
  private graduate(): void {
    this.graduating = true;
    this.render(STEPS.length); // every row shows its tick
    this.stepsEl.classList.add("all-done");
    this.hintEl.innerHTML =
      `<span class="tutorial-grad-ic">${glyph("trophy")}</span> ` +
      `You've learned the ropes — Varath is yours to explore. Well done!`;
    window.setTimeout(() => this.finish(true), 6000);
  }

  /** Retire the tutorial: hide it and remember so it never runs again. */
  private finish(completed: boolean): void {
    if (!this.active) return;
    this.active = false;
    try { localStorage.setItem(DONE_KEY, completed ? "done" : "skip"); } catch { /* ignore */ }
    this.panel.classList.add("leaving");
    window.setTimeout(() => this.panel.remove(), 400);
  }
}

/** True once the tutorial has finished or been skipped — so callers can avoid
 *  double-teaching (e.g. suppressing a redundant coach line). */
export function tutorialRetired(): boolean {
  try { return !!localStorage.getItem(DONE_KEY); } catch { return true; }
}
