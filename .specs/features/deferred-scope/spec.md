# Escopo adiado: acesso, cifras e organização

## Problem Statement

O discovery deixou de fora cobrança, lixeira, delegação, link público, histórico de cifra, “ver como” e as decisões D2, D3 e D4. O código não tem essas ações: música não se exclui, cifra se sobrescreve, convite é só de gestor, e anônimo não abre setlist.

## Goals

- [ ] Líder convida músico só para grupo que ele lidera.
- [ ] Gestor e admin mandam música para a lixeira e restauram, sem apagar a linha.
- [ ] O autor edita o que criou, e cada gravação de cifra guarda a versão anterior.
- [ ] Músico sugere correção. A cifra ao vivo só muda quando alguém com `music:write` aprova.
- [ ] Link opaco mostra as letras do setlist publicado, sem acordes.
- [ ] Admin edita o nome da igreja e acompanha uma assinatura Stripe, sem travar o app.
- [ ] Quem tem uma capacidade empresta um subconjunto com prazo.
- [ ] Admin vê o app como outro usuário, sem escrever e sem alcançar Admin.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Papel Técnico, tela de auditoria e o restante do catálogo do discovery | Já têm outro plano. Aqui só entram as capacidades novas. |
| Renomear `music:write`, `users:invite` e as demais capacidades atuais | Os IDs novos seguem o estilo que já existe. |
| Arquivar uma cifra avulsa | O botão “Arquivar cifra” continua desabilitado. |
| Exclusão física de música | `SetlistItem` aponta para a música. |
| Vários preços, ou bloquear o app por atraso | Um preço. Atraso é banner do admin. |
| “Ver como” com permissão de escrever | A prévia é só leitura. |
| E-mail ao sugerir ou ao aprovar cifra | A fila fica na página da música. |
| Link público com acordes | Mantém a AD-010. |
| Trocar o `slug` da organização | O nome muda. O slug não. |
| Setlist `public` para anônimo | Continua valendo só para usuário logado de outra igreja. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Link público | Token opaco, só letras, sem acordes, rota `/s/{code}` | Escolha do João. Visitante não vê cifra. | sim |
| Cobrança | Configurações e Stripe nesta spec | Escolha do João: os dois. | sim |
| D2 | Líder convida só `musician`, só grupos que lidera, na página do grupo | O plano que esta spec registra. Gestor continua em `/usuarios`. | sim |
| D3 | Sugestão não altera a cifra até `music:write` aprovar. Uma pendente por pessoa por cifra. | O plano que esta spec registra. | sim |
| D4 | Autor edita conteúdo na mesma igreja, mesmo sem a capacidade. Não exclui, não importa, não muda visibilidade. Linha antiga sem autor não ganha o direito. | Exceção explícita ao CED-17. | sim |
| Delegação | Subconjunto do que o concedente tem. Fim obrigatório, no máximo 90 dias. Sem `org:settings`, `users:manage` e `users:impersonate`. | Emprestar gestão de papéis ou cobrança seria escalada. | sim |
| Ver como | Só leitura, 30 minutos, motivo obrigatório, sem cookie do alvo, sem alcançar Admin | Personificar de verdade atribuiria a escrita ao outro. | sim |
| Atraso de pagamento | Banner “Pagamento em atraso.” só em `/organizacao`. Músico, líder e gestor entram normal. | Ensaio não pode cair porque o cartão falhou. | sim |
| IDs de capacidade | `users:invite:led`, `music:delete`, `org:settings`, `users:impersonate` | Mesmo estilo de `users:invite` e `music:write`. | não, default técnico |
| Vários links | Mais de um link ativo por setlist. Revogar um não revoga os outros. | Cada ensaio pode ter um link. | não, default técnico |
| Código do link | 32 bytes, base64url, banco guarda só SHA-256. O código cru sai uma vez no `201`. | Igual ao convite. | não, default técnico |
| Taxa do link | 10 códigos inválidos por IP a cada 15 minutos, depois `429` | Igual ao limite do convite. | não, default técnico |
| Nome da igreja | 1 a 80 caracteres | Slug continua fixo. | não, default técnico |
| Texto de cifra | Vazio não grava. Acima de 500 KiB UTF-8 não grava. | Mesmo teto do import e do CED-07/CED-08. | não, default técnico |
| Concorrência da cifra | O último `PUT` ou a última sugestão pendente vence | A cifra não tem `expectedVersion` (CED). | não, default técnico |
| Histórico | Não se apaga revisão nesta feature | Restaurar cria revisão nova e mantém a escolhida. | não, default técnico |
| Stripe | Um `STRIPE_PRICE_ID`. Status da app: `none`, `active`, `past_due`, `canceled`. `unpaid` e qualquer outro status da Stripe viram `canceled`. | O valor mora na Stripe, não no código. | não, default técnico |
| Webhook desconhecido | Customer id sem organização responde `200` e não grava | A Stripe não fica reenviando para sempre. | não, default técnico |
| Fuso do banner de delegação | Data `DD/MM/AAAA` em `America/Sao_Paulo` | A igreja está nesse fuso. | não, default técnico |
| Motivo do ver como | 1 a 200 caracteres | Curto o bastante para auditoria, longo o bastante para uma frase. | não, default técnico |
| Papel personalizado | Pode receber `users:invite:led` e `music:delete`. Não pode receber `org:settings` nem `users:impersonate`. | Essas duas ficam no preset admin. | não, default técnico |

