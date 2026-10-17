# Project State

## Decisions

### AD-001: Persistência local por repositórios

- **Status:** superseded by AD-004
- **Decision:** Músicas e cifras criadas pelo usuário serão persistidas no navegador por adaptadores que implementam contratos de repositório.
- **Rationale:** O MVP precisa sobreviver a reload sem acoplar domínio e UI ao mecanismo de storage.

### AD-002: Adaptador Cifra Club no servidor Next local

- **Status:** active
- **Decision:** O Playwright rodará em um Route Handler Node.js do próprio Next, protegido por `VIDEIRA_ENABLE_CIFRACLUB_IMPORT` (renomeada para `VIDEIRA_ENABLE_IMPORT` pela AD-005).
- **Rationale:** O spike validou Chromium headed local e ainda não existe necessidade de um backend separado.

### AD-003: (inativo)(desconsidere)

- **Status:** superseded by AD-006
- **Decision:** Testes de importação usarão HTML e letras sintéticas; cifras importadas serão gravadas no seed e versionadas.
- **Rationale:** Preserva os guardrails de direito autoral

### AD-004: SQLite via Prisma como fonte da verdade no servidor

- **Status:** active
- **Decision:** Músicas e cifras passam a ser persistidas num SQLite no servidor, via Prisma, atrás do contrato `MusicRepository`, com esquema multi-tenant (`organizationId`) e regras de portabilidade para migrar depois ao Postgres no Supabase; o IndexedDB é lido uma única vez para migração. Substitui a AD-001.
- **Rationale:** O produto precisa compartilhar cifras entre dispositivos e, depois, entre igrejas; o SQLite começa sem infraestrutura extra e o Prisma permite trocar o provider sem reescrever o domínio.
- **Trade-off:** Perde o uso offline e exige deploy com disco persistente (container/VPS ou Turso); serverless com FS efêmero deixa de ser opção.
- **Scope:** `server-persistence` e toda feature que leia ou grave músicas, cifras ou futuros setlists.
- **Date:** 2026-10-14

### AD-005: Import liberado por flag de ambiente e segredo de admin

- **Status:** active
- **Decision:** Até existir autenticação, o módulo de import (página `/import`, preview por URL e salvamento de cifras importadas) exige `VIDEIRA_ENABLE_IMPORT=true` **e** uma sessão de admin obtida com um único segredo (`VIDEIRA_IMPORT_ADMIN_SECRET`). Evolui a AD-002, que só exigia a flag. A flag é renomeada de `VIDEIRA_ENABLE_CIFRACLUB_IMPORT` para `VIDEIRA_ENABLE_IMPORT`; o nome antigo deixa de ser lido e é ignorado (só o nome antigo definido → import desligado, `404`).
- **Rationale:** Com a persistência no servidor, o import deixa de ser só local e precisa de uma barreira antes de qualquer deploy público, sem esperar pela autenticação completa.
- **Trade-off:** Um segredo compartilhado não identifica quem importou; quando houver autenticação, a mesma política passa a checar uma permissão do usuário.
- **Scope:** `import-access`, `app/api/imports/cifraclub`, rotas de escrita usadas pelo import.
- **Supersedes:** IMA-01 substitui IMP-09 da `chart-import`: com a flag desligada, a página `/import` inteira responde `404`, em vez de só ocultar a entrada por URL.
- **Date:** 2026-10-14

### AD-006: Distribuição isolada de cifras importadas

- **Status:** active
- **Decision:** Cifras importadas podem sair da igreja dona apenas para leitura, dentro de um setlist com visibilidade `public`, sempre com o selo "Importada" e o link para `originUrl`. Não há API aberta, exportação nem catálogo navegável de cifras importadas para outras igrejas. Seed e fixtures de teste continuam sintéticos.
- **Rationale:** O usuário aceitou o scraping e a distribuição de forma isolada; limitar a saída ao setlist público mantém o alcance controlado e a fonte visível.
- **Scope:** `setlists` e toda feature que exponha cifras para fora da igreja.
- **Supersedes:** AD-003.
- **Date:** 2026-10-14

### AD-007: Identidade por `Actor` e política única de acesso

- **Status:** active
- **Decision:** Toda requisição obtém quem age só por `getCurrentActor()` (`lib/auth/current-actor.ts`), e toda decisão de acesso de domínio passa por uma função de política única do módulo (`canPerform` nos setlists). Até existir login, o `Actor` vem do usuário simulado em `VIDEIRA_SIMULATED_USER_ID`, que nunca é aceito em produção. A sessão de admin da AD-005 continua exclusiva do import.
- **Rationale:** Trocar a autenticação simulada pela real muda só `getCurrentActor()`, sem tocar em rotas nem regras.
- **Scope:** `setlists`, grupos de louvor e toda feature nova com regra de acesso.
- **Date:** 2026-10-14

