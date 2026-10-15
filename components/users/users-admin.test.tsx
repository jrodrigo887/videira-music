// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: vi.fn() }),
}));

import type { RoleRecord } from "@/lib/roles/role-service";

import { UsersAdmin } from "./users-admin";

afterEach(() => {
  cleanup();
  replaceMock.mockReset();
});

const baseProps = {
  members: [],
  invites: [],
  requests: [],
  roles: [
    { key: "admin", label: "Administrador", system: true, capabilities: ["users:manage"] },
    { key: "musician", label: "Músico", system: true, capabilities: [] },
  ] satisfies RoleRecord[],
  teams: [],
  canGrantAdmin: true,
  canEditCatalog: true,
  currentUserId: "user-admin",
  initialTab: "membros" as const,
};

describe("UsersAdmin tabs", () => {
  it("renders four tabs", () => {
    render(<UsersAdmin {...baseProps} />);
    expect(screen.getByRole("button", { name: "Membros" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Convites" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedidos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Papéis" })).toBeInTheDocument();
  });

  it("opens Pedidos tab from initialTab", () => {
    render(<UsersAdmin {...baseProps} initialTab="pedidos" />);
    expect(screen.getByRole("heading", { name: "Pedidos pendentes" })).toBeInTheDocument();
  });

  it("navigates with router.replace when switching tabs", () => {
    render(<UsersAdmin {...baseProps} />);
    screen.getByRole("button", { name: "Papéis" }).click();
    expect(replaceMock).toHaveBeenCalledWith("/usuarios?aba=papeis");
  });
});
