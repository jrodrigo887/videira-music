# Fundação de permissões

## Problem Statement

O Gestor entra em Usuários, troca papel de quem não é Admin e desativa contas. O discovery reserva isso ao Admin. Várias mutações de setlist e de grupo passam no portão da API com `music:read`, capacidade de qualquer membro, e a recusa fica só dentro do serviço. Um papel personalizado ainda pode receber o pacote que administra usuários.

## Goals

- [ ] Gestor convida, lista membros e gere grupos. Trocar papel, desativar, aprovar pedido de acesso e o catálogo de papéis respondem `403` para ele.
- [ ] Mutação de setlist ou grupo sem a capacidade correspondente responde `403` no portão. Rota de persistência sem capacidade declarada responde `403`.
- [ ] Papel personalizado não grava `user.manage` nem `role.manage`. A aba Papéis agrupa capacidades, aplica dependências e mostra a prévia.
- [ ] URL autenticada sem a capacidade mostra "Você não tem acesso a esta área".

## Out of Scope

| Feature | Reason |
| --- | --- |
| Papel Técnico, `audit.view`, `logs.view`, `user.support` | Fundação não inclui suporte nem telas de log. |
| `org.settings` e cobrança | Não há essa área no produto. |
| `song.delete` e lixeira de músicas | Não há exclusão de música. |
| Gravar evento de acesso negado | Logs técnicos ficam para a etapa seguinte. O `403` continua sendo a resposta. |
| Líder convidar o próprio grupo, sugestão de cifra, autor editar sem capacidade | Decisões D2, D3 e D4 do discovery. |
| Migrar papéis personalizados que tenham `users:manage` gravado | O id sai do catálogo e a carga ignora id desconhecido. Ninguém ganha `member.manage` nem `user.manage` por causa dessa linha antiga. |
| Delegação temporária, link público de setlist, histórico de cifra, personificação | Fora do discovery desta etapa. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Gestor perde área de usuário | Troca de papel, desativação e aprovação de pedido de acesso exigem `user.manage`, só no preset `admin`. Convite exige `users:invite`. Listar membros exige `member.manage`. Catálogo de papéis exige `role.manage`. | Escolha confirmada: seguir o discovery. O Gestor fica com convite, membros e grupos. | sim |
| Escopo | Esta spec cobre catálogo, portão, telas de papéis e de sem acesso. | Escolha confirmada: Técnico, logs e suporte ficam depois. | sim |
| Ids estáveis | Permanecem `music:write`, `import`, `setlists:led`, `setlists:all`, `users:invite`, `teams:manage`. Entram `member.manage`, `user.manage`, `role.manage`. Sai `users:manage`. | Evita renomear o que o código e os testes já usam. | sim |
| Implicação | Quem tem `import` tem `music:write`. Quem tem `member.manage` tem `users:invite`. Quem tem `setlists:all` tem `setlists:led`. A carga do ator acrescenta a capacidade implicada. O save de papel personalizado grava o conjunto fechado. | A dependência vale na API, não só no checkbox. | sim |
| Caps exclusivas do Admin | `user.manage` e `role.manage` só existem no preset `admin`. Papel personalizado que as envie responde `409 ADMIN_ONLY_CAPABILITY` e não grava. Isso substitui `409 ROLE_MATCHES_ADMIN` como trava de escalada. Um papel com todas as capacidades que não são exclusivas grava. | O pacote do Admin deixa de ser "as sete". A escalada é ter capacidade de administrar usuários ou papéis. | sim |
| Atribuir o papel `admin` | Exige `role.manage` no ator. O último Admin ativo continua `409 LAST_ADMIN` ao perder o papel ou ser desativado. | Integridade da conta Admin permanece. A autorização do ator deixa de ser `hasRole("admin")`. | sim |
| Pedido de acesso na tela sem acesso | A tela mostra o título e a frase "Peça acesso a um Gestor ou a um Admin." Não chama `POST /api/access-requests`. | Esse POST é de quem ainda não é membro. Não há fluxo novo de pedir uma capacidade. | sim |
| Anônimo | Página protegida sem sessão redireciona para `/entrar`. A tela de sem acesso é só para usuário autenticado. | Já é o comportamento de `/usuarios`. | sim |
| Leitura | GET de músicas, cifras e setlists continua permitido a qualquer membro da organização. GET `/api/teams` exige `teams:manage`. | O discovery trata ver biblioteca e setlists como base. A lista administrativa de grupos não é base. | sim |
| Portão de setlist | POST, PATCH e DELETE de setlist, itens, clone e follow exigem `setlists:led` ou `setlists:all` antes do serviço. O serviço continua recusando o grupo em que a pessoa não é líder. Os dois casos respondem `403` com `{ "error": { "code": "FORBIDDEN" } }`. | A rota deixa de aceitar qualquer membro. O vínculo com o grupo continua no serviço. | sim |
| Sessão | A próxima requisição depois da troca de papel usa as capacidades novas. Não há espera de expiração de token. | A carga do ator já lê o banco a cada request. | sim |
| Concorrência | A contagem do último Admin é a do momento do pedido. Sem trava nova. | Não há mudança de integridade além da capacidade exigida. | assumido |
| Validação | Capacidade fora do catálogo continua `400 INVALID_ROLE`. Reenviar o mesmo corpo recusado responde de novo o mesmo código e não grava. | Sem chamada externa, sem TTL e sem retentativa especial. | sim |
| Observabilidade | Esta etapa não grava log novo no `403`. Auditoria já existente de papel criado ou alterado permanece. | Log de acesso negado está fora de escopo. | sim |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Gestor fora da área de usuário ⭐ MVP

