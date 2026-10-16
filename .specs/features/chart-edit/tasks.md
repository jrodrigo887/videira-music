# Edição de cifra salva — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/chart-edit/design.md`
**Status**: Approved

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: none - strong defaults applied. Commands come from `package.json` (`test`: `vitest run`, `lint`: `eslint`). No coverage threshold is configured. Sampled tests: `lib/import/preview-import.test.ts`, `lib/persistence/music-repository.contract.test.ts`, `lib/persistence/music-database.test.ts`, `app/api/songs/[songId]/charts/route.test.ts`, `components/import/import-workflow.test.tsx`, `app/songs/[songId]/song-detail.test.tsx`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain / chart edit rules | unit | All branches; 1:1 to mapped ACs and listed edge cases | `lib/charts/*.test.ts`, `lib/import-access/*.test.ts` | `npm test -- lib/charts lib/import-access` |
| Repository | integration | Lookup by id, including a missing id and the org scope | `lib/persistence/*.test.ts` | `npm test -- lib/persistence` |
| Route | integration | Happy path, same origin without import, origin change, invalid key, empty body, 401 and 403 | `app/api/charts/**/*.test.ts` | `npm test -- app/api/charts` |
| React editor and song page | integration | Open, hide, reparse, validation messages, failed save keeps the draft | `components/songs/*.test.tsx`, `app/songs/**/*.test.tsx` | `npm test -- components/songs app/songs` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After a unit task | `npm test -- <target>` |
| Full | After a route or UI task | `npm test` |
| Build | After the last task of a phase | `npm test && npm run lint` |

---

## Execution Plan

Phases are ordered and run sequentially. Tasks inside a phase run in order.

### Phase 1: Shared list and chart merge

```text
T1 -> T2
T3
```

### Phase 2: Chart lookup

```text
T4 -> T5
T4 -> T6
T4 -> T7
```

### Phase 3: Save gate

```text
T8 -> T9
```

### Phase 4: Editor on the song page

```text
T10 -> T11
```

---

## Task Breakdown

### Phase 1: Shared list and chart merge

### T1: Export the tonality list

**What**: Move the import review tonality list and section-type labels into one module, with `isEditableChartKey`.
**Where**: `lib/charts/chart-edit-options.ts`
**Depends on**: None
**Reuses**: The arrays in `components/import/import-workflow.tsx`
**Requirement**: CED-15

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `TONALITY_OPTIONS` has the same 30 values the import review uses today, from `C` through `Bm`
- [x] `isEditableChartKey("C")` is true and `isEditableChartKey("C7")` is false
- [x] `SECTION_TYPE_OPTIONS` lists the eight section types
- [x] Gate check passes: `npm test -- lib/charts/chart-edit-options.test.ts`
- [x] Test count: at least 3 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(chart-edit): share the import review tonality list`

---

### T2: Point the import review at the shared list

**What**: The import review reads tonality and section labels from `chart-edit-options` instead of local copies.
**Where**: `components/import/import-workflow.tsx`
**Depends on**: T1
**Reuses**: `lib/charts/chart-edit-options.ts`
**Requirement**: CED-15

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] The local `TONALITY_OPTIONS` and `SECTION_TYPES` arrays are gone from the workflow
- [x] The review still offers the same tom select and the same section types
- [x] Gate check passes: `npm test -- components/import/import-workflow.test.tsx`
- [x] Test count: the existing workflow file passes with no deleted tests

**Tests**: integration
**Gate**: full

**Commit**: `refactor(chart-edit): use the shared tonality list in import review`

---

### T3: Merge an edit onto the saved chart

**What**: `applyEditedChart` keeps identity and metadata, and applies text, types, key, and capo.
**Where**: `lib/charts/apply-edited-chart.ts`
**Depends on**: None
**Reuses**: `ChordChart` and `ImportDraft`
**Requirement**: CED-10, CED-11, CED-12, CED-13

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Without `parsed`, the result keeps `id`, `songId`, `origin`, `title`, `timeSignature`, `tempo`, `format`, and `source`
- [x] A `sectionTypes` entry replaces that section's type and leaves the label
- [x] With `parsed`, sections and `source` come from the draft, and `timeSignature` still comes from the existing chart
- [x] Omitted `capo` is absent on the result
- [x] Gate check passes: `npm test -- lib/charts/apply-edited-chart.test.ts`
- [x] Test count: at least 4 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(chart-edit): merge an edit onto the saved chart`

---

### Phase 2: Chart lookup

### T4: Look up a chart by id in memory

