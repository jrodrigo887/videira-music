# Escopo adiado — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/deferred-scope/design.md`
**Status**: In progress (lots 1–2 complete: T1–T21)

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: none - strong defaults applied. Commands come from `package.json` (`test`: `vitest run`, `lint`: `eslint app components lib types --ext .ts,.tsx`) and `vitest.config.ts` (`include`: `**/*.test.{ts,tsx}`). No coverage threshold. CI runs `npm test` (`.github/workflows/ci.yml`). Sampled tests: `lib/auth/capabilities.test.ts`, `lib/auth/permissions.test.ts`, `lib/setlists/setlist-policy.test.ts`, `lib/invites/invite-service.ts` via `app/api/invites/route.test.ts`, `app/api/charts/[chartId]/route.test.ts`, `app/groups/page.test.tsx`, `lib/public-lyrics/public-lyrics.test.ts`, `proxy.test.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain / policy / service | unit | All branches; 1:1 to the task's spec ACs and the edge cases named in that task | `lib/**/*.test.ts` next to the source | `npm test -- <file>` |
| Route | integration | Happy path plus every error status the task's ACs name | `app/api/**/*.test.ts` | `npm test` |
| Page / React | integration | The user-visible string and the hidden control from the task's ACs | `app/**/*.test.tsx`, `components/**/*.test.tsx` | `npm test` |
| Entity / schema | none | Build gate only | `prisma/schema.prisma` | `npm test && npm run lint` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After a unit task | `npm test -- <target listed in the task>` |
| Full | After a route or page task | `npm test` |
| Build | After a schema task or the last task of a phase | `npm test && npm run lint` |

---

## Execution Plan

Phases run in order. Tasks inside a phase run in order.

### Phase 1: Catálogo

```text
T2 -> T3
T2 -> T4
T1
```

### Phase 2: Ator e política de música

```text
T5 -> T6 -> T7
T5 -> T8
T9
```

### Phase 3: Convite do líder

```text
T10 -> T12 -> T13
T11 -> T12
```

### Phase 4: Lixeira

```text
T14 -> T15
T14 -> T16
T14 -> T21
T19 -> T20
T17
T18
```

### Phase 5: Autoria e histórico

```text
T22 -> T25
T22 -> T27 -> T28
T23 -> T24
T26
```

### Phase 6: Sugestão

```text
T29 -> T30 -> T31
```

### Phase 7: Link público

```text
T32 -> T36
T32 -> T35
T33 -> T34 -> T35
```

### Phase 8: Organização e Stripe

```text
T37 -> T38
T37 -> T40
T39 -> T40 -> T41
T40 -> T42
T43
```

### Phase 9: Delegação

```text
T44 -> T45
T46 -> T47
```

### Phase 10: Ver como

```text
T48 -> T49
T48 -> T50
T51
T52
```

---

## Task Breakdown

### Phase 1: Catálogo

### T1: Schema das tabelas novas ✅

**What**: Acrescenta colunas e tabelas do design em `Organization`, `Song`, `ChordChart`, `Setlist`, revisão, sugestão, link, delegação, prévia e evento Stripe.
**Where**: `prisma/schema.prisma`
**Depends on**: None
**Reuses**: O padrão `deletedAt` já usado em `Setlist`
**Requirement**: BIN-01, OWN-01, REV-01, SUG-01, SHR-01, ORG-04, PAY-04, DLG-01, SEE-04

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `Song.deletedAt` e `createdByUserId` existem e são opcionais
- [ ] `ChordChartRevision`, `ChartSuggestion`, `SetlistShareLink`, `CapabilityDelegation`, `ViewAsSession` e `BillingEvent` existem
- [ ] `Organization.subscriptionStatus` default é `none`
- [ ] A migração SQL gerada está em `prisma/migrations` e `npm run check:migrations` passa
- [ ] Gate check passes: `npm test && npm run lint`

**Tests**: none
**Gate**: build

**Commit**: `feat(deferred-scope): add tables for trash, history, share, billing, and access`

---

### T2: Presets das capacidades novas ✅

**What**: Publica `users:invite:led`, `music:delete`, `org:settings` e `users:impersonate` nos presets da spec.
**Where**: `lib/auth/capabilities.ts`
**Depends on**: None
**Reuses**: `systemCapabilities` e `capabilitiesMatchAdminPreset`
**Requirement**: LED-08, BIN-10, BIN-11, ORG-01, ORG-02, SEE-01, SEE-02

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `worship_leader` inclui `users:invite:led` e não inclui `users:invite`
- [ ] `manager` e `admin` incluem `music:delete`. `worship_leader` e `musician` não incluem
- [ ] Só `admin` inclui `org:settings` e `users:impersonate`
- [ ] `ADMIN_ONLY_CAPABILITIES` exporta essas duas
- [ ] Gate check passes: `npm test -- lib/auth/capabilities.test.ts`
- [ ] Test count: at least 4 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): add invite, delete, settings, and view-as capabilities`

---

### T3: Bloqueio de capacidade exclusiva do admin ✅

**What**: `createRole` e `updateRole` recusam `org:settings` e `users:impersonate` em papel personalizado.
**Where**: `lib/roles/role-service.ts`
**Depends on**: T2
**Reuses**: O ponto que já lança `ROLE_MATCHES_ADMIN`
**Requirement**: ORG-03, SEE-03

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Salvar papel personalizado com `org:settings` ou `users:impersonate` lança `409` `ROLE_CAPABILITY_FORBIDDEN` e não grava
- [ ] Papel personalizado com `music:delete` ou `users:invite:led` continua gravando
- [ ] Gate check passes: `npm test -- lib/roles/role-service.test.ts`
- [ ] Test count: at least 2 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): keep settings and view-as off custom roles`

---

### T4: can() cobre convite do líder e as capacidades novas ✅

**What**: `users:invite` satisfaz `users:invite:led`. As capacidades novas entram no `can`.
**Where**: `lib/auth/permissions.ts`
**Depends on**: T2
**Reuses**: `hasCapability`
**Requirement**: LED-09

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `can(actor, "users:invite:led")` é verdadeiro com `users:invite` ou com `users:invite:led`
- [ ] Sem as duas, é falso
- [ ] `can` reconhece `music:delete`, `org:settings` e `users:impersonate`
- [ ] Gate check passes: `npm test -- lib/auth/permissions.test.ts`
- [ ] Test count: at least 4 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): let org-wide invite satisfy leader invite`

