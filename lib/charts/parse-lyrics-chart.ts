import type { ChordChart, ChordPlacement, LyricLine, SongId } from "@/types/music";

type LyricsChartInput = {
  id: string;
  songId: SongId;
  source: string;
  fallbackTitle?: string;
};

const DIRECTIVE_PATTERN = /^\{([^:]+):\s*(.+)\}$/;
const CHORD_PATTERN = /\[([^\]]+)\]/g;

function readDirectives(source: string): Record<string, string> {
  return source.split(/\r?\n/).reduce<Record<string, string>>((directives, line) => {
    const match = line.trim().match(DIRECTIVE_PATTERN);

    if (!match) {
      return directives;
    }

    directives[match[1].trim().toLowerCase()] = match[2].trim();
    return directives;
  }, {});
}

function parseLyricLine(line: string): LyricLine | null {
  if (!line.trim() || DIRECTIVE_PATTERN.test(line.trim())) {
    return null;
  }

  const chords: ChordPlacement[] = [];
  let text = "";
  let sourceIndex = 0;

  for (const match of line.matchAll(CHORD_PATTERN)) {
    const markerStart = match.index ?? 0;
    const lyricChunk = line.slice(sourceIndex, markerStart);

    text += lyricChunk;
    chords.push({
      symbol: match[1],
      position: text.length,
    });
    sourceIndex = markerStart + match[0].length;
  }

  text += line.slice(sourceIndex);

  return {
    text,
    chords,
  };
}

export function parseLyricsChart(input: LyricsChartInput): ChordChart {
  const directives = readDirectives(input.source);
  const lines = input.source
    .split(/\r?\n/)
    .map(parseLyricLine)
    .filter((line): line is LyricLine => Boolean(line));

  return {
    id: input.id,
    songId: input.songId,
    title: directives.title ?? input.fallbackTitle,
    format: "lyrics",
    key: directives.key ?? "C",
    timeSignature: directives.timesignature ?? "4/4",
    sections: [
      {
        id: "verse-1",
        type: "verse",
        label: "Cifra com letra",
        content: { lines },
      },
    ],
    source: input.source,
  };
}
