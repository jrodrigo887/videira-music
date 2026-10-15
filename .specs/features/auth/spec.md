# Autenticação e autorização

## Problem Statement

Hoje o Videira Music não tem login: quem age é um usuário simulado (`VIDEIRA_SIMULATED_USER_ID`, ignorado em produção), o import é liberado por um segredo compartilhado (AD-005) e as rotas de músicas e cifras (`/api/songs`, `/api/charts`, `/api/song-charts`) gravam no banco sem checar ninguém. Antes de publicar o app para a igreja, cada pessoa precisa entrar com a própria conta Google, só por convite, e cada ação precisa respeitar o papel dela: admin, gestor (pastor ou liderança), líder de louvor ou músico. Visitantes sem conta só veem letras que a igreja escolheu tornar públicas.

## Goals

- [ ] 100% das gravações e das leituras de cifra exigem um usuário autenticado e autorizado; anônimo recebe `401` nas APIs e é redirecionado nas páginas.
- [ ] Ninguém entra sem convite: login com uma conta Google sem usuário ativo nem convite válido é recusado em 100% dos casos.
- [ ] Um convite só pode ser aceito pela conta Google com o mesmo e-mail; um link vazado não dá acesso a outra pessoa.
- [ ] Toda decisão de acesso passa por uma única política de autorização e por `getCurrentActor()` (AD-007), sem regra de papel espalhada em rotas ou componentes.
- [ ] Visitantes sem login leem só letras de músicas marcadas como públicas, sem nenhum acorde no conteúdo entregue.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Login por senha, magic link ou outro provedor além do Google | Google é o único método desta entrega; outro método de cadastro ainda está em avaliação pelo dono e vira feature própria se for adotado. |
| Uma conta Google em mais de uma igreja | O esquema tem `User` único por igreja + e-mail; vínculo entre igrejas fica para a fase multi-igreja. |
| Admin da plataforma (super admin que cria igrejas) | O admin é da igreja; criar igrejas fica fora desta entrega. |
| Líder ou músico convidando pessoas | Só admin e gestor convidam. |
| Autoatendimento: pedir acesso, aprovar cadastro | O acesso nasce só do convite. |
| Envio de convite por e-mail em P1 | Exige provedor de e-mail; a P1 entrega copiar link e WhatsApp. O envio por e-mail é P3. |
| UI para consultar a auditoria | O registro serve para consulta direta no banco nesta entrega. |
| Setlist pessoal (dono usuário) | Reservado para a fase 2 pela AD-008. |
| Leitura anônima de setlists, inclusive `public` | Decisão do discovery: sem login, só a página de letras. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Alcance do admin | Admin da igreja (`Organization`), sem poderes em outras igrejas | Casa com o modelo multi-tenant atual. | sim |
| Método de login | Google OAuth/OIDC, único método | Decisão do discovery. | sim |
| Contas aceitas | Qualquer conta Google com `email_verified = true`, inclusive Google Workspace com domínio próprio, não só `@gmail.com` | Líderes podem usar o e-mail da igreja; o que importa é o e-mail bater com o convite. | não, default técnico |
| Comparação de e-mail | Sem diferença de maiúsculas e sem espaços nas pontas; pontos e `+alias` do Gmail contam como e-mails diferentes | Evita regras específicas de provedor; o admin convida o e-mail exato que a pessoa usa. | não, default técnico |
| Papéis acumuláveis | Um usuário tem um conjunto não vazio de papéis da igreja: `admin`, `manager` (gestor), `worship_leader` (líder de louvor), `musician` | Decisão do discovery: a mesma pessoa pode ser admin, gestor e líder. Substitui o `role` único de `User`. | sim |
| Liderança de grupo | Ser líder de um grupo exige o papel `worship_leader` e uma atribuição ao grupo; um grupo pode ter um ou mais líderes | Decisão do discovery. | sim |
| Líder único | Enquanto a igreja tiver exatamente um `worship_leader` ativo, ele é atribuído como líder de todos os grupos não arquivados, inclusive os criados depois | Decisão do discovery. | sim |
| Segundo líder cadastrado | Nada muda nos grupos: o primeiro líder continua em todos até admin ou gestor redistribuir | Decisão do discovery: nenhum grupo fica sem líder. | sim |
| Grupo novo com 2+ líderes na igreja | Nasce sem líder; até alguém atribuir, só admin e gestor editam os setlists dele | Não há critério para escolher o líder automaticamente. | não, default técnico |
| Quem convida | Admin e gestor | Decisão do discovery. | sim |
| Quem concede `admin` | Só admin concede ou retira `admin`; gestor concede e retira `manager`, `worship_leader` e `musician` | Evita que um gestor se promova a admin. | não, default técnico |
| Matriz de permissões | A da seção "Matriz de permissões" | Validada pelo dono: gestor e líder de louvor também importam; o líder gere os setlists dos grupos que lidera. | sim |
| Formato do link de convite | Token aleatório opaco de 32 bytes (base64url) no link; o banco guarda só o hash SHA-256 e os dados do convite | Decisão do dono: o link leva só o código, sem e-mail, para não expor dado pessoal no WhatsApp, no histórico e nos logs; o registro no banco permite revogar, uso único e lista de pendentes. | sim |
| Validade do convite | Definida por quem cria o convite, entre 1 hora e 30 dias, com 7 dias pré-selecionado; uso único | Decisão do dono: a validade máxima é escolhida na criação. Os limites e o padrão são default técnico. | sim |
| Novo convite para e-mail com convite pendente | O novo convite revoga o anterior | Permite corrigir papel ou grupo sem passo extra. | não, default técnico |
| Rota da página de convite | `/convite/{token}` | Endereço curto para compartilhar. | não, default técnico |
| Rota de login | `/entrar` | Página com o botão "Entrar com Google". | não, default técnico |
| Biblioteca de autenticação | Decidida no Design (candidatas: Auth.js, Better Auth, Arctic com sessão própria) | É decisão técnica, não de produto. | não, default técnico |
| Sessão | Guardada no servidor, cookie `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`; expira após 30 dias sem uso e renova a cada uso | `Lax` é exigido pelo retorno do Google; sessão longa evita o músico perder o login no culto; sessão no servidor permite encerrar no logout. | não, default técnico |
| Mudança de papel ou desativação | Vale na próxima requisição, sem esperar a sessão expirar | O `Actor` já é recarregado do banco a cada requisição. | não, default técnico |
| Primeiro admin | `VIDEIRA_BOOTSTRAP_ADMIN_EMAIL`; só vale enquanto a igreja não tiver nenhum admin ativo | Sem convite inicial, ninguém conseguiria entrar. | não, default técnico |
| Configuração incompleta em produção | Falha fechada: `/entrar` mostra "Login indisponível", nenhuma sessão nova é criada e o servidor registra `AUTH_MISCONFIGURED` uma vez por processo | Mesmo padrão da AD-005. | não, default técnico |
| Usuário simulado | Continua só fora de produção, para desenvolvimento e testes | Mantém a AD-007. | sim |
| Anônimo na raiz `/` | Vê o catálogo público de letras com o botão "Entrar" | Decisão do discovery. | sim |
| Anônimo em página protegida | Redireciona para `/entrar?next={caminho}`; depois do login volta ao caminho se ele for interno | Evita redirecionamento aberto. | não, default técnico |
| Leitura anônima de setlists | Nenhuma; supera o default "Leitura por anônimo" da spec `setlists`. Setlists `public` continuam legíveis por usuários logados de outras igrejas (AD-006) | Decisão do dono: o anônimo só acessa a lista de músicas e a letra. | sim |
| Marcação "visível ao público" | Campo da música (`Song`), padrão desligado, editável ao cadastrar, importar e editar por quem pode editar músicas | Decisão do discovery. | sim |
| Conteúdo da página pública | Lista: título e artista. Letra: título, artista, rótulos das seções e texto das linhas. Sem acordes, tom, capo, andamento, compasso, notas, transposição, ajustes de exibição nem links para setlists | Decisão do dono: só a letra, sem recursos de cifra nem demais detalhes. Manter título, artista e rótulos de seção é default técnico. | sim |
| Letra exibida ao público | A da cifra em formato de letra (`lyrics`) atualizada mais recentemente; música sem cifra de letra não aparece, mesmo marcada | Uma música pode ter várias cifras; cifra em grade não tem letra. | não, default técnico |
| Cifra importada marcada como pública | Aparece com o selo "Importada" e o link para `originUrl`; amplia a AD-006 | Decisão do discovery: a marcação também vale no import. | sim |
| Texto do ícone de informação | "Visível ao público: qualquer pessoa, mesmo sem login, poderá ler a letra desta música na página de letras. Os acordes continuam visíveis só para membros da igreja." | Decisão do discovery pede o ícone; texto aprovado pelo dono. | sim |
| Import | Exige `VIDEIRA_ENABLE_IMPORT=true` e a permissão de importar; o segredo `VIDEIRA_IMPORT_ADMIN_SECRET` e a tela de desbloqueio deixam de existir | Cumpre a evolução prevista na AD-005. | não, default técnico |
| Rate limit | Página e aceite de convite: 10 tentativas com token inválido por IP a cada 15 minutos, excedido → `429` com `Retry-After`; estado em memória do processo | Mesmo padrão do desbloqueio do import. | não, default técnico |
| Auditoria | Tabela `AuthAuditLog` com `occurredAt`, `actorUserId`, `action`, `targetEmail` ou `targetUserId`, `details` sem token | Rastreia quem deu acesso a quem. | não, default técnico |
| LGPD | Guarda só nome, e-mail e URL da foto do Google | Mínimo para identificar a pessoa. | não, default técnico |

