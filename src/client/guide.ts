/**
 * src/client/guide.ts
 * -------------------
 * The onboarding coach — two layers, one banner.
 *
 * 1) THE OPENING COACH. For a brand-new player it teaches one system at a time,
 *    exactly when the opening quest ("Ash and Knuckle") makes that system
 *    matter: talk to a quest-giver, gather and train a skill, use a crafting
 *    station, deliver, then graduate into the tabs, the run toggle and combat.
 *    It is driven by the player's quest progress, so it can never get out of
 *    step. When the first quest ends it retires for good.
 *
 * 2) CONTEXTUAL TIPS. Varath has far more systems than the first quest touches —
 *    ranged combat, Faith/magic, farming, cooking, banking, Grace. Rather than
 *    front-load all of that, a set of one-shot tips fire the FIRST time the
 *    player's state shows they've met a system (a bow in the pack, bones to
 *    bury, a staff to wield, an empty Grace bar…). Each fires once, is
 *    remembered in localStorage so it never nags across sessions, and — via a
 *    one-time grandfather check — existing veterans are opted out entirely so
 *    they never get taught what they already know.
 *
 * Presentation only: it reads state and shows a single banner. It never mutates
 * the world.
 */

import type { Content, Player, WorldState } from "../core/types.ts";
import { getTrackedQuest, setTrackedQuest, isTrackingDismissed, dismissTracking } from "./questTrack.ts";
import { tutorialRetired } from "./tutorial.ts";

/** Quest-derived phases of the opening coach, in the order a new player meets them. */
type Phase = "off" | "greet" | "mine" | "smelt" | "deliver" | "graduate";

const FIRST_QUEST = "q_ash_and_knuckle";

// One line per opening-coach phase. Each names the next action + the system it teaches.
const TEXT: Record<Exclude<Phase, "off" | "graduate">, string> = {
  greet: "Aldric is waving you over — tap him to hear what the old man needs.",
  mine: "Follow the gold arrow and mine the Knucklestone rocks — Aldric needs three ores. A stripped rock refills in a few breaths; tap its neighbour meanwhile.",
  smelt: "Ore in hand. Now tap the kiln to smelt it into a bar — your first crafting station.",
  deliver: "Carry the bar back to Aldric. The gold arrow always points to your current task.",
};

// Graduation is a short two-beat sequence: first the chrome, then combat.
const GRAD_UI =
  "Well done — XP and a reward earned. The tabs at the lower-right hold your Pack, Skills and Character; the boot by the map toggles running.";
const GRAD_COMBAT =
  "The moor's beasts carry rarer things. Hold a creature to study it, then tap to strike — and eat food if your Hitpoints run low.";

// --- Contextual tips ---------------------------------------------------------

/** localStorage keys: the set of tip ids already shown, and a one-time init marker. */
const SEEN_KEY = "varath-tips-seen";
/** Set once the opening coach has graduated (or the player already looks
 *  advanced), so it never re-runs — and so it CAN resume across a session
 *  boundary until then, rather than only starting for a brand-new session. */
const COACH_KEY = "varath-coach-graduated";
const INIT_KEY = "varath-tips-init";

/** How long a tip banner lingers before it fades on its own (ms). */
const TIP_MS = 12000;

/** One contextual tip: fires the first time `test` is true, then never again. */
interface Tip {
  id: string;
  test: (state: WorldState, content: Content) => boolean;
  text: string;
}

/** Does any pack slot hold an item matching `pred`? */
function packHas(p: Player, pred: (id: string) => boolean): boolean {
  return p.inventory.some((s) => s !== null && pred(s.item));
}

/** The wearable equipment slots — used to spot "you're carrying gear you haven't
 *  put on yet" so a newcomer learns items must be equipped, not just held. */
const WEARABLE_SLOTS = new Set([
  "helmet", "body", "legs", "boots", "cape", "gloves", "amulet", "ring",
  "mainhand", "offhand", "ranged", "ammo",
]);

/** True if the player is within `r` tiles of any shop-keeper's stall. */
function nearShop(state: WorldState, content: Content, r: number): boolean {
  const p = state.player.pos;
  for (const shop of content.shops) {
    const npc = content.objects.find((o) => o.id === shop.npc);
    if (!npc) continue;
    if (Math.abs(npc.x - p.x) <= r && Math.abs(npc.y - p.y) <= r) return true;
  }
  return false;
}

/** The contextual tips, checked top to bottom; the first unseen match fires.
 *  Order rarely matters (each fires when its own condition first holds), but a
 *  more specific / rarer trigger is listed before a broader one just in case
 *  two come true on the same tick. */
