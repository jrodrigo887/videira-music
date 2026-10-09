import Link from "next/link";

export default function SetlistsPage() {
  return (
    <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-leaf-700">Setlists</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        Organizacao de repertorios vem na proxima iteracao.
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-slate-600">
        A base atual ja carrega o catalogo, abre detalhes e renderiza cifras transponiveis. O
        proximo passo e persistir setlists locais com ordenacao e modo leitura sequencial.
      </p>
      <Link
        href="/songs"
        className="mt-6 inline-flex rounded-full bg-leaf-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-leaf-900"
      >
        Escolher musicas
      </Link>
    </section>
  );
}
