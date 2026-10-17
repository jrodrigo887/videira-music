import { getShareTokenRateLimiter } from "@/lib/setlists/share-rate-limit";

export const SHARE_RATE_LIMIT_MESSAGE =
  "Muitas tentativas. Tente novamente em alguns minutos.";

export function createShareRateLimitResponse(ip: string, now: number): Response | null {
  const decision = getShareTokenRateLimiter().check(ip, now);
  if (decision.allowed) {
    return null;
  }

  return new Response(SHARE_RATE_LIMIT_MESSAGE, {
    status: 429,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": String(decision.retryAfterSeconds),
    },
  });
}
