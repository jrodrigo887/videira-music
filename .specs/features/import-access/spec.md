# Acesso privado ao módulo de import

## Problem Statement

Hoje o fluxo `/import` (texto colado e revisão) fica aberto a qualquer visitante, e só o preview por URL do Cifra Club depende de uma flag (hoje `VIDEIRA_ENABLE_CIFRACLUB_IMPORT`, que esta feature renomeia para `VIDEIRA_ENABLE_IMPORT`). Com a persistência passando para o servidor (feature `server-persistence`), qualquer pessoa com acesso ao deploy poderia importar e gravar cifras no banco compartilhado e disparar o Playwright no servidor. O dono precisa que o módulo inteiro de import fique privado e só seja liberado com a autorização dele, antes de existir autenticação.

## Goals

- [ ] Negar 100% das requisições ao módulo de import (página `/import`, preview por URL e salvamento de cifra com `origin`) quando a flag estiver desligada ou a configuração estiver incompleta.
- [ ] Liberar o módulo somente para quem apresentar o segredo de admin, por uma sessão assinada com expiração de 12 horas.
- [ ] Bloquear força bruta no desbloqueio com limite de 5 falhas por IP e 20 falhas globais a cada 15 minutos.
- [ ] Registrar cada uso do import em `ImportLog` sem conteúdo musical.
- [ ] Concentrar a regra de acesso numa única política (`ImportAccessPolicy`) que, no futuro, passe a checar uma permissão de usuário sem mudar os pontos de entrada.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Usuários, contas e login real | Ainda não existe autenticação; o único ator é o dono. |
| Papéis e permissões por usuário (ex.: `charts:import`) | Entra quando houver autenticação; a mesma `ImportAccessPolicy` passará a checar a permissão. |
| Vários tokens, tokens por pessoa ou convites | Um único segredo de admin cobre o caso atual (só o dono). |
| Revogação server-side de sessões emitidas | A sessão é um cookie assinado sem estado; trocar o segredo invalida todas. |
| Controles de direito autoral | O usuário declarou que o scraping é permitido; não há requisito de copyright nesta feature. |
| Proteger a leitura de cifras já salvas (biblioteca e detalhe) | Ler o repertório não é import; a biblioteca continua pública. |
| Detectar conteúdo importado em cifras sem `origin` | O gate se baseia em `origin`; cifra sem `origin` não é tratada como import. |
| Expiração ou expurgo automático do `ImportLog` | Volume pequeno com um único ator; expurgo fica para depois. |
| UI para consultar o `ImportLog` | O registro é para auditoria pelo dono direto no banco nesta entrega. |
| Persistência e esquema do banco | Pertencem à feature `server-persistence`; esta feature só define o conteúdo do `ImportLog`. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Escopo protegido | Página `/import`, `POST /api/imports/cifraclub` e gravação de cifra com `origin` de qualquer `kind` (`paste`, `file`, `url`) | O módulo inteiro de import é privado, não só o preview por URL. | sim |
| Rotas de escrita protegidas | `PUT /api/charts/{chartId}` e `POST /api/song-charts`, as duas rotas que gravam `ChordChart` na `server-persistence`; o gate vale só quando a cifra do corpo tem `origin`; cifra sem `origin` não passa pelo gate | São os únicos caminhos de gravação de cifra fora da migração; `PUT /api/songs/{songId}` não grava cifra. Bypass aceito pelo dono: cifra sem `origin` não é tratada como import. | sim |
| Migração do IndexedDB (`POST /api/migrations/local-data`) | Não passa pela `ImportAccessPolicy`, mesmo com cifras que têm `origin` | Move dados que já foram salvos localmente antes do gate existir. Risco aceito pelo dono: um cliente pode gravar cifras com `origin` por essa rota sem sessão, o mesmo tipo de bypass da cifra sem `origin`. | sim |
| Mecanismo de acesso | Flag de ambiente + um único segredo de admin | Ainda não há autenticação; só o dono usa o import. | sim |
| Direito autoral | Nenhum requisito de copyright | O usuário declarou que o scraping é permitido. | sim |
| Evolução com autenticação | A mesma `ImportAccessPolicy.canImport(request)` passará a checar uma permissão (ex.: `charts:import`) | Mantém os pontos de entrada estáveis; fica fora desta entrega. | sim |
| Nome da flag | `VIDEIRA_ENABLE_IMPORT=true` liga o módulo inteiro; o nome antigo `VIDEIRA_ENABLE_CIFRACLUB_IMPORT` deixa de ser lido e é ignorado, sem fallback | O módulo não é mais só Cifra Club; ignorar o nome antigo mantém a falha fechada: um ambiente que só tenha o nome antigo fica com o import desligado (`404`) até ser reconfigurado. | sim |
| Nome do segredo | `VIDEIRA_IMPORT_ADMIN_SECRET`, lido só no servidor | Nunca usar prefixo `NEXT_PUBLIC_`, para não ir ao bundle do client. | não, default técnico |
| Tamanho mínimo do segredo | 32 caracteres | Torna força bruta inviável mesmo sem rate limit. | não, default técnico |
| Configuração incompleta (flag ligada, segredo ausente ou curto) | Falha fechada: o módulo se comporta como desligado (`404`) e o servidor registra `IMPORT_ACCESS_MISCONFIGURED` uma vez por processo | Não revela que o módulo existe e avisa o dono pelo log. | não, default técnico |
| Rotas de sessão | `POST /api/imports/session` desbloqueia; `DELETE /api/imports/session` encerra | Mantém o desbloqueio sob o mesmo prefixo do import. | não, default técnico |
| Cookie de sessão | `videira_import_session`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, `Max-Age=43200` | O cookie precisa chegar à página e às rotas de API; `Strict` cobre CSRF. | não, default técnico |
| Expiração da sessão | 12 horas absolutas desde a emissão, sem renovação deslizante | Cobre uma sessão de trabalho longa e limita a janela de um cookie vazado. | não, default técnico |
| Assinatura da sessão | HMAC-SHA256 com chave derivada de `VIDEIRA_IMPORT_ADMIN_SECRET`; payload com `issuedAt` e `expiresAt` | Trocar o segredo invalida todas as sessões emitidas. | não, default técnico |
| Comparação do segredo | Comparar os digests SHA-256 com comparação em tempo constante | Evita vazar o segredo ou o tamanho dele por tempo de resposta. | não, default técnico |
| Logout de cookie copiado | Logout apaga o cookie do navegador; uma cópia do cookie continua válida até expirar | Sessão sem estado; revogar todas as sessões = trocar o segredo. | sim |
| Rate limit do desbloqueio | 5 falhas por IP em janela fixa de 15 minutos e 20 falhas globais na mesma janela; excedido → `429` com `Retry-After` | O limite global cobre `X-Forwarded-For` forjado. | não, default técnico |
| Identificação do IP | Primeiro valor de `X-Forwarded-For`, senão `X-Real-IP`, senão o bucket `unknown` | Route Handlers do Next não expõem o IP do socket de forma estável. | não, default técnico |
| Estado do rate limit | Em memória do processo; zera ao reiniciar o servidor | Um único processo atende o app nesta fase. | não, default técnico |
| Sucesso no desbloqueio | Zera o contador de falhas daquele IP | O dono não fica bloqueado depois de acertar. | não, default técnico |
| Corpo inválido no desbloqueio | `400 INVALID_REQUEST`, sem contar como tentativa | Só a comparação do segredo conta para força bruta. | não, default técnico |
| Status da página `/import` sem sessão | `200` com a tela de desbloqueio | Páginas do App Router não devolvem `401` de forma idiomática; as rotas de API devolvem. | não, default técnico |
| Links para `/import` | Ocultos no header, na home, na biblioteca e no detalhe quando o módulo estiver desligado; visíveis quando ligado, mesmo sem sessão | Evita links para uma página `404`; com o módulo ligado, o link leva ao desbloqueio. | não, default técnico |
| Fila do Playwright | 1 navegação por vez (já existe) e no máximo 3 requisições aguardando; a 4ª recebe `429 IMPORT_BUSY` | Mantém o "enfileirar e aguardar" da `chart-import` e impede fila ilimitada no servidor. | não, default técnico |
| Ações registradas no `ImportLog` | `unlock`, `logout`, `preview` e `save`, só quando o módulo está ligado e configurado | Cobre cada uso e cada tentativa de desbloqueio. | não, default técnico |
| Campos do `ImportLog` | `id`, `occurredAt` (UTC ISO-8601), `action`, `outcome` (`success` ou código de erro), `url` (canônica ou `null`), `chartId` (só em `save`) | Rastreia o uso sem guardar conteúdo musical, segredo, cookie ou IP. | não, default técnico |
| Falha ao gravar o `ImportLog` | A operação segue com seu resultado normal e o servidor registra `IMPORT_LOG_WRITE_FAILED` | Com um único ator, disponibilidade pesa mais que auditoria completa. | não, default técnico |
| Persistência do `ImportLog` e do salvamento | Depende da feature `server-persistence` (SQLite via Prisma, rotas `PUT /api/charts/{chartId}` e `POST /api/song-charts`); IMA-11, IMA-13 e IMA-14 só entram em tasks depois dela | Hoje o salvamento acontece no IndexedDB do navegador, sem rota no servidor. | não, default técnico |
| Navegador em `localhost` | Cookie sempre `Secure`; Chrome e Firefox aceitam `Secure` em `http://localhost` | Incerto para Safari; verificar no Design. | não, default técnico |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Manter o módulo de import fechado por padrão ⭐ MVP

