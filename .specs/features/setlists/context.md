# Setlists (fase 1) - Contexto

**Gathered:** 2026-10-14
**Spec:** `.specs/features/setlists/spec.md`
**Status:** Approved for implementation (spec, design and tasks approved by the user on 2026-10-14)

---

## Feature Boundary

A fase 1 entrega o setlist dentro de uma igreja: setlists de grupo de louvor e da igreja, itens de música (cifra e tom fixados) e de anotação, status `draft`/`published`/`archived`, leitura sequencial, seguir (só leitura) e clonar (cópia sem vínculo) entre grupos, gestão de grupos em `/groups` e uma política única `canPerform`. A cópia de catálogo entre igrejas existe só no serviço de clone, coberta por testes. Login real, setlist pessoal, sugestões, públicos entre igrejas na UI e gestão de membros ficam para a fase 2.

---

## Implementation Decisions

### Propriedade e reaproveitamento (decidido pelo usuário)

- A igreja tem um ou mais grupos de louvor (`WorshipTeam`). O setlist pertence a um grupo ou à igreja (setlist global); o dono usuário entra na fase 2.
- Um grupo pode **seguir** um setlist de outro grupo ou da igreja: só leitura, sempre a versão atual, sem editar nem colaborar.
- Um grupo pode **clonar**: cópia editável, sem nenhuma referência à origem.
- Clonar entre igrejas copia músicas e cifras para o catálogo de destino, reaproveitando cifras pelo `originUrl` e marcando a fonte (`sourceOrganizationId`).
- Quando o original é apagado ou restringido, quem segue perde o acesso e vê "indisponível"; nada é copiado automaticamente. O dono recebe antes um aviso com o número de grupos seguidores.
- O setlist arquivado continua legível para quem segue (default aceito).

### Repertório e itens (decidido pelo usuário)

- O setlist é um repertório: título obrigatório, data e tipo opcionais, estados rascunho, publicado e arquivado.
- O item é `song` (cifra obrigatória, escolhida sozinha quando há só uma, e tom que começa no tom da cifra) ou `note` (texto livre, como "Oração" ou "Ofertório").
- O tom do item é a base; a preferência local de transposição do músico (`lib/songs/transpose-preference.ts`, escopo `setlist-item`) continua tendo precedência, como já funciona em `app/songs/[songId]/song-detail.tsx`.

### Distribuição de cifras importadas (AD-006, decidido pelo usuário)

- A AD-003 é substituída: cifra importada pode sair da igreja, só para leitura, dentro de um setlist público, com selo "Importada" e link para `originUrl`.
- Seed e fixtures de teste continuam sintéticos.
- Não há API aberta, exportação nem catálogo navegável de cifras importadas para outras igrejas.

### Identidade e acesso

- A identidade vem de `getCurrentActor()` (`lib/auth/current-actor.ts`) com o usuário simulado em `VIDEIRA_SIMULATED_USER_ID`, nunca aceito em produção. A troca para login real muda só essa função.
- Toda checagem passa por `canPerform(actor, action, target)` (decidido pelo usuário: "foco em migrar em breve para autenticação e autorização").
- As escritas checam o papel no `Actor` (admin da igreja ou líder do grupo), não a sessão de admin do import, que fica só para o import (confirmado pelo usuário).

### Rotas (decidido pelo usuário)

- Toda a seção de setlist fica em `/setlists`: lista com seletor e abas, `new`, `[setlistId]`, `[setlistId]/edit` e `[setlistId]/play`.
- O grupo atual fica na URL (`?team=<slug>`).
- Os grupos têm rota própria, `/groups`, fora de `/setlists`, porque o grupo é um conceito da igreja que vai além do setlist.

### Testes (lições candidatas L-003, L-004 e L-006)

- As rotas são testadas pelo handler exportado, com o usuário simulado vindo de `process.env` real, não só por um predicado injetado.
- O conflito de `version` tem um teste que executa duas escritas em sequência com o mesmo `expectedVersion` e confere que os itens da primeira sobrevivem.

### Agent's Discretion

- Formato interno do repositório (Prisma com uma implementação em memória e suíte de contrato, no padrão de `MusicRepository`).
- Componentes de UI das abas, do editor e do reordenamento (botões subir e descer ou arrastar), dentro do design system existente.
- Como a página de detalhe da música recebe os vizinhos "Anterior" e "Próxima" (SET-12), desde que reaproveite `setlist-song-context`.

### Declined / Undiscussed Gray Areas → Assumptions

Registrados na tabela de Assumptions da spec com `não, default técnico`:

- Regras de leitura por visibilidade (`private`, `team`, `organization`, anônimo).
- Transições de status, sem volta para `draft`, e exclusão lógica.
- Conteúdo do clone (rascunho, sem data, mesma ordem).
- Fallback do `?team=`, limites de entrada, `eventType` e validação do tom.
- Slug do grupo imutável e arquivamento de grupo.

---

## Specific References

- Identidade: `prisma/schema.prisma` (`User`, `WorshipTeam`, `WorshipTeamMember`), `lib/auth/actor.ts`, `lib/auth/load-actor.ts`, `lib/auth/simulated-identities.ts`.
- Contexto da cifra no setlist: `lib/songs/setlist-song-context.ts` (`buildSetlistSongHref`, `parseSetlistSongContext`).
- Padrão de rotas e erros: `lib/persistence/persistence-route-deps.ts`, `lib/persistence/persistence-api.ts`.
- Padrão de repositório e contrato: `lib/persistence/music-repository.ts`, `lib/persistence/music-repository.contract.test.ts`.
- Placeholder atual: `app/setlists/page.tsx`; link no header em `app/layout.tsx`.
- Tipos antigos a substituir: `Setlist` e `SetlistItem` em `types/music.ts`.

---

## Dependencies

- O detalhe da música (`app/songs/[songId]/song-detail.tsx`) tem mudanças não commitadas do usuário e 5 testes falhando em `song-detail.test.tsx`. A task de SET-12 ("Anterior" e "Próxima") só começa depois que esse trabalho estiver commitado e verde.

---

## Deferred Ideas

- Login real e contas; gestão de membros dos grupos.
- Setlist pessoal com limites definidos pelo admin.
- Sugestão de músicas com dupla aprovação (cifra no catálogo e música no setlist).
- `/setlists/public` com seguir e clonar entre igrejas; `/setlists/[id]/access`; `/setlists/settings`.
- Escala de músicos por evento (repertório e evento separados).
- Aviso de "origem atualizada" ao clone (exigiria guardar a origem, o que hoje foi recusado).
- Bloqueio de exclusão de cifra em uso, quando o catálogo ganhar exclusão.
- Setlist offline.
