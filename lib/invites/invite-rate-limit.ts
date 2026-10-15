import { createFailureRateLimiter } from "@/lib/http/failure-rate-limit";

const INVITE_WINDOW_MS = 15 * 60 * 1000;
const INVITE_MAX_FAILURES_PER_IP = 10;

let limiter = createFailureRateLimiter({
  windowMs: INVITE_WINDOW_MS,
  maxFailuresPerIp: INVITE_MAX_FAILURES_PER_IP,
});

export function getInviteTokenRateLimiter() {
  return limiter;
}

export function resetInviteTokenRateLimiterForTests(): void {
  limiter = createFailureRateLimiter({
    windowMs: INVITE_WINDOW_MS,
    maxFailuresPerIp: INVITE_MAX_FAILURES_PER_IP,
  });
}
