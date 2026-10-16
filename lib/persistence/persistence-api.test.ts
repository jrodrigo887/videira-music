import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getCurrentActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: getCurrentActorMock,
}));

import { testUserActor } from "@/lib/auth/test-actor";

import { wrapPersistenceRoute } from "./persistence-api";

describe("wrapPersistenceRoute", () => {
  it("returns 403 when permission is omitted and does not call the handler", async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = wrapPersistenceRoute({ route: "/api/test", method: "GET" }, handler);
    const response = await wrapped(new Request("http://localhost/api/test"));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: { code: "FORBIDDEN" } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when permission is set but there is no session", async () => {
    getCurrentActorMock.mockResolvedValue({ kind: "anonymous" });
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = wrapPersistenceRoute(
      { route: "/api/test", method: "GET", permission: "music:read" },
      handler,
    );
    const response = await wrapped(new Request("http://localhost/api/test"));
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls the handler when the actor has the required capability", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: "org-default",
        roles: ["musician"],
        teams: [],
      }),
    );
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = wrapPersistenceRoute(
      { route: "/api/test", method: "GET", permission: "music:read" },
      handler,
    );
    const response = await wrapped(new Request("http://localhost/api/test"));
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});
