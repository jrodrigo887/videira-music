import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { ImportedBadge } from "@/components/setlists/imported-badge";
import { resolveClientIp } from "@/lib/http/client-ip";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import {
  createShareRateLimitResponse,
  SHARE_RATE_LIMIT_MESSAGE,
} from "@/lib/setlists/share-rate-limit-http";
import { getShareTokenRateLimiter } from "@/lib/setlists/share-rate-limit";
import { readSharedLyrics } from "@/lib/setlists/share-link-service";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function PublicSetlistSharePage({ params }: PageProps) {
  const { code } = await params;

  if (!isDatabaseConfigured()) {
    notFound();
  }

  const requestHeaders = await headers();
  const ip = resolveClientIp(new Request("http://local", { headers: requestHeaders }));
  const rateLimited = createShareRateLimitResponse(ip, Date.now());
  if (rateLimited) {
    return (
      <div className="mx-auto max-w-2xl ds-card p-8">
        <p className="text-sm text-content">{SHARE_RATE_LIMIT_MESSAGE}</p>
      </div>
    );
  }

  const limiter = getShareTokenRateLimiter();
  const prisma = getPrisma();
  const shared = await readSharedLyrics(prisma, code);
  if (!shared) {
    limiter.recordFailure(ip, Date.now());
    notFound();
  }

  return (
    <article className="mx-auto max-w-2xl ds-card p-8">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-content">{shared.title}</h1>
      </header>
      <div className="mt-8 space-y-10">
        {shared.items.map((item, index) => (
          <section key={`${item.title}-${index}`} className="border-b border-border pb-8 last:border-0">
            <h2 className="text-lg font-semibold text-content">{item.title}</h2>
            {"unavailable" in item && item.unavailable ? (
              <p className="mt-2 text-sm text-content-muted">Música indisponível</p>
            ) : (
              <>
                {item.artist ? (
                  <p className="mt-1 text-sm text-content-muted">{item.artist}</p>
                ) : null}
                {item.imported ? (
                  <div className="mt-3">
                    <ImportedBadge originUrl={item.imported.originUrl} />
                  </div>
                ) : null}
                <div className="mt-4 space-y-6 font-[family-name:var(--font-lyrics)] text-base leading-relaxed">
                  {item.sections.map((section) => (
                    <div key={section.label || "section"}>
                      {section.label ? (
                        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-muted">
                          {section.label}
                        </h3>
                      ) : null}
                      {section.lines.map((line, lineIndex) => (
                        <p key={`${section.label}-${lineIndex}`}>{line}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
