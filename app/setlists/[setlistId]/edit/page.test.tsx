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
import {
  createRouteTestContext,
  withSimulatedUser,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import SetlistEditPage from "./page";

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

describe("SetlistEditPage", () => {
  it("renders editor for editable setlists", async () => {
    await repository.create({
      id: "edit-page-1",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Editável",
      status: "draft",
      visibility: "team",
    });
    render(
      await SetlistEditPage({
        params: Promise.resolve({ setlistId: "edit-page-1" }),
        searchParams: Promise.resolve({ team: "louvor" }),
      }),
    );
    expect(screen.getByRole("heading", { name: "Editável" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar itens" })).toBeInTheDocument();
  });

  it("shows read-only message for musicians", async () => {
    await repository.create({
      id: "edit-page-ro",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "Somente leitura",
      status: "published",
      visibility: "organization",
    });
    createDepsMock.mockReturnValue(withSimulatedUser(context, "user-musician"));
    render(
      await SetlistEditPage({
        params: Promise.resolve({ setlistId: "edit-page-ro" }),
        searchParams: Promise.resolve({ team: "louvor" }),
      }),
    );
    expect(screen.getByText("Você não tem permissão para editar este setlist.")).toBeInTheDocument();
  });

  it("throws notFound for missing setlists", async () => {
    await expect(
      SetlistEditPage({
        params: Promise.resolve({ setlistId: "missing-edit" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
  });
});