**Open questions:** none.

---

## User Stories

### P1: Líder convida o próprio grupo ⭐ MVP

**User Story**: Como líder de um grupo, quero convidar um músico para esse grupo sem abrir a área de usuários.

**Why P1**: D2. Hoje `createInvite` exige `users:invite`, que o líder não tem.

**Acceptance Criteria**:

1. WHEN um ator com `users:invite:led`, líder de cada `teamId`, envia `roles` exatamente `["musician"]`, `teamIds` não vazio, e-mail com `@` e sem usuário ativo na igreja THEN o sistema SHALL responder `201`, SHALL gravar o convite pendente só com esses grupos e SHALL auditar `invite.create`. (LED-01)
2. IF o ator não tem `users:invite` nem `users:invite:led` THEN o sistema SHALL responder `403` com `FORBIDDEN`. (LED-02)
3. IF o ator tem só `users:invite:led` e algum `teamId` está vazio na prática (lista vazia, grupo de outro, arquivado, inexistente ou grupo que ele não lidera) THEN o sistema SHALL responder `403` com `FORBIDDEN` e SHALL não criar convite. (LED-03)
4. IF o ator tem só `users:invite:led` e `roles` não é exatamente `["musician"]` THEN o sistema SHALL responder `403` com `FORBIDDEN`. (LED-04)
5. WHEN um ator com `users:invite` convida para um grupo ativo da igreja em que ele não é líder THEN o sistema SHALL responder `201`. (LED-05)
6. WHEN o líder do grupo abre a página desse grupo THEN o sistema SHALL mostrar o formulário de convite com esse grupo já fixo e sem seletor de papel. (LED-06)
7. IF o ator não é líder daquele grupo THEN a página do grupo SHALL omitir o formulário de convite. (LED-07)
8. The worship_leader preset SHALL include `users:invite:led` and SHALL NOT include `users:invite`. (LED-08)
9. WHEN o ator tem `users:invite` THEN `can` para `users:invite:led` SHALL ser verdadeiro. (LED-09)
10. IF o e-mail não contém `@` THEN o sistema SHALL responder `400` com `INVALID_REQUEST`. (LED-10)
11. IF o e-mail já é de um usuário ativo da igreja THEN o sistema SHALL responder `409` com `USER_EXISTS`. (LED-11)

**Independent Test**: Líder do grupo A convida um e-mail novo como músico de A e recebe o link. O mesmo líder, no grupo B, não vê o formulário e recebe `403` se chamar a API. Gestor continua convidando pela área de usuários.

---

### P1: Lixeira de músicas ⭐ MVP

**User Story**: Como gestor, quero tirar uma música da biblioteca e poder trazê-la de volta.

**Why P1**: `song.delete` não existe. Setlist já usa `deletedAt`. A música segue o mesmo caminho.

**Acceptance Criteria**:

1. WHEN um ator com `music:delete` envia `DELETE /api/songs/{songId}` de uma música da própria igreja sem `deletedAt` THEN o sistema SHALL preencher `deletedAt`, SHALL manter a linha e os `SetlistItem`, SHALL responder `200` e SHALL auditar `song.delete` com o `songId`. (BIN-01)
2. IF o ator não tem `music:delete` THEN o `DELETE` SHALL responder `403` com `FORBIDDEN`. (BIN-02)
3. WHEN um ator com `music:delete` envia `POST /api/songs/{songId}/restore` de uma música com `deletedAt` THEN o sistema SHALL limpar `deletedAt`, SHALL responder `200` e SHALL auditar `song.restore` com o `songId`. (BIN-03)
4. IF a música não está na lixeira THEN o restore SHALL responder `409` com `SONG_NOT_DELETED`. (BIN-04)
5. IF o `songId` não existe ou é de outra igreja THEN o `DELETE` e o restore SHALL responder `404` com `NOT_FOUND`. (BIN-05)
6. The song library and the public lyrics catalog SHALL omit songs whose `deletedAt` is set. (BIN-06)
7. WHEN um item de setlist aponta para uma música com `deletedAt` THEN o item SHALL trazer `unavailable: true` e o título, e SHALL omitir seções, letra e acordes. (BIN-07)
8. WHEN um ator com `music:delete` abre `/musicas/lixeira` THEN o sistema SHALL listar as músicas com `deletedAt` da igreja e SHALL mostrar “Restaurar” em cada uma. (BIN-08)
9. IF um ator sem `music:delete` abre `/musicas/lixeira` THEN o sistema SHALL responder `403` e SHALL mostrar “Você não tem acesso a esta área.” (BIN-09)
10. The manager and admin presets SHALL include `music:delete`. (BIN-10)
11. The worship_leader and musician presets SHALL NOT include `music:delete`. (BIN-11)
12. IF o `DELETE` se repete numa música que já está na lixeira THEN o sistema SHALL responder `404` com `NOT_FOUND`. (BIN-12)

