# Setlists (fase 1) - Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the per-task cycle, atomic commits, batch workers and final Verifier.

**If the skill cannot be activated, STOP and tell the user.**

---

**Design:** `.specs/features/setlists/design.md`  
**Status:** Approved

## Test Coverage Matrix

> Generated from codebase, project guidelines and spec - confirm before Execute. Guidelines found: `vitest.config.ts`, `eslint.config.mjs` and `package.json`; no documented coverage threshold, so strong defaults apply. Style and placement sampled from `lib/auth/load-actor.test.ts`, `lib/import-access/import-access-policy.test.ts`, `lib/persistence/music-repository.contract.test.ts`, `app/api/imports/session/route.test.ts`, `app/import/page.test.tsx` and `components/songs/song-library.test.tsx`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Types, Prisma schema and SQL migration | none | Schema validation, migration on an empty database and build gate | `types/**/*.ts`, `prisma/**` | build gate |
| Pure domain helpers and input validation | unit | All branches; 1:1 to the mapped ACs and every listed edge case | `lib/{chords,setlists,worship-teams}/**/*.test.ts` | `npm test -- <target>` |
| Access policy | unit | Full action × actor × target matrix from SET-23/24, including cross-organization reads | `lib/setlists/setlist-policy.test.ts` | `npm test -- lib/setlists/setlist-policy.test.ts` |
| Prisma repositories | integration | Key query and mutation paths, ordering, idempotency, optimistic concurrency, transaction rollback and failure paths | `lib/{setlists,worship-teams}/*.test.ts` | `npm test -- <target>` |
| Domain services | integration | Every mapped spec AC and edge case against a temporary SQLite database | `lib/{setlists,worship-teams}/*service.test.ts` | `npm test -- <target>` |
| Route Handlers | integration | Every route: happy path, malformed JSON, authorization, validation, not-found and database-unconfigured paths | `app/api/{setlists,teams}/**/*.test.ts` | `npm test -- <target>` |
| Server pages and React components | integration | Visible outcomes, permitted actions, empty/error states and user interactions from mapped ACs | `app/{setlists,groups}/**/*.test.tsx`, `components/setlists/*.test.tsx` | `npm test -- <target>` |
| Header and song-detail integration | integration | Role-conditioned navigation and setlist previous/next behavior | `app/layout.test.tsx`, `app/songs/[songId]/song-detail.test.tsx` | `npm test -- <target>` |

## Gate Check Commands

> Generated from `package.json`, `vitest.config.ts` and `eslint.config.mjs`.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Pure helper, policy or one focused module | `npm test -- <target>` |
| Full | Repository, service, route or React integration | `npm test` |
| Build | Schema/migration tasks and every phase boundary | `npm test && npm run lint && npm run build` |

---

## Execution Plan

Phases and tasks run sequentially.

### Phase 1: Domain foundation

```text
T1 → T2 → T3 → T4 → T5 → T6
```

### Phase 2: Persistence

```text
T7 → T8 → T9 → T10 → T11
```

### Phase 3: Application services

```text
T12 → T13 → T14 → T15 → T16 → T17 → T18
```

### Phase 4: HTTP API

```text
T19 → T20 → T21 → T22 → T23 → T24 → T25 → T26
```

### Phase 5: User interface

```text
T27 → T28 → T29 → T30 → T31 → T32 → T33 → T34
```

---

## Task Breakdown

### Phase 1: Domain foundation

### T1: Define setlist domain types

**What:** Add the setlist, item, summary, followed-entry, permission and input types specified by the design.  
**Where:** `types/setlist.ts`  
**Depends on:** None  
**Reuses:** Branded ids from `types/music.ts` and `types/identity.ts`.  
**Requirement:** SET-01, SET-04, SET-10, SET-19  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] The discriminated item and followed-entry unions prevent invalid combinations.
- [x] API-facing types omit `deletedAt` and follower ids.
- [x] Build gate passes with no existing type regressions.
**Tests:** none  
**Gate:** build  
**Commit:** `feat(setlists): define setlist domain types`

### T2: Extend the Prisma schema for setlists

