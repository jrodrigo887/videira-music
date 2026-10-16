# Papel personalizado sem o pacote do admin

## Problem Statement

O admin cria papéis da igreja marcando capacidades de um conjunto fechado. Esse conjunto inteiro é o preset do papel de sistema `admin`. A criação e a alteração aceitam as sete juntas, então um papel personalizado pode ficar com o mesmo pacote do administrador.

## Goals

- [x] Criar ou alterar um papel personalizado com as sete capacidades responde `409 ROLE_MATCHES_ADMIN` e não grava.
- [x] Um papel com seis capacidades, ou menos, continua sendo gravado.
- [x] A aba Papéis impede o envio quando a seleção cobre o preset do admin e mostra a frase definida abaixo.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Trocar o Better Auth ou mover `canPerform` para o banco | A decisão de acesso permanece: atribuição no banco, regra do objeto no código. |
| Semear editor de cifras, líder local, secretaria ou apoio de grupos | Sugestão de uso do catálogo, não uma regra nova. |
| Impedir que gestor e líder de louvor, somados na mesma pessoa, reúnam as sete capacidades | A regra vale para o papel personalizado. A soma dos papéis de sistema permanece. |
| Conceder `admin`, editar o catálogo e a trava do último admin | Continuam exigindo a chave de sistema `admin`, como em ADM-16 e ADM-07. |
| Chave ou nome iguais aos de um papel de sistema | Já respondem `409 ROLE_EXISTS` e `409 SYSTEM_ROLE`. |
| Capacidade fora do conjunto fechado | Continua `400 INVALID_ROLE` (ADM-08). |
| Apagar papéis personalizados já gravados com as sete | Não há migração. A carga do ator continua resolvendo o que está no banco. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| O que conta como pacote do admin | A lista enviada contém cada capacidade de `systemCapabilities("admin")`. Ordem e repetição não mudam o resultado. | O preset do admin é o catálogo inteiro. Faltar uma capacidade deixa de ser esse pacote. | sim |
| Código HTTP | `409 ROLE_MATCHES_ADMIN`, sem gravar e sem alterar a linha. | As capacidades são válidas. A combinação é reservada, no mesmo tipo de conflito de `ROLE_EXISTS`. | sim |
| Frase na tela | Um papel personalizado não pode ter as mesmas capacidades do administrador. | Criar, salvar e a resposta da API usam a mesma frase. | sim |
| Renomear sem enviar capacidades | Grava o nome novo e não aplica esta regra. | A checagem roda quando o corpo traz `capabilities`. | sim |
| Papel já gravado com as sete | A carga do ator continua entregando essas capacidades. A próxima alteração que envie as sete é recusada. | Não há linha conhecida para migrar, e a recusa na escrita impede manter o pacote de propósito. | sim |
| Auditoria da recusa | Não grava `AuthAuditLog`. | O log atual registra o que foi gravado. | sim |
| Concorrência | Cada pedido valida o próprio corpo. Sem trava nova. | Não há contador nem estado compartilhado além da linha do papel. | sim |
| Demais dimensões | Sem TTL, sem chamada externa e sem retentativa especial. Reenviar o mesmo corpo recusado responde de novo `409` e continua sem gravar. | O pedido não depende de outro serviço nem de prazo. | sim |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Recusar o pacote do admin ⭐ MVP

**User Story**: Como admin, quero que um papel personalizado não possa ficar com as mesmas capacidades do administrador, para esse pacote existir só no papel de sistema.

**Why P1**: Sem isso, o catálogo cria um segundo admin sem a chave `admin`.

**Acceptance Criteria**:

1. WHEN um admin cria um papel personalizado e a lista de capacidades contém cada capacidade do preset de `admin` THEN the system SHALL responder `409 ROLE_MATCHES_ADMIN` e SHALL não gravar o papel. (PAD-01)
2. WHEN um admin altera um papel personalizado enviando `capabilities` e essa lista contém cada capacidade do preset de `admin` THEN the system SHALL responder `409 ROLE_MATCHES_ADMIN` e SHALL manter as capacidades já gravadas. (PAD-02)
3. WHEN um admin cria um papel personalizado com exatamente seis das sete capacidades THEN the system SHALL gravar essas seis. (PAD-03)
4. WHEN a lista contém as mesmas capacidades do preset de `admin` em outra ordem, ou repete uma capacidade conhecida, THEN the system SHALL responder `409 ROLE_MATCHES_ADMIN`. (PAD-04)
5. WHEN um admin altera um papel personalizado enviando só um nome novo, sem `capabilities`, THEN the system SHALL gravar o nome e SHALL não aplicar `ROLE_MATCHES_ADMIN`. (PAD-05)
6. IF criar ou alterar responde `ROLE_MATCHES_ADMIN` THEN the system SHALL não acrescentar linha em `AuthAuditLog` por essa tentativa. (PAD-06)
7. WHILE existir um papel personalizado já gravado com as sete capacidades, the system SHALL continuar incluindo essas capacidades no `Actor` de quem tem esse papel. (PAD-07)
8. WHILE uma pessoa tiver os papéis de sistema `manager` e `worship_leader`, the system SHALL continuar concedendo a união desses presets. (PAD-08)

**Independent Test**: Criar "Coordenação" com as sete capacidades responde `409` e o papel não aparece. Criar o mesmo nome com seis capacidades grava. Alterar esse papel de volta para as sete responde `409` e as seis permanecem.

---

### P1: Aviso na aba Papéis ⭐ MVP

**User Story**: Como admin, quero ver o bloqueio antes de enviar, para não descobrir a recusa só pela resposta da API.

**Why P1**: A regra de escrita sem a tela deixa o admin marcar um pacote que o servidor vai recusar.

**Acceptance Criteria**:

1. WHEN a seleção de Novo papel contém cada capacidade do preset de `admin` THEN the system SHALL desabilitar o botão Criar papel. (PAD-09)
2. WHEN a seleção de Novo papel contém cada capacidade do preset de `admin` THEN the system SHALL mostrar "Um papel personalizado não pode ter as mesmas capacidades do administrador." (PAD-10)
3. WHEN a seleção de edição de um papel personalizado contém cada capacidade do preset de `admin` THEN the system SHALL desabilitar o botão Salvar. (PAD-11)
4. WHEN a seleção de edição de um papel personalizado contém cada capacidade do preset de `admin` THEN the system SHALL mostrar a mesma frase nessa edição. (PAD-12)
5. IF a API responder `ROLE_MATCHES_ADMIN` THEN the system SHALL mostrar a mesma frase na área de mensagem da aba Papéis. (PAD-13)

**Independent Test**: Marcar as sete caixas em Novo papel desabilita Criar papel e mostra a frase. Desmarcar uma habilita o botão e esconde a frase.

---

## Edge Cases

- PAD-04: ordem diferente e capacidade repetida continuam sendo o pacote do admin.
- PAD-05: renomear sem enviar capacidades não dispara a regra.
- PAD-07: papel antigo com as sete segue valendo na carga até uma alteração de capacidades.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PAD-01 | P1: Recusar o pacote do admin | - | Done |
| PAD-02 | P1: Recusar o pacote do admin | - | Done |
| PAD-03 | P1: Recusar o pacote do admin | - | Done |
| PAD-04 | P1: Recusar o pacote do admin | - | Done |
| PAD-05 | P1: Recusar o pacote do admin | - | Done |
| PAD-06 | P1: Recusar o pacote do admin | - | Done |
| PAD-07 | P1: Recusar o pacote do admin | - | Done |
| PAD-08 | P1: Recusar o pacote do admin | - | Done |
| PAD-09 | P1: Aviso na aba Papéis | - | Done |
| PAD-10 | P1: Aviso na aba Papéis | - | Done |
| PAD-11 | P1: Aviso na aba Papéis | - | Done |
| PAD-12 | P1: Aviso na aba Papéis | - | Done |
| PAD-13 | P1: Aviso na aba Papéis | - | Done |

**Coverage:** 13 total, 0 mapped to tasks, 13 unmapped.

---

## Success Criteria

- [x] Nenhuma criação ou alteração nova deixa um papel personalizado com as sete capacidades.
- [x] Um papel com seis capacidades grava e passa a valer na carga do `Actor`.
- [x] A aba Papéis bloqueia o envio do pacote completo e explica o motivo com a frase da spec.
