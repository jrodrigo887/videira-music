import Link from "next/link";
import { notFound } from "next/navigation";

import { ImportedBadge } from "@/components/setlists/imported-badge";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { getPublicLyrics } from "@/lib/public-lyrics/public-lyrics";

type PageProps = {
  params: Promise<{ songId: string }>;
};

export default async function LetrasPublicasPage({ params }: PageProps) {
  const { songId } = await params;
  if (!isDatabaseConfigured()) {
    notFound();
  }
  const prisma = getPrisma();
  const lyrics = await getPublicLyrics(prisma, songId);
  if (!lyrics) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-2xl ds-card p-8">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-content">{lyrics.title}</h1>
        {lyrics.artist ? (
          <p className="mt-1 text-sm text-content-muted">{lyrics.artist}</p>
        ) : null}
        {lyrics.imported ? (
          <div className="mt-3">
            <ImportedBadge originUrl={lyrics.imported.originUrl} />
          </div>
        ) : null}
      </header>
      <div className="mt-6 space-y-6 font-[family-name:var(--font-lyrics)] text-base leading-relaxed">
        {lyrics.sections.map((section) => (
          <section key={section.label || "section"}>
            {section.label ? (
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-muted">
                {section.label}
              </h2>
            ) : null}
            {section.lines.map((line, index) => (
              <p key={`${section.label}-${index}`}>{line}</p>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-8 text-center text-sm">
        <Link href="/" className="text-primary hover:underline">
          Voltar ao catálogo
        </Link>
      </p>
    </article>
  );
}
