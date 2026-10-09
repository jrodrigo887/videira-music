import type { ChordChart, Song } from "@/types/music";

import { parseGridChart } from "./parse-grid-chart";
import { parseLyricsChart } from "./parse-lyrics-chart";

function lyricsSource(song: Song): string {
  return `{title: ${song.title}}
{key: ${song.defaultKey ?? "A"}}

[A]A comecar em [E/G#]mim
[F#m]Quebra coracoes, [D]Senhor
[A]Quero voltar ao [E]primeiro amor
[D]E te adorar`;
}

const gridSource = `[Intro]
| G | D/F# | Em | C |

[Verso]
| G | D/F# | Em | C |
| G/B | Am | D | D |`;

export function buildExampleCharts(song: Song): ChordChart[] {
  return [
    parseLyricsChart({
      id: `song-${song.id}-lyrics-example`,
      songId: song.id,
      fallbackTitle: `${song.title} - exemplo com letra`,
      source: lyricsSource(song),
    }),
    parseGridChart({
      id: `song-${song.id}-grid-example`,
      songId: song.id,
      key: song.defaultKey ?? "G",
      source: gridSource,
    }),
  ];
}