---

### Phase 2: Ator e política de música

### T5: Campos de delegação e prévia no Actor ✅

**What**: O `Actor` carrega delegações ativas e, quando houver, quem está olhando.
**Where**: `lib/auth/actor.ts`
**Depends on**: None
**Reuses**: O tipo `UserActor` atual
**Requirement**: DLG-08, SEE-08

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `DelegationGrant` tem `capabilities`, `teamIds` e `expiresAt`
- [ ] `viewAs` é opcional e guarda `realUserId` e `expiresAt`
- [ ] `earliestDelegationExpiry` devolve o menor `expiresAt` ativo, ou `undefined`
- [ ] Gate check passes: `npm test -- lib/auth/actor.test.ts`
- [ ] Test count: at least 2 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): carry delegation and view-as on the actor`

---

### T6: Carregar delegações do usuário real ✅

**What**: `loadActorForUser` soma as delegações não revogadas e ainda no prazo.
**Where**: `lib/auth/load-actor.ts`
**Depends on**: T1, T5
**Reuses**: `unionCapabilities` só nos papéis. Delegação fica na lista, não entra no array de capacidades do papel
**Requirement**: DLG-08, DLG-09

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Delegação revogada ou vencida não aparece
- [ ] Delegação vigente aparece com os `teamIds`
- [ ] Gate check passes: `npm test -- lib/auth/load-actor.test.ts`
- [ ] Test count: at least 2 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): load active delegations onto the actor`

---

### T7: Trocar o ator quando a prévia está ativa ✅

**What**: `getCurrentActor` usa o alvo da prévia válida e descarta a delegação de quem olha.
**Where**: `lib/auth/current-actor.ts`
**Depends on**: T6
**Reuses**: `loadActorForUser`
**Requirement**: SEE-08, SEE-11, SEE-13

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Prévia válida devolve o ator do alvo com `viewAs.realUserId` de quem olha
- [ ] As delegações de quem olha não entram
- [ ] Prévia vencida grava `view_as.end`, encerra a linha e devolve o ator real
- [ ] Gate check passes: `npm test -- lib/auth/current-actor.test.ts`
- [ ] Test count: at least 3 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): resolve view-as inside getCurrentActor`

---

### T8: Resposta 403 da prévia ✅

**What**: Mutação com `viewAs` devolve `403` `VIEW_AS_READONLY`.
**Where**: `lib/auth/view-as-guard.ts`
**Depends on**: T5
**Reuses**: O formato `{ error: { code } }` de `lib/auth/api-guard.ts`
**Requirement**: SEE-09

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Com `viewAs`, a função devolve status `403` e código `VIEW_AS_READONLY`
- [ ] Sem `viewAs`, devolve `undefined`
- [ ] Gate check passes: `npm test -- lib/auth/view-as-guard.test.ts`
- [ ] Test count: at least 2 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): reject mutations during view-as`

---

### T9: Política de editar e excluir música ✅

**What**: Separa autor, `music:write`, `publicLyrics` e `music:delete`.
**Where**: `lib/songs/song-policy.ts`
**Depends on**: T2
**Reuses**: `hasCapability`
**Requirement**: OWN-03, OWN-04, OWN-05, BIN-02

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Autor na mesma igreja edita conteúdo sem `music:write`
- [ ] Quem não é autor e não tem `music:write` não edita
- [ ] `publicLyrics` exige `music:write`
- [ ] `canDeleteSong` exige `music:delete`
- [ ] Música com `deletedAt` não é editável
- [ ] Gate check passes: `npm test -- lib/songs/song-policy.test.ts`
- [ ] Test count: at least 5 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): decide song edit and delete by policy`

---

### Phase 3: Convite do líder

### T10: Ramo do líder em createInvite ✅

**What**: Quem só tem `users:invite:led` convida `musician` para grupos que lidera. Quem tem `users:invite` segue a regra atual.
**Where**: `lib/invites/invite-service.ts`
**Depends on**: T4
**Reuses**: `teamRoleOf`, `USER_EXISTS`, `INVALID_REQUEST`
**Requirement**: LED-01, LED-02, LED-03, LED-04, LED-05, LED-10, LED-11

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Líder com grupos certos, papel `musician` e e-mail novo recebe o convite e a auditoria `invite.create`
- [ ] Lista vazia, grupo de outro, arquivado ou papel diferente responde `403` `FORBIDDEN` e não cria convite
- [ ] E-mail sem `@` responde `400` `INVALID_REQUEST`. E-mail de membro ativo responde `409` `USER_EXISTS`
- [ ] Gestor com `users:invite` ainda convida grupo que não lidera
- [ ] Gate check passes: `npm test -- lib/invites/invite-service.test.ts`
- [ ] Test count: at least 7 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): let a team leader invite musicians`

---

### T11: Lista de grupos do líder ✅

**What**: `/groups` sem `teams:manage` lista só os grupos em que o ator é líder.
**Where**: `app/groups/page.tsx`
**Depends on**: T2
**Reuses**: `TeamManager` para quem tem `teams:manage`
**Requirement**: LED-07

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Gestor com `teams:manage` continua vendo o gerenciador
- [ ] Líder sem `teams:manage` vê link só para os grupos que lidera
- [ ] Músico sem liderança não vê grupo de outro
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 3 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): list led teams on the groups page`

---

### T12: Página do grupo com o convite ✅

**What**: `/groups/{teamId}` mostra o formulário só para o líder daquele grupo.
**Where**: `app/groups/[teamId]/page.tsx`
**Depends on**: T10, T11
**Reuses**: `teamRoleOf`
**Requirement**: LED-06, LED-07

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Líder do grupo vê o formulário com o grupo fixo e sem seletor de papel
- [ ] Membro que não lidera o grupo não vê o formulário
- [ ] Quem não é do grupo recebe `404`
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 3 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): add the team page for leader invites`

---

### T13: Formulário que envia o convite de músico ✅