**Open questions:** none - all resolved or logged above.

---

## Matriz de permissões

Papéis se somam: o usuário pode tudo que qualquer um dos seus papéis permite. "Líder" vale só para os grupos em que ele está atribuído.

| Ação | Admin | Gestor | Líder de louvor | Músico |
| --- | --- | --- | --- | --- |
| Convidar, mudar papéis, desativar usuários | todos os papéis | todos exceto `admin` | não | não |
| Criar, renomear e arquivar grupos; definir membros e líderes | sim | sim | não | não |
| Criar, editar e excluir músicas e cifras; marcar "visível ao público" | sim | sim | sim | não |
| Importar cifras | sim | sim | sim | não |
| Setlists de grupo: criar, editar, mudar status, excluir, seguir, clonar | todos os grupos | todos os grupos | grupos que lidera | não |
| Setlists da igreja (sem grupo dono): criar, editar, clonar | sim | sim | não | não |
| Ler músicas e cifras da igreja, tocar setlists visíveis, preferências pessoais | sim | sim | sim | sim |

---

## User Stories

### P1: Entrar com Google ⭐ MVP

**User Story**: Como membro da igreja, quero entrar com minha conta Google, para não precisar de senha nova.

**Why P1**: Sem login, nenhuma outra regra de acesso funciona em produção.

