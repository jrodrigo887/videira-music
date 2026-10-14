// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const createDepsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/setlists/setlist-route-deps", () => ({
  createSetlistRouteDependencies: () => createDepsMock(),
}));

import {
  createRouteTestContext,
  withSimulatedUser,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";

import NewSetlistPage from "./page";

let context: RouteTestContext;

beforeEach(async () => {
  context = await createRouteTestContext("user-leader");
  createDepsMock.mockReturnValue(context.dependencies);
  pushMock.mockReset();
  refreshMock.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/setlists") && init?.method === "POST") {
        return new Response(JSON.stringify({ setlist: { id: "new-sl-1" } }), { status: 201 });
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(async () => {
  cleanup();
  await context.cleanup();
  vi.unstubAllGlobals();
});

describe("NewSetlistPage", () => {
  it("renders creation form for leaders", async () => {
    render(await NewSetlistPage({ searchParams: Promise.resolve({ team: "louvor" }) }));
    expect(screen.getByRole("heading", { name: "Novo setlist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar setlist" })).toBeInTheDocument();
  });

  it("offers team destination for leaders", async () => {
    render(await NewSetlistPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("combobox", { name: "Visibilidade" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Grupo" })).toBeInTheDocument();
  });

  it("offers organization destination for admin", async () => {
    createDepsMock.mockReturnValue(withSimulatedUser(context, "user-admin"));
    render(await NewSetlistPage({ searchParams: Promise.resolve({}) }));
    const destination = screen.getByRole("combobox", { name: "Dono" });
    expect(destination).toBeInTheDocument();
    expect(destination).toHaveTextContent("Igreja");
  });

  it("blocks musicians without create permission", async () => {
    createDepsMock.mockReturnValue(withSimulatedUser(context, "user-musician"));
    render(await NewSetlistPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Você não tem permissão para criar setlists.")).toBeInTheDocument();
  });

  it("shows validation error from api", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ error: { message: "Título inválido." } }),
          { status: 400 },
        ),
      ),
    );
    render(await NewSetlistPage({ searchParams: Promise.resolve({}) }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Domingo" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar setlist" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Título inválido.");
  });

  it("redirects to editor after successful create", async () => {
    render(await NewSetlistPage({ searchParams: Promise.resolve({ team: "louvor" }) }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Domingo" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar setlist" }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/setlists/new-sl-1/edit?team=louvor");
    });
  });

  it("shows database message when not configured", async () => {
    createDepsMock.mockReturnValue({ ...context.dependencies, isConfigured: () => false });
    render(await NewSetlistPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Banco de dados não configurado.")).toBeInTheDocument();
  });
});
