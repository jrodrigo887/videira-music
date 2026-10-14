// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" });
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const createDepsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/setlists/setlist-route-deps", () => ({
  createSetlistRouteDependencies: () => createDepsMock(),
}));

import { PrismaSetlistRepository } from "@/lib/setlists/prisma-setlist-repository";
import { FIXTURE_CHART, FIXTURE_SONG } from "@/lib/setlists/setlist-test-fixture";
import {
  createRouteTestContext,
  withSimulatedUser,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import SetlistDetailPage from "./page";

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

async function seedDetailedSetlist(id: string) {
  await repository.create({
    id,
    organizationId: DEFAULT_ORGANIZATION_ID,
    ownerTeamId: "team-louvor",
    title: "Detalhe UI",
    status: "published",
    visibility: "team",
  });
  await context.prisma.chordChart.update({
    where: { id: FIXTURE_CHART.id },
    data: {
      originUrl: "https://example.com/cifra",
      sourceOrganizationId: "org-imported",
    },
  });
  await repository.replaceItems(id, 1, [
    {
      id: "item-song",
      kind: "song",
      songId: FIXTURE_SONG.id,
      chartId: FIXTURE_CHART.id,
      selectedKey: "A",
    },
    {
      id: "item-note",
      kind: "note",
      text: "Anunciar oferta",
    },
  ]);
}

describe("SetlistDetailPage", () => {
  it("renders metadata and items", async () => {
    await seedDetailedSetlist("detail-ui-1");
    render(
      await SetlistDetailPage({
        params: Promise.resolve({ setlistId: "detail-ui-1" }),
        searchParams: Promise.resolve({ team: "louvor" }),
      }),
    );
    expect(screen.getByRole("heading", { name: "Detalhe UI" })).toBeInTheDocument();
    expect(screen.getByText(/Fixture Song/)).toBeInTheDocument();
    expect(screen.getByText("Anunciar oferta")).toBeInTheDocument();
  });

  it("shows imported badge and secure source link", async () => {
    await seedDetailedSetlist("detail-ui-2");
    render(
      await SetlistDetailPage({
        params: Promise.resolve({ setlistId: "detail-ui-2" }),
        searchParams: Promise.resolve({}),
      }),
    );
    const source = screen.getByRole("link", { name: "Fonte" });
    expect(source).toHaveAttribute("href", "https://example.com/cifra");
    expect(source).toHaveAttribute("target", "_blank");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows edit action for editors", async () => {
    await seedDetailedSetlist("detail-ui-3");
    render(
      await SetlistDetailPage({
        params: Promise.resolve({ setlistId: "detail-ui-3" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByRole("link", { name: "Editar" })).toBeInTheDocument();
  });

  it("hides edit action for read-only musicians on other teams", async () => {
    await repository.create({
      id: "detail-ui-readonly",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "Jovens Only",
      status: "published",
      visibility: "organization",
    });
    createDepsMock.mockReturnValue(withSimulatedUser(context, "user-musician"));
    render(
      await SetlistDetailPage({
        params: Promise.resolve({ setlistId: "detail-ui-readonly" }),
        searchParams: Promise.resolve({ team: "louvor" }),
      }),
    );
    expect(screen.queryByRole("link", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Modo leitura" })).toBeInTheDocument();
  });

  it("shows follow controls for external setlists", async () => {
    await repository.create({
      id: "detail-ui-follow",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "Seguir este",
      status: "published",
      visibility: "organization",
    });
    render(
      await SetlistDetailPage({
        params: Promise.resolve({ setlistId: "detail-ui-follow" }),
        searchParams: Promise.resolve({ team: "louvor" }),
      }),
    );
    expect(screen.getByRole("button", { name: "Seguir setlist" })).toBeInTheDocument();
  });

  it("shows clone controls for leaders", async () => {
    await seedDetailedSetlist("detail-ui-clone");
    render(
      await SetlistDetailPage({
        params: Promise.resolve({ setlistId: "detail-ui-clone" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByRole("button", { name: "Clonar" })).toBeInTheDocument();
  });

  it("shows empty items copy", async () => {
    await repository.create({
      id: "detail-ui-empty",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Vazio",
      status: "published",
      visibility: "team",
    });
    render(
      await SetlistDetailPage({
        params: Promise.resolve({ setlistId: "detail-ui-empty" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByText("Este setlist ainda não tem itens.")).toBeInTheDocument();
  });

  it("throws notFound for missing setlists", async () => {
    await expect(
      SetlistDetailPage({
        params: Promise.resolve({ setlistId: "missing-id" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
  });

  it("throws notFound for unreadable drafts", async () => {
    await repository.create({
      id: "detail-ui-draft",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "Draft",
      status: "draft",
      visibility: "team",
    });
    createDepsMock.mockReturnValue(withSimulatedUser(context, "user-musician"));
    await expect(
      SetlistDetailPage({
        params: Promise.resolve({ setlistId: "detail-ui-draft" }),
        searchParams: Promise.resolve({ team: "louvor" }),
      }),
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
  });

  it("links back to setlists list with team query", async () => {
    await seedDetailedSetlist("detail-ui-back");
    render(
      await SetlistDetailPage({
        params: Promise.resolve({ setlistId: "detail-ui-back" }),
        searchParams: Promise.resolve({ team: "louvor" }),
      }),
    );
    expect(screen.getByRole("link", { name: "Voltar para setlists" })).toHaveAttribute(
      "href",
      "/setlists?team=louvor",
    );
  });
});
