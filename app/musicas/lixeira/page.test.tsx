// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
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

import { testUserActor } from "@/lib/auth/test-actor";
import {
  createRouteTestContext,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";

import SongTrashPage from "./page";

let context: RouteTestContext;

beforeEach(async () => {
  context = await createRouteTestContext("user-admin");
  getCurrentActorMock.mockResolvedValue(
    testUserActor({
      userId: "user-admin",
      organizationId: "org-default",
      roles: ["admin"],
      teams: [],
    }),
  );
});

afterEach(async () => {
  cleanup();
  await context.cleanup();
});

describe("SongTrashPage", () => {
  it("lists trashed songs for manager", async () => {
    const prisma = context.prisma;
    await prisma.song.create({
      data: {
        id: "trash-page-song",
        organizationId: "org-default",
        title: "Excluída",
        label: "Excluída",
        alternateKeys: [],
        meta: "",
        searchText: "excluida",
        publicLyrics: false,
        deletedAt: new Date(),
      },
    });
    render(await SongTrashPage());
    expect(screen.getByRole("heading", { name: "Lixeira de músicas" })).toBeInTheDocument();
    expect(screen.getByText("Excluída")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restaurar" })).toBeInTheDocument();
  });

  it("shows no-access without music:delete", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: "org-default",
        roles: ["musician"],
        teams: [],
      }),
    );
    render(await SongTrashPage());
    expect(screen.getByRole("heading", { name: "Você não tem acesso a esta área" })).toBeInTheDocument();
  });
});
