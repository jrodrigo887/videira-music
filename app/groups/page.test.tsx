// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const createDepsMock = vi.hoisted(() => vi.fn());
const getCurrentActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: getCurrentActorMock,
}));

vi.mock("@/lib/setlists/setlist-route-deps", () => ({
  createSetlistRouteDependencies: () => createDepsMock(),
}));

import { testUserActor } from "@/lib/auth/test-actor";
import {
  createRouteTestContext,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";

import GroupsPage from "./page";

let context: RouteTestContext;

beforeEach(async () => {
  context = await createRouteTestContext("user-admin");
  createDepsMock.mockReturnValue(context.dependencies);
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

describe("GroupsPage", () => {
  it("renders team management for admin", async () => {
    render(await GroupsPage());
    expect(screen.getByRole("heading", { name: "Grupos de louvor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar grupo" })).toBeInTheDocument();
    expect(screen.getByText("Louvor")).toBeInTheDocument();
    expect(screen.getByText("Jovens")).toBeInTheDocument();
  });

  it("shows no-access for musician", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: "org-default",
        roles: ["musician"],
        teams: [],
      }),
    );
    render(await GroupsPage());
    expect(screen.getByRole("heading", { name: "Você não tem acesso a esta área" })).toBeInTheDocument();
  });

  it("lists active teams in the active section", async () => {
    render(await GroupsPage());
    expect(screen.getByRole("heading", { name: "Grupos ativos" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Renomear" }).length).toBeGreaterThanOrEqual(2);
  });

  it("does not expose delete actions", async () => {
    render(await GroupsPage());
    expect(screen.queryByRole("button", { name: /excluir/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apagar/i })).not.toBeInTheDocument();
  });

  it("shows archived section when archived teams exist", async () => {
    const teamService = await context.dependencies.getTeamService();
    const actor = await context.dependencies.getActor();
    const created = await teamService.createTeam(actor, { name: "Ensaio" });
    await teamService.archiveTeam(actor, created.id);
    render(await GroupsPage());
    expect(screen.getByRole("heading", { name: "Grupos arquivados" })).toBeInTheDocument();
    expect(screen.getByText("Ensaio")).toBeInTheDocument();
  });

  it("shows database message when not configured", async () => {
    createDepsMock.mockReturnValue({ ...context.dependencies, isConfigured: () => false });
    render(await GroupsPage());
    expect(screen.getByText("Banco de dados não configurado.")).toBeInTheDocument();
  });

  it("shows archive buttons for active teams", async () => {
    render(await GroupsPage());
    expect(screen.getAllByRole("button", { name: "Arquivar" }).length).toBeGreaterThanOrEqual(2);
  });

  it("shows slug hints for teams", async () => {
    render(await GroupsPage());
    expect(screen.getByText("/louvor")).toBeInTheDocument();
    expect(screen.getByText("/jovens")).toBeInTheDocument();
  });
});
