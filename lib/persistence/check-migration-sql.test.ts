import { describe, expect, it } from "vitest";

import { checkMigrationSqlFiles, scanMigrationSql } from "./check-migration-sql";

describe("scanMigrationSql", () => {
  it("allows additive migrations like create table and backfill updates", () => {
    const sql = `
-- CreateTable
CREATE TABLE "RoleDefinition" ("id" TEXT NOT NULL);
ALTER TABLE "auth_account" ADD COLUMN "issuer" TEXT;
UPDATE "auth_account" SET "issuer" = 'x' WHERE "issuer" IS NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
`;

    expect(scanMigrationSql(sql, "safe.sql")).toEqual([]);
  });

  it("flags destructive statements that would drop or wipe data", () => {
    const sql = `
DROP TABLE "Song";
TRUNCATE "ChordChart";
DELETE FROM "User";
ALTER TABLE "Song" DROP COLUMN "title";
`;

    const violations = scanMigrationSql(sql, "bad.sql");
    expect(violations.map((v) => v.rule)).toEqual([
      "drop-table",
      "truncate",
      "delete-from",
      "drop-column",
    ]);
  });

  it("ignores ON DELETE CASCADE in foreign key definitions", () => {
    const sql = `
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
`;

    expect(scanMigrationSql(sql)).toEqual([]);
  });
});

describe("checkMigrationSqlFiles", () => {
  it("aggregates violations across migration files", () => {
    const violations = checkMigrationSqlFiles([
      { path: "a.sql", content: "SELECT 1;" },
      { path: "b.sql", content: "DROP TABLE \"x\";" },
    ]);

    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe("b.sql");
  });
});

describe("versioned prisma migrations", () => {
  it("passes the safety check for every committed migration.sql", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");

    const migrationsDir = join(process.cwd(), "prisma/migrations");
    const entries = await readdir(migrationsDir, { withFileTypes: true });
    const files: { path: string; content: string }[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const sqlPath = join(migrationsDir, entry.name, "migration.sql");
      try {
        const content = await readFile(sqlPath, "utf8");
        files.push({
          path: `prisma/migrations/${entry.name}/migration.sql`,
          content,
        });
      } catch {
        // directory without migration.sql
      }
    }

    expect(files.length).toBeGreaterThan(0);
    expect(checkMigrationSqlFiles(files)).toEqual([]);
  });
});
