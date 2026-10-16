// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

import { RolesPanel } from "./roles-panel";

import { CAPABILITIES } from "@/lib/auth/capabilities";
import type { RoleRecord } from "@/lib/roles/role-service";
import { CAPABILITY_LABELS, CUSTOM_ROLE_MATCHES_ADMIN_MESSAGE } from "./user-admin-shared";

const roles: RoleRecord[] = [
  { key: "admin", label: "Administrador", system: true, capabilities: ["users:manage"] },
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

  it("disables create when all admin capabilities are selected", () => {
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
    for (const cap of CAPABILITIES) {
      const label = CAPABILITY_LABELS[cap] ?? cap;
      fireEvent.click(screen.getByRole("checkbox", { name: label }));
    }
    expect(screen.getByRole("button", { name: "Criar papel" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(CUSTOM_ROLE_MATCHES_ADMIN_MESSAGE);
  });

  it("disables save on edit when all admin capabilities are selected", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    for (const cap of CAPABILITIES) {
      const label = CAPABILITY_LABELS[cap] ?? cap;
      fireEvent.click(screen.getAllByRole("checkbox", { name: label })[1]);
    }
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(CUSTOM_ROLE_MATCHES_ADMIN_MESSAGE);
  });
});