**What:** Add `Setlist`, `SetlistItem`, `SetlistFollow`, inverse relations and catalog source-organization fields from the design.  
**Where:** `prisma/schema.prisma`  
**Depends on:** T1  
**Reuses:** Existing `Organization`, `WorshipTeam`, `Song` and `ChordChart` models.  
**Requirement:** SET-01, SET-04, SET-17, SET-21, SET-22  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Ownership, visibility, status, version, soft deletion, item order and follows are represented.
- [x] `ownerUserId` is nullable and has no relation in phase 1.
- [x] `npx prisma validate` passes.
**Tests:** none  
**Gate:** build  
**Commit:** `feat(setlists): extend prisma schema`

### T3: Add the setlist SQL migration

**What:** Add an additive SQLite migration for the phase-1 setlist schema.  
**Where:** `prisma/migrations/*_setlists/migration.sql`  
**Depends on:** T2  
**Reuses:** Existing migration ordering and SQLite conventions.  
**Requirement:** SET-01, SET-17, SET-22  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] The migration applies to a fresh temporary database.
- [x] Existing organization, user, team, song and chart data survive migration.
- [x] Prisma client generation and the build gate pass.
**Tests:** none  
**Gate:** build  
**Commit:** `feat(setlists): add setlist database migration`

### T4: Validate transposable item keys

**What:** Add `isTransposableKey` over the existing chord parser and chromatic scales.  
**Where:** `lib/chords/transpose-chord.*`  
**Depends on:** T3  
**Reuses:** `parseKeyRoot`, `SHARP_NOTES`, `FLAT_NOTES` and existing transpose tests.  
**Requirement:** SET-05  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests accept valid major/minor roots with supported sharps/flats.
- [x] Tests reject malformed, unsupported and suffixed keys.
- [x] At least 8 focused key-validation cases pass without deleting existing tests.
**Tests:** unit  
**Gate:** quick  
**Commit:** `feat(chords): validate transposable keys`

### T5: Implement the centralized access policy

**What:** Implement `canPerform(actor, action, target)` as the sole setlist/team authorization policy.  
**Where:** `lib/setlists/setlist-policy.*`  
**Depends on:** T4  
**Reuses:** `Actor`, `isOrganizationAdmin`, `teamRoleOf` and `DEFAULT_ORGANIZATION_ID`.  
**Requirement:** SET-23, SET-24  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Table-driven tests cover every action for admin, owner leader, other leader, member, follower member, anonymous and other-organization user.
- [x] Read tests cover deleted, draft, private, team, organization and public setlists.
- [x] The full matrix passes with at least 40 table cases and no direct policy branches left untested.
**Tests:** unit  
**Gate:** quick  
**Commit:** `feat(setlists): centralize access policy`

### T6: Parse and validate setlist payloads

**What:** Implement typed parsers for create, update, item replacement, follow, clone and delete inputs with all phase-1 limits.  
**Where:** `lib/setlists/validate-setlist-input.*`  
**Depends on:** T5  
**Reuses:** `ValidationIssue` and the parser style from `validate-persistence-input.ts`.  
**Requirement:** SET-03, SET-05, SET-06, SET-07, SET-20, SET-21  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover all bounds, enums, discriminated items and required `expectedVersion`.
- [x] Invalid notes, chart ids, keys, owners and more than 100 items return the specified code.
- [x] At least 20 focused parser cases pass.
**Tests:** unit  
**Gate:** quick  
**Commit:** `feat(setlists): validate setlist inputs`

### Phase 2: Persistence

### T7: Define the setlist repository contract

**What:** Define records, clone plan inputs and persistence operations without authorization logic.  
**Where:** `lib/setlists/setlist-repository.ts`  
**Depends on:** T6  
**Reuses:** Domain types from T1 and repository conventions from `music-repository.ts`.  
**Requirement:** SET-04, SET-07, SET-17, SET-19, SET-22  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] The interface exposes every operation listed in the design.
- [x] Version conflicts have a typed repository error.
- [x] Build gate passes.
**Tests:** none  
**Gate:** build  
**Commit:** `feat(setlists): define repository contract`

### T8: Implement the Prisma setlist repository