**Acceptance Criteria**:

1. WHEN uma pessoa concluir o login do Google com e-mail verificado igual ao de um usuário ativo da igreja THEN o sistema SHALL criar uma sessão e redirecionar para `next` (se interno) ou para `/`. (AUTH-01)
2. IF o e-mail do Google não pertencer a nenhum usuário ativo e não houver convite em andamento THEN o sistema SHALL recusar o login, não criar usuário nem sessão e mostrar em `/entrar` a mensagem "Esta conta não tem acesso. Peça um convite ao administrador da igreja." (AUTH-02)
3. IF o Google devolver `email_verified` diferente de `true` THEN o sistema SHALL recusar o login sem criar sessão. (AUTH-03)
4. IF o usuário estiver desativado THEN o sistema SHALL recusar o login com a mesma mensagem da AUTH-02. (AUTH-04)
5. The system SHALL emitir o cookie de sessão com `HttpOnly`, `Secure`, `SameSite=Lax` e `Path=/`, expirando após 30 dias sem uso. (AUTH-05)
6. WHEN o usuário sair THEN o sistema SHALL invalidar a sessão no servidor e apagar o cookie. (AUTH-06)
7. The system SHALL obter o `Actor` de cada requisição só por `getCurrentActor()`, a partir da sessão; o usuário simulado SHALL continuar ignorado quando `NODE_ENV=production`. (AUTH-07)
8. IF `NODE_ENV=production` e faltar alguma variável de configuração do login THEN o sistema SHALL mostrar "Login indisponível" em `/entrar`, não criar sessões e registrar `AUTH_MISCONFIGURED` uma vez por processo. (AUTH-08)

