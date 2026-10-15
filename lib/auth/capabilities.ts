import type { OrganizationRole } from "@/types/identity";

export const CAPABILITIES = [
  "users:invite",
  "users:manage",
  "teams:manage",
  "music:write",
  "import",
  "setlists:all",
  "setlists:led",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const SYSTEM_ROLE_KEYS: readonly OrganizationRole[] = [
  "admin",
  "manager",
  "worship_leader",
  "musician",
];

const ADMIN_CAPS: readonly Capability[] = [...CAPABILITIES];

const MANAGER_CAPS: readonly Capability[] = [
  "users:invite",
  "users:manage",
  "teams:manage",
  "music:write",
  "import",
  "setlists:all",
];

const WORSHIP_LEADER_CAPS: readonly Capability[] = ["music:write", "import", "setlists:led"];

const MUSICIAN_CAPS: readonly Capability[] = [];

export function systemCapabilities(key: string): readonly Capability[] | undefined {
  switch (key) {
    case "admin":
      return ADMIN_CAPS;
    case "manager":
      return MANAGER_CAPS;
    case "worship_leader":
      return WORSHIP_LEADER_CAPS;
    case "musician":
      return MUSICIAN_CAPS;
    default:
      return undefined;
  }
}

export function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value);
}

export function unionCapabilities(parts: readonly (readonly Capability[])[]): Capability[] {
  const set = new Set<Capability>();
  for (const group of parts) {
    for (const cap of group) {
      set.add(cap);
    }
  }
  return [...set];
}

export function parseStoredCapabilities(raw: unknown): Capability[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is Capability => isCapability(String(entry)));
}
