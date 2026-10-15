# Administração de papéis e pedidos de acesso

## Problem Statement

Admin e gestor já convidam, trocam papéis e desativam pessoas em `/usuarios`, mas os papéis são um conjunto fixo de quatro e ninguém entra sem convite. A igreja precisa criar papéis novos, com capacidades escolhidas de um conjunto fechado, e liberar quem tentou entrar com o Google e pediu acesso.

## Goals

- [ ] Um admin cria um papel novo e esse papel passa a valer na próxima ação de quem o recebe.
- [ ] Uma pessoa recusada no login pede acesso com o e-mail verificado pelo Google, e o admin ou gestor libera esse pedido sem um segundo convite manual.
- [ ] Os quatro papéis de sistema continuam com a matriz já definida na spec `auth`.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Envio de convite ou de pedido por e-mail | Continua fora, como AUTH-55. O e-mail do pedido é o que o Google já verificou. |
| Reativar usuário desativado por um pedido | Desativado não pede acesso e a liberação não reativa. |
| Editar ou apagar papéis de sistema, ou mudar as capacidades deles | As regras especiais ficam no código. |
| Editor livre de permissões, ação por ação | O conjunto de capacidades é fechado. |
| Conceder `admin` por papel personalizado | Só o papel de sistema `admin` concede `admin`. |
| Admin da plataforma e conta em mais de uma igreja | Fora, como na spec `auth`. |
| Líder ou músico criando papéis, convites ou liberações | Continua restrito a admin e gestor, e o catálogo só ao admin. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Papéis novos | O admin cria papéis e marca capacidades do conjunto fechado. Os quatro papéis de sistema permanecem e não saem. | Decisão do discovery, aceita no plano. | sim |
| Pedido de acesso | Na recusa do login, "Solicitar acesso" grava nome e e-mail verificados pelo Google. O admin libera na aba Pedidos. A pessoa entra de novo com a mesma conta. | Decisão do discovery, aceita no plano. | sim |
| Conjunto de capacidades | `users:invite`, `users:manage`, `teams:manage`, `music:write`, `import`, `setlists:all`, `setlists:led` | Espelha o que `can` e `canPerform` já decidem, sem bit de conceder `admin`. | sim |
| Preset `admin` | As sete capacidades. Conceder `admin` continua sendo o papel de sistema, não uma capacidade. | Evita que um papel novo promova admin. | sim |
| Preset `manager` | `users:invite`, `users:manage`, `teams:manage`, `music:write`, `import`, `setlists:all` | Igual à matriz atual do gestor. | sim |
| Preset `worship_leader` | `music:write`, `import`, `setlists:led` | Igual à matriz atual do líder de louvor. | sim |
| Preset `musician` | Nenhuma capacidade extra. Leitura segue para qualquer membro ativo. | Igual à matriz atual do músico. | sim |
| Papel sem capacidade | Permitido. Age como membro só de leitura. | Um rótulo novo não precisa inventar permissão. | sim |
| Nome do papel | 2 a 40 caracteres depois de tirar espaços das pontas. Único na igreja sem diferença de maiúsculas. | Limite curto para caber na lista. | sim |
| Chave do papel | Gerada uma vez: minúsculas, sem acento, espaços viram hífen, só `a-z`, `0-9` e hífen. Renomear não muda a chave. Colisão com chave existente, inclusive de sistema, recusa. | A chave entra em convite, membro e política. O nome é só rótulo. | sim |
| Quem edita o catálogo | Só admin. Gestor vê a aba Papéis sem criar, renomear ou apagar. | Criar um papel com `users:manage` é elevação de privilégio. | sim |
| Quem libera pedido | Admin e gestor, com as mesmas regras de concessão do convite. | O gestor já convida. | sim |
| Grupos na liberação | Opcionais. Se a união de capacidades tiver `setlists:led`, a participação nasce como líder; senão, como membro. | Igual ao convite, estendido ao papel personalizado. | sim |
| Líder único | AUTH-24 conta só o papel de sistema `worship_leader`. Papel personalizado com `setlists:led` não dispara essa regra. | A regra automática é da liderança de louvor, não de qualquer papel que edita setlist do próprio grupo. | sim |
| Cookie do pedido | `videira_access_ticket`, `HttpOnly`, `SameSite=Lax`, `Path=/`, 15 minutos. `Secure` em produção. Assinado com o segredo do Better Auth. E-mail fora da URL. | A recusa do Google não cria sessão. O cookie prova que aquele e-mail acabou de ser verificado. | sim |
| Fila | Um pedido por igreja e e-mail. Novo clique com pedido pendente atualiza nome e data. Recusado volta a pendente. Aprovado não volta. A aba lista só pendentes. O registro permanece. | Evita fila duplicada e preserva auditoria. | sim |
| Membro na liberação | A liberação cria `User` ativo sem `authUserId`. O login seguinte liga a conta Google. | O membro aparece na lista antes do primeiro acesso. | sim |
| Rate limit do pedido | Sem limite extra por IP. Cookie ausente, expirado ou com assinatura inválida responde `400` e não grava. | O cookie só existe depois de uma recusa real do Google. | sim |
| Auditoria | `AuthAuditLog` em criar, liberar e recusar pedido, e em criar, alterar e apagar papel. Sem valor de cookie. | Mesmo rastro de quem deu acesso a quem. | sim |