**Independent Test**: Com um usuário ativo no banco, entrar com a conta Google dele cria sessão; entrar com outra conta é recusado com a mensagem da AUTH-02.

---

### P1: Convidar uma pessoa ⭐ MVP

**User Story**: Como admin ou gestor, quero gerar um link de convite com e-mail e papel, para dar acesso a alguém pelo WhatsApp.

**Why P1**: O convite é a única porta de entrada.

**Acceptance Criteria**:

1. WHEN um admin ou gestor criar um convite com e-mail válido, um ou mais papéis, zero ou mais grupos não arquivados da igreja e uma validade entre 1 hora e 30 dias THEN o sistema SHALL gravar o convite com essa validade e mostrar o link `/convite/{token}` com a data e a hora em que ele expira. (AUTH-09)
2. The system SHALL gerar o token com 32 bytes aleatórios e guardar só o hash SHA-256 dele. (AUTH-10)
3. IF um gestor tentar convidar com o papel `admin` THEN o sistema SHALL responder `403 FORBIDDEN` sem gravar o convite. (AUTH-11)
4. IF já existir usuário ativo com o e-mail na igreja THEN o sistema SHALL responder `409 USER_EXISTS` sem gravar o convite. (AUTH-12)
5. WHEN um convite for criado para um e-mail com convite pendente THEN o sistema SHALL revogar o convite anterior. (AUTH-13)
6. WHEN o convite for criado THEN o sistema SHALL oferecer "Copiar link" e "Compartilhar no WhatsApp", que abre `https://wa.me/?text=` com mensagem e link. (AUTH-14)
7. WHEN alguém abrir `/convite/{token}` válido THEN o sistema SHALL mostrar o e-mail convidado, os papéis, os grupos e o botão "Entrar com Google". (AUTH-15)
8. WHEN a pessoa concluir o login do Google a partir do convite com e-mail verificado igual ao convidado THEN o sistema SHALL criar o usuário com os papéis e grupos do convite, marcar o convite como usado e criar a sessão. (AUTH-16)
9. IF o e-mail do Google for diferente do convidado THEN o sistema SHALL recusar sem criar usuário, manter o convite pendente e mostrar "Este convite é para {e-mail}. Entre com essa conta Google." (AUTH-17)
10. IF o token estiver expirado, revogado, usado ou não existir THEN o sistema SHALL mostrar "Convite inválido ou expirado. Peça um novo ao administrador." sem revelar qual dos casos ocorreu. (AUTH-18)
11. WHEN um admin ou gestor abrir a lista de convites THEN o sistema SHALL mostrar os pendentes com e-mail, papéis, quem convidou e validade, e permitir revogar cada um. (AUTH-19)
12. IF o mesmo IP enviar mais de 10 tokens inválidos em 15 minutos THEN o sistema SHALL responder `429` com `Retry-After`. (AUTH-20)
13. IF a validade informada for menor que 1 hora ou maior que 30 dias THEN o sistema SHALL responder `400 INVALID_EXPIRY` sem gravar o convite. (AUTH-62)

**Independent Test**: O admin gera um convite para um e-mail; abrir o link e entrar com essa conta cria o usuário com os papéis escolhidos; o mesmo link depois mostra a mensagem da AUTH-18.

---

### P1: Papéis acumuláveis e liderança de grupo ⭐ MVP