**What**: Add `findChartById` to `ChartRepository` and the in-memory repository.
**Where**: `lib/persistence/music-repository.ts`
**Depends on**: None
**Reuses**: The existing `charts` map
**Requirement**: CED-18

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `findChartById` returns the chart saved under that id
- [x] A missing id returns `undefined`
- [x] Gate check passes: `npm test -- lib/persistence/music-repository.test.ts`
- [x] Test count: at least 2 new assertions pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(chart-edit): look up an in-memory chart by id`

---

### T5: Look up a chart by id in Prisma

**What**: `PrismaMusicRepository.findChartById` filters by `id` and `organizationId`.
**Where**: `lib/persistence/prisma-music-repository.ts`
**Depends on**: T4
**Reuses**: `toDomainChart`
**Requirement**: CED-18

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] The contract suite resolves `findChartById` for the Prisma repository
- [x] An id from another organization returns `undefined`
- [x] Gate check passes: `npm test -- lib/persistence/music-repository.contract.test.ts`
- [x] Test count: the contract file passes, including the new lookup

**Tests**: integration
**Gate**: quick

**Commit**: `feat(chart-edit): look up a Prisma chart by id and organization`

---

### T6: Look up a chart by id in IndexedDB

**What**: `IndexedDbMusicRepository.findChartById` reads the charts store by primary key.
**Where**: `lib/persistence/music-database.ts`
**Depends on**: T4
**Reuses**: The existing charts object store
**Requirement**: CED-18

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] A saved chart is returned by id after the database is reopened
- [x] A missing id returns `undefined`
- [x] Gate check passes: `npm test -- lib/persistence/music-database.test.ts`
- [x] Test count: at least 2 tests pass for the lookup

**Tests**: integration
**Gate**: quick

**Commit**: `feat(chart-edit): look up an IndexedDB chart by id`

---

### T7: Stub chart lookup on the HTTP repository

**What**: `HttpMusicRepository.findChartById` returns `undefined` and does not call the network.
**Where**: `lib/persistence/http-music-repository.ts`
**Depends on**: T4
**Reuses**: The class constructor
**Requirement**: CED-18

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Calling `findChartById` resolves `undefined`
- [x] The injected `fetch` is not called
- [x] Gate check passes: `npm test -- lib/persistence/http-music-repository.test.ts`
- [x] Test count: at least 1 test passes

**Tests**: integration
**Gate**: quick

**Commit**: `feat(chart-edit): leave HTTP chart lookup unused`

---

### Phase 3: Save gate

### T8: Classify a chart write as edit or import

**What**: `chartOriginGateKind` returns `allow` or `import` from the stored chart and the request body.
**Where**: `lib/import-access/chart-origin-gate.ts`
**Depends on**: None
**Reuses**: `canonicalizeOriginUrl`
**Requirement**: CED-18, CED-19, CED-20

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Same canonical `originUrl`, including a hash on the body URL, returns `allow`
- [ ] A missing chart with `origin`, a changed URL, and a body that drops `origin` return `import`
- [ ] A missing chart without `origin` returns `allow`
- [ ] Gate check passes: `npm test -- lib/import-access/chart-origin-gate.test.ts`
- [ ] Test count: at least 4 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(chart-edit): classify a chart write as edit or import`

---

### T9: Apply the origin gate on chart update

**What**: The chart `PUT` allows a same-origin update with `music:write`, and keeps the import gate for a new or changed origin.
**Where**: `app/api/charts/[chartId]/route.ts`
**Depends on**: T1, T5, T8
**Reuses**: `wrapPersistenceRoute`, `parseChartJson`, `gateChartWriteWithOrigin`
**Requirement**: CED-14, CED-15, CED-16, CED-17, CED-18, CED-19, CED-20, CED-21, CED-23

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] No actor returns `401 UNAUTHENTICATED`
- [ ] An actor without `music:write` returns `403 FORBIDDEN`
- [ ] Same `originUrl`, with `music:write` and without `import`, and with the import flag off, returns `204` and writes no `ImportLog`
- [ ] The saved row keeps the same `id`. A following read returns the new sections
- [ ] A key outside `TONALITY_OPTIONS` returns `422 VALIDATION_FAILED`
- [ ] A body `songId` different from the stored chart returns `422 VALIDATION_FAILED`
- [ ] Creating with `origin`, or changing `originUrl`, returns `404 NOT_FOUND` when the flag is off and `401 IMPORT_LOCKED` when the actor lacks `import`
- [ ] An invalid body returns `422 VALIDATION_FAILED`
- [ ] No log line contains the chart source text
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 8 tests pass in the route file

**Tests**: integration
**Gate**: full

**Commit**: `feat(chart-edit): allow a same-origin chart update without import`

---

### Phase 4: Editor on the song page

### T10: Build the chart editor

