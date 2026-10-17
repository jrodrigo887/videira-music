import type { Metadata } from "next";
import { Atkinson_Hyperlegible, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

import { getCurrentActor } from "@/lib/auth/current-actor";
import { can } from "@/lib/auth/permissions";
import { AppHeaderNav } from "@/components/layout/app-header-nav";
import { getAppVersion } from "@/lib/app-version";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { brandStyle, videiraBrand } from "@/lib/design/brand";

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
  const actor = await getCurrentActor().catch(() => ({ kind: "anonymous" as const }));
  const loggedIn = actor.kind === "user";
  const organizationId = loggedIn ? actor.organizationId : DEFAULT_ORGANIZATION_ID;
  const groupsLinkVisible = loggedIn && can(actor, "teams:manage", { organizationId });
  const usersLinkVisible =
    loggedIn &&
    (can(actor, "member.manage", { organizationId }) ||
      can(actor, "users:invite", { organizationId }) ||
      can(actor, "user.manage", { organizationId }));
  const importLinkVisible = loggedIn && can(actor, "import", { organizationId });
  const appVersion = getAppVersion();

  return (
    <html lang="pt-BR" className="light" data-theme="light" style={brandStyle(videiraBrand)}>
      <body className={`${lyricsFont.variable} ${chordFont.variable} bg-canvas font-sans text-content antialiased`}>
        <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 sm:gap-3 sm:py-3.5">
            <Link href="/" className="flex shrink-0 items-center gap-2.5 text-lg font-extrabold tracking-tight text-content transition hover:text-primary">
              <span className="hidden h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm sm:flex">
                V
              </span>
              <span className="flex flex-col gap-0.5 leading-none">
                <span>
                  Videira <span className="text-primary">Music</span>
                </span>
                <span
                  className="text-[9px] font-normal tracking-normal text-content-muted"
                  title={appVersion.sha ?? undefined}
                >
                  <span className="sr-only">Versão </span>
                  {appVersion.label}
                </span>
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
