import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DELETE, POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("import session routes (removed)", () => {
  it("POST always returns 404", async () => {
    const response = await POST();
    expect(response.status).toBe(404);
  });

  it("DELETE always returns 404", async () => {
    const response = await DELETE();
    expect(response.status).toBe(404);
  });
});
