// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));

const getCurrentActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: getCurrentActorMock,
}));

vi.mock("@/lib/auth/page-gate", () => ({
  requirePageActor: async () => {
    const { getCurrentActor } = await import("@/lib/auth/current-actor");
    const actor = await getCurrentActor();
    if (actor.kind !== "user") {
      throw new Error("redirect");
    }
    return actor;
  },
}));

vi.mock("@/lib/persistence/prisma-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/persistence/prisma-client")>(
    "@/lib/persistence/prisma-client",
  );
  return actual;
});

import { testUserActor } from "@/lib/auth/test-actor";
import {
  createRouteTestContext,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";

import TeamPage from "./page";

let context: RouteTestContext;

beforeEach(async () => {
  context = await createRouteTestContext("user-leader");
});

afterEach(async () => {
  cleanup();
  await context.cleanup();
});

describe("TeamPage", () => {
  it("shows invite form for team leader", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-leader",
        organizationId: "org-default",
        roles: ["worship_leader"],
        teams: [{ teamId: "team-louvor", role: "leader" }],
      }),
    );
    render(await TeamPage({ params: Promise.resolve({ teamId: "team-louvor" }) }));
    expect(screen.getByRole("heading", { name: "Convidar músico" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar convite" })).toBeInTheDocument();
  });

  it("hides invite form for non-leader member", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: "org-default",
        roles: ["musician"],
        teams: [{ teamId: "team-louvor", role: "member" }],
      }),
    );
    render(await TeamPage({ params: Promise.resolve({ teamId: "team-louvor" }) }));
    expect(screen.queryByRole("heading", { name: "Convidar músico" })).not.toBeInTheDocument();
  });

  it("returns notFound for outsider", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: "org-default",
        roles: ["musician"],
        teams: [{ teamId: "team-jovens", role: "member" }],
      }),
    );
    await expect(
      TeamPage({ params: Promise.resolve({ teamId: "team-louvor" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
