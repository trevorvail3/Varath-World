/**
 * src/main.ts
 * -----------
 * The wiring. This is the ONLY place that connects a concrete core to the
 * client. Right now the core is local (it runs in the same browser tab), but
 * because the client only talks to it through the `CoreBridge` seam below,
 * a future multiplayer build can swap this out for a network connection that
 * sends the same intents to a server and receives the same state back — with
 * NO changes to the core or the client (that's the whole point of RULE 2).
 *
 * Startup flow: a local "log in" screen picks (or creates) a character account;
 * a new character goes through the colour creator first. Only then is the world
 * built and the chosen save laid onto it.
 */

import "./client/compat.ts"; // runtime polyfills — must load first
import "./style.css";
import { content, playerStart } from "./content/index.ts";
import type { Ctx, Intent } from "./core/types.ts";
import {
  applyIntent,
  buildWalkability,
  createWorld,
  stationActions,
  tick,
} from "./core/worldCore.ts";
import { hydratePlayer, serializePlayer } from "./core/save.ts";
import { ContextMenu } from "./client/contextMenu.ts";
import { Dialogue } from "./client/dialogue.ts";
import { Guide } from "./client/guide.ts";
import { Tutorial } from "./client/tutorial.ts";
import { Intro } from "./client/intro.ts";
import { Primer } from "./client/primer.ts";
import { Game, type CoreBridge } from "./client/loop.ts";
import { Hud } from "./client/hud.ts";
import {
  clearAllSaves,
  listAccounts,
  readSave,
  readSaveFor,
  setCurrentAccount,
  writeSave,
} from "./client/storage.ts";
import { CharacterCreator, type CreatedCharacter } from "./client/characterCreator.ts";
import * as avatarArt from "./client/avatar.ts";
import { drawHumanoid, drawNpc } from "./client/render.ts";
import { humanoidKit } from "./client/monsterKit.ts";
import { DEFAULT_APPEARANCE } from "./client/avatar.ts";
import { resolveGear } from "./client/gearLook.ts";
import { isNameAvailable, reserveName } from "./client/nameRegistry.ts";
import { LoginUI } from "./client/loginUI.ts";
import { currentUser, signOut } from "./client/supabase.ts";
import { submitCurrent } from "./client/social.ts";
import { audio } from "./client/audio.ts";
import { ping, setStateProvider } from "./client/ops.ts";
import { founderEntitled, loadFounderEntitlement, maybeShowFounderClaim } from "./client/founder.ts";
import { loadCloud, saveCloud, deleteCloud } from "./client/cloudSave.ts";

// The opening atmosphere lines — mood first, mechanics never. Framed as legend
// (never stated as fact) to honour the world's load-bearing ambiguity.
const INTRO_LINES = [
  "They say there were Two, before the world began. One perished — and the stone, the river, the mountain are his body still, and remember being a god.",
  "The other remained: the pale moon, who watches — and will not say what she did, or why.",
  "You come to the Knuckle Hills with empty hands, and a road that asks only that you walk it.",
];

// Test seam (?test=1), armed before the sign-in screen so an automated run can
// verify the theme really sounds on the very first screen.
if (new URLSearchParams(location.search).has("test")) {
  (window as unknown as Record<string, unknown>)["__varathAudio"] = audio;
}

// --- The client supplies time + randomness (the core never does). ---
// `now` is monotonic (resets per reload); `epoch` is wall-clock, for farming.
function ctxAt(nowMs: number): Ctx {
  return { now: nowMs, rng: Math.random, epoch: Date.now() };
}

/** Automated-run flag: skips the sign-in gate and the opening cinematics, and
 *  opens the `__varath` handle so a script can drive real intents. Read once so
 *  every check agrees. */
const TEST_MODE = new URLSearchParams(location.search).has("test");
/** `?test=creator` stops at the character creator instead of walking past it,
 *  so the screenshot tour can photograph the screen the automated boot exists
 *  to skip. Any other `?test` value boots straight into the world as before. */
const TEST_CREATOR = new URLSearchParams(location.search).get("test") === "creator";

// --- Grab the page elements up front. ---
const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const hudRoot = document.getElementById("hud") as HTMLElement | null;
const app = document.getElementById("app") as HTMLElement | null;
if (!canvas || !hudRoot || !app) {
  throw new Error("Missing #game / #hud / #app elements in index.html");
}

