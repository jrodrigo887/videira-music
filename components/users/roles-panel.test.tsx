// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

import { RolesPanel } from "./roles-panel";

import type { RoleRecord } from "@/lib/roles/role-service";
import { ADMIN_ONLY_CAPABILITY_MESSAGE } from "./user-admin-shared";

const roles: RoleRecord[] = [
  { key: "admin", label: "Administrador", system: true, capabilities: [] },
  { key: "custom", label: "Custom", system: false, capabilities: [] },
];

describe("RolesPanel", () => {
  it("shows create form for admin editor", () => {
    render(
      <RolesPanel
        initialRoles={roles}
        canEditCatalog
        onMessage={vi.fn()}
        busy={false}
        setBusy={vi.fn()}
        onRefresh={async () => undefined}
      />,
    );
    expect(screen.getByRole("heading", { name: "Novo papel" })).toBeInTheDocument();
  });

  it("hides create form for manager view-only", () => {
    render(
      <RolesPanel
        initialRoles={roles}
        canEditCatalog={false}
        onMessage={vi.fn()}
        busy={false}
        setBusy={vi.fn()}
        onRefresh={async () => undefined}
      />,
    );
    expect(screen.queryByRole("heading", { name: "Novo papel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apagar" })).not.toBeInTheDocument();
  });

  it("offers edit on custom roles", () => {
    render(
      <RolesPanel
        initialRoles={roles}
        canEditCatalog
        onMessage={vi.fn()}
        busy={false}
        setBusy={vi.fn()}
        onRefresh={async () => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("keeps admin-only capabilities disabled in the create form", () => {
    render(
      <RolesPanel
        initialRoles={roles}
        canEditCatalog
        onMessage={vi.fn()}
        busy={false}
        setBusy={vi.fn()}
        onRefresh={async () => undefined}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /Área de usuário/ })).toBeDisabled();
    expect(screen.getAllByText(ADMIN_ONLY_CAPABILITY_MESSAGE).length).toBeGreaterThan(0);
  });

  it("shows dependency warning when removing a base capability", () => {
    render(
      <RolesPanel
        initialRoles={roles}
        canEditCatalog
        onMessage={vi.fn()}
        busy={false}
        setBusy={vi.fn()}
        onRefresh={async () => undefined}
      />,
    );
    const importBox = screen.getAllByRole("checkbox").find((node) =>
      node.closest("label")?.textContent?.includes("Importar"),
    );
    const musicWriteBox = screen.getAllByRole("checkbox").find((node) =>
      node.closest("label")?.textContent?.includes("Editar músicas"),
    );
    expect(importBox).toBeDefined();
    expect(musicWriteBox).toBeDefined();
    fireEvent.click(importBox!);
    fireEvent.click(musicWriteBox!);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Desmarcar esta capacidade também desmarca as que dependem dela.",
    );
  });
});
