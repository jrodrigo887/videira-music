import "server-only";

import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | undefined;

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
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
  resetPrismaClientForTests();
}
