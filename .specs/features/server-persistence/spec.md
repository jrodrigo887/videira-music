# Persistência no servidor (SQLite)

## Problem Statement

Músicas e cifras criadas pelo usuário vivem hoje só no IndexedDB de um navegador (`IndexedDbMusicRepository`), e o catálogo seed é mesclado no cliente a partir de `data/musicas.json`. Nada é compartilhado entre dispositivos ou pessoas da igreja, e o objetivo do produto é compartilhar cifras entre igrejas, chegando a milhares de registros. Esta feature move a fonte única da verdade para um SQLite no servidor, atrás do contrato `MusicRepository` que já existe, com um esquema multi-tenant pronto para migrar ao Postgres no Supabase sem reescrever o domínio.

## Goals

- [x] Toda leitura e escrita de músicas e cifras da UI passa pelo servidor; nenhum componente instancia `IndexedDbMusicRepository` fora da migração única.
- [x] O mesmo conjunto de testes de contrato passa contra `InMemoryMusicRepository`, `PrismaMusicRepository` (SQLite temporário) e `HttpMusicRepository`.
- [x] Os dados locais existentes chegam ao servidor uma única vez, sem duplicar registros quando a migração roda de novo.
- [x] O esquema segue as regras de portabilidade (PER-08), de modo que trocar o provider do Prisma para PostgreSQL não exige mudar o domínio nem as consultas.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Migração para Postgres/Supabase | Esta entrega só deixa o esquema portátil; a troca de provider é uma feature futura. |
| Row Level Security (RLS) | Depende de Postgres e de autenticação, ambos fora desta entrega. |
| Autenticação, usuários e papéis | Sem identidade de usuário nesta fase; a organização é resolvida no servidor. |
| Controle de acesso ao import | Coberto pela feature `import-access`, que aplica o gate a `PUT /api/charts/{chartId}` e `POST /api/song-charts` para cifras com `origin`; a rota de migração fica sem gate. |
| Offline, cache local e sincronização bidirecional | Decisão do usuário: o servidor é a fonte única; o IndexedDB é lido só para migrar. |
| Setlists | Não há setlists persistidos hoje; o tipo `Setlist` fica sem tabela. |
| Busca full-text (FTS5, `tsvector`) | Não é portátil entre SQLite e Postgres; a coluna `searchText` prepara a busca futura. |
| Paginação e busca no servidor | Uma única igreja com dezenas de músicas não exige; `listSongs` devolve tudo. |
| Exclusão de músicas e cifras | O contrato `MusicRepository` não tem operação de exclusão. |
| Rate limiting das rotas | Depende de identidade de cliente; os limites de corpo (PER-05) limitam o custo por requisição. |
| Apagar o IndexedDB após a migração | Os dados locais ficam como cópia de segurança, sem leitura posterior. |
| Aposentadoria do seed (remover ou substituir os IDs numéricos `"1"`…`"63"`) | Manter os IDs existentes é temporário; a remoção acontece numa feature futura, depois que houver músicas importadas suficientes. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Fonte da verdade | SQLite no servidor; IndexedDB lido uma vez para migração | Decisão do usuário; elimina dados divergentes entre navegadores. | sim |
| Offline e sincronização | Fora do escopo | Decisão do usuário. | sim |
| Multi-tenant | Coluna `organizationId` obrigatória em `Song` e `ChordChart` desde já, com uma organização seed (`slug = "default"`, nome `Videira`) | Decisão do usuário: compartilhar entre igrejas no futuro, uma igreja hoje. | sim |
| Resolução da organização | O servidor usa sempre a organização `default`; qualquer `organizationId` vindo do cliente é ignorado | Sem autenticação não há como o cliente provar a organização; evita vazamento entre tenants quando houver mais de uma. | não, default técnico |
| ORM | Prisma, com um único `schema.prisma` e troca de provider no futuro | Um schema para SQLite e Postgres; migrations versionadas. | não, default técnico |
| Tipo `Json` no SQLite | Usar `Json` do Prisma para `sections` e `alternateKeys` | Suportado no SQLite desde o Prisma 6.2; **verificar no Design** a versão atual do Prisma e se exige driver adapter para SQLite. | não, default técnico |
| Formato de ID novo | UUID v7 gerado pela aplicação antes da escrita | Ordenável no tempo, portátil como `TEXT`/`uuid`; gerar antes da escrita torna o retry idempotente (mesmo ID). | não, default técnico |
| IDs existentes | Preservados como estão: seed `"1"`…`"63"`, `song-local-<uuid>`, `chart-local-<uuid>` | URLs `/songs/[songId]` já abertas continuam funcionando; o servidor aceita qualquer ID que passe na validação de formato. Decisão temporária: os IDs numéricos do seed serão removidos quando houver músicas importadas suficientes (aposentadoria do seed, fora desta feature). | sim, temporário |
| Seed | `data/musicas.json` vira seed do banco na organização `default`, com o mapeamento atual de `lib/data/songs.ts` | Mantém o catálogo atual; o JSON deixa de ser lido pela UI. | não, default técnico |
| Seed sobre dados existentes | Cria o que falta e não sobrescreve registros já presentes | Rodar o seed de novo não pode apagar edições feitas no servidor. | não, default técnico |
| Testes de contrato | Uma suíte compartilhada roda contra InMemory, Prisma (SQLite temporário por teste) e Http (route handlers reais em processo) | É a garantia de que a troca de adaptador, e depois de banco, não muda o comportamento. | não, default técnico |
| Deploy | Container ou VPS com volume persistente para o arquivo SQLite, ou Turso (libSQL); FS efêmero de serverless não é suportado | Um arquivo SQLite em FS efêmero perde dados a cada deploy ou cold start. | não, default técnico |
| Ordem de deploy | `import-access` precisa ser entregue antes de qualquer deploy público; até lá as rotas de escrita (`PUT /api/songs/{songId}`, `PUT /api/charts/{chartId}`, `POST /api/song-charts`, `POST /api/migrations/local-data`) ficam abertas, sem gate | Esta feature não tem identidade de usuário; o gate das cifras com `origin` vem da `import-access`. Rodar só local até lá limita o risco. | sim |
| Interpretação de `schemaVersion` + `source` | `schemaVersion` inteiro (atual `1`) e `source` (texto original da cifra, já presente em `ChordChart.source`) são colunas da cifra | Permite reprocessar `sections` a partir do texto original quando o formato estruturado mudar. | não, default técnico |
| Normalização de `searchText` | `title`, `artist`, `defaultKey` e `meta` unidos por espaço, em NFKD, sem marcas diacríticas, em minúsculas `pt-BR` | Mesma regra de `normalized()` em `import-workflow.tsx`; idêntica no SQLite e no Postgres porque é feita na aplicação. | não, default técnico |
| Gatilho da migração | Automática na primeira carga da biblioteca em um navegador sem o marcador de migração concluída | O usuário não precisa descobrir uma ação; a idempotência torna seguro repetir. | sim |
| Conflito de música com mesmo ID | Manter a versão do servidor e contar como "já existia" | O servidor é a fonte da verdade; a migração nunca sobrescreve. | não, default técnico |
| Duas cifras locais com a mesma `originUrl` canônica | Migrar a primeira (ordem de `id`) e contar as demais como "já existia" | O índice local não era único; o servidor exige unicidade por organização. | não, default técnico |
| Escrita concorrente no mesmo ID | Última escrita confirmada vence, sem lock otimista | Uma igreja e poucos editores; lock otimista exige versão no contrato. | não, default técnico |
| Limite de corpo das escritas | 2 MiB por requisição de escrita comum; 8 MiB por lote de migração | O texto de entrada já é limitado a 500 KiB e a cifra carrega `source` + `sections`, que podem passar de 1 MiB. | não, default técnico |
| Faixas numéricas | `tempo` inteiro de 1 a 400; `capo` inteiro de 0 a 24 | Limites de sanidade que rejeitam lixo sem restringir uso real. | não, default técnico |
| Timeout do cliente HTTP | 15 segundos por requisição | Evita UI presa indefinidamente; o SQLite responde em milissegundos em uso normal. | não, default técnico |
| Falha de leitura no detalhe | Exibir erro com "Tentar novamente", sem cair para o JSON empacotado | Com fonte única, mostrar o seed local mascararia dados do servidor. | não, default técnico |
| Observabilidade | Logs sem letra, `source`, `sections`, `rawText` ou corpo de requisição | Regra já aceita em chart-import. | sim |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Ler e gravar pelo servidor ⭐ MVP