// The contact-sheet seam. `tools/sheet.ts` draws the figure in every hair style,
// every facing, every build and a few gear loadouts onto one page — the only way
// to see at a glance that two styles have collapsed onto the same silhouette.
// The sheet's layout lives in the tool, not in the game; all the game has to do
// is hand over the art module. Test builds only.
if (TEST_MODE) {
  (window as unknown as Record<string, unknown>)["__varathArt"] = {
    ...avatarArt, resolveGear, content,
    // The OTHER two humanoid stacks. The player has had a contact sheet since
    // the character pass; the townsfolk and the sixty humanoid foes have never
    // been visible at a size where a silhouette can be judged at all.
    drawNpc, drawHumanoid, humanoidKit,
  };
}

// --- Sign-in gate: you must be signed in (same account as the idle game)
//     before reaching character creation or your save. A live session is kept
//     in localStorage, so returning visitors skip straight past the login. ---
function start(): void {
  audio.setMode("menu"); // the Varath theme plays over the menus
  // Test seam (?test=1): skip the sign-in gate entirely and boot a purely local
  // character. Automated screenshot runs need a deterministic, one-step start;
  // the same flag also opens the `__varath` handle at the end of boot().
  if (TEST_MODE) { playOffline(); return; }
  if (currentUser()) { void afterLogin(); return; }
  new LoginUI(app!, () => void afterLogin(), playOffline);
}

// --- Offline play: a purely local character (its own save slot, never synced).
//     Lets the downloadable single-file build — or anyone without an account —
//     play with progress kept in this browser. cloudReady=false so boot never
//     touches the cloud. ---
const OFFLINE_ACCOUNT = "__offline__";
function playOffline(): void {
  setCurrentAccount(OFFLINE_ACCOUNT);
  if (readSave()) { boot(null, false); return; }
  // An automated run has nobody to work the colour creator, so it gets the
  // default look under a fixed name — unless the run is here to look AT the
  // creator, in which case it stops on it.
  if (TEST_MODE && !TEST_CREATOR) { boot({ ...DEFAULT_APPEARANCE, name: "Testwalker" }, false); return; }
  new CharacterCreator(app!, { takenNames: [], onCreate: (c) => boot(c, false) });
}

// --- Cloud-first load: a character follows the account to any device.
//     The cloud row is the source of truth; the local save is a fast mirror /
//     offline fallback. We are careful NEVER to overwrite the cloud after a
//     failed (offline) read, so a flaky connection can't wipe a real save. ---
async function afterLogin(): Promise<void> {
  const user = currentUser();
  if (!user) { start(); return; }

  // A character made on this device before cloud saves existed (keyed by name).
  const priorNames = listAccounts().filter((n) => n !== user.id);
  const priorSave = priorNames.length > 0 ? readSaveFor(priorNames[0]!) : null;

  setCurrentAccount(user.id); // saves now target this account's slot

  const cloud = await loadCloud();
  await loadFounderEntitlement(); // supporter status for this account (fail-silent)

  // Cloud unreachable — its state is unknown. Play from a local copy if we have
  // one (cloudReady=false: we won't push and risk clobbering), else ask to retry.
  if (!cloud.ok) {
    const local = readSave() ?? priorSave;
    if (local) {
      if (!readSave()) writeSave(local);
      boot(null, false);
    } else {
      showCloudRetry();
    }
    return;
  }

  // Cloud has a save: it wins. Mirror it locally and play.
  if (cloud.data) {
    writeSave(cloud.data);
    boot(null, true);
    return;
  }

  // Cloud reached but empty. Migrate this device's existing character up, or
  // start a brand-new one.
  if (priorSave) {
    writeSave(priorSave);
    boot(null, true); // boot's first cloud push uploads it
    return;
  }
  new CharacterCreator(app!, {
    takenNames: [],
    checkName: isNameAvailable,
    reserveName,
    onCreate: (c) => boot(c, true),
  });
}

// --- Shown only when the cloud can't be reached and there's nothing local to
//     fall back to: starting fresh here could overwrite a save we just couldn't
//     see, so we ask the player to reconnect instead. ---
function showCloudRetry(): void {
  const back = document.createElement("div");
  back.className = "login-backdrop";
  back.innerHTML = `
    <div class="login-box">
      <div class="login-title">VARATH</div>
      <div class="login-sub">Couldn't reach your saved world.</div>
      <div class="login-msg">Check your connection — we won't start a new character while your cloud save is out of reach.</div>
      <button class="login-go" type="button">Retry</button>
    </div>`;
  (back.querySelector(".login-go") as HTMLElement).addEventListener(
    "click", () => window.location.reload(),
  );
  app!.appendChild(back);
}

