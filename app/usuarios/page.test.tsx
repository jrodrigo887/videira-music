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
const listRolesMock = vi.hoisted(() => vi.fn(async () => []));
const listRoleLabelsMock = vi.hoisted(() => vi.fn(async () => []));
const listPendingAccessRequestsMock = vi.hoisted(() => vi.fn(async () => []));

vi.mock("@/lib/auth/page-gate", () => ({
  requirePageActor: requirePageActorMock,
}));

vi.mock("@/lib/persistence/prisma-client", () => ({
  isDatabaseConfigured: isDatabaseConfiguredMock,
  getPrisma: vi.fn(() => ({
    worshipTeam: { findMany: vi.fn(async () => []) },
  })),
}));

vi.mock("@/lib/members/member-service", () => ({
  listMembers: vi.fn(async () => []),
}));

vi.mock("@/lib/invites/invite-service", () => ({
  listPendingInvites: vi.fn(async () => []),
}));

vi.mock("@/lib/access-requests/access-request-service", () => ({
  listPendingAccessRequests: listPendingAccessRequestsMock,
}));

vi.mock("@/lib/roles/role-service", () => ({
  listRoles: listRolesMock,
  listRoleLabels: listRoleLabelsMock,
}));

import { testUserActor } from "@/lib/auth/test-actor";

import UsuariosPage from "./page";

afterEach(() => {
  cleanup();
  requirePageActorMock.mockReset();
  listRolesMock.mockClear();
  listPendingAccessRequestsMock.mockClear();
});

describe("UsuariosPage", () => {
  it("shows NoAccess for musician", async () => {
    requirePageActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: "org-default",
        roles: ["musician"],
        teams: [],
      }),
    );

    render(await UsuariosPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Você não tem acesso a esta área" })).toBeInTheDocument();
  });

  it("shows NoAccess for papeis tab without role.manage", async () => {
    requirePageActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-manager",
        organizationId: "org-default",
        roles: ["manager"],
        teams: [],
      }),
    );

    render(await UsuariosPage({ searchParams: Promise.resolve({ aba: "papeis" }) }));

    expect(screen.getByRole("heading", { name: "Você não tem acesso a esta área" })).toBeInTheDocument();
  });

  it("does not load admin-only lists for manager", async () => {
    requirePageActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-manager",
        organizationId: "org-default",
        roles: ["manager"],
        teams: [],
      }),
    );

    render(await UsuariosPage({ searchParams: Promise.resolve({}) }));

    expect(listRolesMock).not.toHaveBeenCalled();
    expect(listPendingAccessRequestsMock).not.toHaveBeenCalled();
    expect(listRoleLabelsMock).toHaveBeenCalled();
  });
});
