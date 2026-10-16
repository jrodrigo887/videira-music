import type { Capability } from "./capabilities";

const IMPLIES_BASE: Partial<Record<Capability, Capability>> = {
  import: "music:write",
  "member.manage": "users:invite",
  "setlists:all": "setlists:led",
};

const DEPENDENT_OF: Partial<Record<Capability, Capability>> = {
  import: "music:write",
  "member.manage": "users:invite",
  "setlists:all": "setlists:led",
};

export type ToggleCapabilityResult = {
  capabilities: Capability[];
  warning: boolean;
};

export function toggleCapability(
  current: readonly Capability[],
  capability: Capability,
  enabled: boolean,
): ToggleCapabilityResult {
  const set = new Set(current);

  if (enabled) {
    set.add(capability);
    const base = IMPLIES_BASE[capability];
    if (base) {
      set.add(base);
    }
    return { capabilities: [...set], warning: false };
  }

  set.delete(capability);
  let warning = false;
  for (const [dependent, base] of Object.entries(DEPENDENT_OF) as [Capability, Capability][]) {
    if (base === capability && set.has(dependent)) {
      set.delete(dependent);
      warning = true;
    }
  }
  return { capabilities: [...set], warning };
}
