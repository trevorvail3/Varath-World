/**
 * src/client/hud.ts
 * -----------------
 * The on-screen overlays, arranged OSRS-style:
 *   - an always-on Hitpoints bar (top-left),
 *   - the game log (bottom-left),
 *   - a tabbed "dock" (bottom-right) whose tab column runs up its left side:
 *     Inventory · Skills · Equipment · Character · Settings (more to come).
 *
 * Presentation only — it reads the core's state and shows it, never changing
 * state itself (RULE 2). (The Reset button lives in main.ts, top-right.)
 */

import type {
  CombatStyle,
  Content,
  EquipSlot,
  Intent,
  InventorySlot,
  ItemDef,
  ItemId,
  MonsterStats,
  Player,
  SkillId,
  WorldState,
} from "../core/types.ts";
import type { ContextMenu, MenuItem } from "./contextMenu.ts";
import { itemIconSVG } from "./itemIcon.ts";
import { setPerfMode, setBrightness } from "./render.ts";
import { audio } from "./audio.ts";
import { reportBug } from "./ops.ts";
import { glyph, iconize } from "./glyph.ts";
import { bossMilestones, combatLevel, compassHint, DAILY_WINDOW_MS, DELVE_FULL_LOCKOUT_MS, equipRequirement, evalAchievement } from "../core/worldCore.ts";
import { SkillDetailModal } from "./skillDetail.ts";
import { LEVEL_CAP, XP_CAP } from "../content/xpCurve.ts";
import { HiscoresUI } from "./hiscoresUI.ts";
import { ExchangeUI } from "./exchangeUI.ts";
import { PlayersUI } from "./playersUI.ts";
import { TradeUI, registerStackables } from "./tradeUI.ts";
import { currentTrade, requestTrade } from "./trade.ts";
import { recentChat, sendChat } from "./chat.ts";
import { getTrackedQuest, setTrackedQuest, dismissTracking } from "./questTrack.ts";

// How many lines of history the log keeps (you can scroll back through them).
// The panel itself shows ~7 at a time; older lines stay available above. Game
// and world-chat lines keep SEPARATE caps so a busy world chat can never evict
// your game history (and vice-versa), regardless of which filter is showing.
const MAX_GAME_LINES = 80;
const MAX_CHAT_LINES = 80;

/** Interface-size (accessibility) scale, persisted per device. */
const UI_SCALE_KEY = "varath_ui_scale";
function getUiScale(): number {
  const v = Number(localStorage.getItem(UI_SCALE_KEY));
  return Number.isFinite(v) && v >= 0.85 && v <= 1.4 ? v : 1;
}
const BRIGHT_KEY = "varath-brightness";
function getBrightnessSetting(): number {
  const v = Number(localStorage.getItem(BRIGHT_KEY));
  return Number.isFinite(v) && v >= 0.6 && v <= 2 ? v : 1;
}
/** The sender name world-broadcasts (new pier champions, etc.) post under, so
 *  the chat feed can render them as server messages rather than player chatter. */
const HERALD_NAME = "Herald";

type TabId =
  | "inventory" | "skills" | "spells" | "character"
  | "quests" | "social" | "factions" | "records" | "settings";

/** Dock opens before the tap-an-open-tab-to-collapse gesture arms (T7·03). */
const COLLAPSE_ARM_OPENS = 4;
const DOCK_OPENS_KEY = "varath-dock-opens";
function readDockOpens(): number {
  try { return Math.max(0, Number(localStorage.getItem(DOCK_OPENS_KEY)) || 0); } catch { return 0; }
}

/** Reduce-motion accessibility toggle: a root class the stylesheet reacts to,
 *  persisted on this device and re-applied on boot. */
