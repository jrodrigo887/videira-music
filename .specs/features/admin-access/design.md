# Administração de papéis e pedidos de acesso — Design

**Spec**: `.specs/features/admin-access/spec.md`
**Status**: Approved

---

## Architecture Overview

O catálogo e o pedido entram no mesmo fluxo da AD-011 e da AD-012. O Better Auth continua dono do Google e da sessão. `validateUserInfo` decide quem pode criar conta. `getCurrentActor()` carrega papéis e capacidades. `can` e `canPerform` passam a olhar capacidade.

Papéis de sistema não têm capacidade no banco. A constante `SYSTEM_ROLE_CAPABILITIES` é a fonte. Papel personalizado guarda o subconjunto em `RoleDefinition.capabilities`. `UserRole.role` continua uma string: a chave do papel.

O pedido não cria sessão. Na recusa elegível, o gate assina um ticket e grava o cookie. `POST /api/access-requests` lê esse cookie e grava um `AccessRequest`. Liberar cria o `User` ativo sem `authUserId`. O próximo `create-user` desse e-mail passa no gate, e `completeOAuthSignIn` liga a conta, como já faz para membro ativo sem vínculo.

```mermaid
graph TD
    Recusa[Google recusa e-mail verificado] --> Gate[validateUserInfo]
    Gate --> Cookie[cookie videira_access_ticket]
    Cookie --> Entrar[/entrar Solicitar acesso]
    Entrar --> Pedido[AccessRequest pendente]
    Pedido --> Liberar[approve cria User ativo]
    Liberar --> Login[proximo login Google]
    Login --> Link[completeOAuthSignIn liga authUserId]
    Papel[RoleDefinition] --> Actor[getCurrentActor]
    Actor --> Can[can e canPerform]
```

Abordagem escolhida, já aceita no plano: capacidades fechadas no código para papéis de sistema, JSON só no papel personalizado, ticket assinado no cookie. Uma matriz livre de permissões e um papel único por pessoa ficaram de fora.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `can` / `Permission` | `lib/auth/permissions.ts` | Trocar os `hasRole` de gestor e líder por capacidade. Manter `hasRole(..., "admin")` para conceder `admin`. |
| `canPerform` | `lib/setlists/setlist-policy.ts` | `setlists:all` no lugar de `isOrganizationManager` para setlist. `teams:manage` no lugar dele em `manageTeams`. Líder de grupo continua `teamRoleOf === "leader"`. |
| `loadActorForUser` | `lib/auth/load-actor.ts` | Resolver capacidades aqui. Parar de descartar chave fora dos quatro papéis. |
| `validateUserInfo` / `completeOAuthSignIn` | `lib/auth/access-gate.ts` | Ticket na recusa. `create-user` de membro ativo sem `authUserId` passa. O vínculo existente em `linkAuthUserToMember` permanece. |
| `setMemberRoles` / `createInvite` | `lib/members/member-service.ts`, `lib/invites/invite-service.ts` | Validar chaves no catálogo. Concessão de `admin` igual. `reconcileSoleWorshipLeader` só conta a chave `worship_leader`. |
| `UsersAdmin` | `components/users/users-admin.tsx` | Virar casca das abas. Convite, pendentes e membros saem para painéis, com o mesmo `fetch` e os mesmos códigos de erro. |
| `AuthAuditLog` | `prisma/schema.prisma` | Mesmo formato de `writeAudit` dos convites. Ações novas, sem valor de cookie. |
| Página `/usuarios` | `app/usuarios/page.tsx` | Continua o gate `users:manage`. Passa papéis e pedidos junto com membros, convites e grupos. |

### Integration Points

| System | Integration Method |
| --- | --- |
| Better Auth | `user.validateUserInfo` em `lib/auth/better-auth.ts` segue igual. O ticket é efeito da recusa, não uma sessão. |
| Cookie | `cookies()` de `next/headers` no callback, que já é Route Handler. Segredo: `readAuthEnvConfig().secret`. |
| Prisma | Migration nova em `prisma/migrations` para `RoleDefinition` e `AccessRequest`. `UserRole.role` não ganha FK. |
| Header | `app/layout.tsx` mostra Grupos por `teams:manage` e Usuários por `users:manage`. |

---

## Components

### Capabilities

- **Purpose**: Conjunto fechado e presets dos papéis de sistema.
- **Location**: `lib/auth/capabilities.ts`
- **Interfaces**:
  - `CAPABILITIES` - as sete chaves da spec
  - `systemCapabilities(key: string): readonly Capability[] | undefined` - preset, ou `undefined` se a chave não for de sistema
  - `isCapability(value: string): value is Capability`
- **Dependencies**: nenhuma
- **Reuses**: os nomes já usados em `Permission` (`users:invite`, `users:manage`, `teams:manage`, `music:write`, `import`) mais `setlists:all` e `setlists:led`

