# Setlists (fase 1)

## Problem Statement

As igrejas organizam o repertório de cultos e ensaios por grupo de louvor, mas o Videira Music só tem um placeholder em `/setlists` e nenhuma tabela de setlist. Cada grupo precisa montar seus repertórios, reaproveitar os de outros grupos ou da igreja, seguindo ou clonando, e ler as cifras em sequência no tom combinado. A fase 1 entrega isso dentro de uma igreja, sobre os usuários, grupos e o `Actor` simulado que já existem, deixando o schema e a política de acesso prontos para a autenticação real e para o compartilhamento entre igrejas.

## Goals

- [ ] Um líder monta um setlist do grupo com músicas (cifra e tom fixados) e anotações, publica e abre a leitura sequencial, sem sair de `/setlists`.
- [ ] Um grupo usa um setlist de outro grupo ou da igreja de duas formas: seguindo (só leitura, sempre atualizado) ou clonando (cópia editável sem vínculo).
- [ ] Toda decisão de acesso passa por uma única função `canPerform(actor, action, target)`, coberta por testes de toda a matriz de permissões.
- [ ] O admin da igreja cria, renomeia e arquiva grupos de louvor em `/groups`.
- [ ] O schema guarda dono, visibilidade e origem das cifras, para que a fase 2 (autenticação real, setlist pessoal e públicos entre igrejas) não precise migrar dados existentes.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Login real, contas e sessões | Fase 2; a identidade vem de `getCurrentActor()` com usuário simulado (`VIDEIRA_SIMULATED_USER_ID`). |
| Gestão de membros dos grupos na UI | Membros vêm do seed simulado; a tela entra com a autenticação real. |
| Setlist pessoal (dono usuário) e limites por usuário | Depende de usuários reais; o campo `ownerUserId` fica reservado e sempre nulo. |
| Sugestão de músicas com aprovação | Decidido para a fase 2, junto com os papéis reais. |
| Aba `/setlists/public`, e seguir ou clonar entre igrejas pela UI ou API | Existe uma única igreja; a fase 1 só grava a visibilidade `public` e implementa a cópia de catálogo entre igrejas no serviço, coberta por testes. |
| Membros e papéis por setlist (`/setlists/[id]/access`) e políticas do admin (`/setlists/settings`) | Fase 2. |
| Escala de músicos por evento | Ideia futura; o setlist é um repertório, não uma escala. |
| Exclusão de músicas ou cifras do catálogo | Não existe rota de exclusão hoje; a regra de bloqueio por uso fica para quando existir. |
| Modo offline do setlist | Depende de uma decisão de sincronização que ainda não existe (AD-004 tirou o offline). |
| Sessão de admin do import (AD-005) | Continua válida só para o import; setlists não a usam. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Quem escreve | As escritas checam o papel do `Actor` (admin da igreja ou líder do grupo dono); a sessão de admin do import não é usada | Antecipa a fase 2 sem mudar as rotas; o usuário simulado já fornece o papel. | sim |
| Leitura por anônimo | Anônimo lê só setlists `published` com visibilidade `organization` ou `public` da igreja padrão | Mantém a leitura livre decidida no discovery sem expor setlists de grupo. | não, default técnico |
| Visibilidade `team` | Leem os membros do grupo dono, o admin da igreja e os grupos que seguem o setlist | Agora que o `Actor` traz os grupos, a visibilidade de grupo passa a ser aplicada de verdade. | não, default técnico |
| Visibilidade `public` na fase 1 | Para leitura, se comporta como `organization` | Só existe uma igreja; o valor é gravado para a fase 2. | sim |
| Visibilidade `private` | Só quem pode editar lê | Rascunhos de trabalho e setlists internos. | não, default técnico |
| Setlist da igreja com visibilidade `team` | Rejeitado com `400 INVALID_VISIBILITY` | Não há grupo dono para limitar a leitura. | não, default técnico |
| Transições de status | `draft → published`, `published → archived`, `archived → published`; nenhuma volta para `draft` | Voltar a rascunho esconderia o setlist de quem segue sem passar pelo aviso de seguidores. | não, default técnico |
| Exclusão de setlist | Exclusão lógica (`deletedAt`); some de todas as listas e leituras | Quem segue precisa ver a entrada como "indisponível". | não, default técnico |
| Aviso de seguidores | Apagar, ou mudar a visibilidade de modo que um grupo seguidor perca a leitura, exige `confirmFollowersImpact: true`; sem ele, `409 SETLIST_HAS_FOLLOWERS` com `followerCount` | Garante que o dono veja o impacto antes de agir. | sim (decisão de aviso), formato default técnico |
| Resultado do clone | Novo setlist `draft`, mesmo título, `eventType` e `notes` copiados, `eventAt` vazio, visibilidade `team` (dono grupo) ou `organization` (dono igreja), itens copiados na mesma ordem | O clone é um ponto de partida editável para uma nova data. | não, default técnico |
| Clone sem vínculo | O clone não guarda nenhuma referência ao setlist de origem | Decidido pelo usuário. | sim |
| Cópia de catálogo entre igrejas | Cifra com `originUrl` já existente na igreja de destino é reaproveitada, junto com a música dela; as demais músicas e cifras são copiadas com novos ids e `sourceOrganizationId` | Cumpre o "clonar sem referenciar" e respeita `@@unique([organizationId, originUrl])`. | sim |
| Grupo atual | `?team=<slug>`; as opções são os grupos não arquivados do `Actor` (todos, se for admin), em ordem alfabética; sem `team` ou com `team` inválido, vale o primeiro da lista | URL compartilhável e testável; o comportamento na fase 2 é o mesmo. | sim (seletor na URL), fallback default técnico |
| Limites de entrada | Título com 1 a 120 caracteres após trim; `notes` do setlist até 2000; texto da anotação de 1 a 500; `notes` do item até 500; até 100 itens; nome do grupo de 1 a 60 | Limites concretos para validar e testar. | não, default técnico |
| `eventType` | `service`, `rehearsal` ou `event`, opcional | Culto, ensaio ou evento, como no discovery. | não, default técnico |
| Tom do item | `selectedKey` começa igual a `chart.key`; um valor informado precisa passar em `isTransposableKey` (nova, em `lib/chords`, sobre `parseKeyRoot`) | `semitonesBetweenKeys` devolve `0` para tom inválido em vez de falhar, então não serve para validar. | não, default técnico |
| Concorrência | Toda escrita no setlist envia `expectedVersion`; divergência gera `409 SETLIST_VERSION_CONFLICT`; cada escrita bem-sucedida incrementa `version` em 1 | Duas edições simultâneas não se sobrescrevem em silêncio. | não, default técnico |
| Arquivar grupo | O grupo some do seletor e de "outros grupos" para criação; os setlists dele continuam legíveis; não se criam setlists novos para ele | Grupo não é apagado, só arquivado, como decidido. | não, default técnico |
| Slug do grupo | Gerado do nome na criação (minúsculas, sem acento, hífens); não muda ao renomear; em colisão, recebe o sufixo `-2`, `-3`, ... | Links `?team=` continuam válidos depois de renomear. | não, default técnico |
| Formato de erro | `{ "error": { "code", "message" } }`, como em `lib/persistence/persistence-api.ts` | Consistência com as rotas existentes. | não, default técnico |

