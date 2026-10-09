# Importação e persistência de cifras - Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the per-task cycle, commits, workers and Verifier.

**If the skill cannot be activated, STOP and tell the user.**

**Design:** `.specs/features/chart-import/design.md`  
**Status:** Approved

## Test Coverage Matrix

> Generated from `package.json`, `vitest.config.ts`, existing co-located tests and the spec. Guidelines found: `docs/technical-design/videira-music-mvp-tdd.md`; no coverage threshold configured, so strong defaults apply.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Import domain and use cases | unit | All branches; 1:1 to mapped ACs and edge cases | `lib/import/*.test.ts` | `npm test -- lib/import` |
| Persistence repository | integration | Transactions, indexes, reload, duplicate URL and failures | `lib/persistence/*.test.ts` | `npm test -- lib/persistence` |
| Cifra Club extractor/source | unit | Metadata, selectors, allowlist, cache, queue and mapped failures | `lib/import/sources/*.test.ts` | `npm test -- lib/import/sources` |
| Route Handler | integration | Success, flag off, invalid body/host and every mapped error | `app/api/imports/cifraclub/*.test.ts` | `npm test -- app/api/imports/cifraclub` |
| React workflow/catalog/detail | integration | User-visible state transitions, persistence and error recovery | `components/**/*.test.tsx` | `npm test -- components` |
| Page/config/docs/schema | none | Build, lint and type integration only | `app/**`, `*.config.ts`, `docs/**`, `types/**` | build gate |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Unit or focused integration task | `npm test -- <target>` |
| Full | Route, persistence or UI integration | `npm test` |
| Build | Phase completion and config/docs tasks | `npm test && npm run lint && npm run build` |

## Execution Plan

Phases run sequentially. Tasks inside each phase run in the declared order.

### Phase 1: Contracts and persistence

```text
T1
T2
T3 -> T4 -> T5
```

### Phase 2: Cifra Club server path

```text
T6 -> T7 -> T8
```

### Phase 3: User workflow and catalog integration

```text
T9 -> T10
T11 -> T12
```

### Phase 4: Operational documentation

```text
T13
```

## Task Breakdown

### Phase 1: Contracts and persistence

### T1: Configure feature dependencies and test environment ✅

**What:** Add server-only/HTML parsing, IndexedDB test support and React DOM testing dependencies; configure Vitest for `.test.tsx`.  
**Where:** `package.json`  
**Depends on:** None  
**Reuses:** Existing npm scripts and Vitest configuration.  
**Requirement:** IMP-01, IMP-08, IMP-13

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [x] Required runtime and test dependencies are pinned in package and lock files.
- [x] Vitest discovers existing `.test.ts` and new `.test.tsx` files.
- [x] Existing tests continue passing.
- [x] Build gate passes.

**Tests:** none, dependency/config layer  
**Gate:** build  
**Commit:** `build(import): configure import workflow dependencies`

### T2: Extend preview import for RawChart signals ✅

**What:** Accept `meta` and `chordTokens`, preserve source metadata and pass untrusted page key through `detectKey`.  
**Where:** `lib/import/preview-import.ts`  
**Depends on:** None  
**Reuses:** `classifyLines`, `detectKey`, `RawChartMeta`.  
**Requirement:** IMP-01, IMP-02, IMP-03, IMP-08

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [x] Marked chord tokens drive classification.
- [x] Page title, artist, capo and key populate the draft without becoming trusted hints.
- [x] A page-key mismatch emits `KEY_MISMATCH`.
- [x] Unit tests cover all new branches and quick gate passes.

**Tests:** unit  
**Gate:** quick  
**Commit:** `feat(import): accept raw chart metadata`

### T3: Define local music repository contracts ✅

**What:** Define async repositories for local songs and charts, including lookup by origin URL and an atomic save boundary.  
**Where:** `lib/persistence/music-repository.ts`  
**Depends on:** None  
**Reuses:** `Song`, `SongId`, `ChordChart`.  
**Requirement:** IMP-05, IMP-06, IMP-07, IMP-13

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [x] Interfaces expose only feature-required operations.
- [x] In-memory implementation supports deterministic use-case tests.
- [x] Repository failure can be injected without browser APIs.
- [x] Unit tests cover query, save and failure behavior.

**Tests:** unit  
**Gate:** quick  
**Commit:** `feat(persistence): define local music repositories`

### T4: Implement the IndexedDB music database ✅

**What:** Implement versioned IndexedDB stores, indexes and atomic music/chart transactions behind repository contracts.  
**Where:** `lib/persistence/music-database.ts`  
**Depends on:** T3  
**Reuses:** Repository contracts from T3.  
**Requirement:** IMP-06, IMP-07, IMP-13

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [x] Songs and charts survive database re-open.
- [x] `songId` and canonical `origin.url` queries use indexes.
- [x] A failed transaction does not partially persist a music/chart pair.
- [x] Integration tests use an isolated IndexedDB implementation and full gate passes.

