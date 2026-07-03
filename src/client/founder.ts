/**
 * src/client/founder.ts
 * ---------------------
 * The Founder's Pack — the game side of a one-time cosmetic supporter purchase.
 *
 * ENTITLEMENT (who is a founder): a per-account fact, server-authoritative. The
 * source of truth is a `world_entitlements` row in Supabase, written by the
 * Stripe webhook when a supporter pays (see FOUNDER.md). `loadFounderEntitlement`
 * reads it at login and caches the answer; `founderEntitled()` reports it. Until
 * Stripe is wired, a `?founder=1` URL flag stands in so the pack can be built,
 * seen and tested — that dev override is documented and goes away at launch.
 *
 * The entitlement is stamped onto the player as the `"founder"` flag in main.ts's
 * boot(); the CLAIM (handing over the actual cosmetics, once) lives in the core
 * as the FOUNDER_CLAIM intent. This module only reads the entitlement and shows
 * the claim window.
 *
 * COSMETIC ONLY. The pack grants a pet and a cape with no stats and nothing that
 * touches XP, gold, or the leaderboards. The value is "I was here at the start."
 */

import { currentUser, rest } from "./supabase.ts";
import { glyph } from "./glyph.ts";
import type { WorldState, Intent } from "../core/types.ts";

let entitled = false;

/** The `?founder=1` dev override — lets the pack be tested before any payment
 *  infra exists. Read live so it applies on every boot path (incl. offline). */
function devOverride(): boolean {
  try { return new URLSearchParams(location.search).get("founder") === "1"; }
  catch { return false; }
}

/** Has this account bought the Founder's Pack? (Cached from the login read,
 *  or the dev override.) Safe to call synchronously from boot(). */
export function founderEntitled(): boolean {
  return entitled || devOverride();
}

/** Read the account's Founder entitlement from Supabase at login (fail-silent). */
export async function loadFounderEntitlement(): Promise<void> {
  if (devOverride()) { entitled = true; return; }
  const user = currentUser();
  if (!user) { entitled = false; return; }
  try {
    const res = await rest(`world_entitlements?user_id=eq.${user.id}&select=founder`);
    if (!res.ok) { entitled = false; return; }
    const rows = (await res.json()) as { founder?: boolean }[];
    entitled = Array.isArray(rows) && rows.length > 0 && rows[0]?.founder === true;
  } catch {
    entitled = false; // table absent / offline — simply not a founder this session
  }
}

/** If this player is a founder who hasn't claimed yet, show the one-time cache
 *  window: one button that fires FOUNDER_CLAIM. Cosmetic; safe to no-op. */
export function maybeShowFounderClaim(
  root: HTMLElement,
  state: WorldState,
  dispatch: (i: Intent) => void,
): void {
  const flags = state.player.flags;
  if (!flags.includes("founder") || flags.includes("founder_claimed")) return;

  const back = document.createElement("div");
  back.className = "founder-backdrop";
  back.innerHTML = `
    <div class="founder-box">
      <div class="founder-crest">${glyph("flame")}</div>
      <div class="founder-title">Founder's Cache</div>
      <div class="founder-sub">You backed Varath in its first days. With our thanks — yours to keep, and yours alone:</div>
      <ul class="founder-list">
        <li><b>The First Ember</b> — a lantern-light companion</li>
        <li><b>Founder's Mantle</b> — an ember-and-black cape</li>
        <li>A <b>Founder</b> mark in gold on the hiscores</li>
      </ul>
      <div class="founder-note">Purely for standing — no power, no advantage, ever.</div>
      <button class="founder-claim" type="button">Claim your cache</button>
    </div>`;
  root.appendChild(back);
  const claim = back.querySelector(".founder-claim") as HTMLButtonElement;
  claim.addEventListener("click", () => {
    claim.disabled = true;
    dispatch({ type: "FOUNDER_CLAIM" });
    back.querySelector(".founder-box")!.classList.add("claimed");
    (back.querySelector(".founder-sub") as HTMLElement).textContent =
      "The First Ember lights at your shoulder. Welcome, Founder.";
    window.setTimeout(() => back.remove(), 2600);
  });
}
