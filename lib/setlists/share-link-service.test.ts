import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { testUserActor } from "@/lib/auth/test-actor";
import { hashInviteCode } from "@/lib/invites/invite-token";
import { seedSimulatedIdentities } from "@/lib/auth/simulated-identities";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { PrismaSetlistRepository } from "@/lib/setlists/prisma-setlist-repository";
import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";

import { createShareLink, readSharedLyrics, revokeShareLink } from "./share-link-service";

const SECTIONS_WITH_CHORDS = [
  {
    label: "Verso",
    lines: [{ text: "Linha sem acorde", chords: [{ symbol: "G", position: 0 }] }],
  },
];

const SETLIST_PUBLISHED = "setlist-share-pub";
const SETLIST_DRAFT = "setlist-share-draft";
const SONG_OK = "song-share-ok";
const SONG_PRIVATE = "song-share-private";
const SONG_TRASH = "song-share-trash";
const CHART_OK = "chart-share-ok";
const CHART_PRIVATE = "chart-share-private";
const CHART_TRASH = "chart-share-trash";
const CHART_IMPORTED = "chart-share-imported";

function leader() {
  return testUserActor({
    userId: "user-leader",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["worship_leader"],
    teams: [{ teamId: "team-louvor", role: "leader" }],
  });
}

function musician() {
  return testUserActor({
    userId: "user-musician",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["musician"],
    teams: [{ teamId: "team-louvor", role: "member" }],
  });
}

