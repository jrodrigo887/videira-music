// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
    render(<ChartHistoryPanel chartId="chart-1" canEdit />);
    await waitFor(() => {
      expect(screen.getByText(/10\/10\/2026/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Restaurar" })).toBeInTheDocument();
  });

  it('shows the empty message when there are no revisions', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ revisions: [] })),
    );
    render(<ChartHistoryPanel chartId="chart-1" canEdit />);
    await waitFor(() => {
      expect(screen.getByText("Nenhuma versão anterior.")).toBeInTheDocument();
    });
  });

  it("renders nothing when the user cannot edit", () => {
    const { container } = render(<ChartHistoryPanel chartId="chart-1" canEdit={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
