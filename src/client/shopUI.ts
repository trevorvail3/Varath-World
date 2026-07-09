/**
 * src/client/shopUI.ts
 * --------------------
 * A shopkeeper's trade window, split into two tabs:
 *   - Buy: the keeper's wares (tap Buy to purchase a bundle; long-hold to inspect).
 *   - Sell: your pack. Tapping an item opens a quantity picker (Sell 1 / 5 / 10 /
 *     All) rather than dumping the whole stack — a buffer against a fat-fingered
 *     sale. Long-holding a pack item inspects it (stats + sell value) first.
 *
 * It only sends BUY / SELL intents — the core moves the gold and goods (RULE 2) —
 * and re-reads live state after each one.
 */

import { audio } from "./audio.ts";
import type {
  Content,
  Intent,
  ItemId,
  ShopDef,
  WorldState,
} from "../core/types.ts";
import { itemIconSVG } from "./itemIcon.ts";
import { shopStockLeft, marketValue, equipRequirement } from "../core/worldCore.ts";

export class ShopUI {
  private backdrop: HTMLElement;
  private head: HTMLElement;
  private goldEl: HTMLElement;
  private tabsEl: HTMLElement;
  private contentEl: HTMLElement;
  private infoEl: HTMLElement;
  private open = false;
  private state: WorldState | null = null;
  private shop: ShopDef | null = null;
  private tab: "buy" | "sell" = "buy";
  private pressTimer = 0;

