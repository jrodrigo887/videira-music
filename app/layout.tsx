import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

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
      <body className="font-sans antialiased">
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-bold text-leaf-900">
              Videira Music
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
              <Link className="transition hover:text-leaf-700" href="/songs">
                Biblioteca
              </Link>
              <Link className="transition hover:text-leaf-700" href="/setlists">
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