**User Story**: Como dono do Videira Music, quero que o import não exista para ninguém enquanto eu não ligar e configurar o módulo, para que o deploy não exponha scraping nem gravação de cifras.

**Why P1**: Sem a negação padrão, qualquer outro controle pode ser contornado.

**Acceptance Criteria**:
1. WHERE `VIDEIRA_ENABLE_IMPORT` não for exatamente `true` WHEN alguém abrir `/import` THEN o sistema SHALL responder com a página `404` do Next. (IMA-01)
2. WHERE `VIDEIRA_ENABLE_IMPORT` não for exatamente `true` WHEN alguém chamar `POST /api/imports/cifraclub`, `POST /api/imports/session` ou `DELETE /api/imports/session` THEN o sistema SHALL responder `404` com `{ "error": { "code": "NOT_FOUND" } }` sem ler o corpo. (IMA-01)
3. WHERE `VIDEIRA_ENABLE_IMPORT` não for exatamente `true` WHEN o header, a home, a biblioteca ou o detalhe de música renderizarem THEN o sistema SHALL omitir todo link para `/import`. (IMA-01)
4. WHILE a flag estiver desligada, mesmo com um cookie `videira_import_session` válido, o sistema SHALL responder `404` em todos os pontos de entrada protegidos. (IMA-01)
5. The system SHALL read the module flag only from `VIDEIRA_ENABLE_IMPORT` and SHALL ignore the former name `VIDEIRA_ENABLE_CIFRACLUB_IMPORT`, with no fallback to it. (IMA-01)
6. IF a flag estiver ligada e `VIDEIRA_IMPORT_ADMIN_SECRET` estiver ausente ou tiver menos de 32 caracteres THEN o sistema SHALL tratar o módulo como desligado em todos os pontos de entrada protegidos. (IMA-02)
7. IF a configuração estiver incompleta THEN o sistema SHALL registrar no log do servidor uma única entrada `IMPORT_ACCESS_MISCONFIGURED` por processo, sem o valor do segredo. (IMA-02)
8. The system SHALL decide access for the `/import` page, `POST /api/imports/cifraclub`, the session routes, and `PUT /api/charts/{chartId}` and `POST /api/song-charts` when the chart carries `origin`, through one `ImportAccessPolicy.canImport(request)` that returns exactly one of `disabled`, `locked` or `allowed`. (IMA-03)
9. WHEN `canImport` devolver `disabled` THEN o ponto de entrada SHALL responder `404`. (IMA-03)
10. WHEN `canImport` devolver `locked` em uma rota de API THEN o sistema SHALL responder `401` com `{ "error": { "code": "IMPORT_LOCKED" } }`. (IMA-03)
11. The system SHALL never expose `VIDEIRA_IMPORT_ADMIN_SECRET` in HTTP responses, logs, `ImportLog` entries or the client bundle. (IMA-03)