**Tests:** integration  
**Gate:** full  
**Commit:** `feat(persistence): store songs and charts in indexeddb`

### T5: Implement save-imported-chart use case

**What:** Validate review state, create or link a song, materialize the chart and save it atomically.  
**Where:** `lib/import/save-imported-chart.ts`  
**Depends on:** T4  
**Reuses:** `ImportDraft` and repository contracts.  
**Requirement:** IMP-03, IMP-05, IMP-06, IMP-07

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Missing key confirmation or song selection is rejected.
- [ ] Existing song linking preserves the chosen `songId`.
- [ ] New IDs cannot collide with numeric seed IDs.
- [ ] Storage failure returns without mutating the draft.
- [ ] Unit tests map 1:1 to persistence ACs and quick gate passes.

**Tests:** unit  
**Gate:** quick  
**Commit:** `feat(import): save reviewed import drafts`

### Phase 2: Cifra Club server path

### T6: Parse Cifra Club HTML into RawChart

**What:** Validate supported URLs and extract chart text, marked chords and semantic metadata from synthetic HTML.  
**Where:** `lib/import/sources/cifraclub-parse.ts`  
**Depends on:** T2  
**Reuses:** `parseKey`, `parseCapo`, `RawChart`.  
**Requirement:** IMP-08, IMP-10, IMP-12, IMP-14

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Only HTTPS Cifra Club hosts pass validation.
- [ ] Text and `data-chord-name` tokens preserve order.
- [ ] JSON-LD, key, capo and YouTube metadata are extracted with documented precedence.
- [ ] Missing chart content raises `SOURCE_LAYOUT_CHANGED`.
- [ ] Synthetic fixtures contain no protected lyrics and unit gate passes.

**Tests:** unit  
**Gate:** quick  
**Commit:** `feat(import): parse cifra club html`

### T7: Implement queued headed Cifra Club source

**What:** Add server-only Playwright I/O with FIFO spacing, singleton browser, idle close, cache and typed failures.  
**Where:** `lib/import/sources/cifraclub.ts`  
**Depends on:** T6  
**Reuses:** Cifra Club extractor and spike selectors.  
**Requirement:** IMP-08, IMP-10, IMP-11, IMP-12, IMP-14

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Navigations start at least 10 seconds apart and retain FIFO order.
- [ ] Browser is headed, reused and closed after 60 seconds idle.
- [ ] Cache keys are SHA-256 hashes of canonical URLs.
- [ ] Final redirect host is revalidated.
- [ ] Timeout, blocked page, corrupt cache and disconnect paths are tested without live network.
- [ ] Unit gate passes.

**Tests:** unit  
**Gate:** quick  
**Commit:** `feat(import): fetch cifra club charts locally`

### T8: Expose the guarded Cifra Club route

**What:** Implement the Node.js Route Handler, feature-flag gate, request validation, orchestration and HTTP error mapping.  
**Where:** `app/api/imports/cifraclub/route.ts`  
**Depends on:** T7  
**Reuses:** `fetchCifraClubChart`, `previewImport`.  
**Requirement:** IMP-08, IMP-09, IMP-10, IMP-11, IMP-12

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Flag off returns `404` before parsing or browser access.
- [ ] Malformed/missing URL returns `400`; unsupported host returns `422`.
- [ ] Source errors map to documented `502` and `504` bodies.
- [ ] Success returns an `ImportDraft` containing origin, meta and chord signals.
- [ ] Route integration tests cover every response and full gate passes.

**Tests:** integration  
**Gate:** full  
**Commit:** `feat(api): add local cifra club import route`

### Phase 3: User workflow and catalog integration

### T9: Build the import review workflow

**What:** Implement input, URL/paste preview, warnings, key confirmation, section editing, song suggestion/linking and save states.  
**Where:** `components/import/import-workflow.tsx`  
**Depends on:** T5, T8  
**Reuses:** `ChordChartPreview`, `previewImport`, design-system classes.  
**Requirement:** IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, IMP-08, IMP-09, IMP-10

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Paste and enabled URL paths reach the same review state.
- [ ] Empty/oversized text cannot advance.
- [ ] Save remains disabled until key and song are confirmed.
- [ ] Section type changes update preview and preserve labels.
- [ ] Existing URL opens its saved chart without calling the API.
- [ ] Source failures expose paste fallback and storage failures preserve the draft.
- [ ] React integration tests cover every state transition and full gate passes.

**Tests:** integration  
**Gate:** full  
**Commit:** `feat(import): build review and save workflow`

### T10: Add the import page and library entry point

**What:** Render the workflow with the server-derived feature flag and expose an “Importar cifra” action from the library.  
**Where:** `app/import/page.tsx`  
**Depends on:** T9  
**Reuses:** App Router layout and songs page navigation.  
**Requirement:** IMP-01, IMP-09

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] URL input receives `enabled=false` unless the server-only flag equals `true`.
- [ ] Paste import remains available regardless of the flag.
- [ ] Library exposes a keyboard-accessible import action.
- [ ] Build gate passes.

