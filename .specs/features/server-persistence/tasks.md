# Persistência no servidor (SQLite) - Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the per-task cycle, commits, workers and Verifier.

**If the skill cannot be activated, STOP and tell the user.**

**Design:** `.specs/features/server-persistence/design.md`  
**Status:** Complete

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: none — strong defaults applied; co-located Vitest pattern from `chart-import` tasks and existing `*.test.ts` / `*.test.tsx`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Persistence validation and utilities | unit | All branches; 1:1 to PER-05 and edge cases de validação | `lib/persistence/*.test.ts` | `npm test -- lib/persistence` |
| PrismaMusicRepository | integration | Round-trip, org scope, originUrl, transação, erros de FK/unicidade | `lib/persistence/prisma-music-repository.test.ts` | `npm test -- lib/persistence/prisma-music-repository` |
| MusicRepository contract (InMemory, Prisma, Http) | integration | PER-14 AC 1–4; atomic rollback; canonical `#` | `lib/persistence/music-repository.contract.test.ts` | `npm test -- lib/persistence/music-repository.contract` |
| Route Handlers | integration | Cada rota: happy + PER-05/06 + edge cases da spec | `app/api/**/*.test.ts` | `npm test -- app/api` |
| HttpMusicRepository | integration | Timeout, 404→undefined, RepositoryError | `lib/persistence/http-music-repository.test.ts` | `npm test -- lib/persistence/http-music-repository` |
| Local data migration | integration | Lotes, marcador, idempotência, failures (PER-12, PER-13) | `lib/persistence/local-data-migration.test.ts` | `npm test -- lib/persistence/local-data-migration` |
| React library / detail / import | integration | PER-01, PER-06 AC 13–14, migração UX | `components/**/*.test.tsx`, `app/songs/**/*.test.tsx` | `npm test -- components app/songs` |
| Prisma schema / seed script / docs | none | Build gate only | `prisma/**`, `docs/**` | build gate |
| Concurrency (PER-15) | integration | 10× saveSongAndChart Http; origin conflict | `lib/persistence/concurrency.test.ts` | `npm test -- lib/persistence/concurrency` |
| Observability (PER-16) | integration | Logs sem sentinela; contagens de migração | `lib/persistence/persistence-api.test.ts` ou route tests | `npm test -- lib/persistence/persistence-api` |

## Gate Check Commands

> Generated from `package.json` and `vitest.config.ts`.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Unit ou um arquivo de integração focado | `npm test -- <target>` |
| Full | Rotas, Prisma, contrato ou UI | `npm test` |
| Build | Fim de fase, schema, seed, docs | `npm test && npm run lint && npm run build` |

## Execution Plan

Phases run sequentially. Tasks inside each phase run in the declared order.

### Phase 1: Tooling and schema

```text
T1 -> T2 -> T3 -> T4
```

### Phase 2: Server domain and repository

```text
T5 -> T6 -> T7 -> T8 -> T9
```

### Phase 3: HTTP API

```text
T10 -> T11 -> T12 -> T13 -> T14 -> T15 -> T16
```

### Phase 4: Client adapter and contract

```text
T17 -> T18 -> T19
```

(T18 exporta factories das rotas; T19 roda a suíte de contrato incluindo Http.)

### Phase 5: Migration and UI

```text
T20 -> T21 -> T22 -> T23 -> T24
```

### Phase 6: Concurrency, observability, operations

```text
T25 -> T26 -> T27
```

## Task Breakdown

### Phase 1: Tooling and schema

### T1: Add Prisma, client, and seed scripts

**What:** Pin Prisma ≥ 6.2, `@prisma/client`, UUID v7 helper, and npm scripts (`db:migrate`, `db:seed`, `postinstall` generate if needed).  
**Where:** `package.json`  
**Depends on:** None  
**Reuses:** Existing npm test/lint scripts.  
**Requirement:** PER-08, PER-17

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Dependencies and scripts are pinned in lockfile.
- [ ] `npx prisma validate` succeeds against the schema once T2 exists (run after T2 in gate, or validate empty provider in T1 only for scripts).
- [ ] Build gate passes on unchanged app code.

