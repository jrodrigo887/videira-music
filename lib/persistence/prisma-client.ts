import "server-only";

import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | undefined;
let pragmasApplied = false;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new DatabaseNotConfiguredError();
  }

  prisma ??= new PrismaClient({
    datasources: { db: { url } },
  });

  return prisma;
}

export async function ensureSqlitePragmas(client: PrismaClient): Promise<void> {
  if (pragmasApplied) {
    return;
  }
  await client.$executeRawUnsafe("PRAGMA foreign_keys = ON;");
  await client.$executeRawUnsafe("PRAGMA journal_mode = WAL;");
  await client.$executeRawUnsafe("PRAGMA busy_timeout = 5000;");
  pragmasApplied = true;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not configured");
    this.name = "DatabaseNotConfiguredError";
  }
}

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("Database unavailable");
    this.name = "DatabaseUnavailableError";
  }
}

export function resetPrismaClientForTests(): void {
  prisma = undefined;
  pragmasApplied = false;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
  resetPrismaClientForTests();
}

export function isDatabaseBusyError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return message.includes("database is locked") || message.includes("SQLITE_BUSY");
}