**User Story**: Como Admin, quero que o Gestor convide e veja membros sem trocar papel nem desativar ninguém, para a área de usuário ficar só comigo.

**Why P1**: É a mudança de comportamento confirmada. Sem ela o discovery não vale na API.

**Acceptance Criteria**:

1. WHEN um ator com o papel `manager` envia `PUT /api/members/:userId/roles` THEN the system SHALL responder `403` com `{ "error": { "code": "FORBIDDEN" } }` e SHALL manter os papéis gravados. (PERM-01)
2. WHEN um ator com o papel `manager` envia `POST /api/members/:userId/deactivate` THEN the system SHALL responder `403` com `{ "error": { "code": "FORBIDDEN" } }` e SHALL manter o usuário ativo. (PERM-02)
3. WHEN um ator com o papel `manager` envia `POST /api/access-requests/:id/approve` ou `POST /api/access-requests/:id/reject` THEN the system SHALL responder `403` com `{ "error": { "code": "FORBIDDEN" } }`. (PERM-03)
4. WHEN um ator com o papel `manager` envia `GET /api/roles`, `POST /api/roles`, `PATCH /api/roles/:key` ou `DELETE /api/roles/:key` THEN the system SHALL responder `403` com `{ "error": { "code": "FORBIDDEN" } }`. (PERM-04)
5. WHEN um ator com o papel `manager` envia `GET /api/members` THEN the system SHALL responder `200`. (PERM-05)
6. WHEN um ator com o papel `manager` e `users:invite` envia `POST /api/invites` com corpo válido THEN the system SHALL responder `201`. (PERM-06)
7. WHEN um ator com `user.manage` envia `PUT /api/members/:userId/roles` com papéis atribuíveis, sem remover o último `admin` THEN the system SHALL responder `200` e SHALL gravar esses papéis. (PERM-07)
8. WHEN a página `/usuarios` é renderizada para um ator com `member.manage` e sem `user.manage` THEN the system SHALL mostrar membros e convites e SHALL omitir troca de papel, botão Desativar e aba Pedidos. (PERM-08)
9. WHEN a página `/usuarios` é renderizada para um ator sem `role.manage` THEN the system SHALL omitir a aba Papéis. (PERM-09)

