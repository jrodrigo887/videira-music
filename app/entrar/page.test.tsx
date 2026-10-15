// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/auth-actions", () => ({
  signInWithGoogle: vi.fn(),
}));

vi.mock("@/lib/auth/auth-config", () => ({
  readAuthEnvConfig: vi.fn(() => ({ secret: "x", baseUrl: "http://localhost" })),
}));

const cookiesMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/components/auth/request-access-button", () => ({
  RequestAccessButton: () => <button type="button">Solicitar acesso</button>,
}));

vi.mock("@/lib/access-requests/access-ticket", () => ({
  ACCESS_TICKET_COOKIE: "videira_access_ticket",
  readAccessTicket: vi.fn(() => undefined),
}));

import { readAccessTicket } from "@/lib/access-requests/access-ticket";

import EntrarPage from "./page";

afterEach(() => {
  cleanup();
  vi.mocked(readAccessTicket).mockReset();
  cookiesMock.mockReset();
});

describe("EntrarPage", () => {
  it("shows request access button when ticket is valid", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn(() => ({ value: "token" })) });
    vi.mocked(readAccessTicket).mockReturnValue({ email: "a@b.test", name: "A" });

    render(await EntrarPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("button", { name: "Solicitar acesso" })).toBeInTheDocument();
  });

  it("hides request access without ticket", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn(() => undefined) });
    vi.mocked(readAccessTicket).mockReturnValue(undefined);

    render(await EntrarPage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByRole("button", { name: "Solicitar acesso" })).not.toBeInTheDocument();
  });

  it("shows success message when requested=1", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn(() => undefined) });

    render(await EntrarPage({ searchParams: Promise.resolve({ requested: "1" }) }));

    expect(
      screen.getByText("Pedido enviado. Aguarde o administrador liberar o acesso."),
    ).toBeInTheDocument();
  });
});
