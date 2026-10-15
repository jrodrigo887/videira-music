type WindowState = {
  startedAt: number;
  failuresByIp: Map<string, number>;
};

export type FailureRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type FailureRateLimiter = {
  check(ip: string, now: number): FailureRateLimitDecision;
  recordFailure(ip: string, now: number): void;
  resetForTests(): void;
};

export function createFailureRateLimiter(options: {
  windowMs: number;
  maxFailuresPerIp: number;
}): FailureRateLimiter {
  const state: WindowState = {
    startedAt: Date.now(),
    failuresByIp: new Map(),
  };

  function secondsUntilWindowEnd(now: number): number {
    const end = state.startedAt + options.windowMs;
    return Math.max(1, Math.ceil((end - now) / 1000));
  }

  function ensureWindow(now: number): void {
    if (now - state.startedAt >= options.windowMs) {
      state.startedAt = now;
      state.failuresByIp.clear();
    }
  }

  return {
    check(ip: string, now: number): FailureRateLimitDecision {
      ensureWindow(now);
      const ipFailures = state.failuresByIp.get(ip) ?? 0;
      if (ipFailures >= options.maxFailuresPerIp) {
        return { allowed: false, retryAfterSeconds: secondsUntilWindowEnd(now) };
      }
      return { allowed: true };
    },
    recordFailure(ip: string, now: number): void {
      ensureWindow(now);
      state.failuresByIp.set(ip, (state.failuresByIp.get(ip) ?? 0) + 1);
    },
    resetForTests(): void {
      state.startedAt = Date.now();
      state.failuresByIp.clear();
    },
  };
}
