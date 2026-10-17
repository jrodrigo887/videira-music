// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const createDepsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/setlists/setlist-route-deps", () => ({
  createSetlistRouteDependencies: () => createDepsMock(),
}));

import { PrismaSetlistRepository } from "@/lib/setlists/prisma-setlist-repository";
import {
  createRouteTestContext,
  withSimulatedUser,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import SetlistsPage from "./page";

let context: RouteTestContext;
let repository: PrismaSetlistRepository;

beforeEach(async () => {
  context = await createRouteTestContext("user-leader");
  createDepsMock.mockReturnValue(context.dependencies);
  repository = new PrismaSetlistRepository(context.prisma);
});

afterEach(async () => {
  cleanup();
  await context.cleanup();
});

function teamNav() {
  return within(screen.getByRole("navigation", { name: "Grupos" }));
}

function tabNav() {
  return within(screen.getByRole("navigation", { name: "Abas de setlists" }));
}

async function seedPublished(id: string, ownerTeamId: string | null, title = id) {
  await repository.create({
    id,
    organizationId: DEFAULT_ORGANIZATION_ID,
    ownerTeamId,
    title,
    status: "published",
    visibility: ownerTeamId ? "team" : "organization",
  });
}

describe("SetlistsPage", () => {
  it("shows team selector for leaders", async () => {
    render(await SetlistsPage({ searchParams: Promise.resolve({}) }));
    expect(teamNav().getByRole("link", { name: "Louvor" })).toBeInTheDocument();
    expect(teamNav().queryByRole("link", { name: "Jovens" })).not.toBeInTheDocument();
  });

  it("uses valid team slug from query", async () => {
    createDepsMock.mockReturnValue(withSimulatedUser(context, "user-musician"));
    render(await SetlistsPage({ searchParams: Promise.resolve({ team: "jovens" }) }));
    expect(teamNav().getByRole("link", { name: "Jovens" })).toHaveAttribute("aria-current", "page");
  });

  it("falls back to first team when slug is invalid", async () => {
    createDepsMock.mockReturnValue(withSimulatedUser(context, "user-musician"));
    render(await SetlistsPage({ searchParams: Promise.resolve({ team: "inexistente" }) }));
    expect(teamNav().getByRole("link", { name: "Jovens" })).toHaveAttribute("aria-current", "page");
  });

  it("shows all four tabs when a team is selected, naming the team tab after the team", async () => {
    render(await SetlistsPage({ searchParams: Promise.resolve({}) }));
    expect(tabNav().getByRole("link", { name: "Louvor" })).toHaveAttribute("aria-current", "page");
    expect(tabNav().getByRole("link", { name: "Outros grupos" })).toBeInTheDocument();
    expect(tabNav().getByRole("link", { name: "Da igreja" })).toBeInTheDocument();
    expect(tabNav().getByRole("link", { name: "Seguindo" })).toBeInTheDocument();
  });

  it("lists team tab setlists", async () => {
    await seedPublished("ui-team-sl", "team-louvor", "Domingo Louvor");
    render(await SetlistsPage({ searchParams: Promise.resolve({ tab: "team" }) }));
    expect(screen.getByRole("heading", { name: "Domingo Louvor" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Domingo Louvor/ })).toHaveAttribute(
      "href",
      "/setlists/ui-team-sl/play?team=louvor",
    );
  });

  it("lists organization tab setlists", async () => {
    await seedPublished("ui-org-sl", null, "Culto Geral");
    render(await SetlistsPage({ searchParams: Promise.resolve({ tab: "organization" }) }));
    expect(screen.getByRole("heading", { name: "Culto Geral" })).toBeInTheDocument();
  });

  it("shows unavailable followed entry with unfollow action", async () => {
    await seedPublished("ui-follow-gone", "team-jovens");
    await repository.follow("ui-follow-gone", "team-louvor");
    await repository.softDelete("ui-follow-gone", 1);
    render(await SetlistsPage({ searchParams: Promise.resolve({ tab: "following" }) }));
    expect(screen.getByText("Setlist indisponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deixar de seguir" })).toBeInTheDocument();
  });

  it("shows create button for leaders on current team", async () => {
    render(await SetlistsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("link", { name: "Novo setlist" })).toHaveAttribute("href", "/setlists/new?team=louvor");
  });

  it("shows only church tab for anonymous users", async () => {
    delete process.env.VIDEIRA_SIMULATED_USER_ID;
    createDepsMock.mockReturnValue({
      ...context.dependencies,
      getActor: async () => ({ kind: "anonymous" as const }),
    });
    render(await SetlistsPage({ searchParams: Promise.resolve({}) }));
    expect(tabNav().getAllByRole("link").map((link) => link.textContent)).toEqual(["Da igreja"]);
    expect(screen.queryByRole("link", { name: "Novo setlist" })).not.toBeInTheDocument();
  });

  it("shows admin all teams alphabetically", async () => {
    createDepsMock.mockReturnValue(withSimulatedUser(context, "user-admin"));
    render(await SetlistsPage({ searchParams: Promise.resolve({}) }));
    expect(teamNav().getAllByRole("link").map((link) => link.textContent)).toEqual(["Jovens", "Louvor"]);
  });

  it("shows empty copy when tab has no setlists", async () => {
    render(await SetlistsPage({ searchParams: Promise.resolve({ tab: "others" }) }));
    expect(screen.getByText("Nenhum setlist nesta aba.")).toBeInTheDocument();
  });
});