**Open questions:** none - all resolved or logged above.

### Dimensões implícitas

| Dimension | Resolution |
| --- | --- |
| Input validation & bounds | ADM-08, ADM-23, ADM-34 |
| Failure / partial-failure | ADM-05, ADM-23, ADM-29, ADM-30, ADM-31 |
| Idempotency / retry | ADM-22, ADM-33 |
| Auth boundaries & rate limits | ADM-07, ADM-16, ADM-20, ADM-37, ADM-38; rate limit na Assumptions |
| Concurrency / ordering | ADM-33 |
| Data lifecycle / expiry | Cookie de 15 minutos (ADM-18, ADM-23). Pedido aprovado ou recusado permanece no banco; a aba só lista pendentes. |
| Observability | ADM-39 |
| External-dependency failure | N/A: não há provedor de e-mail. Falha ou cancelamento do Google segue AUTH-61 e não grava cookie nem pedido. |
| State-transition integrity | Pedido: pendente, depois aprovado ou recusado. Recusado pode voltar a pendente (ADM-25). Aprovado é terminal. Papel de sistema não muda. Papel personalizado em uso não é apagado (ADM-05). |

---

## Capacidades

Papéis se somam: o usuário pode tudo que a união das capacidades permitir. Leitura de músicas e cifras da própria igreja vale para qualquer membro ativo.

| Capacidade | Efeito |
| --- | --- |
| `users:invite` | Criar e revogar convite |
| `users:manage` | Listar membros, mudar papéis exceto `admin`, desativar, ver e resolver pedidos |
| `teams:manage` | Criar, renomear e arquivar grupos; definir membros e líderes |
| `music:write` | Criar, editar e excluir músicas e cifras; marcar "visível ao público" |
| `import` | Importar cifras quando `VIDEIRA_ENABLE_IMPORT=true` |
| `setlists:all` | Criar, editar, mudar status, excluir, seguir e clonar setlists de todos os grupos e os setlists da igreja |
| `setlists:led` | O mesmo, só nos grupos em que a pessoa é líder |

Conceder ou retirar `admin`, e a trava do último admin, continuam exigindo o papel de sistema `admin`.

---

## User Stories

### P1: Catálogo de papéis ⭐ MVP

**User Story**: Como admin, quero criar e ajustar papéis da igreja, para acompanhar funções que os quatro papéis atuais não cobrem.

**Why P1**: Sem o catálogo, a tela de permissões continua presa ao conjunto fixo.

**Acceptance Criteria**:

1. The system SHALL manter os papéis de sistema `admin`, `manager`, `worship_leader` e `musician` com os presets da seção Assumptions. (ADM-01)
2. WHEN um admin criar um papel com nome de 2 a 40 caracteres e um subconjunto das capacidades fechadas THEN the system SHALL gravar o papel na igreja, com a chave gerada do nome, e exibi-lo na aba Papéis. (ADM-02)
3. WHEN um admin renomear um papel personalizado THEN the system SHALL gravar o novo nome e manter a mesma chave. (ADM-03)
4. WHEN um admin alterar as capacidades de um papel personalizado THEN the system SHALL gravar a mudança, que SHALL valer na próxima requisição de quem tem esse papel. (ADM-04)
5. IF um admin tentar apagar um papel personalizado atribuído a um membro ou citado num convite pendente THEN the system SHALL responder `409 ROLE_IN_USE` e manter o papel. (ADM-05)
6. WHEN um admin apagar um papel personalizado sem esses usos THEN the system SHALL removê-lo do catálogo. (ADM-06)
7. IF um gestor tentar criar, renomear, alterar capacidades ou apagar um papel THEN the system SHALL responder `403 FORBIDDEN` sem gravar. (ADM-07)
8. IF o nome tiver menos de 2 ou mais de 40 caracteres, ou uma capacidade estiver fora do conjunto fechado THEN the system SHALL responder `400 INVALID_ROLE` sem gravar. (ADM-08)
9. IF já existir papel com o mesmo nome, sem diferença de maiúsculas, ou com a mesma chave THEN the system SHALL responder `409 ROLE_EXISTS` sem gravar. (ADM-09)
10. IF alguém tentar apagar um papel de sistema, renomeá-lo ou alterar as capacidades dele THEN the system SHALL responder `409 SYSTEM_ROLE` sem gravar. (ADM-40)

**Independent Test**: O admin cria "Intercessão" só com leitura. O papel aparece na aba. O gestor recebe `403` ao tentar criar outro. Apagar "Intercessão" depois de atribuí-lo a um membro responde `409 ROLE_IN_USE`.

---

### P1: Política pelas capacidades ⭐ MVP

**User Story**: Como dono do app, quero que cada ação olhe as capacidades dos papéis da pessoa, para um papel novo funcionar sem regra espalhada na tela.

**Why P1**: Um papel sem efeito na política é só um rótulo.

**Acceptance Criteria**:

1. The system SHALL decidir `can` e `canPerform` pela união das capacidades dos papéis do `Actor`, resolvidas na carga do `Actor`. (ADM-10)
2. The system SHALL permitir leitura de músicas e cifras da própria igreja a qualquer membro ativo, sem capacidade extra. (ADM-11)
3. The system SHALL aplicar aos papéis de sistema os presets da seção Assumptions, equivalentes à matriz da spec `auth`. (ADM-12)
4. WHILE a igreja tiver exatamente um usuário ativo com o papel de sistema `worship_leader` the system SHALL mantê-lo como líder de todos os grupos não arquivados, e SHALL não fazer o mesmo por um papel personalizado que só tenha `setlists:led`. (ADM-13)
5. WHEN alguém atribuir como líder de grupo um usuário cuja união de capacidades inclua `setlists:led` THEN the system SHALL aceitar a atribuição. (ADM-14)
6. IF alguém atribuir como líder de grupo um usuário sem `setlists:led` THEN the system SHALL responder `400 NOT_A_WORSHIP_LEADER`. (ADM-15)
7. IF a mudança conceder ou retirar `admin` e quem age não tiver o papel de sistema `admin` THEN the system SHALL responder `403 FORBIDDEN` sem gravar. (ADM-16)
8. The system SHALL não oferecer capacidade de conceder `admin` num papel personalizado. (ADM-17)
9. WHEN um admin ou gestor gravar convite ou papéis de membro com chaves do catálogo que pode conceder THEN the system SHALL gravar essas chaves. (ADM-41)
10. IF uma chave não existir no catálogo THEN the system SHALL responder `400 INVALID_ROLE` sem gravar o convite nem a troca de papéis. (ADM-42)

