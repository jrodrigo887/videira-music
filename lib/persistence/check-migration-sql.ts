export type MigrationSqlViolation = {
  file: string;
  line: number;
  rule: string;
  excerpt: string;
};

/** Patterns that usually imply data loss when run via `prisma migrate deploy`. */
const DESTRUCTIVE_RULES: { id: string; pattern: RegExp }[] = [
  { id: "drop-table", pattern: /\bDROP\s+TABLE\b/i },
  { id: "drop-database", pattern: /\bDROP\s+DATABASE\b/i },
  { id: "truncate", pattern: /\bTRUNCATE\b/i },
  { id: "delete-from", pattern: /\bDELETE\s+FROM\b/i },
  { id: "drop-column", pattern: /\bALTER\s+TABLE\b.*\bDROP\s+COLUMN\b/i },
  { id: "drop-type", pattern: /\bDROP\s+TYPE\b/i },
];

function stripSqlLineComment(line: string): string {
  return line.replace(/--.*$/, "").trim();
}

export function scanMigrationSql(
  content: string,
  file = "migration.sql",
): MigrationSqlViolation[] {
  const violations: MigrationSqlViolation[] = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const stripped = stripSqlLineComment(lines[index]);
    if (!stripped) {
      continue;
    }

    for (const rule of DESTRUCTIVE_RULES) {
      if (rule.pattern.test(stripped)) {
        violations.push({
          file,
          line: index + 1,
          rule: rule.id,
          excerpt: stripped.slice(0, 160),
        });
      }
    }
  }

  return violations;
}

export function checkMigrationSqlFiles(
  files: { path: string; content: string }[],
): MigrationSqlViolation[] {
  return files.flatMap(({ path, content }) => scanMigrationSql(content, path));
}
