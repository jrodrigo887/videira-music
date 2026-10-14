# Importação e persistência de cifras - Design

**Spec:** `.specs/features/chart-import/spec.md`  
**Context:** `.specs/features/chart-import/context.md`  
**Status:** Approved

## Architecture Overview

O fluxo usa três fronteiras. O parser continua puro. A persistência local fica atrás de repositórios assíncronos baseados em IndexedDB. O Cifra Club fica em um adaptador server-only chamado por Route Handler Node.js. A UI mantém o `ImportDraft` em memória, confirma as decisões e chama um caso de uso único de salvamento.

Abordagens consideradas:

1. **IndexedDB + repositórios, escolhida:** suporta cifras maiores, API assíncrona e evolução sem limite reduzido do `localStorage`.
2. **`localStorage` + repositórios:** implementação menor, mas o limite típico por origem é inadequado para várias cifras de até 500 KiB.
3. **Arquivos no servidor local:** facilitaria Server Components, mas prenderia o MVP à máquina que executa o Next e contrariaria a persistência no navegador.

```mermaid
flowchart LR
  importPage["Página de importação"] --> workflow["ImportWorkflow"]
  workflow -->|"texto"| preview["previewImport"]
  workflow -->|"URL"| route["POST /api/imports/cifraclub"]
  route --> queue["Fila global 10s"]
  queue --> adapter["CifraClubSource"]
  adapter --> browser["Playwright headed"]
  adapter --> raw["RawChart"]
  raw --> preview
  preview --> review["Revisão humana"]
  review --> save["saveImportedChart"]
  save --> songRepo["SongRepository"]
  save --> chartRepo["ChartRepository"]
  songRepo --> idb["IndexedDB"]
  chartRepo --> idb
  idb --> library["Biblioteca e detalhe"]
```

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `previewImport` | `lib/import/preview-import.ts` | Receber `RawChartMeta` e `chordTokens` sem adicionar I/O. |
| `classifyLines` | `lib/import/classify-lines.ts` | Usar os acordes marcados pelo HTML como sinal principal. |
| `detectKey` | `lib/import/detect-key.ts` | Comparar metadados da página aos acordes e emitir `KEY_MISMATCH`. |
| `ChordChartPreview` | `components/chord-chart/chord-chart-preview.tsx` | Renderizar draft e cifra salva com transposição. |
| Catálogo seed | `lib/data/songs.ts` | Continuar como fonte somente leitura e combiná-lo com músicas locais. |
| Design system | `app/globals.css` | Reutilizar `.ds-card`, `.ds-button*`, `.ds-input` e tokens semânticos. |
| Spike | `scripts/spike-cifraclub.mjs` | Reaproveitar somente seletores e evidências; não importar o script em produção. |

### Integration Points

| System | Integration Method |
| --- | --- |
| IndexedDB | Database `videira-music`, versão explícita, stores `songs` e `charts`. |
| Cifra Club | Playwright Chromium headed, uma página por ação, hosts em allowlist. |
| Next App Router | Página server fornece a flag à UI; Route Handler usa runtime Node.js. |
| Catálogo | Seed recebido do servidor e mesclado no cliente com registros locais. |

## Components

### Preview Import Contract

- **Purpose:** Transformar texto colado ou `RawChart` no mesmo `ImportDraft`.
- **Location:** `lib/import/preview-import.ts`
- **Interface:** `previewImport({ text, origin, hints, meta, chordTokens }): ImportDraft`
- **Dependencies:** normalizador, classificador, montador e detector de tom.
- **Reuses:** pipeline puro existente.

### Local Music Database

- **Purpose:** Persistir e consultar músicas e cifras sem expor IndexedDB à UI.
- **Location:** `lib/persistence/music-database.ts`
- **Interfaces:**
  - `listLocalSongs(): Promise<Song[]>`
  - `getLocalSong(id): Promise<Song | undefined>`
  - `saveLocalSong(song): Promise<void>`
  - `listChartsBySong(songId): Promise<ChordChart[]>`
  - `findChartByOriginUrl(url): Promise<ChordChart | undefined>`
  - `saveChart(chart): Promise<void>`
