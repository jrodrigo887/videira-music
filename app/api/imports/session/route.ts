import { importAccessError } from "@/lib/import-access/import-access-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  return importAccessError(404, "NOT_FOUND", "Recurso não encontrado.");
}

export async function DELETE(): Promise<Response> {
  return importAccessError(404, "NOT_FOUND", "Recurso não encontrado.");
}
