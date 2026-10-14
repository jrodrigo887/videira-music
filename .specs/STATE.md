# Project State

## Decisions

### AD-001: Persistência local por repositórios

- **Status:** superseded by AD-004
- **Decision:** Músicas e cifras criadas pelo usuário serão persistidas no navegador por adaptadores que implementam contratos de repositório.
- **Rationale:** O MVP precisa sobreviver a reload sem acoplar domínio e UI ao mecanismo de storage.

### AD-002: Adaptador Cifra Club no servidor Next local

- **Status:** active
- **Decision:** O Playwright rodará em um Route Handler Node.js do próprio Next, protegido por `VIDEIRA_ENABLE_CIFRACLUB_IMPORT` (renomeada para `VIDEIRA_ENABLE_IMPORT` pela AD-005).
- **Rationale:** O spike validou Chromium headed local e ainda não existe necessidade de um backend separado.

### AD-003: Conteúdo musical externo não entra em fixtures

- **Status:** active
- **Decision:** Testes de importação usarão HTML e letras sintéticas; cifras importadas não serão gravadas no seed nem versionadas.
- **Rationale:** Preserva os guardrails de direito autoral e não redistribuição.

### AD-004: SQLite via Prisma como fonte da verdade no servidor

- **Status:** active
- **Decision:** Músicas e cifras passam a ser persistidas num SQLite no servidor, via Prisma, atrás do contrato `MusicRepository`, com esquema multi-tenant (`organizationId`) e regras de portabilidade para migrar depois ao Postgres no Supabase; o IndexedDB é lido uma única vez para migração. Substitui a AD-001.
- **Rationale:** O produto precisa compartilhar cifras entre dispositivos e, depois, entre igrejas; o SQLite começa sem infraestrutura extra e o Prisma permite trocar o provider sem reescrever o domínio.
- **Trade-off:** Perde o uso offline e exige deploy com disco persistente (container/VPS ou Turso); serverless com FS efêmero deixa de ser opção.
- **Scope:** `server-persistence` e toda feature que leia ou grave músicas, cifras ou futuros setlists.
- **Date:** 2026-10-14

### AD-005: Import liberado por flag de ambiente e segredo de admin

- **Status:** active
- **Decision:** Até existir autenticação, o módulo de import (página `/import`, preview por URL e salvamento de cifras importadas) exige `VIDEIRA_ENABLE_IMPORT=true` **e** uma sessão de admin obtida com um único segredo (`VIDEIRA_IMPORT_ADMIN_SECRET`). Evolui a AD-002, que só exigia a flag. A flag é renomeada de `VIDEIRA_ENABLE_CIFRACLUB_IMPORT` para `VIDEIRA_ENABLE_IMPORT`; o nome antigo deixa de ser lido e é ignorado (só o nome antigo definido → import desligado, `404`).
- **Rationale:** Com a persistência no servidor, o import deixa de ser só local e precisa de uma barreira antes de qualquer deploy público, sem esperar pela autenticação completa.
- **Trade-off:** Um segredo compartilhado não identifica quem importou; quando houver autenticação, a mesma política passa a checar uma permissão do usuário.
- **Scope:** `import-access`, `app/api/imports/cifraclub`, rotas de escrita usadas pelo import.
- **Supersedes:** IMA-01 substitui IMP-09 da `chart-import`: com a flag desligada, a página `/import` inteira responde `404`, em vez de só ocultar a entrada por URL.
- **Date:** 2026-10-14

## Handoff

- **Features ativas:** `import-access` (`.specs/features/import-access/spec.md` + `context.md`, IMA-xx).
- **Phase / Task:** `server-persistence`: **Complete** (branch `feat/server-persistence`; PER-15 parcial — sem `concurrency.test.ts` dedicado). `import-access`: spec aprovada; design/tasks ainda não iniciados.
- **Completed:** `server-persistence` MVP (SQLite/Prisma, API, HttpMusicRepository, migração IndexedDB, contrato); `chart-import` verificada (Verifier PASS 2026-10-09, `b939d15`).
- **Próximo passo:** merge `feat/server-persistence`; depois `import-access` antes de deploy público; opcional PER-15 (testes de concorrência) e Verifier formal `validation.md`.
- **Restrição de deploy:** `import-access` precisa ser entregue antes de qualquer deploy público; até lá as rotas de escrita da `server-persistence` ficam abertas e o app roda só local.
- **Design (Prisma/SQLite):** Json nativo desde Prisma 6.2; adapter **não** obrigatório para arquivo local; Turso via `@prisma/adapter-libsql` documentado em P3.
- **Bloqueio:** nenhum.
- **Branch:** `main`
- **Working tree:** specs novas não commitadas (`.specs/features/server-persistence/`, `.specs/features/import-access/`, `STATE.md`), além das pendências anteriores (`.gitignore`, `.specs/` de chart-import, `docs/`, `scripts/spike-cifraclub.mjs`, `graphify-out/`).
