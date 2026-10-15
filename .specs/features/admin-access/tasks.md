# Administração de papéis e pedidos de acesso — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/admin-access/design.md`
**Status**: Done

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `package.json` (`test`, `lint`), `eslint.config.mjs`. Sem threshold de cobertura. Amostras: `lib/auth/access-gate.test.ts`, `lib/auth/load-actor.test.ts`, `lib/setlists/setlist-policy.test.ts`, `app/api/members/[userId]/roles/route.test.ts`, `app/api/invites/route.test.ts`, `app/layout.test.tsx`, `components/songs/song-library.test.tsx`, `app/groups/page.test.tsx`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Capacidades, Actor, política | unit | Todos os ramos; ADM-10 a ADM-17 e ADM-12 na matriz dos quatro papéis | `lib/auth/*.test.ts`, `lib/setlists/setlist-policy.test.ts` | `npm test -- <alvo>` |
| Catálogo, convite, membro, pedido | unit | 1:1 com os ACs do serviço, inclusive ADM-33, ADM-47, ADM-48, ADM-49 | `lib/roles/*.test.ts`, `lib/members/*.test.ts`, `lib/invites/*.test.ts`, `lib/access-requests/*.test.ts` | `npm test -- <alvo>` |
| Access gate e ticket | unit | ADM-18, ADM-20, ADM-23, ADM-28, ADM-43, ADM-44 | `lib/auth/access-gate.test.ts`, `lib/access-requests/access-ticket.test.ts` | `npm test -- <alvo>` |
| Route handlers | integration | Cada rota nova: sucesso, 400, 403 e 409 citados na spec | `app/api/**/*.test.ts` | `npm test -- <alvo>` |
| Páginas e painéis | integration | Abas, botão Solicitar acesso, catálogo sem edição para gestor, fila | `app/**/*.test.tsx`, `components/**/*.test.tsx` | `npm test -- <alvo>` |
| Prisma / schema | none | Migration gerada. Gate de build. | `prisma/schema.prisma` | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tarefa com teste unitário ou de rota isolada | `npm test -- <alvo>` |
| Full | Fim de fase, ou tarefa que mexe em política compartilhada | `npm test && npx tsc --noEmit` |
| Build | Tarefa só de schema, ou fim da feature | `npm test && npm run lint && npm run build` |

---

## Execution Plan

As fases rodam em ordem. Dentro da fase, as tarefas rodam em ordem. 26 tarefas: na Execute, o corte em lotes de cerca de 7 cai na fronteira da fase (fases 1+2, 3+4, 5, 6).

### Phase 1: Fundação

```
T1 → T2 → T3 → T4
```

### Phase 2: Política

```
T5 → T6
T5 → T7
```

### Phase 3: Catálogo

```
T8 → T9 → T10 → T11
```

### Phase 4: Atribuição

```
T12 → T13
```

### Phase 5: Pedido de acesso

```
T14 → T15 → T17 → T20
T14 → T16 → T20
T15 → T18
T15 → T19
```

### Phase 6: Tela

```
T21 → T22 → T23 → T24 → T25 → T26
```

---

## Task Breakdown

### Phase 1: Fundação

### T1: Tabelas RoleDefinition e AccessRequest

**What**: Acrescentar os dois models no Prisma e gerar a migration.
**Where**: `prisma/schema.prisma`
**Depends on**: None
**Reuses**: `Organization`, `User`, `AuthAuditLog` no mesmo schema
**Requirement**: ADM-21, ADM-27

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `RoleDefinition` tem `organizationId`, `key`, `label`, `system`, `capabilities`, unique `(organizationId, key)`
- [x] `AccessRequest` tem `email`, `name`, `status`, `requestedAt`, `resolvedAt`, `resolvedByUserId`, `createdUserId`, unique `(organizationId, email)`
- [x] `UserRole` continua string, sem FK
- [x] A migration SQL existe em `prisma/migrations`
- [x] Gate: `npx prisma validate && npx prisma generate`

**Tests**: none
**Gate**: build

**Commit**: `feat(admin-access): add role and access-request tables`

---

### T2: Presets de capacidade