**What:** Implement ordered reads, writes, soft deletion, idempotent follows, optimistic versioning and transactional clone application.  
**Where:** `lib/setlists/prisma-setlist-repository.*`  
**Depends on:** T7  
**Reuses:** `PrismaMusicRepository` transaction patterns and temporary-database helpers.  
**Requirement:** SET-04, SET-07, SET-17, SET-19, SET-22  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Integration tests cover create/read/list, item order/id preservation and hidden soft-deleted rows.
- [x] Two writes with the same version preserve the first and reject the second.
- [x] Follow/unfollow are idempotent and clone-plan failure rolls back all records.
- [x] At least 12 repository integration cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): add prisma repository`

### T9: Build deterministic clone plans

**What:** Implement the pure same-organization and cross-organization clone planner.  
**Where:** `lib/setlists/clone-plan.*`  
**Depends on:** T8  
**Reuses:** `canonicalizeOriginUrl` and the T7 clone-plan types.  
**Requirement:** SET-21, SET-22  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests prove clone defaults, order preservation, no source-setlist reference and one copy per source song.
- [x] Existing target charts are reused by canonical origin URL with their existing songs.
- [x] At least 7 clone-plan cases pass.
**Tests:** unit  
**Gate:** quick  
**Commit:** `feat(setlists): build clone plans`

### T10: Generate immutable worship-team slugs

**What:** Add slug generation and deterministic collision suffixing.  
**Where:** `lib/worship-teams/team-slug.*`  
**Depends on:** T9  
**Reuses:** Existing normalization conventions from `search-text.ts`.  
**Requirement:** GRP-03  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover accents, whitespace, punctuation, empty normalized names and `-2`/`-3` collisions.
- [x] Rename behavior cannot require slug regeneration through this API.
- [x] At least 7 slug cases pass.
**Tests:** unit  
**Gate:** quick  
**Commit:** `feat(groups): generate stable team slugs`

### T11: Implement the worship-team repository

**What:** Implement organization-scoped list, lookup, create, rename and archive persistence.  
**Where:** `lib/worship-teams/worship-team-repository.*`  
**Depends on:** T10  
**Reuses:** Temporary SQLite helpers and Prisma repository conventions.  
**Requirement:** GRP-03, GRP-04, SET-14  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Integration tests cover alphabetical active lists, archived inclusion, slug collision, rename-with-stable-slug and archive.
- [x] No delete operation exists in the contract.
- [x] At least 7 repository cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(groups): add worship team repository`

### Phase 3: Application services

### T12: Implement the worship-team service

**What:** Add admin-managed team operations and actor-specific selectable-team queries through `canPerform`.  
**Where:** `lib/worship-teams/worship-team-service.*`  
**Depends on:** T11  
**Reuses:** T5 policy, T10 slug generation and T11 repository.  
**Requirement:** GRP-01, GRP-02, GRP-03, GRP-04, SET-14  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover admin CRUD-without-delete, non-admin denial and stable slug on rename.
- [x] Selectable teams are active, alphabetical and actor-scoped.
- [x] At least 9 service cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(groups): add worship team service`

### T13: Read and list setlists through the service

**What:** Implement indistinguishable readable lookup and the four group-aware tab queries.  
**Where:** `lib/setlists/setlist-service.*`  
**Depends on:** T12  
**Reuses:** T5 policy and T8 repository.  
**Requirement:** SET-10, SET-13, SET-14, SET-15, SET-18, SET-19  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover every tab, actor visibility, draft/archive filtering and followed unavailable entries.
- [x] Missing, deleted and unauthorized ids all produce `404 SETLIST_NOT_FOUND`.
- [x] At least 12 read/list service cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): read and list setlists`

### T14: Create setlists through the service

**What:** Implement team and organization setlist creation with owner, visibility and archived-team rules.  
**Where:** `lib/setlists/setlist-service.*`  
**Depends on:** T13  
**Reuses:** T5 policy, T6 validation and T8 repository.  
**Requirement:** SET-01, SET-02, SET-03, SET-16, GRP-04  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover team/organization defaults, explicit visibility, permission denial and invalid organization-team visibility.
- [x] Archived team creation returns `409 TEAM_ARCHIVED`.
- [x] At least 9 create cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): create owned setlists`

### T15: Replace setlist items through the service

**What:** Implement atomic full-list replacement with chart/song/organization validation, selected-key defaults and preserved item ids.  
**Where:** `lib/setlists/setlist-service.*`  
**Depends on:** T14  
**Reuses:** T4 key validator, `PrismaMusicRepository` and T8 versioning.  
**Requirement:** SET-04, SET-05, SET-06, SET-07  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover song and note items, duplicates, selected-key default, ordering and reordering with stable ids.
- [x] Wrong/missing/cross-organization charts and invalid keys leave existing items untouched.
- [x] Sequential same-version writes prove the first result survives.
- [x] At least 13 item-service cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): replace ordered items`

