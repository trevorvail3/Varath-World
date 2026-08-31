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

/**
 * THE PROJECT THAT ISSUED THE SESSION WE THREW AWAY.
 *
 * Dropping a foreign-ref session is right. Doing it SILENTLY is what made the
 * August repoint undiagnosable: the comment below used to say there was
 * "nothing the player did, nothing they can do", and the second half is false.
 * There is something they can do — make the account again — and without being
 * told they are dropped on a form that CANNOT succeed, reporting an error that
 * reads as a mistyped password.
 *
 * It has to outlive the discard, because the session is deleted the first time
 * it is read. Hence a separate key, cleared on the next successful write.
 */
const STALE_KEY = "varath.sb.staleref";
let staleRef = (() => { try { return localStorage.getItem(STALE_KEY) ?? ""; } catch { return ""; } })();

/** Which project signed the session that was dropped, or "" if none was. */
export function staleSessionRef(): string { return staleRef; }

/**
 * Which project THIS BUILD talks to. Shown on the sign-in screen.
 *
 * A phone runs whatever bundle it last fetched, and no amount of
 * dashboard-checking answers whether the code in front of you is pointed at the
 * right project — the answer is baked into the running JavaScript. Public
 * information: the ref ships in every request this app makes.
 */
export function projectRef(): string { return PROJECT_REF; }

let session: Session | null = readSession();
const listeners = new Set<(u: SbUser | null) => void>();

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s?.ref !== PROJECT_REF) {
      // Issued by a different project — keep WHICH one before dropping it, so
      // the screen can explain the sign-out instead of leaving the player on a
      // form that can never work. See `staleRef` above.
      staleRef = typeof s?.ref === "string" && s.ref !== "" ? s.ref : "an earlier project";
      try { localStorage.setItem(STALE_KEY, staleRef); } catch { /* ignore */ }
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
  // A session from THIS project answers the question the notice asks, so the
  // notice goes. On write rather than on sign-out: signing out deliberately is
  // not evidence the repoint has been dealt with.
  if (s && staleRef !== "") {
    staleRef = "";
    try { localStorage.removeItem(STALE_KEY); } catch { /* ignore */ }
  }
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
  let res: Response;
  try {
    res = await doAuthFetch(path, body);
  } catch {
    /*
     * `fetch` REJECTS rather than resolving for DNS failure, no network, a
     * blocked request and CORS. Left raw that surfaces as "Failed to fetch",
     * which tells a player nothing. THE HOST IS THE POINT of naming it: a
     * deleted project stops resolving, so a stale bundle fails here and looks
     * identical to a network problem.
     */
    lastFailure = `POST ${SUPABASE_URL}/auth/v1/${path}\nnever completed — DNS, CORS, offline, or that project is gone.`;
    throw new Error("Could not reach the account service. Check your connection and try again.");
  }
  return finishAuth(path, res);
}

function doAuthFetch(path: string, body: unknown): Promise<Response> {
  return fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
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
}

async function finishAuth(path: string, res: Response): Promise<Record<string, unknown>> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    lastFailure = `POST ${SUPABASE_URL}/auth/v1/${path} -> ${res.status}\n${JSON.stringify(data)}`;
    console.error(`[auth] ${lastFailure}`);
    throw authError(res.status, data);
  }
  lastFailure = "";
  return data;
}

/**
 * What the server actually said, last time it said no.
 *
 * A console line is useless on the device this game is played on. This is the
 * same detail, kept so the sign-in screen can put it under the error in small
 * type — status, endpoint and the body verbatim. Two rounds of "sign in isn't
 * working" were spent guessing in the other game because nothing on screen
 * distinguished a refused key from a refused password.
 */
let lastFailure = "";
export function lastAuthFailure(): string { return lastFailure; }

/**
 * Every refusal GoTrue can hand back, in one place.
 *
 * This used to read three field names and then fall through to the literal
 * string "Sign-in failed", which tells a player nothing and tells us nothing
 * either. Two of the entries below are PROJECT SETTINGS rather than anything
 * the player did, so they name the switch: those are the ones that cost this
 * studio a day.
 *
 * The status code goes on the end of anything unrecognised, because an
 * unrecognised failure still has to be diagnosable from a screenshot — and a
 * screenshot is usually all there is.
 */
function authError(status: number, d: Record<string, unknown>): Error {
  const raw = d["error_description"] ?? d["msg"] ?? d["message"] ?? d["error"] ?? d["error_code"];
  const known: Record<string, string> = {
    invalid_credentials: "That email and password do not match an account.",
    email_not_confirmed: "Confirm your email first — check your inbox for the link.",
    user_already_exists: "There is already an account with that email. Sign in instead.",
    weak_password: "Password needs to be at least six characters.",
    over_email_send_rate_limit: "Too many emails just now. Wait a few minutes and try again.",
    signup_disabled: "New accounts are switched off for this project (Authentication → Sign In / Providers → Email → Allow new users to sign up).",
    email_provider_disabled: "Email sign-in is switched off for this project (Authentication → Sign In / Providers → Email).",
    validation_failed: "That email address was refused as malformed.",
  };
  const code = typeof d["error_code"] === "string" ? d["error_code"] : undefined;
  const friendly = code !== undefined ? known[code] : undefined;
  if (friendly !== undefined) return new Error(friendly);
  return new Error(raw !== undefined ? `${String(raw)} (HTTP ${status})`
    : `The account service refused the request (HTTP ${status}).`);
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
