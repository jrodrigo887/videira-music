# auth Validation

**Result**: FAIL

**Date**: 2026-10-15  
**Spec**: `.specs/features/auth/spec.md`  
**Diff range**: working tree (feature auth)  
**Verifier**: independent pass (author ≠ verifier); evidence `file:line` or test anchor

**Verdict:** **FAIL** (gate lint apenas). Tasks T1–T17 fechadas; lacunas P1 **AUTH-15** e **AUTH-23** corrigidas nesta rodada. P3 (AUTH-55..56) **Deferred**. Remaining blocker: `npm run lint` (12 erros, maior parte fora do auth).

---

## Gate

| Gate | Status | Evidence |
| ---- | ------ | -------- |
| `npm test` | PASS | 633 tests, 65 files (2026-10-15 run) |
| `npm run build` | PASS | `next build` + `tsc` OK após fix em `public-lyrics.test.ts` |
| `npm run lint` | **FAIL** | 12 errors (ex.: `react-hooks/*` em páginas, `@typescript-eslint/no-unused-vars` em setlists/import) |

---

## Task Completion

| Task | Status |
| ---- | ------ |
| T1–T17 | ✅ (ver `tasks.md`) |

---

## Requirement Traceability (62 ACs)

| ID | Status | Evidence |
| --- | --- | --- |
| AUTH-01 | Verified | `lib/auth/access-gate.test.ts:77` sign-in membro ativo |
| AUTH-02 | Verified | `lib/auth/access-gate.test.ts:77` `no_access` |
| AUTH-03 | Verified | `lib/auth/access-gate.test.ts:70` `email_not_verified` |
| AUTH-04 | Verified | `lib/auth/access-gate.test.ts:83` desativado → `no_access` |
| AUTH-05 | Implemented | `lib/auth/better-auth.ts:41-44` `expiresIn` 30d, `updateAge` 1d; sem teste de atributos de cookie |
| AUTH-06 | Implemented | `lib/auth/auth-actions.ts:37-42` `signOut`; `app/layout.tsx:83` action |
| AUTH-07 | Verified | `lib/auth/load-actor.test.ts:28`; `lib/auth/current-actor.ts:30` |
| AUTH-08 | Implemented | `lib/auth/auth-config.ts:50` `AUTH_MISCONFIGURED`; `app/entrar/page.tsx:12-13` indisponível |
| AUTH-09 | Verified | `app/api/invites/route.test.ts:33` create 201 + link |
| AUTH-10 | Implemented | `lib/invites/invite-token.ts:4-9` 32 bytes + SHA-256 |
| AUTH-11 | Verified | `app/api/invites/route.test.ts:51` gestor + admin → 403 |
| AUTH-12 | Verified | `app/api/invites/route.test.ts:68` 409 `USER_EXISTS` |
| AUTH-13 | Implemented | `lib/invites/invite-service.ts:121-129` revoga pendentes; sem teste dedicado |
| AUTH-14 | Implemented | `components/users/users-admin.tsx:347-350` Copiar + WhatsApp |
| AUTH-15 | Verified | `app/convite/[code]/page.tsx:68-74` grupos convidados |
| AUTH-16 | Verified | `lib/auth/access-gate.test.ts:143` aceite convite |
| AUTH-17 | Implemented | `lib/auth/access-gate.test.ts:188`; `app/entrar/page.tsx:18-19` mismatch |
| AUTH-18 | Implemented | `app/convite/[code]/page.tsx:47-49` mensagem genérica |
| AUTH-19 | Implemented | `components/users/users-admin.tsx` lista + revoke via API |
| AUTH-20 | Verified | `lib/invites/convite-rate-limit-http.test.ts:20`; `proxy.test.ts:19` |
| AUTH-21 | Verified | `lib/auth/load-actor.test.ts:31` papéis não vazios; schema `UserRole` |
| AUTH-22 | Implemented | `prisma/schema.prisma` `WorshipTeamMember.role`; seed líderes |
| AUTH-23 | Verified | `lib/members/member-service.ts:136` + `app/api/teams/[teamId]/leaders/route.test.ts:20` |
| AUTH-24 | Implemented | `lib/members/member-service.ts:16-45` `reconcileSoleWorshipLeader`; sem teste unit |
| AUTH-25 | Implemented | `member-service.ts:29-30` só age com exatamente 1 líder |
| AUTH-26 | Implemented | design: grupo novo sem auto-líder com 2+ WL; via `reconcile` no-op |
| AUTH-27 | Verified | `lib/members/member-service.ts:118-121` remove liderança ao mudar papéis |
| AUTH-28 | Implemented | `lib/auth/permissions.ts:15-48` matriz única `can()` |
| AUTH-29 | Implemented | `proxy.ts:41-45` redirect `/entrar?next=` |
| AUTH-30 | Implemented | `lib/auth/page-gate.ts:8-12` `safeNextPath` |
| AUTH-31 | Implemented | `lib/auth/api-guard.ts:9` 401; rotas via `wrapPersistenceRoute` |
| AUTH-32 | Verified | `app/api/invites/route.test.ts:27` 403 musician |
| AUTH-33 | Implemented | `app/api/songs/[songId]/route.ts:76` `wrapPersistenceRoute`; **sem testes de rota songs** |
| AUTH-34 | Verified | `lib/setlists/setlist-policy.test.ts:145` anônimo + `public` → denied |
| AUTH-35 | Verified | `lib/public-lyrics/public-lyrics.test.ts:103`; `app/page.tsx:37` catálogo anônimo |
| AUTH-36 | Verified | `lib/public-lyrics/public-lyrics.test.ts:188` chart mais recente |
| AUTH-37 | Verified | `lib/public-lyrics/public-lyrics.test.ts:36` sem acordes no payload |
| AUTH-38 | Verified | `lib/public-lyrics/public-lyrics.test.ts:165` |
| AUTH-39 | Implemented | `app/letras/[songId]/page.tsx:31-34` `ImportedBadge`; teste em `toPublicLyrics` |
| AUTH-40 | Implemented | `prisma/schema.prisma:183` default false; `validate-persistence-input.ts:154` |
| AUTH-41 | Verified | `components/songs/public-visibility-field.test.tsx:18` |
| AUTH-42 | Verified | `lib/auth/access-gate.test.ts:104` bootstrap admin |
| AUTH-43 | Implemented | `lib/auth/access-gate.ts:69-77` bootstrap só se `adminCount === 0` |
| AUTH-44 | Implemented | `components/users/users-admin.tsx` lista membros |
| AUTH-45 | Verified | `app/api/members/[userId]/roles/route.test.ts:20` |
| AUTH-46 | Implemented | `lib/members/member-service.ts:175-177` apaga sessões; sem teste E2E 401 |
| AUTH-47 | Verified | `app/api/members/[userId]/roles/route.test.ts:28` `LAST_ADMIN` |
| AUTH-48 | Verified | `app/api/members/[userId]/roles/route.test.ts:38` gestor vs admin |
| AUTH-49 | Verified | `app/import/page.test.tsx:64` workflow líder |
| AUTH-50 | Verified | `app/import/page.test.tsx:49` músico sem permissão |
| AUTH-51 | Verified | `app/api/imports/session/route.test.ts` session 404 |
| AUTH-52 | Verified | `lib/import-access/import-log.test.ts:1` |
| AUTH-53 | Partial | `lib/auth/auth-audit.test.ts:68` create/revoke/accept/roles/deactivate; **liderança reconciliada sem log** |
| AUTH-54 | Verified | `lib/auth/auth-audit.test.ts:82` sem token nos registros |
| AUTH-55 | Deferred | Out of Scope P3 (`spec.md:24`) |
| AUTH-56 | Deferred | Out of Scope P3 (`spec.md:24`) |
| AUTH-57 | Implemented | Better Auth troca sessão no OAuth; não testado |
| AUTH-58 | Implemented | `invite-service.ts:272-282` `updateMany` corrida → invalid |
| AUTH-59 | Implemented | `invite-service.ts:287-294` só grupos não arquivados |
| AUTH-60 | Implemented | `reconcileSoleWorshipLeader` no-op com 0/2+ líderes |
| AUTH-61 | Implemented | `app/entrar/page.tsx:21-22` `google_cancel` |
| AUTH-62 | Verified | `app/api/invites/route.test.ts:87` `INVALID_EXPIRY` |

**Summary:** Verified 30 · Implemented 28 · Partial 1 · Gap 0 · Deferred 2 · (62 total)

---

## Discrimination (confidence)

- **High:** OAuth gate, convites API, members API, import permission, public lyrics stripping, setlist anônimo negado — backed by tests.
- **Medium:** Cookie/session attrs (AUTH-05), API 401 blanket (AUTH-31), persistência songs (AUTH-33) — código presente, poucos testes de rota.
- **Low / open:** Edge AUTH-57..60 sem testes; AUTH-46 desativar → 401 na próxima request.

---

## Remediation to reach PASS

1. Zerar **lint** no repo (ou acordar exceção documentada no gate).
2. Opcional: testes de rota `songs`/`charts` (AUTH-33); teste AUTH-13; auditoria de reconciliação (AUTH-53).

---

## Success Criteria (spec)

| Criterion | Status |
| --- | --- |
| Convite → primeiro acesso &lt; 2 min | Manual / não automatizado |
| Zero APIs gravando sem sessão | Implemented via guards; não auditado 100% |
| Zero acordes na letra pública | Verified (`public-lyrics.test.ts`) |