### Actor

- **Purpose**: Carregar a união das capacidades na mesma ida ao banco do ator.
- **Location**: `lib/auth/actor.ts`, `lib/auth/load-actor.ts`
- **Interfaces**:
  - `Actor` de usuário ganha `capabilities: readonly Capability[]`
  - `hasCapability(actor, capability, organizationId): boolean`
  - `hasRole` permanece para a chave de sistema, em especial `admin`
- **Dependencies**: `RoleDefinition` da igreja do usuário
- **Reuses**: `loadActorForUser` e `loadActorForAuthUserId`. Chave desconhecida é ignorada. Sem nenhum papel restante, o ator segue anônimo.

### Permissions e política de setlist

- **Purpose**: Uma decisão por capacidade, com as exceções da spec.
- **Location**: `lib/auth/permissions.ts`, `lib/setlists/setlist-policy.ts`
- **Interfaces**: `can` e `canPerform` mantêm a assinatura pública.
- **Dependencies**: `hasCapability`, `hasRole`, `teamRoleOf`
- **Reuses**: a matriz atual vira preset. `users:grantRole` com `role: "admin"` exige `hasRole(actor, "admin")`. As outras chaves exigem `users:manage`. `music:read` exige membro ativo da igreja. `setlists:all` edita qualquer setlist da igreja. `setlists:led` só entra se `teamRoleOf` for `leader`. `NOT_A_WORSHIP_LEADER` passa a significar ausência de `setlists:led`.

### Catálogo

- **Purpose**: Criar, renomear e apagar papel personalizado.
- **Location**: `lib/roles/role-service.ts`, `lib/roles/role-key.ts`
- **Interfaces**:
  - `listRoles(prisma, actor): Promise<RoleRecord[]>`
  - `createRole(prisma, actor, { label, capabilities }): Promise<RoleRecord>`
  - `updateRole(prisma, actor, key, { label?, capabilities? }): Promise<RoleRecord>`
  - `deleteRole(prisma, actor, key): Promise<void>`
  - `roleKeyFromLabel(label: string): string`
- **Dependencies**: `can` não basta. Criar, alterar e apagar exigem `hasRole(actor, "admin")`. Listar exige `users:manage`.
- **Reuses**: erro no formato `{ status, code }` de `MemberServiceError`. Auditoria no formato de `writeAudit`. `ensureSystemRoles` faz upsert dos quatro papéis na primeira lista da igreja. Capacidades de sistema gravadas no banco são ignoradas na resolução. O serviço recusa mudá-las com `409 SYSTEM_ROLE`.

`roleKeyFromLabel` tira espaços das pontas, passa a minúsculas, remove acento e troca o que não for `a-z`, `0-9` por hífen. Hífens repetidos viram um. Nome fora de 2 a 40 caracteres: `400 INVALID_ROLE`. Nome ou chave já usados, sem diferença de maiúsculas no nome: `409 ROLE_EXISTS`. Apagar com `UserRole` ou convite pendente citando a chave: `409 ROLE_IN_USE`.

### Pedido de acesso

- **Purpose**: Ticket, fila e liberação.
- **Location**: `lib/access-requests/access-ticket.ts`, `lib/access-requests/access-request-service.ts`
- **Interfaces**:
  - `signAccessTicket({ email, name, expiresAt }): string`
  - `readAccessTicket(token, now): { email, name } | undefined`
  - `submitAccessRequest(prisma, token): Promise<void>`
  - `listPendingAccessRequests(prisma, actor)`
  - `approveAccessRequest(prisma, actor, id, { roles, teamIds })`
  - `rejectAccessRequest(prisma, actor, id)`
- **Dependencies**: `readAuthEnvConfig().secret` para o HMAC. `normalizeEmail`. `reconcileSoleWorshipLeader` só se os papéis incluírem a chave `worship_leader`.
- **Reuses**: regras de concessão de `createInvite` e criação de membro de `acceptInvite`, sem consumir convite.

