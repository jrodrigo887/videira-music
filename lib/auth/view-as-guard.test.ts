import { describe, expect, it } from "vitest";

import { viewAsMutationResponse } from "./view-as-guard";
import { testUserActor } from "./test-actor";

describe("viewAsMutationResponse", () => {
  it("returns 403 VIEW_AS_READONLY when viewAs is active", async () => {
    const actor = testUserActor({
      userId: "admin",
      organizationId: "org",
      roles: ["admin"],
      teams: [],
      viewAs: { realUserId: "admin", expiresAt: "2099-01-01T00:00:00.000Z" },
    });
    const response = viewAsMutationResponse(actor);
    expect(response?.status).toBe(403);
    const body = await response?.json();
    expect(body).toEqual({ error: { code: "VIEW_AS_READONLY" } });
  });

  it("returns undefined without viewAs", () => {
    const actor = testUserActor({
      userId: "admin",
      organizationId: "org",
      roles: ["admin"],
      teams: [],
    });
    expect(viewAsMutationResponse(actor)).toBeUndefined();
  });
});
