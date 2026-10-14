export function canonicalizeOriginUrl(url: string): string {
  const canonical = new URL(url);
  canonical.hash = "";
  return canonical.href;
}
