import type { ValidationIssue } from "@/lib/persistence/validate-persistence-input";

export type SetlistErrorExtras = {
  version?: number;
  followerCount?: number;
  issues?: ValidationIssue[];
};

export class SetlistError extends Error {
  readonly status: number;
  readonly code: string;
  readonly extras?: SetlistErrorExtras;

  constructor(status: number, code: string, extras?: SetlistErrorExtras) {
    super(code);
    this.name = "SetlistError";
    this.status = status;
    this.code = code;
    this.extras = extras;
  }
}

export function throwSetlistError(
  status: number,
  code: string,
  extras?: SetlistErrorExtras,
): SetlistError {
  return new SetlistError(status, code, extras);
}
