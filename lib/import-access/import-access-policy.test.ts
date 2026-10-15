import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { canImport } from "./import-access-policy";
import { resetImportModuleConfigForTests } from "./import-module-config";

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: vi.fn(),
}));

import { getCurrentActor } from "@/lib/auth/current-actor";

describe("canImport", () => {
  beforeEach(() => {
    resetImportModuleConfigForTests();
    vi.resetAllMocks();
  });

  afterEach(() => {
    delete process.env.VIDEIRA_ENABLE_IMPORT;
    delete process.env.VIDEIRA_SIMULATED_USER_ID;
  });

  it("returns disabled when the import flag is off", async () => {
    process.env.VIDEIRA_ENABLE_IMPORT = "false";
    await expect(canImport(new Request("http://local"))).resolves.toBe("disabled");
  });

  it("returns locked for anonymous users", async () => {
    process.env.VIDEIRA_ENABLE_IMPORT = "true";
    vi.mocked(getCurrentActor).mockResolvedValue({ kind: "anonymous" });
    await expect(canImport(new Request("http://local"))).resolves.toBe("locked");
  });

  it("returns allowed for worship leader with flag on", async () => {
    process.env.VIDEIRA_ENABLE_IMPORT = "true";
    vi.mocked(getCurrentActor).mockResolvedValue({
      kind: "user",
      userId: "user-leader",
      organizationId: "org-default",
      roles: ["worship_leader"],
      teams: [],
    });
    await expect(canImport(new Request("http://local"))).resolves.toBe("allowed");
  });

  it("returns locked for musician without import permission", async () => {
    process.env.VIDEIRA_ENABLE_IMPORT = "true";
    vi.mocked(getCurrentActor).mockResolvedValue({
      kind: "user",
      userId: "user-musician",
      organizationId: "org-default",
      roles: ["musician"],
      teams: [],
    });
    await expect(canImport(new Request("http://local"))).resolves.toBe("locked");
  });
});
