# Administração de papéis e pedidos de acesso — Context

**Gathered:** 2026-10-15
**Spec:** `.specs/features/admin-access/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Estender `/usuarios` com um catálogo de papéis e uma aba para liberar pedidos de acesso. Os quatro papéis de sistema ficam. Papéis novos escolhem capacidades de um conjunto fechado. O pedido nasce na recusa do login Google, com o e-mail já verificado, e a liberação cria o membro para o próximo login.

---

## Implementation Decisions

### Catálogo de papéis

- Admin cria, renomeia e apaga só papel personalizado.
- Capacidades fechadas: convidar, gerenciar membros sem conceder admin, gerenciar grupos, editar músicas, importar, setlists de todos os grupos, setlists dos grupos em que é líder.
- Papel sem nenhuma capacidade marcada é permitido e fica só com leitura.
- Gestor vê o catálogo e atribui papéis personalizados. Gestor não edita o catálogo e não concede `admin`.
- O líder único automático continua só no papel de sistema `worship_leader`.

### Pedido de acesso

- O botão "Solicitar acesso" aparece em `/entrar` depois que o Google recusa um e-mail verificado que ainda não é membro.
- A liberação escolhe papéis e, se quiser, grupos.
- A pessoa entra de novo com a mesma conta Google.
- Conta desativada não pede acesso e não volta por esse fluxo.

### Onde fica na tela

- A mesma página `/usuarios`, em abas: Membros, Convites, Pedidos, Papéis.
- Membros e Convites continuam como estão hoje.

### Agent's Discretion

- Texto exato dos rótulos das capacidades na tela, desde que cada um corresponda a uma capacidade da spec.
- Slug da chave quando o nome tem acento ou hífen, dentro da regra da spec.
- Se a aba ativa vem de `?aba=` ou de estado no cliente, desde que as quatro existam e Papéis esconda a edição para o gestor.

### Declined / Undiscussed Gray Areas → Assumptions

Nenhuma área combinada ficou em aberto. Defaults técnicos não confirmados pelo dono estão na tabela de Assumptions da spec: tamanho do nome, forma da chave e ausência de rate limit extra por IP.

---

## Specific References

- Página atual: `/usuarios`, componente `components/users/users-admin.tsx`.
- Recusa atual em `/entrar`: "Esta conta não tem acesso. Peça um convite ao administrador da igreja."
- Matriz de papéis da spec `auth`.

---

## Deferred Ideas

- Enviar o convite ou o resultado do pedido por e-mail.
- Reativar um usuário desativado a partir do pedido.
- Consultar a auditoria numa tela.
