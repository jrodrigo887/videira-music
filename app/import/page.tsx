import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ImportPageUnlock } from "@/components/import/import-page-unlock";
import { ImportPageClient } from "@/components/import/import-page-client";
import { canImportFromCookieHeader } from "@/lib/import-access/import-access-policy";
import { isImportModuleConfigured } from "@/lib/import-access/import-module-config";
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  if (!isImportModuleConfigured()) {
    notFound();
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  const access = canImportFromCookieHeader(cookieHeader || undefined);

  if (access !== "allowed") {
    return (
      <div className="space-y-8">
        <section>
          <p className="ds-eyebrow mb-3">Importar cifra</p>
          <h1 className="text-3xl font-bold tracking-tight text-content sm:text-4xl">
            Adicione uma cifra ao repertório
          </h1>
          <p className="mt-3 max-w-2xl text-content-muted">
            Cole o texto, revise o tom e as seções e confirme a música antes de salvar.
          </p>
        </section>
        <ImportPageUnlock />
      </div>
    );
  }

  return <ImportPageClient />;
}
