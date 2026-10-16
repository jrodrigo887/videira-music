import type { SetlistId } from "@/types/music";

export type SetlistStatus = "draft" | "published" | "archived";
export type SetlistVisibility = "private" | "team" | "organization" | "public";
export type SetlistEventType = "service" | "rehearsal" | "event";

export type SetlistItemKind = "song" | "note";

export type SetlistSongItem =
  | {
      id: string;
      kind: "song";
      position: number;
      unavailable: true;
      title: string;
    }
  | {
      id: string;
      kind: "song";
      position: number;
      songId: string;
      chartId: string;
      selectedKey: string;
      notes?: string;
      song: { title: string; artist?: string };
      chart: { key: string; originUrl?: string; imported: boolean };
    };

export type SetlistNoteItem = {
  id: string;
  kind: "note";
  position: number;
  text: string;
  notes?: string;
};

export type SetlistItem = SetlistSongItem | SetlistNoteItem;

export type SetlistPermissions = {
  edit: boolean;
  changeStatus: boolean;
  delete: boolean;
};

/** Resposta de API e visões de leitura — sem deletedAt nem ids de seguidores. */
export type Setlist = {
  id: SetlistId;
  organizationId: string;
  ownerTeamId: string | null;
  title: string;
  eventType?: SetlistEventType;
  eventAt?: string;
  status: SetlistStatus;
  visibility: SetlistVisibility;
  notes?: string;
  version: number;
  items: SetlistItem[];
  followerCount: number;
  permissions: SetlistPermissions;
};

export type SetlistSummary = Pick<
  Setlist,
  | "id"
  | "organizationId"
  | "ownerTeamId"
  | "title"
  | "eventType"
  | "eventAt"
  | "status"
  | "visibility"
  | "version"
  | "followerCount"
  | "permissions"
>;

export type FollowedEntry =
  | { setlistId: string; available: true; setlist: SetlistSummary }
  | { setlistId: string; available: false };

export type CreateSetlistInput = {
  title: string;
  ownerTeamId?: string;
  owner?: "organization";
  visibility?: SetlistVisibility;
  eventType?: SetlistEventType;
  eventAt?: string;
  notes?: string;
};

export type UpdateSetlistInput = {
  expectedVersion: number;
  title?: string;
  eventType?: SetlistEventType | null;
  eventAt?: string | null;
  notes?: string | null;
  visibility?: SetlistVisibility;
  status?: SetlistStatus;
  confirmFollowersImpact?: boolean;
};

export type ReplaceSetlistItemInput =
  | {
      id?: string;
      kind: "song";
      songId: string;
      chartId: string;
      selectedKey?: string;
      notes?: string;
    }
  | {
      id?: string;
      kind: "note";
      text: string;
      notes?: string;
    };

export type ReplaceSetlistItemsInput = {
  expectedVersion: number;
  items: ReplaceSetlistItemInput[];
};

export type FollowSetlistInput = {
  teamId: string;
};

export type CloneSetlistInput =
  | { targetTeamId: string }
  | { target: "organization" };

export type DeleteSetlistInput = {
  expectedVersion: number;
  confirmFollowersImpact?: boolean;
};