**Independent Test**: Sem a flag, ou só com o nome antigo `VIDEIRA_ENABLE_CIFRACLUB_IMPORT=true`, abrir `/import` e chamar as rotas e ver `404` e nenhum link; com a flag e um segredo de 31 caracteres, ver o mesmo `404` e uma única linha `IMPORT_ACCESS_MISCONFIGURED` no log.

---

### P1: Desbloquear e bloquear o import com o segredo de admin ⭐ MVP

**User Story**: Como dono, quero digitar o segredo uma vez e trabalhar no import sem repeti-lo a cada ação, e poder bloquear de novo quando terminar.

**Why P1**: É o único caminho para o dono usar o módulo depois que ele fica privado.

**Acceptance Criteria**:
1. WHILE o módulo estiver ligado e configurado e o visitante não tiver sessão válida WHEN ele abrir `/import` THEN o sistema SHALL mostrar a tela de desbloqueio com um campo de senha e o botão "Desbloquear", sem renderizar o workflow de import. (IMA-09)
2. WHEN `POST /api/imports/session` receber `{ "secret": <valor> }` igual a `VIDEIRA_IMPORT_ADMIN_SECRET` THEN o sistema SHALL responder `204` com `Set-Cookie: videira_import_session` contendo `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` e `Max-Age=43200`. (IMA-04)
3. The system SHALL compare the submitted secret with `VIDEIRA_IMPORT_ADMIN_SECRET` by comparing their SHA-256 digests in constant time. (IMA-04)
4. The system SHALL send `Cache-Control: no-store` on every response of `/api/imports/session`. (IMA-04)
5. WHEN o desbloqueio terminar com `204` na tela de desbloqueio THEN o sistema SHALL mostrar o workflow de import sem pedir o segredo de novo. (IMA-09)
6. The system SHALL sign the session cookie with HMAC-SHA256 over a payload carrying `issuedAt` and `expiresAt`, where `expiresAt` equals `issuedAt` plus 12 hours. (IMA-05)
7. IF o cookie tiver assinatura inválida, payload malformado, `expiresAt` no passado ou `expiresAt - issuedAt` acima de 12 horas THEN `canImport` SHALL devolver `locked`. (IMA-05)
8. WHEN `VIDEIRA_IMPORT_ADMIN_SECRET` for trocado THEN o sistema SHALL tratar como `locked` todo cookie assinado com o segredo anterior. (IMA-05)
9. WHEN `DELETE /api/imports/session` for chamado THEN o sistema SHALL responder `204` com `Set-Cookie: videira_import_session=; Max-Age=0`, com ou sem sessão ativa. (IMA-08)
10. WHILE o workflow estiver visível o sistema SHALL mostrar o botão "Bloquear import". (IMA-08)
11. WHEN o botão "Bloquear import" for acionado THEN o sistema SHALL chamar `DELETE /api/imports/session` e mostrar a tela de desbloqueio. (IMA-08)
12. WHEN uma rota protegida responder `401 IMPORT_LOCKED` durante o workflow THEN o sistema SHALL mostrar a tela de desbloqueio e manter o draft atual em memória. (IMA-09)