**Tests:** none  
**Gate:** build  
**Commit:** `build(persistence): add prisma and database scripts`

### T2: Define portable Prisma schema

**What:** Add `Organization`, `Song`, and `ChordChart` models per design (TEXT ids, Json columns, `searchText`, `originUrl` unique per org).  
**Where:** `prisma/schema.prisma`  
**Depends on:** T1  
**Reuses:** AD-004 portability rules.  
**Requirement:** PER-07, PER-08, PER-10

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Schema matches design fields and indexes.
- [ ] `npx prisma validate` passes.

**Tests:** none  
**Gate:** build  
**Commit:** `feat(persistence): define multi-tenant prisma schema`

### T3: Create initial SQL migration

**What:** Generate and commit the first migration for the schema.  
**Where:** `prisma/migrations/`  
**Depends on:** T2  
**Reuses:** Prisma migrate.  
**Requirement:** PER-08

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Migration applies cleanly on an empty temp database.
- [ ] `npx prisma generate` produces the client.

**Tests:** none  
**Gate:** build  
**Commit:** `feat(persistence): add initial sqlite migration`

### T4: Extract persistence utilities and search text

**What:** Shared `canonicalizeOriginUrl`, domain mappers, and `buildSongSearchText` (NFKD rule from import workflow).  
**Where:** `lib/persistence/persistence-utils.ts`, `lib/persistence/search-text.ts`  
**Depends on:** T3  
**Reuses:** `lib/persistence/music-database.ts`, `components/import/import-workflow.tsx`  
**Requirement:** PER-08, PER-10, PER-11

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] IndexedDB adapter uses shared canonicalization (no behavior drift).
- [ ] Unit tests cover `#` stripping and searchText normalization.
- [ ] Quick gate passes.

**Tests:** unit  
**Gate:** quick  
**Commit:** `refactor(persistence): share origin and search text helpers`

---

### Phase 2: Server domain and repository

### T5: Implement persistence input validation

**What:** Parse and validate Song, ChordChart, song-chart body, and migration batch with size limits (2 MiB / 8 MiB) and PER-05 rules.  
**Where:** `lib/persistence/validate-persistence-input.ts`  
**Depends on:** T4  
**Reuses:** Domain types in `types/music.ts`.  
**Requirement:** PER-05

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] All PER-05 ACs and listed edge cases have failing/passing unit tests.
- [ ] Quick gate passes.

**Tests:** unit  
**Gate:** quick  
**Commit:** `feat(persistence): validate song and chart payloads`

### T6: Add RepositoryError and persistence API helpers

**What:** `RepositoryError`, JSON error envelope, bounded body reader, and `withPersistenceRoute` logging stub (duration only).  
**Where:** `lib/persistence/repository-error.ts`, `lib/persistence/persistence-api.ts`  
**Depends on:** T5  
**Reuses:** `app/api/imports/cifraclub/route.ts` pattern.  
**Requirement:** PER-06, PER-16

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Unit/integration tests cover envelope shape and body limit rejection.
- [ ] Logs in tests never contain a sentinel lyric string.
- [ ] Quick gate passes.

**Tests:** integration  
**Gate:** quick  
**Commit:** `feat(persistence): add api error envelope and body limits`

### T7: Wire Prisma client and default organization scope

**What:** Server-only singleton, SQLite PRAGMAs, `DATABASE_NOT_CONFIGURED`, resolve org `slug = default`.  
**Where:** `lib/persistence/prisma-client.ts`, `lib/persistence/organization-scope.ts`  
**Depends on:** T3, T6  
**Reuses:** Design PRAGMA list.  
**Requirement:** PER-06, PER-07, PER-09

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Integration test on temp DB verifies `foreign_keys` and org resolution.
- [ ] Quick gate passes.

**Tests:** integration  
**Gate:** quick  
**Commit:** `feat(persistence): configure prisma client and org scope`

### T8: Implement PrismaMusicRepository

