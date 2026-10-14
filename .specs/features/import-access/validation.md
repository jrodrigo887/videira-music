# import-access Validation

**Result**: PARTIAL (implementação conforme, evidência de testes insuficiente)

**Date**: 2026-10-14
**Spec**: `.specs/features/import-access/spec.md`
**Escopo da verificação**: leitura do código no `main` (`861bf2c`) contra IMA-01..15, mais `tsc --noEmit` (limpo) e `vitest` (243 passando). Não houve teste de mutação nem execução manual no navegador.

**Legenda:** ✅ código e teste · 🟡 código ok, sem teste · ⚠️ divergência · ❌ ausente

## Requisitos

| ID | Resultado | Evidência / observação |
| --- | --- | --- |
| IMA-01 | ✅ | `import-module-config.ts:8`; testes do POST exportado (flag off, nome antigo) e da página (`notFound`). Links: 🟡 sem teste. |
| IMA-02 | 🟡 | Falha fechada em `canImport`; teste de segredo curto na política. Log `IMPORT_ACCESS_MISCONFIGURED` único: sem teste. |
| IMA-03 | 🟡 | `canImport` único e `importAccessDeniedResponse`; 404/401 testados no cifraclub. Segredo fora de respostas/logs: sem teste. |
| IMA-04 | 🟡 | `session/route.ts`, `secret-compare.ts`; 204 + cookie testados. Atributos exatos do cookie e `no-store`: sem teste. |
| IMA-05 | ✅ | `import-session.ts`; política testa duplicado/válido, cifraclub testa expirado. Cookie adulterado e segredo anterior pela rota: sem teste. |
| IMA-06 | 🟡 | Limiter testado (6ª tentativa, reset). `429` com `Retry-After` pela rota, limite global e mensagens da UI: sem teste. |
| IMA-07 | 🟡 | `parseUnlockBody` correto (400 sem contar falha); sem teste. |
| IMA-08 | 🟡 | `DELETE` testado; botão "Bloquear import" e `router.refresh()` sem teste. |
| IMA-09 | 🟡 | Página testada nos 3 estados; `401` no workflow mantendo o draft sem teste. |
| IMA-10 | ✅ | Testes `401` sem ler corpo e fluxo autorizado preservado. |
| IMA-11 | ❌ (teste) | Gate implementado em `chart-origin-gate.ts` e nas duas rotas, **sem nenhum teste de rota** de `charts`, `song-charts` ou `migrations`. |
| IMA-12 | ✅ | `preview-slot-queue.ts` + teste `IMPORT_BUSY` (4ª requisição). |
| IMA-13 | ❌ (teste) / ⚠️ | Implementado, sem nenhum teste. Divergência F1 abaixo. |
| IMA-14 | ❌ (teste) | `recordImportLog` engole e loga; sem teste. |
| IMA-15 | 🟡 | Itens 1, 2 e 5 cobertos; item 3 (links) e item 4 (adulterado / segredo anterior) incompletos. |

**Cobertura:** 15 requisitos: 3 totalmente testados, 9 com código conforme e teste parcial, 3 sem teste (IMA-11, 13, 14).

## Divergências do código em relação à spec

| # | Severidade | Descrição |
| --- | --- | --- |
| F1 | Baixa | IMA-13 AC4 pede `url` canônica; `extractOriginUrl` grava `origin.url` como chegou (pode manter `#fragmento`). O preview já canonicaliza. |
| F2 | Baixa | IMA-13: com `chart-origin-gate`, um `save` bem-sucedido seguido de resposta `>= 400` poderia gerar duas linhas; a spec exige uma. Improvável hoje, sem teste que proteja. |
| F3 | Média (fora da spec) | `save-imported-chart` mudou de `confirmedKey` para `selectedSongKey` e passa a sobrescrever o `defaultKey` da música existente. Mudança de produto não coberta por `chart-import` nem `import-access`; os testes foram ajustados, a spec não. |
| F4 | Baixa | `ImportPageClient` ignora falha do `DELETE` de logout (G7). |
| F5 | Info | Verificação do cookie `Secure` no Safari em `localhost` pedida no Design continua em aberto (G5). |

## Estado da feature

- **Funcional:** sim; flag, segredo, sessão assinada, rate limit, fila, gate nas rotas e log existem e batem com a spec na leitura.
- **Verificada:** não. Faltam testes para o gate de cifra, o `ImportLog` e a rota de sessão (G1-G3), e a prova de que os testes pegam regressões (G6).
- **Condição para deploy público (STATE.md):** fechar G1, G2 e G3 antes de considerar a restrição atendida.

## Observação sobre `server-persistence`

Ao conferir o gate, notei que `git ls-files` só tem 5 arquivos de teste em `lib/persistence` e nenhum para rotas (`app/api/songs`, `charts`, `song-charts`, `migrations`), repositório Prisma, `http-music-repository`, `validate-persistence-input` e `local-data-migration`. O `tasks.md` dela prevê testes para todos esses itens e está como `Complete` com 57 checkboxes em aberto.