**User Story**: Como músico, quero que as músicas e cifras que salvo fiquem no servidor para abri-las em qualquer dispositivo.

**Why P1**: É a mudança da fonte da verdade; as demais histórias dependem dela.

**Acceptance Criteria**:
1. The system SHALL expose the `MusicRepository` contract of `lib/persistence/music-repository.ts` unchanged, implemented by a server-only `PrismaMusicRepository` and a client `HttpMusicRepository`.
2. WHEN `SongLibrary`, `ImportWorkflow` ou `SongDetail` forem montados sem `repository` injetado THEN o sistema SHALL usar `HttpMusicRepository`, e nenhum desses componentes SHALL importar `IndexedDbMusicRepository`.
3. WHEN `GET /api/songs` for chamado THEN o sistema SHALL responder `200` com `{ songs: Song[] }` contendo todas as músicas da organização, seed incluído.
4. WHEN `GET /api/songs/{songId}` encontrar a música THEN o sistema SHALL responder `200` com `{ song }`.
5. IF `GET /api/songs/{songId}` não encontrar a música THEN o sistema SHALL responder `404` com `SONG_NOT_FOUND`, e `HttpMusicRepository.findSongById` SHALL devolver `undefined`.
6. WHEN `PUT /api/songs/{songId}` receber uma `Song` válida cujo `id` coincide com o caminho THEN o sistema SHALL criar ou substituir a música e responder `204`.
7. WHEN `GET /api/songs/{songId}/charts` for chamado THEN o sistema SHALL responder `200` com `{ charts: ChordChart[] }` contendo somente cifras com aquele `songId` na organização.
8. WHEN `GET /api/charts?originUrl={url}` encontrar uma cifra pela URL canônica (sem fragmento `#`) THEN o sistema SHALL responder `200` com `{ chart }`.
9. IF `GET /api/charts?originUrl={url}` não encontrar cifra THEN o sistema SHALL responder `404` com `CHART_NOT_FOUND`, e `HttpMusicRepository.findChartByOriginUrl` SHALL devolver `undefined`.
10. WHEN `PUT /api/charts/{chartId}` receber uma `ChordChart` válida THEN o sistema SHALL criar ou substituir a cifra e responder `204`.
11. WHEN `POST /api/song-charts` receber `{ song?, chart }` válido THEN o sistema SHALL gravar música e cifra numa única transação e responder `204`.
12. IF qualquer escrita de `POST /api/song-charts` falhar THEN o sistema SHALL desfazer a transação inteira, de modo que nem a música nem a cifra fiquem gravadas.
13. WHEN `SongDetail` abrir uma música com cifras gravadas no servidor THEN o sistema SHALL exibir "Cifras importadas" independentemente do prefixo do `id` da cifra.
14. WHEN `ImportWorkflow` sugerir músicas para vínculo THEN o sistema SHALL considerar todas as músicas devolvidas por `listSongs`, incluindo as criadas por usuários.
15. WHEN o usuário salvar uma cifra importada THEN o sistema SHALL navegar para `/songs/{songId}`, e a mesma cifra SHALL aparecer ao abrir essa página em outro navegador.

