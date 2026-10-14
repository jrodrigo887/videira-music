# Importação de cifras

Este é o documento canônico do fluxo de importação do Videira Music. O escopo continua restrito a uso pessoal e local: uma URL fornecida pelo usuário, texto colado e revisão obrigatória antes de gravar. O módulo inteiro fica **desligado por padrão** e, quando ligado, exige **desbloqueio com segredo de admin** (feature `import-access`).

## Escopo

O fluxo aceita duas origens e leva ambas à mesma revisão:

- texto colado, processado no navegador;
- URL HTTPS de `cifraclub.com.br` ou `www.cifraclub.com.br`, processada pelo servidor Next local (Playwright).

O usuário revisa o texto original, warnings, tom e tipos de seção. Depois, vincula uma música existente ou cria uma nova. Somente então a música e a cifra são persistidas no **SQLite do servidor** (via API `server-persistence`).

Não fazem parte do escopo:

- busca, crawler, sitemap ou importação em lote;
- deploy público com o import habilitado sem gate;
- stealth, rotação de proxy ou IP, resolução de captcha e outras formas de evasão;
- redistribuição de cifras no seed, em fixtures ou em conteúdo público;
- autenticação multi-usuário (hoje só o dono, via segredo + cookie de sessão).

## Acesso ao módulo

| Variável | Função |
| --- | --- |
| `VIDEIRA_ENABLE_IMPORT` | Deve ser exatamente `true` para existir página `/import`, rotas de import e links na UI. |
| `VIDEIRA_IMPORT_ADMIN_SECRET` | Segredo de admin (mínimo 32 caracteres). Nunca use prefixo `NEXT_PUBLIC_`. |

A flag antiga `VIDEIRA_ENABLE_CIFRACLUB_IMPORT` **não é mais lida** (sem fallback). Ambiente só com ela definida se comporta como import desligado.

Com flag off, segredo ausente ou segredo curto:

- `/import` responde **404**;
- `POST /api/imports/cifraclub`, `POST/DELETE /api/imports/session` respondem **404**;
- links **Importar** somem no header, home, biblioteca e detalhe.

Com flag e segredo válidos, sem sessão:

- `/import` mostra a tela **Desbloquear** (campo de segredo);
- APIs protegidas respondem **401** `IMPORT_LOCKED` até `POST /api/imports/session` com o segredo correto.

Sessão: cookie `videira_import_session`, 12 horas, `HttpOnly` + `Secure` + `SameSite=Strict`. **Bloquear import** chama `DELETE /api/imports/session`.

Gravação de cifra **com** `origin` (`paste`, `file` ou `url`) exige sessão válida em `PUT /api/charts/{chartId}` e `POST /api/song-charts`. Cifra **sem** `origin` e a migração única `POST /api/migrations/local-data` não passam pelo gate (bypass aceito para dev/migração).

## Descoberta técnica

Requisições HTTP comuns e Chromium headless receberam bloqueio do Akamai durante o spike. Chromium headed carregou a página. Por isso, o adaptador usa Playwright em modo headed, reutiliza um navegador e o fecha após 60 segundos sem uso.

O conteúdo é extraído de `pre[data-chord-content]`. Os acordes marcados vêm de `b[data-chord-name]`. Metadados usam JSON-LD e atributos semânticos, sem depender de classes CSS geradas pelo site.

O adaptador:

- aceita somente HTTPS nos dois hosts permitidos;
- valida novamente o host após redirects;
- inicia navegações em fila FIFO com intervalo global mínimo de 10 segundos;
- limita fila de preview (1 navegação + até 3 aguardando; excedente → `429 IMPORT_BUSY`);
- usa cache local por hash SHA-256 da URL canônica;
- trata cache corrompido como miss;
- não registra letra ou cifra integral no `ImportLog` (só ação, resultado, URL e `chartId`);
- devolve `SOURCE_BLOCKED`, `SOURCE_LAYOUT_CHANGED` ou `SOURCE_TIMEOUT` de forma explícita.

O parser permanece puro em `lib/import`. A rota `POST /api/imports/cifraclub` valida acesso, reserva slot de preview, busca um `RawChart` e chama o mesmo `previewImport` usado pelo fluxo de revisão.

## Preparação local

