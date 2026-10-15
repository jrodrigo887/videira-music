import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAuthApiTestContext, type AuthApiTestContext } from "@/lib/auth/auth-route-test-helpers";

import { recordImportLog } from "./import-log";

describe("recordImportLog", () => {
  let context: AuthApiTestContext;

  beforeEach(async () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    context = await createAuthApiTestContext("user-leader");
  });

  afterEach(async () => {
    await context.cleanup();
    vi.unstubAllEnvs();
  });

  it("stores userId from the current actor", async () => {
    await recordImportLog({
      action: "preview",
      outcome: "success",
      url: "https://www.cifraclub.com.br/x/y/",
    });

    const row = await context.prisma.importLog.findFirst({
      orderBy: { occurredAt: "desc" },
    });
    expect(row?.userId).toBe("user-leader");
    expect(row?.action).toBe("preview");
  });
});
