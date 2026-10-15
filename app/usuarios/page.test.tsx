// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const requirePageActorMock = vi.hoisted(() => vi.fn());
const isDatabaseConfiguredMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/lib/auth/page-gate", () => ({
  requirePageActor: requirePageActorMock,
}));

vi.mock("@/lib/persistence/prisma-client", () => ({
  isDatabaseConfigured: isDatabaseConfiguredMock,
  getPrisma: vi.fn(),
}));

vi.mock("@/lib/members/member-service", () => ({
  listMembers: vi.fn(async () => []),
}));

vi.mock("@/lib/invites/invite-service", () => ({
  listPendingInvites: vi.fn(async () => []),
}));

vi.mock("@/lib/access-requests/access-request-service", () => ({
  listPendingAccessRequests: vi.fn(async () => []),
}));

vi.mock("@/lib/roles/role-service", () => ({
  listRoles: vi.fn(async () => [
    { key: "admin", label: "Administrador", system: true, capabilities: [] },
  ]),
}));

import { testUserActor } from "@/lib/auth/test-actor";
import { getPrisma } from "@/lib/persistence/prisma-client";

import UsuariosPage from "./page";

afterEach(() => {
  cleanup();
  requirePageActorMock.mockReset();
});

describe("UsuariosPage", () => {
  it("shows restricted message for musician", async () => {
    requirePageActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: "org-default",
        roles: ["musician"],
        teams: [],
      }),
    );

    render(await UsuariosPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Acesso restrito")).toBeInTheDocument();
  });

  it("renders admin tabs", async () => {
    requirePageActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-admin",
        organizationId: "org-default",
        roles: ["admin"],
        teams: [],
      }),
    );
    vi.mocked(getPrisma).mockReturnValue({
      worshipTeam: { findMany: vi.fn(async () => []) },
    } as never);

    render(await UsuariosPage({ searchParams: Promise.resolve({ aba: "pedidos" }) }));

    expect(screen.getByRole("heading", { name: "Usuários" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pedidos pendentes" })).toBeInTheDocument();
  });
});
