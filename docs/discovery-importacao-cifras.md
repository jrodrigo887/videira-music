# Importação de cifras

Este é o documento canônico do fluxo de importação do Videira Music. Ele substitui referências anteriores que tratavam toda integração com o Cifra Club como fora do MVP. O escopo aprovado é restrito a uso pessoal e local, com uma URL fornecida pelo usuário e a flag desligada por padrão.

## Escopo

O fluxo aceita duas origens e leva ambas à mesma revisão:

- texto colado, processado no navegador;
- URL HTTPS de `cifraclub.com.br` ou `www.cifraclub.com.br`, processada pelo servidor Next local.

O usuário revisa o texto original, warnings, tom e tipos de seção. Depois, vincula uma música existente ou cria uma nova. Somente então a música e a cifra são persistidas no IndexedDB do navegador.

Não fazem parte do escopo:

- busca, crawler, sitemap ou importação em lote;
- deploy público com o adaptador habilitado;
- stealth, rotação de proxy ou IP, resolução de captcha e outras formas de evasão;
- redistribuição de cifras no seed, em fixtures ou em conteúdo público;
- sincronização entre dispositivos.

## Descoberta técnica

Requisições HTTP comuns e Chromium headless receberam bloqueio do Akamai durante o spike. Chromium headed carregou a página. Por isso, o adaptador usa Playwright em modo headed, reutiliza um navegador e o fecha após 60 segundos sem uso.

O conteúdo é extraído de `pre[data-chord-content]`. Os acordes marcados vêm de `b[data-chord-name]`. Metadados usam JSON-LD e atributos semânticos, sem depender de classes CSS geradas pelo site.

O adaptador:

- aceita somente HTTPS nos dois hosts permitidos;
- valida novamente o host após redirects;
- inicia navegações em fila FIFO com intervalo global mínimo de 10 segundos;
- usa cache local por hash SHA-256 da URL canônica;
- trata cache corrompido como miss;
- não registra letra ou cifra integral;
- devolve `SOURCE_BLOCKED`, `SOURCE_LAYOUT_CHANGED` ou `SOURCE_TIMEOUT` de forma explícita.

O parser permanece puro em `lib/import`. A rota `POST /api/imports/cifraclub` apenas valida, busca um `RawChart` e chama o mesmo `previewImport` usado pelo fluxo de revisão.

## Preparação local

Instale as dependências e o Chromium compatível com a versão fixada do Playwright:

```bash
npm install
npx playwright install chromium
```

Ative o adaptador somente na máquina local:

```bash
printf 'VIDEIRA_ENABLE_CIFRACLUB_IMPORT=true\n' >> .env.local
npm run dev
```

Também é possível ativar a flag somente para uma execução:

```bash
VIDEIRA_ENABLE_CIFRACLUB_IMPORT=true npm run dev
```

Sem o valor exato `true`, o campo de URL fica oculto e a rota responde `404`. A importação por texto continua disponível.

O Chromium headed precisa de uma sessão gráfica. Se o executável não estiver instalado ou não puder abrir, rode novamente `npx playwright install chromium` e use o fallback de texto colado enquanto corrige o ambiente.

## Uso

1. Abra `http://localhost:3000/songs`.
2. Selecione **Importar cifra**.
3. Cole o texto ou, com a flag ativa, informe uma URL HTTPS suportada.
4. Revise warnings, seções e texto original.
5. Confirme explicitamente o tom.
6. Confirme uma música sugerida ou crie uma música local.
7. Salve. O app abre o detalhe com a cifra persistida e transponível.

Se uma cifra com a mesma `origin.url` já estiver salva, o app abre o detalhe existente sem chamar a rota externa.

## Falhas e fallback

| Situação | Resultado |
| --- | --- |
| JSON inválido ou sem `url` | `400 INVALID_REQUEST` |
| URL fora dos hosts permitidos | `422 UNSUPPORTED_SOURCE` |
| Bloqueio, captcha, redirect externo ou Chromium indisponível | `502 SOURCE_BLOCKED` |
| Seletor principal ausente | `502 SOURCE_LAYOUT_CHANGED` |
| Navegação acima do timeout | `504 SOURCE_TIMEOUT` |
| Falha no IndexedDB | O draft permanece aberto, nada é salvo e não há navegação |

Em falhas da fonte, continue no campo **Texto da cifra**. Copie o conteúdo manualmente, revise e salve pelo mesmo fluxo.

## Guardrails legais e operacionais

Os Termos de Uso do Cifra Club proíbem métodos de extração de dados, e letras e harmonias podem ter proteção autoral. Este projeto registra o risco e limita a capacidade ao ambiente local para uso pessoal.

- mantenha `VIDEIRA_ENABLE_CIFRACLUB_IMPORT` desligada em deploy público;
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
