# Acesso privado ao módulo de import - Design

**Spec:** `.specs/features/import-access/spec.md` (IMA-01 a IMA-15)
**Status:** Implemented (design reconstruído a partir do código em `096a5e0`, `d6e478b`, `b08b6b2`, `e69954d`)
**Decisão relacionada:** AD-005 em `.specs/STATE.md`

> Este documento descreve o que foi construído. A implementação precedeu o design; as divergências e lacunas estão em `validation.md`.

## Arquitetura

```text
Request ──► canImport(request) ──► disabled → 404 NOT_FOUND
                              ├──► locked   → 401 IMPORT_LOCKED (API) / tela de desbloqueio (página)
                              └──► allowed  → segue o fluxo normal
```

Uma única política (`ImportAccessPolicy`) decide o estado. Os pontos de entrada só traduzem o estado em resposta HTTP, o que permite trocar o segredo por permissão de usuário depois sem mexer neles.

## Componentes

| Módulo | Responsabilidade | Requisitos |
| --- | --- | --- |
| `lib/import-access/constants.ts` | Nome do cookie, 12 h, segredo mínimo de 32 chars, limites 5/20 por 15 min, fila de 3 | IMA-05, 06, 12 |
| `lib/import-access/import-module-config.ts` | Lê só `VIDEIRA_ENABLE_IMPORT === "true"` e `VIDEIRA_IMPORT_ADMIN_SECRET`; falha fechada; loga `IMPORT_ACCESS_MISCONFIGURED` uma vez | IMA-01, 02 |
| `lib/import-access/import-access-policy.ts` | `canImport(request)` → `disabled \| locked \| allowed`; `canImportFromCookieHeader` para a página | IMA-03 |
| `lib/import-access/import-session.ts` | Token `payload.assinatura` com HMAC-SHA256, chave derivada do segredo; valida assinatura, formato, duração ≤ 12 h e expiração; cookie único | IMA-04, 05 |
| `lib/import-access/secret-compare.ts` | SHA-256 dos dois lados + `timingSafeEqual` | IMA-04 |
| `lib/import-access/unlock-rate-limit.ts` | Janela fixa de 15 min em memória, contador por IP e global | IMA-06 |
| `lib/import-access/client-ip.ts` | `X-Forwarded-For` (1º valor) → `X-Real-IP` → `unknown` | IMA-06 |
| `lib/import-access/import-access-http.ts` | Respostas de erro com `Cache-Control: no-store` | IMA-03, 04 |
| `lib/import-access/preview-slot-queue.ts` | No máximo 1 em andamento + 3 aguardando; a 4ª recebe `IMPORT_BUSY` | IMA-12 |
| `lib/import-access/import-log.ts` | `recordImportLog` engole falhas e loga `IMPORT_LOG_WRITE_FAILED` | IMA-13, 14 |
| `lib/import-access/chart-origin-gate.ts` | Gate das rotas de cifra: só consulta a política se o corpo tem `origin`; grava log de `save` | IMA-11, 13 |
| `prisma/schema.prisma` (`ImportLog`) + migration `20261014125921_import_log` | `id, occurredAt, action, outcome, url?, chartId?`, índice em `occurredAt` | IMA-13 |

## Pontos de entrada

| Entrada | Comportamento |
| --- | --- |
| `app/import/page.tsx` | `notFound()` se desligado; tela de desbloqueio se `locked`; `ImportPageClient` (com "Bloquear import") se `allowed`; `force-dynamic` |
| `POST /api/imports/session` | 404 desligado → JSON → validação (1–256 chars) → rate limit → comparação → cookie `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200` |
| `DELETE /api/imports/session` | 404 desligado; senão sempre `204` limpando o cookie |
| `POST /api/imports/cifraclub` | Política → fila de previews → corpo → allowlist → fetch; um `ImportLog` de `preview` por resultado |
| `PUT /api/charts/{id}`, `POST /api/song-charts` | `gateChartWriteWithOrigin` antes de validar o corpo; `recordSuccessfulChartSave` / `recordFailedChartSave` |
| `POST /api/migrations/local-data` | Fora do gate, sem `ImportLog` (risco aceito na spec) |

## UI

- `ImportUnlockPanel`: campo de senha, "Segredo inválido." e "Muitas tentativas. Tente novamente em N minutos." (N = `ceil(Retry-After / 60)`).
- `ImportWorkflow`: converte `401 IMPORT_LOCKED` (preview ou salvamento) em `ImportSessionLockedError` e volta à tela de desbloqueio mantendo o draft.
- `app/layout.tsx`, `app/page.tsx`, `app/songs/page.tsx` e `song-detail` recebem `importLinkVisible` de `isImportModuleVisibleInUi()` (módulo configurado, com ou sem sessão).

## Decisões de implementação

- **Log de `save` pelo corpo**: o `ImportLog` é gravado dentro do callback do repositório (sucesso) e depois por status `>= 400` (falha); a regra de "só com `origin`" vive em `chartPayloadHasOrigin`.
- **`save-imported-chart`** passou a exigir `selectedSongKey` explícito e a atualizar `defaultKey` da música existente (mudança de produto fora da spec, ver `validation.md`).
- **Falha fechada**: `canImport` devolve `disabled` quando falta o segredo, antes de olhar o cookie.

## Pontos em aberto herdados da spec

- Cookie `Secure` em `http://localhost` no Safari: **não verificado** (a spec pediu verificação no Design).
