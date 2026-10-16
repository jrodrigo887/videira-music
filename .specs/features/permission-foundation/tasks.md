# Fundação de permissões Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/permission-foundation/design.md`
**Status**: Draft

**Verificação**: cada tarefa roda o Vitest do gate. O browser entra só depois da T35, nas telas de papéis, de sem acesso e nos links do cabeçalho.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `package.json` scripts `test` (`vitest run`) and `lint`, `.github/workflows/ci.yml` (`npm test`). No coverage threshold. Floor from co-located Vitest: `lib/**/*.test.ts`, `app/api/**/*.test.ts`, `app/**/*.test.tsx`, `components/**/*.test.tsx`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Capacidades, `can`, carga do ator, toggle | unit | Todos os ramos de implicação, preset e exclusão do admin. PERM-17, PERM-18, PERM-25, PERM-29 a PERM-32 | `lib/auth/*.test.ts` | `npm test -- <alvo>` |
| Catálogo, membro, pedido | unit | 1:1 com PERM-01, PERM-02, PERM-03, PERM-07, PERM-19 a PERM-27 | `lib/roles/*.test.ts`, `lib/members/*.test.ts`, `lib/access-requests/*.test.ts` | `npm test -- <alvo>` |
| Portão `wrapPersistenceRoute` | unit | Sem capacidade: 403 e o handler não roda. Sem sessão: 401. PERM-15, PERM-16 | `lib/persistence/persistence-api.test.ts` | `npm test -- <alvo>` |
| Route handlers | integration | Rota alterada: sucesso do papel permitido e 403 do papel negado | `app/api/**/*.test.ts` | `npm test -- <alvo>` |
| Páginas e painéis | integration | Abas, prévia, sem acesso, links. PERM-08, PERM-09, PERM-28 a PERM-38 | `app/**/*.test.tsx`, `components/**/*.test.tsx` | `npm test -- <alvo>` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tarefa com teste unitário ou de rota isolada | `npm test -- <alvo>` |
| Full | Fim de fase, ou a matriz HTTP | `npm test && npx tsc --noEmit` |
| Build | Fim da feature | `npm test && npm run lint && npm run build` |

---

## Execution Plan

Fases em ordem. Dentro da fase, a ordem é a dos números. Seta só existe quando o `Depends on` é da mesma fase.

### Phase 1: Catálogo

```
T1 → T2
T1 → T3
```

### Phase 2: Serviços

```
T4
T5
T6
```

### Phase 3: Portão de persistência

```
T7 → T8
T7 → T9
T7 → T10
T7 → T11
T7 → T12
T7 → T13
T7 → T14
```

### Phase 4: Rotas de membros e convites

```
T15
T16
T17
T18
T19
T20
```

### Phase 5: Rotas de pedido e papéis

```
T21
T22
T23
T24
T25
```

### Phase 6: Peças de tela

```
T26
T27
T28
```

### Phase 7: Páginas

```
T29 → T31
T30 → T31
T32
T33
T34
```

### Phase 8: Matriz

```
T35
```

---

## Task Breakdown

### Phase 1: Catálogo

### T1: Fechar o catálogo de capacidades

**What**: Troca o catálogo, os presets e publica `closeCapabilities`, `holdsCapability` e `ADMIN_ONLY_CAPABILITIES`.
**Where**: `lib/auth/capabilities.ts`
**Depends on**: None
**Reuses**: `parseStoredCapabilities`
**Requirement**: PERM-17, PERM-25

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `users:manage` sai de `CAPABILITIES`. Entram `member.manage`, `user.manage`, `role.manage`.
- [x] Preset do gestor não tem `user.manage` nem `role.manage`, e tem `member.manage`, `users:invite`, `setlists:all` e `setlists:led`.
- [x] `holdsCapability` trata `import` como `music:write`, `member.manage` como `users:invite` e `setlists:all` como `setlists:led`.
- [x] `npm test -- lib/auth/capabilities.test.ts` passa, sem apagar `it` existente.

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): close the capability catalog under implications`

---

### T2: Apontar `can` para as capacidades novas

**What**: `can` deixa de conhecer `users:manage` e passa a responder as capacidades novas e `users:grantRole`.
**Where**: `lib/auth/permissions.ts`
**Depends on**: T1
**Reuses**: `holdsCapability`
**Requirement**: PERM-17

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `users:grantRole` com papel `admin` exige `role.manage`. Outro papel exige `user.manage`.
- [x] `music:read` continua verdadeiro para ator com ao menos um papel.
- [x] `npm test -- lib/auth/permissions.test.ts` passa, sem apagar `it` existente.

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): check user and role management in can`

