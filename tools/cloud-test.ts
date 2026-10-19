/**
 * tools/cloud-test.ts — does a SIGNED-IN start ever dead-end?
 *
 * WHY THIS EXISTS. "The Varath World link doesn't work on the IV Studios page
 * but it does elsewhere." Both addresses serve the same bundle; the difference
 * is that the studio's address shares one sign-in across every game, so World
 * is opened ALREADY signed in, holding a session another game wrote. Any
 * refusal from the save server — an expired or already-renewed token, a policy
 * error — fell into one screen, "Couldn't reach your saved world", whose only
 * button reloaded into the same refusal. On World's own address you have just
 * typed a password, so the token is fresh and none of it happens.
 *
 * So this serves dist/ under /world/ (the proxied shape), seeds a shared
 * session, answers every Supabase call from a fixture, and asserts each answer
 * leads somewhere a player can act on. No network: the fixtures ARE the server.
 *
 *   npm run build && npx tsx tools/cloud-test.ts
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const CHROME = process.env["PW_CHROME"] ?? "/opt/pw-browsers/chromium";
const DIST = join(import.meta.dirname, "..", "dist");
const REF = "iutyspbplhhamedhmvzu";
const KEY = "varath.sb.session";
const PORT = 4320;
const TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json",
};

const now = (): number => Math.floor(Date.now() / 1000);
const user = { id: "u-1", email: "t@example.com" };
const sess = (exp: number, rt = "rt"): object =>
  ({ access_token: "at", refresh_token: rt, expires_at: exp, user, ref: REF });

type Reply = [number, unknown] | "abort";
interface Case {
  name: string;
  session: object | null;
  saves?: Reply;
  refresh?: Reply;
  /** Another game renews the pair while World is mid-refresh with the old one. */
  race?: boolean;
  expect: RegExp;
  /** Whether the shared session must survive — it is every game's sign-in. */
  kept: boolean;
}

const CASES: Case[] = [
  { name: "signed in, empty save", session: sess(now() + 3600), saves: [200, []], expect: /Who will you become/, kept: true },
  { name: "token refused (401)", session: sess(now() + 3600), saves: [401, { code: "PGRST301", message: "JWT expired" }], expect: /sign-in had expired/, kept: false },
  { name: "policy refusal (403)", session: sess(now() + 3600), saves: [403, { code: "42501", message: "permission denied" }], expect: /refused[\s\S]*permission denied[\s\S]*Sign out[\s\S]*Play offline/, kept: true },
  { name: "network down", session: sess(now() + 3600), saves: "abort", expect: /Couldn't reach[\s\S]*Sign out[\s\S]*Play offline/, kept: true },
  { name: "expired, renewed", session: sess(now() - 100), refresh: [200, { access_token: "at2", refresh_token: "rt2", expires_in: 3600, user }], saves: [200, []], expect: /Who will you become/, kept: true },
  { name: "expired, refresh spent", session: sess(now() - 100), refresh: [400, { error: "invalid_grant" }], saves: [401, {}], expect: /sign-in had expired/, kept: false },
  { name: "renewed by another game", session: sess(now() - 100), race: true, saves: [200, []], expect: /Who will you become/, kept: true },
];

const server = http.createServer(async (req, res) => {
  let p = new URL(req.url ?? "/", "http://x").pathname;
  if (!p.startsWith("/world/")) { res.writeHead(404); res.end(); return; }
  p = p.slice("/world".length);
  if (p.endsWith("/")) p += "index.html";
  try {
    const body = await readFile(join(DIST, p));
    res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise<void>((r) => server.listen(PORT, r));

const browser = await chromium.launch({ executablePath: CHROME });
let failed = 0;
for (const c of CASES) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.route(/supabase\.co/, async (r) => {
    const url = r.request().url();
    const send = (x: Reply | undefined): Promise<void> => x === "abort" ? r.abort()
      : r.fulfill({ status: x?.[0] ?? 200, contentType: "application/json", body: JSON.stringify(x?.[1] ?? []) });
    if (url.includes("/auth/v1/token")) {
      if (c.race) {
        await page.evaluate(([k, s]) => localStorage.setItem(k as string, JSON.stringify(s)),
          [KEY, { ...sess(now() + 3600, "rt-other"), access_token: "other" }]);
        return send([400, { error: "invalid_grant", error_description: "Already Used" }]);
      }
      return send(c.refresh ?? [400, {}]);
    }
    if (url.includes("world_saves")) {
      if (c.race && r.request().headers()["authorization"] !== "Bearer other") return send([401, {}]);
      return send(c.saves);
    }
    return send([200, []]);
  });
  await page.addInitScript(([k, s]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.clear();
    if (s) localStorage.setItem(k as string, JSON.stringify(s));
  }, [KEY, c.session]);
  await page.goto(`http://localhost:${PORT}/world/`);
  let text = "";
  try {
    await page.waitForFunction((re) => new RegExp(re).test(document.getElementById("app")?.innerText ?? ""),
      c.expect.source, { timeout: 6000 });
  } catch { /* reported below */ }
  text = (await page.evaluate(() => document.getElementById("app")?.innerText ?? "")).replace(/\s+/g, " ");
  const kept = await page.evaluate((k) => localStorage.getItem(k) !== null, KEY);
  const ok = c.expect.test(text) && kept === c.kept;
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${c.name}${ok ? "" : `\n        session ${kept ? "kept" : "gone"} (want ${c.kept ? "kept" : "gone"})\n        screen: ${text.slice(0, 200)}`}`);
  await ctx.close();
}
await browser.close();
server.close();
if (failed > 0) { console.log(`\n${failed} signed-in start(s) went nowhere useful`); process.exit(1); }
console.log("\nevery signed-in start leads somewhere a player can act on");
