/**
 * src/client/loginUI.ts
 * ---------------------
 * The front door, in two beats:
 *
 *   1. A landing screen — the title and one "Play now" button. That single
 *      click is the real user gesture browsers demand before any audio may
 *      play, so the moment it's pressed the Varath theme comes up...
 *   2. ...over the sign-in screen: sign in (or create an account) with the
 *      SAME credentials as the idle game — Varath shares one Supabase project,
 *      so one identity spans both. Only once you're signed in does the game
 *      continue to character creation (new) or load your character (returning).
 *
 * Signing in syncs your character to the cloud (same account as the idle game).
 * You can also "Play offline" for a purely local character saved in this
 * browser — handy for the downloadable single-file build or playing without an
 * account; that character never touches the cloud.
 */

import {
  clearRecoveryFragment, lastAuthFailure, projectRef, recoveryToken, resetPassword,
  setPassword, signIn, signUp, staleSessionRef,
} from "./supabase.ts";
import { audio } from "./audio.ts";

/**
 * WHY YOU WERE SIGNED OUT, when the app actually knows.
 *
 * `readSession` drops a session issued by a different project — correct, and it
 * used to be silent, which is what turned a repointed backend into an
 * unexplainable login failure. `SESSION_KEY` is shared across all three games on
 * purpose, so they all dropped their sessions at the same moment and all showed
 * the same useless refusal. Saying so is the difference between one fault and
 * three.
 */
function staleNotice(): string {
  const ref = staleSessionRef();
  if (ref === "") return "";
  const esc = (t: string): string => t.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
  return `<div class="login-stale">You were signed out because this game's account service was
    replaced — your session came from <b>${esc(ref)}</b> and this build talks to
    <b>${esc(projectRef())}</b>. Accounts made before then did not carry over, here or in the idle
    game or Hearthkeep, which share one sign-in. <b>Create your account again with the same
    email</b> and it will work in all three.</div>`;
}

export class LoginUI {
  private backdrop: HTMLElement;

