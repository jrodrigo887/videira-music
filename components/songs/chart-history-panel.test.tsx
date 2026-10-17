// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChartHistoryPanel } from "./chart-history-panel";

describe("ChartHistoryPanel", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          revisions: [{ id: "rev-1", savedAt: "2026-10-10T15:00:00.000Z" }],
        }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lists revisions from newest to oldest", async () => {
    render(
      <ChartHistoryPanel
        chartId="chart-1"
        songTitle="Meu amigo"
        versionLabel="simplificada"
        canEdit
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Meu amigo - simplificada")).toBeInTheDocument();
    });
    const line = screen.getByText("Meu amigo - simplificada").closest("p");
    expect(line).toHaveClass("text-[12px]");
    expect(line).toHaveTextContent(/10\/10\/2026/);
    expect(screen.getByRole("button", { name: "Restaurar" })).toBeInTheDocument();
  });

  it("uses the revision label when it differs from the current version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          revisions: [
            { id: "rev-1", savedAt: "2026-10-10T15:00:00.000Z", versionLabel: "trabalhada" },
          ],
        }),
      ),
    );
    render(
      <ChartHistoryPanel chartId="chart-1" songTitle="Meu amigo" versionLabel="simplificada" canEdit />,
    );
    expect(await screen.findByText("Meu amigo - trabalhada")).toBeInTheDocument();
  });

  it("selects a version without offering a name field", async () => {
    const onSelectVersion = vi.fn();
    render(
      <ChartHistoryPanel
        chartId="chart-principal"
        songTitle="Meu amigo"
        canEdit
        versions={[
          { chartId: "chart-principal", label: "Principal" },
          { chartId: "chart-simple", label: "Simplificada" },
          { chartId: "chart-lyrics", label: "Letra" },
          { chartId: "chart-custom", label: "Ensaio" },
        ]}
        onSelectVersion={onSelectVersion}
      />,
    );

    expect(screen.queryByRole("textbox", { name: "Versão da cifra" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Ou escreva uma versão")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Principal" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Ensaio" }));
    expect(onSelectVersion).toHaveBeenCalledWith("chart-custom");
  });

  it('shows the empty message when there are no revisions', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ revisions: [] })),
    );
    render(<ChartHistoryPanel chartId="chart-1" songTitle="Meu amigo" canEdit />);
    await waitFor(() => {
      expect(screen.getByText("Nenhuma versão anterior.")).toBeInTheDocument();
    });
  });

  it("renders nothing when the user cannot edit", () => {
    const { container } = render(
      <ChartHistoryPanel chartId="chart-1" songTitle="Meu amigo" canEdit={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