**What:** Full `MusicRepository` with upsert, scoped queries, `originUrl` uniqueness, transactional `saveSongAndChart`, domain mapping without internal columns.  
**Where:** `lib/persistence/prisma-music-repository.ts`  
**Depends on:** T4, T7  
**Reuses:** `persistence-utils`, validation helpers for write paths if needed.  
**Requirement:** PER-02, PER-03, PER-04, PER-08, PER-09, PER-10

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Integration tests use a fresh SQLite file per test and cover round-trip, conflict, and rollback.
- [ ] Quick gate passes.

**Tests:** integration  
**Gate:** quick  
**Commit:** `feat(persistence): add prisma music repository`

### T9: Add idempotent catalog seed

**What:** Seed org Videira + 63 songs from `data/musicas.json` without overwriting existing rows.  
**Where:** `prisma/seed.ts`  
**Depends on:** T8  
**Reuses:** `lib/data/songs.ts` mapping.  
**Requirement:** PER-11

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Running seed twice on empty then populated DB keeps counts stable (script or test).
- [ ] Build gate passes.

**Tests:** none  
**Gate:** build  
**Commit:** `feat(persistence): seed default organization and catalog`

---

### Phase 3: HTTP API

### T10: Expose GET /api/songs and GET /api/songs/[songId]

**What:** List and fetch songs for default org; 404 `SONG_NOT_FOUND`.  
**Where:** `app/api/songs/route.ts`, `app/api/songs/[songId]/route.ts`  
**Depends on:** T9  
**Reuses:** `createHandler(deps)` pattern.  
**Requirement:** PER-02

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Route tests cover 200, 404, and 503 when DB unset.
- [ ] Quick gate passes.

**Tests:** integration  
**Gate:** quick  
**Commit:** `feat(persistence): add song read routes`

### T11: Expose PUT /api/songs/[songId]

**What:** Upsert song with path/body id match and validation.  
**Where:** `app/api/songs/[songId]/route.ts` (PUT handler)  
**Depends on:** T10  
**Reuses:** T5 validation.  
**Requirement:** PER-02, PER-05

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Route tests cover upsert, 422 id mismatch, 413 oversized body.
- [ ] Quick gate passes.

**Tests:** integration  
**Gate:** quick  
**Commit:** `feat(persistence): add song write route`

### T12: Expose GET /api/songs/[songId]/charts

**What:** List charts for song; empty list allowed.  
**Where:** `app/api/songs/[songId]/charts/route.ts`  
**Depends on:** T11  
**Reuses:** PrismaMusicRepository.  
**Requirement:** PER-03

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Route tests cover populated and empty lists.
- [ ] Quick gate passes.

**Tests:** integration  
**Gate:** quick  
**Commit:** `feat(persistence): add charts-by-song route`

### T13: Expose GET /api/charts?originUrl=

**What:** Lookup by canonical origin URL; 400 without query; 404 `CHART_NOT_FOUND`.  
**Where:** `app/api/charts/route.ts`  
**Depends on:** T12  
**Reuses:** T4 canonicalization.  
**Requirement:** PER-03

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Route tests cover fragment stripping and missing param.
- [ ] Quick gate passes.

**Tests:** integration  
**Gate:** quick  
**Commit:** `feat(persistence): add chart lookup by origin url`

### T14: Expose PUT /api/charts/[chartId]

**What:** Upsert chart; song must exist; originUrl conflict → 409. Stub hook for future import-access gate when `origin` present.  
**Where:** `app/api/charts/[chartId]/route.ts`  
**Depends on:** T13  
**Reuses:** T5 validation.  
**Requirement:** PER-03, PER-05, PER-10

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Route tests cover 404 song, 409 origin, 422 validation.
- [ ] Quick gate passes.

**Tests:** integration  
**Gate:** quick  
**Commit:** `feat(persistence): add chart write route`

### T15: Expose POST /api/song-charts

