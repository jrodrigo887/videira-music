import { describe, expect, it } from "vitest";

import {
  ADMIN_ONLY_CAPABILITY_MESSAGE,
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
} from "./user-admin-shared";

describe("user-admin-shared", () => {
  it("groups capability labels", () => {
    expect(CAPABILITY_GROUPS.map((group) => group.title)).toEqual([
      "Biblioteca",
      "Setlists",
      "Grupos e pessoas",
      "Administração",
    ]);
    expect(CAPABILITY_LABELS["user.manage"]).toBe("Área de usuário");
    expect(CAPABILITY_LABELS["role.manage"]).toBe("Gerenciar papéis");
    expect(CAPABILITY_LABELS["member.manage"]).toBe("Gerenciar membros");
    expect(ADMIN_ONLY_CAPABILITY_MESSAGE).toBe(
      "Somente o papel Administrador pode ter esta capacidade.",
    );
  });
});
