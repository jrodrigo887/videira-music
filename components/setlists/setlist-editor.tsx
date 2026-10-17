"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { FollowersConfirmDialog } from "@/components/setlists/followers-confirm-dialog";
import { Alert } from "@/components/ui/alert";
import type { Setlist, SetlistItem, ReplaceSetlistItemInput } from "@/types/setlist";

type EditorItem =
  | {
      id: string;
      kind: "song";
      songId: string;
      chartId: string;
      selectedKey: string;
      label: string;
      notes?: string;
    }
  | { id: string; kind: "note"; text: string; notes?: string; label: string };

type SetlistEditorProps = {
  setlist: Setlist;
  teamQuery?: string;
};

type ApiError = {
  error?: { code?: string; message?: string; version?: number; followerCount?: number };
};

type SongListEntry = { id: string; title: string; artist?: string };
type ChartListEntry = { id: string; title?: string; key: string };
type CatalogStatus = "loading" | "ready" | "error";

type CatalogSelection = {
  charts: ChartListEntry[];
  chartId: string;
  notes: string;
  status: CatalogStatus;
};

const SWIPE_REMOVE_DISTANCE = 96;

const iconButtonClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-content-muted transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25 disabled:pointer-events-none disabled:opacity-50";

function toEditorItems(items: SetlistItem[]): EditorItem[] {
  return items.map((item) => {
    if (item.kind === "note") {
      return {
        id: item.id,
        kind: "note",
        text: item.text,
        ...(item.notes ? { notes: item.notes } : {}),
        label: item.text,
      };
    }
    if (item.unavailable) {
      return {
        id: item.id,
        kind: "song",
        songId: item.id,
        chartId: item.id,
        selectedKey: "—",
        label: `${item.title} (indisponível)`,
      };
    }
    const artist = item.song.artist ? ` — ${item.song.artist}` : "";
    return {
      id: item.id,
      kind: "song",
      songId: item.songId,
      chartId: item.chartId,
      selectedKey: item.selectedKey,
      ...(item.notes ? { notes: item.notes } : {}),
      label: `${item.song.title}${artist} (${item.selectedKey})`,
    };
  });
}

export function reorderEditorItems(items: EditorItem[], fromIndex: number, toIndex: number): EditorItem[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  return arrayMove(items, fromIndex, toIndex);
}

type SortableSetlistItemProps = {
  item: EditorItem;
  index: number;
  busy: boolean;
  onSelectedKeyChange: (index: number, key: string) => void;
  onRemove: (id: string) => void;
};

function DragHandleIcon() {
  return (
    <svg aria-hidden className="h-5 w-5 text-content-muted" viewBox="0 0 20 20" fill="currentColor">
      <circle cx="7" cy="5" r="1.25" />
      <circle cx="13" cy="5" r="1.25" />
      <circle cx="7" cy="10" r="1.25" />
      <circle cx="13" cy="10" r="1.25" />
      <circle cx="7" cy="15" r="1.25" />
      <circle cx="13" cy="15" r="1.25" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 4.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M6.5 4.5V3.2a.7.7 0 0 1 .7-.7h1.6a.7.7 0 0 1 .7.7v1.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4.5 4.5 5 13a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-.9l.5-8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2.2 6.2 3.8 3.8h3.1l1.1 1.4h5.6v6.6a.8.8 0 0 1-.8.8H3a.8.8 0 0 1-.8-.8V6.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="3.25" r="1.15" fill="currentColor" />
      <circle cx="8" cy="8" r="1.15" fill="currentColor" />
      <circle cx="8" cy="12.75" r="1.15" fill="currentColor" />
    </svg>
  );
}

function NoteSheetIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4 2.2h5.2L13 6v7.2a.8.8 0 0 1-.8.8H4a.8.8 0 0 1-.8-.8V3a.8.8 0 0 1 .8-.8Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 2.4V6h3.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {filled ? null : (
        <path d="M5.2 8.5h5.6M5.2 11h3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

function ActionIconButton({
  label,
  description,
  className,
  disabled,
  onClick,
  tooltipSide = "above",
  tooltipAlign = "start",
  children,
}: {
  label: string;
  description: string;
  className: string;
  disabled?: boolean;
  onClick: () => void;
  tooltipSide?: "above" | "below";
  tooltipAlign?: "start" | "end";
  children: ReactNode;
}) {
  const tooltipId = useId();
  const sideClass = tooltipSide === "below" ? "top-full mt-2" : "bottom-full mb-2";
  const alignClass = tooltipAlign === "end" ? "right-0" : "left-0";

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        aria-describedby={tooltipId}
      >
        {children}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute z-20 w-56 rounded-xl bg-content px-3 py-2 text-left text-xs leading-snug text-content-inverse opacity-0 shadow-md transition group-hover:opacity-100 group-focus-within:opacity-100 ${sideClass} ${alignClass}`}
      >
        <span className="block font-semibold">{label}</span>
        <span className="mt-0.5 block font-normal text-content-inverse/80">{description}</span>
      </span>
    </span>
  );
}

function SongListSkeleton() {
  return (
    <div role="status" aria-label="Carregando músicas" className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-11 animate-pulse rounded-xl bg-surface-muted" />
      ))}
    </div>
  );
}

type ItemRowProps = SortableSetlistItemProps & {
  setNodeRef?: (element: HTMLElement | null) => void;
  sortableStyle?: { transform?: string; transition?: string };
  isDragging?: boolean;
  dragAttributes?: HTMLAttributes<HTMLButtonElement>;
  dragListeners?: HTMLAttributes<HTMLButtonElement>;
};

function SetlistItemRow({
  item,
  index,
  busy,
  onSelectedKeyChange,
  onRemove,
  setNodeRef,
  sortableStyle,
  isDragging = false,
  dragAttributes,
  dragListeners,
}: ItemRowProps) {
  const swipe = useRef({ startX: 0, offset: 0, active: false });
  const keyMenuRef = useRef<HTMLDivElement>(null);
  const keyMenuButtonRef = useRef<HTMLButtonElement>(null);
  const keyFieldId = useId();
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [keyMenuOpen, setKeyMenuOpen] = useState(false);

  useEffect(() => {
    if (!keyMenuOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (keyMenuRef.current?.contains(target) || keyMenuButtonRef.current?.contains(target)) return;
      setKeyMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setKeyMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [keyMenuOpen]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (busy) return;
    const target = event.target;
    if (!(target instanceof Element) || target.closest("button, input, textarea, select, a")) return;
    swipe.current = { startX: event.clientX, offset: 0, active: true };
    setSwiping(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom does not implement pointer capture.
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!swipe.current.active) return;
    const next = Math.min(Math.max(0, event.clientX - swipe.current.startX), 160);
    swipe.current.offset = next;
    setOffset(next);
  }

  function finishSwipe(commit: boolean) {
    if (!swipe.current.active) return;
    const shouldRemove = commit && swipe.current.offset >= SWIPE_REMOVE_DISTANCE;
    swipe.current = { startX: 0, offset: 0, active: false };
    setSwiping(false);
    setOffset(0);
    if (shouldRemove) onRemove(item.id);
  }

  return (
    <li
      ref={setNodeRef}
      style={sortableStyle}
      className={`relative rounded-xl border border-border bg-surface ${
        keyMenuOpen ? "z-20" : ""
      } ${isDragging ? "z-10 shadow-md ring-2 ring-primary/30" : ""}`}
    >
      <div className="relative overflow-hidden rounded-[inherit]">
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 flex w-28 items-center bg-danger px-3 text-sm font-semibold text-danger-foreground"
        >
          Remover
        </div>
        <div
          data-testid={`setlist-item-${item.id}`}
          className="relative flex items-center gap-2 bg-surface px-3 py-2"
          style={{
            transform: offset > 0 ? `translateX(${offset}px)` : undefined,
            transition: swiping ? "none" : "transform 160ms ease",
            touchAction: "pan-y",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => finishSwipe(true)}
          onPointerCancel={() => finishSwipe(false)}
        >
          <button
            type="button"
            className="flex shrink-0 cursor-grab touch-none items-center rounded-lg p-1 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Arrastar item: ${item.label}`}
            disabled={busy || !dragListeners}
            {...dragAttributes}
            {...dragListeners}
          >
            <DragHandleIcon />
          </button>
          <span className="min-w-0 flex-1 text-sm text-content">
            {item.label}
            {item.notes ? <span className="mt-1 block text-xs text-content-muted">{item.notes}</span> : null}
          </span>
          {item.kind === "song" ? (
            <>
              <input
                className="ds-input hidden w-24 shrink-0 md:block"
                value={item.selectedKey}
                aria-label={`Tom de ${item.label}`}
                onChange={(event) => onSelectedKeyChange(index, event.target.value)}
              />
              <button
                ref={keyMenuButtonRef}
                type="button"
                className={`${iconButtonClass} md:hidden`}
                aria-label={`Mais opções de ${item.label}`}
                aria-expanded={keyMenuOpen}
                aria-haspopup="dialog"
                onClick={() => setKeyMenuOpen((open) => !open)}
              >
                <MoreIcon />
              </button>
            </>
          ) : null}
        </div>
      </div>
      {item.kind === "song" && keyMenuOpen ? (
        <div
          ref={keyMenuRef}
          role="dialog"
          aria-label={`Tom de ${item.label}`}
          className="absolute right-2 top-full z-30 mt-1 w-36 rounded-xl border border-border bg-surface p-3 shadow-md"
        >
          <label htmlFor={keyFieldId} className="mb-1 block text-xs font-semibold text-content-muted">
            Tom
          </label>
          <input
            id={keyFieldId}
            className="ds-input w-full"
            value={item.selectedKey}
            autoFocus
            onChange={(event) => onSelectedKeyChange(index, event.target.value)}
          />
        </div>
      ) : null}
    </li>
  );
}

