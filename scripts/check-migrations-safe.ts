import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { checkMigrationSqlFiles } from "../lib/persistence/check-migration-sql";

async function loadMigrationFiles(): Promise<{ path: string; content: string }[]> {
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
      // ignore folders without migration.sql
    }
  }

  return files;
}

async function main(): Promise<void> {
  const files = await loadMigrationFiles();
  if (files.length === 0) {
    console.error("No prisma/migrations/*/migration.sql files found.");
    process.exit(1);
  }

  const violations = checkMigrationSqlFiles(files);
  if (violations.length > 0) {
    console.error("Destructive SQL patterns found in Prisma migrations:\n");
    for (const violation of violations) {
      console.error(
        `  ${violation.file}:${violation.line} [${violation.rule}] ${violation.excerpt}`,
      );
    }
    console.error(
      "\nProduction uses `prisma migrate deploy`, which runs these files as written.",
    );
    console.error("See docs/database.md — use additive migrations and a manual data plan.");
    process.exit(1);
  }

  console.log(`OK: ${files.length} migration file(s) passed the safety check.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