**Independent Test**: Entrar como Gestor, abrir Usuários, ver membros e convites, e receber `403` ao trocar papel, desativar, aprovar pedido ou criar papel. Entrar como Admin e trocar o papel de um músico.

---

### P1: Portão nega por padrão ⭐ MVP

**User Story**: Como Músico, quero que a API recuse edição e gestão que eu não tenho, para o botão escondido não ser a única barreira.

**Why P1**: O furo atual é a mutação declarada como `music:read`.

**Acceptance Criteria**:

1. WHEN um ator com o papel `musician` envia `PUT /api/charts/:chartId` ou `PUT /api/songs/:songId` THEN the system SHALL responder `403` com `{ "error": { "code": "FORBIDDEN" } }`. (PERM-10)
2. WHEN um ator com o papel `musician` envia `POST /api/setlists` ou `POST /api/teams` THEN the system SHALL responder `403` com `{ "error": { "code": "FORBIDDEN" } }`. (PERM-11)
3. WHEN um ator com `setlists:led` cria ou edita um setlist do grupo em que o vínculo é `leader` THEN the system SHALL autorizar a ação. (PERM-12)
4. WHEN um ator com `setlists:led` cria ou edita um setlist de outro grupo THEN the system SHALL responder `403` com `{ "error": { "code": "FORBIDDEN" } }`. (PERM-13)
5. WHEN um ator com `teams:manage` envia `POST /api/teams` com nome válido THEN the system SHALL responder `201`. (PERM-14)
6. IF uma rota registrada em `wrapPersistenceRoute` não declara capacidade THEN the system SHALL responder `403` com `{ "error": { "code": "FORBIDDEN" } }` e SHALL não executar o handler. (PERM-15)
7. WHEN a requisição não tem sessão THEN the system SHALL responder `401` com `{ "error": { "code": "UNAUTHENTICATED" } }`. (PERM-16)
8. The system SHALL tratar `setlists:all` como suficiente para uma checagem de `setlists:led`, `member.manage` como suficiente para `users:invite`, e `import` como suficiente para `music:write`. (PERM-17)
9. WHEN o papel de um usuário ativo muda THEN the system SHALL aplicar as capacidades novas na requisição seguinte desse usuário. (PERM-18)

**Independent Test**: Chamar `POST /api/setlists` como Músico e receber `403`. Chamar como líder do grupo dono e receber sucesso. Chamar como líder de outro grupo e receber `403`.

---

### P1: Papel personalizado sem escalada ⭐ MVP

**User Story**: Como Admin, quero que um papel personalizado não receba área de usuário nem gestão de papéis, para ninguém montar um segundo Admin.

**Why P1**: Separar as capacidades sem essa trava devolve a escalada por outro caminho.

**Acceptance Criteria**:

1. IF o corpo de criar ou alterar papel personalizado contém `user.manage` ou `role.manage` THEN the system SHALL responder `409 ADMIN_ONLY_CAPABILITY` e SHALL não gravar essa lista. (PERM-19)
2. WHEN um admin cria um papel personalizado com todas as capacidades que não são `user.manage` nem `role.manage` THEN the system SHALL gravar essa lista. (PERM-20)
3. IF o corpo contém uma capacidade fora do catálogo THEN the system SHALL responder `400 INVALID_ROLE` e SHALL não gravar. (PERM-21)
4. WHEN o corpo traz `import` e não traz `music:write` THEN the system SHALL gravar as duas. (PERM-22)
5. WHEN o corpo traz `member.manage` e não traz `users:invite` THEN the system SHALL gravar as duas. (PERM-23)
6. WHEN o corpo traz `setlists:all` e não traz `setlists:led` THEN the system SHALL gravar as duas. (PERM-24)
7. WHILE a coluna `capabilities` de um papel personalizado contiver `users:manage` THEN the system SHALL ignorar esse id na carga do ator. (PERM-25)
8. WHEN um ator com `role.manage` inclui o papel `admin` em `PUT /api/members/:userId/roles` e ainda existe outro Admin ativo THEN the system SHALL gravar. (PERM-26)
9. IF `PUT /api/members/:userId/roles` ou a desativação removem o único Admin ativo THEN the system SHALL responder `409 LAST_ADMIN` e SHALL manter o Admin. (PERM-27)

