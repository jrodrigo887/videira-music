import type { Metadata } from "next";
import { Atkinson_Hyperlegible, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

import { hasCapability } from "@/lib/auth/actor";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { can } from "@/lib/auth/permissions";
import { AppHeaderNav } from "@/components/layout/app-header-nav";
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
  let actor = await getCurrentActor().catch(() => ({ kind: "anonymous" as const }));
  const loggedIn = actor.kind === "user";
  const groupsLinkVisible =
    loggedIn && hasCapability(actor, "teams:manage", DEFAULT_ORGANIZATION_ID);
  const usersLinkVisible =
    loggedIn && can(actor, "users:manage", { organizationId: actor.organizationId });
  const importLinkVisible =
    loggedIn && can(actor, "import", { organizationId: actor.organizationId });

  return (
    <html lang="pt-BR" className="light" data-theme="light">
      <body className={`${lyricsFont.variable} ${chordFont.variable} bg-canvas font-sans text-content antialiased`}>
        <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 sm:gap-3 sm:py-3.5">
            <Link href="/" className="flex shrink-0 items-center gap-2.5 text-lg font-extrabold tracking-tight text-content transition hover:text-primary">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                V
              </span>
              <span className="hidden sm:inline">
                Videira <span className="text-primary">Music</span>
              </span>
            </Link>
            <AppHeaderNav
              loggedIn={loggedIn}
              importLinkVisible={importLinkVisible}
              groupsLinkVisible={groupsLinkVisible}
              usersLinkVisible={usersLinkVisible}
            />
          </div>
        </header>
        <main className="mx-auto max-w-6xl overflow-x-hidden px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