**What**: Constante das sete capacidades e dos quatro presets de sistema.
**Where**: `lib/auth/capabilities.ts`
**Depends on**: T1
**Reuses**: nomes já usados em `lib/auth/permissions.ts`
**Requirement**: ADM-01, ADM-12, ADM-17

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `systemCapabilities("admin")` devolve as sete capacidades
- [x] `manager`, `worship_leader` e `musician` batem com os presets da spec
- [x] Nenhuma capacidade se chama conceder admin
- [x] `isCapability` recusa string fora do conjunto
- [x] Gate: `npm test -- lib/auth/capabilities.test.ts`
- [x] Test count: 4 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(admin-access): define system role capability presets`

---

### T3: Actor com capacidades

**What**: O ator de usuário passa a carregar `capabilities`, com `hasCapability`.
**Where**: `lib/auth/actor.ts`
**Depends on**: T2
**Reuses**: `hasRole` no mesmo arquivo
**Requirement**: ADM-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `UserActor.capabilities` é `readonly Capability[]`
- [x] `hasCapability` exige a mesma igreja
- [x] `hasRole` continua igual para a chave `admin`
- [x] Gate: `npm test -- lib/auth/actor.test.ts`
- [x] Test count: 3 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(admin-access): carry capabilities on the actor`

---

### T4: Carga do ator pelo catálogo

**What**: `load-actor` resolve capacidades de sistema pelo código e as demais por `RoleDefinition`.
**Where**: `lib/auth/load-actor.ts`
**Depends on**: T3
**Reuses**: `systemCapabilities` e o include atual de papéis e grupos
**Requirement**: ADM-04, ADM-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Chave de sistema ignora o JSON do banco
- [x] Chave personalizada entra em `roles` e soma as capacidades
- [x] Chave desconhecida é ignorada
- [x] Sem papel restante, o ator é anônimo
- [x] Gate: `npm test -- lib/auth/load-actor.test.ts`
- [x] Test count: os testes anteriores mais 4 novos passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(admin-access): resolve actor capabilities from the catalog`

---

### Phase 2: Política

### T5: can() por capacidade

**What**: `can` decide pela união das capacidades, com exceção de conceder `admin`.
**Where**: `lib/auth/permissions.ts`
**Depends on**: T4
**Reuses**: `hasRole`, `hasCapability`
**Requirement**: ADM-10, ADM-11, ADM-12, ADM-16, ADM-17

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `users:invite`, `users:manage`, `teams:manage`, `music:write` e `import` leem capacidade
- [x] `users:grantRole` com `admin` exige o papel de sistema `admin`
- [x] `music:read` vale para qualquer membro ativo da igreja
- [x] Os quatro papéis de sistema continuam iguais à matriz da spec `auth`
- [x] Gate: `npm test -- lib/auth/permissions.test.ts lib/import-access/import-access-policy.test.ts`
- [x] Test count: 8 tests pass no arquivo novo, e os testes de import existentes passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(admin-access): authorize actions by capability`

---

### T6: canPerform por capacidade

**What**: Setlist e grupos usam `setlists:all`, `setlists:led` e `teams:manage`.
**Where**: `lib/setlists/setlist-policy.ts`
**Depends on**: T5
**Reuses**: `teamRoleOf` e a suíte `setlist-policy.test.ts`
**Requirement**: ADM-10, ADM-12

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `setlists:all` edita setlist de qualquer grupo e o setlist da igreja
- [x] `setlists:led` só edita grupo em que `teamRoleOf` é `leader`
- [x] `manageTeams` exige `teams:manage`
- [x] A matriz antiga de admin, gestor, líder e músico permanece verde
- [x] Gate: `npm test -- lib/setlists/setlist-policy.test.ts`
- [x] Test count: a suíte anterior passa, mais 2 testes de papel personalizado

**Tests**: unit
**Gate**: quick

**Commit**: `feat(admin-access): apply setlist policy from capabilities`

---

### T7: Header por capacidade

**What**: Os links Grupos e Usuários seguem `teams:manage` e `users:manage`.
**Where**: `app/layout.tsx`
**Depends on**: T5
**Reuses**: `app/layout.test.tsx`
**Requirement**: ADM-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Papel personalizado com `teams:manage` vê Grupos
- [x] Papel personalizado com `users:manage` vê Usuários
- [x] Músico de sistema não vê nenhum dos dois
- [x] Gate: `npm test -- app/layout.test.tsx`
- [x] Test count: a suíte anterior passa, mais 2 testes

**Tests**: integration
**Gate**: quick

**Commit**: `feat(admin-access): show admin links from capabilities`

