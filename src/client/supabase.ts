/**
 * src/client/supabase.ts
 * ----------------------
 * A tiny, dependency-free Supabase client — just the bits World needs: email +
 * password auth (the SAME accounts as the idle game, since it points at the same
 * project) and authenticated REST calls. We talk to Supabase's HTTP endpoints
 * directly with `fetch` rather than pulling in the full SDK, to keep the bundle
 * small and the project dependency-free.
 *
 * The URL and publishable key below are PUBLIC by design — Supabase ships them in
 * the browser; security comes from the Row-Level-Security rules on the table
 * (see server/SUPABASE.md). The secret (service_role) key is never used here.
 */

const SUPABASE_URL = "https://iutyspbplhhamedhmvzu.supabase.co";
const SUPABASE_KEY = "sb_publishable_-O1DCgY4UDp-8onXPnkNeQ_pygXOQ2u";

const SESSION_KEY = "varath.sb.session";

/**
 * Which project issued this session. Same guard as Hearthkeep's client, and it
 * has to be the same or the shared session key stops meaning anything.
 *
 * Two reasons it exists. A session outlives the project that issued it, so a
 * token from a dead project reads back as valid: the screen says signed in,
 * every call 401s, and nothing explains why. And because `SESSION_KEY` is
 * SHARED across the three games deliberately, a session written by one game
 * without this stamp is discarded by the others — so "one account everywhere"
 * silently stops working in whichever direction is missing it.
 */
const PROJECT_REF = SUPABASE_URL.replace(/^https:\/\//, "").split(".")[0] ?? "";

export interface SbUser { id: string; email: string }
interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  user: SbUser;
  /** REQUIRED, so the compiler names any write path that forgets it. */
  ref: string;
}

let session: Session | null = readSession();
const listeners = new Set<(u: SbUser | null) => void>();

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s?.ref !== PROJECT_REF) {
      // Issued by a different project. Nothing the player did, nothing they
      // can do — sign them out rather than pretend.
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (s && typeof s.access_token === "string" && s.user?.id) return s as Session;
  } catch { /* ignore */ }
  return null;
}

function store(s: Session | null): void {
  session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
  const u = s?.user ?? null;
  listeners.forEach((fn) => fn(u));
}

/** Build a Session from a raw GoTrue token response. */
function sessionFromToken(d: Record<string, unknown>): Session | null {
  const access = d["access_token"];
  const refresh = d["refresh_token"];
  const user = d["user"] as Record<string, unknown> | undefined;
  if (typeof access !== "string" || typeof refresh !== "string" || !user?.["id"]) return null;
  const expiresIn = typeof d["expires_in"] === "number" ? d["expires_in"] : 3600;
  return {
    access_token: access,
    refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user: { id: String(user["id"]), email: String(user["email"] ?? "") },
    ref: PROJECT_REF,
  };
}

async function authFetch(path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    // BOTH headers. A legacy anon key was a JWT carrying `role: anon`, so the
    // gateway could read the role out of `apikey` alone. `sb_publishable_...`
    // is opaque and carries no claim, so the anonymous role has to arrive as a
    // bearer token. Sending only `apikey` is what made Hearthkeep's sign-up
    // fail for a day under a setting nobody had touched.
    headers: {
      "content-type": "application/json",
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data?.["msg"] ?? data?.["error_description"] ?? data?.["message"] ?? "Sign-in failed");
    throw new Error(String(msg));
  }
  return data as Record<string, unknown>;
}

/** The signed-in user, or null. */
export function currentUser(): SbUser | null { return session?.user ?? null; }