function SortableSetlistItem(props: SortableSetlistItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
    disabled: props.busy,
  });

  return (
    <SetlistItemRow
      {...props}
      setNodeRef={setNodeRef}
      isDragging={isDragging}
      sortableStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      dragAttributes={attributes as HTMLAttributes<HTMLButtonElement>}
      dragListeners={listeners as HTMLAttributes<HTMLButtonElement>}
    />
  );
}

function toReplacePayload(items: EditorItem[]): ReplaceSetlistItemInput[] {
  return items.map((item) => {
    if (item.kind === "note") {
      return {
        id: item.id,
        kind: "note",
        text: item.text,
        ...(item.notes ? { notes: item.notes } : {}),
      };
    }
    return {
      id: item.id,
      kind: "song",
      songId: item.songId,
      chartId: item.chartId,
      selectedKey: item.selectedKey,
      ...(item.notes ? { notes: item.notes } : {}),
    };
  });
}

export function SetlistEditor({ setlist: initialSetlist, teamQuery }: SetlistEditorProps) {
  const router = useRouter();
  const [setlist, setSetlist] = useState(initialSetlist);
  const [items, setItems] = useState<EditorItem[]>(() => toEditorItems(initialSetlist.items));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [songQuery, setSongQuery] = useState("");
  const [songResults, setSongResults] = useState<SongListEntry[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading");
  const [catalogReload, setCatalogReload] = useState(0);
  const [selectedSongs, setSelectedSongs] = useState<Record<string, CatalogSelection>>({});
  const [noteSongId, setNoteSongId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [reorderReady, setReorderReady] = useState(false);
  const [followerDialog, setFollowerDialog] = useState<{
    action: "delete" | "visibility";
    followerCount: number;
    visibility?: string;
  } | null>(null);

  const querySuffix = teamQuery ? `?team=${encodeURIComponent(teamQuery)}` : "";
  const readHref = `/setlists/${encodeURIComponent(setlist.id)}/play${querySuffix}`;
  const canEdit = setlist.permissions.edit;
  const canChangeStatus = setlist.permissions.changeStatus;
  const canDelete = setlist.permissions.delete;

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;

    async function loadCatalog() {
      setCatalogStatus("loading");
      try {
        const response = await fetch("/api/songs");
        if (cancelled) return;
        if (!response.ok) {
          setCatalogStatus("error");
          return;
        }
        const body = (await response.json()) as { songs?: SongListEntry[] };
        if (cancelled) return;
        setSongResults(body.songs ?? []);
        setCatalogStatus("ready");
      } catch {
        if (!cancelled) setCatalogStatus("error");
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [canEdit, catalogReload]);

  useEffect(() => {
    setReorderReady(true);
  }, []);

  useEffect(() => {
    if (!noteSongId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNoteSongId(null);
        setNoteError(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [noteSongId]);

  const filteredSongs = useMemo(() => {
    const query = songQuery.trim().toLowerCase();
    if (!query) return songResults;
    return songResults.filter((song) => {
      const artist = song.artist?.toLowerCase() ?? "";
      return song.title.toLowerCase().includes(query) || artist.includes(query);
    });
  }, [songQuery, songResults]);

  const noteSong = noteSongId ? songResults.find((song) => song.id === noteSongId) : undefined;

  async function toggleSong(song: SongListEntry) {
    if (selectedSongs[song.id]) {
      setSelectedSongs((current) => {
        const next = { ...current };
        delete next[song.id];
        return next;
      });
      if (noteSongId === song.id) {
        setNoteSongId(null);
        setNoteError(null);
      }
      return;
    }

    setSelectedSongs((current) => ({
      ...current,
      [song.id]: { charts: [], chartId: "", notes: "", status: "loading" },
    }));
    setMessage(null);

    const response = await fetch(`/api/songs/${encodeURIComponent(song.id)}/charts`);
    if (!response.ok) {
      setSelectedSongs((current) => {
        if (!current[song.id]) return current;
        return { ...current, [song.id]: { ...current[song.id], status: "error" } };
      });
      setMessage("Não foi possível carregar as cifras desta música.");
      return;
    }
    const body = (await response.json()) as { charts?: ChartListEntry[] };
    const charts = body.charts ?? [];
    setSelectedSongs((current) => {
      if (!current[song.id]) return current;
      return {
        ...current,
        [song.id]: {
          ...current[song.id],
          charts,
          chartId: charts.length === 1 ? charts[0].id : "",
          status: "ready",
        },
      };
    });
  }

  function updateSelectionChart(songId: string, chartId: string) {
    setSelectedSongs((current) => {
      const selection = current[songId];
      if (!selection) return current;
      return { ...current, [songId]: { ...selection, chartId } };
    });
  }

  function openNoteDialog(songId: string) {
    setNoteSongId(songId);
    setNoteDraft(selectedSongs[songId]?.notes ?? "");
    setNoteError(null);
  }

  function saveNote() {
    const text = noteDraft.trim();
    if (!text || !noteSongId) {
      setNoteError("Digite o texto da anotação.");
      return;
    }
    setSelectedSongs((current) => {
      const selection = current[noteSongId];
      if (!selection) return current;
      return { ...current, [noteSongId]: { ...selection, notes: text } };
    });
    setNoteSongId(null);
    setNoteError(null);
  }

  function addSelectedSongs() {
    const selectedIds = Object.keys(selectedSongs);
    if (selectedIds.length === 0) {
      setMessage("Selecione uma música.");
      return;
    }
    if (selectedIds.some((songId) => selectedSongs[songId]?.status === "loading")) {
      setMessage("Aguarde o carregamento das cifras.");
      return;
    }

    const additions: EditorItem[] = [];
    for (const songId of selectedIds) {
      const song = songResults.find((entry) => entry.id === songId);
      const selection = selectedSongs[songId];
      const chart = selection?.charts.find((entry) => entry.id === selection.chartId);
      if (!song || !selection || !chart) {
        setMessage("Escolha a cifra antes de adicionar.");
        return;
      }
      const artist = song.artist ? ` — ${song.artist}` : "";
      additions.push({
        id: crypto.randomUUID(),
        kind: "song",
        songId: song.id,
        chartId: chart.id,
        selectedKey: chart.key,
        ...(selection.notes.trim() ? { notes: selection.notes.trim() } : {}),
        label: `${song.title}${artist} (${chart.key})`,
      });
    }

    setItems((current) => [...current, ...additions]);
    setSelectedSongs({});
    setMessage(null);
  }

  const sortableSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const fromIndex = current.findIndex((entry) => entry.id === active.id);
      const toIndex = current.findIndex((entry) => entry.id === over.id);
      return reorderEditorItems(current, fromIndex, toIndex);
    });
  }

  function updateSelectedKey(index: number, key: string) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index || item.kind !== "song") return item;
        return { ...item, selectedKey: key, label: item.label.replace(/\([^)]*\)$/, `(${key})`) };
      }),
    );
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  async function saveItems() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/setlists/${encodeURIComponent(setlist.id)}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: setlist.version,
          items: toReplacePayload(items),
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as ApiError;
        if (body.error?.code === "SETLIST_VERSION_CONFLICT") {
          setMessage("Este setlist mudou. Recarregue para ver a versão atual.");
          return;
        }
        setMessage(body.error?.message ?? "Não foi possível salvar os itens.");
        return;
      }
      const body = (await response.json()) as { setlist: Setlist };
      setSetlist(body.setlist);
      setItems(toEditorItems(body.setlist.items));
    } finally {
      setBusy(false);
    }
  }

  async function patchSetlist(body: Record<string, unknown>) {
    const response = await fetch(`/api/setlists/${encodeURIComponent(setlist.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      if (payload.error?.code === "SETLIST_HAS_FOLLOWERS" && payload.error.followerCount !== undefined) {
        setFollowerDialog({
          action: body.status ? "delete" : "visibility",
          followerCount: payload.error.followerCount,
          visibility: typeof body.visibility === "string" ? body.visibility : undefined,
        });
        return null;
      }
      setMessage(payload.error?.message ?? "Não foi possível atualizar o setlist.");
      return null;
    }
    const payload = (await response.json()) as { setlist: Setlist };
    setSetlist(payload.setlist);
    setItems(toEditorItems(payload.setlist.items));
    return payload.setlist;
  }

  async function publish() {
    setBusy(true);
    await patchSetlist({ expectedVersion: setlist.version, status: "published" });
    setBusy(false);
  }

  async function archive() {
    setBusy(true);
    await patchSetlist({ expectedVersion: setlist.version, status: "archived" });
    setBusy(false);
  }

  async function deleteSetlist(confirmFollowersImpact = false) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/setlists/${encodeURIComponent(setlist.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: setlist.version,
          ...(confirmFollowersImpact ? { confirmFollowersImpact: true } : {}),
        }),
      });
      if (response.status === 409) {
        const body = (await response.json()) as ApiError;
        if (body.error?.code === "SETLIST_HAS_FOLLOWERS" && body.error.followerCount !== undefined) {
          setFollowerDialog({ action: "delete", followerCount: body.error.followerCount });
          return;
        }
      }
      if (!response.ok) {
        setMessage("Não foi possível excluir o setlist.");
        return;
      }
      router.push(`/setlists${querySuffix}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <section className="ds-card">
        <p className="text-content-muted">Você não tem permissão para editar este setlist.</p>
        <Link href={readHref} className="ds-link mt-4 inline-block">
          Voltar
        </Link>
      </section>
    );
  }

  const selectedCount = Object.keys(selectedSongs).length;
  const visibleSongs = filteredSongs.slice(0, 40);

  const statusActions = canChangeStatus || canDelete;

  return (
    <div className="space-y-6">
      <header className="relative z-30 flex items-center gap-3">
        <Link
          href={readHref}
          aria-label="Voltar ao setlist"
          title="Voltar ao setlist"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-lg leading-none text-content shadow-xs transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25"
        >
          <span aria-hidden="true">‹</span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="ds-eyebrow">Editor</p>
          <h1 className="truncate text-2xl font-bold text-content">{setlist.title}</h1>
        </div>
        {statusActions ? (
          <div className="flex shrink-0 items-center gap-2">
            {canChangeStatus && setlist.status !== "published" ? (
              <button type="button" className="ds-button" disabled={busy} onClick={publish}>
                {setlist.status === "archived" ? "Republicar" : "Publicar"}
              </button>
            ) : null}
            {canChangeStatus && setlist.status === "published" ? (
              <ActionIconButton
                label="Arquivar"
                description="Tira o setlist das listas ativas. Quem já segue continua vendo, e dá para republicar depois."
                className={`${iconButtonClass} hover:border-amber-500 hover:text-amber-500`}
                disabled={busy}
                tooltipSide="below"
                tooltipAlign="end"
                onClick={archive}
              >
                <ArchiveIcon />
              </ActionIconButton>
            ) : null}
            {canDelete ? (
              <ActionIconButton
                label="Excluir setlist"
                description="Remove o setlist. Grupos que seguem deixam de vê-lo."
                className={`${iconButtonClass} hover:border-danger hover:text-danger`}
                disabled={busy}
                tooltipSide="below"
                tooltipAlign="end"
                onClick={() => deleteSetlist()}
              >
                <TrashIcon />
              </ActionIconButton>
            ) : null}
          </div>
        ) : null}
      </header>

      {message ? (
        <p role="alert" className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm">
          {message}
        </p>
      ) : null}

      <section className="ds-card space-y-3" aria-busy={catalogStatus === "loading"}>
        <h2 className="font-semibold text-content">Adicionar música</h2>
        {catalogStatus === "loading" ? <SongListSkeleton /> : null}
        {catalogStatus === "error" ? (
          <div className="space-y-2">
            <p className="text-sm text-content-muted">Não foi possível carregar o catálogo.</p>
            <button type="button" className="ds-button-secondary" onClick={() => setCatalogReload((value) => value + 1)}>
              Tentar de novo
            </button>
          </div>
        ) : null}
        {catalogStatus === "ready" ? (
          <>
            <input
              className="ds-input w-full"
              placeholder="Buscar música"
              value={songQuery}
              onChange={(event) => setSongQuery(event.target.value)}
              aria-label="Buscar música"
            />
            {visibleSongs.length === 0 ? (
              <p className="text-sm text-content-muted">Nenhuma música encontrada.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2" aria-label="Catálogo de músicas">
                {visibleSongs.map((song) => {
                  const selection = selectedSongs[song.id];
                  const selected = Boolean(selection);
                  const hasNotes = Boolean(selection?.notes.trim());
                  return (
                    <li key={song.id} className="space-y-2">
                      <div
                        className={`flex items-center gap-1 rounded-xl border-l-4 pr-1 transition ${
                          selected
                            ? "border-primary bg-primary-subtle"
                            : "border-transparent hover:bg-surface-muted"
                        }`}
                      >
                        <button
                          type="button"
                          aria-pressed={selected}
                          className={`min-h-11 flex-1 rounded-xl px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25 ${
                            selected ? "font-semibold text-primary" : "text-content"
                          }`}
                          onClick={() => void toggleSong(song)}
                        >
                          {song.title}
                          {song.artist ? (
                            <span className={`mt-0.5 block text-xs font-normal ${selected ? "text-primary/80" : "text-content-muted"}`}>
                              {song.artist}
                            </span>
                          ) : null}
                        </button>
                        {selected ? (
                          <button
                            type="button"
                            className={`${iconButtonClass} border-transparent bg-transparent hover:text-primary ${hasNotes ? "text-primary" : ""}`}
                            aria-label={hasNotes ? `Anotação de ${song.title}, preenchida` : `Anotação de ${song.title}`}
                            title="Anotação"
                            onClick={() => openNoteDialog(song.id)}
                          >
                            <NoteSheetIcon filled={hasNotes} />
                          </button>
                        ) : null}
                      </div>
                      {selected && selection?.status === "loading" ? (
                        <p className="px-3 text-xs text-content-muted">Carregando cifras…</p>
                      ) : null}
                      {selected && selection?.status === "ready" && selection.charts.length > 1 ? (
                        <select
                          className="ds-input w-full"
                          value={selection.chartId}
                          onChange={(event) => updateSelectionChart(song.id, event.target.value)}
                          aria-label={`Escolher cifra de ${song.title}`}
                        >
                          <option value="">Escolha a cifra</option>
                          {selection.charts.map((chart) => (
                            <option key={chart.id} value={chart.id}>
                              {(chart.title ?? "Cifra") + ` (${chart.key})`}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {filteredSongs.length > visibleSongs.length ? (
              <p className="text-xs text-content-muted">Refine a busca para ver outras músicas.</p>
            ) : null}
            {selectedCount > 0 ? (
              <button type="button" className="ds-button-secondary" onClick={addSelectedSongs}>
                {selectedCount > 1 ? "Adicionar músicas" : "Adicionar música"}
              </button>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="ds-card space-y-3">
        <h2 className="font-semibold text-content">Itens</h2>
        {items.length === 0 ? (
          <p className="text-content-muted">Nenhum item ainda.</p>
        ) : (
          <>
            <p className="text-sm text-content-muted">Arraste o item para a direita para remover.</p>
            {reorderReady ? (
              <DndContext sensors={sortableSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  <ol className="space-y-2">
                    {items.map((item, index) => (
                      <SortableSetlistItem
                        key={item.id}
                        item={item}
                        index={index}
                        busy={busy}
                        onSelectedKeyChange={updateSelectedKey}
                        onRemove={removeItem}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            ) : (
              <ol className="space-y-2">
                {items.map((item, index) => (
                  <SetlistItemRow
                    key={item.id}
                    item={item}
                    index={index}
                    busy={busy}
                    onSelectedKeyChange={updateSelectedKey}
                    onRemove={removeItem}
                  />
                ))}
              </ol>
            )}
          </>
        )}
        <button type="button" className="ds-button" disabled={busy} onClick={saveItems}>
          Salvar itens
        </button>
      </section>

      <FollowersConfirmDialog
        open={followerDialog !== null}
        followerCount={followerDialog?.followerCount ?? 0}
        busy={busy}
        onCancel={() => setFollowerDialog(null)}
        onConfirm={() => {
          const dialog = followerDialog;
          setFollowerDialog(null);
          if (!dialog) return;
          if (dialog.action === "delete") {
            void deleteSetlist(true);
          }
        }}
      />

      {noteSongId ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="song-note-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setNoteSongId(null);
              setNoteError(null);
            }
          }}
        >
          <div className="ds-card w-full max-w-md space-y-3">
            <h2 id="song-note-title" className="text-lg font-bold text-content">
              Anotação
            </h2>
            <p className="text-sm text-content-muted">{noteSong?.title ?? "Música selecionada"}</p>
            <textarea
              className="ds-input min-h-28 w-full"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              aria-label="Texto da anotação"
              autoFocus
            />
            {noteError ? <Alert>{noteError}</Alert> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="ds-button-secondary"
                onClick={() => {
                  setNoteSongId(null);
                  setNoteError(null);
                }}
              >
                Cancelar
              </button>
              <button type="button" className="ds-button" onClick={saveNote}>
                Adicionar anotação
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