### AD-008: Modelo de propriedade e compartilhamento de setlists

- **Status:** active
- **Decision:** O setlist pertence a um grupo de louvor (`WorshipTeam`) ou à igreja (setlist global); o dono usuário é reservado para a fase 2. A visibilidade é `private`, `team`, `organization` ou `public`. Reaproveitar um setlist alheio é **seguir** (referência só de leitura à versão atual) ou **clonar** (cópia editável sem vínculo com a origem); clonar entre igrejas copia músicas e cifras para o catálogo de destino, reaproveitando cifras pelo `originUrl`.
- **Rationale:** Cada banda adapta tom e ordem ao seu vocal (clone), enquanto um repertório oficial pode ser acompanhado sem cópia (seguir); copiar o catálogo no clone evita acoplamento entre igrejas.
- **Scope:** `setlists` e fases seguintes (setlist pessoal, públicos entre igrejas).
- **Date:** 2026-10-14

### AD-009: Login Google só por convite, com papéis acumuláveis

- **Status:** superseded by AD-012
- **Decision:** O único login é Google, e só entra quem tem usuário ativo ou convite válido gerado por admin ou gestor; o convite só é aceito pela conta Google com o mesmo e-mail. O usuário tem um conjunto de papéis da igreja (`admin`, `manager`, `worship_leader`, `musician`); a liderança de grupo exige `worship_leader` e uma atribuição ao grupo, com um ou mais líderes por grupo. Com um único líder de louvor na igreja, ele lidera todos os grupos. O admin é da igreja. Quando o import passar a checar permissão (AUTH-49 a AUTH-51), a AD-005 fica superada.
- **Rationale:** O app vai para produção com dados da igreja; um link vazado não pode dar acesso a outra conta.
- **Scope:** `auth` e toda feature com regra de acesso; evolui a AD-007 sem mudar o ponto único `getCurrentActor()`.
- **Date:** 2026-10-15

### AD-010: Letras públicas sem acordes para anônimos

- **Status:** active
- **Narrowed by:** AD-016
- **Decision:** Anônimo só acessa a página de letras: músicas marcadas como "visível ao público" (desligado por padrão, editável no cadastro, import e edição), com o texto montado no servidor sem acordes. Anônimo deixa de ler setlists, inclusive `public`. Amplia a AD-006: uma cifra importada pode expor só a letra ao público, com o selo "Importada" e o link da fonte.
- **Rationale:** Visitantes acompanham o louvor sem acesso às cifras, e a igreja decide música a música o que sai.
- **Scope:** `auth`, `setlists` (leitura anônima), import e cadastro de músicas.
- **Date:** 2026-10-15

### AD-011: Better Auth com identidade separada do membro da igreja

- **Status:** active
- **Decision:** Login e sessões usam Better Auth com Prisma/SQLite. A identidade Google fica nas tabelas `AuthUser`, `AuthSession`, `AuthAccount` e `AuthVerification`, separadas do `User` da igreja (papéis e grupos), ligadas por `User.authUserId`. Toda regra de entrada roda no callback do Google; toda regra de ação continua em `getCurrentActor()` e na política única.
- **Rationale:** Auth.js v5 segue em beta e em modo manutenção; separar identidade de membro não mistura o schema da biblioteca com o domínio e permite, depois, uma conta em várias igrejas.
- **Scope:** `auth` e toda feature que lide com usuários ou sessão.
- **Date:** 2026-10-15

### AD-012: Catálogo de papéis e pedido de acesso na recusa do Google

- **Status:** active
- **Narrowed by:** AD-014 (aprovar pedido, trocar papel, desativar e o catálogo deixam de ser do gestor)
- **Decision:** Os papéis da igreja formam um catálogo. `admin`, `manager`, `worship_leader` e `musician` continuam papéis de sistema, com capacidades fixas no código. O admin pode criar papéis personalizados com um subconjunto fechado de capacidades. A liderança de grupo exige a capacidade `setlists:led` e uma atribuição ao grupo. O líder único automático continua só para o papel de sistema `worship_leader`. Além do convite, um pedido gravado na recusa do Google cria o membro ativo quando um ator com `user.manage` libera. O login seguinte liga a conta Google. Entrada e ação continuam em `validateUserInfo` e em `getCurrentActor()`.
- **Rationale:** A igreja precisa de papéis novos sem um editor livre de permissões, e precisa liberar quem já tentou entrar com o e-mail verificado.
- **Trade-off:** Um papel personalizado não herda as regras especiais do admin nem do líder único. Quem só tem `setlists:led` não lidera todos os grupos.
- **Scope:** `admin-access` e toda feature que conceda papel, convide ou decida acesso.
- **Supersedes:** AD-009.
- **Date:** 2026-10-15

### AD-013: Correção de cifra não é importação nova