**Open questions:** none - all resolved or logged above. Spec aprovada pelo usuário em 2026-10-14, com os defaults técnicos como estão.

---

## User Stories

### P1: Montar e publicar o setlist do grupo ⭐ MVP

**User Story**: Como líder do grupo de louvor, quero criar um setlist com músicas e anotações, fixando cifra e tom, e publicá-lo, para que a banda saiba exatamente o que vai tocar.

**Why P1**: É o núcleo do recurso; sem ele nada mais existe.

**Acceptance Criteria**:
1. WHEN um líder do grupo ou admin enviar `POST /api/setlists` com `title` válido e `ownerTeamId` de um grupo não arquivado da igreja THEN o sistema SHALL criar o setlist com `status: "draft"`, `version: 1` e `visibility: "team"`, salvo se outra visibilidade for informada, e responder `201` com o setlist. (SET-01)
2. WHEN um admin enviar `POST /api/setlists` com `owner: "organization"` THEN o sistema SHALL criar um setlist da igreja com `ownerTeamId` nulo e `visibility: "organization"`, salvo se outra visibilidade for informada. (SET-01)
3. IF quem criar não for admin nem líder do grupo dono THEN o sistema SHALL responder `403 FORBIDDEN` sem gravar nada. (SET-02)
4. IF `title` tiver menos de 1 ou mais de 120 caracteres após trim, `notes` passar de 2000, ou `eventType` não for `service`, `rehearsal` ou `event` THEN o sistema SHALL responder `400 INVALID_REQUEST`. (SET-03)
5. IF um setlist da igreja for criado ou alterado com `visibility: "team"` THEN o sistema SHALL responder `400 INVALID_VISIBILITY`. (SET-03)
6. WHEN quem pode editar enviar `PUT /api/setlists/{id}/items` com a lista completa de itens e `expectedVersion` igual à versão atual THEN o sistema SHALL substituir os itens na ordem recebida, com posições de 0 a n-1, e incrementar `version` em 1. (SET-04)
7. WHEN um item `kind: "song"` vier sem `selectedKey` THEN o sistema SHALL gravar `selectedKey` igual a `key` da cifra informada. (SET-05)
8. IF um item `kind: "song"` vier sem `chartId`, com cifra de outra música, ou com cifra ou música de outra igreja THEN o sistema SHALL responder `400 INVALID_ITEM` sem alterar os itens. (SET-05)
9. IF `selectedKey` não for reconhecido por `isTransposableKey` (tônica de `C` a `B`, com `#` ou `b` opcional, que exista na escala cromática usada pela transposição) THEN o sistema SHALL responder `400 INVALID_KEY`. (SET-05)
10. WHEN um item `kind: "note"` vier com `text` de 1 a 500 caracteres THEN o sistema SHALL gravá-lo sem música nem cifra. (SET-06)
11. IF a lista tiver mais de 100 itens, ou uma anotação sem texto válido THEN o sistema SHALL responder `400 INVALID_ITEM`. (SET-06)
12. IF `expectedVersion` divergir da versão atual em qualquer escrita no setlist THEN o sistema SHALL responder `409 SETLIST_VERSION_CONFLICT` com a `version` atual, sem alterar nada. (SET-07)
13. WHEN quem pode editar mudar o status de `draft` para `published`, de `published` para `archived` ou de `archived` para `published` THEN o sistema SHALL gravar o novo status. (SET-08)
14. IF a transição de status for qualquer outra THEN o sistema SHALL responder `400 INVALID_STATUS_TRANSITION`. (SET-08)
15. WHEN, no editor `/setlists/{id}/edit`, o usuário adicionar uma música com uma única cifra THEN o sistema SHALL selecionar essa cifra automaticamente e preencher o tom com o tom dela. (SET-09)
16. WHEN, no editor, a música tiver mais de uma cifra THEN o sistema SHALL exigir a escolha da cifra antes de adicionar o item. (SET-09)

