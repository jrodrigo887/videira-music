// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { SetlistEditor, reorderEditorItems } from "./setlist-editor";
import type { Setlist } from "@/types/setlist";

const editableSetlist: Setlist = {
  id: "edit-sl",
  organizationId: "org-default",
  ownerTeamId: "team-louvor",
  title: "Editor UI",
  status: "draft",
  visibility: "team",
  version: 3,
  followerCount: 0,
  permissions: { edit: true, changeStatus: true, delete: true },
  items: [],
};

const readOnlySetlist: Setlist = {
  ...editableSetlist,
  permissions: { edit: false, changeStatus: false, delete: false },
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  pushMock.mockReset();
  fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/songs") && !url.includes("/charts")) {
      return new Response(JSON.stringify({ songs: [{ id: "song-1", title: "Música A" }] }), {
        status: 200,
      });
    }
    if (url.endsWith("/charts")) {
      return new Response(JSON.stringify({ charts: [{ id: "chart-1", key: "G", title: "Principal" }] }), {
        status: 200,
      });
    }
    if (url.includes("/items") && init?.method === "PUT") {
      return new Response(
        JSON.stringify({
          setlist: {
            ...editableSetlist,
            version: 4,
            items: [
              {
                id: "saved-item",
                kind: "song",
                position: 0,
                songId: "song-1",
                chartId: "chart-1",
                selectedKey: "G",
                song: { title: "Música A" },
                chart: { key: "G", imported: false },
              },
            ],
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes("/api/setlists/edit-sl") && init?.method === "PATCH") {
      return new Response(
        JSON.stringify({ setlist: { ...editableSetlist, status: "published", version: 4 } }),
        { status: 200 },
      );
    }
    if (url.includes("/api/setlists/edit-sl") && init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SetlistEditor", () => {
  it("shows permission message for read-only viewers", () => {
    render(<SetlistEditor setlist={readOnlySetlist} teamQuery="louvor" />);
    expect(screen.getByText("Você não tem permissão para editar este setlist.")).toBeInTheDocument();
  });

  it("auto-selects a single chart when adding a song", async () => {
    render(<SetlistEditor setlist={editableSetlist} />);
    fireEvent.click(screen.getByRole("button", { name: "Carregar catálogo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Música A" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar música" }));
    expect(screen.getByRole("listitem")).toHaveTextContent("Música A");
  });

  it("requires chart choice when multiple charts exist", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/api/songs")) {
        return new Response(JSON.stringify({ songs: [{ id: "song-1", title: "Música A" }] }), {
          status: 200,
        });
      }
      if (url.endsWith("/charts")) {
        return new Response(
          JSON.stringify({
            charts: [
              { id: "chart-1", key: "G", title: "A" },
              { id: "chart-2", key: "A", title: "B" },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    });

    render(<SetlistEditor setlist={editableSetlist} />);
    fireEvent.click(screen.getByRole("button", { name: "Carregar catálogo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Música A" }));
    expect(await screen.findByRole("combobox", { name: "Escolher cifra" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar música" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha a cifra antes de adicionar.");
  });

  it("adds note items", () => {
    render(<SetlistEditor setlist={editableSetlist} />);
    fireEvent.change(screen.getByLabelText("Texto da anotação"), { target: { value: "Pausa" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar anotação" }));
    expect(screen.getByText("Pausa")).toBeInTheDocument();
  });

  it("reorders items when moving an entry to another position", () => {
    const items = [
      { id: "a", kind: "note" as const, text: "Primeiro", label: "Primeiro" },
      { id: "b", kind: "note" as const, text: "Segundo", label: "Segundo" },
    ];
    const reordered = reorderEditorItems(items, 0, 1);
    expect(reordered.map((item) => item.label)).toEqual(["Segundo", "Primeiro"]);
  });

  it("shows drag handles for reordering items", () => {
    render(
      <SetlistEditor
        setlist={{
          ...editableSetlist,
          items: [{ id: "only", kind: "note", position: 0, text: "Único" }],
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Arrastar item: Único" })).toBeInTheDocument();
  });

  it("saves items through the items api", async () => {
    render(<SetlistEditor setlist={editableSetlist} />);
    fireEvent.click(screen.getByRole("button", { name: "Carregar catálogo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Música A" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar música" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar itens" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/setlists/edit-sl/items",
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  it("shows version conflict message", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
      if (String(input).includes("/items") && init?.method === "PUT") {
        return new Response(JSON.stringify({ error: { code: "SETLIST_VERSION_CONFLICT" } }), {
          status: 409,
        });
      }
      return new Response(JSON.stringify({ songs: [] }), { status: 200 });
    });
    render(<SetlistEditor setlist={editableSetlist} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar itens" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este setlist mudou. Recarregue para ver a versão atual.",
    );
  });

  it("publishes draft setlists", async () => {
    render(<SetlistEditor setlist={editableSetlist} />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/setlists/edit-sl",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("archives published setlists", async () => {
    render(<SetlistEditor setlist={{ ...editableSetlist, status: "published" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Arquivar" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/setlists/edit-sl",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("deletes setlists after confirmation", async () => {
    render(<SetlistEditor setlist={editableSetlist} teamQuery="louvor" />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir setlist" }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/setlists?team=louvor");
    });
  });

  it("shows follower impact dialog before delete", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
      if (String(input).includes("/api/setlists/edit-sl") && init?.method === "DELETE") {
        return new Response(JSON.stringify({ error: { code: "SETLIST_HAS_FOLLOWERS", followerCount: 2 } }), {
          status: 409,
        });
      }
      return new Response("{}", { status: 404 });
    });
    render(<SetlistEditor setlist={editableSetlist} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir setlist" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("2 grupos seguem este setlist");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it("updates selected key inputs", () => {
    render(
      <SetlistEditor
        setlist={{
          ...editableSetlist,
          items: [
            {
              id: "song-item",
              kind: "song",
              position: 0,
              songId: "song-1",
              chartId: "chart-1",
              selectedKey: "G",
              song: { title: "Música A" },
              chart: { key: "G", imported: false },
            },
          ],
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Tom de/), { target: { value: "A" } });
    expect(screen.getByDisplayValue("A")).toBeInTheDocument();
  });

  it("validates empty note text", () => {
    render(<SetlistEditor setlist={editableSetlist} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar anotação" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Digite o texto da anotação.");
  });
});