---

### Phase 3: Catálogo

### T8: Chave do papel

**What**: Gerar a chave estável a partir do nome.
**Where**: `lib/roles/role-key.ts`
**Depends on**: T4
**Reuses**: nenhuma lib externa
**Requirement**: ADM-03, ADM-08, ADM-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] "Intercessão Jovem" vira `intercessao-jovem`
- [x] Nome com menos de 2 ou mais de 40 caracteres depois do trim é inválido
- [x] A função não muda uma chave já gravada: ela só deriva na criação
- [x] Gate: `npm test -- lib/roles/role-key.test.ts`
- [x] Test count: 4 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(admin-access): derive a stable role key from the label`

---

### T9: Serviço do catálogo

**What**: Listar, criar, renomear, mudar capacidades e apagar papel personalizado.
**Where**: `lib/roles/role-service.ts`
**Depends on**: T8, T3
**Reuses**: formato de erro de `MemberServiceError` e o formato de `writeAudit`
**Requirement**: ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06, ADM-07, ADM-09, ADM-39, ADM-40

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Só `hasRole(actor, "admin")` cria, altera ou apaga
- [x] Gestor recebe `403 FORBIDDEN`
- [x] Papel de sistema responde `409 SYSTEM_ROLE` ao apagar, renomear ou mudar capacidades
- [x] Papel em membro ou convite pendente responde `409 ROLE_IN_USE`
- [x] Nome ou chave repetidos respondem `409 ROLE_EXISTS`
- [x] Capacidade fora do conjunto responde `400 INVALID_ROLE`
- [x] `ensureSystemRoles` cria os quatro papéis sem usar o JSON como fonte da capacidade
- [x] Cada mutação grava `AuthAuditLog` sem segredo
- [x] `isAssignableRole` aceita chave de sistema ou do catálogo
- [x] Gate: `npm test -- lib/roles/role-service.test.ts`
- [x] Test count: 10 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(admin-access): manage the custom role catalog`

---

### T10: Rotas de criar e listar papéis

**What**: `GET` e `POST /api/roles`.
**Where**: `app/api/roles/route.ts`
**Depends on**: T9
**Reuses**: o JSON `{ error: { code } }` de `app/api/members/route.ts`
**Requirement**: ADM-02, ADM-07, ADM-08, ADM-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Admin cria e lista
- [x] Gestor no `POST` recebe 403
- [x] Nome inválido recebe 400 `INVALID_ROLE`
- [x] Nome repetido recebe 409 `ROLE_EXISTS`
- [x] Gate: `npm test -- app/api/roles/route.test.ts`
- [x] Test count: 4 tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(admin-access): add role list and create routes`

---

### T11: Rotas de alterar e apagar papel

**What**: `PATCH` e `DELETE /api/roles/{key}`.
**Where**: `app/api/roles/[key]/route.ts`
**Depends on**: T10
**Reuses**: `role-service` da T9
**Requirement**: ADM-03, ADM-04, ADM-05, ADM-06, ADM-40

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `PATCH` muda nome e mantém a chave
- [x] `PATCH` muda capacidades
- [x] `DELETE` de papel sem uso responde 200 e remove
- [x] `DELETE` em uso responde 409 `ROLE_IN_USE`
- [x] Papel de sistema responde 409 `SYSTEM_ROLE`
- [x] Gate: `npm test -- app/api/roles/[key]/route.test.ts`
- [x] Test count: 5 tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(admin-access): add role update and delete routes`

---

### Phase 4: Atribuição

### T12: Membros aceitam o catálogo

