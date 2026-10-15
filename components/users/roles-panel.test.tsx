// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

import { RolesPanel } from "./roles-panel";

import type { RoleRecord } from "@/lib/roles/role-service";

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
});
