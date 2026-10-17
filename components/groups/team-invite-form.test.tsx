// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { TeamInviteForm } from "./team-invite-form";

afterEach(() => {
  cleanup();
  refreshMock.mockReset();
  vi.restoreAllMocks();
});

describe("TeamInviteForm", () => {
  it("renders Enviar convite as a primary submit Button", () => {
    render(<TeamInviteForm teamId="team-1" teamName="Louvor" />);
    const submit = screen.getByRole("button", { name: "Enviar convite" });
    expect(submit).toHaveAttribute("type", "submit");
    expect(submit).toHaveClass("ds-button");
  });

  it("does not render Alert without a message", () => {
    render(<TeamInviteForm teamId="team-1" teamName="Louvor" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders Alert when invite creation fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "E-mail inválido" } }), { status: 400 }),
    );
    render(<TeamInviteForm teamId="team-1" teamName="Louvor" />);
    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("E-mail inválido");
    });
  });
});