**Independent Test**: Gestor exclui uma música que está num setlist. Ela some da biblioteca e de `/letras`. O item do setlist mostra o título indisponível. Restaurar devolve a música e o item.

---

### P1: Autor edita o que criou ⭐ MVP

**User Story**: Como autor de uma música, cifra ou setlist, quero corrigir esse conteúdo mesmo depois de perder a capacidade de editar.

**Why P1**: D4. Hoje não há `createdByUserId`. Sem a capacidade, o `PUT` responde `403` (CED-17).

**Acceptance Criteria**:

1. WHEN um usuário cria música, cifra ou setlist THEN o sistema SHALL gravar `createdByUserId` com o id desse usuário. (OWN-01)
2. The system SHALL leave `createdByUserId` null on rows that already existed before this feature. (OWN-02)
3. WHEN o ator é o `createdByUserId`, está na mesma igreja, a cifra não está em música na lixeira, e o `PUT` só altera `source`, `sections`, `key` e `capo` THEN o sistema SHALL responder `204` mesmo sem `music:write`. (OWN-03)
4. IF o ator não é o autor e não tem `music:write` THEN o `PUT` da cifra SHALL responder `403` com `FORBIDDEN`. (OWN-04)
5. IF o autor não tem `music:write` e o corpo muda `publicLyrics` THEN o sistema SHALL responder `403` com `PUBLIC_LYRICS_FORBIDDEN` e SHALL manter o valor gravado. (OWN-05)
6. IF o autor não tem `import`, a flag de import está desligada, e o `PUT` cria `origin` ou troca `originUrl` THEN o sistema SHALL responder `404` com `NOT_FOUND`. (OWN-06)
7. IF o autor não tem `import`, a flag de import está ligada, e o `PUT` cria `origin` ou troca `originUrl` THEN o sistema SHALL responder `401` com `IMPORT_LOCKED`. (OWN-07)
8. WHEN o ator é o autor do setlist, na mesma igreja, o setlist não tem `deletedAt`, e ele não tem `setlists:led` nem `setlists:all`, e o corpo só altera título, notas ou itens THEN o sistema SHALL responder `204`. (OWN-08)
9. IF esse autor altera visibilidade, status, dono ou pede exclusão do setlist THEN o sistema SHALL responder `403` com `FORBIDDEN` e SHALL manter esses campos. (OWN-09)
10. IF `createdByUserId` é null e o ator não tem a capacidade daquela escrita THEN o sistema SHALL responder `403` com `FORBIDDEN`. (OWN-10)
11. IF o `createdByUserId` é de outra igreja THEN o sistema SHALL responder `403` com `FORBIDDEN`. (OWN-11)

**Independent Test**: Um líder cria uma cifra e um setlist e depois fica só músico. Ele ainda salva texto, tom e capo, e ainda edita título e itens desse setlist. Não muda “visível ao público”, não troca a URL de origem e não exclui.

---

### P1: Histórico de cifra ⭐ MVP

**User Story**: Como quem edita uma cifra, quero ver as versões anteriores e restaurar uma delas.

**Why P1**: Cada save hoje sobrescreve a mesma linha.

**Acceptance Criteria**:

1. WHEN um save atualiza uma cifra que já existe THEN o sistema SHALL gravar uma revisão com o `source`, as `sections`, a `key` e o `capo` de antes, e com `savedByUserId` igual ao `lastEditedByUserId` anterior (null se nunca houve). (REV-01)
2. WHEN o save conclui THEN o sistema SHALL gravar `lastEditedByUserId` com o ator desse save. (REV-02)
3. WHEN um ator que pode editar a cifra restaura uma revisão THEN o sistema SHALL copiar o conteúdo dessa revisão para a cifra ao vivo, SHALL gravar uma revisão nova com o conteúdo de antes da restauração e SHALL manter a revisão escolhida na lista. (REV-03)
4. IF o ator não pode editar essa cifra THEN `GET /api/charts/{chartId}/revisions` e o restore SHALL responder `403` com `FORBIDDEN`. (REV-04)
5. WHEN um ator que pode editar abre o histórico THEN o sistema SHALL listar as revisões da mais nova para a mais antiga, cada uma com `savedAt`. (REV-05)
6. The system SHALL NOT delete `ChordChartRevision` rows in this feature. (REV-06)
7. IF a cifra não tem revisão THEN o histórico SHALL mostrar “Nenhuma versão anterior.” (REV-07)

**Independent Test**: Editar a cifra duas vezes. A lista tem uma revisão com o texto anterior. Restaurar devolve esse texto e a lista fica com duas revisões.