const TIPS: Tip[] = [
  {
    // T7·01 — teach quest-tracking the moment the coach hands off, so the gold
    // arrow keeps pointing the way once the world opens up.
    id: "track_quest",
    test: (s) => Object.keys(s.player.quests).length >= 1,
    text: "Your current goal shows top-left and a gold arrow points the way. To follow a different quest, open the Quests tab and tap any quest to track it.",
  },
  {
    // T7·05 — equipping: a newcomer may carry gear without ever wearing it.
    id: "equip_gear",
    test: (s, c) => packHas(s.player, (id) => {
      const slot = c.items[id as keyof typeof c.items]?.slot;
      return !!slot && WEARABLE_SLOTS.has(slot);
    }),
    text: "Carrying gear isn't wearing it. Open the Character tab and tap a weapon or armour piece to equip it — your stats only count what you've put ON.",
  },
  {
    // T7·05 — shopping: fires the first time you stand by a keeper's stall.
    id: "shop_nearby",
    test: (s, c) => nearShop(s, c, 3),
    text: "A shopkeeper's stall. Tap the keeper and choose Shop to buy — or drag your own goods onto the counter to sell them for coin.",
  },
  {
    // T7·05 — first coins: what to do with money (spend / bank / the Exchange).
    id: "first_coins",
    test: (s) => (s.player.stats?.goldEarned ?? 0) > 0,
    text: "Coins earned! Spend them at any shop, or post buy and sell orders at the Grand Exchange in Ironvale (the trade booth on the map) to trade with players across Varath.",
  },
  {
    id: "faith_bones",
    test: (s) => packHas(s.player, (id) => id === "bones" || id === "big_bones"),
    text: "Bones! Hold them in your Pack and choose Bury for Devotion XP — or Crush them with a Pestle into bonemeal for potions. Faith is Varath's prayer-and-magic skill.",
  },
  {
    id: "magic_staff",
    test: (s, c) =>
      packHas(s.player, (id) => !!c.items[id as keyof typeof c.items]?.magic) ||
      !!(s.player.equipment.mainhand && c.items[s.player.equipment.mainhand]?.magic),
    text: "A staff casts Devotion spells. Wield it, open the Spells tab and pick a spell to autocast — the basic bolt costs no Grace. Higher staves hit harder.",
  },
  {
    id: "grace_empty",
    test: (s) => s.player.grace <= 0 && s.player.skills.faith.level > 1,
    text: "Out of Grace. It never refills in the field — pray at a shrine or altar to top it up, or drink a Devotion Potion (bonemeal + a herb) to restore it on the move.",
  },
  {
    id: "ranged_bow",
    test: (s, c) =>
      packHas(s.player, (id) => !!c.items[id as keyof typeof c.items]?.ranged) ||
      !!s.player.equipment.ranged,
    text: "A bow! Equip it, then stock arrows in the Ammo slot (Character tab) — you'll fight from range and train Draw. Enemies weak to ranged take extra damage.",
  },
  {
    id: "farming_seed",
    test: (s) => packHas(s.player, (id) => id.startsWith("seed_")),
    text: "A seed. Farming patches are dotted around the world (a farming icon on the map) — plant it there, then come back later. Crops grow in real time, even while you're away.",
  },
  {
    id: "cooking_raw",
    test: (s) => packHas(s.player, (id) => id.startsWith("raw_") || id.endsWith("_raw")),
    text: "Raw food heals nothing. Cook it at a fire or range first — but mind the flame; a low Cooking level burns some. Cooked food is your lifeline in a fight.",
  },
  {
    id: "combat_style",
    test: (s) => (s.player.stats?.monstersSlain ?? 0) >= 3,
    text: "Tip: your combat style in the Character tab is a live tradeoff — Edge lands more but softer hits, Vigour hits hardest, Ward trades damage for a real guard. Switch it mid-fight to match the foe. Each kill also trains that style.",
  },
  {
    id: "pack_full",
    test: (s) => s.player.inventory.every((slot) => slot !== null),
    text: "Your pack is full. Head to a Bank (the bank icon on the map) to stash items — bank storage is unlimited, and you can withdraw anything later.",
  },
];

/** Would this player look like a beginner who still needs the tips? A fresh
 *  character sits near ~20 total level with no quests done; anyone past that is
 *  grandfathered out so long-time players are never taught the basics again. */