**Independent Test**: Salvar uma cifra colada criando uma música nova, abrir `/songs/{songId}` numa janela anônima (IndexedDB vazio) e ver a cifra.

**Nota (import-access):** os AC 10 e 11 descrevem o comportamento depois de passar pelo gate. Para cifras com `origin`, `PUT /api/charts/{chartId}` e `POST /api/song-charts` também exigem a política de `.specs/features/import-access/spec.md`, que define as respostas negadas. Cifras sem `origin` não passam por esse gate.

---

### P1: Validar entradas e falhar de forma explícita ⭐ MVP

**User Story**: Como mantenedor, quero que o servidor recuse dados inválidos com códigos concretos para que nada corrompido entre no banco compartilhado.

**Why P1**: Com o banco compartilhado, um cliente com bug não pode estragar os dados de todos.

**Acceptance Criteria**:
1. IF o corpo de uma escrita não for JSON válido THEN o sistema SHALL responder `400` com `INVALID_REQUEST` sem tocar no banco.
2. IF o corpo de uma escrita comum exceder 2 MiB em UTF-8 THEN o sistema SHALL responder `413` com `PAYLOAD_TOO_LARGE` sem tocar no banco.
3. IF uma `Song` não tiver `id` de 1 a 128 caracteres em `[A-Za-z0-9_-]`, `title` não vazio de até 200 caracteres ou `alternateKeys` como lista de strings THEN o sistema SHALL responder `422` com `VALIDATION_FAILED` e a lista `issues` de `{ path, message }`.
4. IF uma `ChordChart` tiver `format` fora de `lyrics`/`grid`, `sections[].type` fora de `SectionType`, `key` ou `timeSignature` vazio, `tempo` fora de 1–400 ou `capo` fora de 0–24 THEN o sistema SHALL responder `422` com `VALIDATION_FAILED` e a lista `issues`.
5. IF o `id` do caminho divergir do `id` do corpo em `PUT` THEN o sistema SHALL responder `422` com `VALIDATION_FAILED` e `issues[0].path = "id"`.
6. IF `PUT /api/charts/{chartId}` ou `POST /api/song-charts` referenciar um `songId` que não existe na organização e não vem no mesmo corpo THEN o sistema SHALL responder `404` com `SONG_NOT_FOUND` sem gravar a cifra.
7. IF outra cifra da organização já tiver a mesma `originUrl` canônica THEN o sistema SHALL responder `409` com `ORIGIN_URL_CONFLICT` e o `id` da cifra existente, sem gravar.
8. IF o banco estiver ocupado além do `busy_timeout` ou o arquivo estiver inacessível THEN o sistema SHALL responder `503` com `DATABASE_UNAVAILABLE` e o cabeçalho `Retry-After: 2`.
9. IF `DATABASE_URL` não estiver configurada THEN o sistema SHALL responder `503` com `DATABASE_NOT_CONFIGURED` em toda rota de persistência.
10. IF ocorrer erro inesperado no servidor THEN o sistema SHALL responder `500` com `PERSISTENCE_FAILED` e mensagem genérica, sem stack trace nem conteúdo da cifra no corpo.
11. WHEN `HttpMusicRepository` receber resposta não-2xx (exceto os `404` de busca) THEN o sistema SHALL lançar `RepositoryError` com o `code` e o `status` da resposta.
12. IF uma requisição de `HttpMusicRepository` não terminar em 15 segundos THEN o sistema SHALL abortá-la e lançar `RepositoryError` com `code = "NETWORK_TIMEOUT"`.
13. IF o salvamento de uma cifra importada falhar por qualquer `RepositoryError` THEN o sistema SHALL manter o draft em memória, não navegar e informar que nada foi salvo.
14. IF a leitura do detalhe falhar THEN o sistema SHALL exibir "Não foi possível carregar a música. Tente novamente." com um botão "Tentar novamente", sem exibir dados de `data/musicas.json`.

