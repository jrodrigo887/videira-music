import type { ChordChart, Song } from "@/types/music";
import type {
  SetlistEventType,
  SetlistStatus,
  SetlistVisibility,
} from "@/types/setlist";

export class SetlistVersionConflictError extends Error {
  readonly currentVersion: number;

  constructor(currentVersion: number) {
    super("Setlist version conflict");
    this.name = "SetlistVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export type SetlistItemRecord =
  | {
      id: string;
      kind: "song";
      position: number;
      songId: string;
      chartId: string;
      selectedKey: string;
      notes?: string;
      songTitle: string;
      songArtist?: string;
      songDeletedAt?: string | null;
      chartKey: string;
      originUrl?: string;
      imported: boolean;
    }
  | {
      id: string;
      kind: "note";
      position: number;
      text: string;
      notes?: string;
    };

export type SetlistRecord = {
  id: string;
  organizationId: string;
  ownerTeamId: string | null;
  ownerUserId: string | null;
  createdByUserId: string | null;
  title: string;
  eventType?: SetlistEventType;
  eventAt?: string;
  status: SetlistStatus;
  visibility: SetlistVisibility;
  notes?: string;
  version: number;
  deletedAt?: string;
  followerTeamIds: string[];
  items: SetlistItemRecord[];
};

export type NewSetlist = {
  id: string;
  organizationId: string;
  ownerTeamId: string | null;
  createdByUserId?: string | null;
  title: string;
  eventType?: SetlistEventType;
  eventAt?: string;
  status: SetlistStatus;
  visibility: SetlistVisibility;
  notes?: string;
};

export type NewSetlistItem =
  | {
      id: string;
      kind: "song";
      songId: string;
      chartId: string;
      selectedKey: string;
      notes?: string;
    }
  | {
      id: string;
      kind: "note";
      text: string;
      notes?: string;
    };

export type SetlistMetaPatch = {
  title?: string;
  eventType?: SetlistEventType | null;
  eventAt?: string | null;
  notes?: string | null;
  visibility?: SetlistVisibility;
  status?: SetlistStatus;
};

export type ClonePlanSongCreate = {
  song: Song;
  sourceOrganizationId: string;
};

export type ClonePlanChartCreate = {
  chart: ChordChart;
  sourceOrganizationId: string;
};

export type ClonePlanSetlistCreate = {
  id: string;
  organizationId: string;
  ownerTeamId: string | null;
  title: string;
  eventType?: SetlistEventType;
  status: SetlistStatus;
  visibility: SetlistVisibility;
  notes?: string;
};

export type ClonePlanItemCreate =
  | {
      id: string;
      kind: "song";
      songId: string;
      chartId: string;
      selectedKey: string;
      notes?: string;
    }
  | {
      id: string;
      kind: "note";
      text: string;
      notes?: string;
    };

export type ClonePlan = {
  songsToCreate: ClonePlanSongCreate[];
  chartsToCreate: ClonePlanChartCreate[];
  setlist: ClonePlanSetlistCreate;
  items: ClonePlanItemCreate[];
};

export type SetlistListFilter = {
  organizationId: string;
  ownerTeamId?: string | null;
  includeArchived: boolean;
};

export type SetlistRepository = {
  findById(id: string): Promise<SetlistRecord | undefined>;
  list(filter: SetlistListFilter): Promise<SetlistRecord[]>;
  listFollowedBy(teamId: string): Promise<SetlistRecord[]>;
  create(input: NewSetlist): Promise<SetlistRecord>;
  updateMeta(id: string, expectedVersion: number, patch: SetlistMetaPatch): Promise<SetlistRecord>;
  replaceItems(
    id: string,
    expectedVersion: number,
    items: NewSetlistItem[],
    existingItemIds?: ReadonlySet<string>,
  ): Promise<SetlistRecord>;
  softDelete(id: string, expectedVersion: number): Promise<void>;
  follow(setlistId: string, teamId: string): Promise<void>;
  unfollow(setlistId: string, teamId: string): Promise<void>;
  applyClonePlan(plan: ClonePlan): Promise<SetlistRecord>;
};
