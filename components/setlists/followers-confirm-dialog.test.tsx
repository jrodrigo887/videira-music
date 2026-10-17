// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FollowersConfirmDialog } from "./followers-confirm-dialog";

afterEach(() => cleanup());

describe("FollowersConfirmDialog", () => {
  it("shows singular copy for one follower", () => {
    render(
      <FollowersConfirmDialog open followerCount={1} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("heading", { name: "Confirmar impacto" })).toBeInTheDocument();
    expect(screen.getByText(/1 grupo segue este setlist/)).toBeInTheDocument();
    expect(screen.getByText(/Deseja continuar\?/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
  });

  it("shows plural copy for two followers", () => {
    render(
      <FollowersConfirmDialog open followerCount={2} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText(/2 grupos seguem este setlist/)).toBeInTheDocument();
  });

  it("disables actions and blocks overlay close while busy", () => {
    render(
      <FollowersConfirmDialog
        open
        busy
        followerCount={1}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  });
});