**What**: O formulário posta e-mail, `roles: ["musician"]` e o `teamId` da página.
**Where**: `components/groups/team-invite-form.tsx`
**Depends on**: T12
**Reuses**: `POST /api/invites`
**Requirement**: LED-06

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] O submit manda só o e-mail digitado, papel `musician` e o grupo da página
- [ ] Não há campo de papel
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 1 test passes

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): submit a musician invite from the team page`

---

### Phase 4: Lixeira

### T14: Serviço de excluir e restaurar música ✅

**What**: Preenche e limpa `deletedAt`, com auditoria, sem apagar a linha.
**Where**: `lib/songs/song-trash-service.ts`
**Depends on**: T1, T9
**Reuses**: `authAuditLog.create`
**Requirement**: BIN-01, BIN-03, BIN-04, BIN-05, BIN-12

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `deleteSong` preenche `deletedAt`, mantém a linha e audita `song.delete` com o `songId`
- [ ] `restoreSong` limpa `deletedAt` e audita `song.restore`
- [ ] Restore sem `deletedAt` é `409` `SONG_NOT_DELETED`
- [ ] Id de outra igreja ou inexistente é `404` `NOT_FOUND`
- [ ] Segundo delete é `404` `NOT_FOUND`
- [ ] Gate check passes: `npm test -- lib/songs/song-trash-service.test.ts`
- [ ] Test count: at least 5 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): soft-delete and restore songs`

---

### T15: DELETE da música ✅

**What**: `DELETE /api/songs/{songId}` chama o serviço e recusa quem não tem `music:delete`.
**Where**: `app/api/songs/[songId]/route.ts`
**Depends on**: T14
**Reuses**: `wrapPersistenceRoute`
**Requirement**: BIN-01, BIN-02

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Com `music:delete`, a resposta é `200` e a música fica com `deletedAt`
- [ ] Sem `music:delete`, a resposta é `403` `FORBIDDEN`
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): expose song delete on the song route`

---

### T16: POST de restaurar ✅

**What**: `POST /api/songs/{songId}/restore` restaura ou responde o erro do serviço.
**Where**: `app/api/songs/[songId]/restore/route.ts`
**Depends on**: T14
**Reuses**: `restoreSong`
**Requirement**: BIN-03, BIN-04, BIN-05

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Música na lixeira volta com `200`
- [ ] Música fora da lixeira responde `409` `SONG_NOT_DELETED`
- [ ] Id desconhecido responde `404` `NOT_FOUND`
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 3 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): restore a trashed song`

---

### T17: Biblioteca esconde música excluída ✅

**What**: A listagem e a leitura da biblioteca ignoram `deletedAt`.
**Where**: `lib/persistence/prisma-music-repository.ts`
**Depends on**: T1
**Reuses**: `listSongs` e `findSongById`
**Requirement**: BIN-06

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `listSongs` e `findSongById` não devolvem música com `deletedAt`
- [ ] A busca usada pelo restore ainda acha a música excluída
- [ ] Gate check passes: `npm test -- lib/persistence/prisma-music-repository.test.ts`
- [ ] Test count: at least 2 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): hide trashed songs from the library`

---

### T18: Letras públicas escondem música excluída ✅

**What**: O catálogo anônimo de letras ignora música na lixeira.
**Where**: `lib/public-lyrics/public-lyrics.ts`
**Depends on**: T1
**Reuses**: `listPublicSongs`
**Requirement**: BIN-06

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Música com `publicLyrics` e `deletedAt` não entra em `listPublicSongs` nem em `getPublicLyrics`
- [ ] Gate check passes: `npm test -- lib/public-lyrics/public-lyrics.test.ts`
- [ ] Test count: at least 1 test passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): hide trashed songs from public lyrics`

---

### T19: Item de setlist traz deletedAt da música ✅

**What**: A query do item passa a selecionar `song.deletedAt`.
**Where**: `lib/setlists/prisma-setlist-repository.ts`
**Depends on**: T1
**Reuses**: `setlistInclude`
**Requirement**: BIN-07

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] O item mapeado expõe `songDeletedAt` nulo ou preenchido
- [ ] Gate check passes: `npm test -- lib/setlists/prisma-setlist-repository.test.ts`
- [ ] Test count: at least 1 test passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): load song deletedAt on setlist items`

---

### T20: Setlist marca música indisponível e o clone não a copia ✅

**What**: Item com música excluída sai sem letra. Clone não leva essa música para o outro catálogo.
**Where**: `lib/setlists/setlist-service.ts`
**Depends on**: T19
**Reuses**: O mapeamento de item que já existe
**Requirement**: BIN-07

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Item com `songDeletedAt` sai `{ unavailable: true, title }` sem seções
- [ ] Clone de setlist não cria música de origem que está na lixeira
- [ ] Gate check passes: `npm test -- lib/setlists/setlist-service.test.ts`
- [ ] Test count: at least 2 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): mark trashed songs unavailable in setlists`

---

### T21: Página da lixeira ✅

**What**: `/musicas/lixeira` lista as músicas excluídas e restaura. Sem capacidade, mostra sem acesso.
**Where**: `app/musicas/lixeira/page.tsx`
**Depends on**: T14
**Reuses**: O texto “Você não tem acesso a esta área.”
**Requirement**: BIN-08, BIN-09

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Quem tem `music:delete` vê as músicas excluídas e o botão “Restaurar”
- [ ] Quem não tem responde `403` e vê “Você não tem acesso a esta área.”
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): add the song trash page`

---

### Phase 5: Autoria e histórico

### T22: Gravar revisão antes de sobrescrever a cifra

**What**: `saveChartWithHistory` copia o estado anterior, grava o autor na criação e atualiza `lastEditedByUserId`.
**Where**: `lib/charts/chart-history-service.ts`
**Depends on**: T1, T9
**Reuses**: `PrismaMusicRepository.saveChart`
**Requirement**: OWN-01, REV-01, REV-02, REV-03, REV-06

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Criação grava `createdByUserId` e não cria revisão
- [ ] Update grava revisão com source, sections, key, capo e o `lastEditedByUserId` anterior
- [ ] Restore copia a revisão para a cifra, cria revisão nova e mantém a linha escolhida
- [ ] Nenhuma função deste arquivo apaga revisão
- [ ] Gate check passes: `npm test -- lib/charts/chart-history-service.test.ts`
- [ ] Test count: at least 4 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): keep a revision before each chart save`

---

### T23: Autor edita o setlist que criou