  constructor(root: HTMLElement, private onDone: () => void, private onOffline?: () => void) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "login-backdrop";
    root.appendChild(this.backdrop);
    /*
     * ARRIVING BACK FROM A RESET LINK SKIPS THE LANDING BEAT.
     *
     * Someone who followed a link out of their email has already decided to be
     * here; making them press "Play now" first would be a gate in front of the
     * one thing they came to do. The audio unlock the landing exists for is a
     * nicety, and it is not worth a step here.
     *
     * The token has to come off the address bar immediately either way — a
     * bookmark or a screenshot of that URL is a live credential.
     */
    const tok = recoveryToken();
    if (tok !== "") {
      clearRecoveryFragment();
      this.showNewPassword(tok);
      return;
    }
    this.showLanding();
  }

  /** Beat one: the title and a single Play button — the click that wakes the
   *  audio engine (autoplay policy), so the theme carries into sign-in. */
  private showLanding(): void {
    this.backdrop.innerHTML = `
      <div class="login-box">
        <div class="login-title">VARATH</div>
        <div class="login-sub">The stone remembers, and the moon watches.</div>
        <button class="login-play" type="button">Play now</button>
        <div class="login-foot">An old-school adventure — free to play in your browser.</div>
      </div>`;
    const play = this.backdrop.querySelector(".login-play") as HTMLButtonElement;
    play.addEventListener("click", () => {
      audio.unlock(); // the gesture the browser was waiting for — theme up
      this.showSignIn();
    });
  }

  /** Beat two: the sign-in screen proper, with the theme already playing. */
  private showSignIn(): void {
    this.backdrop.innerHTML = `
      <div class="login-box">
        <div class="login-title">VARATH</div>
        <div class="login-sub">Sign in to enter the world.</div>
        <form class="login-form">
          <input class="login-email" type="email" placeholder="email"
                 autocomplete="email" required />
          <input class="login-pass" type="password" placeholder="password"
                 autocomplete="current-password" required />
          <button class="login-go" type="submit">Sign in</button>
          <button class="login-create" type="button">Create account</button>
          <button class="login-forgot" type="button">Forgot your password?</button>
          <div class="login-msg"></div>
          <div class="login-raw"></div>
        </form>
        ${staleNotice()}
        <button class="login-offline" type="button">Play offline</button>
        <div class="login-foot">Same account as the idle game and Hearthkeep — one sign-in across every
          IronVail game. Offline play saves only in this browser.</div>
        <div class="login-ref">this build talks to <b>${projectRef()}</b></div>
        <button class="login-mute" type="button"></button>
      </div>`;

    const form = this.backdrop.querySelector(".login-form") as HTMLFormElement;
    const email = this.backdrop.querySelector(".login-email") as HTMLInputElement;
    const pass = this.backdrop.querySelector(".login-pass") as HTMLInputElement;
    const go = this.backdrop.querySelector(".login-go") as HTMLButtonElement;
    const create = this.backdrop.querySelector(".login-create") as HTMLButtonElement;
    const msg = this.backdrop.querySelector(".login-msg") as HTMLElement;

    const raw = this.backdrop.querySelector(".login-raw") as HTMLElement;
    const busy = (on: boolean): void => { go.disabled = on; create.disabled = on; };
    const say = (m: string, ok = false): void => {
      msg.textContent = m;
      msg.classList.toggle("ok", ok);
      // The verbatim refusal, under the sentence, in small type. It is the
      // difference between "sign in is broken" and knowing WHICH thing said no.
      raw.textContent = ok || m === "" ? "" : lastAuthFailure();
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      say("");
      busy(true);
      signIn(email.value.trim(), pass.value)
        .then(() => this.finish())
        .catch((ex) => { say(ex?.message ?? "Sign-in failed"); busy(false); });
    });

    create.addEventListener("click", () => {
      say("");
      if (!email.value.trim() || !pass.value) { say("Enter an email and password first."); return; }
      busy(true);
      signUp(email.value.trim(), pass.value)
        .then((started) => {
          if (started) this.finish();
          else { say("Account made — check your email to confirm, then sign in.", true); busy(false); }
        })
        .catch((ex) => { say(ex?.message ?? "Sign-up failed"); busy(false); });
    });

    // There was no way to reset a password anywhere in this game, and the
    // account is shared with the idle game and Hearthkeep — so a forgotten one
    // locked you out of all three at once, reported through the same sentence
    // as a typo.
    const forgot = this.backdrop.querySelector(".login-forgot") as HTMLButtonElement;
    forgot.addEventListener("click", () => { this.showReset(email.value.trim()); });

    // The sound toggle: mute persists from the game, so a returning player who
    // muted in the HUD sees why the theme is silent — and can flip it back on.
    const mute = this.backdrop.querySelector(".login-mute") as HTMLButtonElement;
    const syncMute = (): void => { mute.textContent = audio.getMuted() ? "Sound: Off" : "Sound: On"; mute.classList.toggle("off", audio.getMuted()); };
    syncMute();
    mute.addEventListener("click", () => { audio.setMuted(!audio.getMuted()); syncMute(); });

    const offline = this.backdrop.querySelector(".login-offline") as HTMLButtonElement;
    if (this.onOffline) {
      offline.addEventListener("click", () => { this.backdrop.remove(); this.onOffline!(); });
    } else {
      offline.remove();
    }
  }

  /** Ask for a reset link. */
  private showReset(prefill: string): void {
    this.backdrop.innerHTML = `
      <div class="login-box">
        <div class="login-title">VARATH</div>
        <div class="login-sub">Reset your password.</div>
        <form class="login-form">
          <input class="login-email" type="email" placeholder="email"
                 autocomplete="email" required value="${prefill.replace(/"/g, "&quot;")}" />
          <button class="login-go" type="submit">Send the link</button>
          <button class="login-create" type="button">Back to sign in</button>
          <div class="login-msg"></div>
        </form>
        <div class="login-foot">One account across every game — resetting here resets it everywhere.</div>
      </div>`;

    const form = this.backdrop.querySelector(".login-form") as HTMLFormElement;
    const email = this.backdrop.querySelector(".login-email") as HTMLInputElement;
    const go = this.backdrop.querySelector(".login-go") as HTMLButtonElement;
    const msg = this.backdrop.querySelector(".login-msg") as HTMLElement;
    const say = (m: string, ok = false): void => { msg.textContent = m; msg.classList.toggle("ok", ok); };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const addr = email.value.trim();
      if (addr === "") { say("An email address, please."); return; }
      go.disabled = true;
      say("Sending…", true);
      resetPassword(addr)
        // DELIBERATELY CONDITIONAL. `/recover` answers 200 whether or not the
        // address is known, so "we sent you an email" would be a claim this
        // code cannot make. It promises only that the request was accepted.
        .then(() => { say(`If there is an account for ${addr}, a link is on its way.`, true); go.disabled = false; })
        .catch((ex) => { say((ex as Error)?.message ?? "Could not send the link"); go.disabled = false; });
    });

    (this.backdrop.querySelector(".login-create") as HTMLButtonElement)
      .addEventListener("click", () => { this.showSignIn(); });
  }

  /** Choose a new password, having followed the emailed link. */
  private showNewPassword(token: string): void {
    this.backdrop.innerHTML = `
      <div class="login-box">
        <div class="login-title">VARATH</div>
        <div class="login-sub">Choose a new password.</div>
        <form class="login-form">
          <input class="login-pass" type="password" placeholder="new password"
                 autocomplete="new-password" required />
          <button class="login-go" type="submit">Set it and enter</button>
          <button class="login-create" type="button">Cancel</button>
          <div class="login-msg"></div>
        </form>
        <div class="login-foot">The link works once. If it has expired, ask for another.</div>
      </div>`;

    const form = this.backdrop.querySelector(".login-form") as HTMLFormElement;
    const pass = this.backdrop.querySelector(".login-pass") as HTMLInputElement;
    const go = this.backdrop.querySelector(".login-go") as HTMLButtonElement;
    const msg = this.backdrop.querySelector(".login-msg") as HTMLElement;
    const say = (m: string, ok = false): void => { msg.textContent = m; msg.classList.toggle("ok", ok); };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (pass.value.length < 6) { say("Password needs to be at least six characters."); return; }
      go.disabled = true;
      say("Setting it…", true);
      setPassword(token, pass.value)
        // The recovery token is single-use and short-lived, so it is never kept
        // as a session: signing in with the password just chosen is both the
        // way in and the proof it took.
        .then((addr) => signIn(addr, pass.value))
        .then(() => { this.finish(); })
        .catch((ex) => { say((ex as Error)?.message ?? "Could not set the password"); go.disabled = false; });
    });

    (this.backdrop.querySelector(".login-create") as HTMLButtonElement)
      .addEventListener("click", () => { this.showSignIn(); });
  }

  private finish(): void {
    this.backdrop.remove();
    this.onDone();
  }
}
