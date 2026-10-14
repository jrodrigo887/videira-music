export class WorshipTeamNotFoundError extends Error {
  constructor() {
    super("Worship team not found");
    this.name = "WorshipTeamNotFoundError";
  }
}

export type WorshipTeamRecord = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  archivedAt?: string;
};

export type NewWorshipTeam = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
};

export type WorshipTeamListFilter = {
  organizationId: string;
  includeArchived: boolean;
};

export type WorshipTeamRepository = {
  list(filter: WorshipTeamListFilter): Promise<WorshipTeamRecord[]>;
  findById(id: string): Promise<WorshipTeamRecord | undefined>;
  findBySlug(organizationId: string, slug: string): Promise<WorshipTeamRecord | undefined>;
  listSlugs(organizationId: string): Promise<string[]>;
  create(input: NewWorshipTeam): Promise<WorshipTeamRecord>;
  rename(id: string, name: string): Promise<WorshipTeamRecord>;
  archive(id: string): Promise<WorshipTeamRecord>;
};
