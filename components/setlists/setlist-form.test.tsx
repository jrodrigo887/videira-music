// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { SetlistForm } from "./setlist-form";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SetlistForm", () => {
  const destinations = [
    {
      kind: "team" as const,
      team: { id: "team-1", slug: "louvor", name: "Louvor", organizationId: "org" },
    },
  ];

  it("does not render Alert without an error", () => {
    render(<SetlistForm destinations={destinations} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders Alert when create fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Título duplicado" } }), { status: 400 }),
    );
    render(<SetlistForm destinations={destinations} />);
    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: "Novo culto" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar setlist" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Título duplicado");
    });
  });
});
