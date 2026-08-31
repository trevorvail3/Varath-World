/**
 * src/client/duelUI.ts
 * --------------------
 * The Duel Ring window, driven entirely by DuelSession.view(): the ringside
 * list of who's attending, the challenge handshake, the stake BARTER screen
 * (gold + items on both sides, unbalanced offers welcome — that's the fun),
 * and the fight itself: both real avatars toe-to-toe with HP bars, hit splats,
 * and the three buttons that matter (Eat, Special, Forfeit).
 */

import type { Content, Intent, ItemId, Player } from "../core/types.ts";
import type { DuelEvent } from "../core/duelCore.ts";
import { DuelSession, type DuelTransport, type StakeItem } from "./duel.ts";
import { itemIconSVG } from "./itemIcon.ts";
import { iconize } from "./glyph.ts";
import { drawAvatar, withDefaults } from "./avatar.ts";
import { resolveGear } from "./gearLook.ts";
import { askAmount } from "./prompt.ts";

interface Splat { side: "a" | "b"; text: string; color: string; born: number }

export class DuelUI {
  private backdrop: HTMLElement;
  private modal: HTMLElement;
  private session: DuelSession;
  private open = false;
  private lastPhase = "idle";
  private lastLobbySig = "";
  private lastKitSig = "";
  private splats: Splat[] = [];
  private raf = 0;