O ticket é `base64url(payload).base64url(hmac-sha256)`. Payload: e-mail normalizado, nome e `exp` em 15 minutos. Comparação do HMAC em tempo constante. Cookie `videira_access_ticket`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=900`. `Secure` quando `NODE_ENV=production`.

`validateUserInfo` chama o setter do cookie só quando a recusa é elegível: e-mail verificado, sem membro ativo, sem conta desativada, sem erro de convite. O setter entra por parâmetro opcional. Em produção ele usa `cookies()`. Nos testes atuais do gate, a ausência do setter não muda o `{ error }` já coberto. Login aceito e pedido gravado apagam o cookie.

`submitAccessRequest` faz upsert pela chave única `(organizationId, email)`. Pendente atualiza nome e `requestedAt`. Recusado volta a `pending`. Aprovado é terminal: o gate nem emite ticket, porque o membro ativo entra.

`approveAccessRequest` roda numa transação. `updateMany` onde `status = pending`. Zero linhas: `409 REQUEST_RESOLVED`. E-mail de membro ativo: `409 USER_EXISTS`. E-mail de desativado: `409 USER_DEACTIVATED`. Papel vazio, chave fora do catálogo ou `admin` concedido por quem não é admin: a transação não abre, `400 INVALID_ROLE` ou `403 FORBIDDEN`. Grupo arquivado ou de outra igreja: `400 INVALID_TEAM`. Participação no grupo: `leader` se a união tiver `setlists:led`, senão `member`.

`create-user` em `validateUserInfo`: membro ativo sem `authUserId` retorna sucesso. Membro ativo já vinculado continua `no_access` nesse ramo. `findActiveMemberByEmail` passa a devolver `authUserId`.

### HTTP

- **Purpose**: Mesmos códigos da spec, no formato `{ error: { code } }` já usado em `/api/members` e `/api/invites`.
- **Location**:
  - `app/api/roles/route.ts` - `GET`, `POST`
  - `app/api/roles/[key]/route.ts` - `PATCH`, `DELETE`
  - `app/api/access-requests/route.ts` - `POST` público, lê o cookie, sem ator
  - `app/api/access-requests/[id]/approve/route.ts` - `POST`
  - `app/api/access-requests/[id]/reject/route.ts` - `POST`
- **Dependencies**: serviços acima e `requireActor` / `can`
- **Reuses**: o padrão de status dos route handlers de membros

A lista de pedidos e o catálogo carregam na página, como membros e convites. O `POST` público existe para o botão devolver `400 ACCESS_TICKET_INVALID` de verdade. O cookie `HttpOnly` segue no `fetch` same-origin.

### Tela

- **Purpose**: Quatro abas em `/usuarios`, e o botão em `/entrar`.
- **Location**:
  - `app/usuarios/page.tsx` lê `aba`. Valores: `membros`, `convites`, `pedidos`, `papeis`. Outro valor cai em `membros`.
  - `components/users/users-admin.tsx` só alterna a aba e faz `router.replace` com `?aba=`.
  - `components/users/members-panel.tsx`, `invites-panel.tsx` - o que a tela já faz
  - `components/users/requests-panel.tsx` - fila, papéis, grupos, Liberar e Recusar
  - `components/users/roles-panel.tsx` - catálogo. Sem criar, renomear ou apagar se `canGrantAdmin` for falso.
  - `app/entrar/page.tsx` - botão "Solicitar acesso" se o cookie verifica. Mensagem de sucesso em `?requested=1`: "Pedido enviado. Aguarde o administrador liberar o acesso."
- **Dependencies**: props já passadas pela página, mais `roles` e `requests`
- **Reuses**: classes `ds-card`, `ds-button`, `ds-input`. Rótulos das capacidades: Convidar, Gerenciar membros, Gerenciar grupos, Editar músicas, Importar, Setlists de todos os grupos, Setlists dos grupos que lidera.

---

## Data Models

### RoleDefinition

```typescript
interface RoleDefinition {
  id: string
  organizationId: string
  key: string
  label: string
  system: boolean
  capabilities: Capability[]
  createdAt: Date
  updatedAt: Date
}
```

**Relationships**: N por `Organization`. Único em `(organizationId, key)`. O nome único sem diferença de maiúsculas é checado no serviço. Sem FK a partir de `UserRole` ou de `Invite.roles`.

### AccessRequest

```typescript
interface AccessRequest {
  id: string
  organizationId: string
  email: string
  name: string
  status: "pending" | "approved" | "rejected"
  requestedAt: Date
  resolvedAt: Date | null
  resolvedByUserId: string | null
  createdUserId: string | null
}
```

**Relationships**: um por `(organizationId, email)`. `createdUserId` aponta o `User` criado na liberação. O registro não é apagado.

### Actor

```typescript
type UserActor = {
  kind: "user"
  userId: string
  organizationId: string
  roles: readonly string[]
  capabilities: readonly Capability[]
  teams: readonly { teamId: string; role: WorshipTeamRole }[]
}
```

**Relationships**: `capabilities` é derivado. Não é coluna.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| Nome ou capacidade inválidos | `400 INVALID_ROLE` | Mensagem na aba Papéis ou na liberação. Nada é gravado. |
| Nome ou chave repetidos | `409 ROLE_EXISTS` | O papel antigo permanece. |
| Apagar papel de sistema ou mudar as capacidades dele | `409 SYSTEM_ROLE` | A aba não oferece a ação. A API recusa. |
| Apagar papel em uso | `409 ROLE_IN_USE` | O papel permanece. |
| Gestor edita o catálogo, ou gestor libera com `admin` | `403 FORBIDDEN` | Mensagem já usada na tela de usuários. |
| Cookie ausente, vencido ou adulterado | `400 ACCESS_TICKET_INVALID` | O botão não cria pedido. |
| E-mail já é membro ativo | `409 USER_EXISTS` | O pedido continua pendente. |
| E-mail é conta desativada | `409 USER_DEACTIVATED` | O pedido continua pendente. A conta não volta. |
| Duas liberações juntas, ou pedido já resolvido | `409 REQUEST_RESOLVED` | Um único membro. |
| Grupo arquivado ou de outra igreja | `400 INVALID_TEAM` | O pedido continua pendente. |
| `cookies()` fora de um request | O gate ainda devolve o `{ error }` de hoje | Testes do gate que não passam setter continuam válidos. |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| --- | --- | --- | --- |
| `load-actor` descarta qualquer chave fora dos quatro papéis. Com a lista vazia, a pessoa vira anônima. | `lib/auth/load-actor.ts:26` | Um papel personalizado sozinho não entraria. | A carga passa a aceitar chave de sistema ou de `RoleDefinition`, e preenche `capabilities` antes de devolver o ator. |
| `create-user` recusa se já existe membro. | `lib/auth/access-gate.ts:61` | O membro criado na liberação não conseguiria o primeiro login. | Membro ativo sem `authUserId` passa. O vínculo segue em `completeOAuthSignIn`. |
| A URL de erro do login está fixa em `error=google`. | `lib/auth/auth-actions.ts:24` | A aba e o botão não podem depender do código na query. | O botão depende só do cookie. A query `requested=1` é o sucesso do `POST`, não a recusa. |
| Não há `cookies()` no projeto. Não confirmei, na documentação do Better Auth 1.7, se o `Set-Cookie` feito dentro de `validateUserInfo` sobrevive ao redirect de erro. | `lib/auth/access-gate.ts:35` | ADM-18 falha se o cookie não chegar em `/entrar`. | O setter é injetável. O teste do gate verifica que a recusa elegível chama o setter. Um teste do route handler verifica o `Set-Cookie` na resposta. Se o redirect do Better Auth descartar o header, o setter muda para um wrapper de `app/api/auth/[...all]/route.ts` na resposta de redirect, sem mudar o contrato do ticket. |
| `users-admin.tsx` junta convite, pendentes e membros num único client component. | `components/users/users-admin.tsx:261` | As abas novas aumentam um arquivo que já concentra três fluxos. | A casca só troca a aba. Cada fluxo fica num painel. |
| `isOrganizationManager` ainda abre setlist e grupos. | `lib/setlists/setlist-policy.ts:53` | Papel personalizado com `setlists:all` ou `teams:manage` não valeria. | A política e o header passam a usar capacidade. `reconcileSoleWorshipLeader` continua filtrando a chave `worship_leader`. |
| Listas de papéis válidos estão copiadas em membros, convites e carga do ator. | `lib/members/member-service.ts:8` | Uma chave nova seria `400` num módulo e aceita no outro. | Uma função `isAssignableRole` no catálogo. Os três módulos passam a chamá-la. |
| AD-004 e AD-011 falam em SQLite. O datasource atual do Prisma é PostgreSQL. | `prisma/schema.prisma:4` | Uma migration escrita para SQLite não rodaria. | Esta feature gera a migration pelo Prisma no datasource que já está no schema. Não troca o provider. |
| Fixtures de ator só têm `roles`. | `lib/setlists/setlist-policy.test.ts:19` | A matriz antiga quebra quando `can` passar a ler `capabilities`. | Helper de teste monta `capabilities` pelos presets de sistema. A matriz dos quatro papéis continua sendo o teste de ADM-12. |

---

## Tech Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Capacidades de sistema | Constante no código. Linha no banco só para rótulo e `system: true`. | Um update no banco não enfraquece o admin. |
| `UserRole` sem FK | A chave é string, validada no serviço. | Convite guarda papéis em JSON. FK obrigaria a migrar os dois. |
| Ticket | HMAC com `BETTER_AUTH_SECRET`, não uma linha de desafio. | A spec pede cookie assinado de 15 minutos. Não há segunda tabela para o que o cookie já prova. |
| Aba | `?aba=` na página, default `membros`. | Dá para abrir Pedidos por link. Valor desconhecido não quebra a rota. |
| Liberação | Cria `User` na hora, sem sessão. | A pessoa aparece em Membros antes do próximo Google. O vínculo já existe em `linkAuthUserToMember`. |
| Rótulos na tela | Os sete nomes listados no componente Tela. | Discrição registrada no context. Cada rótulo mapeia uma capacidade da spec. |

AD-012 em `.specs/STATE.md` registra o catálogo e o pedido como regra do projeto. As linhas desta tabela ficam nesta feature.