**Independent Test**: Enviar por `fetch` uma cifra com `format: "tab"`, outra com corpo de 3 MiB e outra apontando para música inexistente; conferir `422`, `413` e `404` e que o banco continua igual.

---

### P1: Esquema portátil e multi-tenant ⭐ MVP

**User Story**: Como mantenedor, quero um esquema que já separe dados por organização e evite recursos exclusivos do SQLite, para migrar ao Postgres no Supabase sem reescrever o domínio.

**Why P1**: Mudar o formato dos dados depois que várias igrejas usam o sistema custa muito mais.

**Acceptance Criteria**:
1. The system SHALL store `organizationId` as a required foreign key on every `Song` and `ChordChart` row.
2. The system SHALL scope every read and write of `PrismaMusicRepository` to the organization resolved on the server, ignoring any `organizationId` sent by the client.
3. The system SHALL store every identifier (`Organization.id`, `Song.id`, `ChordChart.id`, foreign keys) as text.
4. The system SHALL generate every new `Song.id` and `ChordChart.id` in the application as UUID v7, before the write request is sent.
5. The system SHALL store `sections`, `alternateKeys` and `origin` as Prisma `Json` columns.
6. The system SHALL store `createdAt` and `updatedAt` in UTC and serialize them as ISO-8601 with `Z`.
7. WHEN uma linha for atualizada THEN o sistema SHALL preservar `createdAt` e atualizar `updatedAt`.
8. The system SHALL validate `format`, `SectionType` and `origin.kind` values in the application, without database enums.
9. WHEN uma `Song` for gravada THEN o sistema SHALL gravar `searchText` igual a `title`, `artist`, `defaultKey` e `meta` presentes, unidos por um espaço, em NFKD, sem marcas diacríticas e em minúsculas `pt-BR`.
10. WHEN uma `ChordChart` for gravada THEN o sistema SHALL gravar `schemaVersion = 1` e o texto original de `source` quando presente.
11. The system SHALL store `originUrl` canonicalized without the `#` fragment and enforce uniqueness of `(organizationId, originUrl)` when `originUrl` is present.
12. WHEN o `PrismaMusicRepository` abrir uma conexão SQLite THEN o sistema SHALL ativar `foreign_keys = ON`, `journal_mode = WAL` e `busy_timeout = 5000`.
13. The system SHALL NOT use FTS5, `json_extract`, raw SQL specific to SQLite or database enums in domain queries.
14. WHEN um `ChordChart` for lido do banco THEN o sistema SHALL devolver o mesmo objeto de domínio que foi gravado, sem as colunas internas (`organizationId`, `searchText`, `schemaVersion`, `originUrl`, `createdAt`, `updatedAt`).

