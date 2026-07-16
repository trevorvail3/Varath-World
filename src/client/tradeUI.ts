/**
 * src/client/tradeUI.ts
 * ---------------------
 * The live, face-to-face trade window (OSRS-style). It's a pure view driven by
 * `sync(row)`, which the HUD calls on a short poll — so a trade request pops up
 * even when the window is closed, and both sides update near-instantly.
 *
 * Your side is editable (add from your pack, set gold); their side is read-only
 * and mirrors the server. Changing either offer clears both "accepted" marks
 * (the server does this by bumping a revision). When both sides have accepted
 * the same revision, the trade settles and each client applies its own half of
 * the swap through the idempotent TRADE_APPLY intent.
 */

import type { Content, Intent, ItemId, Player } from "../core/types.ts";
import { itemIconSVG } from "./itemIcon.ts";
import { iconize } from "./glyph.ts";
import {
  ackTrade, cancelTrade, confirmTrade, respondTrade, setOffer,
  type TradeItem, type TradeRow,
} from "./trade.ts";
import { askAmount } from "./prompt.ts";

export class TradeUI {
  private backdrop: HTMLElement;
  private modal: HTMLElement;
  private open = false;
  private row: TradeRow | null = null;
  private applied = new Set<number>();
  private closing = 0;

  constructor(
    root: HTMLElement,
    private content: Content,
    private getPlayer: () => Player | null,
    private dispatch: (intent: Intent) => void,
    private refresh: () => Promise<void>,
  ) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "trade-backdrop hidden";
    this.modal = document.createElement("div");
    this.modal.className = "trade-modal";
    this.backdrop.appendChild(this.modal);
    root.appendChild(this.backdrop);
  }

  isOpen(): boolean { return this.open; }

  /** Drive the whole window from the latest server row (or null = no trade). */
  sync(row: TradeRow | null): void {
    if (this.closing) return; // mid "complete"/"cancelled" toast — let it finish

    if (!row) {
      // The trade vanished (declined, cancelled, or retired). If we were mid-
      // trade and it didn't settle, say so; otherwise just close quietly.
      if (this.open && this.row && this.row.status !== "settled") this.toast("Trade cancelled.");
      else this.hide();
      this.row = null;
      return;
    }

    this.row = row;
    if (row.status === "settled") { this.settle(row); return; }

    this.show();
    if (row.status === "offered") this.renderOffered(row);
    else this.renderActive(row);
  }

  private show(): void { this.open = true; this.backdrop.classList.remove("hidden"); }
  private hide(): void { this.open = false; this.backdrop.classList.add("hidden"); }

  private toast(message: string): void {
    this.modal.innerHTML = `<div class="trade-toast">${escapeHtml(message)}</div>`;
    this.show();
    this.closing = window.setTimeout(() => { this.closing = 0; this.hide(); }, 1500);
  }

  // --- The handshake: someone asked to trade, or we're waiting on them. ---
  private renderOffered(row: TradeRow): void {
    if (row.iAmAsked) {
      this.modal.innerHTML = `
        <div class="trade-head"><span class="trade-title">Trade request</span></div>
        <div class="trade-ask">${escapeHtml(row.partnerName)} wants to trade with you.</div>
        <div class="trade-actions">
          <button class="trade-btn accept" type="button">Accept</button>
          <button class="trade-btn dim decline" type="button">Decline</button>
        </div>`;
      this.modal.querySelector(".accept")!.addEventListener("pointerdown", (e) => {
        e.stopPropagation(); void this.act(() => respondTrade(row.id, true));
      });
      this.modal.querySelector(".decline")!.addEventListener("pointerdown", (e) => {
        e.stopPropagation(); void this.act(() => respondTrade(row.id, false));
      });
    } else {
      this.modal.innerHTML = `
        <div class="trade-head"><span class="trade-title">Trading with ${escapeHtml(row.partnerName)}</span></div>
        <div class="trade-ask">Waiting for ${escapeHtml(row.partnerName)} to accept…</div>
        <div class="trade-actions"><button class="trade-btn dim cancel" type="button">Cancel</button></div>`;
      this.modal.querySelector(".cancel")!.addEventListener("pointerdown", (e) => {
        e.stopPropagation(); void this.act(() => cancelTrade(row.id));
      });
    }
  }

  // --- The live window: both offers, your pack, gold, accept. ---
  private renderActive(row: TradeRow): void {
    const player = this.getPlayer();
    const okBadge = (ok: boolean): string =>
      `<span class="trade-ok${ok ? " on" : ""}">${ok ? "✓ Accepted" : "Not accepted"}</span>`;

    this.modal.innerHTML = `
      <div class="trade-head">
        <span class="trade-title">Trading with ${escapeHtml(row.partnerName)}</span>
        <button class="trade-close" type="button">✕</button>
      </div>
      <div class="trade-cols">
        <div class="trade-side">
          <div class="trade-side-head">Your offer ${okBadge(row.mine.ok)}</div>
          <div class="trade-offer mine"></div>
          <div class="trade-gold-row">
            <span class="trade-gold-coin">${iconize("🪙")}</span>
            <input class="trade-gold-input" type="number" min="0" inputmode="numeric" value="${row.mine.gold}" />
            <span class="trade-gold-g">gold</span>
          </div>
        </div>
        <div class="trade-side">
          <div class="trade-side-head">${escapeHtml(row.partnerName)}'s offer ${okBadge(row.theirs.ok)}</div>
          <div class="trade-offer theirs"></div>
          <div class="trade-gold-row static"><span class="trade-gold-coin">${iconize("🪙")}</span><span class="trade-their-gold">${row.theirs.gold.toLocaleString()}</span><span class="trade-gold-g">gold</span></div>
        </div>
      </div>
      <div class="trade-pack-head">Your pack — tap to add</div>
      <div class="trade-pack"></div>
      <div class="trade-foot">
        <span class="trade-status"></span>
        <button class="trade-btn accept-trade${row.mine.ok ? " on" : ""}" type="button">${row.mine.ok ? "✓ Accepted" : "Accept"}</button>
      </div>`;

    // My offered items (tap to remove).
    const mineEl = this.modal.querySelector(".trade-offer.mine") as HTMLElement;
    mineEl.innerHTML = row.mine.items.length
      ? row.mine.items.map((it) => this.chip(it, true)).join("")
      : `<span class="trade-empty">nothing yet</span>`;
    mineEl.querySelectorAll(".trade-chip").forEach((el) => el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      void this.removeFromOffer((el as HTMLElement).dataset.item as ItemId);
    }));

    // Their offered items (read-only).
    const theirsEl = this.modal.querySelector(".trade-offer.theirs") as HTMLElement;
    theirsEl.innerHTML = row.theirs.items.length
      ? row.theirs.items.map((it) => this.chip(it, false)).join("")
      : `<span class="trade-empty">nothing yet</span>`;

    // My pack (tap to add).
    const packEl = this.modal.querySelector(".trade-pack") as HTMLElement;
    packEl.innerHTML = this.packItems(player, row.mine.items).map((it) =>
      `<button class="trade-chip pack" data-item="${escapeHtml(it.item)}" title="${escapeHtml(this.content.items[it.item]?.name ?? it.item)}">${itemIconSVG(this.content.items[it.item]!)}${it.qty > 1 ? `<span class="trade-chip-qty">${it.qty}</span>` : ""}</button>`,
    ).join("") || `<span class="trade-empty">your pack is empty</span>`;
    packEl.querySelectorAll(".trade-chip.pack").forEach((el) => el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      void this.addToOffer((el as HTMLElement).dataset.item as ItemId);
    }));

    // Gold input.
    const goldEl = this.modal.querySelector(".trade-gold-input") as HTMLInputElement;
    goldEl.addEventListener("change", () => void this.setGold(goldEl));
    goldEl.addEventListener("keydown", (e) => e.stopPropagation());

    // Accept + close.
    const status = this.modal.querySelector(".trade-status") as HTMLElement;
    if (row.mine.ok && !row.theirs.ok) status.textContent = `Waiting for ${row.partnerName}…`;
    else if (!row.mine.ok && row.theirs.ok) status.textContent = `${row.partnerName} has accepted.`;
    else status.textContent = "";
    this.modal.querySelector(".accept-trade")!.addEventListener("pointerdown", (e) => {
      e.stopPropagation(); void this.accept(row);
    });
    this.modal.querySelector(".trade-close")!.addEventListener("pointerdown", (e) => {
      e.stopPropagation(); void this.act(() => cancelTrade(row.id));
    });
  }

  private chip(it: TradeItem, removable: boolean): string {
    const def = this.content.items[it.item];
    return `<button class="trade-chip${removable ? " rm" : " ro"}" data-item="${escapeHtml(it.item)}" title="${escapeHtml(def?.name ?? it.item)}">${def ? itemIconSVG(def) : ""}${it.qty > 1 ? `<span class="trade-chip-qty">${it.qty}</span>` : ""}</button>`;
  }

  /** Pack contents minus what's already in my offer (so I can't over-offer). */
  private packItems(player: Player | null, offered: TradeItem[]): TradeItem[] {
    if (!player) return [];
    const used = new Map<string, number>();
    for (const o of offered) used.set(o.item, (used.get(o.item) ?? 0) + o.qty);
    const out: TradeItem[] = [];
    const seen = new Set<string>();
    for (const slot of player.inventory) {
      if (!slot) continue;
      const total = countIn(player, slot.item);
      if (seen.has(slot.item)) continue;
      seen.add(slot.item);
      const left = total - (used.get(slot.item) ?? 0);
      if (left > 0) out.push({ item: slot.item, qty: left });
    }
    return out;
  }

  // --- Mutations (each re-reads the row right after, for snappy updates). ---
  private async addToOffer(item: ItemId): Promise<void> {
    const row = this.row; const player = this.getPlayer();
    if (!row || !player) return;
    const have = countIn(player, item);
    const already = row.mine.items.find((i) => i.item === item)?.qty ?? 0;
    const free = have - already;
    if (free <= 0) return;
    let add = 1;
    if (free > 1) {
      const n = await askAmount(`Offer how many ${this.content.items[item]?.name ?? item}?`, free);
      if (n === null || n <= 0) return;
      add = Math.min(free, n);
    }
    const items = mergeItem(row.mine.items, item, already + add);
    await this.act(() => setOffer(row.id, items, row.mine.gold));
  }

  private async removeFromOffer(item: ItemId): Promise<void> {
    const row = this.row; if (!row) return;
    const items = row.mine.items.filter((i) => i.item !== item);
    await this.act(() => setOffer(row.id, items, row.mine.gold));
  }

  private async setGold(input: HTMLInputElement): Promise<void> {
    const row = this.row; const player = this.getPlayer();
    if (!row || !player) return;
    const gold = Math.max(0, Math.min(player.gold, Math.floor(Number(input.value) || 0)));
    input.value = String(gold);
    await this.act(() => setOffer(row.id, row.mine.items, gold));
  }

  private async accept(row: TradeRow): Promise<void> {
    const player = this.getPlayer();
    if (player && !fits(player, row.mine.items, row.theirs.items)) {
      const status = this.modal.querySelector(".trade-status") as HTMLElement | null;
      if (status) status.textContent = "Not enough pack space for their offer.";
      return;
    }
    await this.act(() => confirmTrade(row.id, row.rev));
  }

  /** Run a server write, then re-poll so both panels reflect it at once. */
  private async act(fn: () => Promise<unknown>): Promise<void> {
    try { await fn(); } catch (e) {
      const status = this.modal.querySelector(".trade-status") as HTMLElement | null;
      if (status) status.textContent = e instanceof Error ? e.message : "Trade error.";
    }
    await this.refresh();
  }

  // --- Settlement: apply our half of the agreed swap, once. ---
  private settle(row: TradeRow): void {
    if (!this.applied.has(row.id)) {
      this.applied.add(row.id);
      this.dispatch({
        type: "TRADE_APPLY",
        tradeId: row.id,
        give: { gold: row.mine.gold, items: row.mine.items },
        get: { gold: row.theirs.gold, items: row.theirs.items },
      });
      void ackTrade(row.id).catch(() => {});
    }
    this.toast("Trade complete!");
  }
}