---

### P1: Sugestão de cifra ⭐ MVP

**User Story**: Como músico, quero propor uma correção sem alterar a cifra que o grupo já usa.

**Why P1**: D3. Não existe fila. O “sugestão” do import só casa título e artista.

**Acceptance Criteria**:

1. WHEN um membro da igreja envia uma sugestão com `source` não vazio e de até 500 KiB UTF-8 THEN o sistema SHALL responder `201` e SHALL gravar status `pending`. (SUG-01)
2. IF o `source` está vazio THEN o sistema SHALL responder `400` e SHALL mostrar “Informe o texto da cifra.” (SUG-02)
3. IF o `source` passa de 500 KiB UTF-8 THEN o sistema SHALL responder `400` e SHALL mostrar “O texto deve ter no máximo 500 KiB.” (SUG-03)
4. WHEN o mesmo usuário envia de novo uma sugestão `pending` para a mesma cifra THEN o sistema SHALL substituir o conteúdo proposto, SHALL manter `pending` e SHALL responder `200`. (SUG-04)
5. IF não há ator autenticado THEN o envio SHALL responder `401` com `UNAUTHENTICATED`. (SUG-05)
6. WHEN um músico sem `music:write` envia ou substitui a sugestão THEN a cifra ao vivo SHALL permanecer com o mesmo `source`, as mesmas `sections`, a mesma `key` e o mesmo `capo`. (SUG-06)
7. WHEN um ator com `music:write` aprova uma sugestão `pending` THEN o sistema SHALL gravar o conteúdo proposto na cifra pelo mesmo caminho do save, SHALL criar a revisão do conteúdo anterior, SHALL marcar a sugestão `approved` com `reviewedByUserId` e `reviewedAt`, e SHALL responder `200`. (SUG-07)
8. WHEN um ator com `music:write` rejeita uma sugestão `pending` THEN o sistema SHALL marcar `rejected` e SHALL deixar a cifra ao vivo intacta. (SUG-08)
9. IF aprovar ou rejeitar uma sugestão que não está `pending` THEN o sistema SHALL responder `409` com `SUGGESTION_NOT_PENDING`. (SUG-09)
10. IF o ator não tem `music:write` e aprova ou rejeita THEN o sistema SHALL responder `403` com `FORBIDDEN`. (SUG-10)
11. WHEN um ator sem `music:write` abre a página da música THEN o sistema SHALL mostrar “Sugerir correção” e SHALL omitir a fila das sugestões dos outros. (SUG-11)
12. WHEN um ator com `music:write` abre a página da música THEN o sistema SHALL listar as sugestões `pending` dessa cifra. (SUG-12)
13. IF a música está na lixeira ou a cifra não existe THEN o envio SHALL responder `404` com `NOT_FOUND`. (SUG-13)

**Independent Test**: Músico envia uma correção. A página de quem tem `music:write` mostra a fila. Aprovar troca a cifra e gera revisão. Rejeitar não troca a cifra.

---

### P1: Link público só de letras ⭐ MVP

**User Story**: Como quem edita um setlist publicado, quero um link para a congregação acompanhar as letras, sem acordes.

**Why P1**: Anônimo não lê setlist (AD-010). `visibility=public` não é página aberta.

**Acceptance Criteria**:

1. WHEN um ator que pode editar o setlist cria o link de um setlist `published` sem `deletedAt` THEN o sistema SHALL responder `201` com o código uma única vez e SHALL guardar só o SHA-256. (SHR-01)
2. IF o setlist está `draft`, `archived` ou com `deletedAt` THEN a criação SHALL responder `409` com `SETLIST_NOT_SHAREABLE`. (SHR-02)
3. IF o ator não pode editar o setlist THEN a criação e a revogação SHALL responder `403` com `FORBIDDEN`. (SHR-03)
4. WHEN um anônimo abre `GET /s/{code}` de um link ativo cujo setlist está `published` e sem `deletedAt` THEN o sistema SHALL responder `200` com as músicas na ordem dos itens, cada linha só com texto, e SHALL omitir qualquer campo `chords`. (SHR-04)
5. IF o código é desconhecido, o link está revogado, ou o setlist não está `published` ou tem `deletedAt` THEN o `GET /s/{code}` SHALL responder `404` com `NOT_FOUND`. (SHR-05)
6. WHEN o mesmo IP erra o código 10 vezes em 15 minutos e erra de novo THEN o sistema SHALL responder `429`. (SHR-06)
7. WHEN a cifra da música tem `originUrl` e `origin` THEN o item SHALL incluir `imported.originUrl`. (SHR-07)
8. WHEN a música do item está na lixeira THEN o item SHALL trazer o título e o texto “Música indisponível” e SHALL omitir letra e acordes. (SHR-08)
9. WHEN a música está no setlist com `publicLyrics` falso THEN o `GET /s/{code}` SHALL incluir a letra dessa música mesmo assim. (SHR-09)
10. WHEN um link é revogado e existe outro link ativo do mesmo setlist THEN o código revogado SHALL responder `404` e o outro código SHALL responder `200`. (SHR-10)
11. WHEN um anônimo abre `/s/{code}` THEN o sistema SHALL não redirecionar para `/entrar`. (SHR-11)
12. WHEN o item tem `imported.originUrl` THEN a página SHALL mostrar “Importada” e o link dessa URL. (SHR-12)