**Tests:** none, page composition layer  
**Gate:** build  
**Commit:** `feat(import): add import page entry point`

### T11: Merge local songs into the library

**What:** Load local songs after hydration, merge them with seed records and search the combined catalog.  
**Where:** `components/songs/song-library.tsx`  
**Depends on:** T5  
**Reuses:** Existing `SongLibrary` cards and search behavior.  
**Requirement:** IMP-05, IMP-13

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Seed records remain read-only and retain order.
- [ ] Local songs appear once and are searchable by title, artist and key.
- [ ] Repository failure shows a non-destructive local-data warning.
- [ ] React integration tests cover merge, search and failure paths.

**Tests:** integration  
**Gate:** full  
**Commit:** `feat(catalog): include locally imported songs`

### T12: Load persisted charts in song detail

**What:** Resolve seed or local songs client-side and render persisted charts with source attribution and transposition.  
**Where:** `app/songs/[songId]/page.tsx`  
**Depends on:** T11  
**Reuses:** `ChordChartPreview` and existing detail metadata layout.  
**Requirement:** IMP-06, IMP-07, IMP-13, IMP-14

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Numeric seed and `song-local-*` routes both resolve.
- [ ] Persisted charts replace demo-only behavior when present.
- [ ] Cifra Club origin is attributed with its URL.
- [ ] Unknown IDs render not-found only after local lookup completes.
- [ ] React integration tests cover seed, local, missing and storage-failure paths.

**Tests:** integration  
**Gate:** full  
**Commit:** `feat(catalog): show persisted charts in song detail`

### Phase 4: Operational documentation

### T13: Document setup and use of chart imports

**What:** Move the discovery into the main docs tree, reconcile stale scope statements and document env, Chromium install, usage and fallback.  
**Where:** `docs/discovery-importacao-cifras.md`  
**Depends on:** T12  
**Reuses:** Existing discovery, TDD and implementation plan.  
**Requirement:** IMP-08, IMP-09, IMP-14

**Tools:**

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when:**

- [ ] Main docs contain one canonical discovery path.
- [ ] Commands cover env flag, Chromium installation, dev server and import flow.
- [ ] Public-deploy and copyright guardrails are explicit.
- [ ] Stale “Cifra Club fora do MVP” statements are reconciled.
- [ ] Build gate passes.

**Tests:** none, documentation layer  
**Gate:** build  
**Commit:** `docs(import): document cifra import workflow`

## Phase Execution Map

```text
Phase 1: T1
         T2
         T3 -> T4 -> T5

Phase 2: T6 -> T7 -> T8

Phase 3: T9 -> T10
         T11 -> T12

Phase 4: T13
```

Two sequential worker batches are approved:

1. Batch A: Phases 1 and 2, tasks T1-T8.
2. Batch B: Phases 3 and 4, tasks T9-T13.

A fresh Verifier runs after T13 and writes `validation.md`.

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | Dependency/config setup | Granular |
| T2 | One parser orchestrator | Granular |
| T3 | One repository contract module | Granular |
| T4 | One persistence adapter | Granular |
| T5 | One save use case | Granular |
| T6 | One HTML extractor | Granular |
| T7 | One external source adapter | Granular |
| T8 | One API endpoint | Granular |
| T9 | One workflow component | Granular |
| T10 | One page composition | Granular |
| T11 | One library component | Granular |
| T12 | One detail route | Granular |
| T13 | One canonical document | Granular |

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | standalone | Match |
| T2 | None | standalone | Match |
| T3 | None | standalone | Match |
| T4 | T3 | T3 → T4 | Match |
| T5 | T4 | T4 → T5 | Match |
| T6 | T2 | cross-phase | Match |
| T7 | T6 | T6 → T7 | Match |
| T8 | T7 | T7 → T8 | Match |
| T9 | T5, T8 | cross-phase | Match |
| T10 | T9 | T9 → T10 | Match |
| T11 | T5 | cross-phase | Match |
| T12 | T11 | T11 → T12 | Match |
| T13 | T12 | cross-phase | Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Config | none | none | OK |
| T2 | Import domain | unit | unit | OK |
| T3 | Repository contract/in-memory | unit | unit | OK |
| T4 | Persistence | integration | integration | OK |
| T5 | Use case | unit | unit | OK |
| T6 | Source extractor | unit | unit | OK |
| T7 | Source adapter | unit | unit | OK |
| T8 | Route | integration | integration | OK |
| T9 | React workflow | integration | integration | OK |
| T10 | Page composition | none | none | OK |
| T11 | React catalog | integration | integration | OK |
| T12 | React detail | integration | integration | OK |
| T13 | Documentation | none | none | OK |
