# Edição de cifra salva

## Problem Statement

A cifra gravada não pode ser corrigida. O import só revisa o texto antes do primeiro save. Na página da música, quem edita só muda "visível ao público". O tom sobe e desce na sessão e não grava.

## Goals

- [ ] Quem tem `music:write` corrige letra e acordes de uma cifra com letra já salva.
- [ ] O save grava na mesma cifra. Setlists que apontam para ela mostram a correção. O selo Importada e o link da fonte permanecem.
- [ ] Buscar cifra nova continua exigindo a capacidade `import`.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Grade por compassos | O editor cobre só `format: lyrics`. |
| Cifra de exemplo, sem persistência | Não há `source` gravado para reabrir. |
| Cifra persistida sem `source` | Não há texto para reprocessar. |
| Arquivar música ou cifra | Fica para outra feature. |
| Versão (simplificada ou trabalhada) | Outra cifra da mesma música, sem reusar a `originUrl`. |
| Nova capacidade ou papel | O catálogo de sete capacidades não muda. |
| Alterar `song.defaultKey` | O tom do editor é o `chart.key`. |
| Gravar o transpose da sessão | Os botões de meio-tom continuam só na tela. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Onde editar | Página da música, um editor por cifra | A pessoa corrige onde já lê a cifra. | sim |
| Formato | Texto do `source`, mais tom, capo e tipo de seção | Mesmo gesto da revisão do import. O armazenamento continua estruturado. | sim |
| Tom | `chart.key`, lista fechada da revisão do import | Não é o `defaultKey` da música. | sim |
| Capo | `chart.capo`; vazio remove o capo | O import só herda o capo detectado. Aqui a pessoa corrige. | sim |
| Tipo de seção | Confirmado de novo depois que o texto muda | O parser classifica pelo rótulo. O rótulo original da seção não é editado. | sim |
| Save | Mesma cifra: mesmo `id`, `songId` e `originUrl` | Setlists acompanham. O selo e a fonte ficam. | sim |
| Quem edita | `music:write`, no botão e no `PUT` | A matriz de papéis já separa editar música de importar. | sim |
| Origem igual | `PUT` da mesma `originUrl` não exige `import` nem a flag, e não grava `ImportLog` | Corrigir não é buscar cifra nova. | sim |
| Origem nova | Criar com `origin` ou trocar `originUrl` segue o gate de import | Impede gravar uma importação nova pelo editor. | sim |
| Limite | Texto vazio não salva. Acima de 500 KiB UTF-8 não salva. | O mesmo teto do import. | sim |
| `chordTokens` | O reprocessamento usa só o `source` | Os tokens da página do Cifra Club não ficam gravados. Os símbolos já estão no texto. | sim |
| Concorrência | O último `PUT` vence | A cifra não tem `expectedVersion`. | não, default técnico |
| Log | Sem o texto integral da cifra | O import já evita vazar a cifra no log. | sim |

**Open questions:** none.

---

## User Stories

### P1: Abrir o editor ⭐ MVP

**User Story**: Como alguém com `music:write`, quero abrir a cifra gravada na página da música para corrigir letra e acordes.

**Why P1**: Sem essa entrada não há correção.

**Acceptance Criteria**:

1. WHEN um ator com `music:write` abre a página de uma música com cifra persistida `lyrics` e `source` não vazio THEN o sistema SHALL mostrar "Editar cifra" nessa cifra. (CED-01)
2. IF o ator não tem `music:write` THEN o sistema SHALL omitir "Editar cifra". (CED-02)
3. IF a cifra é de exemplo, é `grid` ou não tem `source` THEN o sistema SHALL omitir "Editar cifra". (CED-03)
4. WHEN o ator abre o editor THEN o sistema SHALL mostrar o `source` gravado, o `chart.key`, o capo ou vazio, e o tipo de cada seção com o rótulo já gravado. (CED-04)

**Independent Test**: Na página da música, a cifra lyrics com `source` mostra o botão para quem tem `music:write` e esconde para os outros. Grade e cifra de exemplo não mostram o botão.

---

### P1: Corrigir e revisar ⭐ MVP