**Independent Test**: Um papel personalizado só com `import` importa e não edita setlist. Um papel só com `setlists:led` edita o setlist do grupo em que é líder e recebe `403` no setlist de outro grupo. Gestor e líder de sistema continuam iguais à matriz da spec `auth`.

---

### P1: Pedir acesso na recusa do login ⭐ MVP

**User Story**: Como pessoa sem conta, quero pedir acesso com o Google que acabei de usar, para o administrador ver meu e-mail verdadeiro.

**Why P1**: É a porta nova de entrada além do convite.

**Acceptance Criteria**:

1. WHEN o Google recusar o login de um e-mail verificado que não pertence a membro ativo nem a conta desativada e não for erro de convite THEN the system SHALL gravar o cookie `videira_access_ticket` com nome, e-mail e expiração assinados, `HttpOnly`, `SameSite=Lax`, `Path=/`, válido por 15 minutos, sem colocar o e-mail na URL. (ADM-18)
2. WHERE `NODE_ENV=production` the system SHALL marcar esse cookie como `Secure`. (ADM-43)
3. WHEN `/entrar` receber esse cookie válido THEN the system SHALL mostrar o botão "Solicitar acesso". (ADM-19)
4. IF o e-mail do Google não for verificado, a conta estiver desativada ou o convite for de outro e-mail THEN the system SHALL recusar o login sem gravar o cookie. (ADM-20)
5. WHEN a pessoa acionar "Solicitar acesso" com cookie válido THEN the system SHALL gravar um único pedido pendente por igreja e e-mail, com o nome vindo do Google. (ADM-21)
6. WHEN já existir pedido pendente para o mesmo e-mail THEN the system SHALL atualizar o nome e a data desse pedido, sem criar outro. (ADM-22)
7. IF o cookie estiver ausente, expirado ou com assinatura inválida THEN the system SHALL responder `400 ACCESS_TICKET_INVALID` sem gravar pedido. (ADM-23)
8. WHEN o pedido for gravado THEN the system SHALL apagar o cookie e mostrar "Pedido enviado. Aguarde o administrador liberar o acesso." (ADM-24)
9. WHEN um pedido recusado receber um novo "Solicitar acesso" com cookie válido do mesmo e-mail THEN the system SHALL voltar esse pedido para pendente. (ADM-25)
10. WHEN o login for aceito THEN the system SHALL apagar `videira_access_ticket` se ele existir. (ADM-44)

**Independent Test**: Entrar com um Google sem convite mostra "Solicitar acesso". Clicar grava um pedido com aquele e-mail. Clicar de novo não duplica. E-mail não verificado não mostra o botão.

---

### P1: Liberar ou recusar o pedido ⭐ MVP

**User Story**: Como admin ou gestor, quero liberar o pedido escolhendo papéis, para a pessoa entrar com a mesma conta Google.

**Why P1**: O pedido sem liberação não dá acesso.

**Acceptance Criteria**:

1. WHEN um admin ou gestor abrir a aba Pedidos THEN the system SHALL listar só os pendentes, com nome, e-mail e data do pedido. (ADM-26)
2. WHEN um admin ou gestor liberar um pedido pendente com um ou mais papéis do catálogo que pode conceder e zero ou mais grupos não arquivados da igreja THEN the system SHALL criar o membro ativo sem `authUserId`, com esses papéis e grupos, e tirar o pedido da lista de pendentes. (ADM-27)
3. WHEN a liberação incluir um grupo e a união de capacidades incluir `setlists:led` THEN the system SHALL criar a participação nesse grupo como líder. (ADM-45)
4. WHEN a liberação incluir um grupo e a união de capacidades não incluir `setlists:led` THEN the system SHALL criar a participação como membro. (ADM-46)
5. WHEN essa pessoa concluir o login do Google com e-mail verificado igual ao do pedido THEN the system SHALL ligar a conta Google ao membro já criado e criar a sessão. (ADM-28)
6. IF um gestor tentar liberar com o papel `admin` THEN the system SHALL responder `403 FORBIDDEN` sem criar membro e sem mudar o pedido. (ADM-29)
7. IF já existir membro ativo com o e-mail THEN the system SHALL responder `409 USER_EXISTS` e manter o pedido pendente. (ADM-30)
8. IF existir membro desativado com o e-mail THEN the system SHALL responder `409 USER_DEACTIVATED` sem reativar o membro e sem mudar o pedido. (ADM-31)
9. WHEN um admin ou gestor recusar um pedido pendente THEN the system SHALL marcá-lo como recusado e tirá-lo da lista de pendentes. (ADM-32)
10. IF duas liberações do mesmo pedido chegarem juntas THEN the system SHALL criar um único membro e a segunda SHALL responder `409 REQUEST_RESOLVED`. (ADM-33)
11. IF a lista de papéis estiver vazia ou contiver chave fora do catálogo THEN the system SHALL responder `400 INVALID_ROLE` sem criar o membro e sem mudar o pedido. (ADM-34)

