import type { Metadata } from "next";
import { Atkinson_Hyperlegible, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${lyricsFont.variable} ${chordFont.variable} bg-canvas font-sans text-content antialiased`}>
        <header className="border-b border-border bg-surface/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-bold text-primary">
              Videira Music
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-content-muted">
              <Link className="transition hover:text-primary" href="/songs">
                Biblioteca
              </Link>
              <Link className="transition hover:text-primary" href="/setlists">
                Setlists
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
