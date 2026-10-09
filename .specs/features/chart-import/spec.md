# Importação e persistência de cifras

## Problem Statement

O parser de texto já produz `ImportDraft`, mas o usuário ainda não consegue iniciar, revisar, vincular ou salvar uma importação no app. O fluxo também precisa aceitar uma URL do Cifra Club em ambiente local, sem expor scraping no deploy público e sem buscar novamente uma URL já salva.

## Goals

- [ ] Permitir importar texto colado e URL do Cifra Club pelo mesmo fluxo de revisão.
- [ ] Exigir revisão humana do tom, das seções e do vínculo com uma música antes de salvar.
- [ ] Persistir músicas e cifras importadas no navegador e exibi-las na biblioteca e no detalhe.
- [ ] Manter o adaptador Cifra Club local, limitado, rastreável e protegido por flag.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Busca de músicas dentro do Cifra Club | O usuário fornecerá uma URL específica. |
| Importação em lote, crawler ou sitemap | Viola os guardrails de uso pessoal/local. |
| Stealth, proxy, rotação de IP ou resolução de captcha | O fluxo deve cair para texto colado quando houver bloqueio. |
| Sincronização entre dispositivos ou PostgreSQL | A persistência do MVP é local ao navegador. |
| Autenticação e permissões | O fluxo roda localmente e não será publicado com o adaptador ativo. |
| Persistência automática de `ImportDraft` | O draft é temporário até o salvamento explícito. |
| Preservação estruturada de tablaturas | Elas permanecem somente no texto de origem e geram warning. |
| Importação de arquivo ou ChordPro | Entrega posterior, fora das fatias 6, 7 e 9. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Projeto-alvo | Repositório Next.js `videira-music` | O repositório contém parser, modelos, catálogo e telas citados no discovery. | sim |
| Escopo | Fluxo completo das fatias 6, 7 e 9 | O usuário escolheu UI, persistência e adaptador/rota na mesma entrega. | sim |
| Vínculo sugerido | Sugerir correspondência, mas exigir confirmação | Evita vínculo incorreto por título ou artista semelhante. | sim |
| Requisições dentro do intervalo de 10 segundos | Enfileirar e aguardar | O usuário preferiu espera a erro HTTP 429. | sim |
| URL já salva | Abrir a cifra existente sem nova busca | Cumpre o guardrail de não buscar novamente o que já foi importado. | sim |
| Persistência do MVP | Storage do navegador atrás de repositórios | Mantém os dados locais e permite trocar o adaptador futuramente. | sim |
| Limite do texto de entrada | 500 KiB em UTF-8 | Evita travamento acidental sem restringir uma cifra normal. | não, default técnico |
| Concorrência de salvamento | Escritas serializadas no cliente | Evita atualizações perdidas entre ações rápidas na mesma aba. | não, default técnico |
| Expiração dos dados locais | Sem expiração automática | Música e cifra salvas devem sobreviver a reloads até remoção do storage. | não, default técnico |
| Observabilidade | Erros sem letra ou cifra integral em logs | O TDD proíbe vazar conteúdo musical bruto. | sim |

**Open questions:** none.

## User Stories

### P1: Importar texto e revisar

**User Story**: Como músico, quero colar uma cifra e revisar o resultado para corrigir tom e seções antes de salvar.

**Why P1**: É o fallback confiável e valida o fluxo sem depender de serviço externo.

**Acceptance Criteria**:

1. WHEN o usuário enviar texto não vazio de até 500 KiB THEN o sistema SHALL gerar um `ImportDraft` e exibir texto original, preview, estatísticas e warnings.
2. IF o texto estiver vazio ou exceder 500 KiB THEN o sistema SHALL impedir o avanço e exibir um erro específico.
3. WHEN o draft contiver tom sugerido ou divergente THEN o sistema SHALL exigir confirmação explícita do tom antes do salvamento.
4. WHEN o usuário alterar o tipo de uma seção THEN o sistema SHALL atualizar o preview sem alterar o rótulo original.
5. WHILE um draft não tiver tom confirmado e música vinculada THEN o sistema SHALL manter a ação de salvar indisponível.