function looksAdvanced(p: Player): boolean {
  if (p.questsDone.length >= 2) return true;
  if ((p.stats?.monstersSlain ?? 0) >= 30) return true;
  const total = Object.values(p.skills).reduce((sum, sk) => sum + sk.level, 0);
  return total >= 60;
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* storage blocked — tips simply repeat, harmless */ }
  return new Set();
}

function saveSeen(seen: Set<string>): void {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* ignore */ }
}

export class Guide {
  private banner: HTMLElement;
  private active = false;
  private phase: Phase = "off";
  private graduated = false; // opening-coach graduation sequence has run (once per session)
  private timers: number[] = [];

  private content: Content;
  private seen: Set<string> = loadSeen();
  private tipTimer: number | null = null; // set while a tip banner is on screen
  private initChecked = false; // the one-time grandfather check has run

  constructor(root: HTMLElement, content: Content) {
    this.content = content;
    this.banner = document.createElement("div");
    this.banner.className = "guide-banner hidden";
    this.banner.title = "Tap to dismiss";
    // Click/tap anywhere on the banner to dismiss it — works with a mouse on
    // desktop and a touch on mobile, and covers every layer (opening coach,
    // contextual tips, and the pinned quest objective).
    this.banner.addEventListener("click", () => this.dismissBanner());
    root.appendChild(this.banner);
  }

  /** Hide the banner in response to a user tap, and keep it quiet:
   *  - a live tip is cleared;
   *  - the opening coach is retired (the player has opted out of the tutorial);
   *  - the pinned objective is turned off (same as un-tracking the quest) so it
   *    doesn't just reappear on the next tick. */
  private dismissBanner(): void {
    if (this.tipTimer !== null) { window.clearTimeout(this.tipTimer); this.tipTimer = null; }
    // Turn the pinned objective off (same as un-tracking the quest) so it does
    // not just reappear on the next tick.
    dismissTracking();
    this.objectiveText = null;
    if (this.active) {
      // Opening coach was showing — the player has chosen to dismiss the tutorial.
      try { localStorage.setItem(COACH_KEY, "1"); } catch { /* ignore */ }
      this.retireOpeningCoach();
    }
    this.banner.classList.add("hidden");
  }

  get currentStep(): Phase {
    return this.phase;
  }

  /** Begin (or RESUME) the opening coach. Safe to call on every load: it starts
   *  for anyone who still looks like a beginner and hasn't already graduated —
   *  so a player who closed the tab mid-first-quest gets the coach back instead
   *  of losing it forever (Tier-0 fix), while veterans are never re-taught. */
  start(player: Player): void {
    try { if (localStorage.getItem(COACH_KEY)) return; } catch { /* storage blocked */ }
    if (looksAdvanced(player)) {
      try { localStorage.setItem(COACH_KEY, "1"); } catch { /* ignore */ }
      return;
    }
    this.active = true;
  }

  /**
   * Re-evaluate against the latest world state. Called every tick; cheap, and
   * only touches the DOM when something actually changes.
   */
  update(state: WorldState): void {
    this.grandfatherOnce(state.player);

    // While the First Steps tutorial is still running, the checklist panel is
    // the sole onboarding voice: stand the opening coach AND the contextual tips
    // down so nothing competes with it in the banner. The pinned quest objective
    // + gold arrow (below) still show for navigation, and both the coach and the
    // tips resume on their own once the tutorial completes or is skipped.
    const tutorialDone = tutorialRetired();

    // The opening coach owns the banner while it runs; suppress tips until it
    // has retired (or was never started, e.g. for a returning player).
    if (this.active && tutorialDone) {
      this.updateOpeningCoach(state);
      return;
    }

    if (tutorialDone) this.updateTips(state);
    // Keep the current quest's objective PINNED in the top-left banner — the
    // Wayfarer's Primer promises exactly this. A transient tip borrows the
    // banner and reverts to the objective on fade.
    this.objectiveText = this.computeObjective(state);
    if (this.tipTimer === null) this.showObjective();
  }

  /** The pinned objective line, or hide the banner if there's no active quest. */
  private objectiveText: string | null = null;
  private showObjective(): void {
    if (this.objectiveText) this.show(this.objectiveText);
    else this.banner.classList.add("hidden");
  }

