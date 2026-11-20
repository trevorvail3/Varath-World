/**
 * src/client/storage.ts
 * ---------------------
 * The only place that touches the browser's localStorage. Saves are now keyed
 * by *account* (a local profile name) so several characters can live side by
 * side — the idle game's "log in" feel, without a server. The *meaning* of a
 * save blob (its shape + validation) still lives in the pure core
 * (src/core/save.ts). Everything is wrapped in try/catch so private-browsing
 * mode or a full disk can never crash the game.
 */

const LEGACY_KEY = "varath-world-save-v1";
const INDEX_KEY = "varath-world-accounts";
const saveKey = (name: string): string => `${LEGACY_KEY}::${name}`;

/**
 * Read one device preference, or null if it is unset OR storage is blocked.
 * Reading `localStorage` throws a SecurityError when the browser denies site
 * storage ("Block all cookies", some in-app webviews); a preference read on the
 * boot path that throws leaves the player on a blank page. Every caller treats
 * null as "use the default".
 */
export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The account whose save reads/writes currently target. */
let current: string | null = null;

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((n) => typeof n === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(list: string[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Every account that has a save (migrating a pre-accounts single save once). */
export function listAccounts(): string[] {
  const idx = readIndex();
  if (idx.length === 0) {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        let name = "Wanderer";
        try {
          const p = JSON.parse(legacy);
          if (p?.appearance?.name && typeof p.appearance.name === "string") name = p.appearance.name;
        } catch { /* keep default */ }
        localStorage.setItem(saveKey(name), legacy);
        // Move, don't copy: a lingering legacy blob would be re-imported on every
        // reload (resurrecting the character even after a reset), so this is a
        // genuine one-time migration.
        localStorage.removeItem(LEGACY_KEY);
        writeIndex([name]);
        return [name];
      }
    } catch { /* ignore */ }
  }
  return idx;
}

export function currentAccount(): string | null {
  return current;
}

/** Make `name` the active account (adding it to the index if new). */
export function setCurrentAccount(name: string): void {
  current = name;
  const idx = readIndex();
  if (!idx.includes(name)) {
    idx.push(name);
    writeIndex(idx);
  }
}

/** Read a specific account's raw saved object (without changing the active one).
 *  Used by the local hiscores backend to rank every character on this device. */
export function readSaveFor(name: string): unknown | null {
  try {
    const raw = localStorage.getItem(saveKey(name));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Read the active account's raw saved object, or null. */
export function readSave(): unknown | null {
  if (!current) return null;
  try {
    const raw = localStorage.getItem(saveKey(current));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Persist a (already-serialised) progress object for the active account. */
export function writeSave(data: unknown): void {
  if (!current) return;
  try {
    localStorage.setItem(saveKey(current), JSON.stringify(data));
    const idx = readIndex();
    if (!idx.includes(current)) { idx.push(current); writeIndex(idx); }
  } catch {
    /* storage unavailable or full — progress just won't persist this time */
  }
}

/** Wipe the active account's save and forget the account. */
export function clearSave(): void {
  if (!current) return;
  try {
    localStorage.removeItem(saveKey(current));
    writeIndex(readIndex().filter((n) => n !== current));
    // Also clear any pre-accounts save. If it survives, listAccounts() re-imports
    // it on the next reload and the wiped character comes straight back — so a
    // reset could never actually start over.
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* nothing we can do; ignore */
  }
}

/** Wipe EVERY local save on this device (all accounts + the legacy slot).
 *  A reset must use this: cloud saves migrate the old name-keyed character into
 *  the account slot but leave the original copy behind, so clearing only the
 *  active account lets that leftover be re-adopted on the next load — the wipe
 *  would silently undo itself. */
export function clearAllSaves(): void {
  try {
    for (const name of readIndex()) localStorage.removeItem(saveKey(name));
    writeIndex([]);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* nothing we can do; ignore */
  }
}