---

### T3: Fechar capacidades na carga do ator

**What**: A carga do ator devolve o conjunto já fechado e ignora `users:manage` gravado.
**Where**: `lib/auth/load-actor.ts`
**Depends on**: T1
**Reuses**: `closeCapabilities`, `parseStoredCapabilities`
**Requirement**: PERM-17, PERM-18, PERM-25

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Ator com papel que só tem `import` também satisfaz `music:write`.
- [x] JSON com `users:manage` não entrega `users:manage`, `member.manage` nem `user.manage`.
- [x] `npm test -- lib/auth/load-actor.test.ts` passa, sem apagar `it` existente.

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): expand implied capabilities when loading the actor`

---

### Phase 2: Serviços

### T4: Gravar papel sem capacidade de admin

**What**: Catálogo exige `role.manage`, recusa capacidade exclusiva e grava o conjunto fechado.
**Where**: `lib/roles/role-service.ts`
**Depends on**: T1, T2
**Reuses**: `closeCapabilities`, `can`
**Requirement**: PERM-19, PERM-20, PERM-21, PERM-22, PERM-23, PERM-24

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Criar ou alterar com `user.manage` ou `role.manage` responde `409 ADMIN_ONLY_CAPABILITY` e não grava.
- [x] Lista com `import` sem `music:write` grava as duas. O mesmo para `member.manage` e `setlists:all`.
- [x] `listRoleLabels` exige `member.manage`, `user.manage` ou `role.manage`. `listRoles` exige `role.manage`.
- [x] `ROLE_MATCHES_ADMIN` sai do caminho de escrita.
- [x] `npm test -- lib/roles/role-service.test.ts` passa, sem apagar `it` existente.

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): reject admin-only capabilities on custom roles`

---

### T5: Separar lista de membros da área de usuário

**What**: Listar membros exige `member.manage`. Trocar papel e desativar exigem `user.manage`.
**Where**: `lib/members/member-service.ts`
**Depends on**: T2
**Reuses**: `LAST_ADMIN`, `can`
**Requirement**: PERM-01, PERM-02, PERM-07, PERM-26, PERM-27

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Gestor recebe `403` em `setMemberRoles` e `deactivateMember`, e o estado não muda.
- [x] Ator com `user.manage` grava papéis. Incluir `admin` também exige `role.manage`.
- [x] Remover ou desativar o único admin ativo responde `409 LAST_ADMIN`.
- [x] `npm test -- lib/members/member-service.test.ts` passa. O arquivo nasce nesta tarefa se ainda não existir.

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): limit role changes and deactivation to user.manage`

---

### T6: Reservar pedido de acesso ao admin

**What**: Listar, aprovar e recusar pedido exigem `user.manage`. Conceder `admin` exige `role.manage`.
**Where**: `lib/access-requests/access-request-service.ts`
**Depends on**: T2
**Reuses**: `can`
**Requirement**: PERM-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Gestor recebe `403` em aprovar e em recusar.
- [x] A checagem deixa de usar `hasRole(actor, "admin")`.
- [x] `npm test -- lib/access-requests/access-request-service.test.ts` passa, sem apagar `it` existente.

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): require user.manage to resolve access requests`

---

### Phase 3: Portão de persistência

### T7: Negar rota de persistência sem capacidade

