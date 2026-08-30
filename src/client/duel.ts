/**
 * src/client/duel.ts
 * ------------------
 * The duel session: challenge → stake barter → lockstep fight → settlement.
 *
 * TRANSPORT. Duel messages are tiny JSON packets moved by a pluggable
 * `DuelTransport`. Two are provided:
 *   - LocalDuelTransport: a BroadcastChannel — two tabs (or windows) on the
 *     same machine duel with zero backend. It's also what the automated
 *     browser tests drive.
 *   - BusDuelTransport: a dead-simple Supabase message bus (one `duel_msgs`
 *     table, insert + poll — see server/SUPABASE.md). Used when signed in.
 * The session logic is identical over either pipe.
 *
 * TRUST MODEL. Same as live trading: each client applies only its OWN half of
 * the outcome (DUEL_STAKE / DUEL_RESOLVE intents), stakes are escrowed out of
 * the pack the moment both sides accept, and the fight itself is a lockstep
 * simulation (core/duelCore.ts) both machines run from a shared seed — so a
 * dishonest client can't fake a hit or a win without the honest side's sim
 * disagreeing, in which case the duel VOIDS and stakes come home. Closing the
 * game mid-duel forfeits your stake (enforced on next boot), so quitting is
 * never a way to keep it.
 */

import type { Content, Intent, ItemId, Player } from "../core/types.ts";
import {
  DUEL_MAX_TICKS, DUEL_TICK_MS, duelCreate, duelFormulasMatch, duelHash, duelSeed, duelStart, duelStep,
  fighterFingerprint,
  type DuelEvent, type DuelFighter, type DuelIntent, type DuelState,
} from "../core/duelCore.ts";
import { duelEquip, duelFighterFrom, duelStatsFor } from "../core/worldCore.ts";
import { currentUser, rest } from "./supabase.ts";

export interface StakeItem { item: ItemId; qty: number }
export interface StakeSide { gold: number; items: StakeItem[]; ok: boolean }

export type DuelMsg =
  | { k: "hello"; id: string; name: string; level: number }
  | { k: "challenge"; duelId: string; from: string; to: string; name: string }
  | { k: "respond"; duelId: string; from: string; accept: boolean }
  | { k: "offer"; duelId: string; from: string; gold: number; items: StakeItem[]; rev: number }
  | { k: "confirm"; duelId: string; from: string; rev: number; fighter: DuelFighter }
  | { k: "ticks"; duelId: string; from: string; through: number; intents: [number, DuelIntent][]; hash?: [number, number] }
  | { k: "cancel"; duelId: string; from: string };

export interface DuelTransport {
  send(msg: DuelMsg): void;
  onMsg(cb: (msg: DuelMsg) => void): void;
  close(): void;
}

/** Two tabs on one machine: a BroadcastChannel is the whole backend. */
export class LocalDuelTransport implements DuelTransport {
  private ch: BroadcastChannel;
  private cbs: ((m: DuelMsg) => void)[] = [];
  constructor() {
    this.ch = new BroadcastChannel("varath-duel");
    this.ch.onmessage = (e) => { for (const cb of this.cbs) cb(e.data as DuelMsg); };
  }
  send(msg: DuelMsg): void { this.ch.postMessage(msg); }
  onMsg(cb: (m: DuelMsg) => void): void { this.cbs.push(cb); }
  close(): void { this.ch.close(); }
}

/** Signed-in players: a tiny insert+poll message bus on Supabase (RLS-guarded;
 *  see server/SUPABASE.md §Duels). Poll cadence ~1.2s — plenty for 600ms game
 *  ticks resolved two ticks behind. */
export class BusDuelTransport implements DuelTransport {
  private cbs: ((m: DuelMsg) => void)[] = [];
  private lastId = 0;
  private timer = 0;
  private stopped = false;
  constructor() {
    const poll = async (): Promise<void> => {
      if (this.stopped) return;
      try {
        const res = await rest(`duel_msgs?select=id,payload&id=gt.${this.lastId}&order=id.asc&limit=60`);
        if (res.ok) {
          const rows = (await res.json()) as { id: number; payload: DuelMsg }[];
          for (const r of rows) {
            this.lastId = Math.max(this.lastId, r.id);
            for (const cb of this.cbs) cb(r.payload);
          }
        }
      } catch { /* offline blip — keep polling */ }
      this.timer = window.setTimeout(() => void poll(), 1200);
    };
    // Start from "now": fetch the current max id, then stream forward.
    void (async () => {
      try {
        const res = await rest(`duel_msgs?select=id&order=id.desc&limit=1`);
        if (res.ok) {
          const rows = (await res.json()) as { id: number }[];
          this.lastId = rows[0]?.id ?? 0;
        }
      } catch { /* start from 0 */ }
      void poll();
    })();
  }
  send(msg: DuelMsg): void {
    void rest("duel_msgs", { method: "POST", body: { payload: msg } }).catch(() => {});
  }
  onMsg(cb: (m: DuelMsg) => void): void { this.cbs.push(cb); }
  close(): void { this.stopped = true; window.clearTimeout(this.timer); }
}