**Independent Test**: Com `VIDEIRA_SIMULATED_USER_ID=user-leader`, criar um setlist do grupo Louvor, adicionar duas músicas e uma anotação, mudar um tom, reordenar e publicar; recarregar e ver a mesma ordem, os mesmos tons e o status publicado.

---

### P1: Ler o setlist em sequência ⭐ MVP

**User Story**: Como músico, quero abrir o setlist e passar pelas cifras na ordem, já no tom combinado, para tocar sem procurar música por música.

**Why P1**: É o uso no culto e no ensaio; o resto existe para chegar aqui.

**Acceptance Criteria**:
1. WHEN alguém com permissão de leitura abrir `/setlists/{id}` THEN o sistema SHALL mostrar título, data e tipo quando houver, e os itens em ordem: músicas com título, cifra e tom, e anotações com o texto. (SET-10)
2. WHEN um item de música usar uma cifra com `origin` THEN o sistema SHALL mostrar o selo "Importada" e um link "Fonte" para `originUrl`, com `target="_blank"` e `rel="noopener noreferrer"`. (SET-11)
3. WHEN alguém abrir `/setlists/{id}/play` THEN o sistema SHALL listar os itens em ordem, e cada item de música SHALL apontar para `buildSetlistSongHref(songId, { setlistId, setlistItemId, selectedKey })`. (SET-12)
4. WHILE estiver no detalhe de uma música aberta pelo setlist, o sistema SHALL oferecer links "Anterior" e "Próxima" para os itens de música vizinhos, pulando as anotações e omitindo o link na primeira e na última música. (SET-12)
5. IF o setlist não existir, estiver excluído ou não for legível pelo `Actor` THEN o sistema SHALL responder `404` na página e `404 SETLIST_NOT_FOUND` na API, sem distinguir os três casos. (SET-13)