**What**: Troca de papéis, líder de grupo e líder único passam a usar o catálogo e `setlists:led`.
**Where**: `lib/members/member-service.ts`
**Depends on**: T9, T6
**Reuses**: `isAssignableRole`, `reconcileSoleWorshipLeader`
**Requirement**: ADM-13, ADM-14, ADM-15, ADM-16, ADM-41, ADM-42

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Chave do catálogo grava em `UserRole`
- [x] Chave inexistente responde `400 INVALID_ROLE`
- [x] Líder de grupo exige `setlists:led`, senão `400 NOT_A_WORSHIP_LEADER`
- [x] Conceder ou retirar `admin` sem o papel de sistema `admin` responde `403 FORBIDDEN`
- [x] O líder único automático conta só a chave `worship_leader`
- [x] Gate: `npm test -- lib/members/member-service.test.ts app/api/members/[userId]/roles/route.test.ts`
- [x] Test count: a suíte anterior passa, mais 4 testes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(admin-access): assign catalog roles to members`

---

### T13: Convite aceita o catálogo

**What**: Criar convite valida as chaves no catálogo.
**Where**: `lib/invites/invite-service.ts`
**Depends on**: T12
**Reuses**: `isAssignableRole` e a checagem atual de `admin`
**Requirement**: ADM-41, ADM-42

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Convite com chave personalizada grava
- [x] Chave inexistente responde `400 INVALID_ROLE` e não grava
- [x] Gestor com papel `admin` no convite continua `403 FORBIDDEN`
- [x] Gate: `npm test -- lib/invites/invite-service.test.ts app/api/invites/route.test.ts`
- [x] Test count: a suíte anterior passa, mais 2 testes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(admin-access): validate invite roles against the catalog`

---

### Phase 5: Pedido de acesso

### T14: Ticket assinado

**What**: Assinar, ler e descrever o cookie `videira_access_ticket`.
**Where**: `lib/access-requests/access-ticket.ts`
**Depends on**: T13
**Reuses**: `readAuthEnvConfig().secret` e `normalizeEmail`
**Requirement**: ADM-18, ADM-23, ADM-43

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] O token carrega e-mail normalizado, nome e expiração de 15 minutos
- [x] HMAC inválido, token vencido ou payload adulterado devolve `undefined`
- [x] A comparação do HMAC não usa igualdade direta de string
- [x] As opções do cookie são `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=900`, e `Secure` só com `NODE_ENV=production`
- [x] Gate: `npm test -- lib/access-requests/access-ticket.test.ts`
- [x] Test count: 5 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(admin-access): sign the access-request ticket`

---

### T15: Serviço do pedido

**What**: Gravar, listar, liberar e recusar pedido, criando o membro na liberação.
**Where**: `lib/access-requests/access-request-service.ts`
**Depends on**: T14, T9, T12
**Reuses**: criação de membro de `acceptInvite` e `reconcileSoleWorshipLeader`
**Requirement**: ADM-21, ADM-22, ADM-25, ADM-26, ADM-27, ADM-29, ADM-30, ADM-31, ADM-32, ADM-33, ADM-34, ADM-39, ADM-45, ADM-46, ADM-47, ADM-48, ADM-49

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Um e-mail tem um único pedido. Pendente atualiza nome e data. Recusado volta a pendente. Aprovado não reabre.
- [x] Liberar com pedido `pending` cria `User` ativo sem `authUserId`, grava papéis e grupos e tira o pedido da fila
- [x] Grupo com `setlists:led` nasce `leader`. Sem essa capacidade, nasce `member`
- [x] O único `worship_leader` de sistema criado aqui dispara AUTH-24
- [x] Gestor com papel `admin` recebe `403 FORBIDDEN` e o pedido segue pendente
- [x] Membro ativo: `409 USER_EXISTS`. Desativado: `409 USER_DEACTIVATED`. Papéis vazios ou chave inválida: `400 INVALID_ROLE`. Grupo inválido: `400 INVALID_TEAM`
- [x] Duas liberações simultâneas criam um membro e a segunda recebe `409 REQUEST_RESOLVED`
- [x] Pedido já aprovado recebe `409 REQUEST_RESOLVED`
- [x] Criar, liberar e recusar gravam `AuthAuditLog` sem o valor do cookie
- [x] Gate: `npm test -- lib/access-requests/access-request-service.test.ts`
- [x] Test count: 12 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(admin-access): approve or reject an access request`

---

### T16: Gate na recusa e no primeiro login