**Independent Test**: Rodar as migrations num SQLite temporário, gravar uma cifra com acentos e `origin.url` com `#fragmento`, e inspecionar a linha: IDs em texto, `searchText` sem acento, `originUrl` sem fragmento, `PRAGMA foreign_keys` igual a `1`.

---

### P1: Seed do catálogo e da organização padrão ⭐ MVP

**User Story**: Como mantenedor, quero popular um banco novo com a organização padrão e o catálogo atual para que a biblioteca não fique vazia depois do deploy.

**Why P1**: Sem o seed, a biblioteca perde as 63 músicas que hoje vêm de `data/musicas.json`.

**Acceptance Criteria**:
1. WHEN o seed rodar num banco vazio THEN o sistema SHALL criar a organização `slug = "default"` e as 63 músicas de `data/musicas.json` nela, com os IDs `"1"`…`"63"` e os campos do mapeamento atual de `lib/data/songs.ts`.
2. WHEN o seed rodar de novo THEN o sistema SHALL terminar com as mesmas contagens de organizações e músicas.
3. WHEN o seed rodar sobre uma música seed editada no servidor THEN o sistema SHALL manter a versão editada.
4. WHEN a biblioteca carregar THEN o sistema SHALL listar as músicas devolvidas pelo servidor, sem mesclar `data/musicas.json` no cliente e sem IDs repetidos.
5. WHEN uma música for pesquisada na biblioteca por título, artista ou tom THEN o sistema SHALL incluí-la nos resultados, seja do seed ou criada por usuário.
6. The system SHALL keep imported lyrics out of the seed and of all committed fixtures.

**Independent Test**: Rodar migrations + seed duas vezes num banco temporário, contar 1 organização e 63 músicas, e abrir `/songs` vendo as 63.

---

### P1: Migração única do IndexedDB ⭐ MVP

**User Story**: Como músico que já importou cifras no navegador, quero que elas passem para o servidor sem trabalho manual e sem duplicar nada.

**Why P1**: Sem migração, quem já usou o app perde as cifras salvas localmente.