**Independent Test**: Colar uma cifra inventada, corrigir uma seção e confirmar o tom até chegar à etapa de vínculo.

### P1: Vincular e persistir

**User Story**: Como músico, quero vincular a cifra a uma música existente ou criar uma nova para encontrá-la depois na biblioteca.

**Why P1**: Sem persistência o fluxo não produz valor após a revisão.

**Acceptance Criteria**:

1. WHEN título e artista produzirem correspondências no catálogo THEN o sistema SHALL sugeri-las sem selecionar automaticamente uma música.
2. WHEN o usuário confirmar uma música existente THEN o sistema SHALL salvar a cifra com o `songId` confirmado.
3. WHEN o usuário criar uma música THEN o sistema SHALL persistir a nova `Song` com identificador não conflitante com o seed.
4. WHEN o salvamento terminar THEN o sistema SHALL navegar para o detalhe da música e exibir a cifra importada com transposição funcional.
5. WHEN o navegador recarregar THEN o sistema SHALL restaurar músicas e cifras persistidas localmente.
6. IF o storage falhar THEN o sistema SHALL manter o draft em memória, não navegar e informar que nada foi salvo.

**Independent Test**: Criar uma música a partir do draft, salvar, recarregar e abrir a cifra persistida.

### P1: Importar URL do Cifra Club localmente

**User Story**: Como músico usando o app localmente, quero informar uma URL do Cifra Club para preencher o draft sem copiar o texto manualmente.

**Why P1**: É a automação solicitada, limitada pelos guardrails já aceitos.

**Acceptance Criteria**:

1. WHERE `VIDEIRA_ENABLE_CIFRACLUB_IMPORT=true` WHEN o usuário enviar uma URL HTTPS suportada THEN o sistema SHALL buscar uma única página e devolver um `ImportDraft`.
2. WHERE a flag não estiver ativa THEN o sistema SHALL ocultar a entrada por URL e responder `404` na rota.
3. IF a URL não pertencer a `cifraclub.com.br` ou `www.cifraclub.com.br` THEN o sistema SHALL responder `422` com `UNSUPPORTED_SOURCE`.
4. IF a origem responder com bloqueio ou captcha THEN o sistema SHALL responder `502` com `SOURCE_BLOCKED` e oferecer o fallback de texto colado.
5. IF a página não contiver `pre[data-chord-content]` THEN o sistema SHALL responder `502` com `SOURCE_LAYOUT_CHANGED`.
6. IF a navegação exceder o timeout configurado THEN o sistema SHALL responder `504` com `SOURCE_TIMEOUT`.
7. WHILE uma busca anterior estiver dentro do intervalo global de 10 segundos WHEN outra URL for solicitada THEN o sistema SHALL enfileirar a nova busca até o intervalo terminar.
8. WHEN a URL já existir em uma cifra local THEN o sistema SHALL abrir a cifra existente sem chamar a rota externa.
9. WHEN a importação for concluída THEN o sistema SHALL preservar URL, fonte e data em `origin` e exibir atribuição ao Cifra Club.
10. The adapter SHALL execute Chromium in headed mode, reuse one browser, close it after inactivity, and avoid anti-bot evasion.

**Independent Test**: Com a flag ativa, importar uma fixture/URL suportada, revisar o draft e confirmar a origem; com a flag inativa, verificar ausência do campo e `404`.

### P2: Integrar catálogo local

**User Story**: Como músico, quero que músicas criadas e cifras importadas apareçam junto ao catálogo seed.

**Why P2**: Completa a navegação após o primeiro salvamento sem alterar o seed versionado.

**Acceptance Criteria**:

1. WHEN a biblioteca carregar THEN o sistema SHALL combinar o seed somente leitura com músicas locais sem duplicar IDs.
2. WHEN uma música local for pesquisada por título, artista ou tom THEN o sistema SHALL incluí-la nos resultados.
3. WHEN o detalhe de uma música seed ou local abrir THEN o sistema SHALL listar suas cifras persistidas.
4. The system SHALL keep imported lyrics out of `data/musicas.json` and all committed fixtures.

**Independent Test**: Salvar uma música local e encontrá-la pela busca após reload.

## Edge Cases