**Independent Test**: Criar "Coordenação" com `user.manage` responde `409` e o papel não aparece. Criar o mesmo nome com `music:write`, `import`, `setlists:all`, `users:invite`, `member.manage` e `teams:manage` grava, e a linha gravada inclui `setlists:led`.

---

### P1: Aba Papéis e tela de sem acesso ⭐ MVP

**User Story**: Como Admin, quero montar um papel vendo o grupo, a dependência e a prévia, e como Músico quero uma tela clara quando abro uma URL proibida.

**Why P1**: O portão sem essas telas deixa o checkbox mentir e a URL cair num texto genérico.

**Acceptance Criteria**:

1. WHEN a aba Papéis está aberta para um ator com `role.manage` THEN the system SHALL agrupar as capacidades em Biblioteca, Setlists, Grupos e pessoas, e Administração. (PERM-28)
2. WHEN o admin marca `import` THEN the system SHALL marcar `music:write`. WHEN marca `member.manage` THEN the system SHALL marcar `users:invite`. WHEN marca `setlists:all` THEN the system SHALL marcar `setlists:led`. (PERM-29)
3. WHEN o admin desmarca `music:write` e `import` está marcado THEN the system SHALL desmarcar `import` e SHALL mostrar "Desmarcar esta capacidade também desmarca as que dependem dela." (PERM-30)
4. WHEN o admin desmarca `users:invite` e `member.manage` está marcado THEN the system SHALL desmarcar `member.manage` e SHALL mostrar a mesma frase. (PERM-31)
5. WHEN o admin desmarca `setlists:led` e `setlists:all` está marcado THEN the system SHALL desmarcar `setlists:all` e SHALL mostrar a mesma frase. (PERM-32)
6. WHILE o formulário é de papel personalizado the system SHALL mostrar `user.manage` e `role.manage` desabilitados, com o texto "Somente o papel Administrador pode ter esta capacidade." (PERM-33)
7. WHEN há ao menos uma capacidade marcada THEN the system SHALL mostrar "Este papel poderá:" seguido do rótulo de cada capacidade marcada. (PERM-34)
8. WHEN um usuário autenticado sem a capacidade abre `/import`, `/groups` ou `/usuarios?aba=papeis` THEN the system SHALL mostrar o título "Você não tem acesso a esta área" e a frase "Peça acesso a um Gestor ou a um Admin." e SHALL não enviar `POST /api/access-requests`. (PERM-35)
9. WHEN um usuário sem sessão abre `/import`, `/groups` ou `/usuarios` THEN the system SHALL redirecionar para `/entrar`. (PERM-36)
10. WHEN o ator tem `import` THEN the system SHALL mostrar o link Importar. WHEN tem `teams:manage` THEN the system SHALL mostrar o link Grupos. WHEN tem `member.manage`, `users:invite` ou `user.manage` THEN the system SHALL mostrar o link Usuários. (PERM-37)
11. WHEN o ator é `musician` THEN the system SHALL omitir os links Importar, Grupos e Usuários. (PERM-38)

**Independent Test**: Marcar Importar na aba Papéis marca Editar músicas e a prévia lista os dois rótulos. Abrir `/import` como Músico mostra o título de sem acesso. Abrir `/import` sem sessão cai em `/entrar`.

---

## Edge Cases