export type DuelPhase =
  | "idle"
  | "challenged"   // someone asked me
  | "waiting"      // I asked someone
  | "staking"      // the barter screen
  | "countdown"
  | "fighting"
  | "over";

export interface DuelView {
  phase: DuelPhase;
  peers: { id: string; name: string; level: number }[];
  partnerName: string;
  mine: StakeSide;
  theirs: StakeSide;
  state: DuelState | null;
  me: DuelFighter | null;
  foe: DuelFighter | null;
  iAmA: boolean;
  events: DuelEvent[];       // this frame's presentation events
  countdownMs: number;
  result: "won" | "lost" | "draw" | "void" | null;
}

const PEER_STALE_MS = 6_000;
const HELLO_MS = 2_000;
const INTENT_DELAY = 2;      // my intents execute this many ticks in the future
const HASH_EVERY = 10;
const FORFEIT_MS = 25_000;   // silent partner mid-fight = they forfeit

/** The whole duel lifecycle for THIS client. The UI reads `view()` and calls
 *  the action methods; the session drives itself off transport messages and a
 *  600ms heart. */
export class DuelSession {
  private transport: DuelTransport;
  private myId: string;
  private peers = new Map<string, { name: string; level: number; at: number }>();
  private phase: DuelPhase = "idle";
  private duelId = "";
  private partnerId = "";
  private partnerName = "";
  private iAmA = false;
  private mine: StakeSide = { gold: 0, items: [], ok: false };
  private theirs: StakeSide = { gold: 0, items: [], ok: false };
  private rev = 0;
  private me: DuelFighter | null = null;
  private foe: DuelFighter | null = null;
  private state: DuelState | null = null;
  private myThrough = 0;               // last tick my intent stream covers
  private theirThrough = 0;
  private myIntents = new Map<number, DuelIntent[]>();
  private theirIntents = new Map<number, DuelIntent[]>();
  private queued: DuelIntent[] = [];   // actions pressed since the last beat
  private theirHashes = new Map<number, number>();
  private myHashes = new Map<number, number>();
  private frameEvents: DuelEvent[] = [];
  private result: DuelView["result"] = null;
  private countdownEnds = 0;
  private lastHeard = 0;
  private helloTimer = 0;
  private beatTimer = 0;
  private staked = false;

  constructor(
    private content: Content,
    private getPlayer: () => Player,
    private dispatch: (i: Intent) => void,
    private onChange: () => void,
    transport?: DuelTransport,
  ) {
    // Signed-in players meet over the bus; guests duel locally (same machine).
    this.transport = transport ?? (currentUser() ? new BusDuelTransport() : new LocalDuelTransport());
    this.myId = currentUser()?.id ?? `local-${Math.random().toString(36).slice(2, 10)}`;
    this.transport.onMsg((m) => this.onMsg(m));
  }

  /** Begin announcing at the ring (called when the duel board opens). */
  attend(): void {
    if (this.helloTimer) return;
    const hello = (): void => {
      const p = this.getPlayer();
      this.transport.send({ k: "hello", id: this.myId, name: p.appearance.name, level: levelOf(p) });
      this.prunePeers();
      this.helloTimer = window.setTimeout(hello, HELLO_MS);
    };
    hello();
  }

  /** Stop announcing (board closed, no live duel). */
  leave(): void {
    window.clearTimeout(this.helloTimer);
    this.helloTimer = 0;
  }

  view(): DuelView {
    this.prunePeers();
    const events = this.frameEvents;
    this.frameEvents = [];
    return {
      phase: this.phase,
      peers: [...this.peers.entries()].map(([id, p]) => ({ id, name: p.name, level: p.level })),
      partnerName: this.partnerName,
      mine: this.mine,
      theirs: this.theirs,
      state: this.state,
      me: this.me,
      foe: this.foe,
      iAmA: this.iAmA,
      events,
      countdownMs: Math.max(0, this.countdownEnds - performance.now()),
      result: this.result,
    };
  }

