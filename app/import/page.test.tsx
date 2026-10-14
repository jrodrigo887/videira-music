// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ImportPage, { dynamic } from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("ImportPage", () => {
  it.each([
    ["unset", undefined],
    ["false", "false"],
  ])("hides URL import when the server flag is %s", (_label, value) => {
    vi.stubEnv("VIDEIRA_ENABLE_CIFRACLUB_IMPORT", value);

    render(<ImportPage />);

    expect(screen.queryByLabelText("URL do Cifra Club")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Importar URL" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Texto da cifra")).toBeInTheDocument();
  });

  it("shows URL import only for the exact server flag value true", () => {
    vi.stubEnv("VIDEIRA_ENABLE_CIFRACLUB_IMPORT", "true");

    render(<ImportPage />);

    expect(screen.getByLabelText("URL do Cifra Club")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar URL" })).toBeInTheDocument();
    expect(screen.getByLabelText("Texto da cifra")).toBeInTheDocument();
  });

  it("forces request-time rendering under next start", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