/** Total of an item across the pack. */
function countIn(player: Player, item: ItemId): number {
  let n = 0;
  for (const s of player.inventory) if (s?.item === item) n += s.qty;
  return n;
}

/** Set an item in an offer list to an absolute quantity. */
function mergeItem(items: TradeItem[], item: ItemId, qty: number): TradeItem[] {
  const out = items.filter((i) => i.item !== item);
  if (qty > 0) out.push({ item, qty });
  return out;
}

/** Could the pack hold `get` after handing over `give`? (Mirrors core add rules.) */
function fits(player: Player, give: TradeItem[], get: TradeItem[]): boolean {
  const inv: ({ item: ItemId; qty: number } | null)[] = player.inventory.map((s) => (s ? { item: s.item, qty: s.qty } : null));
  for (const g of give) {
    let left = g.qty;
    for (let i = 0; i < inv.length && left > 0; i++) {
      const s = inv[i];
      if (s && s.item === g.item) { const t = Math.min(s.qty, left); s.qty -= t; left -= t; if (s.qty <= 0) inv[i] = null; }
    }
  }
  for (const g of get) {
    if (STACKABLE.has(g.item)) {
      const ex = inv.find((s) => s && s.item === g.item);
      if (ex) { ex.qty += g.qty; continue; }
      const e = inv.findIndex((s) => s === null);
      if (e === -1) return false;
      inv[e] = { item: g.item, qty: g.qty };
    } else {
      for (let n = 0; n < g.qty; n++) {
        const e = inv.findIndex((s) => s === null);
        if (e === -1) return false;
        inv[e] = { item: g.item, qty: 1 };
      }
    }
  }
  return true;
}

/** Item ids known to stack (filled in once from content; ammo always stacks). */
const STACKABLE = new Set<ItemId>();
export function registerStackables(content: Content): void {
  for (const id of Object.keys(content.items) as ItemId[]) {
    const d = content.items[id];
    if (d.stackable === true || d.slot === "ammo" || d.cat === "Seeds") STACKABLE.add(id);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}