**Independent Test**: Abrir `/setlists/{id}/play` de um setlist publicado com três músicas, uma delas importada; ver o selo na importada, abrir a primeira, avançar até a última e ver o tom de cada item aplicado.

---

### P1: Navegar pelos setlists por grupo ⭐ MVP

**User Story**: Como membro de um ou mais grupos, quero escolher o grupo e ver os setlists dele, dos outros grupos, da igreja e os que ele segue, para achar rápido o repertório do domingo.

**Why P1**: Sem navegação, só se chega a um setlist pelo link direto.

**Acceptance Criteria**:
1. WHEN um usuário abrir `/setlists` THEN o sistema SHALL mostrar um seletor com os grupos não arquivados de que ele é membro, ou todos os grupos não arquivados se for admin, em ordem alfabética de nome. (SET-14)
2. WHEN `?team=<slug>` apontar para um grupo do seletor THEN o sistema SHALL usá-lo como grupo atual; caso contrário, SHALL usar o primeiro grupo do seletor. (SET-14)
3. WHEN o grupo atual estiver definido THEN o sistema SHALL mostrar as abas "<nome do grupo atual>" (dono = grupo atual), "Outros grupos" (dono = outro grupo, legíveis), "Da igreja" (dono = igreja, legíveis) e "Seguindo" (seguidos pelo grupo atual). (SET-15)
4. The system SHALL exclude `draft` setlists from every tab for actors who cannot edit them, and SHALL exclude `archived` and deleted setlists from the team, "Outros grupos" and "Da igreja" tabs. (SET-15)
5. WHEN o `Actor` for anônimo, ou usuário sem grupos THEN o sistema SHALL mostrar só a aba "Igreja", sem seletor. (SET-14)
6. WHERE o `Actor` puder criar setlists para o grupo atual ou para a igreja, o sistema SHALL mostrar o botão "Novo setlist" levando a `/setlists/new`. (SET-16)
7. The system SHALL return the same lists through `GET /api/setlists?team=<slug>&tab=team|others|organization|following` as the page renders. (SET-15)

**Independent Test**: Com `user-musician` (Louvor e Jovens), alternar o seletor entre os dois grupos e ver as abas mudarem; com `user-admin`, ver todos os grupos; sem usuário simulado, ver só a aba "Igreja".

---

### P1: Seguir e clonar setlists ⭐ MVP

**User Story**: Como líder, quero seguir um setlist de outro grupo ou da igreja para acompanhá-lo, ou cloná-lo para adaptar, para não remontar o repertório do zero.

**Why P1**: É a regra central do discovery para reaproveitar repertório entre grupos.