/** Subscribe to sign-in / sign-out. Returns an unsubscribe fn. */
export function onAuth(fn: (u: SbUser | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function signIn(email: string, password: string): Promise<void> {
  const d = await authFetch("token?grant_type=password", { email, password });
  const s = sessionFromToken(d);
  if (!s) throw new Error("Unexpected sign-in response");
  store(s);
}

/** Returns true if a session started, false if email confirmation is required. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const d = await authFetch("signup", { email, password });
  const s = sessionFromToken(d);
  if (s) { store(s); return true; }
  return false; // project requires email confirmation before first sign-in
}

export function signOut(): void { store(null); }

/* ── PASSWORD RECOVERY ──────────────────────────────────────────────────
 *
 * There was none — not here, not in Hearthkeep, not in the idle game. A
 * forgotten password was an unrecoverable lockout, reported through the same
 * sentence as a typo, on an account that is SHARED across all three. Ported
 * from Hearthkeep's client, whose comments carry the reasoning in full.
 */

/**
 * Ask for a reset link.
 *
 * `/recover` answers 200 whether or not the address is known — it will not
 * confirm or deny that an account exists, which is correct of it (a form that
 * says "no such account" enumerates the user list) and a trap for the caller:
 * **a 200 is not evidence an email was sent.** So this promises only that the
 * request was accepted, and the wording at the call site promises the same.
 *
 * `redirect_to` IS NOT OPTIONAL, and it is a QUERY parameter rather than a body
 * field. Without it GoTrue sends the link to the project's Site URL — the
 * studio landing page, not this game — and the token is only read here, so the
 * whole flow dead-ends on a page that cannot finish it.
 *
 * COMPUTED FROM `location`, never written down: the three games are served
 * through rewrites under ONE origin (`/world`, `/hearthkeep`, `/varath`)
 * because localStorage is per-origin and the shared sign-in only carries if the
 * origin is shared. So the address to come back to is whatever this build is
 * being served as. The dashboard must still ALLOW it (Authentication -> URL
 * Configuration); GoTrue silently falls back to the Site URL for a redirect it
 * does not recognise, which looks exactly like the bug above.
 */
export async function resetPassword(email: string): Promise<void> {
  const back = `${window.location.origin}${window.location.pathname}`;
  await authFetch(`recover?redirect_to=${encodeURIComponent(back)}`, { email });
}

/**
 * The recovery token, if this page was opened from a reset link.
 *
 * GoTrue puts it in the URL FRAGMENT, which never reaches a server — that is
 * the point of it — so it has to be read here and taken out of the address bar
 * immediately, or a bookmark or a screenshot carries a live credential.
 */
export function recoveryToken(): string {
  const h = window.location.hash;
  if (h === "" || !h.includes("type=recovery")) return "";
  return new URLSearchParams(h.replace(/^#/, "")).get("access_token") ?? "";
}

/** Take the recovery token out of the address bar. */
export function clearRecoveryFragment(): void {
  if (window.location.hash === "") return;
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

/**
 * Set a new password using a recovery token, and return the address it belongs
 * to so the caller can sign in with it.
 *
 * `PUT /user` with the RECOVERY TOKEN as the bearer, not the publishable key —
 * this is the one call in this file that authenticates as a person rather than
 * as the anonymous role, so it cannot go through `authFetch`. Sending the key
 * instead 401s, and does so in a way that reads as "the link expired".
 *
 * The token is single-use and short-lived, so it is never stored as a session:
 * the caller signs in with the password just chosen, which is also the proof it
 * took.
 */
export async function setPassword(token: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });
  const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(d["msg"] ?? d["error_description"] ?? d["message"]
      ?? `The reset link was refused (HTTP ${res.status}). It may have expired — ask for a new one.`));
  }
  const user = d["user"] as Record<string, unknown> | undefined;
  const email = String(user?.["email"] ?? d["email"] ?? "");
  if (email === "") throw new Error("The password was changed but the account service said nothing useful.");
  return email;
}

/** A valid access token, refreshing if it's expired/near-expiry. */
async function freshToken(): Promise<string | null> {
  if (!session) return null;
  if (Date.now() / 1000 < session.expires_at - 60) return session.access_token;
  try {
    const d = await authFetch("token?grant_type=refresh_token", {
      refresh_token: session.refresh_token,
    });
    const s = sessionFromToken(d);
    if (s) { store(s); return s.access_token; }
  } catch { /* refresh failed — fall through to sign-out */ }
  store(null);
  return null;
}

/** Authenticated (or anon) REST call against the project's PostgREST API. */
export async function rest(
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<Response> {
  const token = (await freshToken()) ?? SUPABASE_KEY;
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    authorization: `Bearer ${token}`,
  };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.prefer) headers["prefer"] = init.prefer;
  const reqInit: RequestInit = { method: init.method ?? "GET", headers };
  if (init.body !== undefined) reqInit.body = JSON.stringify(init.body);
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, reqInit);
}
