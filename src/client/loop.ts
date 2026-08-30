/**
 * src/client/loop.ts
 * ------------------
 * The client game loop and all input handling.
 *
 * The loop's job each frame: read the clock, ask the core to advance time
 * (tick), react to the events the core returns (log lines, dialogue, hit
 * numbers), move the camera, and paint. Taps are turned into INTENTS and
 * handed to the core — the loop NEVER edits world state itself (RULE 2).
 *
 * Input is OSRS-flavoured:
 *   - a short tap does the obvious thing (walk there / interact with that),
 *   - a long press (or right-click) opens an action menu (Interact / Walk
 *     here / Examine),
 *   - a marker shows where you tapped, and the thing you're busy with glows.
 */

import type {
  Content,
  FishRecord,
  Intent,
  ItemId,
  MonsterStats,
  ObjKind,
  SkillAction,
  SkillId,
  TileType,
  Vec2,
  WorldEvent,
  WorldObjectDef,
  WorldState,
} from "../core/types.ts";
import { BankUI } from "./bankUI.ts";
import { ShopUI } from "./shopUI.ts";
import { BountyUI } from "./bountyUI.ts";
import { RecordsUI } from "./recordsUI.ts";
import { DuelUI } from "./duelUI.ts";
import { TensionUI } from "./tensionUI.ts";
import { LevelUp } from "./levelUp.ts";
import { ActiveSkill } from "./activeSkill.ts";
import type { ContextMenu, MenuItem, MenuTab } from "./contextMenu.ts";
import { Dialogue } from "./dialogue.ts";
import type { Guide } from "./guide.ts";
import type { Tutorial } from "./tutorial.ts";
import { Hud } from "./hud.ts";
import { Minimap, WorldMapModal } from "./minimap.ts";
import { biomeAt, Camera, getFrameMeter, drawWorld, interpTile, stepProgress, setCombatHits, setDrawDistance, setLootLabels, TILE, type HitFx } from "./render.ts";
import { CRIER_SHOUTS } from "./crier.ts";
import { audio, type CreatureVoice, type Sfx } from "./audio.ts";
import { currentGhosts, startPresence } from "./presence.ts";
import { getTrackedQuest } from "./questTrack.ts";
import { resolveGear } from "./gearLook.ts";
import { DUNGEON_TOP, enterableAt, instanceRectAt, INTERIOR_TOP, OVERWORLD_HEIGHT } from "../content/map.ts";
import { DecorateUI } from "./decorate.ts";
import { objectPos, objectHidden, travelFare, equipRequirement, combatLevel, TICK_MS, NPC_STEP_TICKS } from "../core/worldCore.ts";
import { findPath, pathToAdjacent, pathToWithin } from "./pathfinding.ts";
import { getSocial, submitCurrent } from "./social.ts";
import { currentUser } from "./supabase.ts";

/**
 * The bridge to the core. main.ts builds this so the loop never imports the
 * core directly with its own clock/RNG — keeping the seam where a network
 * connection could slot in later (RULE 2 / multiplayer-ready).
 */
export interface CoreBridge {
  readonly state: WorldState;
  readonly content: Content;
  walkable(x: number, y: number): boolean;
  /** The recipes a station (fire/furnace/anvil) offers. */
  stationRecipes(station: ObjKind): SkillAction[];
  send(intent: Intent): WorldEvent[];
  tick(nowMs: number): WorldEvent[];
}

/**
 * An OSRS hitsplat: a coloured lozenge with the number inside, pinned over the
 * target rather than rising away from it.
 *
 * Kept OUT of the world's y-sorted sprite list on purpose — a splat must never
 * be occluded by the thing it is reporting on. It is drawn in the overlay pass
 * with the floats, which is already the "always on top" layer.
 */
interface Hitsplat {
  x: number; // tile coords
  y: number;
  amount: number;
  kind: "hit" | "zero" | "miss" | "poison" | "venom";
  weak: boolean;
  born: number;
}

interface FloatText {
  x: number; // tile coords
  y: number;
  text: string;
  color: string;
  born: number;
  size?: number;
  /** How long the text lingers, in ms (defaults to the standard float life). */
  life?: number;
}

/** A short impact burst (chips / sparks / splash) at a tile, for action feel. */
interface Spark {
  x: number; // tile coords
  y: number;
  born: number;
  color: string;
  n: number; // number of shards
}

/** An expanding shockwave ring — a death poof when a creature is slain. */
interface Ring {
  x: number; // tile coords
  y: number;
  born: number;
  color: string;
}

/** A little kick-up under the feet as you move — dust on land, a splash on water. */
interface Puff {
  x: number; // tile coords
  y: number;
  born: number;
  kind: "dust" | "splash";
}

/** An arrow or magic bolt streaking from a shooter to its target (tile coords). */
interface Projectile {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  born: number;
  kind: "arrow" | "bolt";
  color: string;
}

/** Impact-burst colour by the skill being trained (wood chips, stone, splash…). */
const SPARK_COLOR: Record<string, string> = {
  forestry: "#9a7a4a",
  mining: "#a59a8c",
  fishing: "#6fa0c0",
  hunter: "#9a7a4a",
  smithing: "#e0903a",
  cooking: "#e08a3a",
  crafting: "#caa05a",
  herblore: "#7fae6a",
  construction: "#a59a8c",
  woodcraft: "#9a7a4a",
  farming: "#7fae6a",
  // Combat + support skills — used to tint their XP drops (the gather-spark burst
  // never fires for these, so the extra keys are harmless there).
  edge: "#d8574a", vigour: "#e08a3a", ward: "#6f9ac0", draw: "#8fbf6a",
  faith: "#b98cd8", vitality: "#7fae6a", agility: "#6fc0b0", bounty: "#e2b54a",
};

/** Which throat a monster speaks with, from its id (see audio.creature). */
const VOICE_KEYS: [string, CreatureVoice][] = [
  ["wyrm", "dragon"], ["dragon", "dragon"],
  ["wolf", "wolf"], ["hound", "wolf"], ["greyback", "bear"],
  ["boar", "boar"], ["deer", "boar"],
  ["bear", "bear"], ["lion", "cat"],
  ["rat", "small"], ["bat", "small"],
  ["crawler", "insect"], ["lurker", "insect"], ["horror", "insect"],
  ["serpent", "serpent"],
  ["wraith", "undead"], ["boneman", "undead"], ["hollow", "undead"],
  ["ferryman", "undead"], ["prophet", "undead"],
  ["golem", "brute"], ["troll", "brute"], ["keeper", "brute"], ["knight", "brute"],
  ["orc", "orc"], ["warlord", "orc"],
];
function voiceFor(monsterKey: string): CreatureVoice {
  for (const [k, v] of VOICE_KEYS) if (monsterKey.includes(k)) return v;
  return "human"; // outlaws, cultists, guards, farmers — anyone on two legs
}

/** Each trade's own voice, played on its XP beat (see audio.ts for the sounds). */
const SKILL_SFX: Record<string, Sfx> = {
  forestry: "chop",
  mining: "mine",
  fishing: "splash",
  hunter: "rustle",
  smithing: "smith",
  cooking: "sizzle",
  crafting: "craft",
  herblore: "brew",
  construction: "craft",
  woodcraft: "craft",
  farming: "dig",
  agility: "vault",
  faith: "pray",
};

interface Marker {
  x: number;
  y: number;
  born: number;
}

interface TapFlash {
  objId: string;
  born: number;
}

interface Press {
  startX: number;
  startY: number;
  tile: Vec2;
  longFired: boolean;
  moved: boolean;
}

const LONG_PRESS_MS = 330;
const MOVE_CANCEL_PX = 12;
const MARKER_LIFE = 600;
const FLASH_LIFE = 450;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2.4;
const ZOOM_KEY = "varath-zoom"; // a client display preference, kept in localStorage
const clampZoom = (z: number): number => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
function readZoom(): number {
  const raw = Number(localStorage.getItem(ZOOM_KEY));
  return Number.isFinite(raw) && raw > 0 ? clampZoom(raw) : 1;
}

// Draw distance: how many tiles out from the player the world is painted. A
// client display preference (helps wide screens / slower machines). The slider
// runs DRAW_MIN..DRAW_MAX tiles; DRAW_MAX means "unlimited" (Infinity).
export const DRAW_MIN = 8;
export const DRAW_MAX = 40;
const DRAW_KEY = "varath-drawdist";
function readDrawDist(): number {
  const raw = Number(localStorage.getItem(DRAW_KEY));
  return Number.isFinite(raw) && raw >= DRAW_MIN && raw < DRAW_MAX ? raw : Infinity;
}

// Floor-loot name labels (OSRS-style). On by default; a client display preference.
const LOOT_KEY = "varath-loot-labels";
function readLootLabels(): boolean {
  return localStorage.getItem(LOOT_KEY) !== "0";
}

/** The verb shown for interacting with each kind of object. */
const VERB: Record<ObjKind, string> = {
  stall: "Steal from",
  dungeon_gate: "Inspect",
  puzzle_lever: "Pull",
  dungeon_chest: "Open",
  ruin_prop: "Examine",
  remains: "Examine",
  tree: "Chop",
  rock: "Mine",
  fishing_spot: "Fish",
  npc: "Talk to",
  monster: "Attack",
  bank: "Open",
  grand_exchange: "Trade at",
  forage_spot: "Forage",
  fire: "Cook at",
  furnace: "Smelt at",
  anvil: "Forge at",
  shrine: "Examine",
  plant_patch: "Tend",
  tree_patch: "Tend",
  portal: "Enter",
  trap: "Set snare",
  bounty_board: "Read",
  housing_plot: "Claim",
  build_hotspot: "Build at",
  house_door: "Enter",
  room_seal: "Build wing",
  cauldron: "Brew at",
  workbench: "Build at",
  crafting_table: "Craft at",
  cart: "Examine",
  fountain: "Examine",
  sawmill: "Mill at",
  critter: "Watch",
  lamppost: "Examine",
  fence: "Examine",
  boat: "Examine",
  reeds: "Examine",
  deadfall: "Examine",
  signpost: "Read",
  bone_cairn: "Examine",
  waystone: "Travel from",
  agility_obstacle: "Traverse",
  relic: "Read",
  pier_spot: "Cast at",
  record_board: "Read",
  trail_board: "Read",
  pier_gate: "Examine",
  banner: "Examine",
};

const EXAMINE_OBJECT: Record<ObjKind, string> = {
  stall: "Somebody's livelihood, laid out in reach. The owner glances up now and then.",
  tree: "A pale ashwood — common as dirt, and the forester's first tree.",
  rock: "A workable seam of stone.",
  fishing_spot: "Dark ripples at the head of the Redrun; ashfin move below.",
  npc: "Someone met on the road.",
  monster: "A wild thing of the hills.",
  bank: "A sturdy iron-bound chest. Your goods are safe in it.",
  grand_exchange: "The Grand Exchange booth — post buy and sell offers to traders across all of Varath.",
  forage_spot: "A tangle of wild growth — herbs, mushrooms or roots for a sharp-eyed forager.",
  fire: "A steady cooking fire. Raw catch goes in; a meal comes out.",
  furnace: "A small stone furnace, hot enough to render ore to bar.",
  anvil: "A pitted iron anvil. Bring bars and a hammer to beat out gear.",
  shrine: "A weathered standing stone, older than any road here.",
  plant_patch: "A bed of tilled soil, waiting for a seed.",
  tree_patch: "A cleared plot where a sapling could take root.",
  portal: "A dark cave mouth in the rock. It descends into the dark below.",
  trap: "A snare set among the runs and burrows. Patience catches game.",
  bounty_board: "A board of nailed-up notices — slaying contracts, paid in Hunt Marks.",
  housing_plot: "A vacant homestead yard. Claim it, and its house is yours to furnish.",
  build_hotspot: "A space for furniture — build a piece here from your Construction materials.",
  house_door: "The door to a home. Step through to its own quiet interior.",
  room_seal: "A walled-off doorway. Upgrade your house to open the room beyond it.",
  dungeon_gate: "A sealed slab of fitted stone. Something in these halls must open it.",
  puzzle_lever: "An iron lever in a carved mount. The order of throwing matters — read the walls.",
  dungeon_chest: "A heavy chest, banded and clasped. Whatever it keeps, it has kept a long time.",
  ruin_prop: "Broken masonry of the old north-folk, older than any road on the map.",
  remains: "The dark keeps what it is given.",
  cauldron: "A blackened cauldron over coals. Flask in hand, you can brew here.",
  workbench: "A sturdy builder's bench, racked with saws and chisels.",
  crafting_table: "An artisan's table — tanning frame, glass-pipe and a jeweller's vice.",
  cart: "A market stall, its awning faded by weather and woodsmoke.",
  fountain: "A stone fountain, the water bright over old green-stained basins.",
  sawmill: "A sawmill bench — frame-saws, a shaving-horse and a bowyer's vice.",
  critter: "A wild thing, going about its small business. It startles as you near.",
  lamppost: "An iron lamp on a tall post. Lit against the dark by whoever walks the rounds.",
  fence: "A post-and-rail fence, silvered by the weather and leaned on by generations.",
  boat: "A small clinker-built boat, tarred against the water it works.",
  reeds: "Cattails at the water's edge, seed heads nodding. Duck country.",
  deadfall: "A dead tree, gone back to the wood. Beetles and moss have the run of it now.",
  signpost: "A weathered fingerpost, its boards pointing the old roads.",
  bone_cairn: "A cairn of stacked bones, a skull set on top like a marker. Each one was a person the Boneman kept.",
  waystone: "A Courier waystone. Pay the toll and a rider will see you to another.",
  agility_obstacle: "Part of a training circuit. Clear each leg in turn to build your Agility.",
  relic: "Something was left here to be found — a page, a rubbing, a mark. Read it.",
  pier_spot: "Open deep water at the pier's end, where the big fish run. Cast, then hold the line.",
  record_board: "A weathered board at the pier head, every great catch chalked up with its angler's name.",
  trail_board: "The Varathian Trail's standings board — your laps run and your progress toward the Trailblazer set.",
  pier_gate: "A rope strung across the planks. The pier-warden hasn't given you leave to pass.",
  banner: "The town's own colours, flying over the square. Every settlement stitches its own.",
};

const EXAMINE_TILE: Record<TileType, string> = {
  grass: "Tufts of pale hill grass.",
  dirt: "Bare, trodden earth.",
  path: "A worn stone path.",
  sand: "Soft strand sand, ridged by the last high water.",
  stone: "Cold grey stone underfoot.",
  water: "The cold head of the Redrun, where the hill-streams braid.",
  moss: "Deep moss of the Greyoak floor, soft and damp underfoot.",
  mountain: "Sheer Spine rock — no way up here. The pass lies around it.",
  snow: "Hard-packed snow of the high Spine. The wind never quite stops.",
  bog: "Soft Heartmoor ground. The peat keeps whatever it takes whole.",
  ash: "Warm cracked earth of the Ashfen Flats. The ground is uncomfortable to stand on.",
  cave: "The dark floor of the Marrow Deeps. Your torchlight finds no far wall.",
  cave_wall: "Dressed cave rock — too smooth, in places, to be only the dark's work.",
  deep: "The open grey of the Eyeless Sea. It gives back no landmark.",
  wall: "Ironvale's dressed-stone rampart. Old work, and still sound.",
  plank: "A swept timber floor, warm underfoot. The boards of a home.",
};

/** Examine flavour for the tree species. */
const EXAMINE_TREE: Record<string, string> = {
  ashwood: "A pale ashwood — common as dirt, and the forester's first tree.",
  coldpine: "A cold blue-green pine of the Greyoak edge. Resinous and straight.",
  greyoak: "A wide-canopied greyoak, old before Ironvale was named. Hard timber.",
};

export class Game {
  private g: CanvasRenderingContext2D;
  private cam: Camera = { x: 0, y: 0 };
  private zoom = readZoom();
  /** Draw distance in tiles (Infinity = unlimited). A display preference. */
  private drawDist = readDrawDist();
  /** Whether floor-loot piles show their item name (OSRS-style). */
  private lootLabels = readLootLabels();
  /** Device-pixel ratio baked into the backing store for crisp rendering. */
  private dpr = 1;
  /** Pending deferred re-measure (mobile rotation reports stale sizes). */
  private resizeTimer = 0;
  /** Active touch points, for pinch-to-zoom. */
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private floats: FloatText[] = [];
  private hitsplats: Hitsplat[] = [];
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private puffs: Puff[] = [];
  private projectiles: Projectile[] = [];
  private lastPuff = 0;
  /** Recent per-entity hits (id → when/direction), driving the hit-pop in render. */
  private combatHits: Map<string, HitFx> = new Map();
  private levelUp: LevelUp;
  private activeSkill: ActiveSkill;
  private camInitialised = false;
  /** Frame-time meter state: the readout element, a rolling mean, and the worst
   *  frame in the current window (a mean alone hides the stutter that is felt). */
  private meterEl: HTMLElement | null = null;
  private meterMean = 0;
  private meterWorst = 0;
  private meterShownAt = 0;
  /** Real time of the previous rendered frame, for frame-rate-independent easing. */
  private lastFrameNow = 0;
  /** Fraction [0,1] through the current game tick, refreshed once per frame in
   *  update(). Every overlay that pins to a moving entity interpolates with this
   *  (via playerRenderPos / objRenderPos) so the whole scene glides together
   *  instead of the avatar sliding while its bars/markers snap to the tile. */
  private frameAlpha = 0;

