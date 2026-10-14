# Persistência no servidor (SQLite) - Contexto

**Gathered:** 2026-10-14  
**Spec:** `.specs/features/server-persistence/spec.md`  
**Status:** Design + tasks em draft (2026-10-14); aguardando aprovação antes de Execute

## Feature Boundary

Esta feature troca a fonte da verdade de músicas e cifras do IndexedDB para um SQLite no servidor, mantendo o contrato `MusicRepository`. Entrega `PrismaMusicRepository` (server-only), route handlers, `HttpMusicRepository` (cliente), esquema multi-tenant portátil, seed de `data/musicas.json`, migração única e idempotente do IndexedDB e uma suíte de contrato compartilhada. Não inclui Postgres/Supabase, RLS, autenticação, offline/sincronização, setlists, busca FTS nem o controle de acesso ao import (feature `import-access`).

## Implementation Decisions

### Fonte da verdade (decidido pelo usuário)

- O SQLite no servidor passa a ser a fonte única da verdade agora.
- O esquema nasce pensado para migrar depois ao Postgres no Supabase.
- O IndexedDB é lido uma única vez, só para migrar os dados locais existentes, de forma idempotente.
- Offline e sincronização ficam fora desta entrega.

### Multi-tenant (decidido pelo usuário)

- O objetivo do produto é compartilhar cifras entre igrejas, chegando a milhares; hoje existe uma igreja.
- O esquema tem `organizationId` desde o primeiro dia, com uma organização padrão criada pelo seed.

### Contrato e adaptadores (definido pelo plano aprovado)

- `MusicRepository` (`listSongs`, `findSongById`, `saveSong`, `listChartsBySong`, `findChartByOriginUrl`, `saveChart`, `saveSongAndChart`) continua sendo a fronteira, sem mudança de assinatura.
- `HttpMusicRepository` substitui o `new IndexedDbMusicRepository()` em `components/songs/song-library.tsx`, `components/import/import-workflow.tsx` e `app/songs/[songId]/song-detail.tsx`.
- `IndexedDbMusicRepository` sobrevive só como leitor da migração.
- As regras do adaptador atual se mantêm: `originUrl` canônica sem `#` e `saveSongAndChart` atômico com rollback.
- A fila de escrita serializada de `lib/import/save-imported-chart.ts` continua no cliente; o servidor garante atomicidade por transação.

### Confirmado pelo usuário na revisão (2026-10-14)

- Manter os IDs existentes (`"1"`…`"63"`, `song-local-*`, `chart-local-*`) é **temporário**: os IDs numéricos do seed serão removidos quando houver músicas importadas suficientes, numa feature futura.
- Migração automática na primeira carga da biblioteca.
- Ordem de deploy: `import-access` precisa ser entregue antes de qualquer deploy público; até lá as rotas de escrita ficam abertas.

### Agent's Discretion

Defaults técnicos escolhidos pelo agente, registrados como Assumptions na spec com `Confirmed? = não, default técnico`:

- **ORM:** Prisma, um único `schema.prisma`, troca de provider no futuro. O suporte a `Json` no SQLite (Prisma ≥ 6.2) e a eventual exigência de driver adapter na versão atual do Prisma ficam **a verificar no Design**.
- **IDs:** UUID v7 gerados na aplicação antes da escrita; IDs existentes (`"1"`…`"63"`, `song-local-*`, `chart-local-*`) preservados por enquanto (confirmado como temporário).
- **Seed:** `data/musicas.json` na organização `default`, com o mapeamento de `lib/data/songs.ts`; não sobrescreve registros existentes.
- **Setlists:** fora do escopo.
- **Testes de contrato:** uma suíte rodando contra InMemory, Prisma (SQLite temporário) e Http.
- **Deploy:** container/VPS com volume persistente ou Turso; FS efêmero de serverless não é suportado.
- **Regras de portabilidade:**
  - IDs em `TEXT`.
  - `sections`, `alternateKeys` e `origin` como `Json`.
  - Datas em UTC.
  - Enums validados na aplicação, sem enum de banco.
  - Coluna `searchText` normalizada e escrita pela aplicação.
  - `schemaVersion` e `source` (texto original) na cifra.
  - `foreign_keys = ON` e WAL no SQLite.
  - Sem FTS5 nem `json_extract` em consultas de domínio.
- Caminhos das rotas, códigos de erro, limites de corpo (2 MiB / 8 MiB), timeout do cliente (15 s) e faixas de `tempo`/`capo`.
- Marcador da migração no `localStorage`, IndexedDB mantido intacto.

### Declined / Undiscussed Gray Areas → Assumptions

Não houve rodada de discussão além das decisões acima; cada ponto abaixo está na tabela de Assumptions da spec:

- Resolução da organização sempre no servidor, ignorando o cliente.
- Música com mesmo `id` na migração: o servidor vence.
- Cifras locais com a mesma `originUrl`: a primeira por `id` é migrada, as demais são contadas como já existentes.
- Escritas concorrentes no mesmo `id`: última confirmada vence, sem lock otimista.
- Falha de leitura no detalhe: erro com "Tentar novamente", sem fallback para o JSON empacotado.

## Specific References

- Contrato: `lib/persistence/music-repository.ts`.
- Adaptador atual e canonicalização: `lib/persistence/music-database.ts`.
- Mapeamento do seed: `lib/data/songs.ts`.
- Normalização de texto: `normalized()` em `components/import/import-workflow.tsx`.
- Domínio e formatos: `docs/domain.md`, `docs/chart-formats.md`, `types/music.ts`.
- Envelope de erro: `{ error: { code, message } }`, igual a `app/api/imports/cifraclub/route.ts`.
- Lição candidata L-004: toda borda de concorrência ganha teste com operações em sequência que confere que todos os registros sobrevivem.
- Limite de entrada de 500 KiB e regra de logs sem letra: `.specs/features/chart-import/spec.md`.

## Deferred Ideas

- Migração para Postgres no Supabase e RLS por `organizationId`.
- Autenticação e vínculo de usuários a organizações.
- Busca no servidor via `searchText` e paginação de `listSongs`.
- Cache offline / PWA e sincronização.
- Persistência de setlists.
- Exclusão de músicas e cifras.
- Aposentadoria do seed: remover ou substituir os IDs numéricos `"1"`…`"63"` depois que houver músicas importadas suficientes (não faz parte desta feature).