- IF o JSON da rota estiver malformado ou sem `url` THEN o sistema SHALL responder `400` sem iniciar o navegador.
- IF um redirect terminar fora dos hosts permitidos THEN o sistema SHALL interromper a importação com `SOURCE_BLOCKED`.
- IF duas ações de salvar ocorrerem em sequência THEN o sistema SHALL serializar as escritas e preservar ambos os registros válidos.
- IF metadados de página estiverem ausentes THEN o sistema SHALL gerar o draft com os campos disponíveis e manter a revisão obrigatória.
- IF o tom da página divergir dos acordes THEN o sistema SHALL usar o tom dos acordes e emitir `KEY_MISMATCH`.
- IF o cache HTML estiver corrompido THEN o sistema SHALL ignorá-lo e realizar uma nova busca sujeita ao rate limit.
- IF o Chromium não estiver instalado THEN o sistema SHALL retornar `SOURCE_BLOCKED` com orientação local de instalação sem registrar conteúdo musical.

## Implicit Requirement Dimensions

- **Input validation & bounds**: URL HTTPS em allowlist; texto limitado a 500 KiB; corpo inválido recebe `400`.
- **Failure / partial failure**: falha de storage mantém draft; falha externa oferece texto colado.
- **Idempotency / retry / duplicates**: `origin.url` identifica cifra existente; cache por URL evita nova busca.
- **Auth boundaries & rate limits**: autenticação é N/A porque o adaptador só existe localmente; flag e fila global protegem a rota.
- **Concurrency / ordering**: fila externa respeita 10 segundos; escritas locais são serializadas.
- **Data lifecycle / expiry**: dados salvos não expiram; drafts não são persistidos.
- **Observability**: erros identificam módulo e código sem registrar cifra integral.
- **External dependency failure**: bloqueio, layout e timeout têm códigos e fallback explícitos.
- **State-transition integrity**: somente `draft revisado + tom confirmado + música confirmada` pode virar cifra salva.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IMP-01 | Importar texto e revisar | T1, T2, T9, T10 | Implemented (T1-T2, T9-T10 complete) |
| IMP-02 | Importar texto e revisar | T2, T9 | Implemented (T2, T9 complete) |
| IMP-03 | Importar texto e revisar | T2, T5, T9 | Implemented (T2, T5, T9 complete) |
| IMP-04 | Importar texto e revisar | T9 | Implemented (T9 complete) |
| IMP-05 | Vincular e persistir | T3, T5, T9, T11 | Implemented (T3, T5, T9, T11 complete) |
| IMP-06 | Vincular e persistir | T3, T4, T5, T12 | In Progress (T3-T5 complete) |
| IMP-07 | Vincular e persistir | T3, T4, T5, T12 | In Progress (T3-T5 complete) |
| IMP-08 | Importar URL do Cifra Club | T1, T2, T6, T7, T8, T9, T13 | In Progress (T1-T2, T6-T9 complete) |
| IMP-09 | Importar URL do Cifra Club | T8, T9, T10, T13 | In Progress (T8-T10 complete) |
| IMP-10 | Importar URL do Cifra Club | T6, T7, T8, T9 | Implemented (T6-T9 complete) |
| IMP-11 | Importar URL do Cifra Club | T7, T8 | Implemented (T7-T8 complete) |
| IMP-12 | Importar URL do Cifra Club | T6, T7, T8 | Implemented (T6-T8 complete) |
| IMP-13 | Integrar catálogo local | T1, T3, T4, T11, T12 | In Progress (T1, T3-T4, T11 complete) |
| IMP-14 | Segurança e rastreabilidade | T6, T7, T12, T13 | In Progress (T6-T7 complete) |

**Coverage:** 14 total, 14 mapped to tasks, 0 unmapped.

## Success Criteria

- [ ] Texto colado chega ao detalhe de uma música como cifra persistida e transponível.
- [ ] URL suportada gera o mesmo fluxo quando a flag local está ativa.
- [ ] Repetir uma URL salva não realiza nova busca externa.
- [ ] Reload preserva músicas e cifras locais.
- [ ] Testes, lint e build passam sem conteúdo protegido em fixtures.
