import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PrismaSetlistRepository } from "@/lib/setlists/prisma-setlist-repository";
import {
  createRouteTestContext,
  withSimulatedUser,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import { createSetlistFollowDeleteHandler, createSetlistFollowPostHandler } from "./route";

describe("/api/setlists/[setlistId]/follow", () => {
  let context: RouteTestContext;
  let repository: PrismaSetlistRepository;

  beforeEach(async () => {
    context = await createRouteTestContext("user-leader");
    repository = new PrismaSetlistRepository(context.prisma);
    await repository.create({
      id: "route-follow",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "Follow",
      status: "published",
      visibility: "organization",
    });
  });

  afterEach(async () => {
    await context.cleanup();
  });

  const params = { params: Promise.resolve({ setlistId: "route-follow" }) };

  it("returns 204 on POST follow", async () => {
    const handler = createSetlistFollowPostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-follow/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: "team-louvor" }),
      }),
      params,
    );
    expect(response.status).toBe(204);
  });

  it("returns 204 on repeat POST follow", async () => {
    const handler = createSetlistFollowPostHandler(context.dependencies);
    await handler(
      new Request("http://localhost/api/setlists/route-follow/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: "team-louvor" }),
      }),
      params,
    );
    const response = await handler(
      new Request("http://localhost/api/setlists/route-follow/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: "team-louvor" }),
      }),
      params,
    );
    expect(response.status).toBe(204);
  });

  it("returns 204 on DELETE unfollow", async () => {
    await repository.follow("route-follow", "team-louvor");
    const handler = createSetlistFollowDeleteHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-follow/follow", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: "team-louvor" }),
      }),
      params,
    );
    expect(response.status).toBe(204);
  });

  it("returns CANNOT_FOLLOW for draft setlist", async () => {
    await repository.create({
      id: "route-follow-draft",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "Draft",
      status: "draft",
      visibility: "team",
    });
    const handler = createSetlistFollowPostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-follow-draft/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: "team-louvor" }),
      }),
      { params: Promise.resolve({ setlistId: "route-follow-draft" }) },
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "CANNOT_FOLLOW" } });
  });

  it("returns CANNOT_FOLLOW for own team", async () => {
    await repository.create({
      id: "route-follow-own",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Own",
      status: "published",
      visibility: "team",
    });
    const handler = createSetlistFollowPostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-follow-own/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: "team-louvor" }),
      }),
      { params: Promise.resolve({ setlistId: "route-follow-own" }) },
    );
    expect(response.status).toBe(409);
  });

  it("returns CANNOT_FOLLOW for unreadable setlist", async () => {
    await repository.create({
      id: "route-follow-private",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "Private",
      status: "published",
      visibility: "private",
    });
    const handler = createSetlistFollowPostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-follow-private/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: "team-louvor" }),
      }),
      { params: Promise.resolve({ setlistId: "route-follow-private" }) },
    );
    expect(response.status).toBe(409);
  });

  it("returns 403 for unauthorized follow", async () => {
    const handler = createSetlistFollowPostHandler(withSimulatedUser(context, "user-musician"));
    const response = await handler(
      new Request("http://localhost/api/setlists/route-follow/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: "team-louvor" }),
      }),
      params,
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid JSON", async () => {
    const handler = createSetlistFollowPostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-follow/follow", {
        method: "POST",
        body: "{",
      }),
      params,
    );
    expect(response.status).toBe(400);
  });
});
