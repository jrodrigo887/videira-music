import { getInviteTokenRateLimiter } from "@/lib/invites/invite-rate-limit";

export const INVITE_RATE_LIMIT_MESSAGE =
  "Muitas tentativas. Tente novamente em alguns minutos.";

export function createInviteRateLimitResponse(ip: string, now: number): Response | null {
  const decision = getInviteTokenRateLimiter().check(ip, now);
  if (decision.allowed) {
    return null;
  }

  return new Response(INVITE_RATE_LIMIT_MESSAGE, {
    status: 429,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": String(decision.retryAfterSeconds),
    },
  });
}
