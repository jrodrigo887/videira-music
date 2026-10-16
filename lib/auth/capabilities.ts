import type { Actor } from "./actor";
import type { OrganizationRole } from "@/types/identity";

export const CAPABILITIES = [
  "users:invite",
  "member.manage",
  "user.manage",
  "role.manage",
  "teams:manage",
  "music:write",
  "import",
  "setlists:all",
  "setlists:led",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const ADMIN_ONLY_CAPABILITIES: readonly Capability[] = ["user.manage", "role.manage"];

const IMPLIES_BASE: Partial<Record<Capability, Capability>> = {
  import: "music:write",
  "member.manage": "users:invite",
  "setlists:all": "setlists:led",
};

export const SYSTEM_ROLE_KEYS: readonly OrganizationRole[] = [
  "admin",
  "manager",
  "worship_leader",
  "musician",
];

const ADMIN_CAPS: readonly Capability[] = closeCapabilities([...CAPABILITIES]);

const MANAGER_CAPS: readonly Capability[] = closeCapabilities([
  "users:invite",
  "member.manage",
  "teams:manage",
  "music:write",
  "import",
  "setlists:all",
]);

const WORSHIP_LEADER_CAPS: readonly Capability[] = closeCapabilities([
  "music:write",
  "import",
  "setlists:led",
]);

const MUSICIAN_CAPS: readonly Capability[] = [];

export function closeCapabilities(capabilities: readonly Capability[]): Capability[] {
  const set = new Set<Capability>(capabilities);
  for (const cap of capabilities) {
    const base = IMPLIES_BASE[cap];
    if (base) {
      set.add(base);
    }
  }
  return [...set];
}

export function holdsCapability(
  actor: Actor,
  capability: Capability,
  organizationId: string,
): boolean {
  if (actor.kind !== "user" || actor.organizationId !== organizationId) {
    return false;
  }
  if (actor.capabilities.includes(capability)) {
    return true;
  }
  for (const [dependent, base] of Object.entries(IMPLIES_BASE) as [Capability, Capability][]) {
    if (base === capability && actor.capabilities.includes(dependent)) {
      return true;
    }
  }
  return false;
}

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
  return raw.filter(
    (entry): entry is Capability => isCapability(String(entry)) && String(entry) !== "users:manage",
  );
}

/** True when the selection includes every capability from the system `admin` preset. */
export function capabilitiesMatchAdminPreset(capabilities: readonly string[]): boolean {
  const adminPreset = systemCapabilities("admin");
  if (!adminPreset) {
    return false;
  }
  const selected = new Set(capabilities.filter(isCapability));
  return adminPreset.every((cap) => selected.has(cap));
}