**Acceptance Criteria**:
1. WHEN a biblioteca carregar num navegador sem o marcador `videira-music:indexeddb-migration = "completed"` no `localStorage` THEN o sistema SHALL ler todas as músicas e cifras do IndexedDB `videira-music` e enviá-las ao servidor.
2. WHEN `POST /api/migrations/local-data` receber um lote `{ songs, charts }` THEN o sistema SHALL criar somente os registros cujo `id` ainda não existe na organização e responder `200` com `{ songsCreated, songsSkipped, chartsCreated, chartsSkipped, failures }`.
3. WHEN um registro do lote já existir no servidor com o mesmo `id` THEN o sistema SHALL manter a versão do servidor e contá-lo em `songsSkipped` ou `chartsSkipped`.
4. WHEN uma cifra do lote tiver `originUrl` canônica já usada por outra cifra da organização THEN o sistema SHALL ignorá-la e contá-la em `chartsSkipped`.
5. IF uma cifra do lote referenciar um `songId` ausente no servidor e no lote THEN o sistema SHALL não gravá-la e incluir `{ id, code: "SONG_NOT_FOUND" }` em `failures`.
6. IF um registro do lote falhar na validação de PER-05 THEN o sistema SHALL não gravá-lo, incluir `{ id, code: "VALIDATION_FAILED" }` em `failures` e continuar com os demais.
7. WHEN a mesma migração for enviada duas vezes THEN o sistema SHALL terminar com as mesmas contagens de músicas e cifras no servidor e responder com `songsCreated = 0` e `chartsCreated = 0` na segunda vez.
8. The system SHALL send migration data in batches of at most 8 MiB, grouping each song with its charts in the same batch.
9. WHEN todos os lotes terminarem com `failures` vazio THEN o sistema SHALL gravar o marcador `completed` e exibir "Migração concluída: X músicas e Y cifras enviadas ao servidor; Z já existiam."
10. IF algum lote falhar ou devolver `failures` não vazio THEN o sistema SHALL não gravar o marcador, exibir "Parte dos dados locais não foi migrada. Tentaremos de novo na próxima abertura." e manter a biblioteca utilizável com os dados do servidor.
11. WHEN o IndexedDB não existir ou estiver vazio THEN o sistema SHALL gravar o marcador `completed` sem chamar o servidor e sem exibir mensagem.
12. WHILE o marcador `completed` estiver presente o sistema SHALL não abrir o IndexedDB.
13. The system SHALL keep the IndexedDB data untouched after migration.

**Nota (import-access):** `POST /api/migrations/local-data` fica fora do gate de import, mesmo para cifras com `origin`, porque só move ao servidor dados que já existiam no navegador.

**Independent Test**: Popular um IndexedDB (fake-indexeddb) com 2 músicas locais e 3 cifras, uma delas ligada a uma música seed; carregar a biblioteca duas vezes e conferir no servidor 2 músicas e 3 cifras novas, com a segunda carga sem requisição de migração.

---

### P1: Suíte de contrato compartilhada ⭐ MVP

**User Story**: Como mantenedor, quero uma única suíte de testes do contrato rodando contra todos os adaptadores para trocar de banco sem regressão.

**Why P1**: É o que torna a migração futura para o Postgres verificável em vez de manual.

**Acceptance Criteria**:
1. The system SHALL define one contract test suite for `MusicRepository` executed unchanged against `InMemoryMusicRepository`, `PrismaMusicRepository` on a temporary SQLite file and `HttpMusicRepository` backed by the real route handlers.
2. The contract suite SHALL assert, for every adapter, round-trip equality of `Song` and `ChordChart`, `undefined` for missing IDs and URLs, filtering by `songId`, canonical `originUrl` lookup ignoring `#`, upsert by `id` and atomic rollback of `saveSongAndChart`.
3. WHEN a suíte rodar contra `PrismaMusicRepository` THEN o sistema SHALL criar um arquivo SQLite novo por teste e removê-lo ao final.
4. The `InMemoryMusicRepository` SHALL canonicalize `originUrl` without the `#` fragment in `findChartByOriginUrl`, matching the other adapters (hoje compara a URL exata).

**Independent Test**: Rodar só a suíte de contrato e ver os mesmos casos passando três vezes, um por adaptador.

---

### P2: Concorrência e escritas em sequência

**User Story**: Como músico, quero que salvamentos rápidos em sequência, meus ou de outra pessoa, sejam todos preservados.

