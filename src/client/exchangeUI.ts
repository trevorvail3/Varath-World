/**
 * src/client/exchangeUI.ts
 * ------------------------
 * The Grand Exchange window: deposit gold/items into your Exchange account, place
 * buy/sell offers on the shared order book, and watch them fill. Pure UI — it
 * reads/writes through exchange.ts (server) and dispatches GE_MOVE intents to
 * keep the character's pack in sync with what it deposits/withdraws.
 */

import { audio } from "./audio.ts";
import { marketValue } from "../core/worldCore.ts";
import type { Content, Intent, ItemId, WorldState } from "../core/types.ts";
import {
  allOrders, cancelOrder, depositGold, depositItem, items as geItems, myOrders,
  placeOrder, quote, recentTrades, wallet, withdrawGold, withdrawItem,
  type GeItem, type GeOrder,
} from "./exchange.ts";

type Tab = "account" | "trade" | "offers" | "market";

const fmt = (n: number): string => Math.floor(n).toLocaleString();

export class ExchangeUI {
  private backdrop: HTMLElement;
  private body: HTMLElement;
  private msgEl: HTMLElement;
  private balEl: HTMLElement;
  private tabsEl: HTMLElement;
  private open = false;
  private tab: Tab = "market";
  private bal = 0;
  private bank: GeItem[] = [];
  private orders: GeOrder[] = [];
  private tradeItem: ItemId | null = null;

