# Acesso privado ao módulo de import - Contexto

**Gathered:** 2026-10-14  
**Spec:** `.specs/features/import-access/spec.md`  
**Status:** Ready for design (spec aprovada pelo usuário em 2026-10-14)

---

## Feature Boundary

Esta feature torna privado o módulo inteiro de import: a página `/import` (texto colado e revisão), o preview por URL do Cifra Club (`POST /api/imports/cifraclub`) e a gravação de cifras com `origin` por `PUT /api/charts/{chartId}` e `POST /api/song-charts` (rotas da `server-persistence`). A migração única do IndexedDB (`POST /api/migrations/local-data`) fica fora do gate. O acesso exige a flag de ambiente ligada e uma sessão de admin obtida com um único segredo. A feature também limita tentativas de desbloqueio, limita a fila do Playwright e registra cada uso em `ImportLog`. Não inclui usuários, papéis, vários tokens, autenticação real, controles de direito autoral nem o esquema do banco (que pertence à `server-persistence`).

---

## Implementation Decisions

### Quem acessa e como (decidido pelo usuário)

- O módulo inteiro de import é privado e só é liberado com a autorização do dono.
- O mecanismo é flag de ambiente + um único segredo de admin; só o dono o conhece.
- Direito autoral não é preocupação: o usuário declarou que o scraping é permitido.
- Quando houver autenticação, a mesma política passa a checar uma permissão de usuário (ex.: `charts:import`).

### Ponto único de decisão

- `ImportAccessPolicy.canImport(request)` substitui o `enabled()` injetado em `createCifraClubPostHandler` e a leitura direta da flag em `app/import/page.tsx`.
- A política devolve `disabled`, `locked` ou `allowed`. `disabled` vira `404`; `locked` vira `401 IMPORT_LOCKED` nas rotas e tela de desbloqueio na página.
- As rotas de escrita `PUT /api/charts/{chartId}` e `POST /api/song-charts` consultam a política quando a cifra do corpo tem `origin`, antes de validar o corpo ou abrir a transação. Cifra sem `origin` não passa pela política.
- `POST /api/migrations/local-data` não passa pela política: move dados já salvos localmente. O risco de um cliente gravar cifras com `origin` por essa rota sem sessão foi aceito, como no caso da cifra sem `origin`.
- A flag passa a ser `VIDEIRA_ENABLE_IMPORT=true`, cobrindo o módulo inteiro (decidido pelo usuário). O nome antigo `VIDEIRA_ENABLE_CIFRACLUB_IMPORT` deixa de ser lido e é ignorado, sem fallback: um ambiente que só tenha o nome antigo fica com o import desligado (`404`).
- Flag ligada com `VIDEIRA_IMPORT_ADMIN_SECRET` ausente ou com menos de 32 caracteres falha fechada, como se a flag estivesse desligada.

### Sessão de admin

- O dono digita o segredo uma vez na tela de desbloqueio (`POST /api/imports/session`).
- O servidor compara os digests SHA-256 em tempo constante e emite `videira_import_session`: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, 12 horas absolutas.
- O cookie é assinado com HMAC-SHA256 usando chave derivada do segredo; trocar o segredo invalida todas as sessões.
- "Bloquear import" chama `DELETE /api/imports/session`, que apaga o cookie e é idempotente.

### Tentativas erradas

- Segredo errado responde `401 INVALID_SECRET`.
- 5 falhas por IP ou 20 falhas globais em 15 minutos respondem `429 TOO_MANY_ATTEMPTS` com `Retry-After`, inclusive para o segredo correto.
- O estado do rate limit fica em memória e zera ao reiniciar.

### Playwright e auditoria

- O preview negado não lê o corpo nem inicia o Chromium.
- A fila do Playwright aceita no máximo 3 requisições aguardando; a 4ª recebe `429 IMPORT_BUSY`.
- `ImportLog` registra `unlock`, `logout`, `preview` e `save` com horário UTC, resultado, URL canônica e `chartId`, sem conteúdo musical, segredo, cookie ou IP.
- Falha ao gravar o `ImportLog` não derruba a operação.

### Testes (lições L-001, L-003 e L-006)

- Os testes exercitam o `POST` exportado e o módulo da página com `process.env` real (desligado, configuração incompleta, ligado), não só um predicado injetado.
- Os ramos desligados da UI (links para `/import`, workflow na tela de desbloqueio) têm testes próprios.

### Confirmado pelo usuário na revisão (2026-10-14)

- Renomear a flag para `VIDEIRA_ENABLE_IMPORT`, ignorando o nome antigo.
- Logout só apaga o cookie do navegador; cópias do cookie continuam válidas até expirar; revogar todas as sessões = trocar o segredo.
- Bypass aceito: cifras sem `origin` e `POST /api/migrations/local-data` não passam pelo gate.
- `import-access` precisa ser entregue antes de qualquer deploy público; até lá as rotas de escrita da `server-persistence` ficam abertas.

### Agent's Discretion

- Formato interno do payload do cookie (ex.: base64url de JSON + assinatura), desde que carregue `issuedAt` e `expiresAt` e seja verificado por HMAC.
- Organização dos componentes da tela de desbloqueio, reutilizando o design system existente.
- Como a página reage ao desbloqueio (ex.: `router.refresh()`), desde que não peça o segredo de novo.
- Onde o contador de rate limit e a fila vivem no código, desde que os limites sejam configuráveis por injeção nos testes.

### Declined / Undiscussed Gray Areas → Assumptions

Registrados na tabela de Assumptions da spec com `não, default técnico`:

- TTL de 12 horas, sem renovação deslizante.
- Limites de 5 falhas por IP e 20 globais em 15 minutos; IP lido de `X-Forwarded-For`/`X-Real-IP`.
- Página sem sessão responde `200` com a tela de desbloqueio.
- Links para `/import` ocultos só quando o módulo está desligado.
- Fila do Playwright limitada a 3 requisições aguardando.
- Campos e ações do `ImportLog`; sem expurgo automático; falha de log não bloqueia.
- Cookie sempre `Secure`, com incerteza sobre Safari em `http://localhost`.

---

## Specific References

- Gate atual: `app/api/imports/cifraclub/route.ts` (`createCifraClubPostHandler({ enabled, fetchChart })`, `404 NOT_FOUND` quando desligado).
- Leitura da flag na página: `app/import/page.tsx` (`urlImportEnabled`).
- Workflow e chamada da rota: `components/import/import-workflow.tsx`.
- Salvamento atual (ainda no IndexedDB): `lib/import/save-imported-chart.ts`.
- `ImportOrigin.kind`: `paste | file | url` em `types/import.ts`.
- Fila do Playwright (1 navegação, intervalo de 10 s): `lib/import/sources/cifraclub.ts`.
- Decisão anterior: AD-002 em `.specs/STATE.md`; lições L-001, L-003 e L-006 em `.specs/LESSONS.md`.

---

## Dependencies

- **`server-persistence`**: IMA-11 (gate em `PUT /api/charts/{chartId}` e `POST /api/song-charts`; exceção da `POST /api/migrations/local-data`), IMA-13 e IMA-14 (`ImportLog` em SQLite via Prisma) dependem das rotas e do esquema dessa feature. As tasks desses requisitos só começam depois dela.

---

## Deferred Ideas

- Permissão `charts:import` checada pela mesma `ImportAccessPolicy` quando houver autenticação.
- Revogação server-side de sessões (lista de sessões ou versão de sessão no banco).
- Tela para consultar o `ImportLog` e expurgo automático por idade.
- Rate limit persistente para vários processos ou instâncias.