**What**: A recusa elegível emite o ticket. Membro ativo sem `authUserId` entra no `create-user` e é ligado.
**Where**: `lib/auth/access-gate.ts`
**Depends on**: T14
**Reuses**: `linkAuthUserToMember` e `findActiveMemberByEmail`
**Requirement**: ADM-18, ADM-20, ADM-28, ADM-44

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] E-mail verificado sem membro e sem erro de convite chama o setter com o ticket
- [x] E-mail não verificado, conta desativada ou convite de outro e-mail não chama o setter
- [x] `create-user` de membro ativo sem `authUserId` passa, e `completeOAuthSignIn` grava o vínculo
- [x] Membro ativo já vinculado em `create-user` continua `no_access`
- [x] Login aceito apaga o cookie quando o setter de limpeza existe
- [x] Sem setter, os testes atuais do gate continuam iguais
- [x] Gate: `npm test -- lib/auth/access-gate.test.ts`
- [x] Test count: a suíte anterior passa, mais 4 testes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(admin-access): issue an access ticket when Google sign-in is refused`

---

### T17: Rota de solicitar acesso

**What**: `POST /api/access-requests` lê o cookie e grava o pedido.
**Where**: `app/api/access-requests/route.ts`
**Depends on**: T15
**Reuses**: `readAccessTicket` e `submitAccessRequest`
**Requirement**: ADM-21, ADM-23, ADM-24

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Cookie válido cria ou atualiza o pedido, apaga o cookie e responde 200 com a mensagem "Pedido enviado. Aguarde o administrador liberar o acesso."
- [x] Cookie ausente, vencido ou inválido responde 400 `ACCESS_TICKET_INVALID` e não grava
- [x] A rota não exige sessão
- [x] Gate: `npm test -- app/api/access-requests/route.test.ts`
- [x] Test count: 3 tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(admin-access): accept an access request from the signed cookie`

---

### T18: Rota de liberar pedido

**What**: `POST /api/access-requests/{id}/approve`.
**Where**: `app/api/access-requests/[id]/approve/route.ts`
**Depends on**: T15
**Reuses**: `approveAccessRequest`
**Requirement**: ADM-27, ADM-29, ADM-33

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Admin ou gestor com papéis válidos recebe 200 e o membro existe
- [x] Gestor enviando `admin` recebe 403 e o pedido segue pendente
- [x] Segundo approve recebe 409 `REQUEST_RESOLVED`
- [x] Quem não tem `users:manage` recebe 403
- [x] Gate: `npm test -- app/api/access-requests/[id]/approve/route.test.ts`
- [x] Test count: 4 tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(admin-access): add the access-request approval route`

---

### T19: Rota de recusar pedido

**What**: `POST /api/access-requests/{id}/reject`.
**Where**: `app/api/access-requests/[id]/reject/route.ts`
**Depends on**: T15
**Reuses**: `rejectAccessRequest`
**Requirement**: ADM-32

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Admin ou gestor marca o pedido como recusado e ele sai da lista de pendentes
- [x] Quem não tem `users:manage` recebe 403
- [x] Pedido já resolvido recebe 409 `REQUEST_RESOLVED`
- [x] Gate: `npm test -- app/api/access-requests/[id]/reject/route.test.ts`
- [x] Test count: 3 tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(admin-access): add the access-request rejection route`

---

### T20: Botão Solicitar acesso

**What**: `/entrar` mostra o botão quando o cookie verifica, e o sucesso mostra a mensagem da spec.
**Where**: `app/entrar/page.tsx`
**Depends on**: T16, T17
**Reuses**: o formulário atual de `signInWithGoogle`
**Requirement**: ADM-19, ADM-24

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Cookie válido renderiza o botão "Solicitar acesso"
- [x] Sem cookie, o botão não aparece
- [x] `?requested=1` mostra "Pedido enviado. Aguarde o administrador liberar o acesso."
- [x] O clique chama `POST /api/access-requests`
- [x] Gate: `npm test -- app/entrar/page.test.tsx`
- [x] Test count: 3 tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(admin-access): offer access request after a refused Google sign-in`

---

### Phase 6: Tela

### T21: Painel de membros

**What**: Extrair a lista de membros para um painel, com o mesmo comportamento de hoje.
**Where**: `components/users/members-panel.tsx`
**Depends on**: T12
**Reuses**: o bloco de membros de `components/users/users-admin.tsx`
**Requirement**: ADM-36

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] O painel salva papéis e desativa, inclusive chave personalizada
- [x] Gestor não altera um membro admin
- [x] `LAST_ADMIN` continua com a mensagem atual
- [x] Gate: `npm test -- components/users/members-panel.test.tsx`
- [x] Test count: 3 tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `refactor(admin-access): extract the members panel`

---

### T22: Painel de convites

**What**: Extrair o formulário e a lista de convites pendentes.
**Where**: `components/users/invites-panel.tsx`
**Depends on**: T21
**Reuses**: o bloco de convite de `components/users/users-admin.tsx`
**Requirement**: ADM-36

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Gerar convite, copiar link, WhatsApp e revogar continuam
- [x] O formulário lista papéis do catálogo, e esconde `admin` para o gestor
- [x] Gate: `npm test -- components/users/invites-panel.test.tsx`
- [x] Test count: 3 tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `refactor(admin-access): extract the invites panel`

---

### T23: Painel de papéis

**What**: Catálogo com criar, renomear e apagar só para admin.
**Where**: `components/users/roles-panel.tsx`
**Depends on**: T22
**Reuses**: `ds-input`, `ds-button` e os rótulos de capacidade do design
**Requirement**: ADM-02, ADM-38, ADM-40

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Admin vê os quatro papéis de sistema sem ação de apagar, e o formulário de papel novo
- [x] Gestor vê a lista sem criar, renomear ou apagar
- [x] Erro `ROLE_IN_USE` e `SYSTEM_ROLE` aparecem na tela
- [x] Gate: `npm test -- components/users/roles-panel.test.tsx`
- [x] Test count: 3 tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(admin-access): add the role catalog panel`