**User Story**: Como admin, quero que uma pessoa possa ter vários papéis e que cada grupo tenha seus líderes, para refletir como a igreja funciona.

**Why P1**: A política de acesso depende desse modelo.

**Acceptance Criteria**:

1. The system SHALL guardar para cada usuário um conjunto não vazio de papéis entre `admin`, `manager`, `worship_leader` e `musician`. (AUTH-21)
2. The system SHALL permitir que um grupo tenha um ou mais líderes, todos com o papel `worship_leader`. (AUTH-22)
3. IF alguém tentar atribuir como líder de grupo um usuário sem `worship_leader` THEN o sistema SHALL responder `400 NOT_A_WORSHIP_LEADER`. (AUTH-23)
4. WHILE a igreja tiver exatamente um usuário ativo com `worship_leader` the system SHALL mantê-lo como líder de todos os grupos não arquivados, inclusive grupos criados depois. (AUTH-24)
5. WHEN um segundo usuário ganhar `worship_leader` THEN o sistema SHALL manter as atribuições de líder existentes sem alteração. (AUTH-25)
6. WHEN um grupo for criado com dois ou mais `worship_leader` ativos na igreja THEN o sistema SHALL criá-lo sem líder. (AUTH-26)
7. WHEN um usuário perder `worship_leader` ou for desativado THEN o sistema SHALL removê-lo da liderança de todos os grupos. (AUTH-27)
8. The system SHALL decidir toda ação de domínio por uma única política que aplica a Matriz de permissões a partir do `Actor`. (AUTH-28)

**Independent Test**: Uma tabela de testes da política percorre cada linha da matriz para cada papel isolado e para combinações (admin + líder, gestor + músico), comparando com a matriz.

---

### P1: Proteger páginas e APIs ⭐ MVP

**User Story**: Como dono do app, quero que nada além da página de letras funcione sem login, para que o repertório e as cifras fiquem só com a igreja.

**Why P1**: Hoje as rotas de músicas e cifras gravam sem checar ninguém.

**Acceptance Criteria**:

1. WHEN um anônimo abrir qualquer página além de `/`, `/entrar` e `/convite/{token}` THEN o sistema SHALL redirecionar para `/entrar?next={caminho}`. (AUTH-29)
2. IF `next` não começar com `/` ou começar com `//` THEN o sistema SHALL redirecionar para `/` depois do login. (AUTH-30)
3. WHEN um anônimo chamar qualquer rota de `/api` além das de login, convite e letras públicas THEN o sistema SHALL responder `401` com `{ "error": { "code": "UNAUTHENTICATED" } }`. (AUTH-31)
4. WHEN um usuário autenticado chamar uma rota sem permissão para a ação THEN o sistema SHALL responder `403` com `{ "error": { "code": "FORBIDDEN" } }`. (AUTH-32)
5. The system SHALL aplicar a política às rotas `/api/songs`, `/api/songs/{songId}`, `/api/songs/{songId}/charts`, `/api/charts`, `/api/charts/{chartId}`, `/api/song-charts` e `/api/migrations/local-data`. (AUTH-33)
6. The system SHALL negar a anônimos a leitura de qualquer setlist, inclusive com visibilidade `public`. (AUTH-34)

**Independent Test**: Sem sessão, `PUT /api/songs/{songId}` responde `401`; com sessão de músico, responde `403`; com sessão de líder, responde `2xx`.

---

### P1: Página pública de letras ⭐ MVP

**User Story**: Como visitante sem conta, quero ler as letras que a igreja liberou, para acompanhar o louvor.

**Why P1**: É a única experiência anônima e decide o que sai da igreja.

**Acceptance Criteria**:

1. WHEN um anônimo abrir `/` THEN o sistema SHALL listar só músicas com "visível ao público" ligado que tenham ao menos uma cifra em formato de letra, com o botão "Entrar". (AUTH-35)
2. WHEN um anônimo abrir uma letra pública THEN o sistema SHALL mostrar só o título, o artista, os rótulos das seções e o texto das linhas da cifra de letra atualizada mais recentemente. (AUTH-36)
3. The system SHALL montar a resposta pública no servidor sem acordes, tom, capo, andamento, compasso, notas, identificadores de cifra nem controles de transposição e exibição. (AUTH-37)
4. IF a música não estiver marcada como pública THEN o sistema SHALL responder `404` à leitura anônima dela. (AUTH-38)
5. WHERE a cifra exibida tiver `origin` de import THEN o sistema SHALL mostrar o selo "Importada" e o link para `originUrl`. (AUTH-39)
6. The system SHALL criar toda música com "visível ao público" desligado, salvo se marcado no cadastro ou no import. (AUTH-40)
7. WHEN quem pode editar músicas cadastrar, importar ou editar uma música THEN o sistema SHALL mostrar a opção "Visível ao público" com um ícone de informação que exibe o texto definido nas Assumptions. (AUTH-41)

**Independent Test**: Marcar uma música como pública e abrir `/` sem login mostra a letra sem nenhum acorde; o HTML e o payload da página não contêm nenhum acorde.

---

### P1: Primeiro admin ⭐ MVP

**User Story**: Como dono do app, quero entrar como admin no primeiro deploy, para poder convidar os outros.

**Why P1**: Sem isso, ninguém entra num banco vazio.

**Acceptance Criteria**:

1. WHILE a igreja não tiver nenhum usuário ativo com `admin`, WHEN alguém concluir o login do Google com e-mail verificado igual a `VIDEIRA_BOOTSTRAP_ADMIN_EMAIL` THEN o sistema SHALL criar esse usuário com o papel `admin` e a sessão. (AUTH-42)
2. WHILE a igreja tiver ao menos um admin ativo the system SHALL ignorar `VIDEIRA_BOOTSTRAP_ADMIN_EMAIL`. (AUTH-43)

**Independent Test**: Com o banco sem admin e a variável definida, o login com esse e-mail cria o admin; depois disso, apagar a variável não muda nada e outro e-mail continua recusado.

---

### P2: Gerenciar usuários

**User Story**: Como admin ou gestor, quero mudar papéis e desativar pessoas, para manter o acesso em dia.

**Why P2**: No começo dá para conviver só com convites, mas logo alguém sai do ministério.

**Acceptance Criteria**:

1. WHEN um admin ou gestor abrir a lista de usuários THEN o sistema SHALL mostrar nome, e-mail, papéis, grupos e situação (ativo ou desativado). (AUTH-44)
2. WHEN um admin ou gestor mudar os papéis de um usuário dentro do que pode conceder THEN o sistema SHALL gravar a mudança, que SHALL valer na próxima requisição desse usuário. (AUTH-45)
3. WHEN um admin ou gestor desativar um usuário THEN o sistema SHALL encerrar todas as sessões dele e manter o histórico. (AUTH-46)
4. IF a mudança deixar a igreja sem nenhum admin ativo THEN o sistema SHALL responder `409 LAST_ADMIN` sem gravar. (AUTH-47)
5. IF um gestor tentar mudar papéis ou desativar um usuário com `admin` THEN o sistema SHALL responder `403 FORBIDDEN`. (AUTH-48)

**Independent Test**: Desativar um músico com sessão aberta faz a próxima requisição dele responder `401`.

---

### P2: Import por permissão

**User Story**: Como líder de louvor, quero importar cifras com meu próprio login, sem segredo compartilhado.

**Why P2**: O import já funciona com o segredo; trocar o mecanismo pode vir logo depois do login.

**Acceptance Criteria**:

1. WHERE `VIDEIRA_ENABLE_IMPORT=true`, WHEN um usuário com permissão de importar abrir `/import` ou chamar as rotas de import THEN o sistema SHALL liberar o módulo sem tela de desbloqueio. (AUTH-49)
2. IF o usuário não tiver permissão de importar THEN o sistema SHALL responder `403 FORBIDDEN` nas rotas e mostrar "Sem permissão para importar" na página. (AUTH-50)
3. The system SHALL deixar de ler `VIDEIRA_IMPORT_ADMIN_SECRET` e remover `POST` e `DELETE /api/imports/session`. (AUTH-51)
4. WHEN o import gravar no `ImportLog` THEN o sistema SHALL incluir o `userId` de quem importou. (AUTH-52)