**What**: `wrapPersistenceRoute` sem `permission` responde 403 e não chama o handler. `withPersistenceRoute` sai.
**Where**: `lib/persistence/persistence-api.ts`
**Depends on**: T2
**Reuses**: `requireActor`, `forbiddenResponse`
**Requirement**: PERM-15, PERM-16

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Meta sem `permission` responde `403` e o handler não roda.
- [ ] Meta com `permission` e sem sessão responde `401`.
- [ ] `npm test -- lib/persistence/persistence-api.test.ts` passa.

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): deny persistence routes that omit a capability`

---

### T8: Exigir `setlists:led` ao criar setlist

**What**: `POST /api/setlists` declara `setlists:led`. `GET` continua `music:read`.
**Where**: `app/api/setlists/route.ts`
**Depends on**: T7
**Reuses**: `wrapPersistenceRoute`
**Requirement**: PERM-11, PERM-12

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Músico em `POST /api/setlists` recebe `403`.
- [ ] `GET /api/setlists` continua `music:read`.
- [ ] `npm test -- app/api/setlists/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require setlists:led to create a setlist`

---

### T9: Exigir `setlists:led` ao alterar um setlist

**What**: `PATCH` e `DELETE` de um setlist declaram `setlists:led`. `GET` continua `music:read`.
**Where**: `app/api/setlists/[setlistId]/route.ts`
**Depends on**: T7
**Reuses**: `wrapPersistenceRoute`, `canPerform`
**Requirement**: PERM-12, PERM-13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Líder do grupo dono altera o setlist. Líder de outro grupo recebe `403`.
- [ ] `npm test -- app/api/setlists/[setlistId]/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require setlists:led to edit or delete a setlist`

---

### T10: Exigir `setlists:led` nos itens do setlist

**What**: `PUT` dos itens declara `setlists:led`.
**Where**: `app/api/setlists/[setlistId]/items/route.ts`
**Depends on**: T7
**Reuses**: `wrapPersistenceRoute`
**Requirement**: PERM-13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Músico recebe `403` no `PUT`.
- [ ] `npm test -- app/api/setlists/[setlistId]/items/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require setlists:led to replace setlist items`

---

### T11: Exigir `setlists:led` ao clonar setlist

**What**: `POST` de clone declara `setlists:led`.
**Where**: `app/api/setlists/[setlistId]/clone/route.ts`
**Depends on**: T7
**Reuses**: `wrapPersistenceRoute`
**Requirement**: PERM-12

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Músico recebe `403`.
- [ ] `npm test -- app/api/setlists/[setlistId]/clone/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require setlists:led to clone a setlist`

---

### T12: Exigir `setlists:led` ao seguir setlist

**What**: `POST` e `DELETE` de follow declaram `setlists:led`.
**Where**: `app/api/setlists/[setlistId]/follow/route.ts`
**Depends on**: T7
**Reuses**: `wrapPersistenceRoute`
**Requirement**: PERM-12

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Músico recebe `403` no `POST` e no `DELETE`.
- [ ] `npm test -- app/api/setlists/[setlistId]/follow/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require setlists:led to follow a setlist`

---

### T13: Exigir `teams:manage` na coleção de grupos

**What**: `GET` e `POST /api/teams` declaram `teams:manage`.
**Where**: `app/api/teams/route.ts`
**Depends on**: T7
**Reuses**: `wrapPersistenceRoute`
**Requirement**: PERM-11, PERM-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Músico recebe `403` no `POST` e no `GET`.
- [ ] Ator com `teams:manage` e nome válido recebe `201` no `POST`.
- [ ] `npm test -- app/api/teams/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require teams:manage to list or create groups`

---

### T14: Exigir `teams:manage` ao alterar um grupo

**What**: `PATCH /api/teams/:teamId` declara `teams:manage`.
**Where**: `app/api/teams/[teamId]/route.ts`
**Depends on**: T7
**Reuses**: `wrapPersistenceRoute`
**Requirement**: PERM-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Músico recebe `403` no `PATCH`.
- [ ] `npm test -- app/api/teams/[teamId]/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require teams:manage to update a group`

---

### Phase 4: Rotas de membros e convites

### T15: Exigir `member.manage` ao listar membros

**What**: `GET /api/members` chama `requirePermission` com `member.manage`.
**Where**: `app/api/members/route.ts`
**Depends on**: T5
**Reuses**: `requirePermission`
**Requirement**: PERM-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Gestor recebe `200`. Músico recebe `403`.
- [ ] `npm test -- app/api/members/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require member.manage to list members`

---

### T16: Exigir `user.manage` ao trocar papéis

**What**: `PUT /api/members/:userId/roles` chama `requirePermission` com `user.manage`.
**Where**: `app/api/members/[userId]/roles/route.ts`
**Depends on**: T5
**Reuses**: `requirePermission`
**Requirement**: PERM-01, PERM-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Gestor recebe `403` e os papéis gravados não mudam.
- [ ] Admin com corpo válido recebe `200`.
- [ ] `npm test -- app/api/members/[userId]/roles/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require user.manage to change member roles`

---

### T17: Exigir `user.manage` ao desativar

**What**: `POST /api/members/:userId/deactivate` chama `requirePermission` com `user.manage`.
**Where**: `app/api/members/[userId]/deactivate/route.ts`
**Depends on**: T5
**Reuses**: `requirePermission`
**Requirement**: PERM-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Gestor recebe `403` e o usuário continua ativo.
- [ ] `npm test -- app/api/members/[userId]/deactivate/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require user.manage to deactivate a member`

---

### T18: Declarar `teams:manage` nos líderes do grupo

**What**: `PUT /api/teams/:teamId/leaders` chama `requirePermission` com `teams:manage`.
**Where**: `app/api/teams/[teamId]/leaders/route.ts`
**Depends on**: T5
**Reuses**: `requirePermission`
**Requirement**: PERM-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Músico recebe `403`.
- [ ] `npm test -- app/api/teams/[teamId]/leaders/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require teams:manage to assign group leaders`

---

### T19: Declarar `users:invite` na coleção de convites

**What**: `GET` e `POST /api/invites` chamam `requirePermission` com `users:invite`.
**Where**: `app/api/invites/route.ts`
**Depends on**: T2
**Reuses**: `requirePermission`
**Requirement**: PERM-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Gestor com corpo válido recebe `201` no `POST`.
- [ ] Músico recebe `403`.
- [ ] `npm test -- app/api/invites/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require users:invite on the invites collection`

---

### T20: Declarar `users:invite` ao cancelar convite

**What**: `DELETE /api/invites/:inviteId` chama `requirePermission` com `users:invite`.
**Where**: `app/api/invites/[inviteId]/route.ts`
**Depends on**: T2
**Reuses**: `requirePermission`
**Requirement**: PERM-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Músico recebe `403`.
- [ ] `npm test -- app/api/invites/[inviteId]/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require users:invite to revoke an invite`

---

### Phase 5: Rotas de pedido e papéis

### T21: Exigir `user.manage` ao listar pedidos

**What**: `GET /api/access-requests` chama `requirePermission` com `user.manage`.
**Where**: `app/api/access-requests/route.ts`
**Depends on**: T6
**Reuses**: `requirePermission`
**Requirement**: PERM-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Gestor recebe `403` no `GET`.
- [ ] `npm test -- app/api/access-requests/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require user.manage to list access requests`

---

### T22: Exigir `user.manage` ao aprovar pedido

**What**: `POST /api/access-requests/:id/approve` chama `requirePermission` com `user.manage`.
**Where**: `app/api/access-requests/[id]/approve/route.ts`
**Depends on**: T6
**Reuses**: `requirePermission`
**Requirement**: PERM-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Gestor recebe `403`.
- [ ] `npm test -- app/api/access-requests/[id]/approve/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require user.manage to approve an access request`

---

### T23: Exigir `user.manage` ao recusar pedido

**What**: `POST /api/access-requests/:id/reject` chama `requirePermission` com `user.manage`.
**Where**: `app/api/access-requests/[id]/reject/route.ts`
**Depends on**: T6
**Reuses**: `requirePermission`
**Requirement**: PERM-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Gestor recebe `403`.
- [ ] `npm test -- app/api/access-requests/[id]/reject/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require user.manage to reject an access request`

---

### T24: Exigir `role.manage` na coleção de papéis

**What**: `GET` e `POST /api/roles` chamam `requirePermission` com `role.manage`.
**Where**: `app/api/roles/route.ts`
**Depends on**: T4
**Reuses**: `requirePermission`
**Requirement**: PERM-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Gestor recebe `403` no `GET` e no `POST`.
- [ ] `npm test -- app/api/roles/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require role.manage on the roles collection`

---

### T25: Exigir `role.manage` ao alterar um papel

**What**: `PATCH` e `DELETE /api/roles/:key` chamam `requirePermission` com `role.manage`.
**Where**: `app/api/roles/[key]/route.ts`
**Depends on**: T4
**Reuses**: `requirePermission`
**Requirement**: PERM-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Gestor recebe `403` no `PATCH` e no `DELETE`.
- [ ] `npm test -- app/api/roles/[key]/route.test.ts` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): require role.manage to update or delete a role`