**Independent Test**: Com flag e segredo válidos, abrir `/import`, ver a tela de desbloqueio, digitar o segredo, importar texto, clicar em "Bloquear import" e ver a tela de desbloqueio de novo; inspecionar os atributos do cookie.

---

### P1: Resistir a segredo errado e força bruta ⭐ MVP

**User Story**: Como dono, quero que tentativas erradas sejam recusadas e limitadas, para que ninguém descubra o segredo por tentativa.

**Why P1**: Um segredo sem limite de tentativas não protege um endpoint público.

**Acceptance Criteria**:
1. IF o segredo enviado for diferente de `VIDEIRA_IMPORT_ADMIN_SECRET` THEN o sistema SHALL responder `401` com `INVALID_SECRET` e não emitir cookie. (IMA-06)
2. WHEN a tela de desbloqueio receber `401 INVALID_SECRET` THEN o sistema SHALL mostrar "Segredo inválido." e limpar o campo. (IMA-06)
3. IF um mesmo IP acumular 5 falhas dentro de uma janela de 15 minutos THEN o sistema SHALL responder `429` com `TOO_MANY_ATTEMPTS` e `Retry-After` em segundos até o fim da janela em toda tentativa seguinte daquele IP. (IMA-06)
4. IF o total de falhas de todos os IPs chegar a 20 dentro da janela de 15 minutos THEN o sistema SHALL responder `429` com `TOO_MANY_ATTEMPTS` a qualquer IP até o fim da janela. (IMA-06)
5. WHILE uma tentativa estiver sob `429` o sistema SHALL recusar também o segredo correto, sem comparar o segredo nem emitir cookie. (IMA-06)
6. WHEN o desbloqueio de um IP der certo THEN o sistema SHALL zerar o contador de falhas daquele IP. (IMA-06)
7. WHEN a tela de desbloqueio receber `429 TOO_MANY_ATTEMPTS` THEN o sistema SHALL mostrar "Muitas tentativas. Tente novamente em N minutos.", com N arredondado para cima a partir de `Retry-After`. (IMA-06)
8. IF o corpo de `POST /api/imports/session` não for JSON, não tiver `secret` string não vazia ou tiver `secret` acima de 256 caracteres THEN o sistema SHALL responder `400` com `INVALID_REQUEST` sem contar uma falha. (IMA-07)

