// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { SongTrashList } from "./song-trash-list";

afterEach(() => {
  cleanup();
  refreshMock.mockReset();
  vi.restoreAllMocks();
});

describe("SongTrashList", () => {
  it("does not render Alert without a message", () => {
    render(
      <SongTrashList songs={[{ id: "s1", title: "Canção", artist: null, deletedAt: "2026-01-01" }]} />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders Alert when restore fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    render(
      <SongTrashList songs={[{ id: "s1", title: "Canção", artist: null, deletedAt: "2026-01-01" }]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível restaurar a música.");
    });
    expect(screen.getByRole("alert")).toHaveClass("text-danger");
  });
});