  // --- Actions the UI calls -------------------------------------------------
  challenge(peerId: string): void {
    if (this.phase !== "idle") return;
    const peer = this.peers.get(peerId);
    if (!peer) return;
    this.duelId = `${this.myId.slice(0, 8)}-${Date.now().toString(36)}`;
    this.partnerId = peerId;
    this.partnerName = peer.name;
    this.iAmA = true;
    this.phase = "waiting";
    this.transport.send({ k: "challenge", duelId: this.duelId, from: this.myId, to: peerId, name: this.getPlayer().appearance.name });
    this.onChange();
  }

  respond(accept: boolean): void {
    if (this.phase !== "challenged") return;
    this.transport.send({ k: "respond", duelId: this.duelId, from: this.myId, accept });
    if (accept) this.enterStaking();
    else this.reset();
    this.onChange();
  }

  setOffer(gold: number, items: StakeItem[]): void {
    if (this.phase !== "staking") return;
    const p = this.getPlayer();
    const g = Math.max(0, Math.min(p.gold, Math.floor(gold)));
    this.mine = { gold: g, items, ok: false };
    this.theirs.ok = false; // any change un-accepts both sides, trade-style
    this.rev += 1;
    this.transport.send({ k: "offer", duelId: this.duelId, from: this.myId, gold: g, items, rev: this.rev });
    this.onChange();
  }

  accept(): void {
    if (this.phase !== "staking" || this.mine.ok) return;
    this.mine.ok = true;
    this.me = duelFighterFrom(this.getPlayer(), this.content);
    this.transport.send({ k: "confirm", duelId: this.duelId, from: this.myId, rev: this.rev, fighter: this.me });
    this.maybeLock();
    this.onChange();
  }

  cancel(): void {
    if (this.phase === "idle") return;
    this.transport.send({ k: "cancel", duelId: this.duelId, from: this.myId });
    if (this.phase === "fighting" || this.phase === "countdown") this.finish(this.iAmA ? "b" : "a"); // walking out = losing
    else this.reset();
    this.onChange();
  }

  /** Queue a fight action (lands INTENT_DELAY ticks ahead, lockstep-style). */
  act(intent: DuelIntent): void {
    if (this.phase !== "fighting") return;
    this.queued.push(intent);
  }

  // --- Messages -------------------------------------------------------------
  private onMsg(m: DuelMsg): void {
    if (m.k === "hello") {
      if (m.id !== this.myId) this.peers.set(m.id, { name: m.name, level: m.level, at: performance.now() });
      return;
    }
    // Everything else is duel-scoped.
    if (m.k === "challenge") {
      if (m.to !== this.myId || this.phase !== "idle") return;
      this.duelId = m.duelId;
      this.partnerId = m.from;
      this.partnerName = m.name;
      this.iAmA = false;
      this.phase = "challenged";
      this.onChange();
      return;
    }
    if (m.duelId !== this.duelId || m.from !== this.partnerId) return;
    this.lastHeard = performance.now();
    switch (m.k) {
      case "respond":
        if (this.phase !== "waiting") return;
        if (m.accept) this.enterStaking();
        else { this.toastResult(null); this.reset(); }
        break;
      case "offer":
        if (this.phase !== "staking") return;
        this.theirs = { gold: m.gold, items: m.items, ok: false };
        this.mine.ok = false; // their change un-accepts me too
        this.rev = Math.max(this.rev, m.rev);
        break;
      case "confirm":
        if (this.phase !== "staking") return;
        if (m.rev !== this.rev) return; // stale accept — the offer moved on
        this.theirs.ok = true;
        this.foe = m.fighter;
        this.maybeLock();
        break;
      case "ticks":
        if (this.phase !== "fighting" && this.phase !== "countdown") return;
        for (const [tick, it] of m.intents) {
          const arr = this.theirIntents.get(tick) ?? [];
          arr.push(it);
          this.theirIntents.set(tick, arr);
        }
        this.theirThrough = Math.max(this.theirThrough, m.through);
        if (m.hash) this.theirHashes.set(m.hash[0], m.hash[1]);
        this.advance();
        break;
      case "cancel":
        if (this.phase === "fighting" || this.phase === "countdown") this.finish(this.iAmA ? "a" : "b"); // they walked = I win
        else { this.toastResult(null); this.reset(); }
        break;
    }
    this.onChange();
  }

