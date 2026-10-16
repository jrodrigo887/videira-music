// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MembersPanel } from "./members-panel";

afterEach(() => cleanup());

const member = {
  id: "user-musician",
  name: "Músico",
  email: "musico@videira.test",
  status: "active" as const,
  roles: ["musician"],
  teamIds: [],
};

describe("MembersPanel", () => {
  it("hides role checkboxes and deactivate when canChangeRoles is false", () => {
    render(
      <MembersPanel
        initialMembers={[member]}
        roles={[{ key: "musician", label: "Músico", system: true, capabilities: [] }]}
        teams={[]}
        canGrantAdmin={false}
        canChangeRoles={false}
        currentUserId="user-admin"
        onMessage={vi.fn()}
        busy={false}
        setBusy={vi.fn()}
        onRefresh={async () => undefined}
      />,
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desativar" })).not.toBeInTheDocument();
    expect(screen.getByText("musico@videira.test")).toBeInTheDocument();
  });
});