### T16: Update status, metadata and soft-delete

**What:** Implement metadata edits, legal status transitions, follower-impact checks and soft deletion.  
**Where:** `lib/setlists/setlist-service.*`  
**Depends on:** T15  
**Reuses:** T5 policy and T8 optimistic writes.  
**Requirement:** SET-03, SET-07, SET-08, SET-20  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover all three legal transitions and every illegal transition.
- [x] Visibility/delete changes with affected followers require confirmation and return exact follower count.
- [x] Version conflicts and invalid organization visibility leave data unchanged.
- [x] At least 12 update/delete cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): update lifecycle safely`

### T17: Follow and unfollow setlists

**What:** Implement authorized, idempotent follow/unfollow operations for readable published setlists.  
**Where:** `lib/setlists/setlist-service.*`  
**Depends on:** T16  
**Reuses:** T5 destination policy and T8 follow persistence.  
**Requirement:** SET-17, SET-18, SET-19  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover repeat follow/unfollow, own-team rejection, draft rejection and unreadable target rejection.
- [x] Only admins and destination-team leaders can act.
- [x] At least 8 follow cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): follow shared setlists`

### T18: Clone setlists through the service

**What:** Authorize clone destinations, load source catalog data, build the plan and apply it atomically.  
**Where:** `lib/setlists/setlist-service.*`  
**Depends on:** T17  
**Reuses:** T5 policy, T8 repository, T9 planner and `PrismaMusicRepository`.  
**Requirement:** SET-21, SET-22  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover team and organization destinations, draft/unreadable refusal and clone independence.
- [x] Cross-organization tests cover copied provenance, origin reuse and transaction rollback.
- [x] At least 10 clone-service cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): clone setlists atomically`

### Phase 4: HTTP API

### T19: Add setlist API errors and route dependencies

**What:** Centralize the setlist error envelope, failure mapping and real/test dependency factories.  
**Where:** `lib/setlists/setlist-api.*`  
**Depends on:** T18  
**Reuses:** `persistenceError`, `wrapPersistenceRoute`, `mapPersistenceFailure` and `getCurrentActor`.  
**Requirement:** SET-13, SET-23, SET-25  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover extras (`version`, `followerCount`, `issues`) and persistence failure mapping.
- [x] Actor resolution is available only through `getCurrentActor`.
- [x] At least 6 API-helper cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): add api error mapping`

### T20: Expose setlist list and create routes

**What:** Implement `GET` and `POST /api/setlists` with actor, tab/team and body handling.  
**Where:** `app/api/setlists/route.*`  
**Depends on:** T19  
**Reuses:** Exported handler-factory pattern from existing song routes.  
**Requirement:** SET-01, SET-02, SET-03, SET-14, SET-15, SET-25  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Route tests cover each tab, successful team/organization creation, invalid JSON and service errors.
- [x] Missing database returns `503 DATABASE_NOT_CONFIGURED`.
- [x] At least 10 route cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): add list and create api`

### T21: Expose setlist detail lifecycle routes

**What:** Implement `GET`, `PATCH` and `DELETE /api/setlists/{id}`.  
**Where:** `app/api/setlists/[setlistId]/route.*`  
**Depends on:** T20  
**Reuses:** T19 route dependencies and T13/T16 service operations.  
**Requirement:** SET-07, SET-08, SET-13, SET-20, SET-25  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover readable GET, indistinguishable 404s, updates, soft delete, malformed JSON and version conflict.
- [x] Follower-impact conflict includes `followerCount` and confirmation retries succeed.
- [x] At least 12 route cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): add detail lifecycle api`

### T22: Expose item replacement route

