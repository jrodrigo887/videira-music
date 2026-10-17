// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

import { SetlistActions } from "./setlist-actions";
import type { Setlist } from "@/types/setlist";

const setlist: Setlist = {
  id: "sl-1",
  organizationId: "org",
  ownerTeamId: "team-1",
  title: "Culto",
  status: "published",
  visibility: "team",
  version: 1,
  followerCount: 0,
  permissions: { edit: true, changeStatus: true, delete: true },
  items: [],
};

afterEach(() => {
  cleanup();
  refreshMock.mockReset();
  vi.restoreAllMocks();
});

describe("SetlistActions", () => {
  it("does not render Alert without a message", () => {
    render(
      <SetlistActions
        setlist={setlist}
        followTeams={[{ id: "team-1", slug: "louvor", name: "Louvor", organizationId: "org" }]}
        cloneTeams={[]}
        canCloneOrganization={false}
      />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders Alert when follow fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Falha ao seguir" } }), { status: 400 }),
    );
    render(
      <SetlistActions
        setlist={setlist}
        followTeams={[{ id: "team-1", slug: "louvor", name: "Louvor", organizationId: "org" }]}
        cloneTeams={[]}
        canCloneOrganization={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Seguir setlist" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Falha ao seguir");
    });
  });
});