**What**: `canEditSetlist` aceita o autor para conteúdo e continua negando o resto a quem não tem capacidade.
**Where**: `lib/setlists/setlist-policy.ts`
**Depends on**: T2
**Reuses**: `canEditSetlist`
**Requirement**: OWN-08, OWN-09, OWN-10, OWN-11

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Autor na mesma igreja, setlist sem `deletedAt`, edita mesmo sem `setlists:led` e sem `setlists:all`
- [ ] `createdByUserId` null não libera edição
- [ ] Autor de outra igreja não edita
- [ ] `delete` e `changeStatus` continuam exigindo a capacidade
- [ ] Gate check passes: `npm test -- lib/setlists/setlist-policy.test.ts`
- [ ] Test count: at least 4 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): let a setlist author edit their own setlist`

---

### T24: Setlist grava o autor e recusa meta fora do conteúdo

**What**: Criar setlist grava `createdByUserId`. Patch de autor sem capacidade só aceita título, notas e itens.
**Where**: `lib/setlists/setlist-service.ts`
**Depends on**: T23
**Reuses**: O `update` que já responde `204`
**Requirement**: OWN-01, OWN-08, OWN-09

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Setlist novo fica com `createdByUserId` do ator
- [ ] Autor sem capacidade altera título, notas ou itens e recebe `204`
- [ ] O mesmo autor, ao mudar visibilidade, status, dono ou exclusão, recebe `403` `FORBIDDEN` e esses campos ficam
- [ ] Gate check passes: `npm test -- lib/setlists/setlist-service.test.ts`
- [ ] Test count: at least 3 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): store setlist authorship and limit author edits`

---

### T25: PUT da cifra usa a política e o histórico

**What**: O `PUT` deixa de exigir `music:write` na porta. Autor salva conteúdo. Origem nova segue o gate.
**Where**: `app/api/charts/[chartId]/route.ts`
**Depends on**: T22
**Reuses**: `chartOriginGateKind` e `saveChartWithHistory`
**Requirement**: OWN-03, OWN-04, OWN-06, OWN-07

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Autor sem `music:write` recebe `204` ao mudar source, sections, key e capo
- [ ] Quem não é autor e não tem `music:write` recebe `403` `FORBIDDEN`
- [ ] Origem nova com flag desligada responde `404` `NOT_FOUND`
- [ ] Origem nova com flag ligada e sem `import` responde `401` `IMPORT_LOCKED`
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 4 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): allow the chart author to save content`

---

### T26: PUT da música separa conteúdo e visibilidade

**What**: Autor edita metadados de conteúdo. `publicLyrics` sem `music:write` é recusado.
**Where**: `app/api/songs/[songId]/route.ts`
**Depends on**: T9
**Reuses**: `canEditSongContent` e `canChangePublicLyrics`
**Requirement**: OWN-01, OWN-05, OWN-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Criação de música grava `createdByUserId`
- [ ] Autor sem `music:write` altera título, artista, gênero, notas e tom
- [ ] Autor sem `music:write` que muda `publicLyrics` recebe `403` `PUBLIC_LYRICS_FORBIDDEN` e o valor gravado fica
- [ ] Linha com `createdByUserId` null e ator sem `music:write` recebe `403` `FORBIDDEN`
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 4 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): let the song author edit content fields`

---

### T27: Rotas de listar e restaurar revisão

**What**: `GET` e restore de revisão exigem quem pode editar a cifra.
**Where**: `app/api/charts/[chartId]/revisions/route.ts`
**Depends on**: T22
**Reuses**: `listRevisions` e `restoreRevision`
**Requirement**: REV-03, REV-04, REV-05

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Quem pode editar recebe a lista da mais nova para a mais antiga, com `savedAt`
- [ ] Quem não pode editar recebe `403` `FORBIDDEN` no GET e no restore
- [ ] Restore devolve o conteúdo da revisão escolhida
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 3 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): list and restore chart revisions`

---

### T28: Painel de histórico na página da música

**What**: Quem edita vê as revisões. Sem revisão, vê o texto vazio.
**Where**: `components/songs/chart-history-panel.tsx`
**Depends on**: T27
**Reuses**: A página da música em `app/songs/[songId]`
**Requirement**: REV-05, REV-07

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] A lista mostra as revisões da mais nova para a mais antiga
- [ ] Sem revisão, o texto é “Nenhuma versão anterior.”
- [ ] Quem não pode editar não vê o painel
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): show chart history on the song page`

---

### Phase 6: Sugestão

### T29: Fila de sugestão

**What**: Membro envia uma pendente por cifra. `music:write` aprova pelo histórico ou rejeita sem mexer na cifra.
**Where**: `lib/charts/chart-suggestion-service.ts`
**Depends on**: T22
**Reuses**: `saveChartWithHistory` e o teto de 500 KiB
**Requirement**: SUG-01, SUG-02, SUG-03, SUG-04, SUG-06, SUG-07, SUG-08, SUG-09, SUG-10, SUG-13

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Primeiro envio válido responde criação `pending`. O segundo do mesmo autor substitui e continua `pending`
- [ ] Source vazio e source acima de 500 KiB UTF-8 não gravam
- [ ] Enviar sugestão não muda source, sections, key nem capo da cifra
- [ ] Aprovar grava a cifra, cria revisão e marca `approved` com revisor e data
- [ ] Rejeitar marca `rejected` e não muda a cifra
- [ ] Aprovar ou rejeitar fora de `pending` é `409` `SUGGESTION_NOT_PENDING`
- [ ] Sem `music:write`, aprovar ou rejeitar é `403` `FORBIDDEN`
- [ ] Música na lixeira ou cifra ausente é `404` `NOT_FOUND`
- [ ] Gate check passes: `npm test -- lib/charts/chart-suggestion-service.test.ts`
- [ ] Test count: at least 8 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): queue a chart suggestion until approval`

---

### T30: Rotas da sugestão

**What**: POST envia. POST de aprovar e rejeitar exigem `music:write`. Sem sessão, `401`.
**Where**: `app/api/charts/[chartId]/suggestions/route.ts`
**Depends on**: T29
**Reuses**: `requireActor`
**Requirement**: SUG-01, SUG-04, SUG-05, SUG-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Primeiro POST responde `201`. O segundo do mesmo autor responde `200`
- [ ] Sem sessão, responde `401` `UNAUTHENTICATED`
- [ ] Aprovar e rejeitar sem `music:write` respondem `403` `FORBIDDEN`
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 4 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): add chart suggestion routes`

---

### T31: Painel de sugerir e a fila

