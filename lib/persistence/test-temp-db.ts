import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import { ensureDefaultOrganization } from "./organization-scope";

export function createTempDatabaseUrl(): { url: string; cleanup: () => void } {
  const directory = mkdtempSync(join(tmpdir(), "videira-music-"));
  const filePath = join(directory, "test.db");
  const url = `file:${filePath}`;
  return {
    url,
    cleanup: () => {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

export function applyMigrations(databaseUrl: string): void {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
}

export async function createTestPrismaClient(databaseUrl: string): Promise<PrismaClient> {
  process.env.DATABASE_URL = databaseUrl;
  applyMigrations(databaseUrl);
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  await ensureDefaultOrganization(prisma);
  return prisma;
}

export async function destroyTestPrismaClient(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect();
}
