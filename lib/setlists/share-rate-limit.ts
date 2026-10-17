import { createFailureRateLimiter } from "@/lib/http/failure-rate-limit";

const SHARE_WINDOW_MS = 15 * 60 * 1000;
const SHARE_MAX_FAILURES_PER_IP = 10;

let limiter = createFailureRateLimiter({
  windowMs: SHARE_WINDOW_MS,
  maxFailuresPerIp: SHARE_MAX_FAILURES_PER_IP,
});

export function getShareTokenRateLimiter() {
  return limiter;
}

export function resetShareTokenRateLimiterForTests(): void {
  limiter = createFailureRateLimiter({
    windowMs: SHARE_WINDOW_MS,
    maxFailuresPerIp: SHARE_MAX_FAILURES_PER_IP,
  });
}
