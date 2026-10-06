const LOCK_KEY = "likharrio-login-lock";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

type LockState = { attempts: number; lockedUntil: number };

function storage(): Storage | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage;
}

function readLock(): LockState {
  try {
    const raw = storage()?.getItem(LOCK_KEY);
    if (!raw) return { attempts: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw) as LockState;
    return {
      attempts: Number(parsed.attempts) || 0,
      lockedUntil: Number(parsed.lockedUntil) || 0,
    };
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function writeLock(state: LockState) {
  storage()?.setItem(LOCK_KEY, JSON.stringify(state));
}

export function loginLockMessage(): string | null {
  const state = readLock();
  if (state.lockedUntil > Date.now()) {
    const minutes = Math.max(1, Math.ceil((state.lockedUntil - Date.now()) / 60000));
    return `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }
  return null;
}

export function recordLoginFailure() {
  const state = readLock();
  const attempts = state.lockedUntil > Date.now() ? state.attempts : state.attempts + 1;
  writeLock({
    attempts,
    lockedUntil: attempts >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0,
  });
}

export function clearLoginFailures() {
  storage()?.removeItem(LOCK_KEY);
}

export function accountRole(role: string | null | undefined): "artist" | "enthusiast" {
  return role === "artist" ? "artist" : "enthusiast";
}
