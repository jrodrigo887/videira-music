// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChartSuggestionPanel } from "./chart-suggestion-panel";

describe("ChartSuggestionPanel", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/suggestions") && init?.method === "POST") {
          return new Response(null, { status: 201 });
        }
        if (url.includes("/suggestions")) {
          return Response.json({
            suggestions: [
              {
                id: "sug-1",
                authorUserId: "user-a",
                authorName: "Ana",
                source: "[Verso]\nG\nOi",
                key: "G",
                createdAt: "2026-10-10T12:00:00.000Z",
              },
            ],
          });
        }
        return new Response(null, { status: 404 });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows Sugerir correção when the user can suggest", () => {
    render(<ChartSuggestionPanel chartId="chart-1" canReview={false} canSuggest />);
    expect(screen.getByRole("button", { name: "Sugerir correção" })).toBeInTheDocument();
    expect(screen.queryByText("Sugestões pendentes")).not.toBeInTheDocument();
  });

  it("lists pending suggestions for reviewers", async () => {
    render(<ChartSuggestionPanel chartId="chart-1" canReview canSuggest={false} />);
    await waitFor(() => {
      expect(screen.getByText("Ana")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sugerir correção" })).not.toBeInTheDocument();
  });

  it("shows empty source validation", async () => {
    render(<ChartSuggestionPanel chartId="chart-1" canReview={false} canSuggest />);
    fireEvent.click(screen.getByRole("button", { name: "Sugerir correção" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar sugestão" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o texto da cifra.");
  });

  it("shows size validation for huge text", async () => {
    render(<ChartSuggestionPanel chartId="chart-1" canReview={false} canSuggest />);
    fireEvent.click(screen.getByRole("button", { name: "Sugerir correção" }));
    fireEvent.change(screen.getByLabelText("Texto da cifra sugerida"), {
      target: { value: "a".repeat(500 * 1024 + 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar sugestão" }));
    expect(screen.getByRole("alert")).toHaveTextContent("O texto deve ter no máximo 500 KiB.");
  });
});