---

### Phase 6: Peças de tela

### T26: Aplicar dependência ao marcar capacidade

**What**: `toggleCapability` marca a base ao ligar o dependente e desliga o dependente ao apagar a base.
**Where**: `lib/auth/capability-toggle.ts`
**Depends on**: T1
**Reuses**: `CAPABILITIES`
**Requirement**: PERM-29, PERM-30, PERM-31, PERM-32

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Marcar `import` inclui `music:write`. Marcar `member.manage` inclui `users:invite`. Marcar `setlists:all` inclui `setlists:led`.
- [ ] Desmarcar a base remove o dependente e devolve `warning: true`.
- [ ] `npm test -- lib/auth/capability-toggle.test.ts` passa.

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): toggle capability dependencies as a pure function`

---

### T27: Mostrar a tela de sem acesso

**What**: Componente com o título e a frase da spec, sem botão e sem `fetch`.
**Where**: `components/auth/no-access.tsx`
**Depends on**: None
**Reuses**: `ds-card`
**Requirement**: PERM-35

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] O título é "Você não tem acesso a esta área".
- [ ] A frase é "Peça acesso a um Gestor ou a um Admin."
- [ ] Não há botão "Solicitar acesso".
- [ ] `npm test -- components/auth/no-access.test.tsx` passa.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): add the no-access screen`

