# Autenticação e autorização Context

**Gathered:** 2026-10-15
**Spec:** `.specs/features/auth/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Login só com Google, acesso só por convite gerado por admin ou gestor, papéis acumuláveis da igreja com liderança por grupo, proteção de páginas e APIs, e uma página pública de letras sem acordes para visitantes.

---

## Implementation Decisions

### Papéis

- O admin é da igreja, não da plataforma.
- Uma pessoa pode acumular papéis (ex.: admin + gestor + líder de louvor).
- Líder de louvor é um papel da igreja; cada grupo escolhe um ou mais líderes entre quem tem esse papel.
- Se a igreja tiver um único líder de louvor, ele lidera todos os grupos.
- Quando um segundo líder é cadastrado, o primeiro continua em todos os grupos até o admin ou gestor redistribuir.

### Convites

- Admin e gestor geram convites.
- O convite leva o e-mail e o tipo de usuário; o acesso só é concedido pelo link.
- Entrega por e-mail ou WhatsApp (e-mail fica para P3 por depender de provedor).
- Quem cria o convite define a validade máxima; ao abrir o link, o sistema confere validade e autenticidade pelo código guardado em hash. O link leva só o código, sem o e-mail.
- Gestor e líder de louvor também importam; o líder gere os setlists dos seus grupos.
- Outro método de cadastro além do convite ainda está em avaliação.

### Acesso anônimo

- Sem login, a pessoa é anônima e vai para uma página de músicas só com letras, sem cifras.
- Só aparecem as músicas marcadas como visíveis ao público.
- Ao importar ou cadastrar uma música há a opção "Visível ao público", com um ícone de mais informações explicando a opção.

### Agent's Discretion

- Formato do token, validade do convite, duração da sessão, rate limit e auditoria (registrados como "default técnico" na spec).
- Biblioteca de autenticação, decidida no Design.

### Declined / Undiscussed Gray Areas → Assumptions

- Permissões detalhadas de gestor e líder (import, grupos, músicas): proposta na Matriz de permissões da spec, pendente de aceite.
- Leitura anônima de setlists `public`: removida; usuários logados de outras igrejas continuam lendo (AD-006).

---

## Specific References

- O seed já modela o caso de uma pessoa líder em um grupo e músico em outro (`lib/auth/simulated-identities.ts`).

---

## Deferred Ideas

- Uma conta Google em várias igrejas.
- Admin da plataforma que cria igrejas.
- Líder convidando músicos do próprio grupo.
