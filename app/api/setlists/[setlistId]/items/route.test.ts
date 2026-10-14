import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FIXTURE_CHART, FIXTURE_SONG } from "@/lib/setlists/setlist-test-fixture";
import { PrismaSetlistRepository } from "@/lib/setlists/prisma-setlist-repository";
import {
  createRouteTestContext,
  withSimulatedUser,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import { createSetlistItemsPutHandler } from "./route";

describe("PUT /api/setlists/[setlistId]/items", () => {
  let context: RouteTestContext;
  let repository: PrismaSetlistRepository;

  beforeEach(async () => {
    context = await createRouteTestContext("user-leader");
    repository = new PrismaSetlistRepository(context.prisma);
    await repository.create({
      id: "route-items",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Items",
      status: "draft",
      visibility: "team",
    });
  });

  afterEach(async () => {
    await context.cleanup();
  });

  const params = { params: Promise.resolve({ setlistId: "route-items" }) };

  it("replaces mixed items", async () => {
    const handler = createSetlistItemsPutHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-items/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          items: [
            { kind: "song", songId: FIXTURE_SONG.id, chartId: FIXTURE_CHART.id },
            { kind: "note", text: "Oração" },
          ],
        }),
      }),
      params,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.setlist.items).toHaveLength(2);
  });

  it("returns INVALID_KEY", async () => {
    const handler = createSetlistItemsPutHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-items/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          items: [
            {
              kind: "song",
              songId: FIXTURE_SONG.id,
              chartId: FIXTURE_CHART.id,
              selectedKey: "Bad",
            },
          ],
        }),
      }),
      params,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_KEY" } });
  });

  it("returns INVALID_ITEM for wrong chart", async () => {
    const handler = createSetlistItemsPutHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-items/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          items: [{ kind: "song", songId: FIXTURE_SONG.id, chartId: "missing" }],
        }),
      }),
      params,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_ITEM" } });
  });

  it("returns SETLIST_VERSION_CONFLICT", async () => {
    const handler = createSetlistItemsPutHandler(context.dependencies);
    await handler(
      new Request("http://localhost/api/setlists/route-items/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          items: [{ kind: "note", text: "A" }],
        }),
      }),
      params,
    );
    const response = await handler(
      new Request("http://localhost/api/setlists/route-items/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          items: [{ kind: "note", text: "B" }],
        }),
      }),
      params,
    );
    expect(response.status).toBe(409);
  });

  it("returns 400 for invalid JSON", async () => {
    const handler = createSetlistItemsPutHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-items/items", {
        method: "PUT",
        body: "{",
      }),
      params,
    );
    expect(response.status).toBe(400);
  });

  it("returns 403 for unauthorized replace", async () => {
    const handler = createSetlistItemsPutHandler(withSimulatedUser(context, "user-musician"));
    const response = await handler(
      new Request("http://localhost/api/setlists/route-items/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          items: [{ kind: "note", text: "X" }],
        }),
      }),
      params,
    );
    expect(response.status).toBe(403);
  });

  it("returns 503 when database is not configured", async () => {
    const handler = createSetlistItemsPutHandler({
      ...context.dependencies,
      isConfigured: () => false,
    });
    const response = await handler(
      new Request("http://localhost/api/setlists/route-items/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 1, items: [] }),
      }),
      params,
    );
    expect(response.status).toBe(503);
  });

  it("returns INVALID_ITEM for too many items", async () => {
    const handler = createSetlistItemsPutHandler(context.dependencies);
    const items = Array.from({ length: 101 }, (_, index) => ({
      kind: "note",
      text: `Note ${index}`,
    }));
    const response = await handler(
      new Request("http://localhost/api/setlists/route-items/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 1, items }),
      }),
      params,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_ITEM" } });
  });

  it("returns INVALID_REQUEST for missing expectedVersion", async () => {
    const handler = createSetlistItemsPutHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-items/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      }),
      params,
    );
    expect(response.status).toBe(400);
  });

  it("preserves item ids on reorder", async () => {
    const handler = createSetlistItemsPutHandler(context.dependencies);
    const first = await handler(
      new Request("http://localhost/api/setlists/route-items/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          items: [
            { kind: "note", text: "A" },
            { kind: "note", text: "B" },
          ],
        }),
      }),
      params,
    );
    const firstBody = await first.json();
    const firstIds = firstBody.setlist.items.map((item: { id: string }) => item.id);
    const second = await handler(
      new Request("http://localhost/api/setlists/route-items/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: firstBody.setlist.version,
          items: [
            { id: firstIds[1], kind: "note", text: "B" },
            { id: firstIds[0], kind: "note", text: "A" },
          ],
        }),
      }),
      params,
    );
    const secondBody = await second.json();
    expect(secondBody.setlist.items.map((item: { id: string }) => item.id).sort()).toEqual(
      [...firstIds].sort(),
    );
  });
});
