import { describe, expect, it } from "vitest";

import { createUnlockRateLimiter } from "./unlock-rate-limit";

describe("unlock rate limiter", () => {
  it("blocks the sixth attempt from the same IP even with a valid secret path", () => {
    const limiter = createUnlockRateLimiter();
    const ip = "203.0.113.10";
    const start = 1_000_000;

    for (let index = 0; index < 5; index += 1) {
      expect(limiter.check(ip, start + index).allowed).toBe(true);
      limiter.recordFailure(ip, start + index);
    }

    const blocked = limiter.check(ip, start + 10);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("clears the IP counter after a successful unlock", () => {
    const limiter = createUnlockRateLimiter();
    const ip = "203.0.113.11";
    const start = 2_000_000;

    for (let index = 0; index < 3; index += 1) {
      limiter.recordFailure(ip, start + index);
    }

    limiter.resetIp(ip);
    expect(limiter.check(ip, start + 100).allowed).toBe(true);
  });
});