  constructor(
    root: HTMLElement,
    private content: Content,
    private dispatch: (intent: Intent) => void,
  ) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "shop-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="shop-modal">
        <div class="shop-head">
          <span class="shop-title">Shop</span>
          <span class="shop-gold">0g</span>
          <button class="shop-close" type="button">✕</button>
        </div>
        <div class="shop-greeting"></div>
        <div class="shop-tabs">
          <button class="shop-tab" data-tab="buy" type="button">Buy</button>
          <button class="shop-tab" data-tab="sell" type="button">Sell</button>
        </div>
        <div class="shop-content"></div>
      </div>
      <div class="shop-info hidden"></div>`;
    this.head = this.backdrop.querySelector(".shop-title") as HTMLElement;
    this.goldEl = this.backdrop.querySelector(".shop-gold") as HTMLElement;
    this.tabsEl = this.backdrop.querySelector(".shop-tabs") as HTMLElement;
    this.contentEl = this.backdrop.querySelector(".shop-content") as HTMLElement;
    this.infoEl = this.backdrop.querySelector(".shop-info") as HTMLElement;
    root.appendChild(this.backdrop);

    (this.backdrop.querySelector(".shop-close") as HTMLElement).addEventListener(
      "pointerdown",
      (e) => { e.stopPropagation(); this.close(); },
    );
    this.backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === this.backdrop) this.close();
    });
    for (const t of Array.from(this.tabsEl.querySelectorAll<HTMLElement>(".shop-tab"))) {
      t.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.tab = (t.dataset["tab"] as "buy" | "sell") ?? "buy";
        this.hideInfo();
        this.render();
      });
    }
    // Tapping the info/picker overlay (but not the box inside it) dismisses it.
    this.infoEl.addEventListener("pointerdown", (e) => {
      if (e.target === this.infoEl) this.hideInfo();
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  show(state: WorldState, shop: ShopDef): void {
    this.state = state;
    this.shop = shop;
    this.open = true;
    this.tab = "buy";
    this.head.textContent = shop.name;
    (this.backdrop.querySelector(".shop-greeting") as HTMLElement).textContent = shop.greeting;
    this.hideInfo();
    this.backdrop.classList.remove("hidden");
    this.render();
  }

  close(): void {
    this.open = false;
    this.hideInfo();
    this.backdrop.classList.add("hidden");
  }

  /** A "barter" shop trades entirely in one alt-currency item (Jacob's Angler's
   *  Chits, a bounty board's Marks…) rather than gold — every ware is bought
   *  with a costItem and lists no gold price. Returns that currency, or null for
   *  an ordinary gold shop. */
  private barterCurrency(): ItemId | null {
    if (!this.shop || this.shop.stock.length === 0) return null;
    const first = this.shop.stock[0]!.costItem as ItemId | undefined;
    if (!first) return null;
    return this.shop.stock.every((l) => l.costItem === first) ? first : null;
  }

  /** How many of an item the player is carrying. */
  private carried(item: ItemId): number {
    return this.state?.player.inventory.reduce((n, s) => (s?.item === item ? n + s.qty : n), 0) ?? 0;
  }

  private render(): void {
    if (!this.state || !this.shop) return;
    const { player } = this.state;
    const cur = this.barterCurrency();
    if (cur) {
      const have = this.carried(cur);
      const name = this.content.items[cur]?.name ?? "chit";
      this.goldEl.textContent = `${have.toLocaleString()} ${name}${have === 1 ? "" : "s"}`;
    } else {
      this.goldEl.textContent = `${player.gold.toLocaleString()}g`;
    }
    for (const t of Array.from(this.tabsEl.querySelectorAll<HTMLElement>(".shop-tab"))) {
      t.classList.toggle("active", t.dataset["tab"] === this.tab);
    }
    this.contentEl.innerHTML = "";
    if (this.tab === "buy") this.renderBuy(player);
    else this.renderSell(player);
  }

  // --- Buy tab: the keeper's wares. ------------------------------------------
  private renderBuy(player: WorldState["player"]): void {
    const hint = document.createElement("div");
    hint.className = "shop-sell-hint";
    hint.textContent = "Tap a ware to buy it · hold to inspect it first.";
    this.contentEl.appendChild(hint);

    // A card grid matching the Sell tab and the rest of the game's item panels:
    // an icon tile with a bundle badge, the name, a price pill and a stock tag.
    const grid = document.createElement("div");
    grid.className = "shop-wares-grid";
    for (const line of this.shop!.stock) {
      const def = this.content.items[line.item];
      if (!def) continue;
      // Ending-gated wares only appear once their story flag is set.
      if (line.requiresFlag && !this.state!.player.flags.includes(line.requiresFlag)) continue;
      const stocked = def.cat !== "Capes";
      const left = stocked ? shopStockLeft(this.state!, this.shop!.id, line.item) : Infinity;
      const inStock = left > 0;
      const payItem = line.costItem;
      const payQty = line.costQty ?? 0;
      const have = payItem
        ? player.inventory.reduce((n, s) => (s?.item === payItem ? n + s.qty : n), 0)
        : 0;
      const costLabel = payItem
        ? `${payQty} ${this.content.items[payItem]?.name ?? "Mark"}${payQty === 1 ? "" : "s"}`
        : `${line.price.toLocaleString()}g`;
      const afford = (payItem ? have >= payQty : player.gold >= line.price) && inStock;
      const bundle = line.qty > 1 ? `<span class="shop-card-bundle">×${line.qty}</span>` : "";
      const stockTag = stocked
        ? `<span class="shop-card-stock${inStock ? "" : " out"}">${inStock ? `${left} left` : "Sold out"}</span>`
        : `<span class="shop-card-stock">In stock</span>`;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "shop-card" + (afford ? "" : " disabled");
      card.title = inStock ? def.description : "Out of stock — the keeper will restock soon.";
      card.innerHTML = `
        <span class="shop-card-icon">${itemIconSVG(def)}${bundle}</span>
        <span class="shop-card-name">${def.name}</span>
        <span class="shop-card-price${afford ? "" : " short"}">${costLabel}</span>
        ${stockTag}`;
      // Tap = buy (when affordable & in stock); hold = inspect what you're buying.
      const cost = payItem ? { item: payItem as ItemId, qty: payQty } : undefined;
      const inspect = (): void => this.showInspect(line.item, line.qty, "buy", line.price, cost);
      this.attachPress(
        card,
        inspect,
        () => {
          if (afford) this.dispatchAndRender({ type: "BUY", shop: this.shop!.id, item: line.item });
          else inspect();
        },
      );
      grid.appendChild(card);
    }
    this.contentEl.appendChild(grid);
  }

  // --- Sell tab: your pack. Tap opens a quantity picker; long-hold inspects. --
  private renderSell(player: WorldState["player"]): void {
    const hint = document.createElement("div");
    hint.className = "shop-sell-hint";
    hint.textContent = "Tap an item to choose how many to sell · hold to inspect it first.";
    this.contentEl.appendChild(hint);

    const grid = document.createElement("div");
    grid.className = "shop-inv inv-grid";
    for (let i = 0; i < player.inventory.length; i++) {
      const data = player.inventory[i];
      if (!data) {
        const blank = document.createElement("div");
        blank.className = "inv-slot";
        grid.appendChild(blank);
        continue;
      }
      const def = this.content.items[data.item];
      const value = marketValue(this.content, data.item);
      const sellable = value > 0 && !data.noted; // bank notes can't be sold here
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "inv-slot filled" + (sellable ? "" : " unsellable") + (data.noted ? " noted" : "");
      slot.title = sellable
        ? `${def.name} — sells for ${value.toLocaleString()}g each`
        : data.noted ? `${def.name} (noted) — can't be sold here` : `${def.name} — can't be sold`;
      slot.innerHTML = `<span class="inv-icon">${itemIconSVG(def)}</span>${
        data.qty > 1 ? `<span class="inv-qty">${data.qty}</span>` : ""
      }`;
      // Tap = open the quantity picker (never an instant sale). Hold = inspect.
      this.attachPress(
        slot,
        () => this.showInspect(data.item, data.qty, "sell"),
        () => { if (sellable) this.showSellPicker(data.item, data.qty); else this.showInspect(data.item, data.qty, "sell"); },
      );
      grid.appendChild(slot);
    }
    this.contentEl.appendChild(grid);
  }

  // --- The sell quantity picker: the buffer against accidental sales. ---------
  private showSellPicker(item: ItemId, held: number): void {
    const def = this.content.items[item];
    const each = marketValue(this.content, item);
    if (!def || each <= 0) return;
    const amounts = [1, 5, 10].filter((n) => n < held);
    const rows = [...amounts, held]; // always offer "all"
    const btns = rows.map((n) => {
      const label = n === held ? `All (${held})` : String(n);
      return `<button class="shop-pick-btn" data-qty="${n}" type="button">
          <span class="shop-pick-n">Sell ${label}</span>
          <span class="shop-pick-g">${(each * n).toLocaleString()}g</span>
        </button>`;
    }).join("");
    this.infoEl.innerHTML = `
      <div class="shop-info-box shop-pick-box">
        <button class="shop-info-x" type="button">✕</button>
        <div class="shop-info-icon">${itemIconSVG(def)}</div>
        <div class="shop-info-name">Sell ${def.name}?</div>
        <div class="shop-info-desc">${each.toLocaleString()}g each · you hold ${held}</div>
        <div class="shop-pick-btns">${btns}</div>
        <button class="shop-pick-inspect" type="button">Inspect first</button>
      </div>`;
    (this.infoEl.querySelector(".shop-info-x") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); this.hideInfo(); },
    );
    (this.infoEl.querySelector(".shop-pick-inspect") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); this.showInspect(item, held, "sell"); },
    );
    for (const b of Array.from(this.infoEl.querySelectorAll<HTMLElement>(".shop-pick-btn"))) {
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const qty = Number(b.dataset["qty"]) || 1;
        this.hideInfo();
        this.dispatchAndRender({ type: "SELL", item, qty });
      });
    }
    this.infoEl.classList.remove("hidden");
  }

  // --- Inspect: name, description, gear stats, requirement, and value. --------
  private showInspect(item: ItemId, qty: number, mode: "buy" | "sell", buyPrice = 0, cost?: { item: ItemId; qty: number }): void {
    const def = this.content.items[item];
    if (!def) return;
    const stats = this.itemStats(def);
    const req = equipRequirement(this.content, item);
    const reqLine = req ? `<div class="shop-info-req">Requires ${this.skillName(req.skill)} ${req.level}</div>` : "";
    const value = marketValue(this.content, item);
    let valueLine: string;
    if (mode === "buy") {
      const bundle = qty > 1 ? ` (×${qty})` : "";
      if (cost) {
        // A barter ware: priced in an alt-currency (chits/marks), not gold.
        const cname = this.content.items[cost.item]?.name ?? "chit";
        valueLine = `Buy: ${cost.qty.toLocaleString()} ${cname}${cost.qty === 1 ? "" : "s"}${bundle}`;
      } else {
        valueLine = `Buy: ${buyPrice.toLocaleString()}g${bundle} · ${value > 0 ? `sells back for ${value.toLocaleString()}g` : "can't be sold back"}`;
      }
    } else {
      valueLine = value > 0
        ? `Sells for ${value.toLocaleString()}g each${qty > 1 ? ` · ${(value * qty).toLocaleString()}g for all ${qty}` : ""}`
        : "Can't be sold here";
    }
    this.infoEl.innerHTML = `
      <div class="shop-info-box">
        <button class="shop-info-x" type="button">✕</button>
        <div class="shop-info-icon">${itemIconSVG(def)}</div>
        <div class="shop-info-name">${def.name}</div>
        <div class="shop-info-desc">${def.description}</div>
        ${stats ? `<div class="shop-info-gear">${stats}</div>` : ""}
        ${reqLine}
        <div class="shop-info-stats">${valueLine}</div>
        ${mode === "sell" && value > 0 ? `<button class="shop-info-sell" type="button">Sell…</button>` : ""}
      </div>`;
    (this.infoEl.querySelector(".shop-info-x") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); this.hideInfo(); },
    );
    const sellBtn = this.infoEl.querySelector(".shop-info-sell") as HTMLElement | null;
    if (sellBtn) sellBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.showSellPicker(item, qty);
    });
    this.infoEl.classList.remove("hidden");
  }

  /** A one-line combat/utility stat summary for the inspect box. */
  private itemStats(def: Content["items"][ItemId]): string {
    const bits: string[] = [];
    if (def.acc) bits.push(`+${def.acc} accuracy`);
    if (def.dmg) bits.push(`+${def.dmg} damage`);
    if (def.rngAcc) bits.push(`+${def.rngAcc} ranged acc`);
    if (def.rngDmg) bits.push(`+${def.rngDmg} ranged dmg`);
    if (def.magAcc) bits.push(`+${def.magAcc} magic acc`);
    if (def.magDmg) bits.push(`+${def.magDmg} magic dmg`);
    if (def.def) bits.push(`+${def.def} defence`);
    if (def.heals) bits.push(`heals ${def.heals}`);
    if (def.graceRestore) bits.push(`+${def.graceRestore} Grace`);
    return bits.join(" · ");
  }

  private skillName(skill: string): string {
    return this.content.skills[skill as keyof Content["skills"]]?.name ?? skill;
  }

  private hideInfo(): void { this.infoEl.classList.add("hidden"); }

  /** Long-press → onLong; a clean tap (no hold, no drag) → onTap. Right-click
   *  fires the inspect at once on desktop. */
  private attachPress(el: HTMLElement, onLong: () => void, onTap: () => void): void {
    let sx = 0, sy = 0, moved = false, fired = false;
    const clear = (): void => { if (this.pressTimer) { clearTimeout(this.pressTimer); this.pressTimer = 0; } };
    el.addEventListener("pointerdown", (e) => {
      sx = e.clientX; sy = e.clientY; moved = false; fired = false;
      clear();
      if (e.button === 2) { fired = true; onLong(); return; }
      this.pressTimer = window.setTimeout(() => {
        this.pressTimer = 0;
        if (!moved) { fired = true; onLong(); }
      }, 380);
    });
    el.addEventListener("pointermove", (e) => {
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 12) { moved = true; clear(); }
    });
    el.addEventListener("pointerup", (e) => {
      clear();
      if (!fired && !moved) { e.stopPropagation(); onTap(); }
    });
    el.addEventListener("pointercancel", clear);
    el.addEventListener("pointerleave", clear);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private dispatchAndRender(intent: Intent): void {
    if (intent.type === "BUY" || intent.type === "SELL") audio.play("coin");
    this.dispatch(intent);
    this.render();
  }
}
