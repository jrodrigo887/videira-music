// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NoAccess } from "./no-access";

afterEach(() => cleanup());

describe("NoAccess", () => {
  it("shows the spec copy without a request button", () => {
    render(<NoAccess />);
    expect(screen.getByRole("heading", { name: "Você não tem acesso a esta área" })).toBeInTheDocument();
    expect(screen.getByText("Peça acesso a um Gestor ou a um Admin.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /solicitar acesso/i })).not.toBeInTheDocument();
  });
});