---

### T28: Agrupar rótulos de capacidade

**What**: Rótulos novos e os quatro grupos do formulário, mais a frase da capacidade exclusiva.
**Where**: `components/users/user-admin-shared.ts`
**Depends on**: T1
**Reuses**: `CAPABILITY_LABELS`
**Requirement**: PERM-28, PERM-33, PERM-34

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Grupos: Biblioteca, Setlists, Grupos e pessoas, Administração.
- [ ] `user.manage` é "Área de usuário". `role.manage` é "Gerenciar papéis". `member.manage` é "Gerenciar membros".
- [ ] A frase exclusiva é "Somente o papel Administrador pode ter esta capacidade."
- [ ] `npm test -- components/users/user-admin-shared.test.ts` passa.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): group capability labels for the role form`

---

### Phase 7: Páginas

### T29: Esconder troca de papel e desativar do gestor

**What**: O painel de membros só mostra checkbox e Desativar quando `canChangeRoles` é verdadeiro.
**Where**: `components/users/members-panel.tsx`
**Depends on**: T28
**Reuses**: `formatRoleLabel`
**Requirement**: PERM-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Com `canChangeRoles` falso, não há checkbox de papel nem botão Desativar.
- [ ] Os papéis atuais aparecem em texto.
- [ ] `npm test -- components/users/members-panel.test.tsx` passa.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): hide role edits from members who cannot change them`

