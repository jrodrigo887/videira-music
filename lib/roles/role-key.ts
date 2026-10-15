const MIN_LABEL_LENGTH = 2;
const MAX_LABEL_LENGTH = 40;

export class RoleKeyError extends Error {
  constructor(readonly code: "INVALID_ROLE") {
    super(code);
    this.name = "RoleKeyError";
  }
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Deriva a chave estável a partir do rótulo (só na criação). */
export function roleKeyFromLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length < MIN_LABEL_LENGTH || trimmed.length > MAX_LABEL_LENGTH) {
    throw new RoleKeyError("INVALID_ROLE");
  }

  const slug = stripDiacritics(trimmed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  if (!slug || slug.length < MIN_LABEL_LENGTH) {
    throw new RoleKeyError("INVALID_ROLE");
  }

  return slug;
}

export function validateRoleLabel(label: string): void {
  const trimmed = label.trim();
  if (trimmed.length < MIN_LABEL_LENGTH || trimmed.length > MAX_LABEL_LENGTH) {
    throw new RoleKeyError("INVALID_ROLE");
  }
}
