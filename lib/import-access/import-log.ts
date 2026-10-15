import "server-only";

import { getCurrentActor } from "@/lib/auth/current-actor";
import { getPrisma } from "@/lib/persistence/prisma-client";

export type ImportLogAction = "unlock" | "logout" | "preview" | "save";

export type ImportLogEntry = {
  action: ImportLogAction;
  outcome: string;
  url?: string | null;
  chartId?: string | null;
  occurredAt?: Date;
  userId?: string | null;
};

export type ImportLogWriter = {
  write(entry: ImportLogEntry): Promise<void>;
};

async function resolveImportLogUserId(entry: ImportLogEntry): Promise<string | null> {
  if (entry.userId !== undefined) {
    return entry.userId;
  }
  const actor = await getCurrentActor();
  return actor.kind === "user" ? actor.userId : null;
}

export function createPrismaImportLogWriter(): ImportLogWriter {
  return {
    async write(entry: ImportLogEntry): Promise<void> {
      const prisma = getPrisma();
      const userId = await resolveImportLogUserId(entry);
      await prisma.importLog.create({
        data: {
          occurredAt: entry.occurredAt ?? new Date(),
          action: entry.action,
          outcome: entry.outcome,
          url: entry.url ?? null,
          chartId: entry.chartId ?? null,
          userId,
        },
      });
    },
  };
}

let defaultWriter: ImportLogWriter | undefined;

export function getImportLogWriter(): ImportLogWriter {
  defaultWriter ??= createPrismaImportLogWriter();
  return defaultWriter;
}

export function setImportLogWriterForTests(writer: ImportLogWriter | undefined): void {
  defaultWriter = writer;
}

export async function recordImportLog(entry: ImportLogEntry): Promise<void> {
  try {
    await getImportLogWriter().write(entry);
  } catch {
    console.error(
      JSON.stringify({
        code: "IMPORT_LOG_WRITE_FAILED",
        action: entry.action,
      }),
    );
  }
}