**What:** Atomic song+chart write in one transaction; optional song in body.  
**Where:** `app/api/song-charts/route.ts`  
**Depends on:** T14  
**Reuses:** PrismaMusicRepository.saveSongAndChart.  
**Requirement:** PER-04, PER-05

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Route tests prove rollback when chart invalid after song would save.
- [ ] Quick gate passes.

**Tests:** integration  
**Gate:** quick  
**Commit:** `feat(persistence): add atomic song-chart route`

### T16: Expose POST /api/migrations/local-data

**What:** Idempotent batch insert with skip counts and per-record failures; 8 MiB limit.  
**Where:** `app/api/migrations/local-data/route.ts`  
**Depends on:** T15  
**Reuses:** T5 migration batch parser.  
**Requirement:** PER-12

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Route tests cover create/skip/failure paths and second POST idempotency.
- [ ] Quick gate passes.

**Tests:** integration  
**Gate:** quick  
**Commit:** `feat(persistence): add local data migration route`

---

### Phase 4: Client adapter and contract

### T17: Implement HttpMusicRepository

**What:** Client `MusicRepository` over fetch with 15 s timeout and RepositoryError mapping.  
**Where:** `lib/persistence/http-music-repository.ts`  
**Depends on:** T16  
**Reuses:** T6 RepositoryError.  
**Requirement:** PER-01, PER-06

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Integration tests against in-process handlers cover timeout and 404→undefined.
- [ ] Quick gate passes.

**Tests:** integration  
**Gate:** quick  
**Commit:** `feat(persistence): add http music repository`

### T18: Export testable route handler factories

**What:** Refactor routes to export `create*Handler(deps)` for Http/contract tests without duplicating logic.  
**Where:** `app/api/songs/route.ts`, `app/api/charts/route.ts`, and sibling route modules  
**Depends on:** T17  
**Reuses:** Cifra Club `createCifraClubPostHandler`.  
**Requirement:** PER-14

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Existing route tests use factories; no behavior change.
- [ ] Full gate passes.

**Tests:** integration  
**Gate:** full  
**Commit:** `refactor(persistence): export route handler factories`

### T19: Add shared contract suite and fix InMemory origin lookup

**What:** One describe block run against InMemory, Prisma (temp file), and Http; canonical `#` on InMemory.  
**Where:** `lib/persistence/music-repository.contract.test.ts`, `lib/persistence/music-repository.ts`  
**Depends on:** T18, T8  
**Reuses:** Existing in-memory tests as seed cases.  
**Requirement:** PER-14

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] All three adapters pass the same cases including atomic rollback.
- [ ] Full gate passes.

**Tests:** integration  
**Gate:** full  
**Commit:** `test(persistence): add shared music repository contract`

---

### Phase 5: Migration and UI

### T20: Implement client local-data migration runner

**What:** Read IndexedDB, batch ≤ 8 MiB, POST to migration route, manage localStorage marker and user messages.  
**Where:** `lib/persistence/local-data-migration.ts`  
**Depends on:** T19  
**Reuses:** IndexedDB schema from `music-database.ts`.  
**Requirement:** PER-12, PER-13

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Tests with fake-indexeddb cover empty DB, success marker, partial failure without marker.
- [ ] Quick gate passes.

**Tests:** integration  
**Gate:** quick  
**Commit:** `feat(persistence): migrate indexeddb data to server`

### T21: Point SongLibrary at Http and run migration on load

**What:** Default `HttpMusicRepository`, remove seed merge, trigger T20 before list, update tests.  
**Where:** `components/songs/song-library.tsx`, `components/songs/song-library.test.tsx`  
**Depends on:** T20  
**Reuses:** Existing library UI.  
**Requirement:** PER-01, PER-11, PER-13, PER-18

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Component tests mock Http repo; no import of IndexedDbMusicRepository.
- [ ] Full gate passes.

**Tests:** integration  
**Gate:** full  
**Commit:** `feat(persistence): load library from server`

### T22: Update SongDetail for server-only reads and errors