---

### T24: Painel de pedidos

**What**: Fila de pendentes com papéis, grupos, Liberar e Recusar.
**Where**: `components/users/requests-panel.tsx`
**Depends on**: T23
**Reuses**: o padrão de checkbox de papéis do convite
**Requirement**: ADM-26, ADM-27, ADM-32

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] A lista mostra nome, e-mail e data
- [x] Liberar envia papéis e grupos para a rota de approve
- [x] Recusar chama a rota de reject e tira a linha
- [x] `403` ao incluir `admin` sendo gestor mostra "Sem permissão para esta ação."
- [x] Gate: `npm test -- components/users/requests-panel.test.tsx`
- [x] Test count: 3 tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(admin-access): add the access-request queue panel`

---

### T25: Abas de usuários

**What**: A casca troca Membros, Convites, Pedidos e Papéis por `?aba=`.
**Where**: `components/users/users-admin.tsx`
**Depends on**: T24
**Reuses**: os quatro painéis
**Requirement**: ADM-35

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] As quatro abas existem com esses nomes
- [x] `?aba=pedidos` abre Pedidos. Valor desconhecido abre Membros
- [x] Trocar de aba faz `router.replace` sem perder a página
- [x] Gate: `npm test -- components/users/users-admin.test.tsx`
- [x] Test count: 3 tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(admin-access): split user admin into tabs`

---

### T26: Página /usuarios com as quatro abas

**What**: A página carrega catálogo e pedidos e mantém o gate de quem pode entrar.
**Where**: `app/usuarios/page.tsx`
**Depends on**: T25
**Reuses**: `requirePageActor`, `listMembers`, `listPendingInvites`
**Requirement**: ADM-35, ADM-37, ADM-38

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Admin e gestor abrem a página com as quatro abas
- [x] Quem não tem `users:manage` vê "Acesso restrito"
- [x] A página passa `canGrantAdmin` para esconder a edição de papéis do gestor
- [x] Gate: `npm test -- app/usuarios/page.test.tsx && npm test && npx tsc --noEmit`
- [x] Test count: 3 tests pass na página, e a suíte inteira passa

**Tests**: integration
**Gate**: full

**Commit**: `feat(admin-access): load roles and access requests on the users page`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phase 1:  T1 → T2 → T3 → T4
Phase 2:  T5 → T6
          T5 → T7
Phase 3:  T8 → T9 → T10 → T11
Phase 4:  T12 → T13
Phase 5:  T14 → T15 → T17 → T20
          T14 → T16 → T20
          T15 → T18
          T15 → T19