- PERM-13: líder do grupo A recebe `403` no setlist do grupo B mesmo com `setlists:led`.
- PERM-19: a lista completa do preset `admin`, por conter `user.manage` e `role.manage`, responde `409 ADMIN_ONLY_CAPABILITY` e não grava.
- PERM-25: papel antigo com `users:manage` não devolve essa capacidade, nem `member.manage`, nem `user.manage`.
- PERM-27: o único Admin ativo não é rebaixado nem desativado.
- PERM-15: a ausência de capacidade na rota não cai no handler.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PERM-01 | P1: Gestor fora da área de usuário | - | In Tasks |
| PERM-02 | P1: Gestor fora da área de usuário | - | In Tasks |
| PERM-03 | P1: Gestor fora da área de usuário | - | In Tasks |
| PERM-04 | P1: Gestor fora da área de usuário | - | In Tasks |
| PERM-05 | P1: Gestor fora da área de usuário | - | In Tasks |
| PERM-06 | P1: Gestor fora da área de usuário | - | In Tasks |
| PERM-07 | P1: Gestor fora da área de usuário | - | In Tasks |
| PERM-08 | P1: Gestor fora da área de usuário | - | In Tasks |
| PERM-09 | P1: Gestor fora da área de usuário | - | In Tasks |
| PERM-10 | P1: Portão nega por padrão | - | In Tasks |
| PERM-11 | P1: Portão nega por padrão | - | In Tasks |
| PERM-12 | P1: Portão nega por padrão | - | In Tasks |
| PERM-13 | P1: Portão nega por padrão | - | In Tasks |
| PERM-14 | P1: Portão nega por padrão | - | In Tasks |
| PERM-15 | P1: Portão nega por padrão | - | In Tasks |
| PERM-16 | P1: Portão nega por padrão | - | In Tasks |
| PERM-17 | P1: Portão nega por padrão | T1 | Done |
| PERM-18 | P1: Portão nega por padrão | T3 | Done |
| PERM-19 | P1: Papel personalizado sem escalada | T4 | Done |
| PERM-20 | P1: Papel personalizado sem escalada | T4 | Done |
| PERM-21 | P1: Papel personalizado sem escalada | T4 | Done |
| PERM-22 | P1: Papel personalizado sem escalada | T4 | Done |
| PERM-23 | P1: Papel personalizado sem escalada | T4 | Done |
| PERM-24 | P1: Papel personalizado sem escalada | T4 | Done |
| PERM-25 | P1: Papel personalizado sem escalada | T3 | Done |
| PERM-26 | P1: Papel personalizado sem escalada | - | In Tasks |
| PERM-27 | P1: Papel personalizado sem escalada | - | In Tasks |
| PERM-28 | P1: Aba Papéis e tela de sem acesso | - | In Tasks |
| PERM-29 | P1: Aba Papéis e tela de sem acesso | - | In Tasks |
| PERM-30 | P1: Aba Papéis e tela de sem acesso | - | In Tasks |
| PERM-31 | P1: Aba Papéis e tela de sem acesso | - | In Tasks |
| PERM-32 | P1: Aba Papéis e tela de sem acesso | - | In Tasks |
| PERM-33 | P1: Aba Papéis e tela de sem acesso | - | In Tasks |
| PERM-34 | P1: Aba Papéis e tela de sem acesso | - | In Tasks |
| PERM-35 | P1: Aba Papéis e tela de sem acesso | - | In Tasks |
| PERM-36 | P1: Aba Papéis e tela de sem acesso | - | In Tasks |
| PERM-37 | P1: Aba Papéis e tela de sem acesso | - | In Tasks |
| PERM-38 | P1: Aba Papéis e tela de sem acesso | - | In Tasks |

**Coverage:** 38 total, 38 mapped to tasks, 0 unmapped.

---

## Success Criteria

- [ ] Gestor recebe `403` em troca de papel, desativação, pedido de acesso e catálogo de papéis, e `200`/`201` em listar membros e convidar.
- [ ] Músico recebe `403` em edição de cifra, criação de setlist e criação de grupo.
- [ ] Líder do grupo A recebe `403` no setlist do grupo B.
- [ ] Papel personalizado com `user.manage` ou `role.manage` não grava.
- [ ] `/import`, `/groups` e `/usuarios?aba=papeis` sem a capacidade mostram "Você não tem acesso a esta área".