**User Story**: Como editor, quero alterar o texto e confirmar tom, capo e tipo de seção antes de gravar.

**Why P1**: A correção é o texto. O tipo precisa ser confirmado de novo porque o parser reclassifica pelo rótulo.

**Acceptance Criteria**:

1. WHEN o ator altera o texto THEN o sistema SHALL reprocessar com o parser do import, substituir as seções pelo resultado e recolocar cada tipo no valor classificado pelo parser. (CED-05)
2. WHEN o ator altera o tipo de uma seção, o tom ou o capo depois do reprocessamento e antes de salvar THEN o sistema SHALL manter essa alteração no rascunho. (CED-06)
3. IF o texto está vazio THEN o sistema SHALL não salvar e SHALL mostrar "Informe o texto da cifra." (CED-07)
4. IF o texto passa de 500 KiB em UTF-8 THEN o sistema SHALL não salvar e SHALL mostrar "O texto deve ter no máximo 500 KiB." (CED-08)
5. WHEN o parser emite avisos THEN o sistema SHALL listá-los antes do salvamento. (CED-09)
6. WHEN o ator limpa o capo e salva THEN o sistema SHALL gravar a cifra sem capo. (CED-10)

**Independent Test**: Mudar uma linha de acorde atualiza o preview e os tipos. Esvaziar o texto bloqueia o save com a mensagem acima.

---

### P1: Gravar na mesma cifra ⭐ MVP

**User Story**: Como editor, quero salvar por cima da mesma cifra para o setlist mostrar a correção sem trocar o item.

**Why P1**: É o save combinado no discovery.

**Acceptance Criteria**:

1. WHEN o salvamento conclui THEN o sistema SHALL manter o mesmo `id`, o mesmo `songId` e a mesma `originUrl`. (CED-11)
2. WHEN o salvamento conclui THEN o sistema SHALL gravar o `source` editado, as seções confirmadas e o `chart.key` escolhido. (CED-12)
3. WHEN o salvamento conclui THEN o sistema SHALL manter `title`, `timeSignature`, `tempo` e `song.defaultKey`. (CED-13)
4. WHEN um item de setlist aponta para esse `chartId` THEN o sistema SHALL continuar apontando para o mesmo id e SHALL exibir as seções gravadas. (CED-14)
5. IF o tom enviado não está na lista fechada da revisão do import THEN o sistema SHALL responder `422` com `VALIDATION_FAILED`. (CED-15)

**Independent Test**: Salvar muda seções e `source` e deixa `id`, `originUrl` e `defaultKey` da música iguais. O setlist que usa essa cifra mostra o texto novo.

---

### P1: Permissão no servidor ⭐ MVP

**User Story**: Como igreja, quero que corrigir uma cifra importada exija editar música, e que uma origem nova continue exigindo importar.

**Why P1**: Hoje o `PUT` com `origin` chama o gate de import e bloqueia quem só tem `music:write`.

**Acceptance Criteria**:

1. IF não há ator autenticado THEN o `PUT /api/charts/{chartId}` SHALL responder `401` com `UNAUTHENTICATED`. (CED-16)
2. IF o ator não tem `music:write` THEN o `PUT` SHALL responder `403` com `FORBIDDEN`. (CED-17)
3. WHEN o `PUT` atualiza uma cifra existente e a `originUrl` do corpo é a mesma já gravada THEN o sistema SHALL responder `204` com `music:write`, sem a capacidade `import` e com a flag de import desligada, e SHALL não gravar `ImportLog`. (CED-18)
4. IF o `PUT` cria uma cifra com `origin`, ou troca a `originUrl`, e a flag de import está desligada THEN o sistema SHALL responder `404` com `NOT_FOUND`. (CED-19)
5. IF o `PUT` cria uma cifra com `origin`, ou troca a `originUrl`, e o ator não tem a capacidade `import` THEN o sistema SHALL responder `401` com `IMPORT_LOCKED`. (CED-20)
6. IF o corpo é inválido THEN o `PUT` SHALL responder `422` com `VALIDATION_FAILED`. (CED-21)
7. IF a persistência falha THEN o sistema SHALL manter o rascunho na tela e SHALL permanecer na página da música. (CED-22)
8. The system SHALL não registrar o texto integral da cifra em log. (CED-23)

