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

import { signIn, signUp } from "./supabase.ts";
import { audio } from "./audio.ts";

export class LoginUI {
  private backdrop: HTMLElement;

  constructor(root: HTMLElement, private onDone: () => void, private onOffline?: () => void) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "login-backdrop";
    root.appendChild(this.backdrop);
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
          <div class="login-msg"></div>
        </form>
        <button class="login-offline" type="button">Play offline</button>
        <div class="login-foot">Same account as the idle game. Offline play saves only in this browser.</div>
        <button class="login-mute" type="button"></button>
      </div>`;

    const form = this.backdrop.querySelector(".login-form") as HTMLFormElement;
    const email = this.backdrop.querySelector(".login-email") as HTMLInputElement;
    const pass = this.backdrop.querySelector(".login-pass") as HTMLInputElement;
    const go = this.backdrop.querySelector(".login-go") as HTMLButtonElement;
    const create = this.backdrop.querySelector(".login-create") as HTMLButtonElement;
    const msg = this.backdrop.querySelector(".login-msg") as HTMLElement;

    const busy = (on: boolean): void => { go.disabled = on; create.disabled = on; };
    const say = (m: string, ok = false): void => {
      msg.textContent = m;
      msg.classList.toggle("ok", ok);
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

  private finish(): void {
    this.backdrop.remove();
    this.onDone();
  }
}