**Independent Test**: Com a flag ligada, um líder importa uma cifra sem segredo; um músico recebe `403`.

---

### P2: Auditoria de acesso

**User Story**: Como admin, quero saber quem deu acesso a quem, para investigar um acesso indevido.

**Why P2**: Útil, mas não bloqueia o uso inicial.

**Acceptance Criteria**:

1. WHEN um convite for criado, revogado ou aceito, ou um usuário mudar de papel, ganhar ou perder liderança de grupo, ou for desativado THEN o sistema SHALL gravar um registro em `AuthAuditLog`. (AUTH-53)
2. The system SHALL nunca gravar token, cookie ou dados do Google além de nome e e-mail na auditoria. (AUTH-54)

**Independent Test**: Criar e aceitar um convite gera dois registros, nenhum com o token.

---

### P3: Enviar convite por e-mail

**User Story**: Como admin, quero que o sistema envie o convite por e-mail, para não depender só do WhatsApp.

**Why P3**: Exige provedor de e-mail e configuração de domínio.

**Acceptance Criteria**:

1. WHERE um provedor de e-mail estiver configurado, WHEN o convite for criado com "Enviar por e-mail" marcado THEN o sistema SHALL enviar o link ao e-mail convidado. (AUTH-55)
2. IF o envio falhar THEN o sistema SHALL manter o convite válido e mostrar "Não foi possível enviar o e-mail. Copie o link e envie de outra forma." (AUTH-56)

**Independent Test**: Com um provedor de teste, criar o convite entrega um e-mail com o link.

---

## Edge Cases