**Independent Test**: Um ator com `music:write` e sem `import` recebe `204` ao corrigir a cifra importada. Trocar a `originUrl` com a flag desligada recebe `404`. Sem `music:write`, o `PUT` recebe `403`.

---

## Edge Cases

- IF o texto reprocessado perde um acorde que os `chordTokens` da página reconheciam THEN o sistema SHALL mostrar o aviso do parser e SHALL gravar só o que o ator confirmar. (CED-09)
- IF duas edições salvam a mesma cifra THEN o sistema SHALL persistir o corpo do último `PUT`.
- WHEN a música tem duas cifras lyrics com `source` THEN o sistema SHALL oferecer "Editar cifra" em cada uma. (CED-01)

---

## Implicit Requirement Dimensions

- **Validação:** vazio, 500 KiB, tom fora da lista e corpo inválido respondem sem gravar (CED-07, CED-08, CED-15, CED-21).
- **Falha parcial:** falha de persistência não descarta o rascunho (CED-22).
- **Idempotência:** repetir o mesmo `PUT` deixa a cifra no mesmo estado. Coberto pelo último `PUT` vencer e pelo `204` da mesma origem (CED-18).
- **Auth:** `music:write` para corrigir; `import` só para origem nova (CED-16 a CED-20).
- **Concorrência:** último `PUT` vence. Sem `expectedVersion` nesta entrega.
- **Ciclo de vida:** sem arquivar e sem apagar. A origem gravada permanece (CED-11).
- **Observabilidade:** sem texto integral no log e sem `ImportLog` na correção (CED-18, CED-23).
- **Dependência externa:** N/A. A correção não busca o Cifra Club.
- **Transição de estado:** N/A. Não há status de arquivamento nesta entrega.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CED-01 | P1: Abrir o editor | T11 | In Tasks |
| CED-02 | P1: Abrir o editor | T11 | In Tasks |
| CED-03 | P1: Abrir o editor | T11 | In Tasks |
| CED-04 | P1: Abrir o editor | T10 | In Tasks |
| CED-05 | P1: Corrigir e revisar | T10 | In Tasks |
| CED-06 | P1: Corrigir e revisar | T10 | In Tasks |
| CED-07 | P1: Corrigir e revisar | T10 | In Tasks |
| CED-08 | P1: Corrigir e revisar | T10 | In Tasks |
| CED-09 | P1: Corrigir e revisar | T10 | In Tasks |
| CED-10 | P1: Corrigir e revisar | T3 | In Tasks |
| CED-11 | P1: Gravar na mesma cifra | T3 | In Tasks |
| CED-12 | P1: Gravar na mesma cifra | T3 | In Tasks |
| CED-13 | P1: Gravar na mesma cifra | T3 | In Tasks |
| CED-14 | P1: Gravar na mesma cifra | T9 | In Tasks |
| CED-15 | P1: Gravar na mesma cifra | T1, T9 | In Tasks |
| CED-16 | P1: Permissão no servidor | T9 | In Tasks |
| CED-17 | P1: Permissão no servidor | T9 | In Tasks |
| CED-18 | P1: Permissão no servidor | T8, T9 | In Tasks |
| CED-19 | P1: Permissão no servidor | T8, T9 | In Tasks |
| CED-20 | P1: Permissão no servidor | T8, T9 | In Tasks |
| CED-21 | P1: Permissão no servidor | T9 | In Tasks |
| CED-22 | P1: Permissão no servidor | T10 | In Tasks |
| CED-23 | P1: Permissão no servidor | T9 | In Tasks |

**Coverage:** 23 total, 23 mapped to tasks, 0 unmapped.

---

## Success Criteria

- [ ] Um ator com `music:write` e sem `import` corrige uma cifra importada e recebe `204`.
- [ ] O setlist que usa essa cifra mostra o texto novo, com o mesmo selo e o mesmo link.
- [ ] Trocar a `originUrl` sem permissão de import não grava.
- [ ] Grade, cifra de exemplo e ator sem `music:write` não abrem o editor.
