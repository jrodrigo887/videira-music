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

  it("uses the seeded admin when localhost login is off and no user is set", () => {
    expect(resolveSimulatedUserId({ NODE_ENV: "development", DEV_LOCALHOST: "true" })).toBe(
      "user-admin",
    );
  });

  it("keeps an explicit simulated user when localhost login is off", () => {
    expect(
      resolveSimulatedUserId({
        NODE_ENV: "development",
        DEV_LOCALHOST: "true",
        VIDEIRA_SIMULATED_USER_ID: "user-leader",
      }),
    ).toBe("user-leader");
  });

  it("ignores the simulated user when localhost login is on", () => {
    expect(
      resolveSimulatedUserId({
        NODE_ENV: "development",
        DEV_LOCALHOST: "false",
        VIDEIRA_SIMULATED_USER_ID: "user-admin",
      }),
    ).toBeUndefined();
  });
});