  constructor(
    root: HTMLElement,
    private content: Content,
    private getPlayer: () => Player,
    dispatch: (i: Intent) => void,
    transport?: DuelTransport,
  ) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "duel-backdrop hidden";
    this.modal = document.createElement("div");
    this.modal.className = "duel-modal";
    this.backdrop.appendChild(this.modal);
    root.appendChild(this.backdrop);
    this.session = new DuelSession(content, getPlayer, dispatch, () => this.render(), transport);
    this.backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === this.backdrop && this.canDismiss()) this.close();
    });
  }

  /** A challenge can land while the window is closed — pop it open. Called
   *  every frame by the game loop; view() drains events, so route them to the
   *  splat queue here too or a frame-timed drain would swallow them. */
  tick(): void {
    const v = this.session.view();
    for (const e of v.events) this.pushSplat(e);
    if (!this.open && (v.phase === "challenged" || v.phase === "staking")) this.show();
    // The ringside roster grows as `hello` pings arrive — but those don't fire
    // onChange (they're too chatty to re-render on). Refresh the lobby here only
    // when the peer set actually changes, so a new duellist appears without
    // rebuilding the panel (and dropping a click) every frame.
    if (this.open && v.phase === "idle") {
      const p = this.getPlayer();
      const sig = `${v.peers.map((pe) => pe.id).sort().join(",")}|${p.stats.duelWins ?? 0}|${p.stats.duelLosses ?? 0}`;
      if (sig !== this.lastLobbySig) { this.lastLobbySig = sig; this.renderLobby(v.peers); }
    }
  }

  show(): void {
    this.open = true;
    this.lastLobbySig = ""; // force the first tick to paint the current roster
    this.backdrop.classList.remove("hidden");
    this.session.attend();
    this.render();
  }

  close(): void {
    if (!this.canDismiss()) return; // never silently walk out of a live fight
    this.open = false;
    this.backdrop.classList.add("hidden");
    this.session.leave();
    cancelAnimationFrame(this.raf);
  }

  private canDismiss(): boolean {
    const p = this.session.view().phase;
    return p === "idle" || p === "over";
  }

  private render(): void {
    if (!this.open) { this.tick(); if (!this.open) return; }
    const v = this.session.view();
    for (const e of v.events) this.pushSplat(e);
    if (v.phase !== this.lastPhase) { this.lastPhase = v.phase; this.splats = []; }

    switch (v.phase) {
      case "idle": this.renderLobby(v.peers); break;
      case "challenged": this.renderPrompt(`${v.partnerName} challenges you to a staked duel!`, true); break;
      case "waiting": this.renderPrompt(`Waiting for ${v.partnerName} to answer…`, false); break;
      case "staking": this.renderStakes(v); break;
      case "countdown":
      case "fighting": this.renderFight(v); break;
      case "over": this.renderOver(v); break;
    }
  }

  // --- Ringside lobby --------------------------------------------------------
  private renderLobby(peers: { id: string; name: string; level: number }[]): void {
    const p = this.getPlayer();
    const w = p.stats.duelWins ?? 0;
    const l = p.stats.duelLosses ?? 0;
    this.modal.innerHTML = `
      <div class="duel-head">
        <span class="duel-title">${iconize("⚔️")} The Duel Ring</span>
        <span class="duel-record" title="Your duel record">${w}W · ${l}L</span>
        <button class="duel-close" type="button">✕</button>
      </div>
      <div class="duel-sub">Opt-in, stakes on the line: gold, gear — any barter both sides accept. Winner takes both purses.</div>
      <div class="duel-peers">${peers.length
        ? peers.map((pe) => `
          <div class="duel-peer">
            <span class="duel-peer-name">${escapeHtml(pe.name)}</span>
            <span class="duel-peer-lvl">${iconize("⚔️")} ${pe.level}</span>
            <button class="duel-btn challenge" data-id="${escapeHtml(pe.id)}" type="button">Challenge</button>
          </div>`).join("")
        : `<div class="duel-empty">No one is at the ring right now. Duellists appear here the moment they step up.</div>`}
      </div>`;
    this.modal.querySelector(".duel-close")!.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.close(); });
    this.modal.querySelectorAll(".challenge").forEach((b) => b.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.session.challenge((b as HTMLElement).dataset["id"]!);
    }));
  }

  private renderPrompt(text: string, answerable: boolean): void {
    this.modal.innerHTML = `
      <div class="duel-head"><span class="duel-title">${iconize("⚔️")} The Duel Ring</span></div>
      <div class="duel-ask">${escapeHtml(text)}</div>
      <div class="duel-actions">${answerable
        ? `<button class="duel-btn accept" type="button">Accept</button>
           <button class="duel-btn dim decline" type="button">Decline</button>`
        : `<button class="duel-btn dim cancelw" type="button">Withdraw</button>`}
      </div>`;
    this.modal.querySelector(".accept")?.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.session.respond(true); });
    this.modal.querySelector(".decline")?.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.session.respond(false); });
    this.modal.querySelector(".cancelw")?.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.session.cancel(); });
  }

  // --- The barter screen ------------------------------------------------------
  private renderStakes(v: ReturnType<DuelSession["view"]>): void {
    const player = this.getPlayer();
    const ok = (on: boolean): string => `<span class="trade-ok${on ? " on" : ""}">${on ? "✓ Accepted" : "Not accepted"}</span>`;
    this.modal.innerHTML = `
      <div class="duel-head">
        <span class="duel-title">${iconize("⚔️")} Stakes — vs ${escapeHtml(v.partnerName)}</span>
        <button class="duel-close" type="button">✕</button>
      </div>
      <div class="duel-sub">Whatever both of you accept is the wager — even sides optional. Winner takes it all.</div>
      <div class="trade-cols">
        <div class="trade-side">
          <div class="trade-side-head">Your stake ${ok(v.mine.ok)}</div>
          <div class="trade-offer mine"></div>
          <div class="trade-gold-row">
            <span class="trade-gold-coin">${iconize("🪙")}</span>
            <input class="trade-gold-input" type="number" min="0" inputmode="numeric" value="${v.mine.gold}" />
            <span class="trade-gold-g">gold</span>
          </div>
        </div>
        <div class="trade-side">
          <div class="trade-side-head">${escapeHtml(v.partnerName)}'s stake ${ok(v.theirs.ok)}</div>
          <div class="trade-offer theirs"></div>
          <div class="trade-gold-row static"><span class="trade-gold-coin">${iconize("🪙")}</span><span>${v.theirs.gold.toLocaleString()}</span><span class="trade-gold-g">gold</span></div>
        </div>
      </div>
      <div class="trade-pack-head">Your pack — tap to stake</div>
      <div class="trade-pack"></div>
      <div class="trade-foot">
        <span class="trade-status">${v.mine.ok && !v.theirs.ok ? `Waiting for ${escapeHtml(v.partnerName)}…` : ""}</span>
        <button class="duel-btn accept-stake${v.mine.ok ? " on" : ""}" type="button">${v.mine.ok ? "✓ Accepted" : "Accept stakes"}</button>
      </div>`;

    const chip = (it: StakeItem, removable: boolean): string => {
      const def = this.content.items[it.item];
      return `<button class="trade-chip${removable ? " rm" : " ro"}" data-item="${escapeHtml(it.item)}" title="${escapeHtml(def?.name ?? it.item)}">${def ? itemIconSVG(def) : ""}${it.qty > 1 ? `<span class="trade-chip-qty">${it.qty}</span>` : ""}</button>`;
    };
    const mineEl = this.modal.querySelector(".trade-offer.mine") as HTMLElement;
    mineEl.innerHTML = v.mine.items.length ? v.mine.items.map((i) => chip(i, true)).join("") : `<span class="trade-empty">nothing yet</span>`;
    mineEl.querySelectorAll(".trade-chip").forEach((el) => el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const id = (el as HTMLElement).dataset["item"] as ItemId;
      this.session.setOffer(v.mine.gold, v.mine.items.filter((i) => i.item !== id));
    }));
    const theirsEl = this.modal.querySelector(".trade-offer.theirs") as HTMLElement;
    theirsEl.innerHTML = v.theirs.items.length ? v.theirs.items.map((i) => chip(i, false)).join("") : `<span class="trade-empty">nothing yet</span>`;

    // Pack minus already-staked.
    const used = new Map<string, number>();
    for (const o of v.mine.items) used.set(o.item, (used.get(o.item) ?? 0) + o.qty);
    const seen = new Set<string>();
    const rows: StakeItem[] = [];
    for (const s of player.inventory) {
      if (!s || seen.has(s.item)) continue;
      seen.add(s.item);
      let total = 0;
      for (const t of player.inventory) if (t?.item === s.item) total += t.qty;
      const left = total - (used.get(s.item) ?? 0);
      if (left > 0) rows.push({ item: s.item, qty: left });
    }
    const packEl = this.modal.querySelector(".trade-pack") as HTMLElement;
    packEl.innerHTML = rows.map((it) =>
      `<button class="trade-chip pack" data-item="${escapeHtml(it.item)}" title="${escapeHtml(this.content.items[it.item]?.name ?? it.item)}">${itemIconSVG(this.content.items[it.item]!)}${it.qty > 1 ? `<span class="trade-chip-qty">${it.qty}</span>` : ""}</button>`,
    ).join("") || `<span class="trade-empty">your pack is empty</span>`;
    packEl.querySelectorAll(".trade-chip.pack").forEach((el) => el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const id = (el as HTMLElement).dataset["item"] as ItemId;
      const free = rows.find((r) => r.item === id)?.qty ?? 0;
      if (free <= 0) return;
      const stake = (add: number): void => {
        const already = v.mine.items.find((i) => i.item === id)?.qty ?? 0;
        const items = v.mine.items.filter((i) => i.item !== id);
        items.push({ item: id, qty: already + add });
        this.session.setOffer(v.mine.gold, items);
      };
      if (free > 1) {
        void askAmount(`Stake how many ${this.content.items[id]?.name ?? id}?`, free)
          .then((n) => { if (n !== null && n > 0) stake(Math.min(free, n)); });
      } else {
        stake(1);
      }
    }));

    const goldEl = this.modal.querySelector(".trade-gold-input") as HTMLInputElement;
    goldEl.addEventListener("change", () => {
      this.session.setOffer(Math.floor(Number(goldEl.value) || 0), v.mine.items);
    });
    goldEl.addEventListener("keydown", (e) => e.stopPropagation());
    this.modal.querySelector(".accept-stake")!.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.session.accept(); });
    this.modal.querySelector(".duel-close")!.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.session.cancel(); });
  }

  // --- The fight ---------------------------------------------------------------
  private renderFight(v: ReturnType<DuelSession["view"]>): void {
    if (!this.modal.querySelector(".duel-arena")) {
      this.modal.innerHTML = `
        <div class="duel-head"><span class="duel-title">${iconize("⚔️")} vs ${escapeHtml(v.partnerName)}</span></div>
        <canvas class="duel-arena" width="420" height="230"></canvas>
        <div class="duel-kit-head">Your kit — tap gear to switch, food to eat</div>
        <div class="duel-kit"></div>
        <div class="duel-actions fight">
          <button class="duel-btn eat" type="button">Eat</button>
          <button class="duel-btn spec" type="button">${iconize("⚡")} Special</button>
          <button class="duel-btn dim forfeit" type="button">Forfeit</button>
        </div>`;
      this.modal.querySelector(".eat")!.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.session.act({ t: "eat" }); });
      this.modal.querySelector(".spec")!.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.session.act({ t: "spec" }); });
      this.modal.querySelector(".forfeit")!.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        if (window.confirm("Forfeit the duel? Your stake is lost.")) this.session.cancel();
      });
      this.lastKitSig = "";
      const loop = (): void => { this.drawArena(); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    }
    this.drawArena();
  }

  /** The switch strip: worn-swappable gear + food, tappable. Rebuilt only when
   *  the kit changes (bench/food shift), so taps aren't dropped every frame. */
  private updateKit(v: ReturnType<DuelSession["view"]>): void {
    const el = this.modal.querySelector(".duel-kit") as HTMLElement | null;
    const me = v.me;
    const st = v.state;
    if (!el || !me || !st) return;
    const side = v.iAmA ? st.a : st.b;
    // Food remaining = carried minus what this side has eaten.
    const eaten = new Map<string, number>();
    for (const e of side.eaten) eaten.set(e.item, (eaten.get(e.item) ?? 0) + e.count);
    const foods = me.food
      .map((f) => ({ item: f.item, heal: f.heal, left: f.count - (eaten.get(f.item) ?? 0) }))
      .filter((f) => f.left > 0);
    // Bench gear, grouped by item id with a count.
    const gear = new Map<string, number>();
    for (const b of me.bench) gear.set(b, (gear.get(b) ?? 0) + 1);
    const sig = `${[...gear].map(([i, n]) => `${i}:${n}`).join(",")}|${foods.map((f) => `${f.item}:${f.left}`).join(",")}`;
    if (sig === this.lastKitSig) return;
    this.lastKitSig = sig;

    const chip = (item: ItemId, badge: string, kind: "gear" | "food"): string => {
      const def = this.content.items[item];
      return `<button class="duel-kit-chip ${kind}" data-item="${escapeHtml(item)}" data-kind="${kind}" title="${escapeHtml(def?.name ?? item)}">${def ? itemIconSVG(def) : ""}${badge ? `<span class="duel-kit-badge">${badge}</span>` : ""}</button>`;
    };
    const gearHtml = [...gear.entries()].map(([item, n]) => chip(item as ItemId, n > 1 ? String(n) : "", "gear")).join("");
    const foodHtml = foods.map((f) => chip(f.item, String(f.left), "food")).join("");
    el.innerHTML = (gearHtml + foodHtml) || `<span class="duel-kit-empty">You brought no switches or food.</span>`;
    el.querySelectorAll(".duel-kit-chip").forEach((c) => c.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const item = (c as HTMLElement).dataset["item"] as ItemId;
      if ((c as HTMLElement).dataset["kind"] === "gear") this.session.act({ t: "equip", item });
      else this.session.act({ t: "eat", item });
    }));
  }

  private pushSplat(e: DuelEvent): void {
    if (e.kind === "hit") this.splats.push({ side: e.side === "a" ? "b" : "a", text: String(e.value), color: "#e2483a", born: performance.now() });
    else if (e.kind === "miss") this.splats.push({ side: e.side === "a" ? "b" : "a", text: "0", color: "#5a74a4", born: performance.now() });
    else if (e.kind === "eat") this.splats.push({ side: e.side, text: `+${e.value}`, color: "#5fd06a", born: performance.now() });
    else if (e.kind === "spec") this.splats.push({ side: e.side, text: "SPEC!", color: "#f2cf6b", born: performance.now() });
    else if (e.kind === "equip") this.splats.push({ side: e.side, text: "SWAP", color: "#c9a24a", born: performance.now() });
  }

  private drawArena(): void {
    const v = this.session.view();
    for (const e of v.events) this.pushSplat(e);
    this.updateKit(v);
    const cv = this.modal.querySelector(".duel-arena") as HTMLCanvasElement | null;
    const st = v.state;
    if (!cv || !st || !v.me || !v.foe) return;
    const g = cv.getContext("2d")!;
    const W = cv.width, H = cv.height;
    const now = performance.now();

    // The ring floor.
    g.fillStyle = "#241f17";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#3d3527";
    g.beginPath(); g.ellipse(W / 2, H * 0.62, W * 0.42, H * 0.28, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(201,162,74,0.5)";
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(W / 2, H * 0.62, W * 0.42, H * 0.28, 0, 0, Math.PI * 2); g.stroke();

    // The two fighters (A on the left; me highlighted by name colour).
    const [fa, fb] = v.iAmA ? [v.me, v.foe] : [v.foe, v.me];
    const bob = Math.sin(now / 420) * 1.5;
    // `withDefaults` — a duel fighter's look arrives over the wire from another
    // client, and this was the one call site that handed it to the renderer raw.
    // The two face each other, so they take real profile facings.
    drawAvatar(g, W * 0.32, H * 0.58 + bob, 2.1, withDefaults(fa.look), { facing: "right", now }, resolveGear(fa.equipment, this.content));
    drawAvatar(g, W * 0.68, H * 0.58 - bob, 2.1, withDefaults(fb.look), { facing: "left", now }, resolveGear(fb.equipment, this.content));

    // HP bars + names.
    const bar = (x: number, side: "a" | "b", f: typeof fa): void => {
      const s = st[side];
      const frac = Math.max(0, s.hp / f.maxHp);
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.fillRect(x - 62, 12, 124, 26);
      g.fillStyle = "#3a0f0c";
      g.fillRect(x - 58, 27, 116, 7);
      g.fillStyle = frac > 0.35 ? "#4fae5c" : "#c43a23";
      g.fillRect(x - 58, 27, 116 * frac, 7);
      g.font = "600 11px 'Cinzel', serif";
      g.textAlign = "center";
      g.fillStyle = "#eddfba";
      g.fillText(`${f.name} (${f.combatLevel})`, x, 22);
      // The live style — updates the instant a bow or blade is swapped in.
      g.font = "600 9px 'EB Garamond', serif";
      g.fillStyle = f.ranged ? "#8fd0a0" : "#d9a679";
      g.fillText(f.ranged ? "RANGED" : "MELEE", x, 47);
      // spec pips under the bar
      g.fillStyle = "#8fb7f0";
      g.fillRect(x - 58, 36, 116 * (s.spec / 100), 2.5);
    };
    bar(W * 0.32, "a", fa);
    bar(W * 0.68, "b", fb);

    // Countdown veil.
    if (v.phase === "countdown") {
      g.fillStyle = "rgba(10,8,6,0.55)";
      g.fillRect(0, 0, W, H);
      g.font = "700 44px 'Cinzel', serif";
      g.textAlign = "center";
      g.fillStyle = "#f2cf6b";
      g.fillText(String(Math.max(1, Math.ceil(v.countdownMs / 1000))), W / 2, H / 2 + 14);
    }

    // Splats drift up and fade.
    this.splats = this.splats.filter((s) => now - s.born < 900);
    for (const s of this.splats) {
      const t = (now - s.born) / 900;
      const x = s.side === "a" ? W * 0.32 : W * 0.68;
      const y = H * 0.42 - t * 26;
      g.globalAlpha = 1 - t;
      g.font = "700 16px 'Cinzel', serif";
      g.textAlign = "center";
      g.fillStyle = "rgba(0,0,0,0.8)";
      g.fillText(s.text, x + 1, y + 1);
      g.fillStyle = s.color;
      g.fillText(s.text, x, y);
      g.globalAlpha = 1;
    }

    // Button states.
    const me = v.iAmA ? st.a : st.b;
    const meF = v.me;
    const bites = meF.food.reduce((n, f) => n + f.count, 0) - me.eaten.reduce((n, f) => n + f.count, 0);
    const eat = this.modal.querySelector(".eat") as HTMLButtonElement | null;
    const spec = this.modal.querySelector(".spec") as HTMLButtonElement | null;
    if (eat) { eat.textContent = `Eat (${Math.max(0, bites)})`; eat.disabled = bites <= 0; }
    if (spec) { spec.disabled = me.spec < 100 && !me.specArmed; spec.classList.toggle("armed", me.specArmed); }
  }

  // --- The verdict ---------------------------------------------------------------
  private renderOver(v: ReturnType<DuelSession["view"]>): void {
    cancelAnimationFrame(this.raf);
    const msg = v.result === "won" ? `VICTORY — ${escapeHtml(v.partnerName)}'s stake is yours!`
      : v.result === "lost" ? `Defeated. Your stake crosses the ring to ${escapeHtml(v.partnerName)}.`
      : v.result === "draw" ? "A dead heat — both stakes walk home."
      : "The duel was voided — both stakes returned.";
    const p = this.getPlayer();
    this.modal.innerHTML = `
      <div class="duel-head"><span class="duel-title">${iconize("⚔️")} The Duel Ring</span></div>
      <div class="duel-ask ${v.result === "won" ? "win" : ""}">${msg}</div>
      <div class="duel-sub">Record: ${p.stats.duelWins ?? 0}W · ${p.stats.duelLosses ?? 0}L</div>
      <div class="duel-actions"><button class="duel-btn done" type="button">Done</button></div>`;
    this.modal.querySelector(".done")!.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.session.dismiss();
      this.render();
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}