  constructor(
    root: HTMLElement,
    private content: Content,
    private dispatch: (i: Intent) => void,
    private getState: () => WorldState | null,
  ) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "ge-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="ge-modal">
        <div class="ge-head">
          <span class="ge-title">Grand Exchange</span>
          <button class="ge-close" type="button">✕</button>
        </div>
        <div class="ge-balance"></div>
        <div class="ge-tabs"></div>
        <div class="ge-msg"></div>
        <div class="ge-body"></div>
      </div>`;
    this.balEl = this.backdrop.querySelector(".ge-balance") as HTMLElement;
    this.tabsEl = this.backdrop.querySelector(".ge-tabs") as HTMLElement;
    this.msgEl = this.backdrop.querySelector(".ge-msg") as HTMLElement;
    this.body = this.backdrop.querySelector(".ge-body") as HTMLElement;
    root.appendChild(this.backdrop);

    (this.backdrop.querySelector(".ge-close") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); this.close(); },
    );
    this.backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === this.backdrop) this.close();
    });

    const tabs: Array<[Tab, string]> = [["account", "Account"], ["trade", "Trade"], ["offers", "My Offers"], ["market", "Market"]];
    for (const [id, label] of tabs) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `ge-tab${id === this.tab ? " on" : ""}`;
      b.textContent = label;
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.tab = id;
        this.tabsEl.querySelectorAll(".ge-tab").forEach((t) => t.classList.remove("on"));
        b.classList.add("on");
        this.render();
      });
      this.tabsEl.appendChild(b);
    }
  }

  isOpen(): boolean { return this.open; }
  close(): void { this.open = false; this.backdrop.classList.add("hidden"); }

  async show(): Promise<void> {
    this.open = true;
    // Open on the Market every time — it's what most players come here to see.
    this.tab = "market";
    this.tabsEl.querySelectorAll(".ge-tab").forEach((t, i) => t.classList.toggle("on", i === 3));
    this.backdrop.classList.remove("hidden");
    this.msg("");
    this.body.innerHTML = `<div class="ge-empty">Loading…</div>`;
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    try {
      const [b, k, o] = await Promise.all([wallet(), geItems(), myOrders()]);
      this.bal = b; this.bank = k; this.orders = o;
    } catch {
      this.body.innerHTML = `<div class="ge-empty">Couldn't reach the Exchange. Check your connection.</div>`;
      return;
    }
    if (this.open) this.render();
  }

  private msg(text: string, ok = false): void {
    this.msgEl.textContent = text;
    this.msgEl.classList.toggle("ok", ok);
  }

  private render(): void {
    this.balEl.textContent = `Exchange gold: ${fmt(this.bal)}`;
    if (this.tab === "account") this.renderAccount();
    else if (this.tab === "trade") this.renderTrade();
    else if (this.tab === "market") this.renderMarket();
    else this.renderOffers();
  }

  /** Every open offer on the board, across all players. */
  private renderMarket(): void {
    this.body.innerHTML = `<div class="ge-empty">Loading the market…</div>`;
    void allOrders().then((orders) => {
      if (this.tab !== "market" || !this.open) return;
      if (orders.length === 0) {
        this.body.innerHTML = `<div class="ge-empty">No open offers anywhere right now.</div>`;
        return;
      }
      this.body.innerHTML = `<div class="ge-offers">${orders.map((o, i) => {
        const remain = o.qty - o.filled;
        // You can trade straight against an offer: BUY from a sell, SELL to a buy.
        const act = o.side === "sell" ? "Buy" : "Sell";
        return `
          <div class="ge-offer">
            <div class="ge-offer-top">
              <span class="ge-offer-side ${o.side}">${o.side === "buy" ? "WANTS" : "SELLS"}</span>
              <span class="ge-offer-name">${escapeHtml(this.itemName(o.item))}</span>
              <span class="ge-offer-price">@ ${fmt(o.price)}</span>
            </div>
            <div class="ge-offer-bot">
              <span class="ge-dim">${fmt(remain)} left · ${fmt(remain * o.price)} total</span>
              <button class="ge-btn small ge-match" data-oi="${i}" type="button">${act}</button>
            </div>
          </div>`;
      }).join("")}</div>`;
      this.body.querySelectorAll(".ge-match").forEach((b) => {
        b.addEventListener("click", () => {
          const o = orders[Number((b as HTMLElement).dataset.oi)];
          if (o) void this.matchOffer(o);
        });
      });
    }).catch(() => {
      this.body.innerHTML = `<div class="ge-empty">Couldn't load the market.</div>`;
    });
  }

  /** Trade straight against an existing offer: place a matching order at its
   *  price so the order book fills it immediately (buy a seller's stock, or sell
   *  into a buyer's demand). Quantity is clamped to what you can afford / hold. */
  private async matchOffer(o: GeOrder): Promise<void> {
    const remain = o.qty - o.filled;
    if (o.side === "sell") {
      // You BUY from this seller at their price.
      const affordable = Math.floor(this.bal / o.price);
      const qty = Math.min(remain, affordable);
      if (qty <= 0) { this.msg("Not enough Exchange gold — deposit more first (Account tab)."); return; }
      await this.doMatch("buy", o.item, qty, o.price);
    } else {
      // You SELL into this buyer's demand at their price — STRAIGHT FROM YOUR
      // PACK. No need to pre-deposit into the Exchange: one click deposits what
      // you're selling, fills the buy order, and returns the coin to your pocket.
      const have = this.packCount(o.item) + (this.bank.find((b) => b.item === o.item)?.qty ?? 0);
      const qty = Math.min(remain, have);
      if (qty <= 0) { this.msg(`You've no ${this.itemName(o.item)} to sell.`); return; }
      await this.sellFromPack(o.item, qty, o.price);
    }
  }

  /** Instant-sell from the pack into a standing buy offer: top up the Exchange
   *  from the pack for anything not already escrowed, place the matching sell
   *  (which fills immediately), then sweep the proceeds back to the pocket — so
   *  "I have it, I click Sell" just works. */
  private async sellFromPack(item: ItemId, qty: number, price: number): Promise<void> {
    try {
      const escrowed = this.bank.find((b) => b.item === item)?.qty ?? 0;
      const needDeposit = Math.max(0, qty - escrowed); // move this much pack -> Exchange
      if (needDeposit > 0) {
        await depositItem(item, needDeposit);
        this.take("item", needDeposit, item); // remove the deposited stack from the pack
      }
      const goldBefore = this.bal;
      await placeOrder("sell", item, qty, price); // matches the buy order right away
      await this.refresh(); // pulls the new wallet balance (sale proceeds)
      const gained = Math.max(0, this.bal - goldBefore);
      if (gained > 0) {
        await withdrawGold(gained);
        this.give("gold", gained); // proceeds land in the pocket
      }
      this.msg(`Sold ${qty}× ${this.itemName(item)} @ ${fmt(price)} — ${fmt(gained)} gold to your pocket.`, true);
      await this.refresh();
    } catch (e) { this.msg(errMsg(e)); await this.refresh(); }
    if (this.tab === "market") this.renderMarket();
  }

  private async doMatch(side: "buy" | "sell", item: ItemId, qty: number, price: number): Promise<void> {
    try {
      await placeOrder(side, item, qty, price);
      this.msg(`${side === "buy" ? "Bought" : "Sold"} ${qty}× ${this.itemName(item)} @ ${fmt(price)}.`, true);
    } catch (e) { this.msg(errMsg(e)); }
    await this.refresh();
    if (this.tab === "market") this.renderMarket();
  }

  // --- helpers shared by the actions ---
  private itemName(id: ItemId): string { return this.content.items[id]?.name ?? id; }
  private isStackable(id: ItemId): boolean {
    const d = this.content.items[id];
    return !!d && (d.stackable === true || d.slot === "ammo" || d.cat === "Seeds");
  }
  private packCount(id: ItemId): number {
    const inv = this.getState()?.player.inventory ?? [];
    return inv.reduce((n, s) => n + (s?.item === id ? s.qty : 0), 0);
  }
  /** How many of an item the pack can take back (respects stacking + 28 slots). */
  private packRoom(id: ItemId): number {
    const inv = this.getState()?.player.inventory ?? [];
    const free = inv.filter((s) => s === null).length;
    if (this.isStackable(id)) {
      return inv.some((s) => s?.item === id) || free > 0 ? Number.MAX_SAFE_INTEGER : 0;
    }
    return free;
  }
  private take(kind: "gold" | "item", amount: number, item?: ItemId): void {
    audio.play("coin");
    this.dispatch({ type: "GE_MOVE", dir: "take", kind, amount, ...(item ? { item } : {}) });
  }
  private give(kind: "gold" | "item", amount: number, item?: ItemId, noted?: boolean): void {
    audio.play("coin");
    this.dispatch({ type: "GE_MOVE", dir: "give", kind, amount, ...(item ? { item } : {}), ...(noted ? { noted: true } : {}) });
  }
  /** Room for a note of this item: any empty slot, or an existing note stack. */
  private noteRoom(item: ItemId): boolean {
    const inv = this.getState()?.player.inventory ?? [];
    return inv.some((s) => s === null || (s.item === item && s.noted));
  }

  // --- Account: gold + item deposits/withdrawals ---
  private renderAccount(): void {
    const pocket = this.getState()?.player.gold ?? 0;
    const packItems = this.distinctPackItems();
    this.body.innerHTML = `
      <div class="ge-sect">
        <div class="ge-sect-h">Gold</div>
        <div class="ge-row">
          <span class="ge-dim">In pocket: ${fmt(pocket)}</span>
        </div>
        <div class="ge-row">
          <input class="ge-in ge-gold-amt" type="text" inputmode="numeric" placeholder="amount" />
          <button class="ge-btn ge-gold-dep" type="button">Deposit</button>
          <button class="ge-btn alt ge-gold-wd" type="button">Withdraw</button>
        </div>
      </div>
      <div class="ge-sect">
        <div class="ge-sect-h">Deposit an item</div>
        <div class="ge-row">
          <select class="ge-in ge-dep-item">
            ${packItems.length
              ? packItems.map((p) => `<option value="${p.item}">${escapeHtml(this.itemName(p.item))} ×${p.qty}</option>`).join("")
              : `<option value="">(pack empty)</option>`}
          </select>
          <input class="ge-in narrow ge-dep-qty" type="text" inputmode="numeric" placeholder="qty" />
          <button class="ge-btn ge-dep-go" type="button">Deposit</button>
        </div>
      </div>
      <div class="ge-sect">
        <div class="ge-sect-h">Your Exchange items</div>
        <div class="ge-bank">${this.bank.length
          ? this.bank.map((it) => `
            <div class="ge-bank-row">
              <span class="ge-bank-name">${escapeHtml(this.itemName(it.item))}</span>
              <span class="ge-bank-qty">×${fmt(it.qty)}</span>
              <button class="ge-btn small ge-wd-item" data-item="${it.item}" data-qty="${it.qty}" type="button">Withdraw</button>
            </div>`).join("")
          : `<div class="ge-dim">Nothing here yet. Deposit items to sell, or collect what you've bought.</div>`}
        </div>
      </div>`;

    const amtEl = this.body.querySelector(".ge-gold-amt") as HTMLInputElement;
    const parse = (s: string): number => Math.floor(Number(s.replace(/[, ]/g, "")));
    (this.body.querySelector(".ge-gold-dep") as HTMLElement).addEventListener("click", () => {
      const amt = parse(amtEl.value);
      if (!(amt > 0)) return this.msg("Enter an amount.");
      if ((this.getState()?.player.gold ?? 0) < amt) return this.msg("You don't have that much gold.");
      void this.doDepositGold(amt);
    });
    (this.body.querySelector(".ge-gold-wd") as HTMLElement).addEventListener("click", () => {
      const amt = parse(amtEl.value);
      if (!(amt > 0)) return this.msg("Enter an amount.");
      void this.doWithdrawGold(amt);
    });
    (this.body.querySelector(".ge-dep-go") as HTMLElement).addEventListener("click", () => {
      const sel = this.body.querySelector(".ge-dep-item") as HTMLSelectElement;
      const qtyEl = this.body.querySelector(".ge-dep-qty") as HTMLInputElement;
      const item = sel.value as ItemId;
      if (!item) return this.msg("Nothing to deposit.");
      const qty = Math.floor(Number(qtyEl.value)) || this.packCount(item);
      if (!(qty > 0)) return this.msg("Enter a quantity.");
      void this.doDepositItem(item, Math.min(qty, this.packCount(item)));
    });
    this.body.querySelectorAll(".ge-wd-item").forEach((el) => {
      el.addEventListener("click", () => {
        const item = (el as HTMLElement).dataset.item as ItemId;
        const have = Number((el as HTMLElement).dataset.qty);
        void this.doWithdrawItem(item, have);
      });
    });
  }

  private distinctPackItems(): GeItem[] {
    const inv = this.getState()?.player.inventory ?? [];
    const map = new Map<ItemId, number>();
    for (const s of inv) if (s) map.set(s.item, (map.get(s.item) ?? 0) + s.qty);
    return [...map].map(([item, qty]) => ({ item, qty }));
  }

  private async doDepositGold(amt: number): Promise<void> {
    this.take("gold", amt);
    try { await depositGold(amt); this.msg(`Deposited ${fmt(amt)} gold.`, true); }
    catch (e) { this.give("gold", amt); this.msg(errMsg(e)); }
    await this.refresh();
  }
  private async doWithdrawGold(amt: number): Promise<void> {
    try { await withdrawGold(amt); this.give("gold", amt); this.msg(`Withdrew ${fmt(amt)} gold.`, true); }
    catch (e) { this.msg(errMsg(e)); }
    await this.refresh();
  }
  private async doDepositItem(item: ItemId, qty: number): Promise<void> {
    this.take("item", qty, item);
    try { await depositItem(item, qty); this.msg(`Deposited ${qty}× ${this.itemName(item)}.`, true); }
    catch (e) { this.give("item", qty, item); this.msg(errMsg(e)); }
    await this.refresh();
  }
  private async doWithdrawItem(item: ItemId, have: number): Promise<void> {
    // Big collections of an unstackable item come back as a note (one slip), so
    // a large Exchange buy doesn't demand a whole empty pack. Stackables collect
    // normally into their stack.
    const asNote = !this.isStackable(item) && have > 1;
    const room = asNote ? (this.noteRoom(item) ? have : 0) : this.packRoom(item);
    const qty = Math.min(have, room);
    if (qty <= 0) return this.msg("Your pack is full.");
    try {
      await withdrawItem(item, qty);
      this.give("item", qty, item, asNote);
      this.msg(`Withdrew ${qty}× ${this.itemName(item)}${asNote ? " (noted)" : ""}.`, true);
    } catch (e) { this.msg(errMsg(e)); }
    await this.refresh();
  }

  // --- Trade: pick an item, see the price guide, place a buy/sell offer ---
  private renderTrade(): void {
    this.body.innerHTML = `
      <div class="ge-sect">
        <div class="ge-row">
          <input class="ge-in ge-item-search" list="ge-item-list" placeholder="search item…" />
          <datalist id="ge-item-list">${this.itemOptions()}</datalist>
        </div>
        <div class="ge-quote"></div>
      </div>
      <div class="ge-sect">
        <div class="ge-row ge-side">
          <button class="ge-btn side-buy on" type="button">Buy</button>
          <button class="ge-btn alt side-sell" type="button">Sell</button>
        </div>
        <div class="ge-row">
          <input class="ge-in narrow ge-qty" type="text" inputmode="numeric" placeholder="qty" />
          <input class="ge-in ge-price" type="text" inputmode="numeric" placeholder="price each" />
          <button class="ge-btn ge-place" type="button">Place offer</button>
        </div>
        <div class="ge-total ge-dim"></div>
      </div>`;

    const search = this.body.querySelector(".ge-item-search") as HTMLInputElement;
    const qtyEl = this.body.querySelector(".ge-qty") as HTMLInputElement;
    const priceEl = this.body.querySelector(".ge-price") as HTMLInputElement;
    const totalEl = this.body.querySelector(".ge-total") as HTMLElement;
    let side: "buy" | "sell" = "buy";

    const updateTotal = (): void => {
      const q = Math.floor(Number(qtyEl.value)) || 0;
      const p = Math.floor(Number(priceEl.value.replace(/[, ]/g, ""))) || 0;
      totalEl.textContent = q > 0 && p > 0 ? `Total: ${fmt(q * p)} gold` : "";
    };
    qtyEl.addEventListener("input", updateTotal);
    priceEl.addEventListener("input", updateTotal);

    const setSide = (s: "buy" | "sell"): void => {
      side = s;
      (this.body.querySelector(".side-buy") as HTMLElement).classList.toggle("on", s === "buy");
      (this.body.querySelector(".side-sell") as HTMLElement).classList.toggle("on", s === "sell");
    };
    (this.body.querySelector(".side-buy") as HTMLElement).addEventListener("click", () => setSide("buy"));
    (this.body.querySelector(".side-sell") as HTMLElement).addEventListener("click", () => setSide("sell"));

    const onPick = (): void => {
      const id = this.nameToId(search.value);
      this.tradeItem = id;
      if (id) void this.showQuote(id, priceEl);
      else (this.body.querySelector(".ge-quote") as HTMLElement).innerHTML = "";
    };
    search.addEventListener("change", onPick);
    if (this.tradeItem) { search.value = this.itemName(this.tradeItem); void this.showQuote(this.tradeItem, priceEl); }

    (this.body.querySelector(".ge-place") as HTMLElement).addEventListener("click", () => {
      const id = this.nameToId(search.value);
      if (!id) return this.msg("Pick an item first.");
      const q = Math.floor(Number(qtyEl.value)) || 0;
      const p = Math.floor(Number(priceEl.value.replace(/[, ]/g, ""))) || 0;
      if (!(q > 0)) return this.msg("Enter a quantity.");
      if (!(p > 0)) return this.msg("Enter a price.");
      if (side === "buy" && q * p > this.bal) return this.msg("Not enough Exchange gold — deposit more first.");
      if (side === "sell") {
        const escrowed = this.bank.find((b) => b.item === id)?.qty ?? 0;
        if (escrowed + this.packCount(id) < q) return this.msg(`You've not ${q}× ${this.itemName(id)} to sell.`);
      }
      void this.doPlace(side, id, q, p);
    });
  }

  private async showQuote(id: ItemId, priceEl: HTMLInputElement): Promise<void> {
    const box = this.body.querySelector(".ge-quote") as HTMLElement | null;
    if (!box) return;
    box.innerHTML = `<span class="ge-dim">Loading prices…</span>`;
    try {
      const [q, trades] = await Promise.all([quote(id), recentTrades(id)]);
      const line = (label: string, v: number | null): string =>
        `<span class="ge-q"><b>${label}</b> ${v != null ? fmt(v) : "—"}</span>`;
      // Guide price — the item's standing market value (what NPC counters pay).
      // With a thin or empty order book the live bid/ask/last are blank, which
      // made the Exchange look broken and left new sellers guessing; the guide
      // gives every item a sensible reference so the GE always works, and real
      // player orders take over as the book fills.
      const guide = marketValue(this.content, id);
      const guideLine = guide > 0
        ? `<span class="ge-q ge-guide"><b>Guide</b> ${fmt(guide)}</span>`
        : "";
      box.innerHTML = `
        <div class="ge-quote-row">${line("Buy", q.bid)}${line("Sell", q.ask)}${line("Last", q.last)}${guideLine}</div>
        <div class="ge-trades">${trades.length
          ? trades.map((t) => `<span class="ge-trade">${t.qty}× @ ${fmt(t.price)}</span>`).join("")
          : `<span class="ge-dim">No live trades — the guide price is a fair start.</span>`}</div>`;
      if (!priceEl.value) {
        const hint = q.ask ?? q.last ?? q.bid ?? (guide > 0 ? guide : null);
        if (hint) priceEl.value = String(hint);
      }
    } catch { box.innerHTML = `<span class="ge-dim">Prices unavailable.</span>`; }
  }

  private async doPlace(side: "buy" | "sell", item: ItemId, qty: number, price: number): Promise<void> {
    try {
      // Selling? Top up the Exchange from the pack for whatever isn't escrowed,
      // so placing a sell offer works straight from your pack (no Account detour).
      if (side === "sell") {
        const escrowed = this.bank.find((b) => b.item === item)?.qty ?? 0;
        const needDeposit = Math.max(0, qty - escrowed);
        if (needDeposit > 0) { await depositItem(item, needDeposit); this.take("item", needDeposit, item); }
      }
      await placeOrder(side, item, qty, price);
      this.msg(`Offer placed: ${side} ${qty}× ${this.itemName(item)} @ ${fmt(price)}.`, true);
      this.tab = "offers";
      this.tabsEl.querySelectorAll(".ge-tab").forEach((t, i) => t.classList.toggle("on", i === 2));
    } catch (e) { this.msg(errMsg(e)); }
    await this.refresh();
  }

  // --- My Offers: live orders, progress, cancel ---
  private renderOffers(): void {
    this.body.innerHTML = this.orders.length
      ? `<div class="ge-offers">${this.orders.map((o) => {
          const pct = Math.round((o.filled / o.qty) * 100);
          return `
            <div class="ge-offer">
              <div class="ge-offer-top">
                <span class="ge-offer-side ${o.side}">${o.side.toUpperCase()}</span>
                <span class="ge-offer-name">${escapeHtml(this.itemName(o.item))}</span>
                <span class="ge-offer-price">@ ${fmt(o.price)}</span>
              </div>
              <div class="ge-offer-bar"><div class="ge-offer-fill" style="width:${pct}%"></div></div>
              <div class="ge-offer-bot">
                <span class="ge-dim">${fmt(o.filled)} / ${fmt(o.qty)} · total ${fmt(o.qty * o.price)}</span>
                <button class="ge-btn small ge-cancel" data-id="${o.id}" type="button">Cancel</button>
              </div>
            </div>`;
        }).join("")}</div>`
      : `<div class="ge-empty">No open offers. Use the Trade tab to buy or sell.</div>`;
    this.body.querySelectorAll(".ge-cancel").forEach((el) => {
      el.addEventListener("click", () => void this.doCancel(Number((el as HTMLElement).dataset.id)));
    });
  }

  private async doCancel(id: number): Promise<void> {
    try { await cancelOrder(id); this.msg("Offer cancelled; reserves returned to your Exchange.", true); }
    catch (e) { this.msg(errMsg(e)); }
    await this.refresh();
  }

  // --- shared item search options ---
  private itemOptions(): string {
    return Object.values(this.content.items)
      .map((it) => `<option value="${escapeHtml(it.name)}"></option>`).join("");
  }
  private nameToId(name: string): ItemId | null {
    const n = name.trim().toLowerCase();
    if (!n) return null;
    for (const it of Object.values(this.content.items)) {
      if (it.name.toLowerCase() === n) return it.id;
    }
    return null;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}
