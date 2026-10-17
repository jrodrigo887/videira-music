// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";

afterEach(() => cleanup());

describe("Button", () => {
  it("applies ds-button for primary", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass("ds-button");
    expect(screen.getByRole("button", { name: "Salvar" })).not.toHaveClass("ds-button-secondary");
  });

  it("applies ds-button-secondary for secondary", () => {
    render(<Button variant="secondary">Cancelar</Button>);
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveClass("ds-button-secondary");
  });

  it("applies ds-button-danger for danger", () => {
    render(<Button variant="danger">Excluir</Button>);
    expect(screen.getByRole("button", { name: "Excluir" })).toHaveClass("ds-button-danger");
  });

  it("defaults type to button and forwards submit, disabled and className", () => {
    render(
      <Button type="submit" disabled className="w-full" variant="primary">
        Enviar
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Enviar" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeDisabled();
    expect(button).toHaveClass("ds-button", "w-full");
  });
});