**Independent Test**: Enviar 5 segredos errados do mesmo IP e ver `401` cinco vezes; a 6ª tentativa, mesmo com o segredo correto, recebe `429` com `Retry-After`.

---

### P1: Proteger o preview por URL e o salvamento de cifra importada ⭐ MVP

**User Story**: Como dono, quero que o scraping e a gravação de cifras importadas só aconteçam com a sessão de admin, para que ninguém dispare o Playwright nem grave no banco sem a minha autorização.

**Why P1**: São as duas ações com custo e efeito no servidor.

**Acceptance Criteria**:
1. WHILE `canImport` devolver `locked` WHEN `POST /api/imports/cifraclub` for chamado THEN o sistema SHALL responder `401` com `IMPORT_LOCKED` sem ler o corpo e sem iniciar o Chromium. (IMA-10)
2. WHILE `canImport` devolver `allowed` WHEN `POST /api/imports/cifraclub` for chamado THEN o sistema SHALL manter o comportamento de IMP-08 a IMP-12 da feature `chart-import`. (IMA-10)
3. WHILE `canImport` devolver `locked` WHEN `PUT /api/charts/{chartId}` receber uma `ChordChart` com `origin` de qualquer `kind` THEN o sistema SHALL responder `401` com `IMPORT_LOCKED` e não gravar a cifra. (IMA-11)
4. WHILE `canImport` devolver `locked` WHEN `POST /api/song-charts` receber `{ song?, chart }` com `chart.origin` de qualquer `kind` THEN o sistema SHALL responder `401` com `IMPORT_LOCKED` e não gravar música nem cifra. (IMA-11)
5. WHILE `canImport` devolver `disabled` WHEN `PUT /api/charts/{chartId}` ou `POST /api/song-charts` receber uma cifra com `origin` THEN o sistema SHALL responder `404` com `NOT_FOUND` e não gravar música nem cifra. (IMA-11)
6. WHEN `PUT /api/charts/{chartId}` ou `POST /api/song-charts` receber uma cifra com `origin` THEN o sistema SHALL consultar `canImport` antes de validar o corpo contra PER-05, checar `SONG_NOT_FOUND` ou `ORIGIN_URL_CONFLICT` e abrir a transação. (IMA-11)
7. WHEN `PUT /api/charts/{chartId}` ou `POST /api/song-charts` receber uma cifra sem `origin` THEN o sistema SHALL processá-la sem consultar `ImportAccessPolicy`. (IMA-11)
8. WHEN `POST /api/migrations/local-data` receber um lote, inclusive com cifras que tenham `origin`, THEN o sistema SHALL processá-lo pelas regras da `server-persistence` sem consultar `ImportAccessPolicy` e sem gravar `ImportLog`. (IMA-11)
9. WHILE uma navegação do Playwright estiver em andamento o sistema SHALL manter no máximo 3 requisições de preview aguardando na fila. (IMA-12)
10. IF uma requisição de preview chegar com 3 requisições já aguardando THEN o sistema SHALL responder `429` com `IMPORT_BUSY` sem enfileirá-la e sem iniciar outra navegação. (IMA-12)

