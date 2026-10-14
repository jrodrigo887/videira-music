import { ImportWorkflow } from "@/components/import/import-workflow";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  const urlImportEnabled = process.env.VIDEIRA_ENABLE_CIFRACLUB_IMPORT === "true";

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

      <ImportWorkflow urlImportEnabled={urlImportEnabled} />
    </div>
  );
}