// --- Build the world for the chosen account and start playing.
//     `cloudReady` is true only when we've confirmed the cloud's state this
//     session; cloud writes are gated on it so an offline start can't clobber. ---
function boot(newChar: CreatedCharacter | null, cloudReady: boolean): void {
  const startNow = performance.now();
  const state = createWorld(content, playerStart, ctxAt(startNow));

  // Lay any saved progress back onto the fresh world (ignored if missing).
  const restored = hydratePlayer(state, content, readSave());
  // A brand-new character stamps its full look (name, colours, styles).
  if (newChar) {
    const { mode, ...look } = newChar;
    state.player.appearance = { ...look };
    // The account mode is chosen once, at creation, and only here.
    if (mode && mode !== "standard") state.player.mode = mode;
  }

  // Founder entitlement → the "founder" flag (server-authoritative; see
  // FOUNDER.md). Purely cosmetic; the one-time claim window opens after start.
  if (founderEntitled() && !state.player.flags.includes("founder")) {
    state.player.flags.push("founder");
  }

  // Walkability depends on story flags (a quest can remove a barrier — e.g. the
  // pier gate). Rebuild it whenever the flag set changes so a gate opens the
  // moment its quest completes, without a reload. Built AFTER hydrate so a loaded
  // save's flags are already in place. Creature/seal changes are handled live
  // inside the walkable function, so only flag changes need a rebuild.
  let walkImpl = buildWalkability(content, state);
  let walkFlags = state.player.flags.length;
  const walkable = (x: number, y: number): boolean => {
    if (state.player.flags.length !== walkFlags) {
      walkImpl = buildWalkability(content, state);
      walkFlags = state.player.flags.length;
    }
    return walkImpl(x, y);
  };

  const bridge: CoreBridge = {
    state,
    content,
    walkable,
    stationRecipes(station) {
      return stationActions(content, station);
    },
    send(intent: Intent) {
      return applyIntent(state, content, intent, ctxAt(performance.now()));
    },
    tick(nowMs: number) {
      return tick(state, content, ctxAt(nowMs));
    },
  };

  // Once wiped, no autosave may run again this session — otherwise the reload's
  // own `pagehide` would re-serialise the player and resurrect the cleared save.
  let wiped = false;

  // Reset wipes the character for good — every local save on this device AND
  // the cloud — then returns to the login screen. We clear ALL local slots (not
  // just the active one) because cloud-save migration can leave an old copy that
  // would otherwise be re-adopted on reload, silently undoing the reset.
  const resetProgress = (): void => {
    const ok = window.confirm(
      "Reset this character? This erases their skills, levels and pack for good.",
    );
    if (!ok) return;
    wiped = true;
    clearAllSaves();
    const done = (): void => window.location.reload();
    // Delete the cloud copy too, or the next sign-in would restore it. Harmless
    // if there's nothing there.
    if (currentUser()) void deleteCloud().then(done, done);
    else done();
  };

  const menu = new ContextMenu(app!);
  const guide = new Guide(app!, content);
  const tutorial = new Tutorial(app!);
  let game: Game;
  const dispatch = (intent: Intent): void => game.dispatch(intent);
  // `game` is assigned just below; the slider may read zoom during Hud build,
  // so guard until the loop exists (the HUD re-syncs the slider each frame).
  // Sign out: persist first (local + cloud) so progress is safe, then drop the
  // session and return to the login screen.
  const signOutAndReturn = (): void => {
    persist(false);
    const done = (): void => { signOut(); window.location.reload(); };
    if (cloudReady && !wiped) void cloudPersist().then(done, done);
    else done();
  };

  // Idle logout: after 5 minutes with no input, save and return to the login
  // screen (handy on shared devices). Any tap/key/scroll resets the clock.
  const IDLE_MS = 5 * 60 * 1000;
  let lastActivity = Date.now();
  const bumpActivity = (): void => { lastActivity = Date.now(); };
  for (const ev of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(ev, bumpActivity, { passive: true });
  }
  window.setInterval(() => {
    if (!wiped && currentUser() && Date.now() - lastActivity >= IDLE_MS) signOutAndReturn();
  }, 20000);

  const hud = new Hud(hudRoot!, content, resetProgress, menu, dispatch, {
    get: () => game?.getZoom() ?? 1,
    set: (z) => game?.setZoom(z),
  }, () => new Primer(app!, () => {}, true), signOutAndReturn, {
    get: () => game?.getDrawDist() ?? 40,
    set: (d) => game?.setDrawDist(d),
  }, {
    get: () => game?.getLootLabels() ?? true,
    set: (v) => game?.setLootLabels(v),
  }, (slot, item) => game?.beginUseItem(slot, item));
  const dialogue = new Dialogue(app!);
  game = new Game(canvas!, bridge, hud, dialogue, app!, menu, guide, tutorial);
  // Route sent chat lines to the world so they float over the player's head, and
  // arriving nearby players' lines over their ghost.
  hud.onLocalSay = (text: string) => game.showSpeech(text);
  hud.onRemoteSay = (name: string, text: string) => game.showGhostSpeech(name, text);
  hud.nearbyPlayers = () => game.hasNearbyPlayers();

  // A discreet "Saved" flash so the player knows progress persists on its own.
  const saveTag = document.createElement("div");
  saveTag.className = "save-tag";
  saveTag.textContent = "Saved";
  hudRoot!.appendChild(saveTag);

  // Local autosave: periodically and whenever the tab is hidden.
  const persist = (showTag = false): void => {
    if (wiped) return;
    writeSave(serializePlayer(state));
    if (showTag) {
      saveTag.classList.remove("show");
      void saveTag.offsetWidth; // restart the fade
      saveTag.classList.add("show");
    }
  };

  // Cloud sync: push the save up so the character follows the account. Gated on
  // cloudReady (only when we've confirmed the cloud's state) so an offline start
  // can never overwrite a real save. Runs less often than the local autosave.
  let cloudInFlight = false;
  const cloudPersist = async (): Promise<void> => {
    if (!cloudReady || wiped || cloudInFlight) return;
    cloudInFlight = true;
    try {
      await saveCloud(serializePlayer(state), state.player.appearance.name);
      // Keep the shared hiscores board live as you play — not only when you
      // happen to open it. No-ops when signed out (reads stay public).
      await submitCurrent(content);
    }
    finally { cloudInFlight = false; }
  };

  window.setInterval(() => persist(true), 4000);
  window.setInterval(() => void cloudPersist(), 30000);
  window.addEventListener("pagehide", () => { persist(false); void cloudPersist(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { persist(false); void cloudPersist(); }
  });

  // Write an immediate save so a brand-new character's name and colours survive
  // a quit inside the first autosave window (4s) — locally and (if migrating a
  // local character or starting fresh) to the cloud.
  persist();
  void cloudPersist();

  audio.setMode("world"); // theme fades; the region's ambience takes over
  game.start();
  // Launch ops: a one-line state snapshot rides on bug reports, and one
  // session ping per page load charts daily players (fail-silent; see
  // server/ops.sql for the tables).
  setStateProvider(() => {
    const p = state.player;
    return {
      name: p.appearance.name,
      pos: { x: Math.round(p.pos.x), y: Math.round(p.pos.y) },
      hp: `${p.hp}/${p.maxHp}`,
      gold: p.gold,
      activity: p.activity.kind,
      questsDone: p.questsDone.length,
      skills: Object.fromEntries(Object.entries(p.skills).map(([k, v]) => [k, (v as { level: number }).level])),
    };
  });
  ping("session_start");
  // Test seam (?test=1): expose the live pieces so an automated gameplay run
  // can drive real intents and assert on what the player would hear/see.
  if (TEST_MODE) {
    (window as unknown as Record<string, unknown>)["__varath"] = {
      game, bridge, audio, content,
      teleport: (x: number, y: number) => game.teleport(x, y),
    };
  }

  const enter = (): void => {
    hud.log(
      restored
        ? `Welcome back, ${state.player.appearance.name}. The hills are as you left them.`
        : `You set foot on the Knuckle Hills, ${state.player.appearance.name}. An old man waves from the clearing.`,
    );
    // Start (or resume) the opening coach — start() self-guards on graduation
    // and on "looks advanced", so a player who quit mid-first-quest gets the
    // coach back, while veterans never see it again (Tier-0 fix).
    if (!TEST_MODE) guide.start(state.player);
    // The First Steps checklist — a brand-new hero's guided tutorial. Self-guards
    // on completion and on "looks advanced", so it runs exactly once.
    if (!TEST_MODE) tutorial.start(state.player);
    // A founder's one-time cache window — after the intro/primer, once the
    // player is actually standing in the world.
    if (!TEST_MODE) maybeShowFounderClaim(app!, state, dispatch);
  };
  // New characters get the atmosphere intro, then the controls primer, then the
  // world (where the contextual guide takes over). Returning players drop in.
  // An automated run wants the world, not the cinematics.
  if (restored || TEST_MODE) enter();
  else new Intro(app!, INTRO_LINES, () => new Primer(app!, enter));
}

start();
