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

- **Status:** active
- **Decision:** O único login é Google, e só entra quem tem usuário ativo ou convite válido gerado por admin ou gestor; o convite só é aceito pela conta Google com o mesmo e-mail. O usuário tem um conjunto de papéis da igreja (`admin`, `manager`, `worship_leader`, `musician`); a liderança de grupo exige `worship_leader` e uma atribuição ao grupo, com um ou mais líderes por grupo. Com um único líder de louvor na igreja, ele lidera todos os grupos. O admin é da igreja. Quando o import passar a checar permissão (AUTH-49 a AUTH-51), a AD-005 fica superada.
- **Rationale:** O app vai para produção com dados da igreja; um link vazado não pode dar acesso a outra conta.
- **Scope:** `auth` e toda feature com regra de acesso; evolui a AD-007 sem mudar o ponto único `getCurrentActor()`.
- **Date:** 2026-10-15

### AD-010: Letras públicas sem acordes para anônimos

- **Status:** active
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

## Handoff

- **Feature em execução:** `auth` (`.specs/features/auth/`): spec fechado; `validation.md` **PARTIAL**. Import por permissão (AUTH-49..52) fechado; rotas invites/members testadas; OAuth em `access-gate.test.ts`. Aberto: rate limit convite (AUTH-20), auditoria (T17), Verifier PASS final.
- **Features ativas:** `import-access` (`.specs/features/import-access/`): implementada, verificação **PARTIAL** (`validation.md`).
- **Completed:** `server-persistence` implementada e mergeada (PR #1); `chart-import` verificada (PASS 2026-10-09).
- **Próximo passo:** fechar G1-G3 de `import-access/tasks.md` (testes do gate de cifra, `ImportLog` e rota de sessão); depois auditar os testes faltantes da `server-persistence` (rotas, repositório Prisma, HttpMusicRepository, migração, PER-15).
- **Restrição de deploy:** não publicar enquanto G1-G3 estiverem abertas.
- **Bloqueio:** nenhum.
- **Branch:** `main`