**What**: Quem não edita vê “Sugerir correção”. Quem tem `music:write` vê as pendentes.
**Where**: `components/songs/chart-suggestion-panel.tsx`
**Depends on**: T30
**Reuses**: A página da música
**Requirement**: SUG-02, SUG-03, SUG-11, SUG-12

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Sem `music:write`, o botão “Sugerir correção” aparece e a fila dos outros não
- [ ] Com `music:write`, as pendentes da cifra aparecem
- [ ] Texto vazio mostra “Informe o texto da cifra.”
- [ ] Texto acima de 500 KiB mostra “O texto deve ter no máximo 500 KiB.”
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 4 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): show chart suggestions on the song page`

---

### Phase 7: Link público

### T32: Criar, revogar e ler o link

**What**: Token opaco de setlist publicado. A leitura devolve letras, sem passar por `canPerform("read")`.
**Where**: `lib/setlists/share-link-service.ts`
**Depends on**: T1
**Reuses**: `generateInviteCode`, `hashInviteCode`, `toPublicLyrics`, `canPerform` só na criação
**Requirement**: SHR-01, SHR-02, SHR-03, SHR-04, SHR-05, SHR-07, SHR-08, SHR-09, SHR-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Setlist `published` devolve o código uma vez e guarda só o hash
- [ ] Draft, archived ou `deletedAt` na criação é `409` `SETLIST_NOT_SHAREABLE`
- [ ] Quem não edita o setlist recebe `403` ao criar e ao revogar
- [ ] Leitura ativa devolve as músicas na ordem, linha só com texto, sem campo `chords`
- [ ] Código ruim, revogado, setlist fora de `published` ou excluído não devolve setlist
- [ ] `imported.originUrl` sai quando há origin e originUrl
- [ ] Música na lixeira sai com título e sem letra
- [ ] `publicLyrics` falso não tira a música do link
- [ ] Revogar um código não invalida o outro
- [ ] Gate check passes: `npm test -- lib/setlists/share-link-service.test.ts`
- [ ] Test count: at least 9 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): share a published setlist as lyrics`

---

### T33: Limite de código inválido

**What**: Dez códigos ruins por IP em 15 minutos. O décimo primeiro satura.
**Where**: `lib/setlists/share-rate-limit.ts`
**Depends on**: None
**Reuses**: `createFailureRateLimiter`
**Requirement**: SHR-06

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] A instância é separada da do convite
- [ ] A 11ª falha no mesmo IP em 15 minutos pede bloqueio
- [ ] Gate check passes: `npm test -- lib/setlists/share-rate-limit.test.ts`
- [ ] Test count: at least 2 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): rate-limit invalid setlist share codes`

---

### T34: Liberar /s/ no proxy

**What**: `/s/` entra nas rotas públicas e aplica o limitador antes do login.
**Where**: `proxy.ts`
**Depends on**: T33
**Reuses**: O bloco que já limita `/convite/`
**Requirement**: SHR-06, SHR-11

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `/s/{code}` não redireciona para `/entrar`
- [ ] A 11ª falha do mesmo IP responde `429`
- [ ] `/api/billing/webhook` também passa sem sessão
- [ ] Gate check passes: `npm test -- proxy.test.ts`
- [ ] Test count: at least 3 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): allow the public setlist path through the proxy`

---

### T35: Página pública do setlist

**What**: `/s/{code}` renderiza letras, selo Importada, ou 404.
**Where**: `app/s/[code]/page.tsx`
**Depends on**: T32, T34
**Reuses**: `readSharedLyrics`
**Requirement**: SHR-04, SHR-05, SHR-08, SHR-12

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Código válido mostra as letras na ordem e nenhum acorde no HTML
- [ ] Item importado mostra “Importada” e o link da fonte
- [ ] Música na lixeira mostra o título e “Música indisponível”
- [ ] Código inválido responde `404`
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 4 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): render the public setlist lyrics page`

---

### T36: Rotas de criar e revogar o link

**What**: Quem edita o setlist cria e revoga o link.
**Where**: `app/api/setlists/[setlistId]/share/route.ts`
**Depends on**: T32
**Reuses**: `createShareLink` e `revokeShareLink`
**Requirement**: SHR-01, SHR-02, SHR-03

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Criação de setlist publicado responde `201` com o código
- [ ] Setlist que não pode ser compartilhado responde `409` `SETLIST_NOT_SHAREABLE`
- [ ] Quem não edita recebe `403` `FORBIDDEN`
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 3 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): add setlist share link routes`

---

### Phase 8: Organização e Stripe

### T37: Atualizar o nome da igreja

**What**: Admin com `org:settings` grava o nome, de 1 a 80 caracteres, e o slug fica.
**Where**: `lib/organization/organization-service.ts`
**Depends on**: T1, T4
**Reuses**: `can` para `org:settings`
**Requirement**: ORG-04, ORG-05

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Nome com 1 a 80 caracteres depois do trim grava e o slug não muda
- [ ] Vazio ou acima de 80 responde `400` `INVALID_REQUEST` e o nome anterior fica
- [ ] Sem `org:settings` responde `403` `FORBIDDEN`
- [ ] Gate check passes: `npm test -- lib/organization/organization-service.test.ts`
- [ ] Test count: at least 3 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): update the organization name`

---

### T38: Rota do nome

**What**: `PUT /api/organization` chama o serviço.
**Where**: `app/api/organization/route.ts`
**Depends on**: T37
**Reuses**: `updateOrganizationName`
**Requirement**: ORG-04, ORG-05

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Nome válido responde `200`
- [ ] Nome inválido responde `400` `INVALID_REQUEST`
- [ ] Sem capacidade responde `403` `FORBIDDEN`
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 3 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): add the organization name route`

---

### T39: Mapear status da Stripe

**What**: `active` e `past_due` passam. Qualquer outro status vira `canceled`.
**Where**: `lib/billing/map-subscription-status.ts`
**Depends on**: None
**Reuses**: Nada
**Requirement**: PAY-05, PAY-13

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `active` e `past_due` devolvem o mesmo valor
- [ ] `unpaid`, `canceled`, `trialing` e string desconhecida devolvem `canceled`
- [ ] Gate check passes: `npm test -- lib/billing/map-subscription-status.test.ts`
- [ ] Test count: at least 2 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): map Stripe subscription status`

---

### T40: Checkout e portal

**What**: Cria o customer se faltar, devolve a URL do Checkout ou do portal, e traduz falha da Stripe.
**Where**: `lib/billing/billing-service.ts`
**Depends on**: T37, T39
**Reuses**: O nome da organização já gravado
**Requirement**: PAY-01, PAY-02, PAY-08, PAY-12

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Com as três variáveis de env, checkout devolve a URL e grava `stripeCustomerId` se ainda não havia
- [ ] Portal devolve a URL do Customer Portal usando o customer gravado
- [ ] Env ausente responde `503` `BILLING_NOT_CONFIGURED`
- [ ] Falha da chamada Stripe responde `502` `BILLING_UNAVAILABLE` e não altera status nem data
- [ ] Checkout não envia `trial_period_days`
- [ ] Gate check passes: `npm test -- lib/billing/billing-service.test.ts`
- [ ] Test count: at least 4 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): start Stripe checkout and the customer portal`