Instale as dependências, aplique migrations e o Chromium compatível com a versão fixada do Playwright:

```bash
npm install
npm run db:migrate
npx playwright install chromium
```

Ative o módulo de import **somente na máquina local** (exemplo em `.env.local`):

```bash
VIDEIRA_ENABLE_IMPORT=true
VIDEIRA_IMPORT_ADMIN_SECRET="substitua-por-um-segredo-aleatorio-com-pelo-menos-32-caracteres"
```

Depois:

```bash
npm run dev
```

Também é possível definir as variáveis só para uma execução:

```bash
VIDEIRA_ENABLE_IMPORT=true VIDEIRA_IMPORT_ADMIN_SECRET="..." npm run dev
```

Sem flag + segredo válidos, o import não existe na UI nem nas APIs. Com módulo ligado, abra `/import`, digite o segredo uma vez e use o fluxo até bloquear ou expirar a sessão (12 h).

O Chromium headed precisa de uma sessão gráfica. Se o executável não estiver instalado ou não puder abrir, rode novamente `npx playwright install chromium`.

## Uso

1. Com módulo configurado, abra `http://localhost:3000/import` (ou **Importar cifra** na biblioteca).
2. Desbloqueie com o segredo de admin, se solicitado.
3. Cole o texto ou informe uma URL HTTPS suportada.
4. Revise warnings, seções e texto original.
5. Confirme explicitamente o tom.
6. Confirme uma música sugerida ou crie uma música nova.
7. Salve. O app abre o detalhe com a cifra persistida e transponível.

Se uma cifra com a mesma `origin.url` já estiver salva, o app abre o detalhe existente sem chamar a rota externa.

Use **Bloquear import** quando terminar; isso apaga o cookie neste navegador (cópias do cookie continuam válidas até expirar — troque o segredo para invalidar todas).

## Falhas e fallback

| Situação | Resultado |
| --- | --- |
| Módulo desligado ou mal configurado | `404` na página e rotas de import |
| Sem sessão em rota protegida | `401 IMPORT_LOCKED` |
| Segredo errado no desbloqueio | `401 INVALID_SECRET` |
| Muitas tentativas de desbloqueio | `429 TOO_MANY_ATTEMPTS` + `Retry-After` |
| Fila de preview cheia | `429 IMPORT_BUSY` |
| JSON inválido ou sem `url` | `400 INVALID_REQUEST` |
| URL fora dos hosts permitidos | `422 UNSUPPORTED_SOURCE` |
| Bloqueio, captcha, redirect externo ou Chromium indisponível | `502 SOURCE_BLOCKED` |
| Seletor principal ausente | `502 SOURCE_LAYOUT_CHANGED` |
| Navegação acima do timeout | `504 SOURCE_TIMEOUT` |
| Falha ao gravar no servidor | O draft permanece aberto, nada é salvo e não há navegação |
| Sessão expira durante a revisão | Tela de desbloqueio; rascunho permanece em memória no cliente |

Em falhas da fonte, continue no campo **Texto da cifra**. Copie o conteúdo manualmente, revise e salve pelo mesmo fluxo.

## Guardrails legais e operacionais

Os Termos de Uso do Cifra Club proíbem métodos de extração de dados, e letras e harmonias podem ter proteção autoral. Este projeto registra o risco e limita a capacidade ao ambiente local para uso pessoal.

- mantenha `VIDEIRA_ENABLE_IMPORT` desligada (e sem segredo exposto) em deploy público;
- entregue o gate `import-access` antes de qualquer deploy público com persistência no servidor;
- importe uma música por ação do usuário;
- não automatize busca ou coleta em lote;
- não contorne bloqueios;
- não versione conteúdo importado em `data/musicas.json`, fixtures ou documentação;
- preserve `origin.url`, `sourceName` e `fetchedAt`;
- exiba a atribuição **Fonte: Cifra Club** no detalhe;
- se a origem bloquear o acesso, use texto colado.

## Verificação

Os testes usam somente letras e HTML sintéticos, sem rede:

```bash
npm test
npm run lint
npm run build
```

Auditoria de uso (desbloqueio, preview, save) fica na tabela `ImportLog` no SQLite — consulta via `npm run db:studio` ou SQL direto.