- IF o convidado já tiver uma sessão aberta com outro usuário THEN o sistema SHALL encerrar essa sessão antes de iniciar o login do convite. (AUTH-57)
- IF dois aceites do mesmo convite chegarem ao mesmo tempo THEN o sistema SHALL criar um único usuário e recusar o segundo com a mensagem da AUTH-18. (AUTH-58)
- IF um grupo do convite for arquivado antes do aceite THEN o sistema SHALL criar o usuário sem esse grupo. (AUTH-59)
- WHEN o único `worship_leader` for desativado THEN o sistema SHALL deixar os grupos sem líder, editáveis só por admin e gestor. (AUTH-60)
- IF o Google falhar ou o usuário cancelar o login THEN o sistema SHALL voltar a `/entrar` com "Não foi possível entrar com o Google. Tente de novo." (AUTH-61)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| AUTH-01 | P1: Entrar com Google | Verify | Verified |
| AUTH-02 | P1: Entrar com Google | Verify | Verified |
| AUTH-03 | P1: Entrar com Google | Verify | Verified |
| AUTH-04 | P1: Entrar com Google | Verify | Verified |
| AUTH-05 | P1: Entrar com Google | Verify | Implemented |
| AUTH-06 | P1: Entrar com Google | Verify | Implemented |
| AUTH-07 | P1: Entrar com Google | Verify | Verified |
| AUTH-08 | P1: Entrar com Google | Verify | Implemented |
| AUTH-09 | P1: Convidar uma pessoa | Verify | Verified |
| AUTH-10 | P1: Convidar uma pessoa | Verify | Implemented |
| AUTH-11 | P1: Convidar uma pessoa | Verify | Verified |
| AUTH-12 | P1: Convidar uma pessoa | Verify | Verified |
| AUTH-13 | P1: Convidar uma pessoa | Verify | Implemented |
| AUTH-14 | P1: Convidar uma pessoa | Verify | Implemented |
| AUTH-15 | P1: Convidar uma pessoa | Verify | Verified |
| AUTH-16 | P1: Convidar uma pessoa | Verify | Verified |
| AUTH-17 | P1: Convidar uma pessoa | Verify | Implemented |
| AUTH-18 | P1: Convidar uma pessoa | Verify | Implemented |
| AUTH-19 | P1: Convidar uma pessoa | Verify | Implemented |
| AUTH-20 | P1: Convidar uma pessoa | Verify | Verified |
| AUTH-21 | P1: Papéis acumuláveis e liderança de grupo | Verify | Verified |
| AUTH-22 | P1: Papéis acumuláveis e liderança de grupo | Verify | Implemented |
| AUTH-23 | P1: Papéis acumuláveis e liderança de grupo | Verify | Verified |
| AUTH-24 | P1: Papéis acumuláveis e liderança de grupo | Verify | Implemented |
| AUTH-25 | P1: Papéis acumuláveis e liderança de grupo | Verify | Implemented |
| AUTH-26 | P1: Papéis acumuláveis e liderança de grupo | Verify | Implemented |
| AUTH-27 | P1: Papéis acumuláveis e liderança de grupo | Verify | Verified |
| AUTH-28 | P1: Papéis acumuláveis e liderança de grupo | Verify | Implemented |
| AUTH-29 | P1: Proteger páginas e APIs | Verify | Implemented |
| AUTH-30 | P1: Proteger páginas e APIs | Verify | Implemented |
| AUTH-31 | P1: Proteger páginas e APIs | Verify | Implemented |
| AUTH-32 | P1: Proteger páginas e APIs | Verify | Verified |
| AUTH-33 | P1: Proteger páginas e APIs | Verify | Implemented |
| AUTH-34 | P1: Proteger páginas e APIs | Verify | Verified |
| AUTH-35 | P1: Página pública de letras | Verify | Verified |
| AUTH-36 | P1: Página pública de letras | Verify | Verified |
| AUTH-37 | P1: Página pública de letras | Verify | Verified |
| AUTH-38 | P1: Página pública de letras | Verify | Verified |
| AUTH-39 | P1: Página pública de letras | Verify | Implemented |
| AUTH-40 | P1: Página pública de letras | Verify | Implemented |
| AUTH-41 | P1: Página pública de letras | Verify | Verified |
| AUTH-42 | P1: Primeiro admin | Verify | Verified |
| AUTH-43 | P1: Primeiro admin | Verify | Implemented |
| AUTH-44 | P2: Gerenciar usuários | Verify | Implemented |
| AUTH-45 | P2: Gerenciar usuários | Verify | Verified |
| AUTH-46 | P2: Gerenciar usuários | Verify | Implemented |
| AUTH-47 | P2: Gerenciar usuários | Verify | Verified |
| AUTH-48 | P2: Gerenciar usuários | Verify | Verified |
| AUTH-49 | P2: Import por permissão | Verify | Verified |
| AUTH-50 | P2: Import por permissão | Verify | Verified |
| AUTH-51 | P2: Import por permissão | Verify | Verified |
| AUTH-52 | P2: Import por permissão | Verify | Verified |
| AUTH-53 | P2: Auditoria de acesso | Verify | Partial |
| AUTH-54 | P2: Auditoria de acesso | Verify | Verified |
| AUTH-55 | P3: Enviar convite por e-mail | Verify | Deferred |
| AUTH-56 | P3: Enviar convite por e-mail | Verify | Deferred |
| AUTH-57 | Edge Cases | Verify | Implemented |
| AUTH-58 | Edge Cases | Verify | Implemented |
| AUTH-59 | Edge Cases | Verify | Implemented |
| AUTH-60 | Edge Cases | Verify | Implemented |
| AUTH-61 | Edge Cases | Verify | Implemented |
| AUTH-62 | P1: Convidar uma pessoa | Verify | Verified |

**Coverage:** 62 total — ver `.specs/features/auth/validation.md` (Verifier 2026-10-15: **FAIL**)

---

## Success Criteria

- [ ] Do convite gerado ao primeiro acesso do convidado em menos de 2 minutos.
- [ ] Zero rotas de `/api` que gravam dados respondendo `2xx` sem sessão.
- [ ] Zero acordes na resposta da página pública de letras.
