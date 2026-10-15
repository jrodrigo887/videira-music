import { notFound } from "next/navigation";

import { ImportPageClient } from "@/components/import/import-page-client";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { can } from "@/lib/auth/permissions";
import { isImportModuleFlagOn } from "@/lib/import-access/import-module-config";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  if (!isImportModuleFlagOn()) {
    notFound();
  }

  const actor = await getCurrentActor();
  if (actor.kind !== "user") {
    notFound();
  }

  if (!can(actor, "import", { organizationId: actor.organizationId })) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-content">Importar cifra</h1>
        <p className="text-sm text-content-muted">Sem permissão para importar.</p>
      </div>
    );
  }

  return <ImportPageClient />;
}