**Why P2**: Com um servidor compartilhado, escritas simultâneas deixam de ser só de uma aba (lição L-004).

**Acceptance Criteria**:
1. WHEN duas chamadas `saveSongAndChart` com IDs distintos forem feitas uma após a outra, sem aguardar a primeira THEN o sistema SHALL tornar as duas músicas e as duas cifras visíveis em `listSongs` e `listChartsBySong`.
2. WHEN dois clientes distintos gravarem cifras diferentes ao mesmo tempo THEN o sistema SHALL preservar as duas.
3. WHEN duas escritas concorrentes usarem a mesma `originUrl` canônica com IDs diferentes THEN o sistema SHALL gravar exatamente uma e responder `409` com `ORIGIN_URL_CONFLICT` à outra.
4. WHEN duas escritas usarem o mesmo `id` THEN o sistema SHALL manter a última escrita confirmada pelo banco.

**Independent Test**: Disparar `Promise.all` com 10 `saveSongAndChart` distintos contra o adaptador Http e contar 10 músicas e 10 cifras.

---

### P2: Observabilidade sem conteúdo musical

**User Story**: Como mantenedor, quero logs que expliquem falhas de persistência sem expor letras.

**Why P2**: Diagnóstico em produção sem violar os guardrails de conteúdo.

**Acceptance Criteria**:
1. IF uma rota de persistência responder com status `4xx` ou `5xx` THEN o sistema SHALL registrar uma linha com `route`, `method`, `status`, `code` e `durationMs`.
2. The system SHALL NOT write `source`, `sections`, `rawText`, lyric text or request bodies to logs.
3. WHEN uma migração terminar THEN o sistema SHALL registrar apenas as contagens e os `id`s com falha.

**Independent Test**: Provocar `422` e `500` com uma cifra contendo a frase sentinela "LETRA-SENTINELA" e verificar que ela não aparece nos logs capturados.

---

### P3: Operação e deploy

**User Story**: Como mantenedor, quero instruções e verificações de ambiente que impeçam rodar o banco num disco que se perde.

**Why P3**: Evita perda silenciosa de dados no deploy, mas não bloqueia o uso local.

**Acceptance Criteria**:
1. The system SHALL read the database location exclusively from `DATABASE_URL`.
2. The system SHALL provide scripts to apply migrations and to run the seed, documented in `docs/` with the requirement of a persistent volume or Turso.
3. WHERE o deploy usar FS efêmero de serverless THEN o sistema SHALL ser documentado como não suportado.

**Independent Test**: Seguir a documentação num diretório novo: aplicar migrations, rodar o seed, iniciar o app e ver as 63 músicas.

---

## Edge Cases

- IF `origin.url` não for uma URL absoluta válida THEN o sistema SHALL responder `422` com `VALIDATION_FAILED` e `issues[0].path = "origin.url"`.
- IF `GET /api/charts` vier sem `originUrl` THEN o sistema SHALL responder `400` com `INVALID_REQUEST`.
- IF uma cifra local na migração tiver `originUrl` com fragmento `#` THEN o sistema SHALL compará-la pela forma canônica.
- WHEN `saveSongAndChart` receber `song` ausente THEN o sistema SHALL exigir que `chart.songId` já exista na organização.
- WHEN `listChartsBySong` for chamado para uma música sem cifras THEN o sistema SHALL devolver lista vazia, e o detalhe SHALL continuar mostrando as cifras de exemplo.
- IF duas abas rodarem a migração ao mesmo tempo THEN o sistema SHALL terminar sem registros duplicados.
- IF o lote de migração exceder 8 MiB THEN o sistema SHALL responder `413` com `PAYLOAD_TOO_LARGE`.
- WHEN um campo opcional (`artist`, `tempo`, `capo`, `origin`, `source`) estiver ausente THEN o sistema SHALL devolvê-lo ausente na leitura, não como `null`.

---

## Implicit Requirement Dimensions

