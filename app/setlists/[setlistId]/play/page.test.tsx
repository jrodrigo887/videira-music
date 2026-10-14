// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" });
  },
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

import SetlistPlayPage from "./page";

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

async function seedPlaySetlist(id: string) {
  await repository.create({
    id,
    organizationId: DEFAULT_ORGANIZATION_ID,
    ownerTeamId: "team-louvor",
    title: "Play UI",
    status: "published",
    visibility: "team",
  });
  await repository.replaceItems(id, 1, [
    {
      id: "play-item-1",
      kind: "song",
      songId: FIXTURE_SONG.id,
      chartId: FIXTURE_CHART.id,
      selectedKey: "Bb",
    },
    {
      id: "play-note",
      kind: "note",
      text: "Momento de oração",
    },
  ]);
}

describe("SetlistPlayPage", () => {
  it("lists items in order with song links", async () => {
    await seedPlaySetlist("play-ui-1");
    render(
      await SetlistPlayPage({
        params: Promise.resolve({ setlistId: "play-ui-1" }),
        searchParams: Promise.resolve({ team: "louvor" }),
      }),
    );
    const songLink = screen.getByRole("link", { name: /Fixture Song/ });
    expect(songLink).toHaveAttribute(
      "href",
      `/songs/${FIXTURE_SONG.id}?setlist=play-ui-1&item=play-item-1&key=Bb`,
    );
    expect(screen.getByText("Momento de oração")).toBeInTheDocument();
  });

  it("shows selected key in song link", async () => {
    await seedPlaySetlist("play-ui-2");
    render(
      await SetlistPlayPage({
        params: Promise.resolve({ setlistId: "play-ui-2" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByText("Tom Bb")).toBeInTheDocument();
  });

  it("shows empty copy when there are no items", async () => {
    await repository.create({
      id: "play-ui-empty",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Sem itens",
      status: "published",
      visibility: "team",
    });
    render(
      await SetlistPlayPage({
        params: Promise.resolve({ setlistId: "play-ui-empty" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByText("Este setlist ainda não tem itens para leitura.")).toBeInTheDocument();
  });

  it("shows imported badge on imported charts", async () => {
    await repository.create({
      id: "play-ui-import",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Importado",
      status: "published",
      visibility: "team",
    });
    await context.prisma.chordChart.update({
      where: { id: FIXTURE_CHART.id },
      data: {
        originUrl: "https://example.com/fonte",
        sourceOrganizationId: "org-imported",
      },
    });
    await repository.replaceItems("play-ui-import", 1, [
      {
        id: "play-import-item",
        kind: "song",
        songId: FIXTURE_SONG.id,
        chartId: FIXTURE_CHART.id,
        selectedKey: "G",
      },
    ]);
    render(
      await SetlistPlayPage({
        params: Promise.resolve({ setlistId: "play-ui-import" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByText("Importada")).toBeInTheDocument();
  });

  it("throws notFound for missing setlists", async () => {
    await expect(
      SetlistPlayPage({
        params: Promise.resolve({ setlistId: "missing-play" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
  });

  it("throws notFound for unreadable setlists", async () => {
    await repository.create({
      id: "play-ui-draft",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "Draft",
      status: "draft",
      visibility: "team",
    });
    createDepsMock.mockReturnValue(withSimulatedUser(context, "user-musician"));
    await expect(
      SetlistPlayPage({
        params: Promise.resolve({ setlistId: "play-ui-draft" }),
        searchParams: Promise.resolve({ team: "louvor" }),
      }),
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
  });
});
