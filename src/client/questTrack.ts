/**
 * src/client/questTrack.ts
 * ------------------------
 * Which quest the player has chosen to "track" — a client display preference
 * (kept in localStorage, not in the save). The Quests tab sets it; the HUD
 * banner and the on-map guidance chevron read it.
 *
 * Three states are stored under one key:
 *   - a quest id       → track that quest (banner + arrow follow it)
 *   - absent (null)     → no preference; the guide auto-tracks the main spine
 *   - the DISMISS token → the player explicitly turned tracking OFF, so the
 *                         guide stays quiet and does NOT auto-retrack. This is
 *                         what lets un-checking the tracked quest minimise the
 *                         guide HUD when you're not working on a quest.
 */

const KEY = "varath-tracked-quest";
const DISMISS = "__none__";

export function getTrackedQuest(): string | null {
  try { const v = localStorage.getItem(KEY); return v && v !== DISMISS ? v : null; } catch { return null; }
}

/** True when the player has explicitly turned tracking off (not merely absent). */
export function isTrackingDismissed(): boolean {
  try { return localStorage.getItem(KEY) === DISMISS; } catch { return false; }
}

/** Track a quest (id), or clear the preference so the guide may auto-track (null). */
export function setTrackedQuest(id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

/** Explicitly turn tracking OFF — the guide banner and arrow go quiet and won't
 *  auto-retrack until the player taps a quest to track again. */
export function dismissTracking(): void {
  try { localStorage.setItem(KEY, DISMISS); } catch { /* ignore */ }
}
