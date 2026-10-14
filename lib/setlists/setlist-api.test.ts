import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DatabaseNotConfiguredError } from "@/lib/persistence/prisma-client";

import { mapSetlistFailure, setlistError } from "./setlist-api";
import { SetlistError } from "./setlist-errors";
import { SetlistVersionConflictError } from "./setlist-repository";

describe("setlist API helpers", () => {
  it("builds error responses with issues", async () => {
    const response = setlistError(400, "INVALID_REQUEST", undefined, {
      issues: [{ path: "title", message: "Inválido." }],
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "Requisição inválida.",
        issues: [{ path: "title", message: "Inválido." }],
      },
    });
  });

  it("includes version extras for conflicts", async () => {
    const response = setlistError(409, "SETLIST_VERSION_CONFLICT", undefined, { version: 4 });
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SETLIST_VERSION_CONFLICT", version: 4 },
    });
  });

  it("includes followerCount extras", async () => {
    const response = setlistError(409, "SETLIST_HAS_FOLLOWERS", undefined, { followerCount: 2 });
    await expect(response.json()).resolves.toMatchObject({
      error: { followerCount: 2 },
    });
  });

  it("maps SetlistError instances", async () => {
    const response = await mapSetlistFailure(new SetlistError(403, "FORBIDDEN"));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("maps SetlistVersionConflictError", async () => {
    const response = await mapSetlistFailure(new SetlistVersionConflictError(7));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SETLIST_VERSION_CONFLICT", version: 7 },
    });
  });

  it("maps persistence failures", async () => {
    const response = await mapSetlistFailure(new DatabaseNotConfiguredError());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "DATABASE_NOT_CONFIGURED" },
    });
  });
});