- **Dependencies:** IndexedDB nativo; adaptador em memória nos testes.
- **Reuses:** tipos canônicos de `types/music.ts`.

### Save Imported Chart

- **Purpose:** Validar a transição de draft revisado para música/cifra persistidas.
- **Location:** `lib/import/save-imported-chart.ts`
- **Interface:** `saveImportedChart(input, repositories): Promise<{ song; chart }>`
- **Dependencies:** contratos de repositório, gerador de ID e confirmação de tom.
- **Reuses:** `ImportDraft`, `Song` e `ChordChart`.

### Import Workflow

- **Purpose:** Orquestrar entrada, revisão, vínculo e salvamento.
- **Location:** `components/import/import-workflow.tsx`
- **States:** `input → review → link → saving → saved`; falhas retornam à etapa acionável.
- **Dependencies:** `previewImport`, API Cifra Club, catálogo combinado e caso de uso de salvamento.
- **Reuses:** `ChordChartPreview` e classes do design system.

### Local Catalog Bridge

- **Purpose:** Mesclar seed e músicas locais e carregar cifras no cliente.
- **Location:** `components/songs/local-music-catalog.tsx`
- **Interfaces:** recebe seed serializável; consulta repositórios após hidratação.
- **Dependencies:** Local Music Database.
- **Reuses:** `SongLibrary` e detalhe visual existentes.

### Cifra Club HTML Extractor

- **Purpose:** Converter HTML sintético/real em `RawChart` sem Playwright.
- **Location:** `lib/import/sources/cifraclub-parse.ts`
- **Interfaces:**
  - `canHandleCifraClubUrl(url): boolean`
  - `extractCifraClubRawChart(html, url, fetchedAt): RawChart`
- **Dependencies:** parser HTML server-side.
- **Reuses:** `parseKey` e `parseCapo`.

### Cifra Club Source

- **Purpose:** Fazer I/O controlado com navegador, fila, cache e teardown.
- **Location:** `lib/import/sources/cifraclub.ts`
- **Interface:** `fetchCifraClubChart(url): Promise<RawChart>`
- **Dependencies:** `server-only`, Playwright, filesystem local e extrator puro.
- **Reuses:** seletores confirmados no spike.

### Cifra Club Route

- **Purpose:** Validar requisição, aplicar feature flag, chamar fonte e mapear erros HTTP.
- **Location:** `app/api/imports/cifraclub/route.ts`
- **Interface:** `POST { url } → ImportDraft | { error: { code, message } }`
- **Dependencies:** source server-only e `previewImport`.

## Data Models

### Repository Contracts

```typescript
type SongRepository = {
  list(): Promise<Song[]>;
  findById(id: SongId): Promise<Song | undefined>;
  save(song: Song): Promise<void>;
};

type ChartRepository = {
  listBySong(songId: SongId): Promise<ChordChart[]>;
  findByOriginUrl(url: string): Promise<ChordChart | undefined>;
  save(chart: ChordChart): Promise<void>;
};
```

### Preview Input Extension

```typescript
type PreviewImportInput = {
  text: string;
  origin?: ImportOrigin;
  hints?: { key?: string; title?: string; artist?: string };
  meta?: RawChartMeta;
  chordTokens?: string[];
};
```

### Import Error

```typescript
type ImportSourceError = {
  code: ImportErrorCode;
  message: string;
  cause?: unknown;
};
```

`ImportErrorCode` permanece limitado a `UNSUPPORTED_SOURCE`, `SOURCE_BLOCKED`, `SOURCE_LAYOUT_CHANGED` e `SOURCE_TIMEOUT`. A fila evita introduzir um erro de rate limit.

## Storage Design

- Database: `videira-music`.
- Version: `1`.
- Store `songs`: key path `id`.
- Store `charts`: key path `id`, índices `songId` e `originUrl`.
- `originUrl` é materializado no registro persistido para consulta indexada, mas removido ao converter para `ChordChart`.
- IDs locais usam prefixos `song-local-` e `chart-local-` com `crypto.randomUUID()`.
- Upgrades futuros serão centralizados em `music-database.ts`.
- Cada transação grava uma música opcional e sua cifra atomicamente.

