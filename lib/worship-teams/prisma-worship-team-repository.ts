import type { PrismaClient } from "@prisma/client";

import type {
  NewWorshipTeam,
  WorshipTeamListFilter,
  WorshipTeamRecord,
  WorshipTeamRepository,
} from "./worship-team-repository";
import { WorshipTeamNotFoundError } from "./worship-team-repository";

function toRecord(row: {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  archivedAt: Date | null;
}): WorshipTeamRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    slug: row.slug,
    name: row.name,
    ...(row.archivedAt ? { archivedAt: row.archivedAt.toISOString() } : {}),
  };
}

export class PrismaWorshipTeamRepository implements WorshipTeamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filter: WorshipTeamListFilter): Promise<WorshipTeamRecord[]> {
    const rows = await this.prisma.worshipTeam.findMany({
      where: {
        organizationId: filter.organizationId,
        ...(filter.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { name: "asc" },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<WorshipTeamRecord | undefined> {
    const row = await this.prisma.worshipTeam.findFirst({ where: { id } });
    return row ? toRecord(row) : undefined;
  }

  async findBySlug(organizationId: string, slug: string): Promise<WorshipTeamRecord | undefined> {
    const row = await this.prisma.worshipTeam.findFirst({
      where: { organizationId, slug },
    });
    return row ? toRecord(row) : undefined;
  }

  async listSlugs(organizationId: string): Promise<string[]> {
    const rows = await this.prisma.worshipTeam.findMany({
      where: { organizationId },
      select: { slug: true },
    });
    return rows.map((row) => row.slug);
  }

  async create(input: NewWorshipTeam): Promise<WorshipTeamRecord> {
    const row = await this.prisma.worshipTeam.create({
      data: {
        id: input.id,
        organizationId: input.organizationId,
        slug: input.slug,
        name: input.name,
      },
    });
    return toRecord(row);
  }

  async rename(id: string, name: string): Promise<WorshipTeamRecord> {
    try {
      const row = await this.prisma.worshipTeam.update({
        where: { id },
        data: { name },
      });
      return toRecord(row);
    } catch {
      throw new WorshipTeamNotFoundError();
    }
  }

  async archive(id: string): Promise<WorshipTeamRecord> {
    try {
      const row = await this.prisma.worshipTeam.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      return toRecord(row);
    } catch {
      throw new WorshipTeamNotFoundError();
    }
  }
}