describe("share-link-service", () => {
  let temp!: { url: string; cleanup: () => Promise<void> };
  let prisma: PrismaClient;
  let repository: PrismaSetlistRepository;

  beforeAll(async () => {
    temp = await createTempDatabaseUrl();
    prisma = await createTestPrismaClient(temp.url);
    await seedSimulatedIdentities(prisma);
    repository = new PrismaSetlistRepository(prisma);

    await prisma.song.createMany({
      data: [
        {
          id: SONG_OK,
          organizationId: DEFAULT_ORGANIZATION_ID,
          title: "Letra OK",
          label: "Letra OK",
          alternateKeys: [],
          meta: "",
          searchText: "ok",
          publicLyrics: true,
        },
        {
          id: SONG_PRIVATE,
          organizationId: DEFAULT_ORGANIZATION_ID,
          title: "Letra privada",
          label: "Letra privada",
          alternateKeys: [],
          meta: "",
          searchText: "privada",
          publicLyrics: false,
        },
        {
          id: SONG_TRASH,
          organizationId: DEFAULT_ORGANIZATION_ID,
          title: "Na lixeira",
          label: "Na lixeira",
          alternateKeys: [],
          meta: "",
          searchText: "lixo",
          publicLyrics: true,
          deletedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    await prisma.chordChart.createMany({
      data: [
        {
          id: CHART_OK,
          organizationId: DEFAULT_ORGANIZATION_ID,
          songId: SONG_OK,
          format: "lyrics",
          key: "G",
          timeSignature: "4/4",
          sections: SECTIONS_WITH_CHORDS,
        },
        {
          id: CHART_PRIVATE,
          organizationId: DEFAULT_ORGANIZATION_ID,
          songId: SONG_PRIVATE,
          format: "lyrics",
          key: "G",
          timeSignature: "4/4",
          sections: [{ label: "Verso", lines: [{ text: "Privada" }] }],
        },
        {
          id: CHART_TRASH,
          organizationId: DEFAULT_ORGANIZATION_ID,
          songId: SONG_TRASH,
          format: "lyrics",
          key: "G",
          timeSignature: "4/4",
          sections: [],
        },
        {
          id: CHART_IMPORTED,
          organizationId: DEFAULT_ORGANIZATION_ID,
          songId: SONG_OK,
          format: "lyrics",
          key: "A",
          timeSignature: "4/4",
          sections: [{ label: "Verso", lines: [{ text: "Importada" }] }],
          origin: { source: "import" },
          originUrl: "https://example.com/song",
        },
      ],
    });

    await repository.create({
      id: SETLIST_PUBLISHED,
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Culto",
      status: "published",
      visibility: "team",
    });
    await repository.replaceItems(SETLIST_PUBLISHED, 1, [
      {
        id: "item-ok",
        kind: "song",
        songId: SONG_OK,
        chartId: CHART_OK,
        selectedKey: "G",
      },
      {
        id: "item-private",
        kind: "song",
        songId: SONG_PRIVATE,
        chartId: CHART_PRIVATE,
        selectedKey: "G",
      },
      {
        id: "item-trash",
        kind: "song",
        songId: SONG_TRASH,
        chartId: CHART_TRASH,
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

  afterAll(async () => {
    await destroyTestPrismaClient(prisma);
    await temp.cleanup();
  });

  it("returns the code once and stores only the hash", async () => {
    const { code } = await createShareLink(prisma, leader(), SETLIST_PUBLISHED);
    expect(code.length).toBeGreaterThan(20);
    const row = await prisma.setlistShareLink.findFirst({ where: { setlistId: SETLIST_PUBLISHED } });
    expect(row?.tokenHash).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain(code);
  });

  it("rejects draft setlists with SETLIST_NOT_SHAREABLE", async () => {
    await expect(createShareLink(prisma, leader(), SETLIST_DRAFT)).rejects.toMatchObject({
      code: "SETLIST_NOT_SHAREABLE",
      status: 409,
    });
  });

  it("rejects create and revoke when the actor cannot edit", async () => {
    await expect(createShareLink(prisma, musician(), SETLIST_PUBLISHED)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });

    const { code } = await createShareLink(prisma, leader(), SETLIST_PUBLISHED);
    const link = await prisma.setlistShareLink.findFirst({
      where: { setlistId: SETLIST_PUBLISHED, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    await expect(
      revokeShareLink(prisma, musician(), SETLIST_PUBLISHED, link!.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await readSharedLyrics(prisma, code)).toBeDefined();
  });

  it("returns lyrics in order without chord fields", async () => {
    const { code } = await createShareLink(prisma, leader(), SETLIST_PUBLISHED);
    const shared = await readSharedLyrics(prisma, code);
    expect(shared?.title).toBe("Culto");
    expect(shared?.items).toHaveLength(3);
    expect(shared?.items[0]).toMatchObject({
      kind: "song",
      title: "Letra OK",
      sections: [{ label: "Verso", lines: ["Linha sem acorde"] }],
    });
    expect(JSON.stringify(shared)).not.toContain("chords");
  });

  it("includes private catalog lyrics on the shared setlist", async () => {
    const { code } = await createShareLink(prisma, leader(), SETLIST_PUBLISHED);
    const shared = await readSharedLyrics(prisma, code);
    const privateItem = shared?.items.find((item) => item.title === "Letra privada");
    expect(privateItem).toMatchObject({
      sections: [{ label: "Verso", lines: ["Privada"] }],
    });
  });

  it("marks trashed songs as unavailable", async () => {
    const { code } = await createShareLink(prisma, leader(), SETLIST_PUBLISHED);
    const shared = await readSharedLyrics(prisma, code);
    expect(shared?.items[2]).toMatchObject({
      title: "Na lixeira",
      unavailable: true,
    });
  });

  it("returns undefined for bad, revoked, or unpublished setlists", async () => {
    expect(await readSharedLyrics(prisma, "bad-code")).toBeUndefined();

    const { code } = await createShareLink(prisma, leader(), SETLIST_PUBLISHED);
    const link = await prisma.setlistShareLink.findFirst({
      where: { setlistId: SETLIST_PUBLISHED, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    await revokeShareLink(prisma, leader(), SETLIST_PUBLISHED, link!.id);
    expect(await readSharedLyrics(prisma, code)).toBeUndefined();

    const { code: code2 } = await createShareLink(prisma, leader(), SETLIST_PUBLISHED);
    await prisma.setlist.update({
      where: { id: SETLIST_PUBLISHED },
      data: { status: "archived" },
    });
    expect(await readSharedLyrics(prisma, code2)).toBeUndefined();
    await prisma.setlist.update({
      where: { id: SETLIST_PUBLISHED },
      data: { status: "published" },
    });
  });

  it("keeps other active links when one is revoked", async () => {
    const first = await createShareLink(prisma, leader(), SETLIST_PUBLISHED);
    const second = await createShareLink(prisma, leader(), SETLIST_PUBLISHED);
    const firstLink = await prisma.setlistShareLink.findUnique({
      where: { tokenHash: hashInviteCode(first.code) },
    });
    await revokeShareLink(prisma, leader(), SETLIST_PUBLISHED, firstLink!.id);
    expect(await readSharedLyrics(prisma, first.code)).toBeUndefined();
    expect(await readSharedLyrics(prisma, second.code)).toBeDefined();
  });

  it("includes imported.originUrl when origin and originUrl exist", async () => {
    const row = await prisma.setlist.findUniqueOrThrow({ where: { id: SETLIST_PUBLISHED } });
    await repository.replaceItems(SETLIST_PUBLISHED, row.version, [
      {
        id: "item-imported",
        kind: "song",
        songId: SONG_OK,
        chartId: CHART_IMPORTED,
        selectedKey: "A",
      },
    ]);
    const { code } = await createShareLink(prisma, leader(), SETLIST_PUBLISHED);
    const shared = await readSharedLyrics(prisma, code);
    expect(shared?.items[0]).toMatchObject({
      imported: { originUrl: "https://example.com/song" },
    });
  });

});
