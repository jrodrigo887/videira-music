import { notFound, redirect } from "next/navigation";

import { NoAccess } from "@/components/auth/no-access";
import { ImportPageClient } from "@/components/import/import-page-client";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { can } from "@/lib/auth/permissions";
import {
  isCifraClubUrlImportEnabled,
  isImportModuleFlagOn,
} from "@/lib/import-access/import-module-config";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  if (!isImportModuleFlagOn()) {
    notFound();
  }

  const actor = await getCurrentActor();
  if (actor.kind !== "user") {
    redirect("/entrar?next=%2Fimport");
  }

  if (!can(actor, "import", { organizationId: actor.organizationId })) {
    return <NoAccess />;
  }

  return <ImportPageClient urlImportEnabled={isCifraClubUrlImportEnabled()} />;
}
