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