**Independent Test**: Sem cookie, chamar o preview, `PUT /api/charts/{chartId}` e `POST /api/song-charts` com `origin` e ver `401` sem Chromium e sem registro no banco; chamar `POST /api/migrations/local-data` com uma cifra com `origin` e vê-la criada; com sessão, disparar 5 previews simultâneos e ver 1 em navegação, 3 na fila e 1 com `429 IMPORT_BUSY`.

---

### P2: Auditar cada uso do import

**User Story**: Como dono, quero um registro de cada uso do import para saber quando e o que foi importado ou tentado.

**Why P2**: O gate funciona sem auditoria, mas o registro permite conferir usos e tentativas de desbloqueio. Depende da `server-persistence`.

**Acceptance Criteria**:
1. WHEN um desbloqueio terminar THEN o sistema SHALL gravar um `ImportLog` com `action = "unlock"` e `outcome` igual a `success`, `INVALID_SECRET` ou `TOO_MANY_ATTEMPTS`. (IMA-13)
2. WHEN um logout terminar THEN o sistema SHALL gravar um `ImportLog` com `action = "logout"` e `outcome = "success"`. (IMA-13)
3. WHEN um preview autorizado terminar THEN o sistema SHALL gravar um `ImportLog` com `action = "preview"`, a `url` canônica enviada e `outcome` igual a `success` ou ao código de erro devolvido. (IMA-13)
4. WHEN uma gravação autorizada de cifra com `origin` por `PUT /api/charts/{chartId}` ou `POST /api/song-charts` terminar THEN o sistema SHALL gravar um `ImportLog` com `action = "save"`, `origin.url` canônica ou `null`, o `chartId` gravado e `outcome` igual a `success` ou ao código de erro devolvido. (IMA-13)
5. The system SHALL store in each `ImportLog` only `id`, `occurredAt` as UTC ISO-8601, `action`, `outcome`, `url` and `chartId`, with no lyrics, chords, sections, raw text, title, artist, secret, cookie or IP. (IMA-13)
6. WHILE o módulo estiver `disabled` o sistema SHALL não gravar nenhum `ImportLog`. (IMA-13)
7. IF a gravação do `ImportLog` falhar THEN o sistema SHALL devolver o resultado normal da operação e registrar no log do servidor `IMPORT_LOG_WRITE_FAILED` com a `action`, sem conteúdo musical. (IMA-14)

**Independent Test**: Com sessão, fazer um preview e um salvamento e conferir duas linhas no `ImportLog` com URL, horário e resultado, sem letra; forçar falha do repositório de log e ver o preview responder normalmente.

---

### P1: Garantir que os testes exercitam a regra real ⭐ MVP

**User Story**: Como mantenedor, quero que os testes passem pela leitura real das variáveis de ambiente e pelos ramos desligados, para que uma regressão no gate não sobreviva escondida atrás de um predicado injetado.

**Why P1**: As lições L-001, L-003 e L-006 da `chart-import` mostram mutantes sobreviventes exatamente nesse ponto.