**Independent Test**: Liberar um pedido com o papel músico cria o membro. O login Google desse e-mail entra. Recusar some da fila. Liberar com `admin` sendo gestor responde `403` e o pedido continua pendente.

---

### P1: Abas de usuários ⭐ MVP

**User Story**: Como admin ou gestor, quero achar membros, convites, pedidos e papéis no mesmo lugar, para não procurar em telas separadas.

**Why P1**: A fila e o catálogo precisam de uma porta visível.

**Acceptance Criteria**:

1. WHEN um admin ou gestor abrir `/usuarios` THEN the system SHALL mostrar as abas Membros, Convites, Pedidos e Papéis. (ADM-35)
2. The system SHALL manter nas abas Membros e Convites o comportamento de AUTH-09 a AUTH-19 e AUTH-44 a AUTH-48. (ADM-36)
3. IF um usuário sem `users:manage` abrir `/usuarios` THEN the system SHALL mostrar "Acesso restrito". (ADM-37)
4. WHERE quem abre a aba Papéis não tem o papel de sistema `admin` the system SHALL mostrar o catálogo sem ações de criar, renomear ou apagar. (ADM-38)

**Independent Test**: Admin vê as quatro abas e o formulário de papel. Gestor vê as quatro, e na aba Papéis não há botão de criar. Músico vê "Acesso restrito".

---

### P2: Auditoria de papéis e pedidos

**User Story**: Como admin, quero o rastro de quem criou um papel e de quem liberou um pedido, para investigar um acesso indevido.

**Why P2**: O acesso funciona sem a tela de consulta. O registro não pode esperar uma tela nova.

**Acceptance Criteria**:

1. WHEN um pedido for criado, liberado ou recusado, ou um papel personalizado for criado, alterado ou apagado THEN the system SHALL gravar um registro em `AuthAuditLog` sem o valor do cookie de pedido. (ADM-39)

**Independent Test**: Criar um papel e liberar um pedido gera registros. Nenhum contém o cookie.

---

## Edge Cases

