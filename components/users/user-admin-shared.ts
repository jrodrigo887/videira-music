import type { OrganizationRole } from "@/types/identity";

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  status: "active" | "deactivated";
  roles: string[];
  teamIds: string[];
};

export type ApiError = { error?: { code?: string; message?: string } };

export const SYSTEM_ROLE_LABELS: Record<OrganizationRole, string> = {
  admin: "Administrador",
  manager: "Gestor",
  worship_leader: "Líder de louvor",
  musician: "Músico",
};

export const CUSTOM_ROLE_MATCHES_ADMIN_MESSAGE =
  "Um papel personalizado não pode ter as mesmas capacidades do administrador.";

export const CAPABILITY_LABELS: Record<string, string> = {
  "users:invite": "Convidar",
  "users:manage": "Gerenciar membros",
  "teams:manage": "Gerenciar grupos",
  "music:write": "Editar músicas",
  import: "Importar",
  "setlists:all": "Setlists de todos os grupos",
  "setlists:led": "Setlists dos grupos que lidera",
};

export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    if (body.error?.code === "LAST_ADMIN") {
      return "A igreja precisa de ao menos um administrador ativo.";
    }
    if (body.error?.code === "USER_EXISTS") {
      return "Já existe um usuário ativo com este e-mail.";
    }
    if (body.error?.code === "ROLE_IN_USE") {
      return "Este papel está em uso e não pode ser apagado.";
    }
    if (body.error?.code === "SYSTEM_ROLE") {
      return "Papéis de sistema não podem ser alterados aqui.";
    }
    if (body.error?.code === "ROLE_MATCHES_ADMIN") {
      return CUSTOM_ROLE_MATCHES_ADMIN_MESSAGE;
    }
    if (body.error?.code === "FORBIDDEN") {
      return "Sem permissão para esta ação.";
    }
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function formatRoleLabel(key: string, customLabels: Map<string, string>): string {
  if (key in SYSTEM_ROLE_LABELS) {
    return SYSTEM_ROLE_LABELS[key as OrganizationRole];
  }
  return customLabels.get(key) ?? key;
}