  /** Resolve the tracked quest's current step into a one-line objective, and
   *  auto-track the newest active quest when nothing is tracked (or the tracked
   *  quest is finished) so the top-left goal and the gold arrow always aim
   *  somewhere. */
  private computeObjective(state: WorldState): string | null {
    const p = state.player;
    // The player explicitly turned tracking off — keep the guide quiet and DON'T
    // auto-retrack, so the top-left banner and the gold arrow stay hidden until
    // they choose to track a quest again.
    if (isTrackingDismissed()) return null;
    let tid = getTrackedQuest();
    if (!tid || !p.quests[tid]) {
      const active = Object.keys(p.quests);
      if (active.length === 0) { if (tid) setTrackedQuest(null); return null; }
      // Prefer the MAIN-STORY spine so the arrow follows the through-line the
      // whole way, not whichever side-quest was accepted last (T7·01); fall back
      // to the most recently accepted quest when no main-story quest is active.
      const mainId = active.find((id) => this.content.quests.find((q) => q.id === id)?.type === "main");
      tid = mainId ?? active[active.length - 1]!;
      setTrackedQuest(tid);
    }
    const def = this.content.quests.find((q) => q.id === tid);
    const st = p.quests[tid];
    if (!def || !st) return null;
    const step = def.steps[st.step] as { text?: string } | undefined;
    if (!step?.text) return null;
    return `◈ ${def.name} — ${step.text}`;
  }

  // --- Opening coach ---------------------------------------------------------

  private updateOpeningCoach(state: WorldState): void {
    const phase = this.derivePhase(state);
    if (phase === this.phase) return;

    // Reaching the end of the first quest plays the graduation sequence once,
    // then the coach retires for good and the tips take over.
    if (phase === "graduate") {
      this.phase = "graduate";
      if (!this.graduated) {
        this.graduated = true;
        try { localStorage.setItem(COACH_KEY, "1"); } catch { /* ignore */ }
        this.runGraduation();
      }
      return;
    }

    this.phase = phase;
    this.show(TEXT[phase as Exclude<Phase, "off" | "graduate">]);
  }

  /** Map quest progress onto a teaching phase. */
  private derivePhase(state: WorldState): Phase {
    const p = state.player;
    if (p.questsDone.includes(FIRST_QUEST)) return "graduate";
    const st = p.quests[FIRST_QUEST];
    if (!st) return "greet"; // not yet accepted — go talk to Aldric
    // Steps: 0 mine ore · 1 smelt bar · 2 deliver bar.
    return st.step <= 0 ? "mine" : st.step === 1 ? "smelt" : "deliver";
  }

  /** UI line, then combat line, then hand off to the contextual tips. */
  private runGraduation(): void {
    this.show(GRAD_UI);
    this.after(8000, () => this.show(GRAD_COMBAT));
    this.after(18000, () => this.retireOpeningCoach());
  }

  /** The opening coach steps aside; contextual tips continue from here. */
  private retireOpeningCoach(): void {
    this.active = false;
    this.phase = "off";
    this.banner.classList.add("hidden");
    this.clearTimers();
  }

  // --- Contextual tips -------------------------------------------------------

  /** Once per session, opt existing/advanced players out of the beginner tips
   *  (so this feature launching never nags a veteran) by marking them all seen. */
  private grandfatherOnce(player: Player): void {
    if (this.initChecked) return;
    this.initChecked = true;
    let init: string | null = null;
    try { init = localStorage.getItem(INIT_KEY); } catch { /* ignore */ }
    if (init) return; // already initialised on a previous session
    if (looksAdvanced(player)) {
      for (const t of TIPS) this.seen.add(t.id);
      saveSeen(this.seen);
    }
    try { localStorage.setItem(INIT_KEY, "1"); } catch { /* ignore */ }
  }

  private updateTips(state: WorldState): void {
    if (this.tipTimer !== null) return; // one tip on screen at a time
    for (const tip of TIPS) {
      if (this.seen.has(tip.id)) continue;
      if (!tip.test(state, this.content)) continue;
      this.seen.add(tip.id);
      saveSeen(this.seen);
      this.showTip(tip.text);
      return;
    }
  }

  private showTip(text: string): void {
    this.show(text);
    this.tipTimer = window.setTimeout(() => {
      this.tipTimer = null;
      this.showObjective(); // revert to the pinned objective, not a blank banner
    }, TIP_MS);
  }

  // --- Shared banner ---------------------------------------------------------

  /** Briefly pulse the objective banner — the visible half of a quest step
   *  advancing (the client also plays a chime). No-op if the banner is hidden. */
  flashObjective(): void {
    if (this.banner.classList.contains("hidden")) return;
    this.banner.classList.remove("guide-flash");
    void this.banner.offsetWidth; // restart the animation
    this.banner.classList.add("guide-flash");
    window.setTimeout(() => this.banner.classList.remove("guide-flash"), 900);
  }

  private show(text: string): void {
    this.banner.textContent = text;
    this.banner.classList.remove("hidden");
  }

  private after(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private clearTimers(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
  }
}