---

### T30: Omitir abas Pedidos e Papéis

**What**: `UsersAdmin` só mostra Pedidos com `user.manage` e Papéis com `role.manage`.
**Where**: `components/users/users-admin.tsx`
**Depends on**: None
**Reuses**: `TABS`
**Requirement**: PERM-08, PERM-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Sem `user.manage`, a aba Pedidos não aparece.
- [ ] Sem `role.manage`, a aba Papéis não aparece.
- [ ] `npm test -- components/users/users-admin.test.tsx` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): hide requests and roles tabs without those capabilities`

---

### T31: Gates da página de usuários

**What**: A página busca cada bloco pela capacidade e usa `NoAccess` quando a URL é proibida.
**Where**: `app/usuarios/page.tsx`
**Depends on**: T4, T27, T29, T30
**Reuses**: `NoAccess`, `listRoleLabels`, `requirePageActor`
**Requirement**: PERM-08, PERM-09, PERM-35, PERM-36

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Sem `member.manage`, `users:invite` e `user.manage`, a página mostra `NoAccess`.
- [ ] `?aba=papeis` sem `role.manage` mostra `NoAccess`.
- [ ] Gestor não dispara `listRoles` nem `listPendingAccessRequests`.
- [ ] Sem sessão, redireciona para `/entrar`.
- [ ] `npm test -- app/usuarios/page.test.tsx` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): gate the users page by capability`

---

### T32: Mostrar links pela capacidade

**What**: Importar, Grupos e Usuários seguem `import`, `teams:manage` e a união de membro, convite ou área de usuário.
**Where**: `app/layout.tsx`
**Depends on**: T2
**Reuses**: `can`
**Requirement**: PERM-37, PERM-38

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Músico não vê Importar, Grupos nem Usuários.
- [ ] Gestor vê Usuários. Líder vê Importar e não vê Grupos nem Usuários.
- [ ] `npm test -- app/layout.test.tsx` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): show header links from capabilities`

---

### T33: Trocar a recusa de importar pela tela sem acesso

**What**: Usuário sem `import` vê `NoAccess`. Sem sessão, vai para `/entrar`. Flag desligada continua `notFound`.
**Where**: `app/import/page.tsx`
**Depends on**: T27
**Reuses**: `NoAccess`, `can`
**Requirement**: PERM-35, PERM-36

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Autenticado sem `import` vê o título "Você não tem acesso a esta área".
- [ ] A página não chama `POST /api/access-requests`.
- [ ] Sem sessão, redireciona para `/entrar`.
- [ ] `npm test -- app/import/page.test.tsx` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): show no-access on the import page`

---

### T34: Trocar a recusa de grupos pela tela sem acesso

**What**: Sem `teams:manage`, a página mostra `NoAccess` antes de listar grupos. Sem sessão, vai para `/entrar`.
**Where**: `app/groups/page.tsx`
**Depends on**: T27
**Reuses**: `NoAccess`, `can`
**Requirement**: PERM-35, PERM-36

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Autenticado sem `teams:manage` vê o título "Você não tem acesso a esta área".
- [ ] Sem sessão, redireciona para `/entrar`.
- [ ] `npm test -- app/groups/page.test.tsx` passa, sem apagar `it` existente.

**Tests**: integration
**Gate**: quick

**Commit**: `feat(auth): show no-access on the groups page`

---

### Phase 8: Matriz

### T35: Matriz papel por endpoint

**What**: Uma suíte chama as rotas da spec e confere 200, 201 ou 403 para músico, líder, gestor e admin.
**Where**: `lib/auth/permission-matrix.test.ts`
**Depends on**: T8, T9, T13, T15, T16, T17, T19, T22, T24
**Reuses**: `createAuthApiTestContext`
**Requirement**: PERM-10, PERM-11, PERM-12, PERM-13, PERM-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Músico recebe `403` em `PUT` de cifra, `POST /api/setlists` e `POST /api/teams`.
- [ ] Líder do grupo A recebe `403` ao editar setlist do grupo B e sucesso no grupo que lidera.
- [ ] Gestor recebe `403` em troca de papel, desativação, aprovar pedido e `POST /api/roles`, e `201` ao convidar.
- [ ] `npm test && npx tsc --noEmit` passa.

