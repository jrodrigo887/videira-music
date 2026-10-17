import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

function collectTsx(relativeDir: string): string[] {
  const base = join(root, relativeDir);
  const files: string[] = [];
  for (const name of readdirSync(base)) {
    const full = join(base, name);
    if (statSync(full).isDirectory()) {
      files.push(...collectTsx(join(relativeDir, name)));
    } else if (name.endsWith(".tsx") && !name.endsWith(".test.tsx")) {
      files.push(join(relativeDir, name));
    }
  }
  return files;
}

describe("theme file contract", () => {
  const globals = read("app/globals.css");
  const tailwind = read("tailwind.config.ts");
  const designDoc = read("docs/design-system.md");

  it("maps light primary and chord semantics to brand variables", () => {
    expect(globals).toContain("--color-primary: var(--brand-primary);");
    expect(globals).toContain("--color-primary-hover: var(--brand-primary-hover);");
    expect(globals).toContain("--color-primary-foreground: var(--brand-primary-foreground);");
    expect(globals).toContain("--color-primary-subtle: var(--brand-primary-subtle);");
    expect(globals).toContain("--color-chord: var(--brand-chord);");
    expect(globals).toContain("--color-focus: var(--videira-500);");
  });

  it("keeps dark primary and chord as literals without brand references", () => {
    const darkStart = globals.indexOf(':root.dark');
    const darkBlock = globals.slice(darkStart, globals.indexOf("  * {", darkStart));
    expect(darkBlock).toContain("--color-primary: 134 45% 58%;");
    expect(darkBlock).toContain("--color-primary-hover: 134 50% 66%;");
    expect(darkBlock).toContain("--color-primary-subtle: 136 28% 18%;");
    expect(darkBlock).toContain("--color-chord: 134 45% 58%;");
    expect(darkBlock).not.toMatch(/var\(--brand-/);
  });

  it("defines light status channels", () => {
    expect(globals).toContain("--color-danger: 0 72% 38%;");
    expect(globals).toContain("--color-danger-hover: 0 72% 30%;");
    expect(globals).toContain("--color-danger-foreground: 0 0% 100%;");
    expect(globals).toContain("--color-danger-subtle: 0 70% 96%;");
    expect(globals).toContain("--color-warning: 32 80% 28%;");
    expect(globals).toContain("--color-success-subtle: 164 40% 95%;");
  });

  it("defines dark status channels", () => {
    expect(globals).toContain("--color-danger: 0 85% 72%;");
    expect(globals).toContain("--color-warning-foreground: 240 10% 10%;");
    expect(globals).toContain("--color-success-hover: 164 45% 70%;");
    expect(globals).toContain("--color-success-subtle: 164 25% 16%;");
  });

  it("exposes danger, warning and success in Tailwind like primary", () => {
    expect(tailwind).toContain('DEFAULT: "hsl(var(--color-danger) / <alpha-value>)"');
    expect(tailwind).toContain('hover: "hsl(var(--color-danger-hover) / <alpha-value>)"');
    expect(tailwind).toContain('DEFAULT: "hsl(var(--color-warning) / <alpha-value>)"');
    expect(tailwind).toContain('DEFAULT: "hsl(var(--color-success) / <alpha-value>)"');
  });

  it("retargets ds-badge-accent and adds ds-button-danger", () => {
    expect(globals).toContain("bg-primary-subtle");
    expect(globals).toMatch(/\.ds-badge-accent[\s\S]*text-primary/);
    expect(globals).toMatch(/\.ds-button-danger[\s\S]*bg-danger/);
    expect(globals).toMatch(/\.ds-button-danger[\s\S]*text-danger-foreground/);
    expect(globals).toMatch(/\.ds-button-danger[\s\S]*hover:bg-danger-hover/);
  });

  it("documents videiraBrand and what stays fixed", () => {
    expect(designDoc).toContain("videiraBrand");
    expect(designDoc).toContain("primaryHover");
    expect(designDoc).toContain("primaryForeground");
    expect(designDoc).toContain("primarySubtle");
    expect(designDoc).toMatch(/neutros.*status.*mesa\/estante/i);
    expect(designDoc).not.toContain("Status ainda não está em `globals.css`");
  });

  it("forbids Tailwind red palette and ds-button-primary in app and components tsx", () => {
    const files = [...collectTsx("app"), ...collectTsx("components")];
    const offenders: string[] = [];
    for (const file of files) {
      const source = read(file);
      if (
        /text-red-|border-red-|bg-red-|ds-button-primary/.test(source)
      ) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("wires setlist editor destructive hover to danger tokens", () => {
    const editor = read("components/setlists/setlist-editor.tsx");
    expect(editor).toContain("hover:border-danger hover:text-danger");
    expect(editor).not.toMatch(/red-/);
  });

  it("keeps dialog focus effect scoped to open with onClose in a ref", () => {
    const dialog = read("components/ui/dialog.tsx");
    expect(dialog).toMatch(/useEffect\([\s\S]*\[open\]/);
    expect(dialog).toContain("onCloseRef");
  });
});