**What:** Implement `PUT /api/setlists/{id}/items`.  
**Where:** `app/api/setlists/[setlistId]/items/route.*`  
**Depends on:** T21  
**Reuses:** T6 parser and T15 service operation.  
**Requirement:** SET-04, SET-05, SET-06, SET-07, SET-25  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Route tests cover valid mixed items and every specified item/key/version error code.
- [x] Malformed JSON and database-unconfigured paths return the standard envelope.
- [x] At least 10 route cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): add item replacement api`

### T23: Expose follow routes

**What:** Implement idempotent `POST` and `DELETE /api/setlists/{id}/follow`.  
**Where:** `app/api/setlists/[setlistId]/follow/route.*`  
**Depends on:** T22  
**Reuses:** T6 follow parser and T17 service operations.  
**Requirement:** SET-17, SET-25  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Route tests cover repeated success, permission denial and every `CANNOT_FOLLOW` branch.
- [x] Both success methods return `204`.
- [x] At least 8 route cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): add follow api`

### T24: Expose clone route

**What:** Implement `POST /api/setlists/{id}/clone` for team and organization destinations.  
**Where:** `app/api/setlists/[setlistId]/clone/route.*`  
**Depends on:** T23  
**Reuses:** T6 clone parser and T18 service operation.  
**Requirement:** SET-21, SET-22, SET-25  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Route tests cover both destinations, `CANNOT_CLONE`, `FORBIDDEN`, malformed input and database failures.
- [x] Successful responses return `201` with the clone.
- [x] At least 8 route cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): add clone api`

### T25: Expose team list and create routes

**What:** Implement `GET` and `POST /api/teams`.  
**Where:** `app/api/teams/route.*`  
**Depends on:** T24  
**Reuses:** T12 team service and T19 persistence failure mapping.  
**Requirement:** GRP-02, GRP-03, SET-25  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Route tests cover listing, slug collision, invalid names, non-admin denial and missing database.
- [x] Successful creation returns `201`.
- [x] At least 8 route cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(groups): add team list and create api`

### T26: Expose team update route

**What:** Implement rename and archive through `PATCH /api/teams/{id}` without a delete method.  
**Where:** `app/api/teams/[teamId]/route.*`  
**Depends on:** T25  
**Reuses:** T12 team service and T19 API helpers.  
**Requirement:** GRP-02, GRP-03, GRP-04, SET-25  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Route tests cover rename, stable slug, archive, malformed input and non-admin denial.
- [x] The module exports no team deletion handler.
- [x] At least 7 route cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(groups): add team update api`

### Phase 5: User interface

### T27: Show admin-only groups navigation

**What:** Resolve the actor in the root layout and show the `/groups` link only to organization admins, falling back safely to anonymous.  
**Where:** `app/layout.*`  
**Depends on:** T26  
**Reuses:** `getCurrentActor` and existing header styles.  
**Requirement:** GRP-01, SET-23  
**Tools:** MCP: NONE; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover admin, non-admin, anonymous and actor-loading failure.
- [x] At least 4 layout cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(groups): show admin navigation`

### T28: Build worship-team management

**What:** Replace `/groups` with the restricted server page and client controls for create, rename and archive.  
**Where:** `app/groups/**/*`  
**Depends on:** T27  
**Reuses:** T12 service, T25/T26 APIs and design-system classes.  
**Requirement:** GRP-01, GRP-02, GRP-03, GRP-04  
**Tools:** MCP: `cursor-ide-browser` for UAT; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover active/archived sections, all three admin actions and restricted non-admin copy.
- [x] No delete action is rendered.
- [x] At least 8 page/component cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(groups): add team management page`

### T29: Build group-aware setlist navigation

**What:** Replace the placeholder `/setlists` page with selector, tabs, filtered cards and permitted create action.  
**Where:** `app/setlists/page.*`  
**Depends on:** T28  
**Reuses:** T12 selectable teams, T13 tab service and design-system classes.  
**Requirement:** SET-14, SET-15, SET-16, SET-19  
**Tools:** MCP: `cursor-ide-browser` for UAT; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover valid/invalid/archived team query, alphabetical options, all tabs and anonymous/no-team mode.
- [x] Followed unavailable entries expose only "Deixar de seguir".
- [x] At least 10 page cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): add group-aware listing`