**Tests**: integration
**Gate**: full

**Commit**: `test(auth): cover the role by endpoint permission matrix`

---

## Phase Execution Map

```
Phase 1: T1 → T2
         T1 → T3
Phase 3: T7 → T8
         T7 → T9
         T7 → T10
         T7 → T11
         T7 → T12
         T7 → T13
         T7 → T14
Phase 7: T29 → T31
         T30 → T31
```

Fases 2, 4, 5, 6 e 8 não têm seta interna. A dependência delas aponta para fase anterior.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 a T7 | 1 arquivo de domínio cada | Granular |
| T8 a T25 | 1 route.ts cada | Granular |
| T26 a T34 | 1 componente ou 1 página cada | Granular |
| T35 | 1 arquivo de teste | Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | nenhuma seta de entrada | Match |
| T2 | T1 | T1 → T2 | Match |
| T3 | T1 | T1 → T3 | Match |
| T4 | T1, T2 | fase anterior, sem seta interna | Match |
| T5 | T2 | fase anterior, sem seta interna | Match |
| T6 | T2 | fase anterior, sem seta interna | Match |
| T7 | T2 | fase anterior, sem seta interna | Match |
| T8 | T7 | T7 → T8 | Match |
| T9 | T7 | T7 → T9 | Match |
| T10 | T7 | T7 → T10 | Match |
| T11 | T7 | T7 → T11 | Match |
| T12 | T7 | T7 → T12 | Match |
| T13 | T7 | T7 → T13 | Match |
| T14 | T7 | T7 → T14 | Match |
| T15 | T5 | fase anterior, sem seta interna | Match |
| T16 | T5 | fase anterior, sem seta interna | Match |
| T17 | T5 | fase anterior, sem seta interna | Match |
| T18 | T5 | fase anterior, sem seta interna | Match |
| T19 | T2 | fase anterior, sem seta interna | Match |
| T20 | T2 | fase anterior, sem seta interna | Match |
| T21 | T6 | fase anterior, sem seta interna | Match |
| T22 | T6 | fase anterior, sem seta interna | Match |
| T23 | T6 | fase anterior, sem seta interna | Match |
| T24 | T4 | fase anterior, sem seta interna | Match |
| T25 | T4 | fase anterior, sem seta interna | Match |
| T26 | T1 | fase anterior, sem seta interna | Match |
| T27 | None | nenhuma seta de entrada | Match |
| T28 | T1 | fase anterior, sem seta interna | Match |
| T29 | T28 | fase anterior, sem seta interna | Match |
| T30 | None | nenhuma seta de entrada | Match |
| T31 | T4, T27, T29, T30 | T29 → T31 e T30 → T31 | Match |
| T32 | T2 | fase anterior, sem seta interna | Match |
| T33 | T27 | fase anterior, sem seta interna | Match |
| T34 | T27 | fase anterior, sem seta interna | Match |
| T35 | T8, T9, T13, T15, T16, T17, T19, T22, T24 | fases anteriores, sem seta interna | Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Capacidades | unit | unit | OK |
| T2 | `can` | unit | unit | OK |
| T3 | Carga do ator | unit | unit | OK |
| T4 | Catálogo | unit | unit | OK |
| T5 | Membro | unit | unit | OK |
| T6 | Pedido | unit | unit | OK |
| T7 | Portão | unit | unit | OK |
| T8 a T25 | Route handlers | integration | integration | OK |
| T26 | Toggle | unit | unit | OK |
| T27 a T34 | Páginas e painéis | integration | integration | OK |
| T35 | Route handlers | integration | integration | OK |
