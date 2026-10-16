# Requisitos: Papéis e Permissões de Acesso

> **Status:** Discovery / Rascunho
> **Data:** 16/10/2026
> **Objetivo:** redefinir a distribuição de permissões por papel e garantir que o sistema obedeça à cadeia de permissões.

---

## 1. Contexto e problema

Hoje existe uma cadeia de permissões configurável (tela **Novo papel**, com capacidades marcáveis), mas **o sistema não obedece** a ela de forma consistente.

### Causas prováveis a investigar

| # | Hipótese | Como verificar |
|---|----------|----------------|
| H1 | Permissão validada só no front-end (botão escondido, mas API aceita) | Chamar endpoints diretamente com usuário Músico |
| H2 | Código checa o **nome do papel** (`role === "lider"`) em vez da **capacidade** | Buscar comparações de papel no código |
| H3 | Regras espalhadas em vários lugares (várias fontes de verdade) | Mapear todos os pontos de checagem |
| H4 | Papel/capacidades em cache no token ou na sessão | Mudar papel de um usuário logado e testar |
| H5 | Ausência de "negar por padrão" | Testar endpoint sem capacidade mapeada |
| H6 | Capacidades contextuais ("grupos que lidera") sem checagem do vínculo com o grupo | Líder do grupo A tentar editar setlist do grupo B |

---

## 2. Princípios

1. **Negar por padrão:** o que não foi explicitamente permitido é bloqueado.
2. **Back-end é a autoridade:** toda ação é validada na API. O front-end apenas esconde o que o usuário não pode fazer.
3. **Checar capacidade, nunca o nome do papel:** o papel é só um pacote de capacidades.
4. **Fonte única de verdade:** uma função central, por exemplo `can(user, capability, resource?)`, usada por front e back.
5. **Menor privilégio:** cada papel recebe apenas o necessário para sua função.
6. **Rastreabilidade:** ações sensíveis geram registro de auditoria.

---

## 3. Papéis

| Papel | Quem é | Foco |
|-------|--------|------|
| **Músico** | Integrante de um ministério/grupo | Consultar setlists, grupos e biblioteca |
| **Líder** | Líder de um ministério/grupo de louvor | Montar setlists e manter cifras dos seus grupos |
| **Gestor** | Liderança da igreja | Visão de todos os grupos, pessoas e conteúdo |
| **Técnico** | Responsável pela saúde do sistema e suporte | Tudo do Gestor + logs + suporte a usuários |
| **Admin** | Responsável pela conta da organização | Acesso total, incluindo papéis, usuários e cobrança |

> Os papéis **não formam uma hierarquia de autoridade na igreja**. O Técnico tem mais acesso que o Gestor no sistema, mas isso não o coloca "acima" dele na organização.

### Papéis de sistema
Músico, Líder, Gestor, Técnico e Admin vêm pré-criados. O Admin pode criar papéis personalizados a partir das mesmas capacidades.

---

## 4. Capacidades

### 4.1 Base (todos os usuários logados, sem checkbox)

| ID | Capacidade |
|----|-----------|
| `setlist.view` | Ver setlists dos grupos dos quais participa |
| `group.view` | Ver grupos dos quais participa |
| `library.view` | Ver biblioteca de músicas |

### 4.2 Biblioteca

| ID | Capacidade | Observação |
|----|-----------|------------|
| `song.edit` | Editar músicas | Cifra, tom, letra, metadados |
| `song.import` | Importar | Depende de `song.edit` |
| `song.delete` | Excluir músicas | Exclusão lógica (lixeira) |

### 4.3 Setlists

| ID | Capacidade | Observação |
|----|-----------|------------|
| `setlist.manage.own` | Criar e editar setlists dos grupos que lidera | Contextual: exige vínculo de líder com o grupo |
| `setlist.manage.all` | Criar e editar setlists de todos os grupos | Inclui `setlist.manage.own` |

### 4.4 Grupos e pessoas

| ID | Capacidade | Observação |
|----|-----------|------------|
| `member.invite` | Convidar | |
| `member.manage` | Gerenciar membros | Inclui `member.invite` |
| `group.manage` | Gerenciar grupos | Criar, editar, arquivar grupos |

### 4.5 Administração

| ID | Capacidade | Observação |
|----|-----------|------------|
| `audit.view` | Ver log de auditoria | Quem fez o quê e quando |
| `logs.view` | Ver logs técnicos | Erros, importações, integrações, acessos negados |
| `user.support` | Suporte a usuários | Ver seção 7 |
| `user.manage` | Acessar área de usuário | Criar, excluir, alterar papel de usuários |
| `role.manage` | Gerenciar papéis | Exclusivo do Admin |
| `org.settings` | Configurações da organização e cobrança | Exclusivo do Admin |

---

## 5. Matriz papel × capacidade

