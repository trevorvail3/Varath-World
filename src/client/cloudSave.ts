/**
 * src/client/cloudSave.ts
 * -----------------------
 * Cloud saves: a character follows your Supabase account to any device. The save
 * blob (the same JSON serializePlayer writes) lives in a per-user row in the
 * `world_saves` table, guarded by RLS so only you can read/write your own.
 *
 * Safety: load() distinguishes "no save yet" (ok, data null) from "couldn't
 * reach the cloud" (offline). The caller MUST NOT overwrite the cloud after an
 * offline load — otherwise a flaky connection could wipe a real character.
 */

import { currentUser, rest } from "./supabase.ts";

export type CloudLoad =
  | { ok: true; data: unknown | null } // reached the server (data null = no save yet)
  | { ok: false; why: CloudFailure; detail: string }; // cloud state unknown

/**
 * WHY THE SAVE COULD NOT BE READ — three answers, because they have three
 * different ways out, and the screen used to give all three the one sentence
 * for the first.
 *
 *   offline   the request never got an answer. Retrying is the way out.
 *   signin    the server answered and said the SIGN-IN is no good (401, or a
 *             JWT complaint, or the refresh failed and dropped the session).
 *             Retrying can never fix that; signing in again does.
 *   refused   the server answered and said no for some other reason. Show
 *             what it said — that is the only way anybody finds out which.
 *
 * `signin` is the one that bit. The sign-in is shared across every game under
 * the studio's address, so World is often opened ALREADY signed in, holding a
 * session another game wrote and may since have rotated. Signed in on
 * varath-world.vercel.app you have just typed a password, so the token is
 * minutes old and this never happens there — which is why the game "worked
 * everywhere except the studio page", behind a Retry button that reloaded into
 * the same refusal forever.
 */
export type CloudFailure = "offline" | "signin" | "refused";

/** Fetch this user's cloud save. */
export async function loadCloud(): Promise<CloudLoad> {
  const user = currentUser();
  if (!user) return { ok: true, data: null };
  let res: Response;
  try {
    res = await rest(`world_saves?user_id=eq.${user.id}&select=data`);
  } catch (e) {
    return { ok: false, why: "offline", detail: String((e as Error)?.message ?? e) };
  }
  // `rest` refreshes an expiring token first, and a refresh the server refuses
  // signs the player out and sends the request anonymously. Whatever came back
  // for an anonymous request is not this player's save — empty rows included,
  // which would otherwise read as "no save yet" and open the character creator.
  if (!currentUser()) return { ok: false, why: "signin", detail: "the saved sign-in could not be renewed" };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const detail = `${res.status} ${body}`.trim().slice(0, 300);
    const jwt = /jwt|PGRST30[0-9]/i.test(body);
    return { ok: false, why: res.status === 401 || jwt ? "signin" : "refused", detail };
  }
  try {
    const rows = await res.json();
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    return { ok: true, data: row?.data ?? null };
  } catch (e) {
    return { ok: false, why: "refused", detail: `unreadable answer: ${String((e as Error)?.message ?? e)}` };
  }
}

/** Delete this user's cloud save (used by a character reset). */
export async function deleteCloud(): Promise<void> {
  const user = currentUser();
  if (!user) return;
  try {
    await rest(`world_saves?user_id=eq.${user.id}`, { method: "DELETE" });
  } catch { /* ignore — local reset already happened */ }
}

/** Upsert this user's cloud save. Returns true on success. */
export async function saveCloud(data: unknown, name: string): Promise<boolean> {
  const user = currentUser();
  if (!user) return false;
  try {
    const res = await rest("world_saves?on_conflict=user_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: { user_id: user.id, name, data },
    });
    return res.ok;
  } catch {
    return false;
  }
}