**Acceptance Criteria**:
1. WHEN um líder ou admin enviar `POST /api/setlists/{id}/follow` com `teamId` de um grupo em que pode agir THEN o sistema SHALL registrar o vínculo e responder `204`; repetir a chamada SHALL responder `204` sem duplicar. (SET-17)
2. IF o setlist estiver em `draft`, não for legível pelo grupo de destino, ou pertencer ao próprio grupo de destino THEN o sistema SHALL responder `409 CANNOT_FOLLOW` sem registrar nada. (SET-17)
3. WHEN `DELETE /api/setlists/{id}/follow` for chamado com `teamId` THEN o sistema SHALL remover o vínculo e responder `204`, existindo ou não. (SET-17)
4. WHILE um grupo seguir um setlist, o sistema SHALL mostrar a versão atual dele só para leitura, sem ações de editar, reordenar ou mudar status para quem não for editor do original. (SET-18)
5. IF o setlist seguido for excluído, ou deixar de ser legível pelo grupo seguidor THEN a aba "Seguidos" SHALL mostrar a entrada como "Setlist indisponível", sem título nem itens, com a ação "Deixar de seguir". (SET-19)
6. WHILE o setlist seguido estiver `archived`, o sistema SHALL continuar mostrando-o para o grupo seguidor na aba "Seguidos". (SET-19)
7. IF o dono pedir para apagar, ou para mudar a visibilidade de modo que um grupo seguidor perca a leitura, sem `confirmFollowersImpact: true`, e houver seguidores afetados THEN o sistema SHALL responder `409 SETLIST_HAS_FOLLOWERS` com `followerCount`, sem alterar nada. (SET-20)
8. WHEN a interface receber `409 SETLIST_HAS_FOLLOWERS` THEN o sistema SHALL mostrar "N grupos seguem este setlist" e só repetir a ação com `confirmFollowersImpact: true` depois da confirmação. (SET-20)
9. WHEN um líder ou admin enviar `POST /api/setlists/{id}/clone` com `targetTeamId` de um grupo em que pode agir, ou `target: "organization"` sendo admin THEN o sistema SHALL criar o clone conforme a tabela de Assumptions e responder `201` com o novo setlist. (SET-21)
10. The system SHALL store no reference from a clone to its source setlist. (SET-21)
11. IF o setlist de origem estiver em `draft` ou não for legível pelo `Actor` THEN o clone SHALL ser recusado com `409 CANNOT_CLONE`. (SET-21)
12. WHEN o serviço de clone receber uma origem de outra igreja THEN o sistema SHALL copiar para a igreja de destino as músicas e cifras dos itens, com novos ids e `sourceOrganizationId` igual à igreja de origem, numa única transação. (SET-22)
13. WHEN uma cifra da origem tiver `originUrl` que já exista na igreja de destino THEN o serviço de clone SHALL apontar o item para a cifra e a música existentes, sem criar cópias. (SET-22)
14. IF qualquer cópia falhar durante o clone entre igrejas THEN o sistema SHALL desfazer tudo, sem setlist, música ou cifra parcial na igreja de destino. (SET-22)

**Independent Test**: Com `user-leader`, seguir um setlist do grupo Jovens e ver a atualização aparecer quando o admin o edita; clonar o mesmo setlist, editar o clone e ver que o original não mudou; o admin apaga o original e a aba "Seguidos" mostra "Setlist indisponível".

---

### P1: Gerenciar grupos de louvor ⭐ MVP

**User Story**: Como admin da igreja, quero criar, renomear e arquivar grupos de louvor, para que cada banda tenha seus setlists.

**Why P1**: Sem grupo não há dono para setlists de grupo.