| Capacidade | Músico | Líder | Gestor | Técnico | Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| Base: ver setlists, grupos, biblioteca | ✅ | ✅ | ✅ | ✅ | ✅ |
| `song.edit` Editar músicas | ❌ | ✅ | ✅ | ✅ | ✅ |
| `song.import` Importar | ❌ | ✅ | ✅ | ✅ | ✅ |
| `song.delete` Excluir músicas | ❌ | ❌ | ✅ | ✅ | ✅ |
| `setlist.manage.own` Setlists dos grupos que lidera | ❌ | ✅ | ✅ | ✅ | ✅ |
| `setlist.manage.all` Setlists de todos os grupos | ❌ | ❌ | ✅ | ✅ | ✅ |
| `member.invite` Convidar | ❌ | ❌ | ✅ | ✅ | ✅ |
| `member.manage` Gerenciar membros | ❌ | ❌ | ✅ | ✅ | ✅ |
| `group.manage` Gerenciar grupos | ❌ | ❌ | ✅ | ✅ | ✅ |
| `audit.view` Ver log de auditoria | ❌ | ❌ | ⚪ | ✅ | ✅ |
| `logs.view` Ver logs técnicos | ❌ | ❌ | ❌ | ✅ | ✅ |
| `user.support` Suporte a usuários | ❌ | ❌ | ❌ | ✅ | ✅ |
| `user.manage` Área de usuário | ❌ | ❌ | ❌ | ❌ | ✅ |
| `role.manage` Gerenciar papéis | ❌ | ❌ | ❌ | ❌ | ✅ |
| `org.settings` Configurações e cobrança | ❌ | ❌ | ❌ | ❌ | ✅ |

⚪ = a decidir (ver seção 12).

---

## 6. Regras de negócio

### 6.1 Dependências entre capacidades
- **RN-01:** Marcar `song.import` marca automaticamente `song.edit`.
- **RN-02:** Marcar `member.manage` marca automaticamente `member.invite`.
- **RN-03:** Marcar `setlist.manage.all` cobre `setlist.manage.own`.
- **RN-04:** Desmarcar uma capacidade da qual outra depende desmarca a dependente (com aviso na tela).

### 6.2 Papéis protegidos
- **RN-05:** O papel Admin não pode ter capacidades removidas nem ser excluído.
- **RN-06:** O último usuário Admin não pode ser rebaixado, desativado ou excluído.
- **RN-07:** `role.manage` e `org.settings` só podem ser atribuídas ao Admin (evita escalada de privilégio).
- **RN-08:** Um papel em uso não pode ser excluído sem migrar seus usuários para outro papel.

### 6.3 Capacidades contextuais
- **RN-09:** `setlist.manage.own` só vale para grupos em que o usuário está vinculado como **líder daquele grupo**. O back-end valida o vínculo, não apenas a capacidade.
- **RN-10:** Músicos veem apenas setlists e grupos dos quais participam.

### 6.4 Sessão e atualização
- **RN-11:** Ao alterar o papel ou as capacidades de um papel, as sessões afetadas são atualizadas ou invalidadas imediatamente (sem esperar expirar o token).

---

## 7. Suporte a usuários (`user.support`)

Capacidade para quem presta suporte (papel Técnico) resolver problemas de acesso **sem poder alterar permissões**.

### 7.1 O que permite

| Ação | Descrição |
|------|-----------|
| Buscar usuário | Por nome ou e-mail, com dados básicos (nome, e-mail parcialmente mascarado, papel, grupos, status) |
| Enviar reset de senha | Dispara o e-mail de redefinição. **O técnico nunca define nem vê a senha** |
| Reenviar convite | Reenvia convite pendente ou expirado, mantendo o papel original |
| Cancelar convite | Invalida um convite pendente |
| Desbloquear conta | Remove bloqueio por tentativas de login |
| Encerrar sessões | Desconecta o usuário de todos os dispositivos |
| Ver histórico de acesso | Últimos logins e acessos negados daquele usuário |

### 7.2 O que NÃO permite
- Alterar papel ou capacidades de qualquer usuário.
- Criar ou excluir usuários.
- Alterar e-mail de login.
- Ver ou definir senha.
- Agir sobre usuários **Admin** (somente outro Admin pode).
- Agir sobre a **própria conta** pelo painel de suporte.

### 7.3 Regras
- **RN-12:** Toda ação de suporte gera registro de auditoria com autor, alvo, ação, data/hora e motivo.
- **RN-13:** Ações de suporte exigem preenchimento de **motivo** (texto curto ou lista pré-definida).
- **RN-14:** O usuário afetado recebe notificação por e-mail quando houver reset de senha, encerramento de sessões ou desbloqueio.

---

## 8. Logs

### 8.1 Log de auditoria (`audit.view`)
Registra ações de negócio:
- Criação, edição e exclusão de músicas e setlists
- Importação de cifras
- Alterações em grupos e membros
- Alterações de papéis e capacidades
- Ações de suporte a usuários

Campos mínimos: data/hora, autor, ação, recurso, valor anterior → novo (quando aplicável), origem (IP/dispositivo).

### 8.2 Logs técnicos (`logs.view`)
- Erros da aplicação
- Falhas de importação de cifra
- Falhas de integrações externas
- **Tentativas de acesso negadas** (capacidade exigida × capacidade do usuário). Essencial para diagnosticar o problema atual.