  private menu: ContextMenu;
  private minimap: Minimap;
  private worldMap: WorldMapModal;
  private bank: BankUI;
  private shop: ShopUI;
  private bounty: BountyUI;
  private records: RecordsUI;
  private duel: DuelUI;
  private tension: TensionUI;
  /** Active "make all" run at a station: keep crafting every makeable recipe
   *  there (Cook all at a fire, Smelt all at a furnace) until nothing's left. */
  private cookAll: { objId: string; station: ObjKind } | null = null;
  /** An item armed with "Use", awaiting a target tap (OSRS use-on). */
  private useItem: { slot: number; item: ItemId } | null = null;
  /** A bounded craft run (Use → cook N): stop after `n` of `rawItem` are used. */
  private craftLimit: { rawItem: string; startCount: number; n: number } | null = null;
  private press: Press | null = null;
  private longTimer: number | null = null;
  private marker: Marker | null = null;
  private tapFlash: TapFlash | null = null;
  /** OSRS-style overhead chat: the last thing the player said, floating over their
   *  head until `until` (performance.now() ms). Set by the HUD on send. */
  private speech: { text: string; until: number } | null = null;
  /** Nearby players' latest chat lines, keyed by name, floated over their ghost. */
  private ghostSpeech = new Map<string, { text: string; until: number }>();
  /** The Town Crier's shout cadence: which line is up, when it clears, and when
   *  the next one fires. Advances globally; shown + logged only when you're near. */
  private crierAt = 12000; // first bulletin ~12s after load
  private crierIdx = 0;
  private crierShout: { text: string; until: number } | null = null;
  private crierLogged = false;
  /** Timestamp of the last hit the player took — drives a red screen flash. */
  private hurtFlash = 0;
  /** Active screen-shake: when it started, how strong (px), and how long. */
  private shake: { born: number; mag: number; dur: number } | null = null;
  /** Throttle so the gather "tick" SFX doesn't machine-gun on fast actions. */
  private lastGatherSfx = 0;
  private decorate!: DecorateUI;
  private lastSceneCheck = 0;
  private lastFoeVocal = 0;
  private combatTargetId: string | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private bridge: CoreBridge,
    private hud: Hud,
    private dialogue: Dialogue,
    private uiRoot: HTMLElement,
    menu: ContextMenu,
    private guide: Guide,
    private tutorial: Tutorial,
  ) {
    const g = canvas.getContext("2d");
    if (!g) throw new Error("Could not get a 2D canvas context.");
    this.g = g;
    this.menu = menu;
    this.worldMap = new WorldMapModal(uiRoot, bridge.content, (tile) => this.walkToWorldTile(tile));
    this.minimap = new Minimap(
      uiRoot,
      () => this.worldMap.show(),
      (tile) => this.walkToWorldTile(tile),
    );
    this.bank = new BankUI(uiRoot, bridge.content, (intent) => this.dispatch(intent), menu);
    this.shop = new ShopUI(uiRoot, bridge.content, (intent) => this.dispatch(intent));
    this.bounty = new BountyUI(uiRoot, bridge.content, (intent) => this.dispatch(intent));
    this.records = new RecordsUI(uiRoot, () => this.bridge.state.player.appearance.name);
    this.duel = new DuelUI(uiRoot, bridge.content, () => this.bridge.state.player, (intent) => this.dispatch(intent));
    this.tension = new TensionUI(uiRoot, (success) => this.dispatch({ type: "LAND_FISH", success }));
    this.levelUp = new LevelUp(uiRoot, bridge.content);
    this.activeSkill = new ActiveSkill(uiRoot, bridge.content);
    this.decorate = new DecorateUI(uiRoot, {
      state: () => this.bridge.state,
      content: bridge.content,
      dispatch: (i) => this.dispatch(i),
      menu,
      log: (m) => this.hud.log(m),
      inHome: () => this.playerInHome(),
    });

    this.resize();
    window.addEventListener("resize", () => this.resize());
    // Mobile rotation is the awkward case: the `resize`/`orientationchange`
    // events fire before the browser has settled the new viewport size, so a
    // single measurement reads stale dimensions and the canvas ends up the wrong
    // shape. Re-measure a few times after the event, and lean on visualViewport
    // (which fires once the URL bar / safe-area has actually resized).
    window.addEventListener("orientationchange", () => this.scheduleResize());
    window.visualViewport?.addEventListener("resize", () => this.resize());

    canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
    // Escape closes the top-most open menu / pop-up (and only that one), so the
    // keyboard dismisses them deliberately rather than relying on an off-click.
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        for (const ui of [this.menu, this.dialogue, this.tension, this.records, this.worldMap, this.bank, this.shop, this.bounty]) {
          if (ui.isOpen()) { ui.close(); break; }
        }
        return;
      }
      // Everything below is a game shortcut, so bail out the moment the player
      // is typing. The chat input stops propagation itself, but a global handler
      // cannot rely on every current and future field remembering to.
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement | null)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // The quick bar, from the keyboard. Deliberately the same four actions as
      // the on-screen bar rather than a second, larger vocabulary — one set of
      // things to remember.
      const key = e.key.toLowerCase();
      const qb = key === "e" ? "eat" : key === "q" ? "style" : key === "b" ? "bless"
        : (key === " " || e.code === "Space") ? "spec" : null;
      if (qb) {
        e.preventDefault();
        this.hud.quickKey(qb);
        return;
      }
      if (key === "r") {
        e.preventDefault();
        this.dispatch({ type: "TOGGLE_RUN" });
      }
    });
    window.addEventListener("pointercancel", (e) => this.pointers.delete(e.pointerId));
    // Mouse-wheel zoom.
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.setZoom(this.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });
    // Suppress the browser's own right-click menu game-wide — we provide our own
    // OSRS-style menu, and a stray desktop context menu over the HUD or page
    // margins breaks the illusion. Text fields keep it so copy/paste still works.
    window.addEventListener("contextmenu", (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
    });
  }

  start(): void {
    this.hud.log("Welcome to The Knuckle Hills.");
    // A duel stake still escrowed on boot means the game was closed mid-fight —
    // quitting forfeits, so the stake is settled as a loss and never returned.
    const stake = this.bridge.state.player.duelStake;
    if (stake) {
      this.dispatch({ type: "DUEL_RESOLVE", duelId: stake.duelId, outcome: "lost" });
      this.hud.log("You abandoned a duel — your stake was forfeited.");
    }
    // An XP reward left unspent last session? Prompt for its skill now.
    const lamps = this.bridge.state.player.xpLamps;
    if (lamps && lamps.length > 0) this.openXpLamp(lamps[0]!);
    // Publish our presence and watch for nearby ghosts (online players only).
    startPresence(() => {
      const p = this.bridge.state.player;
      if (!p.alive) return null;
      return {
        x: p.pos.x, y: p.pos.y, name: p.appearance.name, look: p.appearance,
        gear: resolveGear(p.equipment, this.bridge.content),
      };
    });
    const frame = (now: number) => {
      requestAnimationFrame(frame); // schedule next first so one bad frame can't stop the loop
      this.update(now);
    };
    requestAnimationFrame(frame);
  }

  /** Open the Duel Ring window directly (used by the interact intercept and the
   *  automated two-tab duel test seam). */
  openDuelRing(): void { this.duel.show(); }

  /** Send an intent and immediately react to its events (for UI actions). */
  dispatch(intent: Intent): void {
    const pre = this.bridge.state.player.pos;
    const px = pre.x, py = pre.y;
    const events = this.bridge.send(intent);
    // The waystone sweep — only when the ride actually happened (the core can
    // refuse it over an unpaid fare, in which case nothing should sound).
    if (intent.type === "TRAVEL") {
      const p = this.bridge.state.player.pos;
      if (p.x !== px || p.y !== py) audio.play("teleport");
    }
    this.handleEvents(events, performance.now());
  }

  /**
   * Size the backing store to the element's CSS box × the device-pixel ratio,
   * so the world is rendered crisply on high-density (phone/retina) screens
   * instead of being upscaled from a low-res buffer. The DPR is folded into the
   * draw transform (see `update`), and every screen↔world conversion divides it
   * back out, so input mapping is unaffected.
   */
  private resize(): void {
    // Cap the backing-store resolution: a hi-DPI screen at DPR 3 renders 9× the
    // pixels of DPR 1, the biggest single cost of a stutter. Cap at 2 normally,
    // and 1 in Performance mode — far smoother on slower machines.
    const cap = localStorage.getItem("varath-perf") === "1" ? 1 : 2;
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), cap);
    // Prefer visualViewport: on mobile it reports the *settled* visible size
    // (excluding the URL bar) and updates correctly through a rotation.
    const cssW = Math.round(this.canvas.clientWidth || window.innerWidth);
    const cssH = Math.round(this.canvas.clientHeight || window.innerHeight);
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (w === this.canvas.width && h === this.canvas.height && dpr === this.dpr) {
      return; // nothing changed — avoid clearing the canvas needlessly
    }
    this.dpr = dpr;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  /**
   * Re-measure now and again shortly after — orientation changes don't settle
   * the viewport synchronously, so one measurement isn't enough on mobile.
   */
  private scheduleResize(): void {
    this.resize();
    requestAnimationFrame(() => this.resize());
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.resize(), 300);
  }

  /** Visible view width in world pixels (DPR- and zoom-independent). */
  private get viewW(): number {
    return this.canvas.width / (this.zoom * this.dpr);
  }

  /** Visible view height in world pixels (DPR- and zoom-independent). */
  private get viewH(): number {
    return this.canvas.height / (this.zoom * this.dpr);
  }

  /** True while the player stands on their own home's floor (the interior band). */
  private playerInHome(): boolean {
    const p = this.bridge.state.player.pos;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (y < INTERIOR_TOP) return false; // homes live in the hidden interior band
    const map = this.bridge.state.map;
    return map.tiles[y * map.width + x] === "plank";
  }

  private update(now: number): void {
    // 1) Advance the world and react to what happened.
    const events = this.bridge.tick(now);
    this.handleEvents(events, now);
    this.guide.update(this.bridge.state);
    this.tutorial.update(this.bridge.state);
    this.decorate.update();
    // Keep the soundscape on the player's region (throttled; setScene no-ops
    // when nothing changed). Indoors — a home instance or under a lifted city
    // roof — the outside world muffles.
    if (now - this.lastSceneCheck > 400) {
      this.lastSceneCheck = now;
      const p = this.bridge.state.player.pos;
      const px = Math.round(p.x), py = Math.round(p.y);
      // The Act II dungeon band gets the deep-cave soundscape at full volume —
      // biomeAt would fall through to muffled overworld hills down there.
      if (py >= DUNGEON_TOP) {
        audio.setScene("marrow", false);
      } else {
        const indoor = instanceRectAt(px, py) !== null || enterableAt(px, py) !== null;
        audio.setScene(biomeAt(px, py), indoor);
      }
    }
    // Combat engagement: the moment a fight starts the foe speaks (and a named
    // boss brings its own battle music); leaving the fight cuts the music.
    const act2 = this.bridge.state.player.activity;
    const curTarget = act2.kind === "combat" ? (act2.targetId ?? null) : null;
    if (curTarget !== this.combatTargetId) {
      if (curTarget) {
        const mkey = this.monsterKeyOf(curTarget);
        if (mkey) {
          audio.creature(voiceFor(mkey), "aggro");
          if (this.bridge.content.monsters[mkey]?.boss) audio.bossStart();
        }
      } else {
        audio.bossEnd(false); // fled or finished — a won fight already ended it
      }
      this.combatTargetId = curTarget;
    }
    // "Cook all": once the current dish finishes (activity idle), start the next
    // cookable recipe, until nothing's left to cook.
    if (this.cookAll && this.bridge.state.player.activity.kind !== "crafting") {
      if (!this.startNextCook()) this.cookAll = null;
    }
    // Bounded "Use → make N": stop once N of the raw item have been consumed
    // (counts burns too), or when the craft ends on its own.
    if (this.craftLimit) {
      const cur = this.invCount(this.craftLimit.rawItem);
      const used = this.craftLimit.startCount - cur;
      const idle = this.bridge.state.player.activity.kind !== "crafting";
      if (used >= this.craftLimit.n || idle) {
        if (!idle) this.dispatch({ type: "CANCEL" });
        this.craftLimit = null;
      }
    }

    // 2) Camera follows the player. `alpha` is how far through the current game
    // tick we are (0..1), so both the camera and the renderer interpolate the
    // player's discrete tile-hop into smooth motion. `frameDt` makes the camera
    // ease frame-rate-independent (same feel at 60Hz and 120Hz).
    const st = this.bridge.state;
    const alpha = Math.min(1, Math.max(0, (now - st.lastTickAt) / TICK_MS));
    this.frameAlpha = alpha;
    const frameDt = this.lastFrameNow === 0 ? 16 : Math.min(100, now - this.lastFrameNow);
    this.lastFrameNow = now;
    this.followCamera(alpha, frameDt);

    // 3) Paint the world (and its world-space overlays) under the zoom transform.
    //    The DPR is folded in here so one world pixel covers `zoom` CSS pixels at
    //    full device resolution; everything below works in world pixels.
    const paintT0 = getFrameMeter() ? performance.now() : 0;
    const s = this.zoom * this.dpr;
    const [shx, shy] = this.shakeOffset(now);
    this.g.setTransform(s, 0, 0, s, shx, shy);
    // Hand the renderer the live hit effects (and forget stale ones).
    for (const [id, fx] of this.combatHits) if (now - fx.born > 240) this.combatHits.delete(id);
    setCombatHits(this.combatHits);
    setDrawDistance(this.drawDist);
    setLootLabels(this.lootLabels);
    drawWorld(
      this.g, this.canvas, this.bridge.state, this.bridge.content, this.cam, now,
      this.viewW, this.viewH, currentGhosts(), alpha,
    );
    this.drawMarker(now);
    this.drawHighlights(now);
    this.drawActivityFeedback(now);
    this.drawTutorialArrow(now);
    this.drawQuestMarkers(now);
    this.emitFootsteps(now);
    this.drawPuffs(now);
    this.drawRings(now);
    this.drawProjectiles(now);
    this.drawSparks(now);
    this.drawTargetHealth();
    this.drawFloats(now);
    this.drawHitsplats(now);
    this.drawSpeech(now);
    this.updateCrier(now);
    this.g.setTransform(1, 0, 0, 1, 0, 0); // back to device space for the HUD/minimap
    this.drawHurtVignette(now);
    this.drawDeathOverlay(now);

    // 4) Refresh the HUD readouts and the minimap.
    this.hud.update(this.bridge.state);
    this.activeSkill.update(this.bridge.state, now);
    this.duel.tick(); // pop the ring window when a challenge lands + drain fight events
    this.minimap.draw(this.bridge.state, this.bridge.content, this.frameAlpha);
    if (this.worldMap.isOpen()) {
      this.worldMap.draw(
        this.bridge.state,
        this.bridge.content,
        this.cam,
        this.viewW,
        this.viewH,
      );
    }

    // 5) The frame-time readout, when it is switched on.
    if (getFrameMeter()) this.updateMeter(performance.now() - paintT0, now);
    else if (this.meterEl) { this.meterEl.remove(); this.meterEl = null; }
  }

  /** Fold this frame's paint cost into the rolling readout. The mean is an
   *  exponential average (so it settles in about a second) and the worst frame
   *  is kept for a two-second window, because a smooth mean with a 40ms spike in
   *  it is not smooth. */
  private updateMeter(ms: number, now: number): void {
    this.meterMean = this.meterMean === 0 ? ms : this.meterMean + (ms - this.meterMean) * 0.06;
    if (ms > this.meterWorst) this.meterWorst = ms;
    if (now - this.meterShownAt < 250) return;
    this.meterShownAt = now;
    if (!this.meterEl) {
      const el = document.createElement("div");
      el.className = "frame-meter";
      el.setAttribute("aria-hidden", "true"); // a diagnostic, not content
      this.uiRoot.appendChild(el);
      this.meterEl = el;
    }
    this.meterEl.textContent =
      `${this.meterMean.toFixed(1)} ms  ·  peak ${this.meterWorst.toFixed(1)} ms`;
    this.meterWorst = 0;
  }

  /** Current screen-shake translation in device pixels (decays over its life). */
  private shakeOffset(now: number): [number, number] {
    if (!this.shake) return [0, 0];
    const age = now - this.shake.born;
    if (age >= this.shake.dur) { this.shake = null; return [0, 0]; }
    const decay = 1 - age / this.shake.dur;
    const amp = this.shake.mag * decay * this.dpr;
    // Fast oscillation, phase-shifted per axis, for a sharp rattle.
    const ox = Math.sin(age / 18) * amp;
    const oy = Math.cos(age / 13) * amp;
    return [ox, oy];
  }

  /** The player's smooth on-screen tile position (same interpolation the renderer
   *  and camera use), so every player-pinned overlay glides with the avatar. */
  private renderPlayerPos(): Vec2 {
    const st = this.bridge.state;
    const pl = st.player;
    return interpTile(pl.prevPos, pl.pos, stepProgress(pl.stepStartTick, pl.stepDurTicks, st.tickCount, this.frameAlpha));
  }

  /** The smooth on-screen tile position of a world object — interpolated for a
   *  wandering creature (so its HP bar / highlight tracks the gliding body), or
   *  the fixed def tile for anything that doesn't move. */
  private objRenderPos(def: WorldObjectDef): Vec2 {
    const st = this.bridge.state;
    const obj = st.objects[def.id];
    if (obj?.pos) {
      return interpTile(obj.prevPos, obj.pos, stepProgress(obj.moveStartTick ?? 0, NPC_STEP_TICKS, st.tickCount, this.frameAlpha));
    }
    return objectPos(def, obj);
  }

  private followCamera(alpha: number, frameDt: number): void {
    // Follow the INTERPOLATED player position (same smooth tile step the renderer
    // draws) rather than the raw sim tile, so the camera doesn't jerk each step.
    const st = this.bridge.state;
    const pl = st.player;
    const p = interpTile(pl.prevPos, pl.pos, stepProgress(pl.stepStartTick, pl.stepDurTicks, st.tickCount, alpha));
    const targetX = p.x * TILE + TILE / 2 - this.viewW / 2;
    const targetY = p.y * TILE + TILE / 2 - this.viewH / 2;
    if (!this.camInitialised) {
      this.cam.x = targetX;
      this.cam.y = targetY;
      this.camInitialised = true;
    } else {
      // Frame-rate-independent exponential ease: the fraction moved per frame is
      // derived from the elapsed time, so the camera has the same weight at any
      // refresh rate (the old fixed 0.12/frame chased twice as fast at 120Hz).
      const k = 1 - Math.exp(-frameDt / 90);
      this.cam.x += (targetX - this.cam.x) * k;
      this.cam.y += (targetY - this.cam.y) * k;
    }
    // Outdoors, keep the hidden instance band (homes / arenas, south of the
    // overworld) out of view by clamping the camera's bottom to the overworld.
    if (p.y < OVERWORLD_HEIGHT) {
      const maxY = OVERWORLD_HEIGHT * TILE - this.viewH;
      if (this.cam.y > maxY) this.cam.y = Math.max(0, maxY);
    }
  }

  /** Put the player on a tile and snap the camera to them, with no walk and no
   *  ease. Used by the automated screenshot tour to visit places the renderer
   *  should be judged on; it does not go through an intent, so it is a view
   *  operation, not a game move. */
  teleport(x: number, y: number): void {
    const pl = this.bridge.state.player;
    pl.pos = { x, y };
    pl.prevPos = { x, y };
    pl.path = [];
    this.camInitialised = false; // snap rather than glide across the map
  }

  /** Current view zoom (1 = default). */
  getZoom(): number {
    return this.zoom;
  }

  /** Set the view zoom (clamped) and remember it across sessions. */
  setZoom(z: number): void {
    this.zoom = clampZoom(z);
    try { localStorage.setItem(ZOOM_KEY, String(this.zoom)); } catch { /* ignore */ }
  }

  /** Current draw distance in tiles for the slider (DRAW_MAX = unlimited). */
  getDrawDist(): number {
    return this.drawDist === Infinity ? DRAW_MAX : this.drawDist;
  }

  /** Set the draw distance (tiles); DRAW_MAX (or more) means unlimited. */
  setDrawDist(d: number): void {
    this.drawDist = d >= DRAW_MAX ? Infinity : Math.max(DRAW_MIN, Math.round(d));
    try {
      localStorage.setItem(DRAW_KEY, String(this.drawDist === Infinity ? DRAW_MAX : this.drawDist));
    } catch { /* ignore */ }
  }

  /** Whether floor-loot name labels are shown. */
  getLootLabels(): boolean { return this.lootLabels; }

  /** Toggle floor-loot name labels (persisted). */
  setLootLabels(on: boolean): void {
    this.lootLabels = on;
    setLootLabels(on);
    try { localStorage.setItem(LOOT_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  }

  private handleEvents(events: WorldEvent[], now: number): void {
    const xpBySkill = new Map<SkillId, number>();
    for (const ev of events) {
      switch (ev.type) {
        case "LOG":
          // Denials are toasted + sounded so they can't be missed; everything
          // else stays a quiet log line.
          if (ev.tone === "err") this.hud.error(ev.message);
          else this.hud.log(ev.message);
          break;
        case "XP_GAINED": {
          xpBySkill.set(ev.skill, (xpBySkill.get(ev.skill) ?? 0) + ev.amount);
          // Surface the gain on the active-skill bar so it rises for whatever
          // you're training — including bursty skills like agility that aren't
          // a standing activity.
          this.activeSkill.onXp(ev.skill, ev.amount, now);
          // A little impact burst on the thing you're working, on the beat.
          const tid = this.bridge.state.player.activity.targetId;
          const tp = tid ? this.positionOf(tid) : null;
          if (tp) this.sparks.push({ x: tp.x, y: tp.y, born: now, color: SPARK_COLOR[ev.skill] ?? "#caa05a", n: 5 });
          // Every trade has its own voice: the axe bites, the pick rings, the
          // anvil clangs, the cauldron glugs (combat skills have their own hits).
          const sfx = SKILL_SFX[ev.skill];
          if (sfx && now - this.lastGatherSfx > 240) {
            this.lastGatherSfx = now;
            audio.play(sfx);
          }
          break;
        }
        case "LEVEL_UP": {
          const name = this.bridge.content.skills[ev.skill].name;
          this.hud.log(`You reach ${name} level ${ev.level}!`);
          this.levelUp.show(ev.skill, ev.level); // the OSRS "ding"
          audio.play("levelup");
          break;
        }
        case "INVENTORY_FULL":
          this.hud.error("Your pack is full.");
          this.cookAll = null; // a full pack stops a "Cook all" run
          break;
        case "DIALOGUE":
          this.dialogue.show(ev.npc, ev.lines);
          break;
        case "OPEN_TRAIL_BOARD":
          void this.showTrailStandings();
          break;
        case "MONSTER_KILLED": {
          const mkey = this.monsterKeyOf(ev.objId);
          const isBoss = mkey ? !!this.bridge.content.monsters[mkey]?.boss : false;
          // A death poof: a shockwave ring and a scatter of dark debris.
          const kp = this.positionOf(ev.objId);
          if (kp) {
            this.rings.push({ x: kp.x, y: kp.y, born: now, color: "rgba(226,72,58,0.7)" });
            this.sparks.push({ x: kp.x, y: kp.y, born: now, color: "#b8453a", n: 10 });
            this.sparks.push({ x: kp.x, y: kp.y, born: now + 40, color: "#5a4038", n: 7 });
            if (isBoss) {
              // An apex kill blows up bigger and golder, with a heavy jolt.
              this.rings.push({ x: kp.x, y: kp.y, born: now + 80, color: "rgba(242,207,107,0.85)" });
              this.sparks.push({ x: kp.x, y: kp.y, born: now + 120, color: "#f2cf6b", n: 18 });
              this.sparks.push({ x: kp.x, y: kp.y, born: now + 220, color: "#fff2c8", n: 10 });
              this.shake = { born: now, mag: 6, dur: 440 };
            }
          }
          audio.play("kill");
          if (mkey) {
            audio.creature(voiceFor(mkey), "die");
            if (this.bridge.content.monsters[mkey]?.boss) audio.bossEnd(true);
          }
          // The game's biggest fights get a card — a boss death no longer looks
          // identical to a rat's. The first kill of each boss is called out.
          if (isBoss && mkey) {
            const name = this.bridge.content.monsters[mkey]?.name ?? "A great foe";
            const kills = this.bridge.state.player.bossKills[mkey] ?? 1;
            this.levelUp.boss(name, kills);
          }
          break;
        }
        case "PLAYER_DIED":
          this.hud.log("You have been knocked out...");
          this.shake = { born: now, mag: 9, dur: 500 };
          audio.play("death");
          break;
        case "PLAYER_RESPAWNED":
          this.hud.log("You wake up, dazed but alive.");
          break;
        case "OPEN_BANK":
          audio.play("bank");
          this.bank.show(this.bridge.state);
          break;
        case "OPEN_EXCHANGE":
          audio.play("open");
          void this.hud.openExchange();
          break;
        case "OPEN_SHOP": {
          const shopDef = this.bridge.content.shops.find((s) => s.id === ev.shop);
          if (shopDef) { audio.play("open"); this.shop.show(this.bridge.state, shopDef); }
          break;
        }
        case "OPEN_PLANT":
          this.openPlant(ev.patchId, ev.patchType);
          break;
        case "OPEN_BOUNTY":
          this.bounty.show(this.bridge.state, ev.guideId);
          break;
        case "OPEN_RECORDS":
          this.records.show(this.bridge.state);
          // Pull in other anglers' catches, then refresh the board with them.
          void this.syncPierBoard().then(() => {
            if (this.records.isOpen()) this.records.show(this.bridge.state);
          });
          break;
        case "HOOKED_FISH":
          audio.play("splash");
          this.tension.start({ species: ev.species, weight: ev.weight, length: ev.length, strength: ev.strength });
          break;
        case "FISH_LANDED": {
          audio.play("splash");
          // A rising banner over the player; the core already logs the weigh-in.
          const p = this.bridge.state.player.pos;
          const label = ev.rank > 0 ? `${ev.species} — #${ev.rank}!` : `${ev.species} ${ev.weight.toFixed(1)}kg`;
          // Sits a touch above the "+N XP" drop (which spawns at the player) so
          // the catch and the XP gain read as two separate lines, not a mush.
          this.floats.push({ x: p.x, y: p.y - 0.9, text: label, color: ev.rank > 0 ? "#f4d98b" : "#9fd0d8", born: now });
          if (ev.rank === 1) {
            // Topping YOUR board is a big moment — but the Golden Rod belongs to
            // the pier's ONE champion, so confirm you still top the shared board
            // (a rival elsewhere may out-fish you) before the claim fanfare.
            audio.play("levelup");
            void this.resolvePierChampion(ev.species, ev.weight, ev.length, ev.newChampion);
          } else {
            // Every other catch gets its own popup revealing the size (kept secret
            // during the fight).
            this.levelUp.catch(ev.species, ev.weight, ev.length);
          }
          break;
        }
        case "WORLD_BOSS_MOVED":
          // A live-world event: the crier calls the sighting to everyone.
          this.hud.worldAnnounce(`${ev.name} has been sighted in ${ev.hint} — hunters wanted!`);
          break;
        case "PICKED_UP":
          // A little glint where the pile was — the pocketing made visible.
          this.sparks.push({ x: ev.x, y: ev.y, born: performance.now(), color: "#e8c76a", n: 6 });
          break;
        case "OPEN_CRAFT":
          this.openCraft(ev.station, ev.objId);
          break;
        case "OPEN_BUILD":
          this.decorate.open(); // free-placement mode replaces the per-footing menu
          break;
        case "OPEN_EXTENSION":
          this.openExtension(ev.sealId, ev.name, ev.room, ev.levelReq, ev.gold, ev.materials);
          break;
        case "OPEN_TRAVEL":
          this.openTravel(ev.objId);
          break;
        case "QUEST_COMPLETED": {
          audio.play("quest");
          const def = this.bridge.content.quests.find((q) => q.id === ev.quest);
          if (def) {
            // A level-up-style card: quest name, a one-line recap, and the payout.
            const blurb = def.outro?.[0] ?? "";
            const rewards: string[] = [];
            const r = def.reward;
            if (r) {
              for (const x of r.xp ?? []) {
                const sk = this.bridge.content.skills[x.skill]?.name ?? x.skill;
                rewards.push(`${x.amount.toLocaleString()} ${sk} XP`);
              }
              if (r.gold) rewards.push(`${r.gold.toLocaleString()} gold`);
              for (const it of r.items ?? []) {
                const nm = this.bridge.content.items[it.item]?.name ?? it.item;
                rewards.push(it.qty > 1 ? `${nm} ×${it.qty}` : nm);
              }
            }
            this.levelUp.quest(def.name, blurb, rewards);
          }
          break;
        }
        case "QUEST_CHOICE":
          this.openChoice(ev.quest, ev.prompt, ev.options);
          break;
        case "XP_LAMP":
          this.openXpLamp(ev.amount);
          break;
        case "CONTAINER_OPENED": {
          // A clue casket / supply crate — reveal the haul in a level-up-style card.
          audio.play("achieve");
          const title = this.bridge.content.items[ev.container]?.name ?? "Casket";
          const rewards: string[] = [];
          if (ev.coins) rewards.push(`${ev.coins.toLocaleString()} gold`);
          for (const it of ev.items) {
            const nm = this.bridge.content.items[it.item]?.name ?? it.item;
            rewards.push(it.qty > 1 ? `${nm} ×${it.qty}` : nm);
          }
          this.levelUp.casket(title, rewards);
          break;
        }
        case "QUEST_STARTED": {
          // Give a starting quest the same celebratory card as a finished one, so
          // a newcomer registers it began, sees the first objective, and can
          // gauge the recommended combat level before wading in (T7·06).
          audio.play("quest");
          const def = this.bridge.content.quests.find((q) => q.id === ev.quest);
          if (def) {
            const first = def.steps[0] as { text?: string } | undefined;
            let recLevel = 0;
            for (const s of def.steps) {
              if (s.type !== "kill") continue;
              const m = this.bridge.content.monsters[s.monster];
              if (m && m.level > recLevel) recLevel = m.level;
            }
            this.levelUp.questStart(def.name, first?.text ?? "", recLevel > 0 ? recLevel : null);
          }
          break;
        }
        case "QUEST_ADVANCED":
          // Progressing a step is a small win — a soft chime and a flash of the
          // pinned objective, so it never passes by silently.
          audio.play("achieve");
          this.guide.flashObjective();
          break;
        case "OBJECT_DEPLETED": {
          // A node worked out (tree felled / rock exhausted) shouldn't just swap
          // sprites — scatter a poof and a matching sound so it reads as an event.
          const dp = this.positionOf(ev.objId);
          const ddef = this.bridge.content.objects.find((o) => o.id === ev.objId);
          if (dp && ddef) {
            if (ddef.kind === "tree") {
              this.sparks.push({ x: dp.x, y: dp.y - 0.3, born: now, color: "#6f8f3f", n: 12 });
              this.sparks.push({ x: dp.x, y: dp.y - 0.1, born: now + 60, color: "#4f6a2c", n: 8 });
              audio.play("rustle"); // leaves settling as it comes down
            } else {
              this.puffs.push({ x: dp.x, y: dp.y + 0.2, born: now, kind: "dust" });
              this.sparks.push({ x: dp.x, y: dp.y, born: now, color: "#b9bcc4", n: 8 });
              audio.play("dig"); // stone crumbling to grit
            }
          }
          break;
        }
        case "OBJECT_RESPAWNED": {
          // A resource growing back gets a faint "here again" sparkle (culled if
          // off-screen). Monster respawns stay silent — they happen constantly.
          const rdef = this.bridge.content.objects.find((o) => o.id === ev.objId);
          if (rdef && rdef.kind !== "monster") {
            const rp2 = this.positionOf(ev.objId);
            if (rp2) this.sparks.push({ x: rp2.x, y: rp2.y - 0.2, born: now, color: "#cfe0b0", n: 5 });
          }
          break;
        }
        case "COMPANION_FOUND": {
          // The rarest thing in the game — a full card + fanfare, not a float.
          audio.play("levelup");
          const p = this.renderPlayerPos();
          this.sparks.push({ x: p.x, y: p.y, born: now, color: "#9fd07a", n: 14 });
          this.rings.push({ x: p.x, y: p.y - 0.3, born: now, color: "rgba(159,208,122,0.7)" });
          this.levelUp.pet(this.bridge.content.items[ev.item]?.name ?? "A companion");
          break;
        }
        case "RARE_DROP": {
          // A rare/legendary drop earns a card + a gold glint where it fell.
          audio.play("achieve");
          const rp = this.positionOf(this.combatTargetId ?? "") ?? this.renderPlayerPos();
          this.sparks.push({ x: rp.x, y: rp.y, born: now, color: ev.legendary ? "#f2cf6b" : "#8fd0d8", n: ev.legendary ? 14 : 10 });
          this.levelUp.unique(this.bridge.content.items[ev.item]?.name ?? "A rare item", ev.legendary);
          break;
        }
        case "RICH_FIND": {
          // A bumper gather: a gold burst on the worked node + a "Rich find!"
          // float, so the jackpot lands as a moment, not just an extra log line.
          const wp = this.positionOf(this.bridge.state.player.activity.targetId ?? "") ?? this.renderPlayerPos();
          this.sparks.push({ x: wp.x, y: wp.y - 0.2, born: now, color: "#f2cf6b", n: 12 });
          this.rings.push({ x: wp.x, y: wp.y - 0.2, born: now, color: "rgba(242,207,107,0.7)" });
          this.floats.push({ x: wp.x, y: wp.y - 0.7, text: "Rich find!", color: "#f4d98b", born: now, size: 16 });
          audio.play("achieve");
          break;
        }
        case "ACHIEVEMENT": {
          audio.play("achieve");
          const p = this.bridge.state.player.pos;
          this.floats.push({ x: p.x, y: p.y - 0.9, text: `Achievement: ${ev.name}`, color: "#f2cf6b", born: now, size: 16 });
          break;
        }
        case "ITEM_GAINED": {
          // A soft pickup blip — but skip it while gathering/crafting, where the
          // per-tick "gather" tap already sounds (so it isn't a double-hit).
          const k = this.bridge.state.player.activity.kind;
          const busy = k === "mining" || k === "woodcutting" || k === "fishing" || k === "foraging" || k === "trapping" || k === "crafting";
          if (!busy && now - this.lastGatherSfx > 120) { this.lastGatherSfx = now; audio.play("pickup"); }
          break;
        }
        case "HEALED": {
          const p = this.renderPlayerPos();
          this.floats.push({ x: p.x, y: p.y - 0.3, text: `+${ev.amount}`, color: "#5fd06a", born: now, size: 15 });
          this.sparks.push({ x: p.x, y: p.y, born: now, color: "#5fd06a", n: 6 });
          audio.play("heal");
          break;
        }
        case "DAMAGE": {
          // A ranged/magic blow sends a visible arrow or bolt streaking from the
          // shooter to the struck target.
          this.spawnProjectile(ev.targetId, now);
          // Taking a real hit flashes the screen edges red — the harder the hit
          // (relative to max HP), the stronger the flash, with a little shake.
          if (ev.targetId === "player") {
            if (ev.amount > 0) {
              this.hurtFlash = now;
              const frac = Math.min(1, ev.amount / Math.max(1, this.bridge.state.player.maxHp));
              this.shake = { born: now, mag: 2 + frac * 6, dur: 280 };
              audio.play("hurt");
              // The thing hitting you has a voice too (kept sparse).
              if (now - this.lastFoeVocal > 1400) {
                const foe = this.combatTargetId && this.monsterKeyOf(this.combatTargetId);
                if (foe) { this.lastFoeVocal = now; audio.creature(voiceFor(foe), "attack"); }
              }
            }
          } else {
            // A blow we landed on something: a bow looses, a blade thuds, a miss
            // whiffs. (The bow is read from the wielded mainhand.)
            const main = this.bridge.state.player.equipment.mainhand;
            const mdef = main ? this.bridge.content.items[main] : undefined;
            const style = mdef?.ranged ? "bow" : mdef?.magic ? "magic" : "hit";
            // A LANDED blow for zero is not a whiff — it thuds off armour.
            audio.play(ev.kind === "miss" ? "miss" : ev.amount > 0 ? style : "hit");
          }
          const pos = this.positionOf(ev.targetId);
          if (pos) {
            const hit = ev.amount > 0;
            // Combat damage now rolls from ZERO, so "0" and "miss" are different
            // events that used to look identical. OSRS draws a landed nothing as
            // a blue splat and a whiff as an empty one — that distinction is most
            // of how the exchange reads, so it is drawn, not just logged.
            const splatKind: Hitsplat["kind"] =
              ev.kind === "poison" ? "poison"
              : ev.kind === "venom" ? "venom"
              : ev.kind === "miss" ? "miss"
              : hit ? "hit" : "zero";
            // Several blows can resolve on one 600ms tick. Stagger them so they
            // read as a sequence rather than stacking into one illegible blob.
            const sameTick = this.hitsplats.filter((h) => now - h.born < 40).length;
            this.hitsplats.push({
              x: pos.x, y: pos.y, amount: ev.amount,
              kind: splatKind, weak: !!ev.weak, born: now + sameTick * 90,
            });
            this.sparks.push({
              x: pos.x, y: pos.y, born: now,
              color: !hit ? "#7a808a" : ev.weak ? "#ffcf4a" : "#e2483a",
              n: !hit ? 3 : ev.weak ? 9 : 6,
            });
            // A landed hit makes the struck thing squash and recoil away from its
            // attacker (a creature recoils from the player; the player just pops).
            if (hit) {
              let dx = 0, dy = 0;
              if (ev.targetId !== "player") {
                const pp = this.bridge.state.player.pos;
                dx = pos.x - pp.x; dy = pos.y - pp.y;
                const len = Math.hypot(dx, dy) || 1;
                dx /= len; dy /= len;
              }
              this.combatHits.set(ev.targetId, { born: now, dx, dy, crit: !!ev.weak });
            }
          }
          break;
        }
        default:
          break;
      }
    }
    // OSRS-style XP drops: ONE per skill this tick, tinted by the skill and
    // stacked so training two skills at once (e.g. combat + Vitality) reads as two
    // lines, not a mush. Spawned at the avatar's interpolated position so they
    // rise with the gliding body, and fed to the live XP counter in the HUD.
    if (xpBySkill.size > 0) {
      const rp = this.renderPlayerPos();
      let total = 0;
      let row = 0;
      for (const [skill, amount] of xpBySkill) {
        if (amount <= 0) continue;
        total += amount;
        const nm = this.bridge.content.skills[skill]?.name ?? skill;
        this.floats.push({
          x: rp.x,
          y: rp.y - row * 0.42, // stack upward so multiple skills don't overlap
          text: `+${Math.round(amount)} ${nm}`,
          color: SPARK_COLOR[skill] ?? "#e0b54a",
          born: now,
          size: 13,
        });
        row++;
      }
      if (total > 0) this.hud.addXp(total, now);
    }
  }

  /** A station's recipe menu: pick what to make from what you're carrying. */
  private openCraft(station: ObjKind, objId: string): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);
    const has = (a: SkillAction): boolean => {
      if (a.requires) {
        for (const [item, qty] of Object.entries(a.requires)) {
          if (have(item) < (qty ?? 0)) return false;
        }
      }
      if (a.requiresAny && a.requiresAny.length) {
        if (!a.requiresAny.some((it) => have(it) > 0)) return false;
      }
      return true;
    };

    // Show EVERY recipe for the station as a level ladder — the ones you can make
    // now are highlighted, ones above your level are greyed with their level req,
    // so you can see what's coming and what to train toward (OSRS-style).
    const recipes = this.bridge
      .stationRecipes(station)
      .filter((a) => a.produces)
      .sort((a, b) => a.levelReq - b.levelReq || content.items[a.produces!].name.localeCompare(content.items[b.produces!].name));

    const toItem = (a: SkillAction): MenuItem => {
      const out = content.items[a.produces!];
      const lvl = player.skills[a.skill].level;
      const leveled = lvl >= a.levelReq;
      const ready = leveled && has(a);
      const skillName = content.skills[a.skill].name;
      return {
        label: out.name,
        target: leveled ? this.costText(a) : `${skillName} Lv ${a.levelReq}`,
        tone: ready ? "action" : leveled ? "normal" : "locked",
        onSelect: () => {
          if (!leveled) {
            this.hud.log(`You need ${skillName} level ${a.levelReq} to make ${out.name}.`);
            return;
          }
          if (!has(a)) {
            this.hud.log(`You don't have the materials for ${out.name}.`);
            return;
          }
          this.dispatch({ type: "CRAFT", actionId: a.id, objId });
        },
      };
    };
    const items: MenuItem[] = recipes.map(toItem);

    if (items.length === 0) {
      this.hud.log("You've nothing to make here yet.");
      return;
    }

    // Group recipes into category TABS (by the action's `group`, else the
    // produced item's category) so a long list — every cooking or smithing
    // recipe — reads as tidy tabs instead of one endless scroll. Tabs sorted by
    // the lowest level each opens at.
    const cap = (s: string): string => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const groups = new Map<string, SkillAction[]>();
    for (const a of recipes) {
      const key = a.group ? cap(a.group) : (content.items[a.produces!].cat ?? "Other");
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(a);
    }
    const tabs: MenuTab[] = [...groups.entries()]
      .sort((x, y) => Math.min(...x[1].map((a) => a.levelReq)) - Math.min(...y[1].map((a) => a.levelReq)))
      .map(([label, as]) => ({ label, items: as.map(toItem) }));

    // A one-tap "make all" chains through every recipe you have materials for,
    // so a full pack processes in a single tap: "Cook all" at a fire, "Smelt
    // all" at a furnace (across every ore type — no clicking per ore).
    const makeAllLabel = station === "fire" ? "Cook all" : station === "furnace" ? "Smelt all" : null;
    if (makeAllLabel && this.cookableNow(station).length > 0) {
      const makeAll: MenuItem = {
        label: makeAllLabel,
        target: "everything you can",
        tone: "action",
        onSelect: () => { this.cookAll = { objId, station }; this.startNextCook(); },
      };
      items.unshift(makeAll);
      if (tabs[0]) tabs[0].items.unshift(makeAll);
    }
    const title = VERB[station].replace(/ at$/, "");
    this.menu.show(
      window.innerWidth / 2,
      window.innerHeight / 2,
      title,
      items,
      "Pick a recipe — you'll keep making it until the materials run out.",
      undefined,
      tabs.length > 1 ? tabs : undefined,
    );
  }

  /** How many of an item id are in the pack right now. */
  private invCount(item: string): number {
    return this.bridge.state.player.inventory.reduce((n, s) => (s?.item === item ? n + s.qty : n), 0);
  }

  /** Arm an item with "Use": the next tap picks the target it acts on. */
  beginUseItem(slot: number, item: ItemId): void {
    this.useItem = { slot, item };
    const name = this.bridge.content.items[item]?.name ?? "item";
    this.hud.log(`Use ${name} on… (tap a target, or tap empty ground to cancel)`);
  }

  /** Resolve a "Use item on X" tap. Stations that can turn the item into
   *  something (a fire cooking raw fish, a furnace smelting ore…) prompt for a
   *  quantity; anything else does nothing. */
  private resolveUseOn(obj: WorldObjectDef | null, sx: number, sy: number): void {
    const use = this.useItem;
    this.useItem = null;
    if (!use) return;
    if (!obj) { this.hud.log("Never mind."); return; }
    // Fertilizer on a farm patch: work it into the soil (the Survivalist's mix
    // feeding the Farmer's field). The core rules on tier and consumption.
    if ((use.item === "fertilizer_basic" || use.item === "fertilizer_rich")
      && (obj.kind === "plant_patch" || obj.kind === "tree_patch")) {
      this.bridge.send({ type: "FERTILIZE", patchId: obj.id, slot: use.slot });
      return;
    }
    // A recipe at THIS station that consumes the used item as an ingredient.
    const recipes = this.bridge.stationRecipes(obj.kind).filter((a) => {
      if (!a.produces) return false;
      if (a.requires && Object.keys(a.requires).includes(use.item)) return true;
      if (a.requiresAny?.includes(use.item)) return true;
      return false;
    });
    if (recipes.length === 0) {
      this.hud.log(`Nothing happens.`);
      return;
    }
    // Usually one recipe; if several, pick the lowest-level one the item feeds.
    const a = recipes.sort((x, y) => x.levelReq - y.levelReq)[0]!;
    this.openUseQuantity(a, obj.id, use.item, sx, sy);
  }

  /** The 1 / 5 / All quantity prompt for a Use → make N run. */
  private openUseQuantity(a: SkillAction, objId: string, rawItem: ItemId, sx: number, sy: number): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const out = content.items[a.produces!];
    if (player.skills[a.skill].level < a.levelReq) {
      this.hud.log(`You need ${content.skills[a.skill].name} level ${a.levelReq} to make ${out.name}.`);
      return;
    }
    // How many you could make from what you carry (limited by the used item).
    const max = this.invCount(rawItem);
    if (max <= 0) { this.hud.log(`You have no ${content.items[rawItem].name}.`); return; }
    const start = (n: number): void => {
      this.dispatch({ type: "CRAFT", actionId: a.id, objId });
      // "All" runs until the materials are gone; a fixed count stops after n.
      this.craftLimit = n >= max ? null : { rawItem, startCount: max, n };
    };
    const opts: MenuItem[] = [];
    opts.push({ label: "Make 1", tone: "action", onSelect: () => start(1) });
    if (max >= 5) opts.push({ label: "Make 5", onSelect: () => start(5) });
    opts.push({ label: `Make All`, target: `${max}`, onSelect: () => start(max) });
    this.menu.show(sx, sy, `${out.name}`, opts, `Make from your ${content.items[rawItem].name}.`);
  }

  /** Recipes at the cooking fire the player can make right now (level + stock). */
  /** Every recipe at `station` the player can make right now (level + materials). */
  private cookableNow(station: ObjKind = "fire"): SkillAction[] {
    const player = this.bridge.state.player;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);
    const has = (a: SkillAction): boolean => {
      if (a.requires) for (const [it, q] of Object.entries(a.requires)) if (have(it) < (q ?? 0)) return false;
      if (a.requiresAny?.length && !a.requiresAny.some((it) => have(it) > 0)) return false;
      return true;
    };
    return this.bridge.stationRecipes(station)
      .filter((a) => a.produces && player.skills[a.skill].level >= a.levelReq && has(a));
  }

  /** Start the next makeable recipe for an active "make all"; false if none/no room. */
  private startNextCook(): boolean {
    if (!this.cookAll) return false;
    const player = this.bridge.state.player;
    const next = this.cookableNow(this.cookAll.station)[0];
    if (!next || !player.inventory.some((s) => s === null)) return false;
    this.dispatch({ type: "CRAFT", actionId: next.id, objId: this.cookAll.objId });
    return true;
  }

  /** A homestead footing: pick a furniture piece to build (or clear it). */

  /** Offer to upgrade the house a tier: show the room + cost, confirm to build. */
  private openExtension(sealId: string, name: string, room: string, levelReq: number, gold: number, materials: Record<string, number>): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);
    const leveled = player.skills.construction.level >= levelReq;
    const hasGold = player.gold >= gold;
    const hasMats = Object.entries(materials).every(([item, qty]) => have(item) >= qty);
    const cost = [`${gold}g`, ...Object.entries(materials).map(([item, qty]) => `${qty}× ${content.items[item as ItemId].name}`)].join(", ");
    const items: MenuItem[] = [{
      label: `Upgrade to a ${name}  ·  Con ${levelReq}`,
      target: leveled ? cost : `needs Construction ${levelReq}`,
      tone: leveled && hasGold && hasMats ? "action" : "normal",
      onSelect: () => {
        if (!leveled) { this.hud.log(`Raising your ${name} needs Construction level ${levelReq}.`); return; }
        if (!hasGold) { this.hud.log(`A ${name} costs ${gold} gold — you're short.`); return; }
        if (!hasMats) { this.hud.log(`You're short of materials to raise your ${name}.`); return; }
        this.dispatch({ type: "BUILD_ROOM", sealId });
      },
    }];
    this.menu.show(
      window.innerWidth / 2, window.innerHeight / 2,
      `Extend your home — the ${room}`, items,
      `Raise your home to a ${name}, adding the ${room}. The doorway opens the moment it's built.`,
    );
  }

  /** The Courier's waystone network: open the world map and tap the destination
   *  waystone directly — no need to know each stop by name. The toll (by
   *  distance) is paid on arrival. */
  private openTravel(srcId: string): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const dests = content.objects.filter((o) => o.kind === "waystone" && o.id !== srcId && o.target);
    if (dests.length === 0) { this.hud.log("This is the only waystone you know."); return; }

    this.worldMap.show({
      hint: "Tap a waystone ◆ on the map to ride there — the toll is paid on arrival.",
      onSelect: (tile) => {
        // Snap to the nearest waystone to where they tapped.
        let best = dests[0]!;
        let bestD = Infinity;
        for (const o of dests) {
          const d = Math.max(Math.abs(o.x - tile.x), Math.abs(o.y - tile.y));
          if (d < bestD) { bestD = d; best = o; }
        }
        // Guard against a stray tap on empty land teleporting (and charging) you.
        if (bestD > 6) { this.hud.log("Tap closer to a waystone ◆ to ride there."); return; }
        const fare = travelFare(player.pos, best.target!);
        if (player.gold < fare) {
          this.hud.log(`The toll to ${best.name} is ${fare}g — you can't cover it.`);
          return;
        }
        this.dispatch({ type: "TRAVEL", to: best.id });
      },
    });
  }

  /**
   * A quest's branching question: show each option as a tappable line. Picking
   * one sends a CHOOSE intent; the core sets the flags and advances the quest.
   */
  private openChoice(quest: string, prompt: string, options: string[]): void {
    const items: MenuItem[] = options.map((label, index) => ({
      label,
      tone: "action",
      onSelect: () => {
        this.dispatch({ type: "CHOOSE", quest, option: index });
      },
    }));
    if (items.length === 0) return;
    this.menu.show(
      window.innerWidth / 2,
      window.innerHeight / 2,
      prompt,
      items,
      "Choose carefully — this answer is remembered.",
    );
  }

  /** An XP-lamp chooser: pour a quest's XP reward into any skill you like. */
  private openXpLamp(amount: number): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const ids = Object.keys(content.skills) as SkillId[];
    const items: MenuItem[] = ids.map((id) => ({
      label: content.skills[id].name,
      target: `Lv ${player.skills[id].level}`,
      tone: "action",
      onSelect: () => {
        this.dispatch({ type: "SPEND_XP_LAMP", skill: id });
        // More rewards still waiting? Chain straight into the next chooser.
        const left = this.bridge.state.player.xpLamps;
        if (left && left.length > 0) this.openXpLamp(left[0]!);
      },
    }));
    this.menu.show(
      window.innerWidth / 2,
      window.innerHeight / 2,
      `Quest reward: ${amount.toLocaleString()} XP`,
      items,
      "Choose the skill to pour this reward into.",
    );
  }

  /** A farming patch's seed menu: what you can plant here right now. */
  private openPlant(patchId: string, patchType: "plant" | "tree"): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);
    const farmLvl = player.skills.farming.level;

    const crops = Object.values(content.crops)
      .filter((c) => c.type === patchType)
      .sort((a, b) => a.levelReq - b.levelReq);

    const items: MenuItem[] = crops.map((c) => {
      const seeds = have(c.seed);
      const ok = farmLvl >= c.levelReq && seeds > 0;
      const mins = Math.round(c.growthMs / 60000);
      const time = mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`;
      return {
        label: c.name,
        target: ok ? `${time} · ${seeds} seed${seeds === 1 ? "" : "s"}` : `Lv ${c.levelReq}`,
        tone: ok ? "action" : "normal",
        onSelect: () => {
          if (farmLvl < c.levelReq) {
            this.hud.log(`You need Farming level ${c.levelReq} to plant ${c.name}.`);
            return;
          }
          if (seeds <= 0) {
            this.hud.log(`You have no ${content.items[c.seed].name}.`);
            return;
          }
          this.dispatch({ type: "PLANT", patchId, crop: c.id });
        },
      };
    });
    if (items.length === 0) return;
    this.menu.show(
      window.innerWidth / 2,
      window.innerHeight / 2,
      patchType === "tree" ? "Plant a tree" : "Plant a seed",
      items,
      "Crops grow in real time — come back when they're ripe.",
    );
  }

  /** A short "2× Knucklestone, 1× Charcoal" cost line for a recipe. */
  private costText(a: SkillAction): string {
    const items = this.bridge.content.items;
    const parts: string[] = [];
    if (a.requires) {
      for (const [item, qty] of Object.entries(a.requires)) {
        parts.push(`${qty}× ${items[item as ItemId].name}`);
      }
    }
    if (a.requiresAny && a.requiresAny.length) parts.push("any log");
    return parts.join(", ");
  }

  /** The monster key ("hill_wolf") behind a world object id, if it's a monster. */
  private monsterKeyOf(objId: string): string | null {
    const def = this.bridge.content.objects.find((o) => o.id === objId);
    return def?.kind === "monster" && def.monster ? def.monster : null;
  }

  /** Interpolated render position of a target (player or object), so any overlay
   *  pinned to it — highlight box, tap ring, combat reticle, projectile end —
   *  glides with the body instead of snapping to the tile. */
  private positionOf(targetId: string): Vec2 | null {
    if (targetId === "player") return this.renderPlayerPos();
    const def = this.bridge.content.objects.find((o) => o.id === targetId);
    if (!def) return null;
    return this.objRenderPos(def);
  }

  // --- Drawing overlays --------------------------------------------------

  private toScreen(tileX: number, tileY: number): Vec2 {
    return {
      x: tileX * TILE + TILE / 2 - this.cam.x,
      y: tileY * TILE + TILE / 2 - this.cam.y,
    };
  }

  private static clip(t: string): string {
    const s = t.trim();
    return s.length > 48 ? s.slice(0, 47) + "…" : s;
  }

  /** Float what the player just typed over their head (OSRS overhead chat). Called
   *  by the HUD the moment a world-chat line is sent, for instant local feedback. */
  showSpeech(text: string): void {
    const t = Game.clip(text);
    if (t) this.speech = { text: t, until: performance.now() + 5000 };
  }

  /** Float a nearby player's chat line over THEIR head — matched to their ghost by
   *  name — so friends playing near you see each other's words in the world, not
   *  just in the log. Called by the HUD as remote chat arrives. */
  showGhostSpeech(name: string, text: string): void {
    const t = Game.clip(text);
    if (t) this.ghostSpeech.set(name, { text: t, until: performance.now() + 5000 });
  }

  /** Are any other players nearby (visible as ghosts)? Lets the HUD poll chat
   *  faster while friends are around. */
  hasNearbyPlayers(): boolean {
    return currentGhosts().length > 0;
  }

  /** Draw the overhead chat bubbles: the local player's, plus any nearby ghost's.
   *  World space, so they track their speaker and scale with zoom. */
  private drawSpeech(now: number): void {
    const p = this.bridge.state.player;
    if (this.speech) {
      if (now >= this.speech.until) this.speech = null;
      else if (p.alive) {
        const rp = this.renderPlayerPos();
        const s = this.toScreen(rp.x, rp.y);
        this.drawSpeechBubble(this.speech.text, s.x, s.y, Math.min(1, (this.speech.until - now) / 700));
      }
    }
    if (this.ghostSpeech.size) {
      for (const gh of currentGhosts()) {
        const entry = this.ghostSpeech.get(gh.name);
        if (!entry) continue;
        if (now >= entry.until) { this.ghostSpeech.delete(gh.name); continue; }
        const s = this.toScreen(gh.x, gh.y);
        this.drawSpeechBubble(entry.text, s.x, s.y, Math.min(1, (entry.until - now) / 700));
      }
      // Prune entries whose speaker has wandered out of range (no ghost) once stale.
      for (const [name, e] of this.ghostSpeech) if (now >= e.until) this.ghostSpeech.delete(name);
    }
  }

  /** The Town Crier calls out a bulletin on a timer, floated over his head and
   *  logged — but only heard when you're near his square in Ironvale. */
  private updateCrier(now: number): void {
    const def = this.bridge.content.objects.find((o) => o.id === "town_crier");
    if (!def) return;
    const pos = this.bridge.state.objects["town_crier"]?.pos ?? { x: def.x, y: def.y };
    const p = this.bridge.state.player.pos;
    const near = Math.hypot(p.x - pos.x, p.y - pos.y) <= 16;
    // Advance to the next bulletin on the cadence (whether or not you're near).
    if (now >= this.crierAt) {
      const text = CRIER_SHOUTS[this.crierIdx % CRIER_SHOUTS.length]!;
      this.crierIdx++;
      this.crierShout = { text, until: now + 7000 };
      this.crierAt = now + 24000; // ~24s between bulletins
      this.crierLogged = false;
    }
    if (!this.crierShout || now >= this.crierShout.until) { this.crierShout = null; return; }
    if (!near) return; // heard only in the square
    // Log it once (so you catch it even glancing away), then float it over his head.
    if (!this.crierLogged) { this.hud.log(`Town Crier: “${this.crierShout.text}”`); this.crierLogged = true; }
    const s = this.toScreen(pos.x, pos.y);
    if (s.x < -TILE * 4 || s.x > this.viewW + TILE * 4 || s.y < -TILE * 4 || s.y > this.viewH + TILE * 4) return;
    this.drawSpeechBubble(this.crierShout.text, s.x, s.y, Math.min(1, (this.crierShout.until - now) / 700));
  }

  /** One overhead bubble at a speaker's tile-centre screen position (sx, sy). */
  private drawSpeechBubble(text: string, sx: number, sy: number, alpha: number): void {
    const g = this.g;
    g.save();
    g.globalAlpha = Math.max(0, alpha);
    g.font = "600 14px 'Segoe UI', system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const tw = g.measureText(text).width;
    const ty = sy - TILE * 1.15; // a comfortable gap above the head
    g.fillStyle = "rgba(18, 14, 9, 0.66)"; // soft backing so words read over terrain
    g.beginPath();
    g.roundRect(sx - tw / 2 - 7, ty - 11, tw + 14, 22, 7);
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = "rgba(0, 0, 0, 0.75)"; // dark outline for legibility
    g.strokeText(text, sx, ty);
    g.fillStyle = "#fbeecb"; // warm parchment
    g.fillText(text, sx, ty);
    g.restore();
  }

  private drawMarker(now: number): void {
    if (!this.marker) return;
    const age = now - this.marker.born;
    if (age >= MARKER_LIFE) {
      this.marker = null;
      return;
    }
    const t = Math.max(0, Math.min(1, age / MARKER_LIFE));
    const { x: cx, y: cy } = this.toScreen(this.marker.x, this.marker.y);
    const alpha = 1 - t;

    // An expanding ember ring...
    this.g.globalAlpha = alpha * 0.7;
    this.g.strokeStyle = "#e0b54a";
    this.g.lineWidth = 2;
    this.g.beginPath();
    this.g.arc(cx, cy, TILE * (0.18 + t * 0.3), 0, Math.PI * 2);
    this.g.stroke();

    // ...with a shrinking gold cross at the centre (the classic walk marker).
    const s = TILE * 0.26 * (1 - 0.45 * t);
    this.g.globalAlpha = alpha;
    this.g.strokeStyle = "#f2cf6b";
    this.g.lineWidth = 3;
    this.g.beginPath();
    this.g.moveTo(cx - s, cy - s);
    this.g.lineTo(cx + s, cy + s);
    this.g.moveTo(cx - s, cy + s);
    this.g.lineTo(cx + s, cy - s);
    this.g.stroke();
    this.g.globalAlpha = 1;
  }

  private drawHighlights(now: number): void {
    const player = this.bridge.state.player;

    // Persistent glow on whatever the player is busy with (or walking to).
    const targetId = player.activity.targetId ?? player.pendingInteractId;
    if (targetId) {
      const pos = this.positionOf(targetId);
      if (pos) {
        const { x: cx, y: cy } = this.toScreen(pos.x, pos.y);
        const pulse = 0.45 + 0.3 * Math.sin(now / 200);
        this.g.globalAlpha = pulse;
        this.g.strokeStyle = "#d2742c";
        this.g.lineWidth = 2.5;
        this.g.strokeRect(cx - TILE * 0.46, cy - TILE * 0.46, TILE * 0.92, TILE * 0.92);
        this.g.globalAlpha = 1;
      }
    }

    // A brief ring when an object is tapped.
    if (this.tapFlash) {
      const age = now - this.tapFlash.born;
      if (age >= FLASH_LIFE) {
        this.tapFlash = null;
      } else {
        const pos = this.positionOf(this.tapFlash.objId);
        if (pos) {
          const t = Math.max(0, Math.min(1, age / FLASH_LIFE));
          const { x: cx, y: cy } = this.toScreen(pos.x, pos.y);
          this.g.globalAlpha = 1 - t;
          this.g.strokeStyle = "#f2cf6b";
          this.g.lineWidth = 2;
          this.g.beginPath();
          this.g.arc(cx, cy, TILE * (0.3 + t * 0.35), 0, Math.PI * 2);
          this.g.stroke();
          this.g.globalAlpha = 1;
        }
      }
    }
  }

  /** Enemy HP bar in combat; a progress ring for timed gathering/processing. */
  private drawActivityFeedback(now: number): void {
    const act = this.bridge.state.player.activity;
    if (act.kind === "idle" || !act.targetId) return;
    const def = this.bridge.content.objects.find((o) => o.id === act.targetId);
    if (!def) return;
    const ap = this.objRenderPos(def); // interpolated so a stepping foe's bar tracks it
    const { x: cx, y: cy } = this.toScreen(ap.x, ap.y);

    if (act.kind === "combat") {
      const stats = def.monster ? this.bridge.content.monsters[def.monster] : undefined;
      const obj = this.bridge.state.objects[def.id];
      if (stats && obj && obj.hp !== undefined) {
        const w = TILE * 0.7;
        const h = 4;
        const pct = Math.max(0, Math.min(1, obj.hp / stats.hp));
        const bx = cx - w / 2;
        const by = cy - TILE * 0.6;
        this.g.fillStyle = "rgba(0,0,0,0.6)";
        this.g.fillRect(bx - 1, by - 1, w + 2, h + 2);
        this.g.fillStyle = "#3a1410";
        this.g.fillRect(bx, by, w, h);
        this.g.fillStyle = "#c43a23";
        this.g.fillRect(bx, by, w * pct, h);
      }
      // The player's own HP bar over their head while fighting, so you can watch
      // your health without glancing to the HUD.
      const pl = this.bridge.state.player;
      const prp = this.renderPlayerPos();
      const { x: px, y: py } = this.toScreen(prp.x, prp.y);
      const pw = TILE * 0.7, ph = 4;
      const ppct = pl.maxHp > 0 ? Math.max(0, Math.min(1, pl.hp / pl.maxHp)) : 1;
      const pbx = px - pw / 2, pby = py - TILE * 0.62;
      this.g.fillStyle = "rgba(0,0,0,0.6)";
      this.g.fillRect(pbx - 1, pby - 1, pw + 2, ph + 2);
      this.g.fillStyle = "#123018";
      this.g.fillRect(pbx, pby, pw, ph);
      this.g.fillStyle = ppct > 0.5 ? "#5fbf5a" : ppct > 0.25 ? "#e0b54a" : "#d8453a";
      this.g.fillRect(pbx, pby, pw * ppct, ph);
      return;
    }

    // Timed gathering / cooking / smelting: a filling progress ring.
    if (act.actionInterval > 0) {
      const remain = Math.max(0, act.nextActionAt - now);
      const progress = 1 - Math.min(1, remain / act.actionInterval);
      const r = TILE * 0.42;
      this.g.lineWidth = 3;
      this.g.strokeStyle = "rgba(0,0,0,0.4)";
      this.g.beginPath();
      this.g.arc(cx, cy, r, 0, Math.PI * 2);
      this.g.stroke();
      this.g.strokeStyle = "#e0b54a";
      this.g.beginPath();
      this.g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      this.g.stroke();
    }
  }

  /** A bobbing gold chevron over whatever the onboarding guide points at. */
  /**
   * Hand-holding for the first couple of tasks: a flashing arrow at the next
   * objective — bobbing above it when on-screen, or pinned to the screen edge
   * pointing the way when it's off-screen. The quest tracker says what to do;
   * this says where.
   */
  private drawTutorialArrow(now: number): void {
    const t = this.tutorialTarget();
    if (!t) return;
    const sx = t.x * TILE + TILE / 2 - this.cam.x;
    const sy = t.y * TILE + TILE / 2 - this.cam.y;
    // This draws under the zoom transform, so work in logical (world) view px.
    const W = this.viewW, H = this.viewH;
    const m = 48; // edge inset
    const flash = 0.5 + 0.5 * Math.sin(now / 180); // the "flashing"
    const onScreen = sx >= 0 && sx <= W && sy >= 0 && sy <= H;
    this.g.save();
    this.g.globalAlpha = 0.45 + 0.55 * flash;
    this.g.fillStyle = "#f2cf6b";
    this.g.strokeStyle = "rgba(0,0,0,0.55)";
    this.g.lineWidth = 1.5;
    if (onScreen) {
      const bob = Math.sin(now / 240) * 5;
      this.tri(sx, sy - TILE * 0.95 + bob, Math.PI / 2, 13); // points down at it
    } else {
      const ang = Math.atan2(sy - H / 2, sx - W / 2);
      const ex = Math.max(m, Math.min(W - m, sx));
      const ey = Math.max(m, Math.min(H - m, sy));
      this.tri(ex, ey, ang, 17); // points toward the off-screen target
    }
    this.g.restore();
  }

  /** A filled triangle at (x,y) pointing along `ang`. */
  private tri(x: number, y: number, ang: number, size: number): void {
    this.g.save();
    this.g.translate(x, y);
    this.g.rotate(ang);
    this.g.beginPath();
    this.g.moveTo(size, 0);
    this.g.lineTo(-size * 0.7, -size * 0.75);
    this.g.lineTo(-size * 0.7, size * 0.75);
    this.g.closePath();
    this.g.fill();
    this.g.stroke();
    this.g.restore();
  }

  /** The tile the next objective sits on, while still hand-holding (else null). */
  private tutorialTarget(): { x: number; y: number } | null {
    const { state, content } = this.bridge;
    const player = state.player;
    if (player.questsDone.length >= 2) return null; // only the first couple of tasks

    const activeId = Object.keys(player.quests)[0];
    if (activeId) {
      const def = content.quests.find((q) => q.id === activeId);
      const st = player.quests[activeId];
      const step = def && st ? def.steps[st.step] : undefined;
      if (step) {
        const s = step as { type: string; npc?: string; monster?: string; item?: string; from?: string };
        if ((s.type === "talk" || s.type === "deliver" || s.type === "choice") && s.npc) {
          return this.objTile(s.npc);
        }
        if (s.type === "kill" && s.monster) return this.nearestMonster(s.monster);
        if (s.type === "gather" && s.item) return this.gatherTarget(s.item, s.from);
        return null; // "reach a skill level" has nowhere to point
      }
    }
    // Not started yet: point to whoever offers the opening quest.
    const offer = content.quests.find(
      (q) =>
        q.giver && !player.quests[q.id] && !player.questsDone.includes(q.id) &&
        (!q.requires || player.questsDone.includes(q.requires)) &&
        (!q.requiresFlags || q.requiresFlags.every((f) => player.flags.includes(f))),
    );
    return offer?.giver ? this.objTile(offer.giver) : null;
  }

  private objTile(id: string): { x: number; y: number } | null {
    const def = this.bridge.content.objects.find((o) => o.id === id);
    return def ? this.objRenderPos(def) : null; // interpolated (guide arrow target may wander)
  }

  private nearestMonster(monster: string): { x: number; y: number } | null {
    const p = this.bridge.state.player.pos;
    let best = Infinity, found: { x: number; y: number } | null = null;
    for (const o of this.bridge.content.objects) {
      if (o.kind !== "monster" || o.monster !== monster) continue;
      if (objectHidden(o, this.bridge.state.player)) continue; // story-gated
      if (!this.bridge.state.objects[o.id]?.available) continue;
      const op = objectPos(o, this.bridge.state.objects[o.id]);
      const d = (op.x - p.x) ** 2 + (op.y - p.y) ** 2;
      if (d < best) { best = d; found = op; }
    }
    return found;
  }

  /** Where to get a gathered/made item: a named source creature, a resource
   *  node, a station, or (last) any creature that drops it. */
  private gatherTarget(item: string, from?: string): { x: number; y: number } | null {
    const { state, content } = this.bridge;
    const p = state.player.pos;
    const nearestOf = (pred: (o: typeof content.objects[number]) => boolean): { x: number; y: number } | null => {
      let best = Infinity, found: { x: number; y: number } | null = null;
      for (const o of content.objects) {
        if (objectHidden(o, state.player)) continue; // story-gated
        if (!pred(o)) continue;
        const op = objectPos(o, state.objects[o.id]);
        const d = (op.x - p.x) ** 2 + (op.y - p.y) ** 2;
        if (d < best) { best = d; found = op; }
      }
      return found;
    };
    // 0) If the quest names the source creature (e.g. worn coins → moor rats),
    //    point at the nearest one — the item itself may drop from many beasts.
    if (from) {
      const named = this.nearestMonster(from);
      if (named) return named;
    }
    // 1) A resource node that yields the item directly (mine/chop/fish/snare).
    const node = nearestOf((o) => {
      if (!o.resource) return false;
      return content.actions.find((a) => a.id === o.resource)?.produces === item;
    });
    if (node) return node;
    // 2) A station whose recipes make the item (smelt at a furnace, etc.).
    const kinds: ObjKind[] = ["furnace", "anvil", "fire", "cauldron", "workbench", "crafting_table", "sawmill"];
    const kind = kinds.find((k) => this.bridge.stationRecipes(k).some((a) => a.produces === item));
    if (kind) { const st = nearestOf((o) => o.kind === kind); if (st) return st; }
    // 3) Otherwise it's a drop — point at the nearest creature that actually
    //    drops it (e.g. worn coins come from moor rats, not just any beast).
    const dropsIt = (o: typeof content.objects[number]): boolean => {
      if (o.kind !== "monster" || !state.objects[o.id]?.available) return false;
      const stats = o.monster ? content.monsters[o.monster] : undefined;
      return !!stats?.drops?.some((d) => d.item === item);
    };
    const dropper = nearestOf(dropsIt);
    if (dropper) return dropper;
    // Last resort (nothing in the world drops it): the nearest creature at all.
    return nearestOf((o) => o.kind === "monster" && !!state.objects[o.id]?.available);
  }

  /** A "!" over an NPC with a quest to give, or "?" when one's ready to hand in. */
  private drawQuestMarkers(now: number): void {
    const player = this.bridge.state.player;
    const quests = this.bridge.content.quests;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);

    for (const obj of this.bridge.content.objects) {
      if (obj.kind !== "npc") continue;
      let mark: "!" | "?" | null = null;

      // Ready to act here: any active quest whose current step targets THIS NPC
      // (the core advances steps at the targeted NPC, not only the giver).
      for (const id of Object.keys(player.quests)) {
        const def = quests.find((q) => q.id === id);
        if (!def) continue;
        const step = def.steps[player.quests[id]!.step];
        if (!step) continue;
        if (step.type === "talk" && step.npc === obj.id) mark = "?";
        else if (step.type === "choice" && step.npc === obj.id) mark = "?";
        else if (step.type === "deliver" && step.npc === obj.id && have(step.item) >= step.count) {
          mark = "?";
        }
      }
      // Otherwise: a new quest available here (mirrors the core's gating so a
      // flag-locked quest doesn't show a false "!").
      if (!mark) {
        const offer = quests.find(
          (q) =>
            q.giver === obj.id &&
            !player.quests[q.id] &&
            !player.questsDone.includes(q.id) &&
            (!q.requires || player.questsDone.includes(q.requires)) &&
            (!q.requiresFlags || q.requiresFlags.every((f) => player.flags.includes(f))) &&
            (!q.blockedByFlags || !q.blockedByFlags.some((f) => player.flags.includes(f))) &&
            // Mirror the core's level gate so a giver doesn't flash a false "!"
            // before the player is actually strong enough to be offered it.
            (!q.requiresLevel || (q.requiresLevel.skill
              ? player.skills[q.requiresLevel.skill].level >= q.requiresLevel.level
              : combatLevel(player) >= q.requiresLevel.level)),
        );
        if (offer) mark = "!";
      }
      if (!mark) continue;

      const mp = this.objRenderPos(obj); // interpolated so the "!" tracks a wandering NPC
      const { x: cx, y: cy } = this.toScreen(mp.x, mp.y);
      const bob = Math.sin(now / 280) * 3;
      const my = cy - TILE * 0.85 + bob;
      this.g.font = "bold 20px 'Cinzel', serif";
      this.g.textAlign = "center";
      this.g.fillStyle = "rgba(0,0,0,0.6)";
      this.g.fillText(mark, cx + 1, my + 1);
      this.g.fillStyle = mark === "!" ? "#f2cf6b" : "#cde0a0";
      this.g.fillText(mark, cx, my);
    }
    this.g.textAlign = "left";

    // --- Tracked quest: a persistent gold guide toward the chosen objective. If
    //     its target NPC is on-screen, a bobbing chevron sits over them; if it's
    //     off-screen, a gold arrow pins to the screen edge pointing the way. ---
    const tid = getTrackedQuest();
    const tst = tid ? player.quests[tid] : undefined;
    if (tid && tst) {
      const def = quests.find((q) => q.id === tid);
      // Act IV (The Silence Beyond the Spine) is an adventure chain: no guide
      // chevron, no edge arrow — the psalm and the plaques are the only map.
      if (def?.act === 4) return;
      const step = def?.steps[tst.step] as
        | { type?: string; npc?: string; from?: string; x?: number; y?: number }
        | undefined;
      // A "visit" step points at a raw tile; everything else points at an object
      // (the target NPC, or a gather source) by id.
      let tp: { x: number; y: number } | undefined;
      if (step?.type === "visit" && typeof step.x === "number" && typeof step.y === "number") {
        tp = { x: step.x, y: step.y };
      } else {
        const targetId = step?.npc ?? step?.from;
        const tobj = targetId ? this.bridge.content.objects.find((o) => o.id === targetId) : undefined;
        if (tobj) tp = this.objRenderPos(tobj); // interpolated (the giver may wander)
      }
      if (tp) {
        const { x: sx, y: sy } = this.toScreen(tp.x, tp.y);
        const W = this.viewW, H = this.viewH, pad = 26;
        const g = this.g;
        g.save();
        g.fillStyle = "#f2cf6b";
        g.strokeStyle = "rgba(0,0,0,0.6)";
        g.lineWidth = 2;
        if (sx >= 0 && sx <= W && sy >= -TILE && sy <= H) {
          // On-screen: a bobbing chevron just above the target.
          const by = sy - TILE * 0.95 + Math.sin(now / 240) * 3;
          g.beginPath();
          g.moveTo(sx, by + 8); g.lineTo(sx - 7, by - 4); g.lineTo(sx + 7, by - 4);
          g.closePath(); g.stroke(); g.fill();
        } else {
          // Off-screen: clamp to the edge and point an arrow toward it.
          const cxp = Math.max(pad, Math.min(W - pad, sx));
          const cyp = Math.max(pad, Math.min(H - pad, sy));
          const ang = Math.atan2(sy - cyp, sx - cxp);
          g.translate(cxp, cyp); g.rotate(ang);
          g.beginPath();
          g.moveTo(12, 0); g.lineTo(-6, -7); g.lineTo(-6, 7);
          g.closePath(); g.stroke(); g.fill();
        }
        g.restore();
      }
    }
  }

  /**
   * Screen-edge red vignette: a quick flash when the player is hit, plus a
   * steady pulse while HP is critically low — so danger reads even with eyes
   * on the fight, not the HP bar. Drawn in device space over the whole canvas.
   */
  private drawHurtVignette(now: number): void {
    const player = this.bridge.state.player;
    const lowFrac = player.maxHp > 0 ? player.hp / player.maxHp : 1;
    const FLASH = 420;
    const flashAge = now - this.hurtFlash;
    const flash = flashAge >= 0 && flashAge < FLASH ? 1 - flashAge / FLASH : 0;
    // Steady danger pulse below 25% HP (and only while alive).
    const low = player.hp > 0 && lowFrac < 0.25 ? (1 - lowFrac / 0.25) : 0;
    const pulse = low > 0 ? 0.5 + 0.5 * Math.sin(now / 220) : 0;
    const alpha = Math.min(0.6, flash * 0.5 + low * pulse * 0.32);
    if (alpha <= 0.01) return;

    const g = this.g;
    const w = this.canvas.width, h = this.canvas.height;
    const grad = g.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.32,
      w / 2, h / 2, Math.max(w, h) * 0.62,
    );
    grad.addColorStop(0, "rgba(150,12,12,0)");
    grad.addColorStop(1, `rgba(150,12,12,${alpha.toFixed(3)})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }

  /**
   * A dark "knocked out" curtain while the player is down, with the seconds
   * left until they wake. Fades in fast and out as they respawn.
   */
  private drawDeathOverlay(now: number): void {
    const player = this.bridge.state.player;
    if (player.alive) return;
    const g = this.g;
    const w = this.canvas.width, h = this.canvas.height;
    g.fillStyle = "rgba(8,4,4,0.68)";
    g.fillRect(0, 0, w, h);
    const secs = Math.max(0, Math.ceil((player.respawnAt - now) / 1000));
    const px = (n: number): number => n * this.dpr;
    g.save();
    g.textAlign = "center";
    g.fillStyle = "#e2483a";
    g.font = `700 ${px(30)}px "Cinzel", serif`;
    g.fillText("Knocked out", w / 2, h / 2 - px(8));
    g.fillStyle = "#cdbfae";
    g.font = `${px(15)}px "EB Garamond", serif`;
    g.fillText(secs > 0 ? `Waking in ${secs}…` : "Waking…", w / 2, h / 2 + px(22));
    // A reassurance line so a newcomer never mistakes a knockout for permadeath:
    // you always respawn, keep your gear, and (for a light pack) lose nothing at
    // all — worst case a few stacks spill where you fell, to run back for.
    const spill = player.deathSpillStacks ?? 0;
    const reassure = spill > 0
      ? `Your gear's safe — ${spill} pack stack${spill === 1 ? "" : "s"} spilled where you fell. Run back for ${spill === 1 ? "it" : "them"}.`
      : "You keep everything you carried — walk it off.";
    g.fillStyle = "#9db98a";
    g.font = `${px(13)}px "EB Garamond", serif`;
    g.fillText(reassure, w / 2, h / 2 + px(46));
    g.restore();
  }

  /** Kick up a little dust (or a splash on water/bog) under the moving player —
   *  and voice the footfall by surface (grass pat, stone scuff, plank knock,
   *  shallow slosh), so walking is heard as well as seen. */
  private emitFootsteps(now: number): void {
    const pl = this.bridge.state.player;
    // Keep footfalls going through the LAST tile's glide, not only while more
    // path is queued — the final step empties `path` before it finishes sliding,
    // so gating on path alone silenced the last step. prevPos != pos covers the
    // whole glide (matching the walk-cycle fix in render.ts).
    const moving = pl.path.length > 0 || pl.prevPos.x !== pl.pos.x || pl.prevPos.y !== pl.pos.y;
    if (!pl.alive || !moving) return; // only while actually walking/gliding
    if (now - this.lastPuff < 150) return;
    this.lastPuff = now;
    const m = this.bridge.state.map;
    const tx = Math.round(pl.pos.x), ty = Math.round(pl.pos.y);
    const tile = (tx >= 0 && ty >= 0 && tx < m.width && ty < m.height) ? m.tiles[ty * m.width + tx] : "grass";
    const wet = tile === "water" || tile === "deep" || tile === "bog";
    const surface =
      wet ? "water"
      : tile === "path" || tile === "stone" || tile === "mountain" || tile === "cave" || tile === "wall" ? "stone"
      : tile === "plank" ? "wood"
      : tile === "sand" || tile === "snow" ? "sand"
      : "grass"; // grass / dirt / moss / ash — a soft pat
    audio.step(surface);
    // Drop the scuff under the avatar's interpolated (gliding) position.
    const rp = this.renderPlayerPos();
    this.puffs.push({ x: rp.x, y: rp.y + 0.32, born: now, kind: wet ? "splash" : "dust" });
  }

  /** Footstep puffs: a dust scuff that rises and fades, or a little splash. */
  private drawPuffs(now: number): void {
    const LIFE = 460;
    this.puffs = this.puffs.filter((p) => now - p.born < LIFE);
    const g = this.g;
    for (const p of this.puffs) {
      const t = (now - p.born) / LIFE;
      const cx = p.x * TILE + TILE / 2 - this.cam.x;
      const cy = p.y * TILE + TILE / 2 - this.cam.y;
      if (p.kind === "dust") {
        g.globalAlpha = (1 - t) * 0.5;
        g.fillStyle = "#9c8a6a";
        g.beginPath();
        g.ellipse(cx, cy - t * 5, 3 + t * 6, 1.6 + t * 2.5, 0, 0, Math.PI * 2);
        g.fill();
      } else {
        // A splash: an expanding ripple ring plus a couple of droplets arcing up.
        g.globalAlpha = (1 - t) * 0.7;
        g.strokeStyle = "rgba(170,205,225,0.9)";
        g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(cx, cy, 3 + t * 9, 1.5 + t * 4, 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = "rgba(200,225,240,0.9)";
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI - Math.PI; // upper arc
          const r = t * 11;
          g.beginPath();
          g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r - t * 4, 1.4 * (1 - t), 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    }
  }

  /** Expanding shockwave rings — the death poof when a creature is slain. */
  private drawRings(now: number): void {
    const LIFE = 420;
    this.rings = this.rings.filter((r) => now - r.born < LIFE && now >= r.born);
    const g = this.g;
    for (const r of this.rings) {
      const t = (now - r.born) / LIFE;
      const cx = r.x * TILE + TILE / 2 - this.cam.x;
      const cy = r.y * TILE + TILE / 2 - this.cam.y;
      g.globalAlpha = (1 - t) * 0.8;
      g.strokeStyle = r.color;
      g.lineWidth = 3 * (1 - t) + 1;
      g.beginPath();
      g.arc(cx, cy, 6 + t * 22, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  /** Short radiating impact bursts on the worked tile (chips, sparks, splash). */
  /** On a ranged/magic hit, launch a projectile from the shooter to the target. */
  private spawnProjectile(victimId: string, now: number): void {
    const state = this.bridge.state;
    const content = this.bridge.content;
    let attackerId: string;
    let kind: "arrow" | "bolt";
    let color = "#8fbaf0";
    if (victimId === "player") {
      // A monster shooting the player — only ranged/caster foes fling anything.
      const mid = state.player.activity.kind === "combat" ? state.player.activity.targetId : null;
      if (!mid) return;
      const def = content.objects.find((o) => o.id === mid);
      const stats = def?.monster ? content.monsters[def.monster] : undefined;
      if (!stats) return;
      const style = stats.attackStyle;
      const isRanged = (stats.attackRange ?? 1) >= 4 || style === "ranged" || style === "magic";
      if (!isRanged) return;
      attackerId = mid;
      kind = style === "magic" ? "bolt" : "arrow";
      color = style === "magic" ? "#c58cff" : "#8fbaf0";
    } else {
      // The player shooting a monster — a bow looses an arrow, a staff a bolt.
      const main = state.player.equipment.mainhand;
      const item = main ? content.items[main] : undefined;
      if (item?.magic) { kind = "bolt"; color = "#8fd0ff"; }
      else if (item?.ranged) { kind = "arrow"; }
      else return;
      attackerId = "player";
    }
    const from = this.positionOf(attackerId);
    const to = this.positionOf(victimId);
    if (!from || !to) return;
    this.projectiles.push({ fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, born: now, kind, color });
  }

  private drawProjectiles(now: number): void {
    const LIFE = 170;
    this.projectiles = this.projectiles.filter((p) => now - p.born < LIFE);
    const g = this.g;
    for (const p of this.projectiles) {
      const t = Math.min(1, (now - p.born) / LIFE);
      const x = p.fromX + (p.toX - p.fromX) * t;
      const y = p.fromY + (p.toY - p.fromY) * t;
      const sx = x * TILE + TILE / 2 - this.cam.x;
      const sy = y * TILE + TILE / 2 - this.cam.y - 6;
      const ang = Math.atan2(p.toY - p.fromY, p.toX - p.fromX);
      g.save();
      g.translate(sx, sy);
      g.rotate(ang);
      if (p.kind === "arrow") {
        g.strokeStyle = "#6a4a2e"; g.lineWidth = 2; g.lineCap = "round";
        g.beginPath(); g.moveTo(-9, 0); g.lineTo(6, 0); g.stroke();
        g.strokeStyle = "#d6dae2"; g.lineWidth = 1.6; // head
        g.beginPath(); g.moveTo(6, 0); g.lineTo(2, -2.4); g.moveTo(6, 0); g.lineTo(2, 2.4); g.stroke();
        g.strokeStyle = "#b5564a"; g.lineWidth = 1.4; // fletching
        g.beginPath(); g.moveTo(-9, 0); g.lineTo(-6, -2.2); g.moveTo(-9, 0); g.lineTo(-6, 2.2); g.stroke();
        g.lineCap = "butt";
      } else {
        // A glowing magic bolt with a soft tail.
        g.strokeStyle = p.color; g.lineWidth = 2; g.globalAlpha = 0.5; g.lineCap = "round";
        g.beginPath(); g.moveTo(-11, 0); g.lineTo(0, 0); g.stroke();
        g.globalAlpha = 1;
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, 6);
        grad.addColorStop(0, p.color); grad.addColorStop(1, "rgba(120,170,240,0)");
        g.fillStyle = grad; g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#eaf3ff"; g.beginPath(); g.arc(0, 0, 2.2, 0, Math.PI * 2); g.fill();
        g.lineCap = "butt";
      }
      g.restore();
    }
    g.globalAlpha = 1;
  }

  private drawSparks(now: number): void {
    const LIFE = 300;
    this.sparks = this.sparks.filter((s) => now - s.born < LIFE);
    const g = this.g;
    for (const s of this.sparks) {
      const t = (now - s.born) / LIFE;
      const cx = s.x * TILE + TILE / 2 - this.cam.x;
      const cy = s.y * TILE + TILE / 2 - this.cam.y;
      g.globalAlpha = 1 - t;
      g.strokeStyle = s.color;
      g.lineWidth = 2;
      const reach = 4 + t * 12;
      for (let i = 0; i < s.n; i++) {
        // Stable per-shard angle so a given burst doesn't jitter frame to frame.
        const a = (i / s.n) * Math.PI * 2 + (s.born % 6);
        const dx = Math.cos(a), dy = Math.sin(a);
        g.beginPath();
        g.moveTo(cx + dx * (reach - 4), cy + dy * (reach - 4));
        g.lineTo(cx + dx * reach, cy + dy * reach);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  }

  /**
   * A health bar over whatever you are fighting.
   *
   * Only the current target gets one — an overworld full of bars would be
   * noise, and the one thing you need to read mid-fight is how close THIS is to
   * dying. Drawn in the overlay pass so it is never occluded by the sprite it
   * belongs to.
   */
  private drawTargetHealth(): void {
    const id = this.combatTargetId;
    if (!id) return;
    const obj = this.bridge.state.objects[id];
    const def = this.bridge.content.objects.find((o) => o.id === id);
    if (!obj?.available || obj.hp === undefined || !def?.monster) return;
    const max = this.bridge.content.monsters[def.monster]?.hp ?? 0;
    if (max <= 0) return;
    const pos = this.positionOf(id);
    if (!pos) return;

    const frac = Math.max(0, Math.min(1, obj.hp / max));
    const w = 44, h = 5;
    const px = pos.x * TILE + TILE / 2 - this.cam.x - w / 2;
    const py = pos.y * TILE + TILE / 2 - this.cam.y - 34;
    this.g.save();
    this.g.fillStyle = "rgba(0,0,0,0.55)";
    this.g.fillRect(px - 1, py - 1, w + 2, h + 2);
    this.g.fillStyle = "#5c1f1a";
    this.g.fillRect(px, py, w, h);
    // Green down to a third, then amber, then red — the same reading the
    // player's own vitals bar gives.
    this.g.fillStyle = frac > 0.5 ? "#4c9a3f" : frac > 0.25 ? "#c9922a" : "#b4342a";
    this.g.fillRect(px, py, w * frac, h);
    this.g.restore();
  }

  /**
   * OSRS hitsplats: a coloured lozenge over the target with the number in it.
   *
   * The colours carry the whole vocabulary of an exchange at a glance —
   * red you hurt it, BLUE it landed and did nothing, grey it missed, gold you
   * exploited its weakness. The blue is the important one: damage rolls from
   * zero now, so "landed for 0" is a real and frequent outcome that would
   * otherwise be indistinguishable from a whiff.
   */
  private drawHitsplats(now: number): void {
    const LIFE = 700;
    this.hitsplats = this.hitsplats.filter((h) => now - h.born < LIFE && now >= h.born);
    for (const h of this.hitsplats) {
      if (now < h.born) continue; // still staggered behind an earlier blow
      const t = (now - h.born) / LIFE;
      const px = h.x * TILE + TILE / 2 - this.cam.x;
      // A short lift then a hold, so the number is readable rather than fleeing.
      const py = h.y * TILE + TILE / 2 - this.cam.y - 10 - Math.min(1, t * 3) * 12;
      const fill =
        h.kind === "miss" ? "#5b626c"
        : h.kind === "zero" ? "#2f6fd0"
        : h.kind === "poison" ? "#3f9b4f"
        : h.kind === "venom" ? "#6b3fa0"
        : h.weak ? "#c98a12" : "#b4342a";
      const label = h.kind === "miss" ? "" : String(h.amount);
      const w = Math.max(22, 13 + label.length * 8);
      const hgt = 17;
      this.g.save();
      // Hold full opacity most of the way, then fade — a splat that fades from
      // the first frame is hard to read on a 600ms beat.
      this.g.globalAlpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
      this.g.translate(px, py);
      // The lozenge.
      this.g.beginPath();
      this.g.ellipse(0, 0, w / 2, hgt / 2, 0, 0, Math.PI * 2);
      this.g.fillStyle = fill;
      this.g.fill();
      this.g.lineWidth = 1;
      this.g.strokeStyle = "rgba(0,0,0,0.55)";
      this.g.stroke();
      // A weakness hit gets a gold rim so the triangle stays legible even when
      // the number itself is small.
      if (h.weak && h.kind === "hit") {
        this.g.lineWidth = 1.5;
        this.g.strokeStyle = "#ffcf4a";
        this.g.stroke();
      }
      if (label) {
        this.g.font = "bold 12px 'Cinzel', serif";
        this.g.textAlign = "center";
        this.g.textBaseline = "middle";
        this.g.fillStyle = "rgba(0,0,0,0.6)";
        this.g.fillText(label, 0.5, 1);
        this.g.fillStyle = "#f3efe6";
        this.g.fillText(label, 0, 0.5);
      }
      this.g.restore();
    }
  }

  private drawFloats(now: number): void {
    const LIFE = 900;
    this.floats = this.floats.filter((f) => now - f.born < (f.life ?? LIFE));
    for (const f of this.floats) {
      const t = (now - f.born) / (f.life ?? LIFE);
      const age = now - f.born;
      const px = f.x * TILE + TILE / 2 - this.cam.x;
      // Ease-out rise: quick lift off the hit, then a gentle drift at the top.
      const rise = 1 - (1 - t) * (1 - t);
      const py = f.y * TILE + TILE / 2 - this.cam.y - rise * 26;
      // A quick pop on spawn: overshoot to ~1.5× then settle over the first 130ms.
      const pop = age < 130 ? 1 + 0.5 * (1 - age / 130) : 1;
      this.g.save();
      this.g.globalAlpha = 1 - t;
      this.g.font = `bold ${f.size ?? 16}px 'Cinzel', serif`;
      this.g.textAlign = "center";
      this.g.translate(px, py);
      this.g.scale(pop, pop);
      this.g.fillStyle = "rgba(0,0,0,0.7)";
      this.g.fillText(f.text, 1, 1);
      this.g.fillStyle = f.color;
      this.g.fillText(f.text, 0, 0);
      this.g.restore();
    }
    this.g.globalAlpha = 1;
    this.g.textAlign = "left";
  }

  // --- Input -------------------------------------------------------------

  private tileAtScreen(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: Math.floor((sx / this.zoom + this.cam.x) / TILE),
      y: Math.floor((sy / this.zoom + this.cam.y) / TILE),
    };
  }

  private onPointerDown(e: PointerEvent): void {
    e.preventDefault();

    // Track touch points for pinch-to-zoom. A second finger cancels any pending
    // tap and starts a pinch instead.
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size >= 2) {
      this.press = null;
      this.clearLongTimer();
      this.pinchDist = this.currentPinchDist();
      return;
    }

    // A tap closes / advances dialogue first; no menu while talking.
    if (this.dialogue.isOpen()) {
      this.dialogue.advance();
      return;
    }
    if (this.menu.isOpen() || this.bank.isOpen() || this.shop.isOpen() || this.bounty.isOpen() || this.worldMap.isOpen() || this.records.isOpen() || this.tension.isOpen()) return;

    const tile = this.tileAtScreen(e.clientX, e.clientY);
    this.press = {
      startX: e.clientX,
      startY: e.clientY,
      tile,
      longFired: false,
      moved: false,
    };

    // Right-click opens the menu immediately; touch/left-click waits for a hold.
    if (e.button === 2) {
      this.openMenu(e.clientX, e.clientY, tile);
      this.press.longFired = true;
      return;
    }
    this.longTimer = window.setTimeout(() => {
      if (this.press && !this.press.moved) {
        this.press.longFired = true;
        this.openMenu(e.clientX, e.clientY, tile);
      }
    }, LONG_PRESS_MS);
  }

  private onPointerMove(e: PointerEvent): void {
    // Pinch-to-zoom: with two fingers down, the change in their spacing scales.
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size >= 2) {
      const d = this.currentPinchDist();
      if (this.pinchDist > 0 && d > 0) this.setZoom(this.zoom * (d / this.pinchDist));
      this.pinchDist = d;
      return;
    }
    if (!this.press) return;
    const dx = e.clientX - this.press.startX;
    const dy = e.clientY - this.press.startY;
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
      this.press.moved = true;
      this.clearLongTimer();
    }
  }

  private onPointerUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
    // Lifting one finger mid-pinch shouldn't fire a tap.
    if (this.pointers.size >= 1 && !this.press) return;
    this.clearLongTimer();
    const press = this.press;
    this.press = null;
    if (!press || press.longFired || press.moved) return;
    this.defaultAction(press.tile, press.startX, press.startY);
  }

  /** Distance between the first two active touch points (0 if fewer than two). */
  private currentPinchDist(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
  }

  private clearLongTimer(): void {
    if (this.longTimer !== null) {
      window.clearTimeout(this.longTimer);
      this.longTimer = null;
    }
  }

  /** A plain tap: do the obvious thing for whatever was under the finger. */
  /** The player-lit campfire, if it sits on this tile. */
  private campfireAt(tile: Vec2): boolean {
    const f = this.bridge.state.campfire;
    return !!f && f.x === tile.x && f.y === tile.y;
  }

  private defaultAction(tile: Vec2, sx: number, sy: number): void {
    // Decorate mode swallows world taps (place / move / pick pieces).
    if (this.decorate.isActive() && this.decorate.handleWorldTap(tile, sx, sy)) return;
    this.cookAll = null; // any deliberate tap ends a "Cook all" run
    const obj = this.objectAt(tile);
    // An item is armed with "Use": this tap picks the target.
    if (this.useItem) {
      // A campfire is a real cooking source even though it's not a world object.
      if (!obj && this.campfireAt(tile)) {
        this.resolveUseOn({ id: "campfire", kind: "fire", name: "Fire", x: tile.x, y: tile.y } as WorldObjectDef, sx, sy);
        return;
      }
      // Fat-finger grace applies here too: a near-miss still picks the target.
      this.resolveUseOn(obj ?? this.nearestObjectAt(sx, sy) ?? null, sx, sy);
      return;
    }
    // Tapping your campfire opens its cooking menu (walk beside it first).
    if (!obj && this.campfireAt(tile)) { this.approachCampfire(tile); return; }
    const st = obj ? this.bridge.state.objects[obj.id] : undefined;
    // A felled monster's body lingers on its tile while it respawns; don't try to
    // re-attack it — let loot there be picked up instead.
    const deadMonster = obj?.kind === "monster" && !!st && !st.available;
    if (obj && !deadMonster) {
      this.actOnObject(obj, sx, sy);
      return;
    }
    // A placed home station (cooking hearth, oak chest, anvil, cauldron, bench)
    // — tap it to cook / bank / smith / brew at home, just like a town station.
    const station = this.placedStationAt(tile);
    if (station) { this.useHomeStation(station.station, station.item); return; }
    if (this.groundAt(tile)) { this.pickupTopAt(tile); return; }
    // Forgiving taps: NOTHING sits on the exact tile — before turning the tap
    // into a walk, snap to a live object whose centre is within a whisker of
    // the precise tap point, so a near-miss on a 38px target still acts on it.
    const near = this.nearestObjectAt(sx, sy);
    if (near) { this.actOnObject(near, sx, sy); return; }
    this.walkTo(tile);
  }

  /** The default act-on-object flow shared by exact-tile taps and the
   *  near-miss snap: special-case menus first, then plain interact. */
  private actOnObject(obj: WorldObjectDef, sx: number, sy: number): void {
    // A shopkeeper offers a choice — Talk or Shop — rather than one or the other.
    if (obj.kind === "npc" && this.isShopkeeper(obj.id)) {
      this.shopkeeperMenu(obj, sx, sy);
      return;
    }
    // A bounty guide offers Get-bounty or Talk.
    if (obj.kind === "npc" && this.isBountyGuide(obj.id)) {
      this.guideMenu(obj, sx, sy);
      return;
    }
    // The Delve Warden offers to open the way down (or Talk).
    if (obj.id === "delve_warden") {
      this.delveMenu(obj, sx, sy);
      return;
    }
    // The Duel Ring — step up to it and the opt-in PvP window opens.
    if (obj.id === "duel_board") {
      this.setMarker(this.liveTile(obj));
      this.walkBeside(this.liveTile(obj));
      this.duel.show();
      return;
    }
    // The public Wins Board beside the ring — read the realm's duel standings.
    if (obj.id === "duel_wins_board") {
      this.setMarker(this.liveTile(obj));
      this.walkBeside(this.liveTile(obj));
      void this.showDuelStandings();
      return;
    }
    this.interactObject(obj.id, this.liveTile(obj));
  }

  /** Forgiving-tap lookup: the nearest LIVE object whose centre is within `r`
   *  tiles of the precise (fractional) world point under the tap. Depleted
   *  resources, dead monsters and story-hidden objects don't attract taps. */
  private nearestObjectAt(clientX: number, clientY: number, r = 0.85): WorldObjectDef | undefined {
    const rect = this.canvas.getBoundingClientRect();
    const wx = ((clientX - rect.left) / this.zoom + this.cam.x) / TILE;
    const wy = ((clientY - rect.top) / this.zoom + this.cam.y) / TILE;
    const player = this.bridge.state.player;
    let best: WorldObjectDef | undefined;
    let bestD = r * r;
    for (const o of this.bridge.content.objects) {
      if (objectHidden(o, player)) continue;
      const st = this.bridge.state.objects[o.id];
      if (st && !st.available) continue; // nothing there to act on right now
      const p = objectPos(o, st);
      const dx = p.x + 0.5 - wx;
      const dy = p.y + 0.5 - wy;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  /** A placed furniture piece with a `station` covering this tile, or null. */
  private placedStationAt(tile: Vec2): { station: string; item: string } | null {
    const placed = this.bridge.state.player.home.placed;
    const content = this.bridge.content;
    for (let i = placed.length - 1; i >= 0; i--) {
      const pc = placed[i]!;
      const f = content.furniture[pc.item];
      if (!f?.station) continue;
      const [fw, fh] = f.footprint ?? [1, 1];
      const [w, h] = (pc.rot & 1) === 1 ? [fh, fw] : [fw, fh];
      if (tile.x >= pc.x && tile.x < pc.x + w && tile.y >= pc.y && tile.y < pc.y + h) {
        return { station: f.station, item: pc.item };
      }
    }
    return null;
  }

  /** Open a home station's menu — the bank vault, or a cook/craft recipe list. */
  private useHomeStation(station: string, item: string): void {
    if (station === "bank") { audio.play("bank"); this.bank.show(this.bridge.state); return; }
    this.openCraft(station as ObjKind, `home_${item}`);
  }

  /** Is there loot on this tile? */
  private groundAt(tile: Vec2): boolean {
    return this.bridge.state.ground.some((g) => g.x === tile.x && g.y === tile.y);
  }

  /** A tap on a loot tile takes just the TOP pile — the most recently dropped,
   *  drawn on top — OSRS-style, rather than sweeping the whole tile. Long-hold
   *  opens the full pile menu (take one, an amount, or all). */
  private pickupTopAt(tile: Vec2): void {
    const piles = this.bridge.state.ground.filter((g) => g.x === tile.x && g.y === tile.y);
    if (!piles.length) return;
    this.pickupAt(tile, { id: piles[piles.length - 1]!.id }); // last in array = on top
  }

  /** Walk to the loot tile (if needed) and pick it up on arrival. `opts` can
   *  target a single pile (by id) and a partial quantity; omitted = take all. */
  private pickupAt(tile: Vec2, opts?: { id?: number; qty?: number }): void {
    const player = this.bridge.state.player;
    const near =
      Math.max(Math.abs(Math.round(player.pos.x) - tile.x), Math.abs(Math.round(player.pos.y) - tile.y)) <= 1;
    const intent: Intent = { type: "PICKUP", x: tile.x, y: tile.y };
    if (opts?.id !== undefined) intent.id = opts.id;
    if (opts?.qty !== undefined) intent.qty = opts.qty;
    if (near) { this.dispatch(intent); return; }
    // Walk to it and let the core grab it on arrival (it fires the PICKED_UP
    // glint too) — no more per-frame arrival polling on the client.
    const { path, reachable } = pathToAdjacent(this.bridge.walkable, player.pos, tile);
    if (!reachable) { this.hud.error("You can't reach that."); return; }
    this.setMarker(tile);
    intent.path = path;
    this.dispatch(intent);
  }

  /** The Trail billboard: every runner on the shared board ranked by laps —
   *  multiplayer standings (Cael carries your own ledger in his dialogue). */
  private async showTrailStandings(): Promise<void> {
    const you = this.bridge.state.player;
    const yourLaps = you.trailLaps ?? 0;
    const yourName = you.appearance?.name ?? "You";
    let entries: { name: string; laps: number }[] = [];
    try {
      const rows = await getSocial(this.bridge.content).hiscores();
      entries = rows.map((r) => ({ name: r.name, laps: r.trailLaps ?? 0 }));
    } catch { /* offline — show just your own line below */ }
    if (!entries.some((e) => e.name === yourName)) entries.push({ name: yourName, laps: yourLaps });
    entries.sort((a, b) => b.laps - a.laps);
    const ranked = entries.filter((e) => e.laps > 0).slice(0, 10);
    const lines = ["— TRAIL STANDINGS — laps run, all of Varath —"];
    if (ranked.length === 0) lines.push("No laps chalked up yet. The Trail waits for its first runner.");
    for (let i = 0; i < ranked.length; i++) {
      const e = ranked[i]!;
      const yours = e.name === yourName;
      lines.push(`${i + 1}. ${e.name} — ${e.laps} lap${e.laps === 1 ? "" : "s"}${yours ? "  ← you" : ""}`);
    }
    if (!ranked.some((e) => e.name === yourName)) {
      lines.push(`You: ${yourLaps} lap${yourLaps === 1 ? "" : "s"} — run one and take your place.`);
    }
    this.dialogue.show("The Varathian Trail", lines);
  }

  /** The public Wins Board by the Duel Ring: every duellist in Varath, ranked by
   *  victories (from the shared hiscores board). */
  private async showDuelStandings(): Promise<void> {
    const you = this.bridge.state.player;
    const yourName = you.appearance?.name ?? "You";
    const yourW = you.stats.duelWins ?? 0;
    const yourL = you.stats.duelLosses ?? 0;
    let entries: { name: string; w: number; l: number }[] = [];
    try {
      // Push our own latest first, so the board others read includes this win.
      await submitCurrent(this.bridge.content);
      const rows = await getSocial(this.bridge.content).hiscores();
      entries = rows.map((r) => ({ name: r.name, w: r.duelWins ?? 0, l: r.duelLosses ?? 0 }));
    } catch { /* offline — show just your own line below */ }
    // Make sure your own live record is represented (the board may lag a push).
    const mine = entries.find((e) => e.name === yourName);
    if (mine) { mine.w = Math.max(mine.w, yourW); mine.l = Math.max(mine.l, yourL); }
    else entries.push({ name: yourName, w: yourW, l: yourL });
    entries.sort((a, b) => b.w - a.w || a.l - b.l);
    const ranked = entries.filter((e) => e.w > 0 || e.l > 0).slice(0, 12);
    const lines = ["— THE WINS BOARD — duellists of Varath, by victories —"];
    if (ranked.length === 0) lines.push("No duels fought yet. Step into the ring and be the first name here.");
    for (let i = 0; i < ranked.length; i++) {
      const e = ranked[i]!;
      const yours = e.name === yourName;
      lines.push(`${i + 1}. ${e.name} — ${e.w} Victories · ${e.l} Losses${yours ? "  ← you" : ""}`);
    }
    if (!ranked.some((e) => e.name === yourName)) {
      lines.push(`You: ${yourW} Victories · ${yourL} Losses — win a wager to make the board.`);
    }
    this.dialogue.show("The Wins Board", lines);
  }

  /** Fold the online board's catches into the local pier records so every
   *  angler's heaviest fish shows up — and the Golden Rod tracks the ONE global
   *  champion (a dethroned holder loses it via the core's revoke check). No-op
   *  offline: the local board stands. */
  private async syncPierBoard(): Promise<void> {
    if (!currentUser()) return;
    let rows;
    try {
      await submitCurrent(this.bridge.content); // publish our own best first
      rows = await getSocial(this.bridge.content).hiscores();
    } catch { return; }
    const pier = this.bridge.content.pierFish;
    // One row per angler (their heaviest), from the shared board + what we hold
    // locally (keeps the seeded rivals in play until real players beat them).
    const bestByAngler = new Map<string, FishRecord>();
    const consider = (rec: FishRecord): void => {
      if (!rec || !(rec.weight > 0)) return;
      const cur = bestByAngler.get(rec.angler);
      if (!cur || rec.weight > cur.weight) bestByAngler.set(rec.angler, rec);
    };
    for (const rec of this.bridge.state.player.fishingRecords) consider(rec);
    for (const r of rows) {
      if (!r.pierWeight || r.pierWeight <= 0) continue;
      const sp = pier[r.pierSpecies ?? 0]?.name ?? pier[0]?.name ?? "Saltgill";
      consider({ species: sp, weight: r.pierWeight, length: r.pierLength ?? 0, angler: r.name });
    }
    const top = [...bestByAngler.values()].sort((a, b) => b.weight - a.weight).slice(0, 5);
    if (top.length > 0) this.dispatch({ type: "SET_PIER_RECORDS", records: top });
  }

  /** After a rank-1 catch: reconcile with the shared board, then fire the right
   *  fanfare — the champion claim only if you actually top all of Varath. */
  private async resolvePierChampion(species: string, weight: number, length: number, newChampion: boolean): Promise<void> {
    await this.syncPierBoard();
    const pl = this.bridge.state.player;
    const stillLeader = pl.fishingRecords[0]?.angler === pl.appearance.name;
    if (!stillLeader) {
      // A rival elsewhere holds the pier — reveal the catch, but no false claim.
      this.levelUp.catch(species, weight, length);
      return;
    }
    const ownsRod = pl.equipment.mainhand === "rod_gold"
      || pl.inventory.some((s) => s?.item === "rod_gold")
      || (pl.bank["rod_gold"] ?? 0) > 0;
    this.levelUp.champion(species, weight, !ownsRod);
    if (newChampion) {
      this.hud.worldAnnounce(`${pl.appearance.name} landed a ${weight.toFixed(1)}kg ${species} — the Drowned Pier's new Fishing champion!`);
    }
  }

  /** Walk beside the campfire (if not already) and cook there. The core owns the
   *  walk-then-act: on arrival it emits OPEN_CRAFT (see the COOK intent). */
  private approachCampfire(tile: Vec2): void {
    const p = this.bridge.state.player;
    const near = Math.max(Math.abs(Math.round(p.pos.x) - tile.x), Math.abs(Math.round(p.pos.y) - tile.y)) <= 1;
    const intent: Intent = { type: "COOK", x: tile.x, y: tile.y };
    if (near) { this.dispatch(intent); return; }
    const { path, reachable } = pathToAdjacent(this.bridge.walkable, p.pos, tile);
    if (!reachable) { this.hud.error("You can't reach that."); return; }
    this.setMarker(path[path.length - 1] ?? tile);
    intent.path = path;
    this.dispatch(intent);
  }

  private openMenu(screenX: number, screenY: number, tile: Vec2): void {
    const obj = this.objectAt(tile);
    const items: MenuItem[] = [];
    let title: string;
    let description: string;

    if (obj) {
      title = obj.name;
      description = this.examineObject(obj); // shown as the inspect line
      if (obj.id === "duel_board") {
        // The Duel Ring — "Enter" opens the opt-in PvP window.
        items.push({
          label: "Enter", target: obj.name, tone: "action",
          onSelect: () => { this.walkBeside(this.liveTile(obj)); this.duel.show(); },
        });
      } else if (obj.id === "duel_wins_board") {
        items.push({
          label: "Read", target: obj.name, tone: "action",
          onSelect: () => { this.walkBeside(this.liveTile(obj)); void this.showDuelStandings(); },
        });
      } else if (obj.kind === "npc" && this.thieveMark(obj.id)) {
        // A mark gets Talk first and Pickpocket second: walking up to somebody
        // should never rob them by accident, and the tap-anywhere default
        // action must stay the harmless one.
        items.push({
          label: "Talk to", target: obj.name, tone: "action",
          onSelect: () => this.interactObject(obj.id, this.liveTile(obj), "talk"),
        });
        items.push({
          label: "Pickpocket", target: obj.name,
          onSelect: () => this.interactObject(obj.id, this.liveTile(obj), "steal"),
        });
      } else if (obj.kind === "npc" && this.isShopkeeper(obj.id)) {
        // Shopkeepers list both Talk and Shop.
        items.push({
          label: "Talk to", target: obj.name, tone: "action",
          onSelect: () => this.interactObject(obj.id, this.liveTile(obj), "talk"),
        });
        items.push({
          label: "Shop with", target: obj.name,
          onSelect: () => this.interactObject(obj.id, this.liveTile(obj), "shop"),
        });
      } else {
        items.push({
          label: VERB[obj.kind],
          target: obj.name,
          tone: "action",
          onSelect: () => this.interactObject(obj.id, this.liveTile(obj)),
        });
      }
      items.push({
        label: "Walk here",
        onSelect: () => this.walkBeside(this.liveTile(obj)),
      });
    } else {
      title = "Ground";
      description = EXAMINE_TILE[this.tileType(tile)];
      if (this.bridge.walkable(tile.x, tile.y)) {
        items.push({
          label: "Walk here",
          tone: "action",
          onSelect: () => this.walkTo(tile),
        });
      }
    }

    // Loot on the tile is grabbable, listed first (even under a creature). Each
    // pile is its own entry; taking one always grabs the WHOLE pile — no
    // "how many" prompt, even for a stack. With more than one pile, a
    // "Take all" entry tops the list.
    const loot = this.bridge.state.ground.filter((g) => g.x === tile.x && g.y === tile.y);
    if (loot.length) {
      const lootEntries: MenuItem[] = loot.map((g) => {
        const name = this.bridge.content.items[g.item]?.name ?? g.item;
        return {
          label: "Take",
          target: g.qty > 1 ? `${g.qty}× ${name}` : name,
          tone: "action",
          onSelect: () => this.pickupAt(tile, { id: g.id }),
        };
      });
      if (loot.length > 1) {
        lootEntries.push({ label: "Take all", tone: "action", onSelect: () => this.pickupAt(tile) });
      }
      items.unshift(...lootEntries);
    }

    this.menu.show(screenX, screenY, title, items, description);
  }

  private objectAt(tile: Vec2) {
    const player = this.bridge.state.player;
    return this.bridge.content.objects.find((o) => {
      if (objectHidden(o, player)) return false; // story-gated: not there yet
      const p = objectPos(o, this.bridge.state.objects[o.id]);
      return Math.round(p.x) === tile.x && Math.round(p.y) === tile.y;
    });
  }

  /** The creature/object's current tile (rounded), for pathing toward it. */
  private liveTile(obj: WorldObjectDef): Vec2 {
    const p = objectPos(obj, this.bridge.state.objects[obj.id]);
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }

  /** Examine text: a monster shows its canon description; others use the map. */
  private examineObject(obj: WorldObjectDef): string {
    if (obj.id === "duel_board") return "The Duel Ring — step in to challenge another player. Stake gold and gear; the winner takes both purses.";
    if (obj.id === "duel_wins_board") return "The Wins Board — every duellist in Varath, ranked by victories for all to see.";
    if (obj.kind === "monster" && obj.monster) {
      const stats = this.bridge.content.monsters[obj.monster];
      if (stats) return `${stats.desc} Combat level ${stats.level}. ${this.weaknessNote(stats)}`;
    }
    if (obj.kind === "tree" && obj.species && EXAMINE_TREE[obj.species]) {
      return EXAMINE_TREE[obj.species]!;
    }
    if ((obj.kind === "shrine" || obj.kind === "bone_cairn" || obj.kind === "fence" || obj.kind === "boat") && obj.lines?.[0]) return obj.lines[0];
    if (obj.kind === "npc") return `${obj.name}, met on the road.`;
    if (obj.kind === "fishing_spot") {
      const lvl = this.bridge.state.player.skills.fishing?.level ?? 1;
      // Single-fish spots carry just a `resource`; mixed pools carry `catches`.
      // List whichever it is, so EVERY spot tells you what's in the water.
      const ids = obj.catches?.length
        ? obj.catches.map((c) => c.action)
        : [obj.resource ?? "fish_ashfin"];
      const list = ids.map((id) => {
        const a = this.bridge.content.actions.find((x) => x.id === id);
        if (!a) return null;
        const req = a.levelReq ?? 1;
        return `${a.name} (lvl ${req})${lvl >= req ? "" : " ✗"}`;
      }).filter(Boolean);
      const rod = this.rodNote();
      return `Catch here: ${list.join(", ")}.${rod ? ` ${rod}` : ""}`;
    }
    return EXAMINE_OBJECT[obj.kind];
  }

  /** A nudge about the player's fishing rod: which one the game will reel with
   *  here (a better rod lands fish faster), and — if they own a finer rod they
   *  can't wield yet — the Fishing level that unlocks it. Empty if they carry no
   *  rod at all (the catch attempt itself warns about that). */
  private rodNote(): string {
    const { content } = this.bridge;
    const player = this.bridge.state.player;
    const fl = player.skills.fishing?.level ?? 1;
    const owned: ItemId[] = [];
    if (player.equipment.mainhand) owned.push(player.equipment.mainhand);
    for (const s of player.inventory) if (s) owned.push(s.item);
    const rods = owned
      .map((id) => content.items[id])
      .filter((d): d is NonNullable<typeof d> => !!d && d.tool === "rod");
    if (rods.length === 0) return "";

    const reqOf = (id: ItemId): number => equipRequirement(content, id)?.level ?? 1;
    const usable = rods.filter((d) => fl >= reqOf(d.id));
    const best = usable.sort((a, b) => (b.tier ?? 1) - (a.tier ?? 1))[0];
    // A finer rod the player owns but can't yet wield — name what unlocks it.
    const locked = rods
      .filter((d) => fl < reqOf(d.id) && (d.tier ?? 1) > (best?.tier ?? 0))
      .sort((a, b) => (a.tier ?? 1) - (b.tier ?? 1))[0];

    if (!best) {
      return locked ? `Your ${locked.name} unlocks at Fishing ${reqOf(locked.id)}.` : "";
    }
    const head = `Reeling with your ${best.name}.`;
    return locked ? `${head} Your ${locked.name} unlocks at Fishing ${reqOf(locked.id)}.` : head;
  }

  /** A plain-English line telling the player what a monster is weak to. */
  private weaknessNote(stats: MonsterStats): string {
    const labels: Record<string, string> = {
      slash: "slashing", stab: "stabbing", crush: "crushing", ranged: "ranged", magic: "magic",
    };
    // A turning ward (wardshift) cycles its weakness as it falls — say so, and
    // in order, so the player knows to rotate style mid-fight.
    const ward = stats.mechanics?.find((m) => m.type === "wardshift");
    if (ward && ward.type === "wardshift" && ward.styles.length > 0) {
      const seq = ward.styles.map((s) => labels[s] ?? s).join(", then ");
      return `Its ward turns as it weakens — weak to ${seq}. Rotate your attack style to keep exploiting it.`;
    }
    const w = (stats.weakness ?? []).map((s) => labels[s] ?? s);
    if (w.length === 0) return "It has no obvious weakness.";
    const list = w.length === 1 ? w[0] : `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}`;
    return `Weak to ${list} attacks.`;
  }

  private tileType(tile: Vec2): TileType {
    const m = this.bridge.state.map;
    if (tile.x < 0 || tile.y < 0 || tile.x >= m.width || tile.y >= m.height) {
      return "grass";
    }
    return m.tiles[tile.y * m.width + tile.x]!;
  }

  private setMarker(tile: Vec2): void {
    this.marker = { x: tile.x, y: tile.y, born: performance.now() };
  }

  private walkTo(tile: Vec2): void {
    const player = this.bridge.state.player;
    if (!this.bridge.walkable(tile.x, tile.y)) {
      this.hud.log("You can't walk there.");
      return;
    }
    const path = findPath(this.bridge.walkable, player.pos, tile);
    if (path.length === 0) return; // already there, or unreachable
    this.setMarker(tile);
    this.dispatch({ type: "MOVE", path });
  }

  /**
   * Walk toward a tile picked on the minimap or world map. The exact tile might
   * be water/wall/off-map, so snap to the nearest walkable tile and path there.
   */
  walkToWorldTile(tile: Vec2): void {
    const target = this.nearestWalkable(tile);
    if (!target) {
      this.hud.log("You can't walk there.");
      return;
    }
    const path = findPath(this.bridge.walkable, this.bridge.state.player.pos, target);
    if (path.length === 0) {
      this.hud.log("There's no path there from here.");
      return;
    }
    this.setMarker(target);
    this.dispatch({ type: "MOVE", path });
  }

  /** The walkable tile nearest a target (spiral search, capped). */
  private nearestWalkable(tile: Vec2): Vec2 | null {
    const tx = Math.round(tile.x), ty = Math.round(tile.y);
    if (this.bridge.walkable(tx, ty)) return { x: tx, y: ty };
    for (let r = 1; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring only
          const x = tx + dx, y = ty + dy;
          if (this.bridge.walkable(x, y)) return { x, y };
        }
      }
    }
    return null;
  }

  private walkBeside(tile: Vec2): void {
    const player = this.bridge.state.player;
    const { path, reachable, alreadyAdjacent } = pathToAdjacent(
      this.bridge.walkable,
      player.pos,
      tile,
    );
    if (!reachable || alreadyAdjacent) return;
    this.setMarker(path[path.length - 1] ?? tile);
    this.dispatch({ type: "MOVE", path });
  }

  /** Is this NPC somebody you could try to rob? */
  private thieveMark(id: string): boolean {
    return this.bridge.content.thieveTargets.some((t) => t.id === id && t.kind === "pocket");
  }

  private interactObject(objId: string, tile: Vec2, mode?: "talk" | "shop" | "steal", synced = false): void {
    // Talking to Jacob is when the Golden Rod changes hands. Reconcile with the
    // shared board FIRST, so the trophy is only ever granted to the true global
    // record-holder — and stripped from a local champion since out-fished
    // elsewhere — instead of every client minting its own champion.
    if (!synced && objId === "pier_warden" && mode === "talk") {
      void this.syncPierBoard().finally(() => this.interactObject(objId, tile, mode, true));
      return;
    }
    const player = this.bridge.state.player;
    // Fighting a monster with a bow? Close only to bow-shot, not melee range.
    const obj = this.bridge.content.objects.find((o) => o.id === objId);
    const reach = obj?.kind === "monster" ? this.bowReach() : 0;
    if (reach > 0) {
      const { path, reachable } = pathToWithin(this.bridge.walkable, player.pos, tile, reach);
      if (!reachable) { this.hud.error("You can't reach that."); return; }
      this.setMarker(tile);
      this.tapFlash = { objId, born: performance.now() };
      this.dispatch({ type: "INTERACT", objId, path });
      return;
    }
    const { path, reachable } = pathToAdjacent(
      this.bridge.walkable,
      player.pos,
      tile,
    );
    if (!reachable) {
      this.hud.error("You can't reach that.");
      return;
    }
    this.setMarker(tile);
    this.tapFlash = { objId, born: performance.now() };
    this.dispatch({ type: "INTERACT", objId, path, ...(mode ? { mode } : {}) });
  }

  /** Tiles the player can engage from with their wielded bow (0 if not ranged).
   *  Mirrors COMBAT.rangedReach in the core. */
  private bowReach(): number {
    const main = this.bridge.state.player.equipment.mainhand;
    return main && this.bridge.content.items[main]?.ranged ? 5 : 0;
  }

  /** Is this NPC a shopkeeper (so a tap offers Talk vs Shop)? */
  private isShopkeeper(id: string): boolean {
    return this.bridge.content.shops.some((s) => s.npc === id);
  }

  /** The Talk / Shop / Walk menu for a shopkeeper, at screen (sx, sy). */
  private shopkeeperMenu(obj: WorldObjectDef, sx: number, sy: number): void {
    const tile = this.liveTile(obj);
    this.menu.show(sx, sy, obj.name, [
      { label: "Talk to", target: obj.name, tone: "action", onSelect: () => this.interactObject(obj.id, tile, "talk") },
      { label: "Shop with", target: obj.name, onSelect: () => this.interactObject(obj.id, tile, "shop") },
      { label: "Walk here", onSelect: () => this.walkBeside(tile) },
    ], this.examineObject(obj));
  }

  /** Is this NPC a bounty guide (so a tap offers Get-bounty vs Talk)? */
  private isBountyGuide(id: string): boolean {
    return !!this.bridge.content.objects.find((o) => o.id === id)?.bountyGuide;
  }

  /** The Bounty / Talk / Walk menu for a bounty guide, at screen (sx, sy). */
  private guideMenu(obj: WorldObjectDef, sx: number, sy: number): void {
    const tile = this.liveTile(obj);
    this.menu.show(sx, sy, obj.name, [
      { label: "Get a bounty from", target: obj.name, tone: "action", onSelect: () => this.interactObject(obj.id, tile) },
      { label: "Talk to", target: obj.name, onSelect: () => this.interactObject(obj.id, tile, "talk") },
      { label: "Walk here", onSelect: () => this.walkBeside(tile) },
    ], this.examineObject(obj));
  }

  /** The Delve Warden's menu: start a run, or hear the pitch. */
  private delveMenu(obj: WorldObjectDef, sx: number, sy: number): void {
    const tile = this.liveTile(obj);
    const running = !!this.bridge.state.delve;
    this.menu.show(sx, sy, obj.name, [
      {
        label: running ? "Restart the Delve" : "Enter the Delve",
        target: "four waves, one cache",
        tone: "action",
        onSelect: () => this.dispatch({ type: "START_DELVE" }),
      },
      { label: "Talk to", target: obj.name, onSelect: () => this.interactObject(obj.id, tile, "talk") },
      { label: "Walk here", onSelect: () => this.walkBeside(tile) },
    ], this.examineObject(obj));
  }
}
