import type { UserActor } from "./actor";
import { systemCapabilities, unionCapabilities } from "./capabilities";

/** Monta ator de teste com capacidades derivadas dos papéis de sistema. */
export function testUserActor(
  input: Omit<UserActor, "capabilities" | "kind"> & { capabilities?: UserActor["capabilities"] },
): UserActor {
  const capabilities =
    input.capabilities ??
    unionCapabilities(
      input.roles.map((role) => [...(systemCapabilities(role) ?? [])]),
    );
  return {
    kind: "user",
    ...input,
    capabilities,
    delegations: input.delegations ?? [],
  };
}
