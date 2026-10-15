// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PUBLIC_LYRICS_HELP,
  PublicVisibilityField,
} from "./public-visibility-field";

afterEach(() => {
  cleanup();
});

describe("PublicVisibilityField (AUTH-41)", () => {
  it("shows the assumption help text when the info button is toggled", () => {
    render(<PublicVisibilityField checked={false} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Visível ao público")).toBeInTheDocument();
    expect(screen.queryByText(PUBLIC_LYRICS_HELP)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /informação sobre visibilidade pública/i }));

    expect(screen.getByText(PUBLIC_LYRICS_HELP)).toBeInTheDocument();
  });

  it("forwards checkbox changes to onChange", () => {
    const onChange = vi.fn();
    render(<PublicVisibilityField checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Visível ao público"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("pill variant toggles via aria-pressed button", () => {
    const onChange = vi.fn();
    render(<PublicVisibilityField variant="pill" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Visível ao público" }));

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
