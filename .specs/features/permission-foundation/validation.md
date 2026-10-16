# permission-foundation — Validation

**Verdict:** PASS

**Diff range:** `4dfec25`..`HEAD` (feature branch `main`)

**Sensor:** discrimination checks run via full suite (`814` tests) including `lib/auth/permission-matrix.test.ts`; musician/manager denial cases assert `403` on mutated permission paths.

## Acceptance criteria

| ID | Outcome | Evidence |
| --- | --- | --- |
| PERM-15 | Route without `permission` → `403 FORBIDDEN`, handler not called | `lib/persistence/persistence-api.test.ts:17` — `expect(handler).not.toHaveBeenCalled()` |
| PERM-16 | Missing session → `401` | `lib/persistence/persistence-api.test.ts:33` — `expect(response.status).toBe(401)` |
| PERM-01–03, 05–07 | Gestor blocked from user-admin APIs | `lib/auth/permission-matrix.test.ts:89` manager `403` on roles/deactivate/approve; `app/api/members/route.test.ts:30` musician `403`, manager `200` |
| PERM-08–09 | UI tabs gated | `components/users/users-admin.test.tsx:58` hides Pedidos/Papéis |
| PERM-35–36 | NoAccess copy + login redirect | `components/auth/no-access.test.tsx:14`; `app/import/page.test.tsx:47` redirect digest |
| PERM-37–38 | Header links by capability | `app/layout.test.tsx:83` manager Usuários, leader Importar, musician none |

**Gate:** `npm test` (814 passed), `npx tsc --noEmit` clean.
