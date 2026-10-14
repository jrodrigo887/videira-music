import { normalizeSearchPart } from "@/lib/persistence/search-text";

/** Slug estável derivado do nome na criação (GRP-03). */
export function slugifyTeamName(name: string): string {
  const normalized = normalizeSearchPart(name.trim());
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug.length > 0 ? slug : "grupo";
}

export function resolveTeamSlugCollision(baseSlug: string, takenSlugs: ReadonlySet<string>): string {
  if (!takenSlugs.has(baseSlug)) {
    return baseSlug;
  }
  let suffix = 2;
  while (takenSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseSlug}-${suffix}`;
}
