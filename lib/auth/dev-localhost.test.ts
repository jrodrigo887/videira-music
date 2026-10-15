import { describe, expect, it } from "vitest";

import { isDevLocalhost } from "./dev-localhost";

describe("isDevLocalhost", () => {
  it("is on only when DEV_LOCALHOST is true outside production", () => {
    expect(isDevLocalhost({ NODE_ENV: "development", DEV_LOCALHOST: "true" })).toBe(true);
    expect(isDevLocalhost({ NODE_ENV: "test", DEV_LOCALHOST: "true" })).toBe(true);
  });

  it("is off for false, empty, and missing values", () => {
    expect(isDevLocalhost({ NODE_ENV: "development", DEV_LOCALHOST: "false" })).toBe(false);
    expect(isDevLocalhost({ NODE_ENV: "development", DEV_LOCALHOST: "TRUE" })).toBe(false);
    expect(isDevLocalhost({ NODE_ENV: "development" })).toBe(false);
  });

  it("never turns login off in production", () => {
    expect(isDevLocalhost({ NODE_ENV: "production", DEV_LOCALHOST: "true" })).toBe(false);
  });
});
