import type { PrismaClient } from "@prisma/client";

export const DEFAULT_ORGANIZATION_ID = "org-default";
export const DEFAULT_ORGANIZATION_SLUG = "default";
export const DEFAULT_ORGANIZATION_NAME = "Videira";

export async function getDefaultOrganizationId(prisma: PrismaClient): Promise<string> {
  const organization = await prisma.organization.findUnique({
    where: { slug: DEFAULT_ORGANIZATION_SLUG },
    select: { id: true },
  });
  if (!organization) {
    throw new Error("Default organization is missing. Run the database seed.");
  }
  return organization.id;
}

export async function ensureDefaultOrganization(prisma: PrismaClient): Promise<string> {
  const organization = await prisma.organization.upsert({
    where: { slug: DEFAULT_ORGANIZATION_SLUG },
    create: {
      id: DEFAULT_ORGANIZATION_ID,
      slug: DEFAULT_ORGANIZATION_SLUG,
      name: DEFAULT_ORGANIZATION_NAME,
    },
    update: {},
    select: { id: true },
  });
  return organization.id;
}