### T30: Build setlist creation flow

**What:** Add `/setlists/new` and its form with only actor-permitted destinations and fields.  
**Where:** `app/setlists/new/**/*`  
**Depends on:** T29  
**Reuses:** T20 API, T12 selectable teams and existing form styles.  
**Requirement:** SET-01, SET-02, SET-03, SET-16  
**Tools:** MCP: `cursor-ide-browser` for UAT; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover leader/admin destinations, validation messages, successful redirect and forbidden organization destination.
- [x] At least 7 form/page cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): add creation flow`

### T31: Build setlist detail and sharing actions

**What:** Add the detail page with ordered items, imported-source disclosure, follow/clone actions and read-only permissions.  
**Where:** `app/setlists/[setlistId]/page.*`  
**Depends on:** T30  
**Reuses:** T13 readable view, T23/T24 APIs and existing imported badge styling.  
**Requirement:** SET-10, SET-11, SET-13, SET-17, SET-18, SET-21  
**Tools:** MCP: `cursor-ide-browser` for UAT; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover metadata, mixed/empty items, secure source link attributes and 404.
- [x] Read-only viewers never receive edit/reorder/status actions.
- [x] Follow and clone interactions cover success and service errors.
- [x] At least 10 page/component cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): add detail and sharing actions`

### T32: Build the setlist editor

**What:** Add item editing, chart selection, notes, reordering, selected keys, lifecycle actions and follower-impact confirmation.  
**Where:** `app/setlists/[setlistId]/edit/**/*`  
**Depends on:** T31  
**Reuses:** Song/chart APIs, T21/T22 APIs and design-system controls.  
**Requirement:** SET-04, SET-05, SET-06, SET-07, SET-08, SET-09, SET-20  
**Tools:** MCP: `cursor-ide-browser` for UAT; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests cover automatic single-chart selection and mandatory multi-chart selection.
- [x] Tests cover add/reorder/edit, publish/archive, version conflict and deletion.
- [x] Follower-impact UI shows the exact count and retries only after confirmation.
- [x] At least 14 editor cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): add setlist editor`

### T33: Build sequential play mode

**What:** Add `/setlists/{id}/play` with ordered items and context-rich song links.  
**Where:** `app/setlists/[setlistId]/play/page.*`  
**Depends on:** T32  
**Reuses:** `buildSetlistSongHref` and T13 readable view.  
**Requirement:** SET-10, SET-12, SET-13  
**Tools:** MCP: `cursor-ide-browser` for UAT; Skill: `tlc-spec-driven`  
**Done when:**
- [x] Tests assert order, note rendering, selected-key hrefs, empty copy and 404.
- [x] At least 6 play-page cases pass.
**Tests:** integration  
**Gate:** full  
**Commit:** `feat(setlists): add sequential play mode`

### T34: Add previous and next song navigation

**What:** Add setlist-aware neighboring-song links to song detail, skipping note items and respecting the first/last boundaries.  
**Where:** `app/songs/[songId]/song-detail.*`  
**Depends on:** T33  
**Reuses:** `parseSetlistSongContext`, `buildSetlistSongHref` and the existing uncommitted song-detail work after its tests are green.  
**Requirement:** SET-12  
**Tools:** MCP: `cursor-ide-browser` for UAT; Skill: `tlc-spec-driven`  
**Done when:**
- [x] The pre-existing song-detail test suite is green before this task starts.
- [x] Tests cover first, middle and last songs, skipped notes, invalid context and unreadable setlist.
- [x] At least 6 new navigation cases pass without deleting existing tests.
- [x] Build gate passes for the complete feature.
**Tests:** integration  
**Gate:** build  
**Commit:** `feat(setlists): navigate neighboring songs`

---

## Phase Execution Map

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1: T1 → T2 → T3 → T4 → T5 → T6
Phase 2: T7 → T8 → T9 → T10 → T11
Phase 3: T12 → T13 → T14 → T15 → T16 → T17 → T18
Phase 4: T19 → T20 → T21 → T22 → T23 → T24 → T25 → T26
Phase 5: T27 → T28 → T29 → T30 → T31 → T32 → T33 → T34
```

