import { describe, expect, it } from "vitest";

import { resolveSimulatedUserId } from "./simulated-auth";

describe("resolveSimulatedUserId", () => {
  it("returns the configured user outside production", () => {
    expect(
      resolveSimulatedUserId({ NODE_ENV: "development", VIDEIRA_SIMULATED_USER_ID: " user-admin " }),
    ).toBe("user-admin");
  });

  it("is anonymous when no user is configured", () => {
    expect(resolveSimulatedUserId({ NODE_ENV: "development" })).toBeUndefined();
    expect(
      resolveSimulatedUserId({ NODE_ENV: "development", VIDEIRA_SIMULATED_USER_ID: "  " }),
    ).toBeUndefined();
  });

  it("never accepts a simulated user in production", () => {
    expect(
      resolveSimulatedUserId({ NODE_ENV: "production", VIDEIRA_SIMULATED_USER_ID: "user-admin" }),
    ).toBeUndefined();
  });
});
