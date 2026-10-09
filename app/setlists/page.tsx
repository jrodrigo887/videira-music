import Link from "next/link";

export default function SetlistsPage() {
  return (
    <section className="rounded-3xl border border-dashed border-border-strong bg-surface p-8 text-center shadow-sm shadow-black/5">
      <p className="ds-eyebrow">Setlists</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-content">
        Organizacao de repertorios vem na proxima iteracao.
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-content-muted">
        A base atual ja carrega o catalogo, abre detalhes e renderiza cifras transponiveis. O
        proximo passo e persistir setlists locais com ordenacao e modo leitura sequencial.
      </p>
      <Link
        href="/songs"
        className="ds-button mt-6"
      >
        Escolher musicas
      </Link>
    </section>
  );
}
