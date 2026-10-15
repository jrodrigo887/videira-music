/** Normaliza e-mail para comparação e armazenamento (AUTH assumptions). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