**What:** Http default, show imported charts without id prefix heuristic, storage-error UI without seed fallback.  
**Where:** `app/songs/[songId]/song-detail.tsx`, `app/songs/[songId]/song-detail.test.tsx`  
**Depends on:** T21  
**Reuses:** Example charts when no persisted charts.  
**Requirement:** PER-01, PER-06, PER-18

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Tests assert error copy and retry; imported chart section for server ids.
- [ ] Full gate passes.

**Tests:** integration  
**Gate:** full  
**Commit:** `feat(persistence): load song detail from server`

### T23: Point ImportWorkflow at HttpMusicRepository

**What:** Replace IndexedDB default; keep injected repo for tests.  
**Where:** `components/import/import-workflow.tsx`, `components/import/import-workflow.test.tsx`  
**Depends on:** T22  
**Reuses:** `saveImportedChart` queue.  
**Requirement:** PER-01, PER-18

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Tests still pass with InMemory injection.
- [ ] Full gate passes.

**Tests:** integration  
**Gate:** full  
**Commit:** `feat(persistence): persist imports through http repository`

### T24: Update songs pages to stop client seed merge

**What:** `/songs` loads from server via SongLibrary only; detail page drops static seed prop and adjusts static params strategy.  
**Where:** `app/songs/page.tsx`, `app/songs/[songId]/page.tsx`, `app/page.tsx` (copy)  
**Depends on:** T23  
**Reuses:** Server Components where useful.  
**Requirement:** PER-11, PER-18

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Build gate passes; library no longer depends on `listSongs()` from JSON for listing.
- [ ] User-created song ids open without build-time 404.

**Tests:** none  
**Gate:** build  
**Commit:** `feat(persistence): serve catalog from server pages`

---

### Phase 6: Concurrency, observability, operations

### T25: Add concurrency and origin conflict tests

**What:** PER-15 scenarios against Http adapter (sequential and parallel saves).  
**Where:** `lib/persistence/concurrency.test.ts`  
**Depends on:** T19  
**Reuses:** Contract test fixtures.  
**Requirement:** PER-15

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Tests demonstrate 10 distinct saves survive and origin conflict returns 409.
- [ ] Full gate passes.

**Tests:** integration  
**Gate:** full  
**Commit:** `test(persistence): cover concurrent writes`

### T26: Complete persistence route observability

**What:** Log 4xx/5xx with route, method, status, code, durationMs; migration logs counts and failure ids only.  
**Where:** `lib/persistence/persistence-api.ts`, migration route  
**Depends on:** T25  
**Reuses:** T6 wrapper.  
**Requirement:** PER-16

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Tests capture logs without lyric sentinel string.
- [ ] Full gate passes.

**Tests:** integration  
**Gate:** full  
**Commit:** `feat(persistence): add safe persistence logging`

### T27: Document database operations and deploy constraints

**What:** DATABASE_URL, migrate, seed, persistent volume / Turso note, serverless unsupported.  
**Where:** `docs/README.md` or new `docs/database.md`  
**Depends on:** T26  
**Reuses:** Spec P3 ACs.  
**Requirement:** PER-17

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Fresh-directory checklist documented.
- [ ] Build gate passes.

**Tests:** none  
**Gate:** build  
**Commit:** `docs(persistence): document sqlite setup and deploy`

---