**Independent Test**: Editor gera o link de um setlist publicado. Sem login, a página mostra as letras na ordem e o selo Importada. Não há acordes no HTML nem no JSON. Rascunho responde `409` na criação e `404` se o link existia e o setlist deixou de estar publicado.

---

### P1: Configurações da organização ⭐ MVP

**User Story**: Como admin, quero mudar o nome da igreja numa página que só eu abro.

**Why P1**: `Organization` só tem id, slug e nome. Não há `org:settings`.

**Acceptance Criteria**:

1. The admin preset SHALL include `org:settings`. (ORG-01)
2. The manager, worship_leader, and musician presets SHALL NOT include `org:settings`. (ORG-02)
3. IF um papel personalizado é salvo com `org:settings` THEN o sistema SHALL responder `409` com `ROLE_CAPABILITY_FORBIDDEN` e SHALL não gravar o papel. (ORG-03)
4. WHEN um ator com `org:settings` envia um nome de 1 a 80 caracteres THEN o sistema SHALL gravar o nome, SHALL manter o `slug` e SHALL responder `200`. (ORG-04)
5. IF o nome está vazio ou passa de 80 caracteres THEN o sistema SHALL responder `400` com `INVALID_REQUEST` e SHALL manter o nome anterior. (ORG-05)
6. IF um ator sem `org:settings` abre `/organizacao` THEN o sistema SHALL responder `403` e SHALL mostrar “Você não tem acesso a esta área.” (ORG-06)
7. WHEN o ator tem `org:settings` THEN a navegação SHALL mostrar o link da organização. WHEN não tem THEN a navegação SHALL omitir esse link. (ORG-07)

**Independent Test**: Admin muda o nome e o slug permanece. Gestor que abre `/organizacao` vê a tela de sem acesso. Papel personalizado com `org:settings` não salva.

---

### P1: Cobrança Stripe ⭐ MVP

**User Story**: Como admin, quero assinar e ver se o pagamento está em dia, sem impedir o resto da igreja de usar o app.

**Why P1**: Não há campos de assinatura nem webhook.

**Acceptance Criteria**:

1. WHEN um ator com `org:settings` pede o checkout e `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `STRIPE_PRICE_ID` existem THEN o sistema SHALL responder `200` com a URL do Stripe Checkout. (PAY-01)
2. IF alguma dessas variáveis falta THEN o checkout e o portal SHALL responder `503` com `BILLING_NOT_CONFIGURED`. (PAY-02)
3. IF a assinatura do webhook é inválida THEN o sistema SHALL responder `400` e SHALL não alterar a organização. (PAY-03)
4. WHEN `customer.subscription.updated` traz status `active` ou `past_due` para um customer da organização THEN o sistema SHALL gravar esse status e o `currentPeriodEnd`. (PAY-04)
5. WHEN `customer.subscription.deleted` chega, ou o status da Stripe é `unpaid` ou outro valor fora de `active` e `past_due` THEN o sistema SHALL gravar `canceled`. (PAY-05)
6. WHEN o mesmo id de evento da Stripe chega de novo THEN o sistema SHALL responder `200` e SHALL deixar `subscriptionStatus` e `currentPeriodEnd` como ficaram na primeira entrega. (PAY-06)
7. IF o customer id não pertence a nenhuma organização THEN o sistema SHALL responder `200` e SHALL não gravar. (PAY-07)
8. IF a chamada de checkout à Stripe falha THEN o sistema SHALL responder `502` com `BILLING_UNAVAILABLE` e SHALL não alterar os campos de cobrança. (PAY-08)
9. WHILE `subscriptionStatus` é `past_due` e o ator tem `org:settings`, a página `/organizacao` SHALL mostrar “Pagamento em atraso.” (PAY-09)
10. WHILE `subscriptionStatus` é `past_due`, um ator sem `org:settings` SHALL abrir a biblioteca com sucesso e SHALL não ver “Pagamento em atraso.” (PAY-10)
11. WHILE `subscriptionStatus` é `none` ou `canceled`, a página `/organizacao` SHALL mostrar “Sem assinatura” e o botão de checkout. (PAY-11)
12. WHEN um ator com `org:settings` pede o portal e a Stripe está configurada THEN o sistema SHALL responder `200` com a URL do Customer Portal. (PAY-12)
13. The organization `subscriptionStatus` SHALL be one of `none`, `active`, `past_due`, or `canceled`. (PAY-13)

**Independent Test**: Sem as variáveis, o checkout responde `503`. Com webhook `past_due`, só o admin vê o banner. A biblioteca do músico continua abrindo. O mesmo evento, na segunda vez, não muda a data.

---

### P1: Delegação temporária ⭐ MVP

**User Story**: Como alguém com uma capacidade, quero emprestá-la a outra pessoa até uma data, e retomá-la quando quiser.

**Why P1**: `getCurrentActor` relê o banco a cada request. A delegação entra nessa leitura.

**Acceptance Criteria**:

1. WHEN o concedente delega um subconjunto das capacidades que ele tem, para outra pessoa, com `expiresAt` no futuro e no máximo 90 dias à frente THEN o sistema SHALL responder `201` e SHALL auditar `delegation.create`. (DLG-01)
2. IF `expiresAt` falta, está no passado ou passa de 90 dias THEN o sistema SHALL responder `400` com `INVALID_EXPIRY` e SHALL não gravar. (DLG-02)
3. IF a lista inclui uma capacidade que o concedente não tem THEN o sistema SHALL responder `403` com `FORBIDDEN`. (DLG-03)
4. IF a lista inclui `org:settings`, `users:manage` ou `users:impersonate` THEN o sistema SHALL responder `400` com `DELEGATION_CAPABILITY_FORBIDDEN`. (DLG-04)
5. IF o destinatário é o próprio concedente THEN o sistema SHALL responder `400` com `INVALID_REQUEST`. (DLG-05)
6. WHEN o concedente tem `setlists:led` e não tem `setlists:all` THEN cada `teamId` SHALL ser um grupo que ele lidera, e o `setlists:led` delegado SHALL valer só nesses grupos. (DLG-06)
7. IF nesse caso a lista de grupos vem vazia ou inclui grupo que ele não lidera THEN o sistema SHALL responder `403` com `FORBIDDEN`. (DLG-07)
8. WHILE a delegação não tem `revokedAt`, `startsAt` já passou e `expiresAt` ainda não chegou, `can` do destinatário SHALL incluir essas capacidades. (DLG-08)
9. WHEN a delegação é revogada ou `expiresAt` já passou THEN a request seguinte do destinatário SHALL não incluir essas capacidades. (DLG-09)
10. WHILE existe delegação ativa para o ator THEN o sistema SHALL mostrar “Acesso delegado até {DD/MM/AAAA}.” com a data em `America/Sao_Paulo`. (DLG-10)
11. WHEN o concedente revoga THEN o sistema SHALL auditar `delegation.revoke`. (DLG-11)

**Independent Test**: Líder delega `setlists:led` do grupo A por 7 dias. O destinatário edita setlist de A e recebe `403` no grupo B. No dia seguinte ao fim, a request já não traz a capacidade. Delegar `org:settings` responde `400`.

---

### P1: Ver como ⭐ MVP

**User Story**: Como admin, quero olhar o app do jeito que outra pessoa vê, sem agir no lugar dela.

**Why P1**: Não há personificação. O usuário simulado de dev não vale em produção.

**Acceptance Criteria**:

1. The admin preset SHALL include `users:impersonate`. (SEE-01)
2. The manager, worship_leader, and musician presets SHALL NOT include `users:impersonate`. (SEE-02)
3. IF um papel personalizado é salvo com `users:impersonate` THEN o sistema SHALL responder `409` com `ROLE_CAPABILITY_FORBIDDEN`. (SEE-03)
4. WHEN um ator com `users:impersonate` envia alvo da mesma igreja, sem papel admin, diferente de si, e motivo de 1 a 200 caracteres THEN o sistema SHALL abrir a prévia por 30 minutos, SHALL auditar `view_as.start` com ator, alvo e motivo, e SHALL responder `201`. (SEE-04)
5. IF o motivo está vazio ou passa de 200 caracteres THEN o sistema SHALL responder `400` com `INVALID_REQUEST`. (SEE-05)
6. IF o alvo tem papel admin ou é o próprio ator THEN o sistema SHALL responder `403` com `FORBIDDEN`. (SEE-06)
7. IF o alvo é de outra igreja ou não existe THEN o sistema SHALL responder `404` com `NOT_FOUND`. (SEE-07)
8. WHILE a prévia está ativa, as leituras SHALL usar as capacidades do alvo. (SEE-08)
9. WHILE a prévia está ativa, qualquer mutação SHALL responder `403` com `VIEW_AS_READONLY`. (SEE-09)
10. WHILE a prévia está ativa, o sistema SHALL mostrar “Você está vendo como {nome}.” e o botão “Sair”. (SEE-10)
11. WHEN o ator sai, ou na primeira request depois dos 30 minutos THEN o sistema SHALL voltar ao ator real e SHALL auditar `view_as.end`. (SEE-11)
12. The system SHALL NOT create an `AuthSession` for the target user. (SEE-12)
13. WHILE a prévia está ativa, as capacidades delegadas ao admin que olha SHALL NOT entrar nas leituras. (SEE-13)

**Independent Test**: Admin abre a prévia de um músico, vê a biblioteca sem botões de editar, e um `PUT` responde `403` com `VIEW_AS_READONLY`. Não nasce sessão do músico. Alvo admin responde `403`. Sair devolve o menu do admin.

---

## Edge Cases

- LED-03 cobre grupo arquivado, inexistente e grupo que o líder não lidera.
- BIN-07 e SHR-08 cobrem música na lixeira dentro de setlist e de link público.
- BIN-12 cobre excluir de novo.
- OWN-02 e OWN-10 cobrem linha antiga sem autor.
- OWN-06 e OWN-07 cobrem origem nova pelo autor.
- SUG-04 cobre a segunda sugestão pendente da mesma pessoa.
- SUG-09 cobre aprovar o que já foi aprovado ou rejeitado.
- SHR-06 cobre a 11ª tentativa inválida.
- SHR-10 cobre dois links do mesmo setlist.
- PAY-06 cobre evento repetido. PAY-07 cobre customer desconhecido.
- DLG-02 cobre prazo acima de 90 dias. DLG-09 cobre o instante depois de `expiresAt`.
- SEE-11 cobre o fim dos 30 minutos sem clicar em “Sair”. SEE-13 cobre delegação e prévia ao mesmo tempo.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| LED-01 | P1: Líder convida o próprio grupo | - | Pending |
| LED-02 | P1: Líder convida o próprio grupo | - | Pending |
| LED-03 | P1: Líder convida o próprio grupo | - | Pending |
| LED-04 | P1: Líder convida o próprio grupo | - | Pending |
| LED-05 | P1: Líder convida o próprio grupo | - | Pending |
| LED-06 | P1: Líder convida o próprio grupo | - | Pending |
| LED-07 | P1: Líder convida o próprio grupo | - | Pending |
| LED-08 | P1: Líder convida o próprio grupo | - | Pending |
| LED-09 | P1: Líder convida o próprio grupo | - | Pending |
| LED-10 | P1: Líder convida o próprio grupo | - | Pending |
| LED-11 | P1: Líder convida o próprio grupo | - | Pending |
| BIN-01 | P1: Lixeira de músicas | - | Pending |
| BIN-02 | P1: Lixeira de músicas | - | Pending |
| BIN-03 | P1: Lixeira de músicas | - | Pending |
| BIN-04 | P1: Lixeira de músicas | - | Pending |
| BIN-05 | P1: Lixeira de músicas | - | Pending |
| BIN-06 | P1: Lixeira de músicas | - | Pending |
| BIN-07 | P1: Lixeira de músicas | - | Pending |
| BIN-08 | P1: Lixeira de músicas | - | Pending |
| BIN-09 | P1: Lixeira de músicas | - | Pending |
| BIN-10 | P1: Lixeira de músicas | - | Pending |
| BIN-11 | P1: Lixeira de músicas | - | Pending |
| BIN-12 | P1: Lixeira de músicas | - | Pending |
| OWN-01 | P1: Autor edita o que criou | - | Pending |
| OWN-02 | P1: Autor edita o que criou | - | Pending |
| OWN-03 | P1: Autor edita o que criou | - | Pending |
| OWN-04 | P1: Autor edita o que criou | - | Pending |
| OWN-05 | P1: Autor edita o que criou | - | Pending |
| OWN-06 | P1: Autor edita o que criou | - | Pending |
| OWN-07 | P1: Autor edita o que criou | - | Pending |
| OWN-08 | P1: Autor edita o que criou | - | Pending |
| OWN-09 | P1: Autor edita o que criou | - | Pending |
| OWN-10 | P1: Autor edita o que criou | - | Pending |
| OWN-11 | P1: Autor edita o que criou | - | Pending |
| REV-01 | P1: Histórico de cifra | - | Pending |
| REV-02 | P1: Histórico de cifra | - | Pending |
| REV-03 | P1: Histórico de cifra | - | Pending |
| REV-04 | P1: Histórico de cifra | - | Pending |
| REV-05 | P1: Histórico de cifra | - | Pending |
| REV-06 | P1: Histórico de cifra | - | Pending |
| REV-07 | P1: Histórico de cifra | - | Pending |
| SUG-01 | P1: Sugestão de cifra | - | Pending |
| SUG-02 | P1: Sugestão de cifra | - | Pending |
| SUG-03 | P1: Sugestão de cifra | - | Pending |
| SUG-04 | P1: Sugestão de cifra | - | Pending |
| SUG-05 | P1: Sugestão de cifra | - | Pending |
| SUG-06 | P1: Sugestão de cifra | - | Pending |
| SUG-07 | P1: Sugestão de cifra | - | Pending |
| SUG-08 | P1: Sugestão de cifra | - | Pending |
| SUG-09 | P1: Sugestão de cifra | - | Pending |
| SUG-10 | P1: Sugestão de cifra | - | Pending |
| SUG-11 | P1: Sugestão de cifra | - | Pending |
| SUG-12 | P1: Sugestão de cifra | - | Pending |
| SUG-13 | P1: Sugestão de cifra | - | Pending |
| SHR-01 | P1: Link público só de letras | - | Pending |
| SHR-02 | P1: Link público só de letras | - | Pending |
| SHR-03 | P1: Link público só de letras | - | Pending |
| SHR-04 | P1: Link público só de letras | - | Pending |
| SHR-05 | P1: Link público só de letras | - | Pending |
| SHR-06 | P1: Link público só de letras | - | Pending |
| SHR-07 | P1: Link público só de letras | - | Pending |
| SHR-08 | P1: Link público só de letras | - | Pending |
| SHR-09 | P1: Link público só de letras | - | Pending |
| SHR-10 | P1: Link público só de letras | - | Pending |
| SHR-11 | P1: Link público só de letras | - | Pending |
| SHR-12 | P1: Link público só de letras | - | Pending |
| ORG-01 | P1: Configurações da organização | - | Pending |
| ORG-02 | P1: Configurações da organização | - | Pending |
| ORG-03 | P1: Configurações da organização | - | Pending |
| ORG-04 | P1: Configurações da organização | - | Pending |
| ORG-05 | P1: Configurações da organização | - | Pending |
| ORG-06 | P1: Configurações da organização | - | Pending |
| ORG-07 | P1: Configurações da organização | - | Pending |
| PAY-01 | P1: Cobrança Stripe | - | Pending |
| PAY-02 | P1: Cobrança Stripe | - | Pending |
| PAY-03 | P1: Cobrança Stripe | - | Pending |
| PAY-04 | P1: Cobrança Stripe | - | Pending |
| PAY-05 | P1: Cobrança Stripe | - | Pending |
| PAY-06 | P1: Cobrança Stripe | - | Pending |
| PAY-07 | P1: Cobrança Stripe | - | Pending |
| PAY-08 | P1: Cobrança Stripe | - | Pending |
| PAY-09 | P1: Cobrança Stripe | - | Pending |
| PAY-10 | P1: Cobrança Stripe | - | Pending |
| PAY-11 | P1: Cobrança Stripe | - | Pending |
| PAY-12 | P1: Cobrança Stripe | - | Pending |
| PAY-13 | P1: Cobrança Stripe | - | Pending |
| DLG-01 | P1: Delegação temporária | - | Pending |
| DLG-02 | P1: Delegação temporária | - | Pending |
| DLG-03 | P1: Delegação temporária | - | Pending |
| DLG-04 | P1: Delegação temporária | - | Pending |
| DLG-05 | P1: Delegação temporária | - | Pending |
| DLG-06 | P1: Delegação temporária | - | Pending |
| DLG-07 | P1: Delegação temporária | - | Pending |
| DLG-08 | P1: Delegação temporária | - | Pending |
| DLG-09 | P1: Delegação temporária | - | Pending |
| DLG-10 | P1: Delegação temporária | - | Pending |
| DLG-11 | P1: Delegação temporária | - | Pending |
| SEE-01 | P1: Ver como | - | Pending |
| SEE-02 | P1: Ver como | - | Pending |
| SEE-03 | P1: Ver como | - | Pending |
| SEE-04 | P1: Ver como | - | Pending |
| SEE-05 | P1: Ver como | - | Pending |
| SEE-06 | P1: Ver como | - | Pending |
| SEE-07 | P1: Ver como | - | Pending |
| SEE-08 | P1: Ver como | - | Pending |
| SEE-09 | P1: Ver como | - | Pending |
| SEE-10 | P1: Ver como | - | Pending |
| SEE-11 | P1: Ver como | - | Pending |
| SEE-12 | P1: Ver como | - | Pending |
| SEE-13 | P1: Ver como | - | Pending |

**Coverage:** 110 total, 0 mapped to tasks, 110 unmapped.

---

## Success Criteria

- [ ] Líder do grupo A convida músico para A e recebe `403` ao tentar o grupo B ou outro papel.
- [ ] Música na lixeira some da biblioteca e de `/letras`, o setlist a mostra indisponível, e restaurar desfaz isso.
- [ ] Autor rebaixado a músico ainda edita o conteúdo que criou, e não edita o que não criou.
- [ ] Cada save de cifra deixa a versão anterior restaurável.
- [ ] Sugestão do músico não altera a cifra. Aprovar altera e gera revisão. Rejeitar não altera.
- [ ] `/s/{code}` sem login mostra letras, selo Importada, e nenhum acorde.
- [ ] Admin muda o nome da igreja. Gestor recebe a tela de sem acesso.
- [ ] Webhook `past_due` mostra banner só para o admin. A biblioteca do músico abre.
- [ ] Delegação vence ou é revogada e a request seguinte já não traz a capacidade.
- [ ] Prévia de músico esconde a edição, mutação responde `VIEW_AS_READONLY`, e não nasce sessão do alvo.