**Acceptance Criteria**:
1. WHEN um admin abrir `/groups` THEN o sistema SHALL listar os grupos da igreja, com os arquivados separados, e oferecer criar, renomear e arquivar. (GRP-01)
2. IF quem abrir `/groups` não for admin THEN o sistema SHALL mostrar "Acesso restrito ao administrador da igreja" sem a lista, e as rotas `/api/teams` de escrita SHALL responder `403 FORBIDDEN`. (GRP-02)
3. WHEN um admin enviar `POST /api/teams` com `name` de 1 a 60 caracteres após trim THEN o sistema SHALL criar o grupo com slug gerado do nome, resolvendo colisão com o sufixo `-2`, `-3` e assim por diante, e responder `201`. (GRP-03)
4. WHEN um admin renomear um grupo THEN o sistema SHALL trocar o nome e manter o slug. (GRP-03)
5. WHEN um admin arquivar um grupo THEN o sistema SHALL gravar `archivedAt`, tirá-lo do seletor de `/setlists` e recusar novos setlists para ele com `409 TEAM_ARCHIVED`, mantendo os setlists existentes legíveis. (GRP-04)
6. The system SHALL provide no deletion of worship teams. (GRP-04)
7. WHERE o `Actor` for admin, o header SHALL mostrar o link "Grupos" para `/groups`; para os demais, SHALL omiti-lo. (GRP-01)

**Independent Test**: Com `user-admin`, criar "Coral", renomear para "Coral Infantil" e conferir que o slug continua `coral`; arquivar e ver que ele some do seletor; com `user-musician`, abrir `/groups` e ver a mensagem de acesso restrito.

---

### P1: Política única de acesso ⭐ MVP

**User Story**: Como mantenedor, quero que toda regra de acesso esteja numa única função, para trocar a autenticação simulada pela real sem tocar nas rotas.

**Why P1**: Foi o requisito explícito do discovery: migrar em breve para autenticação e autorização.

**Acceptance Criteria**:
1. The system SHALL decide every setlist and team access through `canPerform(actor, action, target)`, with `action` in `read`, `create`, `edit`, `changeStatus`, `delete`, `follow`, `clone` and `manageTeams`. (SET-23)
2. The system SHALL obtain the actor of each request only through `getCurrentActor()` from `lib/auth/current-actor.ts`. (SET-23)
3. The system SHALL grant `edit`, `changeStatus` and `delete` on a team setlist only to the organization admin and to leaders of the owning team, and on an organization setlist only to the organization admin. (SET-24)
4. The system SHALL grant `create`, `follow` and `clone` into a team only to the organization admin and to leaders of that team, and `create` and `clone` into the organization only to the admin. (SET-24)
5. The system SHALL grant `manageTeams` only to the organization admin. (SET-24)
6. IF o `Actor` for anônimo THEN `canPerform` SHALL negar toda ação além de `read`. (SET-24)
7. IF o alvo pertencer a outra igreja que não a do `Actor` THEN `canPerform` SHALL negar toda ação além de `read` de setlists `public` `published`. (SET-24)

**Independent Test**: Uma tabela de testes percorre cada ação para admin, líder do dono, líder de outro grupo, membro, anônimo e usuário de outra igreja, comparando com a matriz acima.

---

## Edge Cases

- IF dois `PUT /api/setlists/{id}/items` chegarem um depois do outro com o mesmo `expectedVersion` THEN o primeiro SHALL ser gravado e o segundo SHALL receber `409 SETLIST_VERSION_CONFLICT`, preservando os itens do primeiro. (SET-07)
- WHEN um setlist tiver zero itens THEN `/setlists/{id}` SHALL mostrar "Nenhuma música neste setlist", e `/play` SHALL mostrar o mesmo texto sem links. (SET-10)
- WHEN o mesmo `songId` aparecer em dois itens THEN o sistema SHALL aceitar e manter os dois, cada um com seu tom. (SET-05)
- IF o corpo de qualquer rota de escrita não for JSON válido THEN o sistema SHALL responder `400 INVALID_REQUEST`. (SET-03)
- IF `DATABASE_URL` não estiver configurado THEN as rotas `/api/setlists` e `/api/teams` SHALL responder `503 DATABASE_NOT_CONFIGURED`, como as rotas de música. (SET-25)
- WHEN o grupo atual for arquivado enquanto `?team=` aponta para ele THEN `/setlists` SHALL cair no primeiro grupo do seletor. (SET-14)

