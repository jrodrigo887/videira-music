import { SongLibrary } from "@/components/songs/song-library";
import { listSongs } from "@/lib/data/songs";

export default function SongsPage() {
  const songs = listSongs();

  return (
    <div className="space-y-8">
      <section>
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-leaf-700">
          Biblioteca
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Musicas do repertorio
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Busque pelo catalogo inicial e abra uma musica para ver metadados e previews
          transponiveis de cifra.
        </p>
      </section>

      <SongLibrary initialSongs={songs} />
    </div>
  );
}
