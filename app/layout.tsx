import type { Metadata } from "next";
import { Atkinson_Hyperlegible, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

import { isOrganizationAdmin } from "@/lib/auth/actor";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { isImportModuleVisibleInUi } from "@/lib/import-access/import-module-config";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import "./globals.css";

const lyricsFont = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lyrics",
  display: "swap",
});

const chordFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-chord",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Videira Music",
  description: "PWA para repertorios, cifras e setlists de igreja.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const importLinkVisible = isImportModuleVisibleInUi();
  let groupsLinkVisible = false;
  try {
    const actor = await getCurrentActor();
    groupsLinkVisible = isOrganizationAdmin(actor, DEFAULT_ORGANIZATION_ID);
  } catch {
    groupsLinkVisible = false;
  }

  return (
    <html lang="pt-BR" className="light" data-theme="light">
      <body className={`${lyricsFont.variable} ${chordFont.variable} bg-canvas font-sans text-content antialiased`}>
        <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:py-3.5">
            <Link href="/" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-content transition hover:text-primary">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                V
              </span>
              <span className="hidden sm:inline">
                Videira <span className="text-primary">Music</span>
              </span>
            </Link>
            <nav className="flex min-w-0 items-center gap-1 text-xs font-semibold text-content-muted sm:gap-6 sm:text-sm">
              <Link className="rounded-full px-3 py-1.5 transition hover:bg-surface-muted hover:text-primary" href="/songs">
                Biblioteca
              </Link>
              {importLinkVisible ? (
                <Link className="rounded-full px-3 py-1.5 transition hover:bg-surface-muted hover:text-primary" href="/import">
                  Importar
                </Link>
              ) : null}
              <Link className="rounded-full px-3 py-1.5 transition hover:bg-surface-muted hover:text-primary" href="/setlists">
                Setlists
              </Link>
              {groupsLinkVisible ? (
                <Link className="rounded-full px-3 py-1.5 transition hover:bg-surface-muted hover:text-primary" href="/groups">
                  Grupos
                </Link>
              ) : null}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
