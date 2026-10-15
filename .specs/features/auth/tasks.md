# Autenticação e autorização - Tasks

**Design:** `.specs/features/auth/design.md`  
**Spec:** `.specs/features/auth/spec.md`  
**Status:** Execute em andamento (P1/P2 parcialmente implementados)

## Test Coverage Matrix

> Guidelines: `package.json`, `vitest`; amostras em `lib/auth/load-actor.test.ts`, `lib/auth/access-gate.test.ts`, `app/import/page.test.tsx`. Sem threshold de cobertura documentado — defaults fortes.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Política e Actor | unit | Matriz AUTH-28; papéis acumuláveis | `lib/auth/*.test.ts`, `lib/setlists/setlist-policy.test.ts` | `npm test -- lib/auth` |
| Convites e membros | integration | ACs AUTH-09..20, AUTH-44..48 | `lib/invites/*.test.ts`, `lib/members/*.test.ts` | `npm test -- <target>` |
| OAuth / AccessGate | integration | AUTH-01..04, AUTH-16..17, AUTH-42 (fluxo simulado) | `lib/auth/access-gate.test.ts` | `npm test -- lib/auth/access-gate.test.ts` |
| Route handlers auth | integration | 401/403/409 em invites e members | `app/api/invites/**/*.test.ts`, `app/api/members/**/*.test.ts` | `npm test -- <target>` |
| Páginas e UI | integration | `/entrar`, `/convite`, `/usuarios`, visibilidade pública | `app/**/*.test.tsx`, `components/**/*.test.tsx` | `npm test -- <target>` |
| Prisma / schema | none | migration + build gate | `prisma/**` | build gate |

## Gate Check Commands

| Gate | Comando |
| --- | --- |
| Quick | `npm test -- <alvo>` |
| Full | `npm test && npx tsc --noEmit` |
| Build | `npm test && npm run lint && npm run build` |

---

## Phase 1: Fundação Better Auth + Prisma ✅

### T1: Schema AuthUser, UserRole, Invite, AuthAuditLog, Song.publicLyrics ✅

**Reqs:** AUTH-21, AUTH-40, AD-011  
**Done when:** migration aplicada; seed com papéis simulados.

### T2: Better Auth, AccessGate, getCurrentActor ✅

**Reqs:** AUTH-01..08, AUTH-42..43, AUTH-57..61  
**Done when:** `/api/auth/[...all]`, `validateUserInfo`, hooks after, proxy cookie.

### T3: Permissions, ApiGuard, rotas persistência ✅

**Reqs:** AUTH-28, AUTH-31..33  
**Done when:** `wrapPersistenceRoute` com `music:read` / `music:write`.

---

## Phase 2: Convites e entrada ⏳

### T4: APIs de convite ✅

**Reqs:** AUTH-09..13, AUTH-19..20, AUTH-62  
**Done when:** `POST/GET /api/invites`, `DELETE /api/invites/{id}`.

### T5: Páginas `/entrar` e `/convite/{token}` ✅

**Reqs:** AUTH-14, AUTH-15, AUTH-18  
**Done when:** preview do convite + botão Google; rate limit inválidos.

### T6: UI `/usuarios` (convite WhatsApp, lista, revogar) ✅

**Reqs:** AUTH-14, AUTH-19, AUTH-44  
**Done when:** `app/usuarios/page.tsx`, `components/users/users-admin.tsx`.

### T7: Testes de rota convite e rate limit ⏳

**Reqs:** AUTH-11..13, AUTH-20  
**Done when:** `app/api/invites/route.test.ts` cobre 403 gestor+admin, 409, 429.

**Status parcial:** `route.test.ts` + `[inviteId]/route.test.ts` cobrem 403, 409, 400, revoke; **AUTH-20 (429)** ainda sem teste de rota.

---

## Phase 3: Membros e papéis ⏳

### T8: APIs members ✅

**Reqs:** AUTH-45..48  
**Done when:** `GET /api/members`, `PUT .../roles`, `POST .../deactivate`.

### T9: UI edição de papéis e desativar ✅

**Reqs:** AUTH-44..46  
**Done when:** checkboxes + LAST_ADMIN / gestor vs admin na UI.

### T10: Testes member-service e rotas ✅ (rotas)

**Reqs:** AUTH-45..48, AUTH-24..27  
**Done when:** `lib/members/member-service.test.ts`, rotas members.

**Feito:** `app/api/members/route.test.ts`, `[userId]/roles/route.test.ts` (LAST_ADMIN, gestor vs admin). Service unit tests opcionais.

---

## Phase 4: Letras públicas ⏳

### T11: PublicLyrics server + `/letras` ✅

**Reqs:** AUTH-35..39  
**Done when:** `lib/public-lyrics`, `app/page.tsx` anônimo.

### T12: Campo "Visível ao público" ✅

**Reqs:** AUTH-40, AUTH-41  
**Done when:** `PublicVisibilityField` no import e detalhe da música; `publicLyrics` na API.

### T13: Testes public-lyrics e campo UI ⏳

**Reqs:** AUTH-37, AUTH-41  
**Done when:** `lib/public-lyrics/*.test.ts`, teste do componente de ajuda.

---

## Phase 5: Import por permissão ⏳

### T14: Remover segredo AD-005 ✅

**Reqs:** AUTH-49..51  
**Done when:** import só com `can(import)`; rotas session removidas.

**Feito:** `canImport` por permissão; `/import` sem desbloqueio; session `404`; removidos unlock UI, `import-session`, rate limit de segredo.

### T15: ImportLog userId ✅

**Reqs:** AUTH-52  
**Done when:** preview/save gravam `userId`.

**Feito:** `lib/import-access/import-log.ts` + `import-log.test.ts`.

---

## Phase 6: OAuth E2E (integração) ⏳

### T16: Fluxo Google OAuth simulado ✅

**Reqs:** AUTH-01..04, AUTH-16..17, AUTH-42  
**Done when:** `lib/auth/access-gate.test.ts` verde com SQLite temporário.

### T17: Auditoria AuthAuditLog ⏳

**Reqs:** AUTH-53..54  
**Done when:** testes assertam ações sem token.

---

## Verificação final

Rodar Verifier independente → preencher `validation.md` com PASS/FAIL e evidências `file:line`.