Phase 6:  T21 → T22 → T23 → T24 → T25 → T26
```

26 tarefas. Na Execute, oferecer lotes só se o usuário aceitar. O corte sugerido, sem partir fase: lote 1 = fases 1 e 2 (T1–T7), lote 2 = fases 3 e 4 (T8–T13), lote 3 = fase 5 (T14–T20), lote 4 = fase 6 (T21–T26).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Tabelas | 1 schema | Granular |
| T2: Presets | 1 módulo | Granular |
| T3: Actor | 1 módulo | Granular |
| T4: Carga do ator | 1 módulo | Granular |
| T5: can() | 1 módulo | Granular |
| T6: canPerform | 1 módulo | Granular |
| T7: Header | 1 página de layout | Granular |
| T8: Chave | 1 função | Granular |
| T9: Serviço do catálogo | 1 serviço | Granular |
| T10: GET/POST papéis | 1 rota | Granular |
| T11: PATCH/DELETE papel | 1 rota | Granular |
| T12: Membros | 1 serviço | Granular |
| T13: Convite | 1 serviço | Granular |
| T14: Ticket | 1 módulo | Granular |
| T15: Serviço do pedido | 1 serviço | Granular |
| T16: Gate | 1 módulo | Granular |
| T17: POST pedido | 1 rota | Granular |
| T18: Approve | 1 rota | Granular |
| T19: Reject | 1 rota | Granular |
| T20: /entrar | 1 página | Granular |
| T21: Painel membros | 1 componente | Granular |
| T22: Painel convites | 1 componente | Granular |
| T23: Painel papéis | 1 componente | Granular |
| T24: Painel pedidos | 1 componente | Granular |
| T25: Abas | 1 componente | Granular |
| T26: Página /usuarios | 1 página | Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | sem seta de entrada | Match |
| T2 | T1 | T1 to T2 | Match |
| T3 | T2 | T2 to T3 | Match |
| T4 | T3 | T3 to T4 | Match |
| T5 | T4 | T4 fica na fase anterior | Match |
| T6 | T5 | T5 to T6 | Match |
| T7 | T5 | T5 to T7 | Match |
| T8 | T4 | T4 fica na fase 1 | Match |
| T9 | T8, T3 | T8 to T9. T3 fica na fase 1 | Match |
| T10 | T9 | T9 to T10 | Match |
| T11 | T10 | T10 to T11 | Match |
| T12 | T9, T6 | ambos em fases anteriores | Match |
| T13 | T12 | T12 to T13 | Match |
| T14 | T13 | T13 fica na fase 4 | Match |
| T15 | T14, T9, T12 | T14 to T15. T9 e T12 em fases anteriores | Match |
| T16 | T14 | T14 to T16 | Match |
| T17 | T15 | T15 to T17 | Match |
| T18 | T15 | T15 to T18 | Match |
| T19 | T15 | T15 to T19 | Match |
| T20 | T16, T17 | T16 to T20 e T17 to T20 | Match |
| T21 | T12 | T12 fica na fase 4 | Match |
| T22 | T21 | T21 to T22 | Match |
| T23 | T22 | T22 to T23 | Match |
| T24 | T23 | T23 to T24 | Match |
| T25 | T24 | T24 to T25 | Match |
| T26 | T25 | T25 to T26 | Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: Tabelas | Prisma / schema | none | none | OK |
| T2: Presets | Capacidades | unit | unit | OK |
| T3: Actor | Actor | unit | unit | OK |
| T4: Carga do ator | Actor | unit | unit | OK |
| T5: can() | Política | unit | unit | OK |
| T6: canPerform | Política | unit | unit | OK |
| T7: Header | Páginas e painéis | integration | integration | OK |
| T8: Chave | Catálogo | unit | unit | OK |
| T9: Serviço do catálogo | Catálogo | unit | unit | OK |
| T10: GET/POST papéis | Route handlers | integration | integration | OK |
| T11: PATCH/DELETE papel | Route handlers | integration | integration | OK |
| T12: Membros | Catálogo, convite, membro | unit | unit | OK |
| T13: Convite | Catálogo, convite, membro | unit | unit | OK |
| T14: Ticket | Access gate e ticket | unit | unit | OK |
| T15: Serviço do pedido | Pedido | unit | unit | OK |
| T16: Gate | Access gate e ticket | unit | unit | OK |
| T17: POST pedido | Route handlers | integration | integration | OK |
| T18: Approve | Route handlers | integration | integration | OK |
| T19: Reject | Route handlers | integration | integration | OK |
| T20: /entrar | Páginas e painéis | integration | integration | OK |
| T21: Painel membros | Páginas e painéis | integration | integration | OK |
| T22: Painel convites | Páginas e painéis | integration | integration | OK |
| T23: Painel papéis | Páginas e painéis | integration | integration | OK |
| T24: Painel pedidos | Páginas e painéis | integration | integration | OK |
| T25: Abas | Páginas e painéis | integration | integration | OK |
| T26: Página /usuarios | Páginas e painéis | integration | integration | OK |