## Cifra Club Runtime

- `runtime = "nodejs"` e rota dinâmica.
- `headless: false`; sem flags stealth.
- Singleton de browser com recuperação após desconexão.
- Timeout padrão de 30 segundos.
- Fechamento após 60 segundos sem uso.
- Fila FIFO em memória; o início de duas navegações fica separado por pelo menos 10 segundos.
- Cache em `.cache/cifraclub/` por hash SHA-256 da URL canônica.
- Cache corrompido é removido e tratado como miss.
- Redirect final é validado novamente antes de extrair conteúdo.
- O cache nunca é commitado e os testes usam HTML inventado.

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| Texto vazio ou acima do limite | Validação antes do parser | Permanece na entrada com mensagem específica. |
| Tom não confirmado | Guarda de transição | Salvar permanece desabilitado. |
| Storage indisponível/quota | Transação rejeitada | Draft permanece aberto; nenhum sucesso é exibido. |
| URL inválida | `422 UNSUPPORTED_SOURCE` | Campo URL mostra erro e mantém conteúdo. |
| Akamai/captcha/redirect externo | `502 SOURCE_BLOCKED` | Workflow oferece colar texto. |
| DOM alterado | `502 SOURCE_LAYOUT_CHANGED` | Workflow oferece colar texto. |
| Timeout | `504 SOURCE_TIMEOUT` | Workflow permite tentar novamente ou colar. |
| Flag desligada | `404` | Campo URL não aparece e rota não revela capacidade. |

## Security and Privacy

- A rota aceita apenas `https:` nos hosts exatos permitidos.
- URL final após redirects é revalidada.
- Nenhum conteúdo musical bruto entra em logs.
- A flag não usa prefixo `NEXT_PUBLIC_`; a página recebe somente um booleano.
- A origem é atribuída no detalhe da cifra.
- Cifras importadas ficam no navegador e nunca alteram `data/musicas.json`.

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| Detalhe atual chama `notFound()` para IDs fora do seed | `app/songs/[songId]/page.tsx:20` | Música local não abre | Renderizar um shell cliente capaz de resolver seed ou IndexedDB. |
| Catálogo atual é um array somente leitura | `lib/data/songs.ts:49` | Busca ignora músicas locais | Mesclar fontes no bridge cliente sem alterar o seed. |
| Preview exige `id` e `songId` | `components/chord-chart/chord-chart-preview.tsx:8` | Draft não pode ser passado diretamente | Aceitar um tipo de chart visualizável ou materializar IDs temporários no workflow. |
| `previewImport` ignora meta e chord tokens | `lib/import/preview-import.ts:88` | URL perde sinal do HTML e warning de tom | Estender o contrato mantendo o parser puro. |
| Não há testes de UI ou ambiente DOM | `vitest.config.ts:7` | Transições do workflow ficariam sem prova | Adicionar jsdom e Testing Library, mantendo testes co-localizados. |
| Playwright headed não funciona em CI/deploy sem display | `package.json:16` | Teste live e deploy falham | Flag desligada por padrão; CI testa extrator e rota com fonte injetada. |
| Working tree contém mudanças anteriores | `.gitignore`, `package.json` e spike | Commits podem misturar autoria | Preservar diffs e incluir cada arquivo somente na tarefa relacionada. |

## Tech Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Persistência local | IndexedDB | Armazena várias cifras sem o limite reduzido do `localStorage`. |
| Leitura de dados locais | Bridge cliente | Server Components não acessam storage do navegador. |
| Parser HTML | Extrator puro com fixture sintética | Testa DOM sem navegador ou rede no CI. |
| Rate limit | Fila FIFO | Cumpre a decisão de aguardar em vez de responder `429`. |
| Cache | Arquivo por hash da URL | Evita nomes inseguros e mantém depuração local. |
| Duplicidade | Índice por `origin.url` | Abre a cifra existente antes de acessar a rota. |
