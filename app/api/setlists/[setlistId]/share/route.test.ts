import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getCurrentActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: getCurrentActorMock,
}));

import { PrismaSetlistRepository } from "@/lib/setlists/prisma-setlist-repository";
import {
  createRouteTestContext,
  withSimulatedUser,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";
import { FIXTURE_CHART, FIXTURE_SONG } from "@/lib/setlists/setlist-test-fixture";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import { POST } from "./route";

const SETLIST_PUBLISHED = "route-share-pub";
const SETLIST_DRAFT = "route-share-draft";

describe("setlist share routes", () => {
  let context: RouteTestContext;
  let repository: PrismaSetlistRepository;

  beforeEach(async () => {
    context = await createRouteTestContext("user-leader");
    repository = new PrismaSetlistRepository(context.prisma);
    getCurrentActorMock.mockImplementation(() => context.dependencies.getActor());

    await repository.create({
      id: SETLIST_PUBLISHED,
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Publicado",
      status: "published",
      visibility: "team",
    });
    await repository.replaceItems(SETLIST_PUBLISHED, 1, [
      {
        id: "share-route-item",
        kind: "song",
        songId: FIXTURE_SONG.id,
        chartId: FIXTURE_CHART.id,
        selectedKey: "G",
      },
    ]);

    await repository.create({
      id: SETLIST_DRAFT,
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Rascunho",
      status: "draft",
      visibility: "team",
    });
  });

  afterEach(async () => {
    await context.cleanup();
  });

  const publishedParams = { params: Promise.resolve({ setlistId: SETLIST_PUBLISHED }) };
  const draftParams = { params: Promise.resolve({ setlistId: SETLIST_DRAFT }) };

  it("returns 201 with the share code for a published setlist", async () => {
    const response = await POST(new Request("http://localhost"), publishedParams);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(typeof body.code).toBe("string");
    expect(body.code.length).toBeGreaterThan(10);
  });

  it("returns 409 SETLIST_NOT_SHAREABLE for draft setlists", async () => {
    const response = await POST(new Request("http://localhost"), draftParams);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("SETLIST_NOT_SHAREABLE");
  });

  it("returns 403 when the actor cannot edit the setlist", async () => {
    getCurrentActorMock.mockImplementation(() =>
      withSimulatedUser(context, "user-musician").getActor(),
    );
    const response = await POST(new Request("http://localhost"), publishedParams);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 without session", async () => {
    getCurrentActorMock.mockResolvedValue({ kind: "anonymous" });
    const response = await POST(new Request("http://localhost"), publishedParams);
    expect(response.status).toBe(401);
  });
});