## Phase Execution Map

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phase 1:  T1 → T2 → T3 → T4
Phase 2:  T5 → T6 → T7 → T8 → T9
Phase 3:  T10 → T11 → T12 → T13 → T14 → T15 → T16
Phase 4:  T17 → T18 → T19
Phase 5:  T20 → T21 → T22 → T23 → T24
Phase 6:  T25 → T26 → T27
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | package scripts/deps | ✅ Granular |
| T2 | one schema file | ✅ Granular |
| T3 | migrations folder | ✅ Granular |
| T4 | shared helpers | ✅ Granular |
| T5 | validation module | ✅ Granular |
| T6 | error/api helpers | ✅ Granular |
| T7 | prisma client + org | ✅ Granular |
| T8 | one repository class | ✅ Granular |
| T9 | seed script | ✅ Granular |
| T10–T16 | one route (or pair of GET reads for songs) | ✅ Granular |
| T17 | Http repository | ✅ Granular |
| T18 | contract suite | ✅ Granular |
| T19 | refactor exports | ✅ Granular |
| T20–T23 | one client surface each | ✅ Granular |
| T24 | pages composition | ✅ Granular |
| T25–T27 | one concern each | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | start | ✅ |
| T2 | T1 | T1→T2 | ✅ |
| T3 | T2 | T2→T3 | ✅ |
| T4 | T3 | T3→T4 | ✅ |
| T5 | T4 | T4→T5 | ✅ |
| T6 | T5 | T5→T6 | ✅ |
| T7 | T3, T6 | T6→T7 | ✅ |
| T8 | T4, T7 | T7→T8 | ✅ |
| T9 | T8 | T8→T9 | ✅ |
| T10 | T9 | T9→T10 | ✅ |
| T11 | T10 | T10→T11 | ✅ |
| T12 | T11 | T11→T12 | ✅ |
| T13 | T12 | T12→T13 | ✅ |
| T14 | T13 | T13→T14 | ✅ |
| T15 | T14 | T14→T15 | ✅ |
| T16 | T15 | T15→T16 | ✅ |
| T17 | T16 | T16→T17 | ✅ |
| T18 | T17 | T17→T18 | ✅ |
| T19 | T18, T8 | T18→T19 | ✅ |
| T20 | T19 | T19→T20 | ✅ |
| T21 | T20 | T20→T21 | ✅ |
| T22 | T21 | T21→T22 | ✅ |
| T23 | T22 | T22→T23 | ✅ |
| T24 | T23 | T23→T24 | ✅ |
| T25 | T19 | T24→T25 | ✅ |
| T26 | T25 | T25→T26 | ✅ |
| T27 | T26 | T26→T27 | ✅ |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Config | none | none | ✅ OK |
| T2 | Schema | none | none | ✅ OK |
| T3 | Migration | none | none | ✅ OK |
| T4 | Utilities | unit | unit | ✅ OK |
| T5 | Validation | unit | unit | ✅ OK |
| T6 | API helpers | integration | integration | ✅ OK |
| T7 | Prisma wiring | integration | integration | ✅ OK |
| T8 | Repository | integration | integration | ✅ OK |
| T9 | Seed | none | none | ✅ OK |
| T10–T16 | Routes | integration | integration | ✅ OK |
| T17 | Http repo | integration | integration | ✅ OK |
| T18 | Contract | integration | integration | ✅ OK |
| T19 | Routes refactor | integration | integration | ✅ OK |
| T20 | Migration | integration | integration | ✅ OK |
| T21–T23 | React | integration | integration | ✅ OK |
| T24 | Pages | none | none | ✅ OK |
| T25 | Concurrency | integration | integration | ✅ OK |
| T26 | Observability | integration | integration | ✅ OK |
| T27 | Docs | none | none | ✅ OK |

## Requirement Traceability (tasks)

| Requirement ID | Tasks | Phase |
| --- | --- | --- |
| PER-01 | T17, T21, T22, T23 | 4–5 |
| PER-02 | T8, T10, T11 | 2–3 |
| PER-03 | T8, T12, T13, T14 | 2–3 |
| PER-04 | T8, T15 | 2–3 |
| PER-05 | T5, T11, T14, T15, T16 | 2–3 |
| PER-06 | T6, T17, T22 | 2–5 |
| PER-07 | T2, T7, T8 | 1–2 |
| PER-08 | T1–T4, T8 | 1–2 |
| PER-09 | T7, T8 | 2 |
| PER-10 | T2, T8, T14 | 1–3 |
| PER-11 | T4, T9, T21, T24 | 1–5 |
| PER-12 | T16, T20 | 3–5 |
| PER-13 | T20, T21 | 5 |
| PER-14 | T18, T19 | 4 |
| PER-15 | T25 | 6 |
| PER-16 | T6, T26 | 2, 6 |
| PER-17 | T1, T27 | 1, 6 |
| PER-18 | T21, T22, T23, T24 | 5 |