---

### T41: Webhook da Stripe

**What**: Valida a assinatura no corpo cru, aplica o status uma vez e ignora customer desconhecido.
**Where**: `app/api/billing/webhook/route.ts`
**Depends on**: T40
**Reuses**: `mapSubscriptionStatus` e `BillingEvent`
**Requirement**: PAY-03, PAY-04, PAY-06, PAY-07

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Assinatura inválida responde `400` e não grava
- [ ] `customer.subscription.updated` com `active` ou `past_due` grava status e `currentPeriodEnd` lido de `items.data[0].current_period_end`
- [ ] O mesmo event id na segunda vez responde `200` e não muda os campos
- [ ] Customer sem organização responde `200` e não grava
- [ ] A rota lê `request.text()` antes de interpretar JSON
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 4 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): apply Stripe subscription webhooks once`

---

### T42: Página da organização

**What**: Admin edita o nome, vê o estado da assinatura e o banner de atraso. Os outros veem sem acesso.
**Where**: `app/organizacao/page.tsx`
**Depends on**: T40
**Reuses**: `updateOrganizationName` via a rota
**Requirement**: ORG-06, PAY-09, PAY-10, PAY-11

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Sem `org:settings`, a página responde `403` e mostra “Você não tem acesso a esta área.”
- [ ] `past_due` mostra “Pagamento em atraso.” só nesta página
- [ ] `none` e `canceled` mostram “Sem assinatura” e o botão de checkout
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 3 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): add the organization settings page`

---

### T43: Link da organização na navegação

**What**: O link aparece só para quem tem `org:settings`.
**Where**: `app/layout.tsx`
**Depends on**: T2
**Reuses**: O jeito de `usersLinkVisible`
**Requirement**: ORG-07

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Com `org:settings`, a navegação mostra o link de `/organizacao`
- [ ] Sem a capacidade, o link não aparece
- [ ] O banner de atraso não entra neste layout
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): show the organization link to admins`

---

### Phase 9: Delegação

### T44: Criar e revogar delegação

**What**: Empresta um subconjunto com prazo de até 90 dias e teto de capacidades.
**Where**: `lib/auth/delegation-service.ts`
**Depends on**: T1, T4, T5
**Reuses**: `teamRoleOf` e `authAuditLog`
**Requirement**: DLG-01, DLG-02, DLG-03, DLG-04, DLG-05, DLG-06, DLG-07, DLG-11

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Subconjunto que o concedente tem, para outra pessoa, com fim em até 90 dias, responde `201` e audita `delegation.create`
- [ ] Prazo ausente, no passado ou acima de 90 dias é `400` `INVALID_EXPIRY`
- [ ] Capacidade que o concedente não tem é `403` `FORBIDDEN`
- [ ] `org:settings`, `users:impersonate` ou `users:manage` é `400` `DELEGATION_CAPABILITY_FORBIDDEN`
- [ ] Delegar para si é `400` `INVALID_REQUEST`
- [ ] Quem só tem `setlists:led` precisa de grupos que lidera. Lista vazia ou grupo alheio é `403`
- [ ] Revogar audita `delegation.revoke`
- [ ] Gate check passes: `npm test -- lib/auth/delegation-service.test.ts`
- [ ] Test count: at least 7 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): delegate a bounded set of capabilities`

---

### T45: Rotas da delegação

**What**: POST cria e DELETE revoga.
**Where**: `app/api/delegations/route.ts`
**Depends on**: T44
**Reuses**: `createDelegation` e `revokeDelegation`
**Requirement**: DLG-01, DLG-11

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] POST válido responde `201`
- [ ] DELETE do concedente responde `200` e a delegação fica revogada
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): add delegation routes`

---

### T46: Banner da data de delegação

**What**: Mostra “Acesso delegado até {DD/MM/AAAA}.” com o menor prazo, em `America/Sao_Paulo`.
**Where**: `components/layout/delegation-banner.tsx`
**Depends on**: T5
**Reuses**: `earliestDelegationExpiry`
**Requirement**: DLG-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Com delegação ativa, o texto usa a data do menor `expiresAt` no formato `DD/MM/AAAA`
- [ ] Sem delegação, o componente não renderiza texto
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): show the delegation expiry banner`

---

### T47: Encaixar o banner no layout

**What**: O layout mostra o banner quando o ator tem delegação ativa.
**Where**: `app/layout.tsx`
**Depends on**: T46
**Reuses**: `delegation-banner.tsx`
**Requirement**: DLG-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Ator com delegação ativa vê o banner
- [ ] Ator sem delegação não vê o banner
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): mount the delegation banner in the layout`

---

### Phase 10: Ver como

### T48: Abrir e encerrar a prévia

**What**: Admin abre 30 minutos de leitura sobre um não-admin e não cria `AuthSession`.
**Where**: `lib/auth/view-as-service.ts`
**Depends on**: T1, T4, T7
**Reuses**: `loadActorForUser` e `authAuditLog`
**Requirement**: SEE-04, SEE-05, SEE-06, SEE-07, SEE-11, SEE-12

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Alvo da mesma igreja, sem papel admin, motivo de 1 a 200 caracteres, abre prévia de 30 minutos, audita `view_as.start` e não cria `AuthSession`
- [ ] Motivo vazio ou acima de 200 é `400` `INVALID_REQUEST`
- [ ] Alvo admin ou o próprio ator é `403` `FORBIDDEN`
- [ ] Alvo de outra igreja ou inexistente é `404` `NOT_FOUND`
- [ ] `endViewAs` audita `view_as.end`
- [ ] Gate check passes: `npm test -- lib/auth/view-as-service.test.ts`
- [ ] Test count: at least 5 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): start a read-only view-as session`

---

### T49: Rotas de entrar e sair da prévia

