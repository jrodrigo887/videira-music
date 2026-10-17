// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Alert } from "./alert";

afterEach(() => cleanup());

describe("Alert", () => {
  it("renders danger text inside role=alert", () => {
    render(<Alert>Algo falhou</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Algo falhou");
    expect(alert).toHaveClass("text-danger");
  });
});