const REDUCE_MOTION_KEY = "varath-reduce-motion";
function getReduceMotion(): boolean {
  try { return localStorage.getItem(REDUCE_MOTION_KEY) === "1"; } catch { return false; }
}
function setReduceMotion(on: boolean): void {
  try { localStorage.setItem(REDUCE_MOTION_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  document.documentElement.classList.toggle("reduce-motion", on);
}

/** High-contrast accessibility toggle: a root class the stylesheet reacts to
 *  (opaque panels, stronger borders, brighter text), persisted + re-applied on boot. */
const HIGH_CONTRAST_KEY = "varath-high-contrast";
function getHighContrast(): boolean {
  try { return localStorage.getItem(HIGH_CONTRAST_KEY) === "1"; } catch { return false; }
}
function setHighContrast(on: boolean): void {
  try { localStorage.setItem(HIGH_CONTRAST_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  document.documentElement.classList.toggle("high-contrast", on);
}

/** Colour-blind accessibility toggle: a root class that shifts the colour-only
 *  status cues (danger red, faction green) to a deuteranopia-safe orange/blue
 *  pair. Persisted + re-applied on boot. */
const COLORBLIND_KEY = "varath-colorblind";
function getColorblind(): boolean {
  try { return localStorage.getItem(COLORBLIND_KEY) === "1"; } catch { return false; }
}
function setColorblind(on: boolean): void {
  try { localStorage.setItem(COLORBLIND_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  document.documentElement.classList.toggle("colorblind", on);
}

/** Re-apply every persisted accessibility class on boot (called once at startup). */
export function applyAccessibilityPrefs(): void {
  document.documentElement.classList.toggle("reduce-motion", getReduceMotion());
  document.documentElement.classList.toggle("high-contrast", getHighContrast());
  document.documentElement.classList.toggle("colorblind", getColorblind());
}

const TABS: { id: TabId; icon: string; title: string }[] = [
  { id: "inventory", icon: "🎒", title: "Pack" },
  { id: "skills", icon: "📜", title: "Skills" },
  { id: "spells", icon: "🔮", title: "Spells" },
  { id: "character", icon: "👤", title: "Character" },
  { id: "quests", icon: "📋", title: "Quests" },
  { id: "social", icon: "👥", title: "Social" },
  { id: "factions", icon: "📖", title: "Almanac" },
  { id: "records", icon: "🏆", title: "Records" },
  { id: "settings", icon: "⚙️", title: "Settings" },
];

/** A reputation number → a standing word + tone class. */
function standing(rep: number): { word: string; tone: string } {
  // Allied at 50 so each faction's full quest line can actually reach the top
  // tier (their rep rewards cap around there), not just Ashforge.
  if (rep >= 50) return { word: "Allied", tone: "pos" };
  if (rep >= 25) return { word: "Friendly", tone: "pos" };
  if (rep >= 1) return { word: "Warming", tone: "pos" };
  if (rep === 0) return { word: "Neutral", tone: "neutral" };
  if (rep <= -25) return { word: "Hostile", tone: "neg" };
  return { word: "Wary", tone: "neg" };
}

/** The equipment slots the player can fill, in display order. */
const EQUIP_SLOTS: { slot: EquipSlot; name: string }[] = [
  { slot: "mainhand", name: "Weapon" },
  { slot: "offhand", name: "Shield" },
  { slot: "ammo", name: "Arrows" },
  { slot: "helmet", name: "Helm" },
  { slot: "armor", name: "Body" },
  { slot: "legs", name: "Legs" },
  { slot: "boots", name: "Boots" },
  { slot: "ring", name: "Ring" },
  { slot: "necklace", name: "Amulet" },
  { slot: "cape", name: "Cape" },
  { slot: "mount", name: "Mount" },
  { slot: "companion", name: "Companion" },
];

/** Canon slot strings this UI can wear (matches EquipSlot). */
const WEARABLE = new Set<string>(EQUIP_SLOTS.map((s) => s.slot));

/** Icon + label for each temporary-buff kind, shown in the buff strip. */
const BUFF_DISPLAY: Record<string, { icon: string; label: string }> = {
  melee_acc: { icon: "🎯", label: "Accuracy" },
  ranged_acc: { icon: "🎯", label: "Accuracy" },
  melee_dmg: { icon: "⚔️", label: "Damage" },
  ranged_dmg: { icon: "🏹", label: "Damage" },
  defence: { icon: "🛡️", label: "Defence" },
  gather_speed: { icon: "⛏️", label: "Gathering speed" },
  xp_boost: { icon: "✨", label: "XP boost" },
};

export class Hud {
  private content: Content;
  private skillRows = new Map<SkillId, HTMLElement>();
  private spellRows = new Map<string, { row: HTMLElement; btn: HTMLButtonElement }>();
  private autocastChips = new Map<string, HTMLElement>();
  private invSlots: HTMLElement[] = [];
  private hpFill!: HTMLElement;
  private huntChip!: HTMLElement;
  private specChip!: HTMLElement;
  private clueChip!: HTMLElement;
  private hpBar!: HTMLElement;
  private hpNum!: HTMLElement;
  private graceFill!: HTMLElement;
  private graceBar!: HTMLElement;
  private graceNum!: HTMLElement;
  private goldText!: HTMLElement;
  private vitals!: HTMLElement;
  private runControl!: HTMLElement;
  private runToggle!: HTMLElement;
  private buffStrip!: HTMLElement;
  private skillFills = new Map<SkillId, HTMLElement>();
  private logEl!: HTMLElement;
  private logLines: { type: "game" | "chat"; html: string }[] = [];
  private chatInput!: HTMLInputElement;
  /** Set by main.ts to route a sent chat line to the world's overhead-chat
   *  renderer (float it above the player's head). */
  onLocalSay: ((text: string) => void) | null = null;
  /** Set by main.ts to float an arriving nearby player's chat line over their
   *  ghost in the world (matched by name). */
  onRemoteSay: ((name: string, text: string) => void) | null = null;
  /** Set by main.ts: are any other players nearby right now? Drives faster chat
   *  polling while friends are around. */
  nearbyPlayers: (() => boolean) | null = null;
  private chatLastId = -1;
  private chatSeeded = false;

  private tabPanels = new Map<TabId, HTMLElement>();
  private tabButtons = new Map<TabId, HTMLElement>();
  private activeTab: TabId = "inventory";
  private collapsed = false;
  /** How many times the dock has been opened — gates the collapse-on-second-tap
   *  gesture so it never surprises a newcomer (T7·03). Persisted. */
  private dockOpenCount = readDockOpens();
  private dock!: HTMLElement;

  private charName!: HTMLElement;
  private charCombat!: HTMLElement;
  private charTotal!: HTMLElement;
  private charPlayed!: HTMLElement;
  private styleButtons = new Map<CombatStyle, HTMLElement>();
  private questList?: HTMLElement;
  private factionRows = new Map<string, { rep: HTMLElement; stand: HTMLElement; fill: HTMLElement }>();
  // World tab: per-region Achievement Diary blocks, with live task/progress refs.
  private diaryBlocks: { id: string; block: HTMLElement; count: HTMLElement; tasks: HTMLElement[]; claim: HTMLElement }[] = [];
  // Records tab: one container, accordion open-state, and a render signature so
  // it only rebuilds when something actually changes (never every frame).
  private recordsEl?: HTMLElement;
  // Accordion open-state; everything starts collapsed so the tab opens as a
  // tidy list of section headers the player expands as they like.
  private openSecs = new Set<string>();
  private recordsSig = "";
  private skillDetail!: SkillDetailModal;
  private lastState: WorldState | null = null;
  private equipCells = new Map<EquipSlot, HTMLElement>();
  private equipStats!: HTMLElement;
  private lastEquipment: Partial<Record<EquipSlot, ItemId>> = {};

  private onReset: () => void;
  private menu: ContextMenu | null;
  private dispatch: (intent: Intent) => void;
  private invData: (InventorySlot | null)[] = [];
  private zoomSlider: HTMLInputElement | null = null;
  private zoomReadout: HTMLElement | null = null;
  private ddSlider: HTMLInputElement | null = null;
  private ddReadout: HTMLElement | null = null;
  private rootEl: HTMLElement | null = null;

  constructor(
    root: HTMLElement,
    content: Content,
    onReset: () => void = () => {},
    menu: ContextMenu | null = null,
    dispatch: (intent: Intent) => void = () => {},
    private zoom: { get(): number; set(z: number): void } = { get: () => 1, set: () => {} },
    private onHelp: () => void = () => {},
    private onSignOut: () => void = () => {},
    private drawDist: { get(): number; set(d: number): void } = { get: () => 40, set: () => {} },
    private lootLabels: { get(): boolean; set(v: boolean): void } = { get: () => true, set: () => {} },
    private onUseItem: (slot: number, item: ItemId) => void = () => {},
  ) {
    this.content = content;
    this.onReset = onReset;
    this.menu = menu;
    this.dispatch = dispatch;
    this.rootEl = root;
    this.applyUiScale(getUiScale()); // restore the saved interface size
    setBrightness(getBrightnessSetting()); // restore the saved scene brightness
    applyAccessibilityPrefs(); // re-apply reduce-motion / high-contrast / colour-blind on boot
    this.skillDetail = new SkillDetailModal(root, content);
    this.hiscores = new HiscoresUI(root, content);
    this.exchange = new ExchangeUI(root, content, dispatch, () => this.lastState);
    this.players = new PlayersUI(root, content, (id, name) => void this.startTrade(id, name));
    registerStackables(content);
    this.trade = new TradeUI(
      root, content, () => this.lastState?.player ?? null, dispatch, () => this.pollTrade(),
    );
    this.build(root);
    this.buildSkillPicker(root);
    this.startChatFeed();
    this.startTradeFeed();
  }

  private hiscores: HiscoresUI;
  private exchange: ExchangeUI;
  private players: PlayersUI;
  private trade: TradeUI;

  // --- Skill picker (XP-lamp reward: choose where the XP goes) ---
  private skillPicker!: HTMLElement;
  private skillPickGrid!: HTMLElement;
  private skillPickTitle!: HTMLElement;
  private skillPickCb: ((skill: SkillId) => void) | null = null;

  private buildSkillPicker(root: HTMLElement): void {
    const back = document.createElement("div");
    back.className = "skillpick-backdrop hidden";
    back.innerHTML = `
      <div class="skillpick-modal">
        <div class="skillpick-title">Choose a skill</div>
        <div class="skillpick-grid"></div>
      </div>`;
    this.skillPicker = back;
    this.skillPickTitle = back.querySelector(".skillpick-title") as HTMLElement;
    this.skillPickGrid = back.querySelector(".skillpick-grid") as HTMLElement;
    back.addEventListener("pointerdown", (e) => { if (e.target === back) this.closeSkillPicker(); });
    for (const sid of Object.keys(this.content.skills) as SkillId[]) {
      const meta = this.content.skills[sid];
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "skillpick-cell";
      cell.title = meta.name;
      cell.innerHTML = `<span class="skillpick-ic">${iconize(meta.icon)}</span><span class="skillpick-name">${escapeHtml(meta.name)}</span>`;
      cell.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const cb = this.skillPickCb;
        this.closeSkillPicker();
        cb?.(sid);
      });
      this.skillPickGrid.appendChild(cell);
    }
    root.appendChild(back);
  }

  private openSkillPicker(diaryName: string, reward: number, cb: (skill: SkillId) => void): void {
    this.skillPickCb = cb;
    this.skillPickTitle.textContent = `${diaryName} — pour ${reward.toLocaleString()} XP into…`;
    this.skillPicker.classList.remove("hidden");
  }

  private closeSkillPicker(): void {
    this.skillPickCb = null;
    this.skillPicker.classList.add("hidden");
  }

  private build(root: HTMLElement): void {
    // --- Always-on Hitpoints (top-right, under the minimap) ---
    // The HP bar sits under the minimap with the run-energy orb beside it, in one
    // compact row, so both fit neatly under the minimap's width.
    const vitals = panel("hud-panel hud-vitals");
    // Just the run orb and the two bars (Hitpoints over Grace) — no numbers or
    // icons cluttering the bars; the exact values live in the hover tooltips.
    vitals.innerHTML = `
      <div class="vitals-row">
        <div class="hud-control run-control"><button class="run-toggle" type="button" title="Toggle run / walk"><span class="run-face">${glyph("boot")}</span></button></div>
        <div class="vitals-bars">
          <div class="hp-bar" title="Hitpoints"><div class="hp-fill"></div><span class="hp-num bar-num"></span></div>
          <div class="grace-row"><div class="grace-bar" title="Grace — the Devotion spell fuel. Refill at a shrine or altar."><div class="grace-fill"></div><span class="grace-num bar-num"></span></div></div>
        </div>
      </div>
      <div class="hunt-chip hidden" title="Your active bounty task"></div>
      <button class="spec-chip hidden" type="button" title="Special attack — the bar charges as your blows land; tap at full to arm the next swing"></button>
      <button class="clue-chip hidden" type="button" title="A trail scroll in your pack — tap to read its riddle again"></button>`;
    this.huntChip = vitals.querySelector(".hunt-chip") as HTMLElement;
    this.specChip = vitals.querySelector(".spec-chip") as HTMLElement;
    this.specChip.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dispatch({ type: "SPECIAL" });
    });
    this.clueChip = vitals.querySelector(".clue-chip") as HTMLElement;
    this.clueChip.addEventListener("click", (e) => {
      e.stopPropagation();
      for (const t of ["clue_easy", "clue_medium", "clue_hard"] as const) {
        if (this.lastState?.player.inventory.some((d) => d?.item === t)) {
          this.log(`The trail reads: \u201c${this.clueRiddle(t)}\u201d`);
        }
      }
    });
    this.hpFill = vitals.querySelector(".hp-fill") as HTMLElement;
    this.hpBar = vitals.querySelector(".hp-bar") as HTMLElement;
    this.hpNum = vitals.querySelector(".hp-num") as HTMLElement;
    this.graceFill = vitals.querySelector(".grace-fill") as HTMLElement;
    this.graceBar = vitals.querySelector(".grace-bar") as HTMLElement;
    this.graceNum = vitals.querySelector(".grace-num") as HTMLElement;
    this.vitals = vitals;
    // The boot orb: a ring that drains as energy spends; click toggles run/walk.
    const runCtl = vitals.querySelector(".run-control") as HTMLElement;
    this.runToggle = runCtl.querySelector(".run-toggle") as HTMLElement;
    this.runToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dispatch({ type: "TOGGLE_RUN" });
    });
    this.runControl = runCtl;
    root.appendChild(vitals);

    // Pin the vitals box directly under the minimap by MEASURING it, rather than
    // a fixed `top` offset that can't know the minimap's real rendered height
    // (which shifts with DPI, short screens and a device notch) and so let the
    // minimap clip the box's top. Re-measured on resize and whenever the minimap
    // itself changes size.
    //
    // NOTE: the minimap panel is appended to a DIFFERENT container (#app) than
    // this HUD root (#hud), so we must query the WHOLE document, not `root`.
    // And because the two panels live in different offset parents, we position
    // the box in viewport space (getBoundingClientRect) and convert back into
    // the vitals box's own offset frame — a plain offsetTop+offsetHeight would
    // be measured in the wrong coordinate system and silently miss.
    const placeVitals = (): void => {
      const mm = document.querySelector(".hud-minimap") as HTMLElement | null;
      if (!mm) return;
      const rect = mm.getBoundingClientRect();
      if (rect.height === 0) return; // not laid out yet
      const parent = vitals.offsetParent as HTMLElement | null;
      const parentTop = parent ? parent.getBoundingClientRect().top : 0;
      vitals.style.top = `${Math.round(rect.bottom - parentTop + 6)}px`;
    };
    placeVitals();
    requestAnimationFrame(placeVitals);
    window.addEventListener("resize", placeVitals);
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(placeVitals);
      // The minimap is created elsewhere and may not exist yet — attach the
      // observer as soon as it appears, then keep the box glued beneath it.
      const hookMinimap = (): void => {
        const mm = document.querySelector(".hud-minimap");
        if (mm) { ro.observe(mm); placeVitals(); }
        else requestAnimationFrame(hookMinimap);
      };
      hookMinimap();
    }

    // --- Active buff chips (top-left) ---
    const topLeft = document.createElement("div");
    topLeft.className = "hud-topleft";
    this.buffStrip = document.createElement("div");
    this.buffStrip.className = "hud-buffs";
    topLeft.appendChild(this.buffStrip);
    root.appendChild(topLeft);

    // --- Game log + world chat (bottom-left), OSRS-style: game messages and
    //     other players' chat share one scrollback, with a typing line below. ---
    const logPanel = panel("hud-panel hud-log");
    // Filter row: show All, only Game updates, or only world Chat.
    const filterRow = document.createElement("div");
    filterRow.className = "log-filter";
    this.logEl = document.createElement("div");
    this.logEl.className = "log-lines";
    const filters: { key: "" | "only-game" | "only-chat"; label: string }[] = [
      { key: "", label: "All" },
      { key: "only-game", label: "Game" },
      { key: "only-chat", label: "Chat" },
    ];
    for (const f of filters) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `log-filter-btn${f.key === "" ? " on" : ""}`;
      b.textContent = f.label;
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.logEl.classList.remove("only-game", "only-chat");
        if (f.key) this.logEl.classList.add(f.key);
        filterRow.querySelectorAll(".log-filter-btn").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        this.logEl.scrollTop = this.logEl.scrollHeight;
      });
      filterRow.appendChild(b);
    }
    // Minimize toggle (pushed to the right) — collapses the log to just this bar.
    const minBtn = document.createElement("button");
    minBtn.type = "button";
    minBtn.className = "log-min-btn";
    const minimized = (): boolean => localStorage.getItem("varath-log-min") === "1";
    const applyMin = (): void => {
      const on = minimized();
      logPanel.classList.toggle("collapsed", on);
      minBtn.textContent = on ? "▢" : "—";
      minBtn.title = on ? "Show messages" : "Minimize messages";
    };
    minBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      try { localStorage.setItem("varath-log-min", minimized() ? "0" : "1"); } catch { /* ignore */ }
      applyMin();
    });
    filterRow.appendChild(minBtn);
    logPanel.appendChild(filterRow);
    logPanel.appendChild(this.logEl);
    const chatForm = document.createElement("form");
    chatForm.className = "log-chat";
    chatForm.innerHTML =
      `<span class="log-chat-ic">${glyph("speech")}</span>` +
      `<input class="log-chat-input" type="text" maxlength="200" placeholder="Chat to the world…" autocomplete="off" />`;
    this.chatInput = chatForm.querySelector(".log-chat-input") as HTMLInputElement;
    chatForm.addEventListener("submit", (e) => { e.preventDefault(); void this.sendChatLine(); });
    // Keep keystrokes out of any game-side key handling while typing.
    this.chatInput.addEventListener("keydown", (e) => e.stopPropagation());
    logPanel.appendChild(chatForm);
    applyMin(); // restore the minimized state from last session
    root.appendChild(logPanel);

    // --- Tabbed dock (bottom-right); tab column up the left side ---
    const dock = panel("hud-panel hud-dock");
    this.dock = dock;
    const tabsCol = document.createElement("div");
    tabsCol.className = "dock-tabs";
    const body = document.createElement("div");
    body.className = "dock-body";
    // Fixed tabs (Pack, Skills) hide overflow, but the browser can still nudge
    // the container's scrollTop when a slot near the edge takes focus — leaving
    // the grid shifted up with no scrollbar to pull it back. Pin it at 0.
    body.addEventListener("scroll", () => {
      if (this.dock.classList.contains("dock-fixed") && body.scrollTop !== 0) body.scrollTop = 0;
    });

    for (const t of TABS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dock-tab";
      btn.title = t.title;
      // Icon + a label that CSS reveals only on the ACTIVE tab, so a touch
      // player always sees the name of the tab they're in (no hover title).
      btn.innerHTML = `${iconize(t.icon)}<span class="dock-tab-label">${t.title}</span>`;
      btn.addEventListener("click", () => this.setTab(t.id));
      tabsCol.appendChild(btn);
      this.tabButtons.set(t.id, btn);

      const p = document.createElement("div");
      p.className = "tab-panel";
      this.buildTab(t.id, t.title, p);
      body.appendChild(p);
      this.tabPanels.set(t.id, p);
    }

    dock.appendChild(tabsCol); // tabs LEFT of the panel body
    dock.appendChild(body);
    root.appendChild(dock);

    this.applyTabState(); // start expanded on the default tab
  }

  private buildTab(id: TabId, title: string, p: HTMLElement): void {
    p.appendChild(heading(title));
    switch (id) {
      case "inventory": {
        // Gold lives beside the PACK title (not on the Hitpoints panel).
        const head = p.firstChild as HTMLElement;
        head.classList.add("pack-head");
        const gold = document.createElement("span");
        gold.className = "pack-gold";
        gold.innerHTML = `<span class="gold-coin">${iconize("🪙")}</span><span class="gold-text">0</span>g`;
        head.appendChild(gold);
        this.goldText = gold.querySelector(".gold-text") as HTMLElement;
        const grid = document.createElement("div");
        grid.className = "inv-grid";
        for (let i = 0; i < 28; i++) {
          const slot = document.createElement("div");
          slot.className = "inv-slot";
          slot.dataset["idx"] = String(i);
          this.attachLongPress(
            slot,
            (x, y) => this.inspectItem(i, x, y),
            (x, y) => this.tapItem(i, x, y),
          );
          grid.appendChild(slot);
          this.invSlots.push(slot);
        }
        this.attachPackDrag(grid);
        p.appendChild(grid);
        p.appendChild(note("Long-press to inspect · tap to use · drag to rearrange."));
        break;
      }
      case "skills": {
        // OSRS-style: a small button per skill — icon, level, and a thin XP bar
        // along the bottom. The grid matches the Pack tab's footprint.
        const grid = document.createElement("div");
        grid.className = "skill-grid";
        (Object.keys(this.content.skills) as SkillId[]).forEach((sid) => {
          const meta = this.content.skills[sid];
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "skill-cell";
          cell.title = meta.name;
          cell.innerHTML = `
            <span class="sc-icon">${iconize(meta.icon)}</span>
            <span class="sc-lvl">1</span>
            <span class="sc-bar"><span class="sc-fill"></span></span>`;
          cell.addEventListener("click", () => {
            if (this.lastState) this.skillDetail.show(this.lastState, sid);
          });
          this.skillRows.set(sid, cell.querySelector(".sc-lvl") as HTMLElement);
          this.skillFills.set(sid, cell.querySelector(".sc-fill") as HTMLElement);
          grid.appendChild(cell);
        });
        p.appendChild(grid);
        p.appendChild(note("Tap a skill to see what it unlocks and the level of your next milestone."));
        break;
      }
      case "spells": {
        // Compact quick-cast grid: tap a spell to cast it now, long-press for its
        // details. Attack spells can be set to autocast from the strip below.
        const grid = document.createElement("div");
        grid.className = "spell-grid";
        for (const spell of this.content.spells) {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "spell-btn";
          // Blessings are HELD, not cast: tap toggles them; the footer shows
          // their Grace drain per second rather than a one-off cost.
          const blessing = spell.kind === "blessing";
          const cost = blessing ? `${spell.drainPerSec ?? 0.6}/s` : String(spell.cost);
          cell.innerHTML = `
            <span class="spell-ic">${iconize(spell.icon)}</span>
            <span class="spell-nm">${escapeHtml(spell.name)}</span>
            <span class="spell-co">${glyph("orb")} ${cost}</span>`;
          this.attachLongPress(
            cell,
            (x, y) => this.showSpellInfo(spell, x, y),
            () => this.dispatch(blessing
              ? { type: "TOGGLE_BLESSING", spell: spell.id }
              : { type: "CAST_SPELL", spell: spell.id }),
          );
          this.spellRows.set(spell.id, { row: cell, btn: cell });
          grid.appendChild(cell);
        }
        p.appendChild(grid);

        // Autocast strip: pick the attack spell your staff fires each swing.
        p.appendChild(subhead("Autocast"));
        const strip = document.createElement("div");
        strip.className = "autocast-strip";
        const mkChip = (id: string | null, label: string, icon: string): void => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "autocast-chip";
          chip.innerHTML = `${icon ? iconize(icon) : ""}<span>${escapeHtml(label)}</span>`;
          chip.addEventListener("click", () => this.dispatch({ type: "SET_AUTOCAST", spell: id }));
          this.autocastChips.set(id ?? "none", chip);
          strip.appendChild(chip);
        };
        mkChip(null, "Off", "");
        for (const spell of this.content.spells) {
          if (spell.kind === "attack") mkChip(spell.id, spell.name, spell.icon);
        }
        p.appendChild(strip);
        p.appendChild(note("Tap to cast · long-press for details. Autocast fires the chosen spell each staff swing until Grace runs out."));
        break;
      }
      case "character": {
        const sheet = document.createElement("div");
        sheet.className = "char-sheet";
        sheet.innerHTML = `
          <div class="char-name">Wanderer of Ironvale</div>
          <div class="char-row"><span>Combat</span><span class="char-combat">—</span></div>
          <div class="char-row"><span>Total level</span><span class="char-total">—</span></div>
          <div class="char-row"><span>Played</span><span class="char-played">—</span></div>`;
        this.charName = sheet.querySelector(".char-name") as HTMLElement;
        this.charCombat = sheet.querySelector(".char-combat") as HTMLElement;
        this.charTotal = sheet.querySelector(".char-total") as HTMLElement;
        this.charPlayed = sheet.querySelector(".char-played") as HTMLElement;
        p.appendChild(sheet);
        // (Cape of Varath progress now lives in the Records tab, as an achievement.)

        // Combat style — picks which combat skill your next kill trains.
        this.styleButtons.clear();
        const styleWrap = document.createElement("div");
        styleWrap.className = "style-select";
        styleWrap.innerHTML = `<div class="style-label">Combat style</div>`;
        const row = document.createElement("div");
        row.className = "style-row";
        const styles: { id: CombatStyle; name: string; icon: string; hint: string; tip: string }[] = [
          { id: "edge", name: "Edge", icon: "⚔️", hint: "accuracy",
            tip: "Accurate — more of your blows land, each a shade softer. Trains Edge." },
          { id: "vigour", name: "Vigour", icon: "💪", hint: "damage",
            tip: "Aggressive — harder hits at ordinary accuracy. Trains Vigour." },
          { id: "ward", name: "Ward", icon: "🛡️", hint: "defence",
            tip: "Defensive — trades damage for a real guard. Trains Ward." },
        ];
        for (const st of styles) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "style-btn";
          b.innerHTML = `<span class="style-ic">${iconize(st.icon)}</span>${st.name}`;
          b.title = st.tip;
          b.addEventListener("click", () => this.dispatch({ type: "SET_STYLE", style: st.id }));
          this.styleButtons.set(st.id, b);
          row.appendChild(b);
        }
        styleWrap.appendChild(row);
        p.appendChild(styleWrap);

        // --- Worn equipment (folded into the Character sheet) ---
        p.appendChild(subhead("Worn"));
        const grid = document.createElement("div");
        grid.className = "equip-grid";
        for (const { slot, name } of EQUIP_SLOTS) {
          const cell = document.createElement("div");
          cell.className = "equip-cell";
          cell.innerHTML = `<div class="equip-slot"></div><span class="equip-name">${name}</span>`;
          const icon = cell.querySelector(".equip-slot") as HTMLElement;
          this.attachLongPress(
            icon,
            (x, y) => this.inspectEquip(slot, x, y),
            () => this.dispatch({ type: "UNEQUIP", equipSlot: slot }),
          );
          this.equipCells.set(slot, icon);
          grid.appendChild(cell);
        }
        p.appendChild(grid);
        this.equipStats = document.createElement("div");
        this.equipStats.className = "equip-stats";
        p.appendChild(this.equipStats);
        p.appendChild(note("Tap a worn piece to take it off. Forge gear at the anvil."));
        break;
      }
      case "quests": {
        const list = document.createElement("div");
        list.className = "quest-list";
        this.questList = list;
        // Tap an active quest to track it (a gold marker then guides you to its
        // objective); tap the tracked one again to turn tracking OFF — which
        // stays off (the guide banner + arrow go quiet, no auto-retrack) until
        // you tap a quest again, so you can minimise the guide when you're not
        // working on a quest.
        list.addEventListener("click", (e) => {
          const row = (e.target as HTMLElement).closest("[data-track]") as HTMLElement | null;
          if (!row) return;
          const id = row.dataset.track!;
          if (getTrackedQuest() === id) dismissTracking();
          else setTrackedQuest(id);
          if (this.lastState) this.renderQuests(this.lastState.player);
        });
        p.appendChild(list);
        break;
      }
      case "social": {
        // Everything about *other people*: rankings, who's online, and friends —
        // kept apart from the game-world content on the World tab.
        // --- Hiscores: ranking against other heroes (device-local for now). ---
        const hs = document.createElement("button");
        hs.type = "button";
        hs.className = "world-hiscores";
        hs.innerHTML = `<span class="world-hiscores-ic">${iconize("🏆")}</span> Hiscores`;
        hs.addEventListener("click", () => {
          void this.hiscores.show(this.lastState?.player.appearance?.name ?? "");
        });
        p.appendChild(hs);

        // --- Players: who's online + your friends list. ---
        const pl = document.createElement("button");
        pl.type = "button";
        pl.className = "world-hiscores world-players";
        pl.innerHTML = `<span class="world-hiscores-ic">${iconize("👤")}</span> Players &amp; Friends`;
        pl.addEventListener("click", () => { void this.players.show(); });
        p.appendChild(pl);
        p.appendChild(note("World chat lives in the message box, bottom-left — type and press Enter."));
        break;
      }
      case "factions": {
        // --- Area Diaries: a themed goal checklist per region (collapsible). ---
        p.appendChild(subhead("Area Diaries"));
        for (const d of this.content.diaries) {
          const block = document.createElement("div");
          block.className = "diary-block";
          const head = document.createElement("button");
          head.type = "button";
          head.className = "diary-head";
          head.innerHTML = `<span class="diary-chev">▸</span><span class="diary-ic">${iconize(d.icon)}</span><span class="diary-name">${escapeHtml(d.name)}</span><span class="diary-count">0/${d.tasks.length}</span>`;
          const body = document.createElement("div");
          body.className = "diary-tasks";
          const taskEls: HTMLElement[] = [];
          for (const t of d.tasks) {
            const row = document.createElement("div");
            row.className = "diary-task";
            row.innerHTML = `<span class="diary-tick"></span><span class="diary-label">${escapeHtml(t.label)}</span><span class="diary-prog"></span>`;
            body.appendChild(row);
            taskEls.push(row);
          }
          // The XP-lamp reward: a Claim button that opens a skill picker.
          const claim = document.createElement("button");
          claim.type = "button";
          claim.className = "diary-claim hidden";
          claim.textContent = `Claim ${d.reward.toLocaleString()} XP`;
          claim.addEventListener("click", () => this.openSkillPicker(d.name, d.reward, (skill) => {
            this.dispatch({ type: "CLAIM_DIARY", diary: d.id, skill });
          }));
          body.appendChild(claim);
          head.addEventListener("click", () => block.classList.toggle("open"));
          block.append(head, body);
          p.appendChild(block);
          this.diaryBlocks.push({ id: d.id, block, count: head.querySelector(".diary-count") as HTMLElement, tasks: taskEls, claim });
        }

        // --- Factions: standing with each power in Varath. ---
        p.appendChild(subhead("Factions"));
        for (const f of this.content.factions) {
          const row = document.createElement("div");
          row.className = "faction-block";
          row.title = f.blurb;
          row.innerHTML = `
            <div class="faction-row">
              <span class="faction-ic">${iconize(f.icon)}</span>
              <span class="faction-name">${f.name}</span>
              <span class="faction-stand">Neutral</span>
              <span class="faction-rep">0</span>
            </div>
            <div class="faction-bar"><div class="faction-fill"></div></div>`;
          this.factionRows.set(f.id, {
            rep: row.querySelector(".faction-rep") as HTMLElement,
            stand: row.querySelector(".faction-stand") as HTMLElement,
            fill: row.querySelector(".faction-fill") as HTMLElement,
          });
          p.appendChild(row);
        }
        p.appendChild(note("Standing rises and falls with your deeds and your choices."));
        break;
      }
      case "records": {
        // Companions, achievements and the lore Archive — collections, each in
        // its own collapsible accordion (and every sub-category collapsible too).
        const wrap = document.createElement("div");
        wrap.className = "records";
        this.recordsEl = wrap;
        // One delegated handler for the whole tab: header toggles + companion
        // summon. (Rebuilding the inner HTML never re-binds anything.)
        wrap.addEventListener("click", (e) => {
          const t = (e.target as HTMLElement).closest("[data-toggle],[data-comp],[data-claim-boss]") as HTMLElement | null;
          if (!t) return;
          if (t.dataset.claimBoss) {
            const boss = t.dataset.claimBoss;
            const kills = Number(t.dataset.claimKills);
            const stats = this.content.monsters[boss];
            const tier = stats ? bossMilestones(stats, this.content).find((x) => x.kills === kills) : undefined;
            if (stats && tier) {
              this.openSkillPicker(`${stats.name} · ${kills} kills`, tier.xp, (skill) => {
                this.dispatch({ type: "CLAIM_BOSS_MILESTONE", boss, kills, skill });
                if (this.lastState) this.renderRecords(this.lastState.player, true);
              });
            }
            return;
          }
          if (t.dataset.comp) { this.summonCompanion(t.dataset.comp as ItemId); return; }
          const key = t.dataset.toggle!;
          if (this.openSecs.has(key)) this.openSecs.delete(key);
          else this.openSecs.add(key);
          if (this.lastState) this.renderRecords(this.lastState.player, true);
        });
        p.appendChild(wrap);
        break;
      }
      case "settings": {
        // Grouped into expandable sections (Gameplay, Audio) so the panel reads
        // cleanly; Sign out sits on its own at the very bottom.
        const section = (title: string, opened = false): HTMLElement => {
          const d = document.createElement("details");
          d.className = "settings-section";
          d.open = opened;
          const sum = document.createElement("summary");
          sum.className = "settings-section-head";
          sum.textContent = title;
          d.appendChild(sum);
          p.appendChild(d);
          return d;
        };
        // A setting = one clean row (label/control) plus a small ⓘ button that
        // toggles a one-line explanation, so the page reads uncluttered and the
        // help is there only when you want it.
        const item = (control: HTMLElement, info: string): HTMLElement => {
          const wrap = document.createElement("div");
          wrap.className = "settings-item";
          const row = document.createElement("div");
          row.className = "settings-item-row";
          row.appendChild(control);
          if (info) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "settings-info-btn";
            btn.textContent = "i";
            btn.title = "What does this do?";
            btn.setAttribute("aria-label", "About this setting");
            const desc = document.createElement("div");
            desc.className = "settings-info hidden";
            desc.textContent = info;
            btn.addEventListener("click", (e) => {
              e.preventDefault(); e.stopPropagation();
              desc.classList.toggle("hidden");
            });
            row.appendChild(btn);
            wrap.append(row, desc);
          } else {
            wrap.appendChild(row);
          }
          return wrap;
        };
        const sliderRow = (
          labelText: string, min: number, max: number, step: number, value: number,
          fmt: (v: number) => string, onInput: (v: number) => void,
        ): { row: HTMLElement; slider: HTMLInputElement; readout: HTMLSpanElement } => {
          const row = document.createElement("div");
          row.className = "settings-zoom";
          const label = document.createElement("div");
          label.className = "settings-label";
          const readout = document.createElement("span");
          readout.className = "settings-zoom-value";
          label.append(labelText + " ", readout);
          const slider = document.createElement("input");
          slider.type = "range";
          slider.className = "settings-slider";
          slider.min = String(min); slider.max = String(max); slider.step = String(step);
          slider.value = String(value);
          const sync = (): void => { readout.textContent = fmt(Number(slider.value)); };
          sync();
          slider.addEventListener("input", () => { onInput(Number(slider.value)); sync(); });
          row.append(label, slider);
          return { row, slider, readout };
        };
        const toggleRow = (labelText: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement => {
          const row = document.createElement("label");
          row.className = "settings-toggle";
          const box = document.createElement("input");
          box.type = "checkbox";
          box.checked = checked;
          box.addEventListener("change", () => onChange(box.checked));
          const text = document.createElement("span");
          text.textContent = labelText;
          row.append(box, text);
          return row;
        };

        const gameplay = section("Gameplay");
        const access = section("Accessibility");
        const audioSec = section("Audio");

        // --- Gameplay ---------------------------------------------------------
        // Recall: the free escape teleport (30-min cooldown) if you're ever stuck.
        const recallBtn = document.createElement("button");
        recallBtn.className = "hud-btn";
        const syncRecall = (): void => {
          const ready = this.lastState?.player.recallReadyEpoch ?? 0;
          const left = ready - Date.now();
          recallBtn.textContent = left > 0 ? `Recall to Ironvale (${Math.ceil(left / 60_000)}m)` : "Recall to Ironvale";
          recallBtn.disabled = left > 0;
        };
        syncRecall();
        recallBtn.addEventListener("click", () => {
          this.dispatch({ type: "RECALL" });
          this.setTab("inventory");
        });
        gameplay.appendChild(item(recallBtn, "A free teleport home — no runes, no wand. If you're ever stuck, this is the way out. 30-minute cooldown."));

        // Wayfare: the paid recall back to your LAST waystone, from anywhere.
        const wayfareBtn = document.createElement("button");
        wayfareBtn.className = "hud-btn";
        const syncWayfare = (): void => {
          const p2 = this.lastState?.player;
          const ready = p2?.wayfareReadyEpoch ?? 0;
          const left = ready - Date.now();
          const ws = p2?.lastWaystone ? this.content.objects.find((o) => o.id === p2.lastWaystone) : undefined;
          if (!ws) { wayfareBtn.textContent = "Wayfare (no waystone yet)"; wayfareBtn.disabled = true; }
          else if (left > 0) { wayfareBtn.textContent = `Wayfare to ${ws.name} (${Math.ceil(left / 60_000)}m)`; wayfareBtn.disabled = true; }
          else { wayfareBtn.textContent = `Wayfare to ${ws.name}`; wayfareBtn.disabled = false; }
        };
        syncWayfare();
        wayfareBtn.addEventListener("click", () => {
          this.dispatch({ type: "WAYSTONE_RECALL" });
          this.setTab("inventory");
        });
        gameplay.appendChild(item(wayfareBtn, "A paid ride back to the last Courier waystone you travelled to — from anywhere, so a far region isn't a fresh cross-map walk each visit. Costs a tithe; 5-minute cooldown."));

        const zoom = sliderRow("Zoom", 0.6, 2.4, 0.05, this.zoom.get(),
          (v) => `${Math.round(v * 100)}%`, (v) => this.zoom.set(v));
        this.zoomSlider = zoom.slider; this.zoomReadout = zoom.readout;
        gameplay.appendChild(item(zoom.row, "How close the camera sits. You can also scroll the mouse wheel, or pinch on a touchscreen, to zoom the world."));

        const DD_MAX = 40; // tiles; DD_MAX = "Max" (unlimited)
        const dd = sliderRow("Draw distance", 8, DD_MAX, 1, this.drawDist.get(),
          (v) => v >= DD_MAX ? "Max" : `${v} tiles`, (v) => this.drawDist.set(v));
        this.ddSlider = dd.slider; this.ddReadout = dd.readout;
        gameplay.appendChild(item(dd.row, "How far out the world is painted. Lower it to render less of the map at once — a quick fix if the game feels laggy on a wide screen."));

        gameplay.appendChild(item(
          toggleRow("Show loot & fishing-spot names", this.lootLabels.get(), (v) => this.lootLabels.set(v)),
          "Labels each dropped item and fishing spot with its name, so you can tell piles apart at a glance."));

        const perfOn = localStorage.getItem("varath-perf") === "1";
        setPerfMode(perfOn);
        gameplay.appendChild(item(
          toggleRow("Performance mode", perfOn, (v) => {
            try { localStorage.setItem("varath-perf", v ? "1" : "0"); } catch { /* ignore */ }
            setPerfMode(v);
            window.dispatchEvent(new Event("resize"));
          }),
          "Fewer effects and a lower render resolution for smoother play on slower machines."));

        // --- Accessibility ----------------------------------------------------
        const br = sliderRow("Brightness", 0.6, 2, 0.05, getBrightnessSetting(),
          (v) => `${Math.round(v * 100)}%`,
          (v) => { setBrightness(v); try { localStorage.setItem(BRIGHT_KEY, String(v)); } catch { /* ignore */ } });
        access.appendChild(item(br.row, "Lightens dark scenes — night, interiors, storms — so nameplates and levels stay legible."));

        const ts = sliderRow("Interface size", 0.85, 2, 0.05, getUiScale(),
          (v) => `${Math.round(v * 100)}%`, (v) => this.applyUiScale(v));
        access.appendChild(item(ts.row, "Scales every panel and letter up or down — the game world itself is unaffected."));

        access.appendChild(item(
          toggleRow("Reduce motion", getReduceMotion(), setReduceMotion),
          "Stills the interface's slides, pulses and fades for anyone who finds motion distracting."));

        access.appendChild(item(
          toggleRow("High contrast", getHighContrast(), setHighContrast),
          "Solid panels, stronger borders and brighter text — easier to read in bright rooms or with low vision."));

        access.appendChild(item(
          toggleRow("Colour-blind friendly", getColorblind(), setColorblind),
          "Shifts colour-only cues (danger red, faction green) toward a blue/orange pair that reads apart for red–green colour-blindness."));

        // --- Audio ------------------------------------------------------------
        const vol = sliderRow("Sound", 0, 100, 1, Math.round(audio.getVolume() * 100),
          (v) => audio.getMuted() ? "Muted" : `${v}%`,
          (v) => { audio.setVolume(v / 100); if (audio.getMuted() && v > 0) audio.setMuted(false); });
        audioSec.appendChild(item(vol.row, "Master volume for the procedural score, ambience and effects."));
        audioSec.appendChild(item(
          toggleRow("Mute all sound", audio.getMuted(), (v) => {
            audio.setMuted(v);
            vol.readout.textContent = v ? "Muted" : `${vol.slider.value}%`;
          }), ""));

        const help = document.createElement("button");
        help.type = "button";
        help.className = "settings-help";
        help.textContent = "How to play";
        help.title = "Show the controls primer again";
        help.addEventListener("click", () => this.onHelp());
        gameplay.appendChild(help);
        // Report a bug: description in, game state bundled automatically.
        const bug = document.createElement("button");
        bug.type = "button";
        bug.className = "settings-help";
        bug.textContent = "Report a bug";
        bug.title = "Tell us what broke — the game attaches its own state";
        bug.addEventListener("click", () => this.openBugReport());
        gameplay.appendChild(bug);
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "settings-reset";
        reset.textContent = "⟲ Reset progress";
        reset.title = "Erase all saved progress and start over";
        reset.addEventListener("click", () => this.onReset());
        gameplay.appendChild(reset);
        const signout = document.createElement("button");
        signout.type = "button";
        signout.className = "settings-signout";
        signout.textContent = "Sign out";
        signout.title = "Sign out of your account and return to the login screen";
        signout.addEventListener("click", () => this.onSignOut());
        p.appendChild(signout);
        break;
      }
    }
  }

  private setTab(id: TabId): void {
    // Tapping the already-open tab collapses the dock to just its tab column —
    // BUT not for the first few opens, when a newcomer reads that as "my content
    // vanished." Only after they've opened the dock several times does the
    // second-tap-to-collapse gesture switch on (T7·03).
    const collapseArmed = this.dockOpenCount >= COLLAPSE_ARM_OPENS;
    if (id === this.activeTab && !this.collapsed && collapseArmed) {
      this.collapsed = true;
    } else {
      if (this.collapsed || id !== this.activeTab) {
        this.dockOpenCount++;
        try { localStorage.setItem(DOCK_OPENS_KEY, String(this.dockOpenCount)); } catch { /* ignore */ }
      }
      this.activeTab = id;
      this.collapsed = false;
    }
    this.applyTabState();
    // Records renders on demand (not per-frame); refresh it the moment it opens.
    if (this.activeTab === "records" && !this.collapsed && this.lastState) {
      this.renderRecords(this.lastState.player, true);
    }
    // Settings always opens tidy: every section folded shut, not stuck however
    // you last left Gameplay.
    if (this.activeTab === "settings" && !this.collapsed) {
      this.tabPanels.get("settings")?.querySelectorAll("details.settings-section")
        .forEach((d) => { (d as HTMLDetailsElement).open = false; });
    }
  }

  /** OSRS drag-to-rearrange for the pack: press a filled slot and pull past a
   *  small threshold to lift the item (a ghost icon rides the pointer); release
   *  over another slot to swap them. A clean tap/long-press is untouched —
   *  attachLongPress already cancels itself on the same movement threshold. */
  private attachPackDrag(grid: HTMLElement): void {
    let from = -1;          // candidate slot pressed
    let dragging = false;   // passed the threshold, ghost is live
    let sx = 0, sy = 0;
    let ghost: HTMLElement | null = null;
    const slotAt = (x: number, y: number): number => {
      const el = document.elementFromPoint(x, y);
      const s = el?.closest?.(".inv-slot") as HTMLElement | null;
      const idx = s?.dataset?.["idx"];
      return idx === undefined ? -1 : Number(idx);
    };
    const clearMark = (): void => {
      for (const el of this.invSlots) el.classList.remove("drop-target");
    };
    const end = (x: number, y: number): void => {
      if (dragging) {
        const to = slotAt(x, y);
        if (to >= 0 && from >= 0 && to !== from) this.dispatch({ type: "SWAP_SLOTS", a: from, b: to });
      }
      dragging = false; from = -1;
      if (ghost) { ghost.remove(); ghost = null; }
      clearMark();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    const onMove = (e: PointerEvent): void => {
      if (from < 0) return;
      if (!dragging) {
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) <= 12) return;
        const inv = this.lastState?.player.inventory;
        if (!inv || !inv[from]) { from = -1; return; } // empty slot — nothing to lift
        dragging = true;
        ghost = document.createElement("div");
        ghost.className = "inv-drag-ghost";
        const icon = this.invSlots[from]!.querySelector(".inv-icon");
        ghost.innerHTML = icon ? icon.outerHTML : "";
        document.body.appendChild(ghost);
      }
      if (ghost) { ghost.style.left = `${e.clientX}px`; ghost.style.top = `${e.clientY}px`; }
      clearMark();
      const over = slotAt(e.clientX, e.clientY);
      if (over >= 0 && over !== from) this.invSlots[over]!.classList.add("drop-target");
    };
    const onUp = (e: PointerEvent): void => end(e.clientX, e.clientY);
    grid.addEventListener("pointerdown", (e) => {
      const idx = slotAt(e.clientX, e.clientY);
      if (idx < 0) return;
      from = idx; sx = e.clientX; sy = e.clientY; dragging = false;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  /** Reflect the current active-tab / collapsed state in the DOM. */
  private applyTabState(): void {
    this.dock.classList.toggle("collapsed", this.collapsed);
    // Pack and Skills are fixed grids that fit the dock exactly — no scrolling,
    // so the slots never shift under your finger. Other tabs may still scroll.
    this.dock.classList.toggle(
      "dock-fixed",
      !this.collapsed && (this.activeTab === "inventory" || this.activeTab === "skills"),
    );
    // Entering a fixed tab: clear any scroll a previous tab (or a stray focus
    // scroll) left behind, so the grid always sits at the top.
    if (this.dock.classList.contains("dock-fixed")) {
      const body = this.dock.querySelector(".dock-body");
      if (body) body.scrollTop = 0;
    }
    this.tabPanels.forEach((p, key) =>
      p.classList.toggle("active", key === this.activeTab && !this.collapsed),
    );
    this.tabButtons.forEach((b, key) =>
      b.classList.toggle("active", key === this.activeTab),
    );
  }

  log(message: string): void {
    this.pushLine(`<div class="log-line">${escapeHtml(message)}</div>`, "game");
  }

  /** A world-wide broadcast (e.g. a new pier champion): shown in the chat feed
   *  as a highlighted server message, and — when signed in — posted to the shared
   *  world chat so everyone online sees it too. Shown locally right away; our own
   *  echo is skipped when it comes back round on the poll (see chatLine). */
  worldAnnounce(message: string): void {
    this.pushLine(`<div class="log-line chat world-broadcast">${escapeHtml(message)}</div>`, "chat");
    void sendChat(HERALD_NAME, message).catch(() => {});
  }

  /** A world-chat line in the same scrollback (sender highlighted). A broadcast
   *  from the Herald renders as a server message; our own echo is dropped. */
  private chatLine(name: string, body: string, you: boolean): void {
    if (name === HERALD_NAME) {
      if (you) return; // our own broadcast — already shown locally by worldAnnounce
      this.pushLine(`<div class="log-line chat world-broadcast">${escapeHtml(body)}</div>`, "chat");
      return;
    }
    this.pushLine(
      `<div class="log-line chat${you ? " you" : ""}"><span class="chat-from">${escapeHtml(name)}:</span> ${escapeHtml(body)}</div>`,
      "chat",
    );
  }

  /** Append one pre-rendered line, trim history (per stream, so game and chat
   *  never push each other out), and keep the view pinned. */
  private pushLine(html: string, type: "game" | "chat"): void {
    this.logLines.push({ type, html });
    // Trim the OLDEST line of this stream once it exceeds its own cap.
    const cap = type === "chat" ? MAX_CHAT_LINES : MAX_GAME_LINES;
    let count = 0;
    for (let i = this.logLines.length - 1; i >= 0; i--) {
      if (this.logLines[i]!.type !== type) continue;
      if (++count > cap) { this.logLines.splice(i, 1); break; }
    }
    const el = this.logEl;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    el.innerHTML = this.logLines.map((l) => l.html).join("");
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }

  /** Poll the world-chat channel and fold new messages into the log. Adaptive:
   *  polls quickly (~1.2s) while other players are nearby — so a friend's line and
   *  their overhead bubble arrive promptly — and relaxes to a lazy ~3.5s when
   *  you're alone, to avoid hammering the server for chatter no one's sending. */
  private startChatFeed(): void {
    const tick = (): void => {
      void this.pollChat();
      const near = this.nearbyPlayers?.() ?? false;
      window.setTimeout(tick, near ? 1200 : 3500);
    };
    tick();
  }

  private async pollChat(): Promise<void> {
    let msgs;
    try { msgs = await recentChat(); }
    catch { return; } // not signed in / offline — try again next tick
    if (!this.chatSeeded) {
      // Don't flood the box on load: show only the last few for context, then
      // track the newest id and append only what arrives after.
      for (const m of msgs.slice(-6)) this.chatLine(m.name, m.body, m.you);
      this.chatLastId = msgs.length ? msgs[msgs.length - 1]!.id : -1;
      this.chatSeeded = true;
      return;
    }
    for (const m of msgs) {
      if (m.id > this.chatLastId) {
        this.chatLine(m.name, m.body, m.you);
        // Float a nearby player's line over their head in the world (mine is
        // already floated optimistically on send).
        if (!m.you) this.onRemoteSay?.(m.name, m.body);
        this.chatLastId = m.id;
      }
    }
  }

  /** Open the Grand Exchange (called when the player uses its market booth). */
  openExchange(): Promise<void> { return this.exchange.show(); }

  /** Poll for the trade I'm in (so a request pops even with no window open). */
  private startTradeFeed(): void {
    void this.pollTrade();
    window.setInterval(() => void this.pollTrade(), 1500);
  }

  private async pollTrade(): Promise<void> {
    let row;
    try { row = await currentTrade(); }
    catch { return; }
    this.trade.sync(row);
  }

  /** Ask an online player to trade (from the Players panel). */
  private async startTrade(id: string, name: string): Promise<void> {
    const myName = this.lastState?.player.appearance?.name ?? "Wanderer";
    try {
      await requestTrade(id, myName, name);
      this.players.close();
      await this.pollTrade();
    } catch (e) {
      this.log(`Couldn't start trade: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  private async sendChatLine(): Promise<void> {
    const text = this.chatInput.value.trim();
    if (!text) return;
    this.chatInput.value = "";
    // Float it over the player's head right away (OSRS overhead chat), before the
    // round-trip to world chat.
    this.onLocalSay?.(text);
    const name = this.lastState?.player.appearance?.name ?? "Wanderer";
    try {
      await sendChat(name, text);
      await this.pollChat(); // reflect it right away rather than waiting a tick
    } catch {
      this.log("Couldn't send to world chat — check your connection.");
    }
  }

  /** Active food/potion buffs as chips with a live countdown. */
  /** Grey out spells above your Devotion level; dim the button when you can't afford
   *  the Grace or aren't wielding a staff; highlight the autocast selection. */
  private updateSpells(player: WorldState["player"]): void {
    if (this.spellRows.size === 0) return;
    const faith = player.skills.faith.level;
    const hasStaff = !!(player.equipment.mainhand && this.content.items[player.equipment.mainhand]?.magic);
    for (const spell of this.content.spells) {
      const ref = this.spellRows.get(spell.id);
      if (!ref) continue;
      const known = faith >= spell.faithReq;
      // Blessings are prayers, not casts: no staff needed, and they stay
      // pressable while held (so you can douse one at zero Grace).
      const blessing = spell.kind === "blessing";
      const held = blessing && player.blessing === spell.id;
      const affordable = blessing
        ? known && (player.grace >= 1 || held)
        : known && hasStaff && player.grace >= spell.cost;
      ref.row.classList.toggle("locked", !known);
      ref.row.classList.toggle("held", held);
      ref.btn.disabled = !affordable;
    }
    const active = player.autocastSpell ?? "none";
    for (const [id, chip] of this.autocastChips) {
      chip.classList.toggle("on", id === active);
    }
  }

  /** A small info popup for a spell (long-press) — blurb, level, cost, effect. */
  private showSpellInfo(spell: Content["spells"][number], x: number, y: number): void {
    if (!this.menu) return;
    const effect = spell.kind === "attack" ? `Deals ~${Math.round((spell.dmgMult ?? 1) * 100)}% of your magic max hit`
      : spell.kind === "heal" ? `Heals ${spell.heal} HP`
      : spell.kind === "ward" ? `+${spell.wardAmt} defence for ${Math.round((spell.wardMs ?? 0) / 1000)}s`
      : spell.kind === "curse" ? `Drops the target's defence by ${spell.curseAmt}`
      : spell.kind === "teleport" ? "Teleports you to the city hub"
      : spell.kind === "kindle" ? "Superheats an ore in your pack into a bar"
      : spell.kind === "enchant" ? "Cuts a rough/uncut gem into a cut gem"
      : spell.kind === "blessing" ? `Halves incoming ${spell.deflectStyle} damage while held`
      : "";
    const blessing = spell.kind === "blessing";
    const items: MenuItem[] = [{
      label: blessing ? "Hold / release" : "Cast", target: spell.name, tone: "action",
      onSelect: () => this.dispatch(blessing
        ? { type: "TOGGLE_BLESSING", spell: spell.id }
        : { type: "CAST_SPELL", spell: spell.id }),
    }];
    if (spell.kind === "attack") {
      items.push({
        label: "Autocast this", target: spell.name,
        onSelect: () => this.dispatch({ type: "SET_AUTOCAST", spell: spell.id }),
      });
    }
    const costLine = blessing ? `${spell.drainPerSec ?? 0.6} Grace/s while held` : `${spell.cost} Grace`;
    this.menu.show(x, y, spell.name, items, `${spell.blurb} · Faith ${spell.faithReq} · ${costLine} · ${effect}`);
  }

  private renderBuffs(player: WorldState["player"]): void {
    const now = performance.now();
    const entries = Object.entries(player.buffs).filter(([, b]) => b.until > now);
    if (entries.length === 0) {
      if (this.buffStrip.childElementCount) this.buffStrip.innerHTML = "";
      return;
    }
    this.buffStrip.innerHTML = entries
      .map(([kind, b]) => {
        const secs = Math.max(0, Math.round((b.until - now) / 1000));
        const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
        const meta = BUFF_DISPLAY[kind] ?? { icon: "✨", label: kind };
        const amt = kind === "xp_boost" || kind === "gather_speed"
          ? `+${Math.round(b.amount * 100)}%`
          : `+${b.amount}`;
        return `<div class="buff-chip" title="${meta.label} ${amt}"><span class="buff-ic">${iconize(meta.icon)}</span><span class="buff-amt">${amt}</span><span class="buff-time">${time}</span></div>`;
      })
      .join("");
  }

  /** The bug-report modal: one textarea, one send. State rides along on its own. */
  private openBugReport(): void {
    const back = document.createElement("div");
    back.className = "bugreport-backdrop";
    back.innerHTML = `
      <div class="bugreport-box">
        <div class="bugreport-title">Report a bug</div>
        <div class="bugreport-sub">Say what happened and what you expected. Your position, levels and any recent errors are attached automatically.</div>
        <textarea class="bugreport-text" rows="5" maxlength="2000" placeholder="What went wrong?"></textarea>
        <div class="bugreport-row">
          <button class="bugreport-send" type="button">Send report</button>
          <button class="bugreport-cancel" type="button">Cancel</button>
        </div>
        <div class="bugreport-msg"></div>
      </div>`;
    document.body.appendChild(back);
    const text = back.querySelector(".bugreport-text") as HTMLTextAreaElement;
    const send = back.querySelector(".bugreport-send") as HTMLButtonElement;
    const msg = back.querySelector(".bugreport-msg") as HTMLElement;
    (back.querySelector(".bugreport-cancel") as HTMLElement).addEventListener("click", () => back.remove());
    back.addEventListener("pointerdown", (e) => { if (e.target === back) back.remove(); });
    send.addEventListener("click", () => {
      const d = text.value.trim();
      if (d.length < 5) { msg.textContent = "A few words, at least — what went wrong?"; return; }
      send.disabled = true;
      msg.textContent = "Sending…";
      reportBug(d)
        .then((r) => {
          msg.textContent = r.how === "sent"
            ? "Sent — thank you! It helps more than you know."
            : "Couldn't reach the server, so the report was copied to your clipboard — paste it in the Discord or an email.";
          window.setTimeout(() => back.remove(), r.how === "sent" ? 1800 : 6000);
        })
        .catch(() => { msg.textContent = "Couldn't send or copy — please describe it in the Discord."; send.disabled = false; });
    });
    text.focus();
  }

  /** The riddle text for a carried trail scroll — looked up from the player's
   *  active clue targets against the content's riddle table. */
  private clueRiddle(item: ItemId): string {
    const tier = item === "clue_easy" ? "easy" : item === "clue_medium" ? "medium" : "hard";
    const player = this.lastState?.player;
    // A hard trail runs in legs: its live riddle is the current leg's, carried on
    // the player so a landmark shared between chains never shows the wrong one.
    if (tier === "hard" && player?.clueSteps && player.clueSteps.length > 0) {
      const leg = player.clueSteps.length > 1 ? ` (${player.clueSteps.length} legs to go)` : " (last leg)";
      return player.clueSteps[0]!.riddle + leg;
    }
    const target = player?.clues?.[tier];
    const spot = this.content.clueSpots[tier].find((s) => s.target === target);
    return spot?.riddle ?? "The ink has faded past reading. (Solve or drop it and hunt up another.)";
  }

  /** Scale the whole HUD (accessibility): CSS zoom on the panel root, saved on
   *  this device. The canvas world underneath is untouched. */
  private applyUiScale(scale: number): void {
    const s = Math.max(0.85, Math.min(1.4, scale));
    if (this.rootEl) (this.rootEl.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(s);
    try { localStorage.setItem(UI_SCALE_KEY, String(s)); } catch { /* private browsing */ }
  }

  /** A short tap on a slot: eat food, wear gear, otherwise just inspect it. */
  private tapItem(index: number, screenX: number, screenY: number): void {
    const data = this.invData[index];
    if (!data) return;
    const def = this.content.items[data.item];
    if (data.item === "bird_nest") {
      this.dispatch({ type: "OPEN_NEST", slot: index });
    } else if (def.container) {
      // Crates and trail caskets: a tap prises them open where you stand.
      this.dispatch({ type: "OPEN_CONTAINER", slot: index });
    } else if (data.item === "clue_easy" || data.item === "clue_medium" || data.item === "clue_hard") {
      // Trail scrolls: a tap reads the riddle aloud (solving happens out in
      // the world, at whatever landmark the riddle means).
      this.log(`The trail reads: “${this.clueRiddle(data.item)}”`);
    } else if (def.heals || def.buff) {
      if (def.cat === "Potions" || def.doseNext || def.graceRestore || def.energyRestore) audio.play("drink");
      this.dispatch({ type: "EAT", slot: index });
    } else if (def.slot && WEARABLE.has(def.slot)) {
      audio.play("ui");
      this.dispatch({ type: "EQUIP", slot: index });
    } else if (def.buryXp) {
      // Bones: a tap buries them on the spot (the common action); crushing,
      // dropping and the rest stay on the long-press menu.
      this.dispatch({ type: "BURY", slot: index });
    } else if (data.item === "hunters_horn") {
      // The Hunter's Horn: a tap sounds it (teleport to the active task's
      // hunting ground; the core refuses it — and keeps it — with no task).
      this.dispatch({ type: "SOUND_HORN", slot: index });
    } else {
      this.inspectItem(index, screenX, screenY);
    }
  }

  /** Long-press / right-click an inventory slot to inspect the item. */
  private inspectItem(index: number, screenX: number, screenY: number): void {
    const data = this.invData[index];
    if (!data || !this.menu) return;
    const def = this.content.items[data.item];
    const items: MenuItem[] = [];
    if (data.item === "bird_nest") {
      items.push({
        label: "Open",
        target: def.name,
        tone: "action",
        onSelect: () => this.dispatch({ type: "OPEN_NEST", slot: index }),
      });
    }
    if (def.container) {
      items.push({
        label: "Open",
        target: def.name,
        tone: "action",
        onSelect: () => this.dispatch({ type: "OPEN_CONTAINER", slot: index }),
      });
    }
    if (data.item === "clue_easy" || data.item === "clue_medium" || data.item === "clue_hard") {
      items.push({
        label: "Read",
        target: def.name,
        tone: "action",
        onSelect: () => this.log(`The trail reads: \u201c${this.clueRiddle(data.item)}\u201d`),
      });
    }
    if (def.heals || def.buff || def.graceRestore) {
      items.push({
        label: (def.buff || def.graceRestore) && !def.heals ? "Drink" : "Eat",
        target: def.name,
        tone: "action",
        onSelect: () => this.dispatch({ type: "EAT", slot: index }),
      });
    }
    if (data.item === "hunters_horn") {
      items.push({
        label: "Sound",
        target: def.name,
        tone: "action",
        onSelect: () => this.dispatch({ type: "SOUND_HORN", slot: index }),
      });
    }
    if (def.buryXp) {
      items.push({
        label: "Bury",
        target: def.name,
        tone: "action",
        onSelect: () => this.dispatch({ type: "BURY", slot: index }),
      });
      // Crush into bonemeal — only offered when you're carrying a pestle.
      if (this.invData.some((s) => s?.item === "pestle")) {
        items.push({
          label: "Crush",
          target: def.name,
          tone: "action",
          onSelect: () => this.dispatch({ type: "GRIND", slot: index }),
        });
      }
    }
    // Light a fire — offered on logs when you're carrying flint & steel.
    if (def.cat === "Logs" && this.invData.some((s) => s?.item === "flint")) {
      items.push({
        label: "Light fire",
        target: def.name,
        tone: "action",
        onSelect: () => this.dispatch({ type: "LIGHT_FIRE", slot: index }),
      });
    }
    if (def.slot && WEARABLE.has(def.slot)) {
      items.push({
        label: "Equip",
        target: def.name,
        tone: "action",
        onSelect: () => this.dispatch({ type: "EQUIP", slot: index }),
      });
    }
    // "Use" arms the item to be used on a target — a station or another item
    // (e.g. use raw fish on a fire to cook). The loop handles the next tap.
    items.push({
      label: "Use",
      target: def.name,
      onSelect: () => this.onUseItem(index, data.item),
    });
    const qty = data.qty > 1 ? ` (${data.qty})` : "";
    items.push({
      label: "Drop",
      target: def.name + qty,
      tone: "danger",
      onSelect: () => this.dispatch({ type: "DROP", slot: index }),
    });
    // The item's value rides as a gold chip right next to the name (prominent);
    // the stack total, if any, stays in the info line below.
    const desc = this.gearDesc(data.item);
    let valueChip: string | undefined;
    let descWithTotal = desc;
    if (def.sell) {
      valueChip = `${def.sell.toLocaleString()}g`;
      if (data.qty > 1) {
        descWithTotal += ` · ${(def.sell * data.qty).toLocaleString()}g for ${data.qty}`;
      }
    }
    this.menu.show(screenX, screenY, def.name, items, descWithTotal, valueChip);
  }

  /** Gear tooltip: stat line plus any level requirement to wield it. */
  private gearDesc(id: ItemId): string {
    const def = this.content.items[id];
    const base = gearLine(def) || def.description;
    const req = equipRequirement(this.content, id);
    if (!req) return base;
    return `${base} · Requires ${this.content.skills[req.skill].name} ${req.level}`;
  }

  /** Long-press a worn slot to inspect it, with the option to take it off. */
  private inspectEquip(slot: EquipSlot, screenX: number, screenY: number): void {
    if (!this.menu) return;
    const id = this.lastEquipment[slot];
    if (!id) return;
    const def = this.content.items[id];
    this.menu.show(
      screenX,
      screenY,
      def.name,
      [
        {
          label: "Unequip",
          target: def.name,
          tone: "action",
          onSelect: () => this.dispatch({ type: "UNEQUIP", equipSlot: slot }),
        },
      ],
      this.gearDesc(id),
    );
  }

  /** Short tap fires `onTap`; a held press fires `onLong`. */
  private attachLongPress(
    el: HTMLElement,
    onLong: (x: number, y: number) => void,
    onTap?: (x: number, y: number) => void,
  ): void {
    let timer: number | null = null;
    let sx = 0;
    let sy = 0;
    let moved = false;
    let fired = false;
    const clear = (): void => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      sx = e.clientX;
      sy = e.clientY;
      moved = false;
      fired = false;
      clear();
      // Right mouse button = the long-hold inspect, fired at once (desktop). Mark
      // it fired so the following pointerup doesn't also run the tap action.
      if (e.button === 2) {
        fired = true;
        onLong(e.clientX, e.clientY);
        return;
      }
      timer = window.setTimeout(() => {
        if (!moved) {
          fired = true;
          onLong(e.clientX, e.clientY);
        }
      }, 330);
    });
    el.addEventListener("pointermove", (e) => {
      if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) {
        moved = true;
        clear();
      }
    });
    el.addEventListener("pointerup", (e) => {
      clear();
      if (!fired && !moved && onTap) onTap(e.clientX, e.clientY);
    });
    el.addEventListener("pointercancel", clear);
    // The right-click inspect is handled on pointerdown above; just stop the
    // browser's own context menu here (pointerdown fires before contextmenu).
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  update(state: WorldState): void {
    const { player } = state;
    this.invData = player.inventory;
    this.lastState = state;

    this.renderBuffs(player);
    this.updateSpells(player);

    // Keep the zoom slider in step with wheel/pinch changes (unless the player
    // is actively dragging it, in which case it's already the source of truth).
    if (this.zoomSlider && document.activeElement !== this.zoomSlider) {
      const z = this.zoom.get();
      if (Number(this.zoomSlider.value) !== z) {
        this.zoomSlider.value = String(z);
        if (this.zoomReadout) this.zoomReadout.textContent = `${Math.round(z * 100)}%`;
      }
    }
    // Same for the draw-distance slider — it's built before the game exists, so
    // sync it to the real stored value once that's available.
    if (this.ddSlider && document.activeElement !== this.ddSlider) {
      const d = this.drawDist.get();
      if (Number(this.ddSlider.value) !== d) {
        this.ddSlider.value = String(d);
        if (this.ddReadout) this.ddReadout.textContent = d >= 40 ? "Max" : `${d} tiles`;
      }
    }

    // Skills: level + progress-to-next-level bar.
    const table = this.content.xpForLevel;
    (Object.keys(this.content.skills) as SkillId[]).forEach((id) => {
      const s = player.skills[id];
      const el = this.skillRows.get(id);
      if (el) el.textContent = String(s.level);
      // At the level cap the orb freezes, but XP keeps climbing to 100M — so the
      // bar (and hover) show that prestige progress instead of a phantom next level.
      const atCap = s.level >= LEVEL_CAP;
      const fill = this.skillFills.get(id);
      if (fill) {
        const cur = atCap ? (table[LEVEL_CAP] ?? 0) : (table[s.level] ?? 0);
        const next = atCap ? XP_CAP : table[s.level + 1];
        const pct = next && next > cur ? (s.xp - cur) / (next - cur) : 1;
        fill.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
      }
      // Rich hover on the cell: "Mining · Lv 7 · 1,240 / 1,833 xp".
      const cell = el?.parentElement;
      if (cell) {
        const meta = this.content.skills[id];
        const next = atCap ? XP_CAP : table[s.level + 1];
        const suffix = atCap ? " (max level)" : "";
        const xpLine = next ? `${Math.floor(s.xp).toLocaleString()} / ${next.toLocaleString()} xp${suffix}` : "max level";
        cell.title = `${meta.name} · Lv ${s.level} · ${xpLine}`;
      }
    });

    if (this.activeTab === "records") this.renderRecords(player);

    // Area Diaries: tick each task and the per-region completion count.
    if (this.activeTab === "factions" && this.diaryBlocks.length) {
      for (const blk of this.diaryBlocks) {
        const def = this.content.diaries.find((d) => d.id === blk.id);
        if (!def) continue;
        let done = 0;
        for (let i = 0; i < def.tasks.length; i++) {
          const ev = evalAchievement(player, this.content, def.tasks[i]!.cond);
          const row = blk.tasks[i]!;
          if (ev.met) done++;
          row.classList.toggle("done", ev.met);
          const tick = row.querySelector(".diary-tick") as HTMLElement;
          const prog = row.querySelector(".diary-prog") as HTMLElement;
          tick.textContent = ev.met ? "✓" : "";
          prog.textContent = ev.met ? "" : (ev.target > 1 ? `${Math.min(ev.cur, ev.target)}/${ev.target}` : "");
        }
        blk.count.textContent = `${done}/${def.tasks.length}`;
        const complete = done >= def.tasks.length;
        const claimed = player.diariesClaimed.includes(blk.id);
        blk.block.classList.toggle("complete", complete);
        // Show the Claim button only when finished and unclaimed; once claimed,
        // the button becomes a static "Reward claimed" marker.
        blk.claim.classList.toggle("hidden", !complete);
        if (claimed) {
          blk.claim.textContent = "✓ Reward claimed";
          blk.claim.classList.add("claimed");
          (blk.claim as HTMLButtonElement).disabled = true;
        }
      }
    }

    // Faction standings.
    for (const f of this.content.factions) {
      const els = this.factionRows.get(f.id);
      if (!els) continue;
      const rep = player.reputation[f.id] ?? 0;
      const s = standing(rep);
      els.rep.textContent = rep > 0 ? `+${rep}` : String(rep);
      els.stand.textContent = s.word;
      els.stand.className = `faction-stand ${s.tone}`;
      // Bar fills right for positive standing, capped at +100; empty when ≤ 0.
      els.fill.style.width = `${Math.max(0, Math.min(1, rep / 100)) * 100}%`;
      els.fill.className = `faction-fill ${s.tone}`;
    }

    // The hunt chip: a one-glance readout of the live bounty task under the
    // vitals — target and tally only, nothing that plays the game for you.
    const bt = player.bounty.task;
    if (bt) {
      const done = bt.progress >= bt.required;
      const bName = this.content.monsters[bt.monster]?.name ?? bt.monster;
      this.huntChip.innerHTML = `${glyph("target")} ${escapeHtml(done ? `${bName} — claim!` : `${bName} ${bt.progress}/${bt.required}`)}`;
      this.huntChip.classList.toggle("done", done);
      this.huntChip.classList.remove("hidden");
    } else {
      this.huntChip.classList.add("hidden");
    }

    // The special-attack chip: charge readout under the vitals. Hidden until
    // the first blow lands; full and armed states get their own looks.
    const spec = Math.floor(player.spec ?? 0);
    if (spec > 0 || player.specArmed) {
      const full = spec >= 100;
      // Short, constant-width labels so the (now fixed-size) box never reflows.
      this.specChip.innerHTML = `${glyph("bolt")} ${player.specArmed ? "Special armed"
        : full ? "Special ready" : `Special ${spec}%`}`;
      this.specChip.classList.toggle("armed", player.specArmed);
      this.specChip.classList.toggle("ready", full && !player.specArmed);
      this.specChip.classList.remove("hidden");
    } else {
      this.specChip.classList.add("hidden");
    }

    // The trail chip: a quiet reminder that a scroll is waiting in the pack.
    const heldClues = ["easy", "medium", "hard"].filter((t) =>
      player.inventory.some((d) => d?.item === `clue_${t}`));
    if (heldClues.length) {
      this.clueChip.innerHTML = `${glyph("scroll")} Trail: ${heldClues.join(" · ")}`;
      this.clueChip.classList.remove("hidden");
    } else {
      this.clueChip.classList.add("hidden");
    }

    // Hitpoints (always-on bar) + low-HP warning.
    const pct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    this.hpFill.style.width = `${pct * 100}%`;
    this.hpBar.title = `Hitpoints: ${Math.max(0, player.hp)} / ${player.maxHp}`;
    // Inline numerics so a touch player can read HP/Grace without a hover tip.
    this.hpNum.textContent = `${Math.max(0, Math.round(player.hp))}/${player.maxHp}`;
    this.goldText.textContent = player.gold.toLocaleString();
    this.vitals.classList.toggle("low", player.alive && pct <= 0.35);

    // Grace (Faith fuel): always shown under the HP bar (like a prayer orb) —
    // everyone starts with a small pool, and it never regenerates in the field,
    // only at a shrine or altar. Keeping it visible even at 0 is the point: you
    // need to see when it's empty.
    // Mirror graceMax() in worldCore: a 30-Grace base, +2 per Devotion level.
    const graceMax = 28 + 2 * Math.max(1, player.skills.faith.level);
    const gpct = Math.max(0, Math.min(1, player.grace / graceMax));
    this.graceFill.style.width = `${gpct * 100}%`;
    this.graceBar.title = `Grace: ${Math.floor(player.grace)} / ${graceMax} — the Devotion spell fuel. Refill at a shrine or altar.`;
    this.graceNum.textContent = `${Math.floor(player.grace)}/${graceMax}`;

    // Run/walk: bar width, percentage, on/off and low-energy styling.
    // Run orb: the ring depletes with energy (a CSS var drives the conic fill),
    // and the orb tints by state (running / low / spent).
    const energy = Math.round(player.energy);
    this.runToggle.style.setProperty("--e", String(energy));
    this.runToggle.title = `${player.running ? "Running" : "Walking"} · ${energy}% energy`;
    this.runControl.classList.toggle("on", player.running && player.energy > 0);
    this.runControl.classList.toggle("spent", player.energy <= 0);
    this.runControl.classList.toggle("low", energy <= 25 && player.energy > 0);

    // Character sheet
    const ids = Object.keys(this.content.skills) as SkillId[];
    const total = ids.reduce((sum, id) => sum + player.skills[id].level, 0);
    const combat = Math.round(
      (player.skills.vitality.level +
        player.skills.edge.level +
        player.skills.vigour.level) /
        3,
    );
    this.charCombat.textContent = String(combat);
    this.charTotal.textContent = String(total);
    this.charPlayed.textContent = formatPlaytime(player.playMs);
    const cname = player.appearance?.name?.trim();
    this.charName.textContent = cname ? `${cname} of Ironvale` : "Wanderer of Ironvale";
    this.styleButtons.forEach((btn, id) => {
      btn.classList.toggle("active", id === player.combatStyle);
    });

    // Inventory
    for (let i = 0; i < this.invSlots.length; i++) {
      const slot = this.invSlots[i]!;
      const data = player.inventory[i];
      if (!data) {
        slot.className = "inv-slot";
        slot.innerHTML = "";
        slot.title = "";
        continue;
      }
      const def = this.content.items[data.item];
      slot.className = `inv-slot filled${data.noted ? " noted" : ""}`;
      slot.title = `${data.noted ? "(Noted) " : ""}${def.name} — ${def.description}${def.sell ? ` · worth ${def.sell.toLocaleString()}g` : ""}${data.noted ? " · a bank slip; bank it to use" : ""}`;
      slot.innerHTML = `<span class="inv-icon">${itemIconSVG(def)}</span>${
        data.qty > 1 ? `<span class="inv-qty">${data.qty}</span>` : ""
      }`;
    }

    // Equipment: fill worn slots, and total the bonuses underneath.
    this.lastEquipment = player.equipment;
    let acc = 0;
    let dmg = 0;
    let def = 0;
    this.equipCells.forEach((icon, slot) => {
      const id = player.equipment[slot];
      if (id) {
        const item = this.content.items[id];
        acc += item.acc ?? 0;
        dmg += item.dmg ?? 0;
        def += item.def ?? 0;
        icon.className = "equip-slot filled";
        icon.innerHTML = itemIconSVG(item);
        icon.title = `${item.name} — ${item.description}${item.sell ? ` · worth ${item.sell.toLocaleString()}g` : ""}`;
        // The quiver shows how many arrows are nocked.
        if (slot === "ammo" && player.quiver > 0) {
          icon.innerHTML += `<span class="equip-qty">${player.quiver}</span>`;
          icon.title = `${item.name} — ${player.quiver} nocked`;
        }
      } else {
        icon.className = "equip-slot";
        icon.innerHTML = "";
        icon.title = "";
      }
    });
    if (this.equipStats) {
      this.equipStats.textContent = `Acc +${acc}  ·  Dmg +${dmg}  ·  Def +${def}`;
    }

    // Quests
    if (this.questList) this.renderQuests(player);
  }

  /** Rebuild the quest log, split into Main Story / Faction / Side Quests. Each
   *  group lists its active quests (with objective + track star) then its
   *  completed ones (dim ✓); empty groups are omitted. */
  private renderQuests(player: WorldState["player"]): void {
    if (!this.questList) return;
    const quests = this.content.quests;
    const tracked = getTrackedQuest();
    const parts: string[] = [];

    const typeOf = (id: string): "main" | "faction" | "side" =>
      quests.find((q) => q.id === id)?.type ?? "side";

    // A quest's recommended combat level, derived from what it asks you to
    // kill: the toughest monster on its step list. Talk/gather quests need no
    // level, so they carry no chip.
    const cl = combatLevel(player);
    const recLevel = (def: (typeof quests)[number]): number | null => {
      let top = 0;
      for (const s of def.steps) {
        if (s.type !== "kill") continue;
        const m = this.content.monsters[s.monster];
        if (m && m.level > top) top = m.level;
      }
      return top > 0 ? top : null;
    };

    const activeItem = (id: string): string => {
      const def = quests.find((q) => q.id === id);
      if (!def) return "";
      const st = player.quests[id]!;
      const obj = def.steps[st.step];
      let line = obj ? escapeHtml(obj.text) : "";
      if (obj && obj.type === "kill") line += ` <span class="quest-prog">(${st.killCount}/${obj.count})</span>`;
      const on = tracked === id;
      // The chip warns (red) while the quest's toughest kill outclasses you.
      const rec = recLevel(def);
      const chip = rec
        ? ` <span class="quest-lvl${cl < rec ? " over" : ""}" title="${cl < rec ? "This quest's toughest foe OUTRANKS you — take care" : "Toughest foe this quest asks you to fight"}">${cl < rec ? "▲ " : ""}${glyph("swords")} ${rec}</span>`
        : "";
      return (
        `<div class="quest-item${on ? " tracked" : ""}" data-track="${id}" title="${on ? "Tracked — tap to clear" : "Tap to track this quest"}">` +
        `<div class="quest-name"><span class="quest-star">${on ? "★" : "☆"}</span> ${escapeHtml(def.name)}${chip}</div>` +
        `<div class="quest-obj">▸ ${line}</div></div>`
      );
    };
    const doneItem = (id: string): string => {
      const def = quests.find((q) => q.id === id);
      return def ? `<div class="quest-done">✓ ${escapeHtml(def.name)}</div>` : "";
    };

    // "Today in Varath": the standing daily beats, surfaced where players
    // already look. Each line is a fact the systems track anyway — this panel
    // just says it out loud (no timers invented, no play done for you).
    {
      const rows: string[] = [];
      const row = (ready: boolean, text: string): string =>
        `<div class="today-row ${ready ? "ready" : "waiting"}"><span class="today-dot">${ready ? "●" : "○"}</span> ${text}</div>`;
      // Daily contract double (rolling 20h window).
      const sinceDaily = Date.now() - (player.bounty?.lastClaimDay ?? 0);
      rows.push(sinceDaily >= DAILY_WINDOW_MS
        ? row(true, "Daily hunt bonus ready — your next contract claim pays double Marks")
        : row(false, `Daily hunt bonus returns in ${Math.ceil((DAILY_WINDOW_MS - sinceDaily) / 3_600_000)}h`));
      // The Delve cache (playtime lockout).
      const sinceCache = player.playMs - (player.delveLastFullPlayMs ?? -Infinity);
      rows.push(sinceCache >= DELVE_FULL_LOCKOUT_MS
        ? row(true, "The Marrow Delve's full cache is ready — clear the waves to claim it")
        : row(false, `Delve cache recharges after ${Math.ceil((DELVE_FULL_LOCKOUT_MS - sinceCache) / 60_000)}m more play`));
      // The roaming world boss, by compass corner.
      const st = this.lastState;
      const bossDef = this.content.objects.find((o) => o.kind === "monster" && o.patrol && o.patrol.length > 1);
      const bossObj = bossDef ? st?.objects[bossDef.id] : undefined;
      if (bossDef && bossObj) {
        rows.push(bossObj.available
          ? row(true, `${escapeHtml(bossDef.name ?? "The world boss")} prowls ${escapeHtml(compassHint(this.content, bossObj.pos ?? { x: bossDef.x, y: bossDef.y }))}`)
          : row(false, `${escapeHtml(bossDef.name ?? "The world boss")} is slain — it will rise and roam again`));
      }
      // Open trail scrolls in the pack.
      const held = ["easy", "medium", "hard"].filter((t) =>
        player.inventory.some((d) => d?.item === `clue_${t}`));
      if (held.length) rows.push(row(true, `Unsolved trail scroll${held.length > 1 ? "s" : ""} in your pack: ${held.join(", ")}`));
      parts.push(`<div class="quest-cat">Today in Varath</div><div class="today-block">${rows.join("")}</div>`);
    }

    // The active Bounty contract, pinned at the top so you can check your
    // slay-task and its progress from anywhere — not only at a guide's board.
    const task = player.bounty?.task;
    if (task) {
      const mon = this.content.monsters[task.monster];
      const guide = this.content.bountyGuides.find((g) => g.id === task.guideId);
      const done = task.progress >= task.required;
      parts.push(
        `<div class="quest-cat">Bounty Contract</div>` +
        `<div class="quest-item bounty-contract${done ? " tracked" : ""}">` +
        `<div class="quest-name"><span class="quest-star">${glyph("target")}</span> ${escapeHtml(mon?.name ?? task.monster)}` +
        `${guide ? ` <span class="quest-prog">· ${escapeHtml(guide.name)}</span>` : ""}</div>` +
        `<div class="quest-obj">▸ ${done ? "Contract complete — return to claim your Hunt Marks." : `Slay ${task.monster ? escapeHtml(mon?.name ?? task.monster) : ""}`} ` +
        `<span class="quest-prog">(${Math.min(task.progress, task.required)}/${task.required})</span></div></div>`,
      );
    }

    const activeIds = Object.keys(player.quests);
    const GROUPS: { key: "main" | "faction" | "side"; label: string }[] = [
      { key: "main", label: "Main Story" },
      { key: "faction", label: "Faction" },
      { key: "side", label: "Side Quests" },
    ];
    for (const g of GROUPS) {
      const act = activeIds.filter((id) => typeOf(id) === g.key);
      const done = player.questsDone.filter((id) => typeOf(id) === g.key);
      if (!act.length && !done.length) continue;
      parts.push(`<div class="quest-cat">${g.label} <span class="quest-h-count">${act.length + done.length}</span></div>`);
      for (const id of act) parts.push(activeItem(id));
      for (const id of done) parts.push(doneItem(id));
    }

    if (!parts.length) {
      parts.push(note("No quests yet. Talk to the folk you meet — some keep their troubles until they trust you to ask.").outerHTML);
    }
    this.questList.innerHTML = parts.join("");
  }

  private summonCompanion(id: ItemId): void {
    const player = this.lastState?.player;
    if (!player) return;
    if (player.equipment.companion === id) {
      this.dispatch({ type: "UNEQUIP", equipSlot: "companion" });
      return;
    }
    const idx = player.inventory.findIndex((s) => s?.item === id);
    if (idx >= 0) {
      this.dispatch({ type: "EQUIP", slot: idx });
    } else if ((player.bank[id] ?? 0) > 0) {
      this.dispatch({ type: "WITHDRAW", item: id });
      this.log("Brought it to your pack — tap again to summon it.");
    }
  }

  /**
   * The Records tab: Companions, Achievements and the lore Archive, each a
   * collapsible accordion (and every sub-category collapsible too). Rendered on
   * demand — only when the data or the open/closed set actually changes — so it
   * never churns every frame, keeps its scroll position, and stays responsive.
   */
  private renderRecords(player: Player, force = false): void {
    if (!this.recordsEl) return;
    const items = this.content.items;
    const comps = (Object.keys(items) as ItemId[]).filter((id) => items[id].slot === "companion");
    const ownedOf = (id: ItemId): boolean =>
      player.equipment.companion === id ||
      player.inventory.some((s) => s?.item === id) ||
      (player.bank[id] ?? 0) > 0;
    const compOwned = comps.filter(ownedOf).length;
    const achTotal = this.content.achievements.length;
    const loreTotal = this.content.lore.length;
    // Cape of Varath — the all-100 completion goal, now tracked here as an achievement.
    const skillIds = Object.keys(this.content.skills) as SkillId[];
    const capeMaxed = skillIds.filter((id) => player.skills[id].level >= 100).length;
    const capeOwned =
      player.equipment.cape === "cape_max" ||
      player.inventory.some((s) => s?.item === "cape_max") ||
      (player.bank["cape_max"] ?? 0) > 0;

    // Rebuild only on a real change (counts, summoned pet, or which sections are
    // open). This is what stops the per-frame churn that froze the tab.
    const bossKillSig = Object.values(player.bossKills).reduce((n, k) => n + k, 0);
    const sig = [
      compOwned, player.equipment.companion ?? "",
      player.achievements.length, achTotal, player.lore.length, loreTotal,
      bossKillSig, player.bossMilestonesClaimed.length,
      capeMaxed, capeOwned ? 1 : 0,
      (player.collection ?? []).length,
      [...this.openSecs].sort().join(","),
    ].join("|");
    if (!force && sig === this.recordsSig) return;
    this.recordsSig = sig;

    const chev = (open: boolean): string => `<span class="rec-chev">${open ? "▾" : "▸"}</span>`;

    // Companions: a grid of owned (tappable) / locked cells.
    const compBody =
      `<div class="companion-grid">${comps.map((id) => {
        const def = items[id];
        const owned = ownedOf(id);
        const isActive = player.equipment.companion === id;
        const title = owned
          ? `${def.name}${isActive ? " (summoned)" : ""} — ${def.description}`
          : "An undiscovered companion. Keep training.";
        return `<button type="button" class="comp-cell ${owned ? "owned" : "locked"}${isActive ? " active" : ""}" title="${escapeHtml(title)}"${owned ? ` data-comp="${id}"` : ""}><span class="comp-ic">${owned ? itemIconSVG(def) : iconize("❓")}</span>${isActive ? `<span class="comp-star">★</span>` : ""}</button>`;
      }).join("")}</div>` +
      `<div class="tab-note">Skilling pets turn up as you train; boss pets drop from their boss (or from its 100-kill milestone). Tap one to summon it — it'll follow you everywhere.</div>`;

    // A category sub-accordion shared by Achievements and Archive.
    const subSection = (key: string, label: string, count: string, rows: () => string): string => {
      const open = this.openSecs.has(key);
      return `<div class="rec-sub ${open ? "open" : ""}"><button type="button" class="rec-subhead" data-toggle="${key}">${chev(open)}<span class="rec-subname">${escapeHtml(label)}</span><span class="rec-count">${count}</span></button>${open ? `<div class="rec-subbody">${rows()}</div>` : ""}</div>`;
    };

    // Achievements, grouped by category, each category collapsible.
    const achCats: string[] = [];
    for (const a of this.content.achievements) if (!achCats.includes(a.category)) achCats.push(a.category);
    const achBody = achCats.map((cat) => {
      const rows = this.content.achievements.filter((x) => x.category === cat);
      const done = rows.filter((a) => player.achievements.includes(a.id)).length;
      return subSection(`ach:${cat}`, cat, `${done}/${rows.length}`, () =>
        rows.map((a) => {
          const isDone = player.achievements.includes(a.id);
          const ev = evalAchievement(player, this.content, a.cond);
          const right = isDone
            ? `<span class="achieve-check">✓</span>`
            : ev.target > 1
              ? `<span class="achieve-prog">${Math.min(ev.cur, ev.target).toLocaleString()} / ${ev.target.toLocaleString()}</span>`
              : `<span class="achieve-lock">${iconize("🔒")}</span>`;
          return `<div class="achieve-row ${isDone ? "done" : ""}"><span class="achieve-ic">${iconize(isDone ? a.icon : "🔒")}</span><span class="achieve-info"><span class="achieve-name">${escapeHtml(a.name)}</span><span class="achieve-desc">${escapeHtml(a.desc)}</span></span>${right}</div>`;
        }).join(""));
    }).join("");

    // Archive (found lore), grouped by thread, each thread collapsible.
    const found = new Set(player.lore);
    const loreCats: string[] = [];
    for (const l of this.content.lore) if (!loreCats.includes(l.category)) loreCats.push(l.category);
    const loreBody = loreCats.map((cat) => {
      const rows = this.content.lore.filter((x) => x.category === cat);
      const have = rows.filter((l) => found.has(l.id)).length;
      return subSection(`lore:${cat}`, cat, `${have}/${rows.length}`, () =>
        rows.map((l) =>
          found.has(l.id)
            ? `<div class="lore-row done"><span class="lore-ic">${iconize("📖")}</span><span class="lore-info"><span class="lore-name">${escapeHtml(l.title)}</span><span class="lore-snip">${escapeHtml(l.text[0] ?? "")}</span></span></div>`
            : `<div class="lore-row"><span class="lore-ic">${iconize("🔒")}</span><span class="lore-info"><span class="lore-name">Undiscovered</span><span class="lore-snip">Somewhere in Varath, still waiting to be read.</span></span></div>`,
        ).join(""));
    }).join("");

    // Boss Log: every named boss, sorted by level — kills tallied, with a hint
    // on where to find it (or how to take it on). Unfought bosses still show
    // their hint, so the log doubles as a trail of clues.
    const bosses = (Object.values(this.content.monsters) as MonsterStats[])
      .filter((m) => m.boss)
      .sort((a, b) => a.level - b.level);
    const bossSlain = bosses.filter((m) => (player.bossKills[m.id] ?? 0) > 0).length;
    // Each boss is a collapsible entry: a compact header (icon, name, level,
    // kills) with an Info toggle that expands its lore, weakness and the full
    // milestone ladder — so the log stays tidy until you ask for detail.
    const bossBody = bosses.map((m) => {
      const kills = player.bossKills[m.id] ?? 0;
      const slain = kills > 0;
      const key = `boss:${m.id}`;
      const open = this.openSecs.has(key);
      const ward = m.mechanics?.find((mc) => mc.type === "wardshift");
      const weak = ward && ward.type === "wardshift" && ward.styles.length
        ? `<div class="boss-detail-weak">Turning ward — weak to ${escapeHtml(ward.styles.join(" → "))} as it falls. Rotate your style.</div>`
        : m.weakness?.length ? `<div class="boss-detail-weak">Weak to ${escapeHtml(m.weakness.join(", "))}.</div>` : "";
      const lore = m.desc ? `<div class="boss-detail-lore">${escapeHtml(m.desc)}</div>` : "";
      const hintLine = m.bossHint ? `<div class="boss-detail-hint">${escapeHtml(m.bossHint)}</div>` : "";
      // Milestone ladder: claimed (✓), reached & unclaimed (a Claim button), or
      // still locked (greyed, showing the threshold + reward).
      const miles = bossMilestones(m, this.content).map((t) => {
        const mkey = `${m.id}:${t.kills}`;
        const reward = `${t.xp.toLocaleString()} XP${t.pet ? " + pet" : ""}`;
        if (player.bossMilestonesClaimed.includes(mkey)) {
          return `<span class="boss-mile done" title="${reward}">✓ ${t.kills}</span>`;
        }
        if (kills >= t.kills) {
          return `<button type="button" class="boss-mile claim" data-claim-boss="${m.id}" data-claim-kills="${t.kills}" title="Claim ${escapeHtml(reward)}">Claim ${t.kills} · ${reward}</button>`;
        }
        return `<span class="boss-mile" title="${reward}">${t.kills} · ${reward}</span>`;
      }).join("");
      return `<div class="boss-entry ${slain ? "slain" : ""}${open ? " open" : ""}">`
        + `<button type="button" class="boss-head" data-toggle="${key}">`
        + `<span class="boss-ic">${iconize(m.icon ?? "💀")}</span>`
        + `<span class="boss-name">${escapeHtml(m.name)}</span>`
        + `<span class="boss-lvl">Lv ${m.level}</span>`
        + `<span class="boss-kills" title="Kills">${slain ? `${glyph("skull")} ${kills.toLocaleString()}` : "—"}</span>`
        + `<span class="boss-chevron">${open ? "▾" : "ⓘ"}</span>`
        + `</button>`
        + `<div class="boss-detail">${lore}${hintLine}${weak}<div class="boss-miles">${miles}</div></div>`
        + `</div>`;
    }).join("")
      + `<div class="tab-note">Tap a boss for its lore and milestones. Reach a kill milestone, then Claim for an XP lamp — pour it into any skill — with a guaranteed pet at 100.</div>`;

    // Cape of Varath: the grandmaster goal — every skill at 100 — as a progress bar.
    const capePct = skillIds.length ? (capeMaxed / skillIds.length) * 100 : 0;
    const capeNote = capeOwned
      ? "Earned — the mark of a true master of Varath."
      : capeMaxed >= skillIds.length
        ? "All skills maxed! Buy it from the Cape Master in Ironvale (1,000,000g)."
        : `Master every skill to earn it — ${skillIds.length - capeMaxed} to go.`;
    const capeBody =
      `<div class="char-cape${capeOwned ? " done" : ""}">` +
      `<div class="char-cape-top"><span>${iconize("🧥")} Cape of Varath</span><span class="char-cape-count">${capeMaxed} / ${skillIds.length}</span></div>` +
      `<div class="char-cape-bar"><div class="char-cape-fill" style="width:${capePct}%"></div></div>` +
      `<div class="char-cape-note">${escapeHtml(capeNote)}</div></div>`;

    // Collection Log (OSRS-style): every item grouped by category, obtained ones
    // shown in colour with a count, the rest a greyed silhouette to chase.
    const owned = new Set<ItemId>(player.collection ?? []);
    const collItems = (Object.values(this.content.items) as ItemDef[])
      .filter((d) => d.cat && d.cat !== "Quest");
    const collCats: string[] = [];
    for (const d of collItems) { const c = d.cat!; if (!collCats.includes(c)) collCats.push(c); }
    collCats.sort();
    let collDone = 0, collTotal = 0;
    const collCatsBody = collCats.map((cat) => {
      const rows = collItems.filter((d) => d.cat === cat).sort((a, b) => a.name.localeCompare(b.name));
      const have = rows.filter((d) => owned.has(d.id)).length;
      collDone += have; collTotal += rows.length;
      return subSection(`coll:${cat}`, cat, `${have}/${rows.length}`, () =>
        `<div class="coll-grid">` + rows.map((d) => {
          const got = owned.has(d.id);
          return `<span class="coll-cell ${got ? "got" : "locked"}" title="${escapeHtml(got ? d.name : "???")}">${itemIconSVG(d)}</span>`;
        }).join("") + `</div>`);
    }).join("");
    // The chase meter: how much of Varath's ledger this account has touched.
    const collPct = collTotal ? Math.floor((collDone / collTotal) * 100) : 0;
    const collBody =
      `<div class="coll-meter"><div class="coll-meter-top"><span>Logged</span><span>${collDone} / ${collTotal} · ${collPct}%</span></div>` +
      `<div class="char-cape-bar"><div class="char-cape-fill" style="width:${collPct}%"></div></div></div>` +
      collCatsBody;

    // Mastery: the long-tail prestige surfacing (audit T5·01–03). Master-stars
    // count the 25M/50M/100M-XP tiers a skill has passed (past the level-100
    // cap the game never showed), plus the Delve depth record and the duel ladder.
    const STAR_TIERS = [25_000_000, 50_000_000, 100_000_000];
    let totalStars = 0, fullMastery = 0, totalXp = 0;
    const starRows = skillIds.map((id) => {
      const xp = player.skills[id]?.xp ?? 0;
      totalXp += xp;
      const stars = STAR_TIERS.filter((t) => xp >= t).length;
      if (stars >= 3) fullMastery += 1;
      totalStars += stars;
      const name = (this.content.skills[id] as { name?: string } | undefined)?.name ?? id;
      return { name, stars, xp };
    }).filter((r) => r.stars > 0).sort((a, b) => b.xp - a.xp);
    const starChips = starRows.length
      ? `<div class="mastery-chips">` + starRows.map((r) =>
          `<span class="mastery-chip" title="${escapeHtml(r.name)} — ${r.xp.toLocaleString()} XP">${escapeHtml(r.name)} <span class="mastery-star">${"★".repeat(r.stars)}</span></span>`).join("") + `</div>`
      : `<div class="tab-note">No master stars yet — earned at 25M, 50M and 100M XP in a skill, far past level 100.</div>`;
    const depth = player.delveDepthRecord ?? 0;
    const st = player.stats;
    const dRating = st.duelRating, dBest = st.duelBestStreak ?? 0, dW = st.duelWins ?? 0, dL = st.duelLosses ?? 0;
    const masteryBody =
      `<div class="mastery-head">Total XP <b>${Math.round(totalXp).toLocaleString()}</b> · Master stars <b>${totalStars}</b>${fullMastery ? ` · 100M skills <b>${fullMastery}</b>` : ""}</div>` +
      starChips +
      `<div class="mastery-row">${iconize("🕳️")} Deepest Delve — ${depth > 0 ? `<b>Depth ${depth}</b>` : "not yet past the gauntlet"}</div>` +
      `<div class="mastery-row">${iconize("⚔️")} Duel ladder — ${dRating !== undefined ? `Rating <b>${dRating}</b> · best streak <b>${dBest}</b> · ${dW}W/${dL}L` : "step into the ring to earn a rating"}</div>`;

    // The top-level sections.
    const section = (key: string, title: string, count: string, body: string): string => {
      const open = this.openSecs.has(key);
      return `<div class="rec-sec ${open ? "open" : ""}"><button type="button" class="rec-head" data-toggle="${key}">${chev(open)}<span class="rec-secname">${title}</span><span class="rec-count">${count}</span></button>${open ? `<div class="rec-body">${body}</div>` : ""}</div>`;
    };

    this.recordsEl.innerHTML =
      section("bosslog", "Boss Log", `${bossSlain}/${bosses.length}`, bossBody) +
      section("collection", "Collection Log", `${collDone}/${collTotal} \u00b7 ${collPct}%`, collBody) +
      section("cape", "Cape of Varath", capeOwned ? "Earned" : `${capeMaxed}/${skillIds.length}`, capeBody) +
      section("mastery", "Mastery & Ladders", totalStars > 0 ? `${totalStars}★` : (depth > 0 ? `Depth ${depth}` : "—"), masteryBody) +
      section("companions", "Companions", `${compOwned}/${comps.length}`, compBody) +
      section("achievements", "Achievements", `${player.achievements.length}/${achTotal}`, achBody) +
      section("archive", "Archive", `${player.lore.length}/${loreTotal}`, loreBody);
  }
}

/** "0m" / "47m" / "3h 12m" / "128h" — a compact, friendly playtime readout. */
function formatPlaytime(ms: number): string {
  const totalMin = Math.floor((ms || 0) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (h >= 100) return `${h}h`;
  return `${h}h ${m}m`;
}

function panel(className: string): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  return el;
}

function heading(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "hud-heading";
  el.textContent = text;
  return el;
}

function note(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "tab-note";
  el.textContent = text;
  return el;
}

/** A small section divider within a tab (e.g. "Worn", "Companions"). */
function subhead(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "tab-subhead";
  el.textContent = text;
  return el;
}

/** Friendly slot names for inspect lines. */
const SLOT_LABEL: Record<string, string> = {
  mainhand: "Weapon",
  offhand: "Shield",
  helmet: "Helm",
  armor: "Body",
  legs: "Legs",
  boots: "Boots",
  ring: "Ring",
  necklace: "Amulet",
  cape: "Cape",
};

/** A one-line "Weapon · +2 damage" summary for a piece of gear (or ""). */
function gearLine(def: {
  slot?: string;
  acc?: number;
  dmg?: number;
  def?: number;
  tool?: "hatchet" | "pickaxe" | "rod";
}): string {
  // Tools live in the mainhand but read as tools, not weapons.
  if (def.tool) {
    const kind = def.tool === "rod" ? "Fishing rod" : def.tool[0]!.toUpperCase() + def.tool.slice(1);
    return `${kind} · wielded in hand`;
  }
  if (!def.slot || !(def.slot in SLOT_LABEL)) return "";
  const bits: string[] = [];
  if (def.acc) bits.push(`+${def.acc} accuracy`);
  if (def.dmg) bits.push(`+${def.dmg} damage`);
  if (def.def) bits.push(`+${def.def} defence`);
  const where = SLOT_LABEL[def.slot]!;
  return bits.length ? `${where} · ${bits.join(", ")}` : where;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