- IF o grupo informado na liberação estiver arquivado ou for de outra igreja THEN the system SHALL responder `400 INVALID_TEAM` sem criar o membro e sem mudar o pedido. (ADM-47)
- IF o pedido já estiver aprovado e chegar outra liberação THEN the system SHALL responder `409 REQUEST_RESOLVED` sem criar outro membro. (ADM-48)
- WHEN a liberação criar o único usuário ativo com o papel de sistema `worship_leader` THEN the system SHALL aplicar AUTH-24 a esse usuário. (ADM-49)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| ADM-01 | P1: Catálogo de papéis | Tasks | In Tasks |
| ADM-02 | P1: Catálogo de papéis | Tasks | In Tasks |
| ADM-03 | P1: Catálogo de papéis | Tasks | In Tasks |
| ADM-04 | P1: Catálogo de papéis | Tasks | In Tasks |
| ADM-05 | P1: Catálogo de papéis | Tasks | In Tasks |
| ADM-06 | P1: Catálogo de papéis | Tasks | In Tasks |
| ADM-07 | P1: Catálogo de papéis | Tasks | In Tasks |
| ADM-08 | P1: Catálogo de papéis | Tasks | In Tasks |
| ADM-09 | P1: Catálogo de papéis | Tasks | In Tasks |
| ADM-40 | P1: Catálogo de papéis | Tasks | In Tasks |
| ADM-10 | P1: Política pelas capacidades | Tasks | In Tasks |
| ADM-11 | P1: Política pelas capacidades | Tasks | In Tasks |
| ADM-12 | P1: Política pelas capacidades | Tasks | In Tasks |
| ADM-13 | P1: Política pelas capacidades | Tasks | In Tasks |
| ADM-14 | P1: Política pelas capacidades | Tasks | In Tasks |
| ADM-15 | P1: Política pelas capacidades | Tasks | In Tasks |
| ADM-16 | P1: Política pelas capacidades | Tasks | In Tasks |
| ADM-17 | P1: Política pelas capacidades | Tasks | In Tasks |
| ADM-18 | P1: Pedir acesso na recusa do login | Tasks | In Tasks |
| ADM-19 | P1: Pedir acesso na recusa do login | Tasks | In Tasks |
| ADM-20 | P1: Pedir acesso na recusa do login | Tasks | In Tasks |
| ADM-21 | P1: Pedir acesso na recusa do login | Tasks | In Tasks |
| ADM-22 | P1: Pedir acesso na recusa do login | Tasks | In Tasks |
| ADM-23 | P1: Pedir acesso na recusa do login | Tasks | In Tasks |
| ADM-24 | P1: Pedir acesso na recusa do login | Tasks | In Tasks |
| ADM-25 | P1: Pedir acesso na recusa do login | Tasks | In Tasks |
| ADM-26 | P1: Liberar ou recusar o pedido | Tasks | In Tasks |
| ADM-27 | P1: Liberar ou recusar o pedido | Tasks | In Tasks |
| ADM-28 | P1: Liberar ou recusar o pedido | Tasks | In Tasks |
| ADM-29 | P1: Liberar ou recusar o pedido | Tasks | In Tasks |
| ADM-30 | P1: Liberar ou recusar o pedido | Tasks | In Tasks |
| ADM-31 | P1: Liberar ou recusar o pedido | Tasks | In Tasks |
| ADM-32 | P1: Liberar ou recusar o pedido | Tasks | In Tasks |
| ADM-33 | P1: Liberar ou recusar o pedido | Tasks | In Tasks |
| ADM-34 | P1: Liberar ou recusar o pedido | Tasks | In Tasks |
| ADM-35 | P1: Abas de usuários | Tasks | In Tasks |
| ADM-36 | P1: Abas de usuários | Tasks | In Tasks |
| ADM-37 | P1: Abas de usuários | Tasks | In Tasks |
| ADM-38 | P1: Abas de usuários | Tasks | In Tasks |
| ADM-39 | P2: Auditoria de papéis e pedidos | Tasks | In Tasks |
| ADM-41 | P1: Política pelas capacidades | Tasks | In Tasks |
| ADM-42 | P1: Política pelas capacidades | Tasks | In Tasks |
| ADM-43 | P1: Pedir acesso na recusa do login | Tasks | In Tasks |
| ADM-44 | P1: Pedir acesso na recusa do login | Tasks | In Tasks |
| ADM-45 | P1: Liberar ou recusar o pedido | Tasks | In Tasks |
| ADM-46 | P1: Liberar ou recusar o pedido | Tasks | In Tasks |
| ADM-47 | Edge Cases | Tasks | In Tasks |
| ADM-48 | Edge Cases | Tasks | In Tasks |
| ADM-49 | Edge Cases | Tasks | In Tasks |

**Coverage:** 49 total, 0 mapped to tasks, 49 unmapped.

---

## Success Criteria

- [ ] O admin cria um papel, atribui a um membro, e a próxima ação desse membro respeita só as capacidades marcadas.
- [ ] Da recusa do Google até a liberação e o segundo login, a pessoa entra sem convite manual.
- [ ] Gestor, líder de louvor e músico de sistema continuam com os mesmos acessos da matriz da spec `auth`.