**Acceptance Criteria**:
1. The system SHALL have tests that call the exported `POST` of `app/api/imports/cifraclub/route.ts` and of the session route with `process.env` set to flag off, flag on with a short secret, and flag on with a valid secret, asserting `404`, `404` and `401`/`204` respectively. (IMA-15)
2. The system SHALL have tests that render the exported `/import` page module with `process.env` set to flag off, flag on without a session, and flag on with a valid session, asserting the Next not-found signal, the unlock screen and the import workflow respectively. (IMA-15)
3. The system SHALL have tests for the disabled branch of every gated UI control, asserting that the `/import` links are absent with the flag off and that the workflow is absent on the unlock screen. (IMA-15)
4. The system SHALL have tests that assert a tampered cookie, an expired cookie and a cookie signed with a previous secret each yield `locked` through the exported route, not only through `ImportAccessPolicy` in isolation. (IMA-15)
5. The system SHALL have a test that sets only `VIDEIRA_ENABLE_CIFRACLUB_IMPORT=true` with a valid `VIDEIRA_IMPORT_ADMIN_SECRET` and asserts `404` from the exported `POST` of `app/api/imports/cifraclub/route.ts`. (IMA-15)

**Independent Test**: Rodar a suíte com a expressão da flag alterada (ex.: `!== "true"`) ou com a checagem de expiração removida e ver ao menos um teste falhar.

---

## Edge Cases

- IF o header `Cookie` trouxer mais de um `videira_import_session` THEN o sistema SHALL tratar a requisição como `locked`.
- IF `X-Forwarded-For` e `X-Real-IP` estiverem ausentes THEN o sistema SHALL contar as falhas no bucket `unknown`, sujeito aos mesmos 5 por janela.
- WHEN duas tentativas erradas do mesmo IP chegarem ao mesmo tempo THEN o sistema SHALL contar as duas falhas no limite de 5.
- WHEN o logout acontecer em uma aba THEN o sistema SHALL responder `401 IMPORT_LOCKED` à próxima requisição protegida de outra aba do mesmo navegador.
- WHEN a sessão expirar entre a revisão e o salvamento THEN o sistema SHALL responder `401 IMPORT_LOCKED`, não persistir nada e manter o draft em memória até um novo desbloqueio.
- IF o servidor reiniciar THEN o sistema SHALL aceitar sessões ainda dentro da validade e zerar os contadores de rate limit.
- WHEN a migração única do IndexedDB enviar cifras com `origin` sem sessão de admin, ou com o módulo `disabled`, THEN o sistema SHALL migrá-las normalmente, porque `POST /api/migrations/local-data` fica fora do gate.
- IF `POST /api/song-charts` trouxer `song` válida e `chart` com `origin` sem sessão THEN o sistema SHALL responder `401 IMPORT_LOCKED` sem gravar a `song`.
- IF só o nome antigo `VIDEIRA_ENABLE_CIFRACLUB_IMPORT=true` estiver definido, sem `VIDEIRA_ENABLE_IMPORT`, THEN o sistema SHALL manter o import desligado e responder `404` em todos os pontos de entrada protegidos, mesmo com segredo válido.
- IF a flag for ligada sem `VIDEIRA_IMPORT_ADMIN_SECRET` THEN o sistema SHALL responder `404` também em `POST /api/imports/session`, sem aceitar segredo vazio.

---

## Implicit Requirement Dimensions