### Implicit-requirement dimensions

- **Input validation & bounds:** SET-03, SET-05, SET-06, GRP-03.
- **Failure / partial-failure states:** SET-22 (transação no clone), SET-25.
- **Idempotency / duplicates:** SET-17 (seguir e deixar de seguir idempotentes); um clone repetido cria outro clone de propósito.
- **Auth boundaries & rate limits:** SET-23 e SET-24; rate limit N/A porque não há login, nem endpoint caro ou externo nesta fase.
- **Concurrency / ordering:** SET-07.
- **Data lifecycle:** SET-08 (status), exclusão lógica, GRP-04 (arquivar).
- **Observability:** N/A além dos códigos de erro, porque não há auditoria pedida para setlists nesta fase (o `ImportLog` é exclusivo do import).
- **External-dependency failure:** N/A porque a feature não chama serviços externos.
- **State-transition integrity:** SET-08 e SET-19.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SET-01 | P1: Montar e publicar | Tasks | Pending |
| SET-02 | P1: Montar e publicar | Tasks | Pending |
| SET-03 | P1: Montar e publicar | Tasks | Pending |
| SET-04 | P1: Montar e publicar | Tasks | Pending |
| SET-05 | P1: Montar e publicar | Tasks | Pending |
| SET-06 | P1: Montar e publicar | Tasks | Pending |
| SET-07 | P1: Montar e publicar | Tasks | Pending |
| SET-08 | P1: Montar e publicar | Tasks | Pending |
| SET-09 | P1: Montar e publicar | Tasks | Pending |
| SET-10 | P1: Ler em sequência | Tasks | Pending |
| SET-11 | P1: Ler em sequência | Tasks | Pending |
| SET-12 | P1: Ler em sequência | Tasks | Pending |
| SET-13 | P1: Ler em sequência | Tasks | Pending |
| SET-14 | P1: Navegar por grupo | Tasks | Pending |
| SET-15 | P1: Navegar por grupo | Tasks | Pending |
| SET-16 | P1: Navegar por grupo | Tasks | Pending |
| SET-17 | P1: Seguir e clonar | Tasks | Pending |
| SET-18 | P1: Seguir e clonar | Tasks | Pending |
| SET-19 | P1: Seguir e clonar | Tasks | Pending |
| SET-20 | P1: Seguir e clonar | Tasks | Pending |
| SET-21 | P1: Seguir e clonar | Tasks | Pending |
| SET-22 | P1: Seguir e clonar | Tasks | Pending |
| SET-23 | P1: Política única | Tasks | Pending |
| SET-24 | P1: Política única | Tasks | Pending |
| SET-25 | Edge Cases | Tasks | Pending |
| GRP-01 | P1: Gerenciar grupos | Tasks | Pending |
| GRP-02 | P1: Gerenciar grupos | Tasks | Pending |
| GRP-03 | P1: Gerenciar grupos | Tasks | Pending |
| GRP-04 | P1: Gerenciar grupos | Tasks | Pending |

**ID format:** `SET-NN` (setlists), `GRP-NN` (grupos de louvor)

**Coverage:** 29 total, 29 mapped to tasks, 0 unmapped.

---

## Success Criteria

- [ ] O fluxo do Independent Test de "Montar e publicar" termina em menos de 3 minutos para um setlist de 5 músicas.
- [ ] A tabela de testes de `canPerform` cobre 100% das combinações de ação e ator da matriz SET-24.
- [ ] Nenhuma rota de setlist ou de grupo decide acesso fora de `canPerform` (verificado na revisão do Verifier).
- [ ] Clonar entre igrejas no teste do serviço deixa zero registros parciais quando uma cópia falha.
