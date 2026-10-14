import {
  UNLOCK_MAX_FAILURES_GLOBAL,
  UNLOCK_MAX_FAILURES_PER_IP,
  UNLOCK_WINDOW_MS,
} from "./constants";

type WindowState = {
  startedAt: number;
  globalFailures: number;
  failuresByIp: Map<string, number>;
};

export type UnlockRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type UnlockRateLimiter = {
  check(ip: string, now: number): UnlockRateLimitDecision;
  recordFailure(ip: string, now: number): void;
  resetIp(ip: string): void;
};

function secondsUntilWindowEnd(state: WindowState, now: number): number {
  const end = state.startedAt + UNLOCK_WINDOW_MS;
  return Math.max(1, Math.ceil((end - now) / 1000));
}

function ensureWindow(state: WindowState, now: number): void {
  if (now - state.startedAt >= UNLOCK_WINDOW_MS) {
    state.startedAt = now;
    state.globalFailures = 0;
    state.failuresByIp.clear();
  }
}

export function createUnlockRateLimiter(): UnlockRateLimiter {
  const state: WindowState = {
    startedAt: Date.now(),
    globalFailures: 0,
    failuresByIp: new Map(),
  };

  return {
    check(ip: string, now: number): UnlockRateLimitDecision {
      ensureWindow(state, now);
      if (state.globalFailures >= UNLOCK_MAX_FAILURES_GLOBAL) {
        return { allowed: false, retryAfterSeconds: secondsUntilWindowEnd(state, now) };
      }
      const ipFailures = state.failuresByIp.get(ip) ?? 0;
      if (ipFailures >= UNLOCK_MAX_FAILURES_PER_IP) {
        return { allowed: false, retryAfterSeconds: secondsUntilWindowEnd(state, now) };
      }
      return { allowed: true };
    },
    recordFailure(ip: string, now: number): void {
      ensureWindow(state, now);
      state.globalFailures += 1;
      state.failuresByIp.set(ip, (state.failuresByIp.get(ip) ?? 0) + 1);
    },
    resetIp(ip: string): void {
      state.failuresByIp.delete(ip);
    },
  };
}

let defaultLimiter: UnlockRateLimiter | undefined;

export function getUnlockRateLimiter(): UnlockRateLimiter {
  defaultLimiter ??= createUnlockRateLimiter();
  return defaultLimiter;
}

export function resetUnlockRateLimiterForTests(): void {
  defaultLimiter = undefined;
}
