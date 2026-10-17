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

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

import { PrismaSetlistRepository } from "@/lib/setlists/prisma-setlist-repository";
import { createShareLink } from "@/lib/setlists/share-link-service";
import { actorFor } from "@/lib/setlists/setlist-test-fixture";
import {
  createRouteTestContext,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import PublicSetlistSharePage from "./page";

const SECTIONS_WITH_CHORDS = [
  {
    label: "Verso",
    lines: [{ text: "Só letra", chords: [{ symbol: "Am", position: 0 }] }],
  },
];

let context: RouteTestContext;
let repository: PrismaSetlistRepository;
const SETLIST_ID = "page-share-setlist";
const SONG_ID = "page-share-song";
const CHART_ID = "page-share-chart";
const CHART_IMPORTED_ID = "page-share-chart-imported";

beforeEach(async () => {
  context = await createRouteTestContext("user-leader");
  repository = new PrismaSetlistRepository(context.prisma);

  await context.prisma.song.create({
    data: {
      id: SONG_ID,
      organizationId: DEFAULT_ORGANIZATION_ID,
      title: "Página pública",
      label: "Página pública",
      alternateKeys: [],
      meta: "",
      searchText: "pagina",
      publicLyrics: false,
    },
  });
  await context.prisma.chordChart.create({
    data: {
      id: CHART_ID,
      organizationId: DEFAULT_ORGANIZATION_ID,
      songId: SONG_ID,
      format: "lyrics",
      key: "G",
      timeSignature: "4/4",
      sections: SECTIONS_WITH_CHORDS,
    },
  });
  await context.prisma.chordChart.create({
    data: {
      id: CHART_IMPORTED_ID,
      organizationId: DEFAULT_ORGANIZATION_ID,
      songId: SONG_ID,
      format: "lyrics",
      key: "A",
      timeSignature: "4/4",
      sections: [{ label: "Verso", lines: [{ text: "Texto da música importada" }] }],
      origin: { source: "import" },
      originUrl: "https://example.com/fonte",
    },
  });

  await repository.create({
    id: SETLIST_ID,
    organizationId: DEFAULT_ORGANIZATION_ID,
    ownerTeamId: "team-louvor",
    title: "Setlist público",
    status: "published",
    visibility: "team",
  });
});

afterEach(async () => {
  cleanup();
  await context.cleanup();
});

async function seedItems(items: Parameters<PrismaSetlistRepository["replaceItems"]>[2]) {
  const row = await context.prisma.setlist.findUniqueOrThrow({ where: { id: SETLIST_ID } });
  await repository.replaceItems(SETLIST_ID, row.version, items);
}

describe("PublicSetlistSharePage", () => {
  it("shows lyrics in order without chord markup", async () => {
    await seedItems([
      {
        id: "page-item-1",
        kind: "song",
        songId: SONG_ID,
        chartId: CHART_ID,
        selectedKey: "G",
      },
    ]);
    const actor = await actorFor(context.prisma, "user-leader");
    const { code } = await createShareLink(context.prisma, actor, SETLIST_ID);

    render(await PublicSetlistSharePage({ params: Promise.resolve({ code }) }));

    expect(screen.getByRole("heading", { name: "Setlist público" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Página pública" })).toBeInTheDocument();
    expect(screen.getByText("Só letra")).toBeInTheDocument();
    expect(screen.queryByText(/Am/)).not.toBeInTheDocument();
  });

  it('shows "Importada" and the source link for imported charts', async () => {
    await seedItems([
      {
        id: "page-item-imported",
        kind: "song",
        songId: SONG_ID,
        chartId: CHART_IMPORTED_ID,
        selectedKey: "A",
      },
    ]);
    const actor = await actorFor(context.prisma, "user-leader");
    const { code } = await createShareLink(context.prisma, actor, SETLIST_ID);

    render(await PublicSetlistSharePage({ params: Promise.resolve({ code }) }));

    expect(screen.getByText("Importada", { selector: ".ds-badge-accent" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fonte" })).toHaveAttribute(
      "href",
      "https://example.com/fonte",
    );
  });

  it("shows unavailable copy for trashed songs", async () => {
    const trashedSongId = "page-share-trashed";
    await context.prisma.song.create({
      data: {
        id: trashedSongId,
        organizationId: DEFAULT_ORGANIZATION_ID,
        title: "Excluída",
        label: "Excluída",
        alternateKeys: [],
        meta: "",
        searchText: "excluida",
        deletedAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    });
    await context.prisma.chordChart.create({
      data: {
        id: "page-share-trashed-chart",
        organizationId: DEFAULT_ORGANIZATION_ID,
        songId: trashedSongId,
        format: "lyrics",
        key: "G",
        timeSignature: "4/4",
        sections: [],
      },
    });
    await seedItems([
      {
        id: "page-item-trash",
        kind: "song",
        songId: trashedSongId,
        chartId: "page-share-trashed-chart",
        selectedKey: "G",
      },
    ]);
    const actor = await actorFor(context.prisma, "user-leader");
    const { code } = await createShareLink(context.prisma, actor, SETLIST_ID);

    render(await PublicSetlistSharePage({ params: Promise.resolve({ code }) }));

    expect(screen.getByRole("heading", { name: "Excluída" })).toBeInTheDocument();
    expect(screen.getByText("Música indisponível")).toBeInTheDocument();
  });

  it("throws notFound for invalid codes", async () => {
    await expect(
      PublicSetlistSharePage({ params: Promise.resolve({ code: "codigo-invalido" }) }),
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
  });
});