  // --- Phase machinery -------------------------------------------------------
  private enterStaking(): void {
    this.phase = "staking";
    this.mine = { gold: 0, items: [], ok: false };
    this.theirs = { gold: 0, items: [], ok: false };
    this.rev = 0;
    this.lastHeard = performance.now();
  }

  private maybeLock(): void {
    if (!this.mine.ok || !this.theirs.ok || !this.me || !this.foe) return;
    // Refuse a duel between builds running different combat maths BEFORE anything
    // is escrowed: both clients simulate the fight in lockstep from the same
    // seed, so mismatched formulas would diverge mid-fight with real staked gold
    // on the line. Standing down before the stake is cleaner than voiding after.
    if (!duelFormulasMatch(this.me, this.foe)) {
      this.phase = "idle";
      this.result = "void";
      this.onChange();
      return;
    }
    // Both accepted the same revision: escrow my stake and start the count.
    this.dispatch({ type: "DUEL_STAKE", duelId: this.duelId, gold: this.mine.gold, items: this.mine.items });
    this.staked = true;
    this.state = duelCreate(duelSeed(this.duelId));
    const [a, b] = this.fightersAB();
    duelStart(this.state, a, b);
    this.myThrough = 0;
    this.theirThrough = 0;
    this.myIntents.clear();
    this.theirIntents.clear();
    this.myHashes.clear();
    this.theirHashes.clear();
    this.phase = "countdown";
    this.countdownEnds = performance.now() + 3000;
    this.beat(); // start the lockstep heart
  }

  /** Fighter A is always the CHALLENGER's — one shared ordering on both sims. */
  private fightersAB(): [DuelFighter, DuelFighter] {
    return this.iAmA ? [this.me!, this.foe!] : [this.foe!, this.me!];
  }

  /** The 600ms heart: stamp my queued intents onto a future tick, tell the
   *  other side how far my stream reaches, and advance the shared sim. */
  private beat(): void {
    window.clearTimeout(this.beatTimer);
    if (this.phase !== "fighting" && this.phase !== "countdown") return;
    if (this.phase === "countdown" && performance.now() >= this.countdownEnds) this.phase = "fighting";
    if (this.phase === "fighting") {
      const target = this.myThrough + 1;
      const at = target + INTENT_DELAY;
      if (this.queued.length) {
        this.myIntents.set(at, [...(this.myIntents.get(at) ?? []), ...this.queued]);
      }
      const send: [number, DuelIntent[]] | null = this.queued.length ? [at, this.queued] : null;
      this.queued = [];
      this.myThrough = target;
      const hashTick = this.state && this.state.tick > 0 && this.state.tick % HASH_EVERY === 0 ? this.state.tick : null;
      this.transport.send({
        k: "ticks", duelId: this.duelId, from: this.myId, through: this.myThrough,
        intents: send ? send[1].map((i) => [send[0], i] as [number, DuelIntent]) : [],
        ...(hashTick !== null && this.state ? { hash: [hashTick, this.myHashes.get(hashTick) ?? this.frameHash()] as [number, number] } : {}),
      });
      this.advance();
      // A silent partner forfeits: no packets for FORFEIT_MS mid-fight.
      if (performance.now() - this.lastHeard > FORFEIT_MS) {
        this.finish(this.iAmA ? "a" : "b");
        return;
      }
    }
    this.beatTimer = window.setTimeout(() => this.beat(), DUEL_TICK_MS);
    this.onChange();
  }

  /** The desync fingerprint: the replicated state plus both fighters' live
   *  stats (so a gear swap that diverges between clients is caught). */
  private frameHash(): number {
    if (!this.state) return 0;
    const [a, b] = this.fightersAB();
    return duelHash(this.state) ^ fighterFingerprint(a) ^ Math.imul(fighterFingerprint(b), 31);
  }

