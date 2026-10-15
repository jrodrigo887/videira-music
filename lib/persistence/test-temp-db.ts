import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { Client } from "pg";

import { ensureDefaultOrganization } from "./organization-scope";

const projectRoot = process.cwd();

/** Maintenance database on the local Postgres from docker-compose.yml (host port 5433). */
const ADMIN_URL = "postgresql://videira:videira@127.0.0.1:5433/postgres";

const droppedDatabases = new Set<string>();
const databaseByClient = new WeakMap<PrismaClient, string>();

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe database name: ${name}`);
  }
  return `"${name}"`;
}

function databaseNameFromUrl(databaseUrl: string): string {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Database URL has no usable database name: ${databaseUrl}`);
  }
  return name;
}

function databaseUrlFor(name: string): string {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  url.searchParams.set("connection_limit", "1");
  return url.toString();
}

async function withAdminClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: ADMIN_URL,
    connectionTimeoutMillis: 3_000,
  });
  try {
    await client.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not connect to local Postgres at ${ADMIN_URL}. Start it with \`docker compose up -d\` in the repo root. ${message}`,
    );
  }
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function dropDatabase(name: string): Promise<void> {
  if (droppedDatabases.has(name)) {
    return;
  }
  await withAdminClient(async (client) => {
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [name],
    );
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)}`);
  });
  droppedDatabases.add(name);
}

export async function createTempDatabaseUrl(): Promise<{
  url: string;
  cleanup: () => Promise<void>;
}> {
  const name = `videira_test_${randomUUID().replaceAll("-", "")}`;
  await withAdminClient(async (client) => {
    await client.query(`CREATE DATABASE ${quoteIdent(name)}`);
  });
  return {
    url: databaseUrlFor(name),
    cleanup: () => dropDatabase(name),
  };
}

export function applyMigrations(databaseUrl: string): void {
  try {
    execSync("npx prisma migrate deploy", {
      cwd: projectRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl,
      },
      stdio: "pipe",
    });
  } catch (error) {
    const failure = error as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const details = [failure.stdout?.toString(), failure.stderr?.toString()].filter(Boolean).join("\n");
    throw new Error(`prisma migrate deploy failed\n${details || failure.message}`);
  }
}

export async function createTestPrismaClient(databaseUrl: string): Promise<PrismaClient> {
  process.env.DATABASE_URL = databaseUrl;
  process.env.DIRECT_URL = databaseUrl;
  applyMigrations(databaseUrl);
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  databaseByClient.set(prisma, databaseNameFromUrl(databaseUrl));
  await ensureDefaultOrganization(prisma);
  return prisma;
}

export async function destroyTestPrismaClient(prisma: PrismaClient): Promise<void> {
  const name = databaseByClient.get(prisma);
  databaseByClient.delete(prisma);
  await prisma.$disconnect();
  if (name) {
    await dropDatabase(name);
  }
}
