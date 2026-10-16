import { describe, expect, it } from "vitest";

import { earliestDelegationExpiry } from "./actor";
import { testUserActor } from "./test-actor";

describe("earliestDelegationExpiry", () => {
  it("returns the smallest expiresAt among active delegations", () => {
    const actor = testUserActor({
      userId: "u1",
      organizationId: "org",
      roles: ["musician"],
      teams: [],
      delegations: [
        {
          capabilities: ["setlists:led"],
          teamIds: ["team-a"],
          expiresAt: "2026-12-01T00:00:00.000Z",
        },
        {
          capabilities: ["music:write"],
          teamIds: [],
          expiresAt: "2026-11-15T00:00:00.000Z",
        },
      ],
    });
    expect(earliestDelegationExpiry(actor)).toBe("2026-11-15T00:00:00.000Z");
  });

  it("returns undefined when there are no delegations", () => {
    const actor = testUserActor({
      userId: "u1",
      organizationId: "org",
      roles: ["musician"],
      teams: [],
    });
    expect(earliestDelegationExpiry(actor)).toBeUndefined();
    expect(earliestDelegationExpiry({ kind: "anonymous" })).toBeUndefined();
  });
});
