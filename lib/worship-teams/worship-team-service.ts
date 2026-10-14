import type { Actor } from "@/lib/auth/actor";
import { canPerform } from "@/lib/setlists/setlist-policy";
import { throwSetlistError } from "@/lib/setlists/setlist-errors";
import type { WorshipTeam } from "@/types/identity";

import type { WorshipTeamRepository } from "./worship-team-repository";
import { WorshipTeamNotFoundError } from "./worship-team-repository";
import { resolveTeamSlugCollision, slugifyTeamName } from "./team-slug";

const NAME_MIN = 1;
const NAME_MAX = 60;

export type WorshipTeamService = {
  listTeams(actor: Actor, options: { includeArchived: boolean }): Promise<WorshipTeam[]>;
  createTeam(actor: Actor, input: { name: string }): Promise<WorshipTeam>;
  renameTeam(actor: Actor, id: string, name: string): Promise<WorshipTeam>;
  archiveTeam(actor: Actor, id: string): Promise<WorshipTeam>;
  teamsSelectableBy(actor: Actor): Promise<WorshipTeam[]>;
};

export type WorshipTeamServiceDependencies = {
  organizationId: string;
  repository: WorshipTeamRepository;
  newId: () => string;
};

function assertManageTeams(actor: Actor, organizationId: string): void {
  if (!canPerform(actor, "manageTeams", { type: "organization", organizationId })) {
    throw throwSetlistError(403, "FORBIDDEN");
  }
}

function parseTeamName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
    throw throwSetlistError(400, "INVALID_REQUEST", {
      issues: [{ path: "name", message: "Nome inválido." }],
    });
  }
  return trimmed;
}

function toWorshipTeam(record: {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  archivedAt?: string;
}): WorshipTeam {
  return {
    id: record.id,
    organizationId: record.organizationId,
    slug: record.slug,
    name: record.name,
    ...(record.archivedAt ? { archivedAt: record.archivedAt } : {}),
  };
}

export function createWorshipTeamService(
  dependencies: WorshipTeamServiceDependencies,
): WorshipTeamService {
  const { organizationId, repository, newId } = dependencies;

  return {
    async listTeams(actor, options) {
      assertManageTeams(actor, organizationId);
      const records = await repository.list({
        organizationId,
        includeArchived: options.includeArchived,
      });
      return records.map(toWorshipTeam);
    },

    async createTeam(actor, input) {
      assertManageTeams(actor, organizationId);
      const name = parseTeamName(input.name);
      const baseSlug = slugifyTeamName(name);
      const slugs = new Set(await repository.listSlugs(organizationId));
      const slug = resolveTeamSlugCollision(baseSlug, slugs);
      const created = await repository.create({
        id: newId(),
        organizationId,
        slug,
        name,
      });
      return toWorshipTeam(created);
    },

    async renameTeam(actor, id, rawName) {
      assertManageTeams(actor, organizationId);
      const name = parseTeamName(rawName);
      try {
        const renamed = await repository.rename(id, name);
        if (renamed.organizationId !== organizationId) {
          throw throwSetlistError(404, "FORBIDDEN");
        }
        return toWorshipTeam(renamed);
      } catch (error) {
        if (error instanceof WorshipTeamNotFoundError) {
          throw throwSetlistError(404, "INVALID_REQUEST", {
            issues: [{ path: "id", message: "Grupo não encontrado." }],
          });
        }
        throw error;
      }
    },

    async archiveTeam(actor, id) {
      assertManageTeams(actor, organizationId);
      try {
        const archived = await repository.archive(id);
        if (archived.organizationId !== organizationId) {
          throw throwSetlistError(403, "FORBIDDEN");
        }
        return toWorshipTeam(archived);
      } catch (error) {
        if (error instanceof WorshipTeamNotFoundError) {
          throw throwSetlistError(404, "INVALID_REQUEST", {
            issues: [{ path: "id", message: "Grupo não encontrado." }],
          });
        }
        throw error;
      }
    },

    async teamsSelectableBy(actor) {
      if (actor.kind === "anonymous") {
        return [];
      }

      const records = await repository.list({ organizationId, includeArchived: false });

      if (canPerform(actor, "manageTeams", { type: "organization", organizationId })) {
        return records.map(toWorshipTeam);
      }

      const memberTeamIds = new Set(actor.teams.map((team) => team.teamId));
      return records.filter((team) => memberTeamIds.has(team.id)).map(toWorshipTeam);
    },
  };
}