**What**: The editor shows the saved text, key, capo, and section types, reparses only after the text changes, and saves through `applyEditedChart`.
**Where**: `components/songs/chart-editor.tsx`
**Depends on**: T1, T3
**Reuses**: `previewImport`, `ChordChartPreview`, `repository.saveChart`
**Requirement**: CED-04, CED-05, CED-06, CED-07, CED-08, CED-09, CED-22

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] The first render shows the stored source, key, capo, and section labels without calling `previewImport`
- [ ] Changing the text reparses, resets section types to the parser result, and keeps the key and capo controls
- [ ] A section type, key, or capo changed after that parse is still there at save time
- [ ] Empty text shows `Informe o texto da cifra.` and does not call `saveChart`
- [ ] A text over 500 KiB UTF-8 shows `O texto deve ter no máximo 500 KiB.` and does not call `saveChart`
- [ ] Parser warnings are listed before save
- [ ] A failed `saveChart` leaves the draft on screen and does not call `onSaved`
- [ ] A successful save calls `saveChart` with the same chart id and the edited source
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 7 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(chart-edit): edit a saved lyrics chart from the song page`

---

### T11: Show the edit control on the song page

**What**: The song page shows `Editar cifra` only for a persisted lyrics chart with source, and only for `music:write`.
**Where**: `app/songs/[songId]/song-detail.tsx`
**Depends on**: T10
**Reuses**: `canEditMusic` and `ChartEditor`
**Requirement**: CED-01, CED-02, CED-03

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] A persisted lyrics chart with source shows `Editar cifra` when `canEditMusic` is true
- [ ] The control is absent when `canEditMusic` is false, when the chart is an example, when the format is `grid`, and when `source` is missing
- [ ] Two persisted lyrics charts each show their own control
- [ ] While one editor is open, the other chart's control is disabled
- [ ] After a successful save, the page reloads the charts and closes the editor
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 5 tests pass in the song detail file

**Tests**: integration
**Gate**: full

**Commit**: `feat(chart-edit): open the chart editor from the song page`

---

## Phase Execution Map

```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4

Phase 1:  T1 -> T2
          T3
Phase 2:  T4 -> T5
          T4 -> T6
          T4 -> T7
Phase 3:  T8 -> T9
Phase 4:  T10 -> T11
```

Execution is strictly sequential. There is no intra-phase parallelism.

This feature has 11 tasks. Phase 1 and Phase 2 pack into one batch of 7. Phase 3 and Phase 4 pack into a second batch of 4. Execute offers batch sub-agents before the first batch. The user accepts or declines. Batches run in order.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Export the tonality list | 1 module | ✅ Granular |
| T2: Point the import review at the shared list | 1 component file | ✅ Granular |
| T3: Merge an edit onto the saved chart | 1 function | ✅ Granular |
| T4: Look up a chart by id in memory | 1 repository file | ✅ Granular |
| T5: Look up a chart by id in Prisma | 1 repository file | ✅ Granular |
| T6: Look up a chart by id in IndexedDB | 1 repository file | ✅ Granular |
| T7: Stub chart lookup on the HTTP repository | 1 repository file | ✅ Granular |
| T8: Classify a chart write as edit or import | 1 function | ✅ Granular |
| T9: Apply the origin gate on chart update | 1 route | ✅ Granular |
| T10: Build the chart editor | 1 component | ✅ Granular |
| T11: Show the edit control on the song page | 1 page component | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | no incoming arrow | ✅ Match |
| T2 | T1 | T1 -> T2 | ✅ Match |
| T3 | None | no incoming arrow | ✅ Match |
| T4 | None | no incoming arrow | ✅ Match |
| T5 | T4 | T4 -> T5 | ✅ Match |
| T6 | T4 | T4 -> T6 | ✅ Match |
| T7 | T4 | T4 -> T7 | ✅ Match |
| T8 | None | no incoming arrow | ✅ Match |
| T9 | T1, T5, T8 | T8 -> T9 inside Phase 3. T1 and T5 are earlier phases | ✅ Match |
| T10 | T1, T3 | no incoming arrow inside Phase 4. T1 and T3 are earlier phases | ✅ Match |
| T11 | T10 | T10 -> T11 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: Export the tonality list | Domain / chart edit rules | unit | unit | ✅ OK |
| T2: Point the import review at the shared list | React editor and song page | integration | integration | ✅ OK |
| T3: Merge an edit onto the saved chart | Domain / chart edit rules | unit | unit | ✅ OK |
| T4: Look up a chart by id in memory | Repository | integration | integration | ✅ OK |
| T5: Look up a chart by id in Prisma | Repository | integration | integration | ✅ OK |
| T6: Look up a chart by id in IndexedDB | Repository | integration | integration | ✅ OK |
| T7: Stub chart lookup on the HTTP repository | Repository | integration | integration | ✅ OK |
| T8: Classify a chart write as edit or import | Domain / chart edit rules | unit | unit | ✅ OK |
| T9: Apply the origin gate on chart update | Route | integration | integration | ✅ OK |
| T10: Build the chart editor | React editor and song page | integration | integration | ✅ OK |
| T11: Show the edit control on the song page | React editor and song page | integration | integration | ✅ OK |
