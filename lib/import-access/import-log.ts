import "server-only";

import { getPrisma } from "@/lib/persistence/prisma-client";

export type ImportLogAction = "unlock" | "logout" | "preview" | "save";

export type ImportLogEntry = {
  action: ImportLogAction;
  outcome: string;
  url?: string | null;
  chartId?: string | null;
  occurredAt?: Date;
};

export type ImportLogWriter = {
  write(entry: ImportLogEntry): Promise<void>;
};

export function createPrismaImportLogWriter(): ImportLogWriter {
  return {
    async write(entry: ImportLogEntry): Promise<void> {
      const prisma = getPrisma();
      await prisma.importLog.create({
        data: {
          occurredAt: entry.occurredAt ?? new Date(),
          action: entry.action,
          outcome: entry.outcome,
          url: entry.url ?? null,
          chartId: entry.chartId ?? null,
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