- **Status:** active
- **Narrowed by:** AD-015
- **Decision:** Atualizar uma cifra já gravada, mantendo a mesma `originUrl` canônica, exige só `music:write`. Criar uma cifra com `origin`, ou trocar a `originUrl`, continua no gate de import: flag ligada e capacidade `import`. A correção não grava `ImportLog`.
- **Rationale:** Editar música e importar já são capacidades diferentes. Corrigir letra e acordes não busca fonte nova e não pode depender da flag de import.
- **Trade-off:** Quem tem `music:write` altera o texto de uma cifra importada. O selo e o link da fonte permanecem. Tirar ou trocar a origem continua uma ação de import.
- **Scope:** `chart-edit` e toda escrita de `ChordChart` que carregue `origin`.
- **Date:** 2026-10-16

### AD-014: Área de usuário e catálogo só no preset admin

- **Status:** active
- **Decision:** `user.manage` e `role.manage` existem só no preset do papel de sistema `admin`. Aprovar ou recusar pedido de acesso, trocar papel e desativar membro exigem `user.manage`. Criar, editar e apagar papéis exigem `role.manage`. O gestor mantém convite (`users:invite`), lista de membros (`member.manage`) e grupos (`teams:manage`).
- **Rationale:** O discovery confirmado tira do gestor a área de usuário. A escalada deixa de ser "ter todas as capacidades" e passa a ser "ter uma capacidade exclusiva do admin".
- **Trade-off:** O gestor não libera mais quem pediu acesso na recusa do Google. Quem pede espera um admin.
- **Scope:** `permission-foundation`, `admin-access` e toda feature que conceda papel ou decida acesso.
- **Narrows:** AD-012.
- **Date:** 2026-10-16

### AD-015: Autor edita o conteúdo que criou

- **Status:** active
- **Decision:** Quem criou uma música, cifra ou setlist edita o conteúdo desse recurso na mesma igreja, mesmo sem `music:write` ou sem `setlists:led` / `setlists:all`. Não exclui, não importa, não muda visibilidade, status nem dono. Linha sem `createdByUserId` não ganha esse direito. Trocar `origin` ou `originUrl` continua no gate de import.
- **Rationale:** Um líder rebaixado a músico ainda corrige o que ele mesmo gravou. A capacidade segue sendo a regra para o que é dos outros.
- **Trade-off:** A autoria vira uma segunda chave de escrita. Todo `PUT` de conteúdo precisa consultar `createdByUserId`, não só a capacidade.
- **Scope:** `deferred-scope` e toda escrita de música, cifra ou setlist.
- **Narrows:** AD-013.
- **Date:** 2026-10-16

### AD-016: Link opaco de setlist só com letras

- **Status:** active
- **Decision:** Um setlist `published` pode ter um link com token opaco. Quem abre o link, sem login, vê as letras na ordem do setlist, sem acordes. Cifra importada leva o selo "Importada" e o link da fonte. `visibility=public` continua valendo só para usuário logado de outra igreja. Rota de setlist sem token continua fechada para anônimo.
- **Rationale:** A congregação acompanha o culto por um link, sem abrir a cifra e sem transformar o setlist `public` numa página anônima.
- **Trade-off:** A igreja publica a letra das músicas daquele setlist mesmo com `publicLyrics` desligado. O token é o ato de publicar.
- **Scope:** `deferred-scope` e qualquer leitura anônima de setlist.
- **Narrows:** AD-010.
- **Date:** 2026-10-16

### AD-017: Marca entra por variável CSS, status não é marca

- **Status:** active
- **Decision:** Cores de marca entram por um objeto TypeScript aplicado como `--brand-*` no `<html>`. No tema claro, `--color-primary` e `--color-chord` apontam para essas variáveis. No tema escuro, primário e acorde permanecem literais até existir preferência de tema. Status (`danger`, `warning`, `success`) é token de produto, não de marca. Whitelabel futuro troca o objeto no layout. `Organization` não ganha coluna de marca nesta etapa.
- **Rationale:** A spec `design-foundation` exige `brandStyle` e o style no `<html>`. Classe CSS só, ou contexto React com cor em JavaScript, não atendem DS-02, DS-03 e DS-08.
- **Trade-off:** O tema escuro não acompanha outra igreja. Um segundo tenant no escuro ainda veria o verde escuro da Videira.
- **Scope:** `design-foundation` e qualquer feature futura de tema ou whitelabel.
- **Date:** 2026-10-17

## Handoff

- **Feature em execução:** nenhuma (aguardando próxima spec).
- **Completed (recente):** `permission-foundation` T1–T35 — verificação PASS em `validation.md`; 814 testes.
- **Próximo passo:** escolher próxima feature (ex.: `deferred-scope`) ou merge/deploy conforme prioridade.
- **Bloqueio:** nenhum.
- **Branch:** `main`