**What**: POST inicia. DELETE sai, e o DELETE não passa pela trava de mutação.
**Where**: `app/api/view-as/route.ts`
**Depends on**: T48
**Reuses**: `startViewAs` e `endViewAs`
**Requirement**: SEE-04, SEE-11

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] POST válido responde `201`
- [ ] DELETE de quem está na prévia responde `200`, volta o ator real e audita `view_as.end`
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): add view-as start and exit routes`

---

### T50: Banner de ver como

**What**: Enquanto a prévia dura, mostra “Você está vendo como {nome}.” e o botão “Sair”.
**Where**: `components/layout/view-as-banner.tsx`
**Depends on**: T48
**Reuses**: O `viewAs` do ator
**Requirement**: SEE-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Com prévia, o texto traz o nome do alvo e o botão “Sair”
- [ ] Sem prévia, o componente não renderiza o banner
- [ ] Gate check passes: `npm test`
- [ ] Test count: at least 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(deferred-scope): show the view-as banner`

---

### T51: Travar mutação nas rotas de persistência

**What**: `wrapPersistenceRoute` recusa método que não é GET quando há prévia.
**Where**: `lib/persistence/persistence-api.ts`
**Depends on**: T8
**Reuses**: `viewAsMutationResponse`
**Requirement**: SEE-09

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] PUT, POST e DELETE com `viewAs` respondem `403` `VIEW_AS_READONLY` antes do handler
- [ ] GET com prévia segue para o handler
- [ ] Gate check passes: `npm test -- lib/persistence/persistence-api.test.ts`
- [ ] Test count: at least 2 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): block persistence writes during view-as`

---

### T52: Travar mutação no serviço de setlist

**What**: Escrita de setlist recusa a prévia com o mesmo código.
**Where**: `lib/setlists/setlist-service.ts`
**Depends on**: T8
**Reuses**: `viewAsMutationResponse`
**Requirement**: SEE-09

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Criar, editar, mudar status, excluir, seguir e clonar com `viewAs` respondem `403` `VIEW_AS_READONLY`
- [ ] Leitura com `viewAs` não entra nessa trava
- [ ] Gate check passes: `npm test -- lib/setlists/setlist-service.test.ts`
- [ ] Test count: at least 2 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(deferred-scope): block setlist writes during view-as`

---

## Phase Execution Map

```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6 -> Phase 7 -> Phase 8 -> Phase 9 -> Phase 10

Phase 1:  T2 -> T3
          T2 -> T4
          T1
Phase 2:  T5 -> T6 -> T7
          T5 -> T8
          T9
Phase 3:  T10 -> T12 -> T13
          T11 -> T12
Phase 4:  T14 -> T15
          T14 -> T16
          T14 -> T21
          T19 -> T20
          T17
          T18
Phase 5:  T22 -> T25
          T22 -> T27 -> T28
          T23 -> T24
          T26
Phase 6:  T29 -> T30 -> T31
Phase 7:  T32 -> T36
          T32 -> T35
          T33 -> T34 -> T35
Phase 8:  T37 -> T38
          T37 -> T40
          T39 -> T40 -> T41
          T40 -> T42
          T43
Phase 9:  T44 -> T45
          T46 -> T47
Phase 10: T48 -> T49
          T48 -> T50
          T51
          T52
```

São 52 tasks. Na execução, as fases entram em lotes de cerca de 7 tasks, fase inteira, uma leva depois da outra. Mais de um lote pede confirmação antes de delegar.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 schema | ✅ Granular |
| T2 | 1 módulo de capacidades | ✅ Granular |
| T3 | 1 serviço de papel | ✅ Granular |
| T4 | 1 função `can` | ✅ Granular |
| T5 | 1 tipo de ator | ✅ Granular |
| T6 | 1 carregamento de delegação | ✅ Granular |
| T7 | 1 resolução de prévia | ✅ Granular |
| T8 | 1 função de resposta | ✅ Granular |
| T9 | 1 política | ✅ Granular |
| T10 | 1 ramo de `createInvite` | ✅ Granular |
| T11 | 1 página de lista | ✅ Granular |
| T12 | 1 página de grupo | ✅ Granular |
| T13 | 1 formulário | ✅ Granular |
| T14 | 1 serviço de lixeira | ✅ Granular |
| T15 | 1 rota DELETE | ✅ Granular |
| T16 | 1 rota POST | ✅ Granular |
| T17 | 1 repositório de música | ✅ Granular |
| T18 | 1 módulo de letras | ✅ Granular |
| T19 | 1 repositório de setlist | ✅ Granular |
| T20 | 1 serviço de setlist | ✅ Granular |
| T21 | 1 página | ✅ Granular |
| T22 | 1 serviço de histórico | ✅ Granular |
| T23 | 1 política de setlist | ✅ Granular |
| T24 | 1 serviço de setlist | ✅ Granular |
| T25 | 1 rota PUT | ✅ Granular |
| T26 | 1 rota PUT | ✅ Granular |
| T27 | 1 rota de revisão | ✅ Granular |
| T28 | 1 painel | ✅ Granular |
| T29 | 1 serviço de sugestão | ✅ Granular |
| T30 | 1 rota | ✅ Granular |
| T31 | 1 painel | ✅ Granular |
| T32 | 1 serviço de link | ✅ Granular |
| T33 | 1 limitador | ✅ Granular |
| T34 | 1 proxy | ✅ Granular |
| T35 | 1 página | ✅ Granular |
| T36 | 1 rota | ✅ Granular |
| T37 | 1 serviço de organização | ✅ Granular |
| T38 | 1 rota | ✅ Granular |
| T39 | 1 função | ✅ Granular |
| T40 | 1 serviço de cobrança | ✅ Granular |
| T41 | 1 rota de webhook | ✅ Granular |
| T42 | 1 página | ✅ Granular |
| T43 | 1 layout | ✅ Granular |
| T44 | 1 serviço de delegação | ✅ Granular |
| T45 | 1 rota | ✅ Granular |
| T46 | 1 banner | ✅ Granular |
| T47 | 1 layout | ✅ Granular |
| T48 | 1 serviço de prévia | ✅ Granular |
| T49 | 1 rota | ✅ Granular |
| T50 | 1 banner | ✅ Granular |
| T51 | 1 wrapper | ✅ Granular |
| T52 | 1 serviço de setlist | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | nenhuma seta intrafase | ✅ Match |
| T2 | None | T2 -> T3 e T2 -> T4 | ✅ Match |
| T3 | T2 | T2 -> T3 | ✅ Match |
| T4 | T2 | T2 -> T4 | ✅ Match |
| T5 | None | T5 -> T6 e T5 -> T8 | ✅ Match |
| T6 | T5, T1 | T5 -> T6 | ✅ Match |
| T7 | T6 | T6 -> T7 | ✅ Match |
| T8 | T5 | T5 -> T8 | ✅ Match |
| T9 | T2 | nenhuma seta intrafase | ✅ Match |
| T10 | T4 | T10 -> T12 | ✅ Match |
| T11 | T2 | T11 -> T12 | ✅ Match |
| T12 | T10, T11 | T10 -> T12 e T11 -> T12 | ✅ Match |
| T13 | T12 | T12 -> T13 | ✅ Match |
| T14 | T1, T9 | T14 -> T15, T14 -> T16, T14 -> T21 | ✅ Match |
| T15 | T14 | T14 -> T15 | ✅ Match |
| T16 | T14 | T14 -> T16 | ✅ Match |
| T17 | T1 | nenhuma seta intrafase | ✅ Match |
| T18 | T1 | nenhuma seta intrafase | ✅ Match |
| T19 | T1 | T19 -> T20 | ✅ Match |
| T20 | T19 | T19 -> T20 | ✅ Match |
| T21 | T14 | T14 -> T21 | ✅ Match |
| T22 | T1, T9 | T22 -> T25 e T22 -> T27 | ✅ Match |
| T23 | T2 | T23 -> T24 | ✅ Match |
| T24 | T23 | T23 -> T24 | ✅ Match |
| T25 | T22 | T22 -> T25 | ✅ Match |
| T26 | T9 | nenhuma seta intrafase | ✅ Match |
| T27 | T22 | T22 -> T27 e T27 -> T28 | ✅ Match |
| T28 | T27 | T27 -> T28 | ✅ Match |
| T29 | T22 | T29 -> T30 | ✅ Match |
| T30 | T29 | T29 -> T30 e T30 -> T31 | ✅ Match |
| T31 | T30 | T30 -> T31 | ✅ Match |
| T32 | T1 | T32 -> T36 e T32 -> T35 | ✅ Match |
| T33 | None | T33 -> T34 | ✅ Match |
| T34 | T33 | T33 -> T34 e T34 -> T35 | ✅ Match |
| T35 | T32, T34 | T32 -> T35 e T34 -> T35 | ✅ Match |
| T36 | T32 | T32 -> T36 | ✅ Match |
| T37 | T1, T4 | T37 -> T38 e T37 -> T40 | ✅ Match |
| T38 | T37 | T37 -> T38 | ✅ Match |
| T39 | None | T39 -> T40 | ✅ Match |
| T40 | T37, T39 | T37 -> T40 e T39 -> T40 | ✅ Match |
| T41 | T40 | T40 -> T41 | ✅ Match |
| T42 | T40 | T40 -> T42 | ✅ Match |
| T43 | T2 | nenhuma seta intrafase | ✅ Match |
| T44 | T1, T4, T5 | T44 -> T45 | ✅ Match |
| T45 | T44 | T44 -> T45 | ✅ Match |
| T46 | T5 | T46 -> T47 | ✅ Match |
| T47 | T46 | T46 -> T47 | ✅ Match |
| T48 | T1, T4, T7 | T48 -> T49 e T48 -> T50 | ✅ Match |
| T49 | T48 | T48 -> T49 | ✅ Match |
| T50 | T48 | T48 -> T50 | ✅ Match |
| T51 | T8 | nenhuma seta intrafase | ✅ Match |
| T52 | T8 | nenhuma seta intrafase | ✅ Match |

