import { describe, expect, it } from "vitest";

import {
  canHandleCifraClubUrl,
  extractCifraClubRawChart,
  ImportSourceError,
} from "./cifraclub-parse";

const URL = "https://www.cifraclub.com.br/artista/cancao/";
const FETCHED_AT = "2026-10-09T18:00:00.000Z";

const SYNTHETIC_HTML = `
  <html>
    <head>
      <script type="application/ld+json">
        {"@type":"MusicComposition","name":"Canção JSON","composer":[{"name":"Compositor Um"}]}
      </script>
      <script type="application/ld+json">
        {"@type":"MusicRecording","byArtist":{"name":"Artista JSON"}}
      </script>
      <script type="application/ld+json">
        {"@type":"BreadcrumbList","itemListElement":[
          {"position":1,"name":"Início"},
          {"position":2,"name":"Gospel/Religioso"}
        ]}
      </script>
    </head>
    <body>
      <h1>Título fallback</h1><a><h2>Artista fallback</h2></a>
      <div data-chord-config>Tom: D
Capotraste: 2ª casa</div>
      <img src="https://i.ytimg.com/vi/AbCdEf12345/hqdefault.jpg">
      <pre data-chord-content>[Verso]
<b data-chord-name="D">D</b>   <b data-chord-name="A/C#">A/C#</b>
Letra totalmente inventada</pre>
    </body>
  </html>
`;

describe("canHandleCifraClubUrl", () => {
  it.each([
    "https://cifraclub.com.br/artista/cancao/",
    "https://www.cifraclub.com.br/artista/cancao/",
  ])("accepts the supported HTTPS host %s", (url) => {
    expect(canHandleCifraClubUrl(url)).toBe(true);
  });

  it.each([
    "http://www.cifraclub.com.br/artista/cancao/",
    "https://m.cifraclub.com.br/artista/cancao/",
    "https://example.com/artista/cancao/",
    "not-a-url",
  ])("rejects unsupported URL %s", (url) => {
    expect(canHandleCifraClubUrl(url)).toBe(false);
  });
});

describe("extractCifraClubRawChart", () => {
  it("extracts ordered text, marked chords and metadata with JSON-LD precedence", () => {
    const rawChart = extractCifraClubRawChart(SYNTHETIC_HTML, URL, FETCHED_AT);

    expect(rawChart.text).toBe("[Verso]\nD   A/C#\nLetra totalmente inventada");
    expect(rawChart.chordTokens).toEqual(["D", "A/C#"]);
    expect(rawChart.meta).toEqual({
      title: "Canção JSON",
      artist: "Artista JSON",
      composers: ["Compositor Um"],
      genre: "Gospel/Religioso",
      key: "D",
      keyLabel: "D",
      capo: 2,
      capoLabel: "2ª casa",
      youtubeUrl: "https://www.youtube.com/watch?v=AbCdEf12345",
    });
    expect(rawChart.origin).toEqual({
      kind: "url",
      url: URL,
      sourceName: "Cifra Club",
      fetchedAt: FETCHED_AT,
    });
  });

  it("falls back to semantic tags and permits absent optional metadata", () => {
    const rawChart = extractCifraClubRawChart(
      `<h1>Título sem JSON</h1><a><h2>Artista sem JSON</h2></a>
       <pre data-chord-content>Texto inventado</pre>`,
      URL,
      FETCHED_AT,
    );

    expect(rawChart.meta).toEqual({
      title: "Título sem JSON",
      artist: "Artista sem JSON",
    });
    expect(rawChart.chordTokens).toEqual([]);
  });

  it("raises SOURCE_LAYOUT_CHANGED when chart content is missing", () => {
    expect(() => extractCifraClubRawChart("<h1>Sem cifra</h1>", URL, FETCHED_AT)).toThrow(
      expect.objectContaining<Partial<ImportSourceError>>({ code: "SOURCE_LAYOUT_CHANGED" }),
    );
  });
});