- **Input validation & bounds**: corpo do desbloqueio é JSON com `secret` string de 1 a 256 caracteres (`400` fora disso); segredo configurado com no mínimo 32 caracteres; cookie validado por assinatura, formato e janela de 12 horas (IMA-02, IMA-05, IMA-07).
- **Failure / partial-failure states**: configuração incompleta falha fechada (IMA-02); gravação negada não persiste música nem cifra (IMA-11); falha no `ImportLog` não derruba a operação (IMA-14); sessão expirada no meio do fluxo preserva o draft (IMA-09).
- **Idempotency / retry / duplicate handling**: logout é idempotente e responde `204` com ou sem sessão (IMA-08); repetir o desbloqueio com sessão ativa emite um cookie novo com nova validade (IMA-04); duplicidade de URL importada continua regida por IMP-10 da `chart-import`.
- **Auth boundaries & rate limits**: flag `VIDEIRA_ENABLE_IMPORT` (nome antigo ignorado) + segredo + sessão assinada decididos por `ImportAccessPolicy` (IMA-01, IMA-03, IMA-04, IMA-05); 5 falhas por IP e 20 globais a cada 15 minutos (IMA-06); permissão por usuário fica fora do escopo.
- **Concurrency / ordering**: tentativas simultâneas contam no limite (Edge Cases); Playwright com 1 navegação e no máximo 3 na fila (IMA-12).
- **Data lifecycle / expiry**: sessão expira em 12 horas absolutas (IMA-05); contadores de rate limit vivem 15 minutos e somem ao reiniciar; `ImportLog` sem expurgo automático nesta entrega (Out of Scope).
- **Observability**: `ImportLog` por uso sem conteúdo musical (IMA-13); logs `IMPORT_ACCESS_MISCONFIGURED` e `IMPORT_LOG_WRITE_FAILED`; segredo nunca exposto (IMA-03).
- **External-dependency failure**: falhas do Cifra Club continuam regidas por IMP-11 e IMP-12 da `chart-import`; fila cheia responde `429 IMPORT_BUSY` (IMA-12); falha do banco no `ImportLog` coberta por IMA-14.
- **State-transition integrity**: estados `disabled`, `locked` e `allowed`; só `locked → allowed` por segredo correto fora de `429`, `allowed → locked` por logout, expiração ou troca de segredo, e qualquer estado → `disabled` quando a flag desliga ou a configuração fica incompleta (IMA-01 a IMA-08).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IMA-01 | P1: Manter o módulo de import fechado por padrão | Design | Pending |
| IMA-02 | P1: Manter o módulo de import fechado por padrão | Design | Pending |
| IMA-03 | P1: Manter o módulo de import fechado por padrão | Design | Pending |
| IMA-04 | P1: Desbloquear e bloquear o import com o segredo de admin | Design | Pending |
| IMA-05 | P1: Desbloquear e bloquear o import com o segredo de admin | Design | Pending |
| IMA-06 | P1: Resistir a segredo errado e força bruta | Design | Pending |
| IMA-07 | P1: Resistir a segredo errado e força bruta | Design | Pending |
| IMA-08 | P1: Desbloquear e bloquear o import com o segredo de admin | Design | Pending |
| IMA-09 | P1: Desbloquear e bloquear o import com o segredo de admin | Design | Pending |
| IMA-10 | P1: Proteger o preview por URL e o salvamento de cifra importada | Design | Pending |
| IMA-11 | P1: Proteger o preview por URL e o salvamento de cifra importada (depende de `server-persistence`) | Design | Pending |
| IMA-12 | P1: Proteger o preview por URL e o salvamento de cifra importada | Design | Pending |
| IMA-13 | P2: Auditar cada uso do import (depende de `server-persistence`) | Design | Pending |
| IMA-14 | P2: Auditar cada uso do import (depende de `server-persistence`) | Design | Pending |
| IMA-15 | P1: Garantir que os testes exercitam a regra real | Design | Pending |

**Coverage:** 15 total, 0 mapped to tasks, 15 unmapped ⚠️ (tasks vêm depois da aprovação da spec).

**Relação com `chart-import`:** IMP-09 ("flag desligada oculta a entrada por URL e responde `404` na rota") passa a ser coberto de forma mais ampla por IMA-01: com a flag desligada, a página inteira responde `404`.

---

## Success Criteria

- [ ] Com a flag desligada ou a configuração incompleta, a página e as três rotas do módulo respondem `404` e nenhum link para `/import` aparece.
- [ ] Sem sessão, nenhuma requisição inicia o Chromium nem grava cifra com `origin` por `PUT /api/charts/{chartId}` ou `POST /api/song-charts`.
- [ ] O dono desbloqueia o import com uma única digitação do segredo e trabalha por até 12 horas sem digitá-lo de novo.
- [ ] A 6ª tentativa errada de um IP em 15 minutos recebe `429`, inclusive com o segredo correto.
- [ ] Cada preview e cada salvamento autorizado gera exatamente uma linha em `ImportLog`, sem conteúdo musical.
- [ ] Inverter a expressão da flag, voltar a ler o nome antigo ou remover a checagem de expiração faz ao menos um teste falhar.