Dependência para fase anterior não entra no diagrama da fase. Nenhuma task aponta para fase posterior.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Entity / schema | none | none | ✅ OK |
| T2 | Domain | unit | unit | ✅ OK |
| T3 | Domain | unit | unit | ✅ OK |
| T4 | Domain | unit | unit | ✅ OK |
| T5 | Domain | unit | unit | ✅ OK |
| T6 | Domain | unit | unit | ✅ OK |
| T7 | Domain | unit | unit | ✅ OK |
| T8 | Domain | unit | unit | ✅ OK |
| T9 | Domain | unit | unit | ✅ OK |
| T10 | Domain | unit | unit | ✅ OK |
| T11 | Page | integration | integration | ✅ OK |
| T12 | Page | integration | integration | ✅ OK |
| T13 | Page | integration | integration | ✅ OK |
| T14 | Domain | unit | unit | ✅ OK |
| T15 | Route | integration | integration | ✅ OK |
| T16 | Route | integration | integration | ✅ OK |
| T17 | Domain | unit | unit | ✅ OK |
| T18 | Domain | unit | unit | ✅ OK |
| T19 | Domain | unit | unit | ✅ OK |
| T20 | Domain | unit | unit | ✅ OK |
| T21 | Page | integration | integration | ✅ OK |
| T22 | Domain | unit | unit | ✅ OK |
| T23 | Domain | unit | unit | ✅ OK |
| T24 | Domain | unit | unit | ✅ OK |
| T25 | Route | integration | integration | ✅ OK |
| T26 | Route | integration | integration | ✅ OK |
| T27 | Route | integration | integration | ✅ OK |
| T28 | Page | integration | integration | ✅ OK |
| T29 | Domain | unit | unit | ✅ OK |
| T30 | Route | integration | integration | ✅ OK |
| T31 | Page | integration | integration | ✅ OK |
| T32 | Domain | unit | unit | ✅ OK |
| T33 | Domain | unit | unit | ✅ OK |
| T34 | Domain | unit | unit | ✅ OK |
| T35 | Page | integration | integration | ✅ OK |
| T36 | Route | integration | integration | ✅ OK |
| T37 | Domain | unit | unit | ✅ OK |
| T38 | Route | integration | integration | ✅ OK |
| T39 | Domain | unit | unit | ✅ OK |
| T40 | Domain | unit | unit | ✅ OK |
| T41 | Route | integration | integration | ✅ OK |
| T42 | Page | integration | integration | ✅ OK |
| T43 | Page | integration | integration | ✅ OK |
| T44 | Domain | unit | unit | ✅ OK |
| T45 | Route | integration | integration | ✅ OK |
| T46 | Page | integration | integration | ✅ OK |
| T47 | Page | integration | integration | ✅ OK |
| T48 | Domain | unit | unit | ✅ OK |
| T49 | Route | integration | integration | ✅ OK |
| T50 | Page | integration | integration | ✅ OK |
| T51 | Domain | unit | unit | ✅ OK |
| T52 | Domain | unit | unit | ✅ OK |
