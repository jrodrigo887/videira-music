# Acesso privado ao módulo de import - Tasks

**Design:** `.specs/features/import-access/design.md`
**Status:** Implementation done; verification gaps open (G1-G7)

> T1-T5 foram reconstruídas a partir dos commits já no `main`. G1-G7 são o trabalho que falta para fechar a spec (ver `validation.md`).

## Gate Check Commands

| Gate | Comando |
| --- | --- |
| Quick | `npm test -- <alvo>` |
| Full | `npm test && npx tsc --noEmit` |
| Build | `npm test && npm run lint && npm run build` |

## Tasks implementadas

### T1: Núcleo de acesso e modelo `ImportLog` ✅

**Commit:** `d6e478b` | **Reqs:** IMA-01..05, 06, 07, 13 (modelo), 14
**Done when:**

- [x] Flag lida só de `VIDEIRA_ENABLE_IMPORT`; segredo < 32 chars → `disabled`.
- [x] `canImport` devolve `disabled | locked | allowed`; cookie duplicado, adulterado ou expirado → `locked`.
- [x] Rate limit 5/IP e 20 global por 15 min; sucesso zera o IP.
- [x] Migration `ImportLog` aplicada; `recordImportLog` não propaga falha.

### T2: Gate nas rotas de cifra e rota de sessão ✅

**Commit:** `096a5e0` | **Reqs:** IMA-04, 06, 07, 08, 10, 11, 12, 13
**Done when:**

- [x] `POST/DELETE /api/imports/session` com cookie, `no-store` e 404 desligado.
- [x] `POST /api/imports/cifraclub` consulta a política antes de ler o corpo e limita a fila a 3.
- [x] `PUT /api/charts/{id}` e `POST /api/song-charts` consultam a política antes da validação, só com `origin`.

### T3: UI de desbloqueio e bloqueio ✅

**Commit:** `b08b6b2` | **Reqs:** IMA-06 (mensagens), 08, 09
**Done when:**

- [x] Página mostra tela de desbloqueio sem sessão e o workflow com sessão.
- [x] "Bloquear import" chama `DELETE` e recarrega.
- [x] `401 IMPORT_LOCKED` em preview ou save volta ao desbloqueio mantendo o draft.

### T4: Links condicionados à flag ✅

**Commit:** `e69954d` | **Reqs:** IMA-01 AC3
**Done when:**

- [x] Header, home, biblioteca e detalhe omitem `/import` quando o módulo não está configurado.

### T5: Testes iniciais ✅ (parcial)

**Commits:** `096a5e0`, `b08b6b2` | **Reqs:** IMA-15 (parte)
**Done when:**

- [x] POST exportado do cifraclub com env real: desligado, nome antigo, sem sessão, cookie expirado, sessão válida.
- [x] Página `/import` com `notFound`, desbloqueio e workflow.
- [x] Política: flag off, nome antigo, segredo curto, sem cookie, válido, duplicado.
- [x] Rate limit: 6ª tentativa e reset por sucesso.

## Tasks abertas (lacunas)

### G1: Testes de rota do gate de cifra (IMA-11) ⏳

**Onde:** `app/api/charts/[chartId]/route.test.ts`, `app/api/song-charts/route.test.ts`
**Done when:**

- [ ] `locked` + `origin` → `401 IMPORT_LOCKED`, nada gravado (inclusive a `song` do `POST /api/song-charts`).
- [ ] `disabled` + `origin` → `404 NOT_FOUND`, nada gravado.
- [ ] Sem `origin` → grava sem consultar a política.
- [ ] A política é consultada antes de `VALIDATION_FAILED`, `SONG_NOT_FOUND` e `ORIGIN_URL_CONFLICT`.
- [ ] `POST /api/migrations/local-data` com `origin` e sem sessão migra e não grava `ImportLog`.

### G2: Testes do `ImportLog` (IMA-13, IMA-14) ⏳

**Done when:**

- [ ] `unlock` (`success`, `INVALID_SECRET`, `TOO_MANY_ATTEMPTS`), `logout`, `preview` e `save` geram exatamente uma linha.
- [ ] Módulo `disabled` não grava nenhuma linha.
- [ ] Nenhuma coluna contém letra, acorde, segredo, cookie ou IP.
- [ ] Writer falhando → operação normal + `IMPORT_LOG_WRITE_FAILED` com `action`.
- [ ] `url` do `save` canônica (ver F1 em `validation.md`).

### G3: Testes da rota de sessão (IMA-04..07, IMA-15.4) ⏳

**Done when:**

- [ ] `429` com `Retry-After`, inclusive com o segredo correto; limite global de 20 com IPs distintos.
- [ ] `400 INVALID_REQUEST` (não JSON, sem `secret`, vazio, > 256) sem contar falha.
- [ ] `Cache-Control: no-store` e atributos exatos do cookie.
- [ ] Cookie adulterado e cookie assinado com segredo anterior → `locked` pelo `POST` exportado do cifraclub.
- [ ] `IMPORT_ACCESS_MISCONFIGURED` logado uma única vez, sem o valor do segredo.

### G4: Testes de UI (IMA-08, IMA-09, IMA-15.3) ⏳

**Done when:**

- [ ] Links `/import` ausentes com a flag desligada e presentes com ela ligada (header, home, biblioteca, detalhe).
- [ ] Tela de desbloqueio não renderiza o workflow; "Segredo inválido." limpa o campo; mensagem de `429` com minutos arredondados para cima.
- [ ] "Bloquear import" chama `DELETE` e volta ao desbloqueio.
- [ ] `401 IMPORT_LOCKED` no preview e no save preserva o draft.

### G5: Verificar `Secure` em `http://localhost` no Safari ⏳

**Done when:**

- [ ] Resultado registrado em `design.md`; se falhar, documentar o uso de Chrome/Firefox em dev ou HTTPS local.

### G6: Teste de mutação da regra de acesso (Success Criteria) ⏳

**Done when:**

- [ ] Inverter a expressão da flag, voltar a ler o nome antigo e remover a checagem de expiração fazem ao menos um teste falhar.

### G7: Tratamento de falha do logout na UI ⏳

**Done when:**

- [ ] `ImportPageClient` trata falha de rede do `DELETE` (hoje ignora o resultado e só recarrega).
