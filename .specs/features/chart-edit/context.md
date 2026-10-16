# Edição de cifra salva — Context

**Gathered:** 2026-10-16
**Spec:** `.specs/features/chart-edit/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Quem tem `music:write` corrige uma cifra com letra já salva, na página da música. O save reprocessa o texto, grava na mesma cifra, e os setlists passam a mostrar a correção. O selo Importada e o link da fonte permanecem. Buscar cifra nova continua no módulo de import.

---

## Implementation Decisions

### O que se edita

- O editor abre o `source` da cifra persistida com `format: lyrics`.
- Na mesma tela: texto, tom (`chart.key`), capo (`chart.capo`) e tipo de cada seção.
- O rótulo da seção não é editado.
- Grade, cifra de exemplo e cifra sem `source` ficam só leitura.

### O que o save altera

- A gravação é na mesma cifra: mesmo `id`, `songId` e `originUrl`.
- Setlists que apontam para esse `chartId` mostram as seções novas.
- `title`, `timeSignature`, `tempo` e `song.defaultKey` permanecem.
- O transpose de meio-tom da página continua só na sessão.

### Tom, capo e tipo de seção

- Mudar o texto reprocessa com o parser do import e recoloca os tipos classificados pelo rótulo.
- A pessoa confirma tipo, tom e capo de novo antes de salvar.
- Capo vazio remove o capo da cifra.
- O tom aceito é a lista fechada da revisão do import.

### Permissão

- O botão e o `PUT /api/charts/{chartId}` exigem `music:write`.
- Atualizar uma cifra existente com a mesma `originUrl` não exige a capacidade `import` nem a flag de import, e não grava `ImportLog`.
- Criar cifra com `origin`, ou trocar a `originUrl`, continua no gate de import.
- Nenhuma capacidade nova entra no catálogo.

### Agent's Discretion

- Organização interna do componente do editor, desde que fique na página da música e reutilize o parser do import.
- Como o capo vazio é representado no controle, desde que a cifra gravada fique sem capo.

### Declined / Undiscussed Gray Areas → Assumptions

- Concorrência: o último `PUT` vence. A cifra não ganha `expectedVersion` nesta entrega.
- `chordTokens` da página do Cifra Club não são reaplicados. O reprocessamento usa só o `source`.

---

## Specific References

- Revisão do import: texto, avisos, tipo de seção e lista de tom.
- Matriz de papéis: `music:write` edita cifra; `import` busca cifra nova.
- Limite de 500 KiB e mensagens "Informe o texto da cifra." e "O texto deve ter no máximo 500 KiB."

---

## Deferred Ideas

- Versão como outra cifra da mesma música (simplificada ou trabalhada), sem reusar a `originUrl`. O selo Importada fica na cifra que veio da fonte.
- Arquivar música ou cifra: esconder da biblioteca e do seletor de setlist novo, sem quebrar setlist já montado.
- Editor de grade por compassos.