  /** Step the sim for every tick BOTH intent streams cover. */
  private advance(): void {
    const st = this.state;
    if (!st || this.phase !== "fighting") return;
    const [a, b] = this.fightersAB();
    while (!st.over && st.tick < Math.min(this.myThrough, this.theirThrough) + INTENT_DELAY && st.tick < DUEL_MAX_TICKS) {
      const next = st.tick + 1;
      // My intents live under my (mine) map; map both onto the shared a/b order.
      const myAt = this.myIntents.get(next) ?? [];
      const theirAt = this.theirIntents.get(next) ?? [];
      const aAt = this.iAmA ? myAt : theirAt;
      const bAt = this.iAmA ? theirAt : myAt;
      // Gear swaps resolve in the same a-then-b order as duelStep, BEFORE the
      // tick's swings — so this tick's blow uses the new weapon. duelStep only
      // reads eat/spec (it ignores equip intents), so the fighter mutation here
      // is the whole of the swap. Both clients recompute from identical kits.
      this.applyEquips("a", a, next, aAt);
      this.applyEquips("b", b, next, bAt);
      const evs = duelStep(st, { a, b }, { a: aAt, b: bAt });
      this.frameEvents.push(...evs);
      if (st.tick % HASH_EVERY === 0) {
        const h = duelHash(st) ^ fighterFingerprint(a) ^ Math.imul(fighterFingerprint(b), 31);
        this.myHashes.set(st.tick, h);
        const theirs = this.theirHashes.get(st.tick);
        if (theirs !== undefined && theirs !== h) { this.voidDuel(); return; }
      }
    }
    if (st.over) this.finish(st.winner);
  }

  /** Apply this side's gear-swap intents for a tick, recomputing its stats. */
  private applyEquips(side: "a" | "b", fighter: DuelFighter, tick: number, intents: DuelIntent[]): void {
    for (const it of intents) {
      if (it.t !== "equip") continue;
      const res = duelEquip(fighter.bench, fighter.equipment, fighter.kit, it.item, this.content);
      if (!res) continue;
      fighter.bench = res.bench;
      fighter.equipment = res.equipment;
      const s = duelStatsFor(fighter.kit, fighter.equipment, this.content);
      fighter.acc = s.acc; fighter.dmg = s.dmg; fighter.def = s.def;
      fighter.speedTicks = s.speedTicks; fighter.ranged = s.ranged;
      this.frameEvents.push({ tick, side, kind: "equip", item: it.item });
    }
  }

  /** Any desync = nobody's fight: both stakes come home. */
  private voidDuel(): void {
    this.result = "void";
    this.settle("void");
    this.phase = "over";
    this.onChange();
  }

  private finish(winner: "a" | "b" | null): void {
    if (this.phase === "over") return;
    const mySide = this.iAmA ? "a" : "b";
    this.result = winner === null ? "draw" : winner === mySide ? "won" : "lost";
    this.settle(this.result);
    this.phase = "over";
    this.onChange();
  }

  private settle(outcome: "won" | "lost" | "draw" | "void"): void {
    if (!this.staked) { this.reset(); return; }
    const st = this.state;
    const mySideState = st ? (this.iAmA ? st.a : st.b) : null;
    const eaten = new Map<ItemId, number>();
    for (const e of mySideState?.eaten ?? []) eaten.set(e.item, (eaten.get(e.item) ?? 0) + e.count);
    this.dispatch({
      type: "DUEL_RESOLVE",
      duelId: this.duelId,
      outcome,
      ...(outcome === "won" ? { winnings: { gold: this.theirs.gold, items: this.theirs.items } } : {}),
      foodEaten: [...eaten.entries()].map(([item, qty]) => ({ item, qty })),
    });
    this.staked = false;
  }

  /** Clear the "over" card back to the ring. */
  dismiss(): void {
    if (this.phase === "over") this.reset();
    this.onChange();
  }

  private toastResult(result: DuelView["result"]): void { this.result = result; }

  private reset(): void {
    window.clearTimeout(this.beatTimer);
    this.phase = "idle";
    this.duelId = "";
    this.partnerId = "";
    this.partnerName = "";
    this.mine = { gold: 0, items: [], ok: false };
    this.theirs = { gold: 0, items: [], ok: false };
    this.me = null;
    this.foe = null;
    this.state = null;
    this.result = null;
    this.staked = false;
    this.queued = [];
  }

  private prunePeers(): void {
    const now = performance.now();
    for (const [id, p] of this.peers) if (now - p.at > PEER_STALE_MS) this.peers.delete(id);
  }
}

function levelOf(p: Player): number {
  // combat level lives in the core; a cheap mirror avoids an import cycle here.
  const s = p.skills;
  return Math.max(3, Math.round(
    ((s.edge?.level ?? 1) + (s.vigour?.level ?? 1) + (s.ward?.level ?? 1) + (s.vitality?.level ?? 1)) / 2,
  ));
}