Execution is strictly sequential. The first task of each phase depends on the last task of the previous phase.

## Task Granularity Check

| Tasks | Scope | Status |
| --- | --- | --- |
| T1-T6 | One schema/type/helper/policy/parser concern each | ✅ Granular |
| T7-T11 | One persistence contract, repository or pure helper each | ✅ Granular |
| T12-T18 | One service capability each; repeated service-file edits are isolated by behavior | ✅ Granular |
| T19-T26 | One API infrastructure concern or route module each | ✅ Granular |
| T27-T34 | One navigational or page-level user surface each | ✅ Granular |

## Diagram-Definition Cross-Check

| Tasks | Depends On (task bodies) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Start at T1 | ✅ Match |
| T2-T6 | Immediately preceding task | T1→T2→T3→T4→T5→T6 | ✅ Match |
| T7-T11 | Immediately preceding task, with T7 after T6 | T6→T7→T8→T9→T10→T11 | ✅ Match |
| T12-T18 | Immediately preceding task, with T12 after T11 | T11→T12→T13→T14→T15→T16→T17→T18 | ✅ Match |
| T19-T26 | Immediately preceding task, with T19 after T18 | T18→T19→T20→T21→T22→T23→T24→T25→T26 | ✅ Match |
| T27-T34 | Immediately preceding task, with T27 after T26 | T26→T27→T28→T29→T30→T31→T32→T33→T34 | ✅ Match |

## Test Co-location Validation

| Tasks | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1-T3, T7 | Types/schema/migration/contract | none | none | ✅ OK |
| T4, T6, T9, T10 | Pure helpers/validation | unit | unit | ✅ OK |
| T5 | Access policy | unit | unit | ✅ OK |
| T8, T11 | Prisma repositories | integration | integration | ✅ OK |
| T12-T18 | Domain services | integration | integration | ✅ OK |
| T19-T26 | API helpers/routes | integration | integration | ✅ OK |
| T27-T34 | Server pages/React integrations | integration | integration | ✅ OK |

## Requirement Traceability (tasks)

| Requirement ID | Tasks | Phase |
| --- | --- | --- |
| SET-01 | T1-T3, T14, T20, T30 | 1-5 |
| SET-02 | T14, T20, T30 | 3-5 |
| SET-03 | T6, T14, T16, T20, T30 | 1, 3-5 |
| SET-04 | T1, T7, T8, T15, T22, T32 | 1-5 |
| SET-05 | T4, T6, T15, T22, T32 | 1, 3-5 |
| SET-06 | T6, T15, T22, T32 | 1, 3-5 |
| SET-07 | T6-T8, T15, T16, T21, T22, T32 | 1-5 |
| SET-08 | T16, T21, T32 | 3-5 |
| SET-09 | T32 | 5 |
| SET-10 | T1, T13, T31, T33 | 1, 3, 5 |
| SET-11 | T31 | 5 |
| SET-12 | T33, T34 | 5 |
| SET-13 | T13, T19, T21, T31, T33 | 3-5 |
| SET-14 | T11-T13, T20, T29 | 2-5 |
| SET-15 | T13, T20, T29 | 3-5 |
| SET-16 | T14, T29, T30 | 3, 5 |
| SET-17 | T2, T7, T8, T17, T23, T31 | 1-5 |
| SET-18 | T13, T17, T31 | 3, 5 |
| SET-19 | T1, T7, T8, T13, T17, T29 | 1-5 |
| SET-20 | T6, T16, T21, T32 | 1, 3-5 |
| SET-21 | T2, T6, T9, T18, T24, T31 | 1-5 |
| SET-22 | T2, T3, T7-T9, T18, T24 | 1-4 |
| SET-23 | T5, T19, T27 | 1, 4-5 |
| SET-24 | T5 | 1 |
| SET-25 | T19-T26 | 4 |
| GRP-01 | T12, T27, T28 | 3, 5 |
| GRP-02 | T12, T25, T26, T28 | 3-5 |
| GRP-03 | T10-T12, T25, T26, T28 | 2-5 |
| GRP-04 | T11, T12, T14, T26, T28 | 2-5 |

**Coverage:** 29 total, 29 mapped to tasks, 0 unmapped.