- **Input validation & bounds**: PER-05 — JSON válido, 2 MiB por escrita, 8 MiB por lote, IDs em `[A-Za-z0-9_-]{1,128}`, enums e faixas numéricas validados na aplicação; o texto de entrada continua limitado a 500 KiB pelo chart-import.
- **Failure / partial-failure states**: PER-04 e PER-06 — `saveSongAndChart` é transacional; falha mantém o draft; migração parcial não grava o marcador e é retomada (PER-13).
- **Idempotency / retry / duplicate handling**: PER-02, PER-03 e PER-12 — escritas por `id` são upsert, IDs gerados antes do envio tornam o retry seguro, seed e migração repetidos não duplicam.
- **Auth boundaries & rate limits**: N/A because esta feature não tem identidade de usuário; o único limite de fronteira é o tenant, coberto por PER-07 (organização resolvida no servidor). O gate das escritas de cifras com `origin` fica em `import-access`; rate limit está no Out of Scope.
- **Concurrency / ordering**: PER-15 — escritas em sequência e concorrentes sobrevivem (L-004), unicidade de `originUrl` resolvida pelo banco, última escrita vence no mesmo `id`.
- **Data lifecycle / expiry**: PER-08 e PER-13 — sem expiração nem exclusão; `createdAt` preservado e `updatedAt` atualizado em UTC; IndexedDB mantido intacto após a migração.
- **Observability**: PER-16 — linha por erro com rota, status, código e duração; nenhum conteúdo musical.
- **External-dependency failure**: PER-06 — banco ocupado/inacessível vira `503` com `Retry-After`, banco não configurado vira `503`, rede do cliente tem timeout de 15 s.
- **State-transition integrity**: PER-13 — a migração só passa de "pendente" para "concluída" quando todos os lotes terminam sem falhas; uma cifra só é gravada com `songId` existente (PER-06).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PER-01 | P1: Ler e gravar pelo servidor (AC 1, 2) | 4–5 | Done |
| PER-02 | P1: Ler e gravar pelo servidor (AC 3–6) | 2–3 | Done |
| PER-03 | P1: Ler e gravar pelo servidor (AC 7–10) | 2–3 | Done |
| PER-04 | P1: Ler e gravar pelo servidor (AC 11, 12) | 2–3 | Done |
| PER-05 | P1: Validar entradas e falhar de forma explícita (AC 1–7) + Edge Cases | 2–3 | Done |
| PER-06 | P1: Validar entradas e falhar de forma explícita (AC 8–14) | 2–5 | Done |
| PER-07 | P1: Esquema portátil e multi-tenant (AC 1, 2) | 1–2 | Done |
| PER-08 | P1: Esquema portátil e multi-tenant (AC 3–10, 13, 14) | 1–2 | Done |
| PER-09 | P1: Esquema portátil e multi-tenant (AC 12) | 2 | Done |
| PER-10 | P1: Esquema portátil e multi-tenant (AC 11) | 1–3 | Done |
| PER-11 | P1: Seed do catálogo e da organização padrão (AC 1–6) | 1–5 | Done |
| PER-12 | P1: Migração única do IndexedDB (AC 1–8) | 3–5 | Done |
| PER-13 | P1: Migração única do IndexedDB (AC 9–13) | 5 | Done |
| PER-14 | P1: Suíte de contrato compartilhada (AC 1–4) | 4 | Done |
| PER-15 | P2: Concorrência e escritas em sequência (AC 1–4) | 6 | Partial |
| PER-16 | P2: Observabilidade sem conteúdo musical (AC 1–3) | 2, 6 | Done |
| PER-17 | P3: Operação e deploy (AC 1–3) | 1, 6 | Done |
| PER-18 | P1: Ler e gravar pelo servidor (AC 13–15) | 5 | Done |

**Coverage:** 18 total, 18 mapped to tasks in `.specs/features/server-persistence/tasks.md`, 0 unmapped.

---

## Success Criteria

- [x] Uma cifra salva num navegador aparece em outro navegador sem IndexedDB.
- [x] A suíte de contrato passa contra InMemory, Prisma (SQLite) e Http.
- [x] Rodar seed e migração duas vezes não muda as contagens do banco.
- [x] Nenhum componente da UI importa `IndexedDbMusicRepository`, exceto o módulo de migração.
- [x] Nenhum log capturado nos testes contém a frase sentinela de letra.
- [x] Testes, lint e build passam.