### 8.3 Regras
- **RN-15:** Logs são somente leitura. Ninguém, nem o Admin, edita ou apaga registros.
- **RN-16:** Dados sensíveis (e-mail, telefone, tokens, senhas) são mascarados nos logs técnicos.
- **RN-17:** Retenção definida (sugestão: 90 dias para logs técnicos, 1 ano para auditoria).

---

## 9. Experiência do usuário

- **UX-01:** Ações sem permissão **não aparecem** (botões de editar, importar, excluir, menus de áreas restritas).
- **UX-02:** Acesso direto por URL a uma área proibida mostra a tela "Você não tem acesso a esta área", com opção de solicitar acesso ao Gestor/Admin. Nada de erro genérico.
- **UX-03:** A tela **Novo papel** agrupa capacidades por tema: Biblioteca, Setlists, Grupos e pessoas, Administração.
- **UX-04:** A tela mostra uma **prévia** antes de salvar: "Este papel poderá: …".
- **UX-05:** Capacidades exclusivas do Admin aparecem desabilitadas, com explicação, ao editar outros papéis.
- **UX-06:** Dependências (RN-01 a RN-04) são aplicadas visualmente ao marcar/desmarcar.

---

## 10. Requisitos técnicos

- **RT-01:** Função central `can(user, capability, resource?)` usada por todas as rotas da API e pelo front-end.
- **RT-02:** Middleware de autorização em todas as rotas, com negação por padrão.
- **RT-03:** Remover do código checagens por nome de papel (`role === ...`).
- **RT-04:** Cada endpoint declara a capacidade que exige.
- **RT-05:** O front-end obtém as capacidades do usuário a partir da API (não deduz pelo nome do papel).
- **RT-06:** Toda negação de acesso gera evento em `logs.view`.

---

## 11. Critérios de aceite

### Músico
- [ ] Vê setlists, grupos e biblioteca dos grupos dos quais participa.
- [ ] Não vê nenhum botão de editar, importar ou excluir.
- [ ] Não vê os menus de Importar, Área de usuário, Logs e Papéis.
- [ ] Recebe `403` ao chamar diretamente a API de edição de cifra ou setlist.
- [ ] Ao acessar `/importar` pela URL, vê a tela de "sem acesso".

### Líder
- [ ] Edita e importa cifras.
- [ ] Cria e edita setlists **apenas** dos grupos que lidera.
- [ ] Recebe `403` ao tentar editar setlist de grupo que não lidera, mesmo via API.
- [ ] Não acessa Área de usuário, Logs, Papéis nem Suporte.

### Gestor
- [ ] Cria e edita setlists de todos os grupos.
- [ ] Exclui músicas.
- [ ] Convida, gerencia membros e grupos.
- [ ] Não acessa Área de usuário, Logs técnicos, Papéis nem Suporte.

### Técnico
- [ ] Tem todos os acessos do Gestor.
- [ ] Vê log de auditoria e logs técnicos, com dados sensíveis mascarados.
- [ ] Envia reset de senha, reenvia/cancela convites, desbloqueia contas e encerra sessões.
- [ ] Toda ação de suporte exige motivo e aparece na auditoria.
- [ ] Não consegue alterar papel, criar ou excluir usuário.
- [ ] Não consegue executar ações de suporte sobre usuários Admin.
- [ ] Não acessa Papéis nem Configurações e cobrança.

### Admin
- [ ] Tem acesso a todas as capacidades.
- [ ] Não consegue rebaixar ou excluir o último Admin.
- [ ] Ao mudar o papel de um usuário logado, o acesso dele muda imediatamente.

### Geral
- [ ] Endpoint sem capacidade declarada retorna `403` (negar por padrão).
- [ ] Toda negação aparece nos logs técnicos.

---

## 12. Testes

- **Matriz automatizada:** para cada papel × cada endpoint, testar o resultado esperado (`200` ou `403`) chamando a API diretamente.
- **Testes contextuais:** Líder do grupo A × recursos do grupo B.
- **Teste de sessão:** alterar papel durante uma sessão ativa e validar a mudança imediata.
- **Teste de regressão:** a matriz roda no CI a cada deploy.

---

## 13. Decisões em aberto

| # | Pergunta | Opções |
|---|----------|--------|
| D1 | Gestor vê o log de auditoria? | Sim (acompanha alterações dos ministérios) / Não |
| D2 | Líder pode convidar para os grupos que lidera? | Criar `member.invite.own` / Manter só Gestor |
| D3 | Músico pode sugerir correção em cifra? | Fluxo de sugestão com aprovação do Líder / Fora do escopo |
| D4 | Quem criou uma cifra ou setlist pode editá-la mesmo sem a capacidade? | Sim (regra de propriedade) / Não |
| D5 | Retenção dos logs | 90 dias / 6 meses / 1 ano |
| D6 | Suporte deve exigir motivo em lista fixa ou texto livre? | Lista / Texto / Ambos |

---

## 14. Fora de escopo (por enquanto)

- Delegação temporária de permissões
- Link público somente leitura de setlists
- Histórico de versões de cifra
- Personificação de usuário ("ver como") pelo suporte