# Fundação do design system

## Problem Statement

A interface já tem tokens semânticos e classes `.ds-*`, mas a marca não é um dado. O verde está escrito no CSS, erro usa `text-red-600`, e `ds-button-primary` aparece numa tela sem existir. Sem um contrato fechado, cada igreja futura exigiria reescrever JSX.

## Goals

- [ ] A marca Videira entra por um objeto e chega ao `<html>` como variáveis `--brand-*`.
- [ ] Erro, aviso e sucesso têm token próprio, nos dois temas. Nenhum JSX de produção usa a paleta `red` do Tailwind.
- [ ] Botão, alerta e dialog passam a existir como primitivos, adotados só onde o plano manda.
- [ ] `docs/design-system.md` registra o que a marca pode mudar e o que fica do produto.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Coluna ou JSON de marca em `Organization` | A marca desta etapa é a constante `videiraBrand`. |
| Tela de configuração, logo e nome no header | O header continua com o texto fixo "Videira Music". |
| Gerador de escala a partir de uma cor semente | O objeto já recebe a escala pronta. |
| Preferência de tema do músico e alvo de 44px na estante | O `<html>` continua `class="light"` e `data-theme="light"`. |
| Troca de fonte, raio ou densidade por tenant | Neutros, raio e famílias tipográficas ficam no CSS atual. |
| Migrar todo `.ds-button` para o componente `Button` | O primitivo entra nos pontos desta spec. O resto fica no className. |
| Overlay de `setlist-editor` | Só o dialog de seguidores usa o casco novo. |
| Trocar `text-accent` já existente | O link do convite permanece. `accent` não vira chave de marca. |
| Token de overlay | O dialog continua com `bg-black/40`. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Chaves de marca | `primary`, `primaryHover`, `primaryForeground`, `primarySubtle`, `chord` | São os papéis que uma igreja troca. O resto é produto. | sim, no plano |
| Valores Videira | primary e chord `136 42% 33%`; hover `140 45% 22%`; foreground `0 0% 100%`; subtle `138 38% 96%` | É o mapa claro já usado em `globals.css` (`videira-700`, `videira-900`, `neutral-0`, `videira-50`). | sim, no plano |
| Nome | `videiraBrand.name` é `Videira` e não entra no style | O contrato guarda o nome. Esta etapa não pinta o header com ele. | sim, no plano |
| Formato da cor | Canais HSL sem `hsl()` e sem ponto e vírgula: `136 42% 33%` | É o formato que o CSS atual já interpola. | sim, no plano |
| Ordem de validação | `primary`, `primaryHover`, `primaryForeground`, `primarySubtle`, `chord` | O teste precisa de uma chave faltante previsível. | sim, default técnico |
| Tema escuro | Primário e acorde escuros continuam literais: `134 45% 58%`, hover `134 50% 66%`, subtle `136 28% 18%` | A preferência de tema está fora. A marca injeta a escala clara. | sim, no plano |
| Foco | `--color-focus` não é chave de marca | O plano limita a injeção às cinco variáveis. | sim, no plano |
| Status claro | danger `0 72% 38%`; warning `32 80% 28%`; success `164 64% 24%` | Vermelho, âmbar e teal escuros passam de 4.5:1 no branco e não repetem o verde Videira. | sim, default técnico |
| Status escuro | danger `0 85% 72%`; warning `38 92% 68%`; success `164 45% 62%` | No fundo escuro o token padrão é texto, então a cor é clara. | sim, default técnico |
| Hover, foreground e subtle | Ver critérios DS-09 e DS-10 | O plano pede os três papéis nos dois temas. | sim, no plano |
| `ds-badge-accent` | Passa a usar `bg-primary-subtle` e `text-primary`, como `.ds-badge` | Badge operacional não pode mudar quando `accent` ganhar outro papel. | sim, no plano |
| Alerta | Só o tom danger, texto `text-danger`, sem fundo preenchido | Os call sites hoje são uma linha de erro. | sim, no plano |
| Dialog e `busy` | Escape chama `onClose` mesmo com `busy`. Clique no overlay respeita `closeOnOverlay` | O padrão de interface bloqueia o overlay durante ação destrutiva em andamento. Escape continua saindo. | sim, no design system |
| Cópia do dialog de seguidores | Título "Confirmar impacto". Corpo "1 grupo segue este setlist" ou "N grupos seguem este setlist", mais "Deseja continuar?". Botões "Cancelar" e "Confirmar" | Esta feature troca o casco, não o texto. | sim, default técnico |
| Auth | N/A, sem rota nova | Ninguém configura marca nesta etapa. | sim |
| Concorrência | N/A | `brandStyle` não guarda estado. | sim |
| Ciclo de vida do dado | N/A, sem persistência | Fora de escopo junto com `Organization`. | sim |
| Observabilidade | N/A | Variável de CSS não gera log. | sim |
| Dependência externa | N/A | Não há serviço fora do repositório. | sim |

**Open questions:** none.

---

## User Stories

### P1: Marca Videira no documento ⭐ MVP

**User Story**: Como quem for colocar outra igreja no produto, quero que a cor da Videira seja um objeto aplicado no `<html>`, para trocar a marca sem caçar hex no JSX.

**Why P1**: Sem essa costura o restante do design system continua cor solta.

**Acceptance Criteria**:

1. WHEN `brandStyle` recebe `videiraBrand` THEN o sistema SHALL devolver só estas propriedades: `--brand-primary` = `136 42% 33%`, `--brand-primary-hover` = `140 45% 22%`, `--brand-primary-foreground` = `0 0% 100%`, `--brand-primary-subtle` = `138 38% 96%`, `--brand-chord` = `136 42% 33%`. (DS-01)
2. The sistema SHALL expor `videiraBrand.name` como `Videira` e SHALL omitir o nome do objeto devolvido por `brandStyle`. (DS-02)
3. IF o objeto não tem `primary` THEN o sistema SHALL lançar `Error` com a mensagem `Brand color primary is required.` (DS-03)
4. IF `primary` é `#2d6b3e` THEN o sistema SHALL lançar `Error` com a mensagem `Brand color primary must be HSL channels, for example "136 42% 33%".` (DS-04)
5. IF `primary` é válido e `primaryHover` está ausente THEN o sistema SHALL lançar `Error` com a mensagem `Brand color primaryHover is required.` (DS-05)
6. WHEN o objeto tem as cinco chaves válidas e uma chave extra THEN o sistema SHALL devolver as mesmas cinco propriedades de DS-01 e SHALL não alterar as chaves do objeto recebido. (DS-06)
7. WHEN o layout raiz renderiza THEN o sistema SHALL colocar no elemento `html` o style de `brandStyle(videiraBrand)`, `class` contendo `light` e `data-theme` = `light`. (DS-07)
8. The sistema SHALL definir, no bloco claro de `app/globals.css`, `--color-primary: var(--brand-primary)`, `--color-primary-hover: var(--brand-primary-hover)`, `--color-primary-foreground: var(--brand-primary-foreground)`, `--color-primary-subtle: var(--brand-primary-subtle)` e `--color-chord: var(--brand-chord)`. (DS-08)
9. WHILE o bloco escuro de `app/globals.css` vale, o sistema SHALL manter `--color-primary: 134 45% 58%`, `--color-primary-hover: 134 50% 66%`, `--color-primary-subtle: 136 28% 18%` e `--color-chord: 134 45% 58%`, e SHALL não apontar esses quatro para `var(--brand-*)`. (DS-09)
10. The sistema SHALL definir `.ds-badge-accent` com `bg-primary-subtle` e `text-primary`. (DS-10)

**Independent Test**: Um teste de `brandStyle` confere os cinco valores, o nome, a chave faltante, o hex rejeitado e a chave extra. O teste do layout confere o style no `html`. Uma leitura de `globals.css` confere o bloco claro e o bloco escuro.

---

### P1: Status que não é marca ⭐ MVP

**User Story**: Como quem lê um erro na tela, quero a cor de erro estável, para que outra igreja não pinte falha com a cor da marca.

**Why P1**: O JSX já usa vermelho solto. O token precisa existir antes do primitivo de alerta.

**Acceptance Criteria**:

1. The sistema SHALL definir no tema claro `--color-danger: 0 72% 38%`, `--color-danger-hover: 0 72% 30%`, `--color-danger-foreground: 0 0% 100%`, `--color-danger-subtle: 0 70% 96%`, `--color-warning: 32 80% 28%`, `--color-warning-hover: 32 80% 22%`, `--color-warning-foreground: 0 0% 100%`, `--color-warning-subtle: 40 90% 95%`, `--color-success: 164 64% 24%`, `--color-success-hover: 164 64% 18%`, `--color-success-foreground: 0 0% 100%` e `--color-success-subtle: 164 40% 95%`. (DS-11)
2. The sistema SHALL definir no tema escuro `--color-danger: 0 85% 72%`, `--color-danger-hover: 0 85% 78%`, `--color-danger-foreground: 240 10% 10%`, `--color-danger-subtle: 0 30% 16%`, `--color-warning: 38 92% 68%`, `--color-warning-hover: 38 92% 74%`, `--color-warning-foreground: 240 10% 10%`, `--color-warning-subtle: 32 30% 16%`, `--color-success: 164 45% 62%`, `--color-success-hover: 164 45% 70%`, `--color-success-foreground: 240 10% 10%` e `--color-success-subtle: 164 25% 16%`. (DS-12)
3. The sistema SHALL expor no Tailwind `danger`, `warning` e `success`, cada um com `DEFAULT`, `hover`, `foreground` e `subtle`, no mesmo formato `hsl(var(--color-…) / <alpha-value>)` já usado por `primary`. (DS-13)
4. The sistema SHALL não deixar classe Tailwind `text-red-`, `border-red-` ou `bg-red-` em arquivo `.tsx` de `app/` ou `components/`. (DS-14)
5. WHEN o controle destrutivo do editor de setlist recebe hover THEN o sistema SHALL usar `border-danger` e `text-danger`. (DS-15)

**Independent Test**: Leitura de `globals.css` e de `tailwind.config.ts` confere os canais. Busca nos `.tsx` de `app/` e `components/` não acha paleta `red`. O botão destrutivo do editor não usa `red-600` nem `red-700`.

---

### P1: Primitivos nos pontos que já vazam ⭐ MVP

**User Story**: Como quem monta uma tela nova, quero botão, alerta e dialog prontos, para não copiar className nem repetir o casco do modal.

**Why P1**: O contrato de cor só segura a UI se o erro e o dialog passarem por esses primitivos.

**Acceptance Criteria**:

1. The sistema SHALL aplicar no `Button` uma única classe de variante: `ds-button` para `primary`, `ds-button-secondary` para `secondary` e `ds-button-danger` para `danger`. (DS-16)
2. WHEN `Button` não recebe `type` THEN o sistema SHALL renderizar `type="button"`. (DS-17)
3. WHEN `Button` recebe `type="submit"`, `disabled` e `className="w-full"` THEN o sistema SHALL renderizar esses três valores e SHALL manter a classe da variante. (DS-31)
4. The sistema SHALL definir `.ds-button-danger` com o mesmo raio, padding, tamanho de texto e anel de foco de `.ds-button`, com `bg-danger`, `text-danger-foreground` e `hover:bg-danger-hover`. (DS-18)
5. WHEN `Alert` renderiza um texto THEN o sistema SHALL mostrar esse texto num elemento com `role="alert"` e classe `text-danger`. (DS-19)
6. WHEN a lixeira, o editor de setlist, as ações de setlist, o formulário de setlist ou o convite de grupo têm mensagem de erro não vazia THEN o sistema SHALL mostrar essa mensagem num `Alert`. (DS-20)
7. IF a lixeira, o editor de setlist, as ações de setlist, o formulário de setlist ou o convite de grupo não têm mensagem de erro THEN o sistema SHALL não renderizar `Alert` nesse espaço. (DS-32)
8. WHEN o formulário de convite do grupo é exibido THEN o sistema SHALL mostrar o botão "Enviar convite" como `Button` `primary` com `type="submit"`. (DS-21)
9. The sistema SHALL não conter a classe `ds-button-primary` em nenhum `.tsx` de `app/` ou `components/`. (DS-33)
10. WHEN `Dialog` está aberto THEN o sistema SHALL renderizar `role="dialog"`, `aria-modal="true"` e `aria-labelledby` apontando para o id do título. (DS-22)
11. WHEN `Dialog` abre THEN o sistema SHALL mover o foco para o dialog e SHALL gravar `document.body.style.overflow` como `hidden`. (DS-34)
12. WHEN `Dialog` está aberto e a tecla Escape é pressionada THEN o sistema SHALL chamar `onClose` uma vez. (DS-23)
13. WHEN `Dialog` está aberto, `closeOnOverlay` é verdadeiro e o overlay é clicado THEN o sistema SHALL chamar `onClose`. (DS-24)
14. IF `closeOnOverlay` é falso e o overlay é clicado THEN o sistema SHALL não chamar `onClose`. (DS-35)
15. WHEN `Dialog` fecha THEN o sistema SHALL restaurar o `overflow` anterior do `body` e SHALL devolver o foco ao elemento que estava focado na abertura. (DS-25)
16. IF não havia elemento focado na abertura THEN o sistema SHALL fechar sem lançar erro. (DS-36)
17. WHEN o dialog de seguidores abre com 1 grupo THEN o sistema SHALL mostrar o título "Confirmar impacto", o texto "1 grupo segue este setlist", o texto "Deseja continuar?" e os botões "Cancelar" e "Confirmar". (DS-26)
18. WHEN o dialog de seguidores abre com 2 grupos THEN o sistema SHALL mostrar "2 grupos seguem este setlist". (DS-37)
19. WHILE o dialog de seguidores está `busy` o sistema SHALL desabilitar "Cancelar" e "Confirmar" e SHALL usar `closeOnOverlay` falso. (DS-27)

**Independent Test**: Testes de componente cobrem as três variantes do botão, o alerta, Escape, overlay, foco e scroll. O convite mostra "Enviar convite". O dialog de seguidores mostra as duas frases de contagem. Busca não acha `ds-button-primary`.

---

### P1: Contrato escrito ⭐ MVP

**User Story**: Como quem implementa a próxima tela, quero o contrato de marca escrito no padrão de interface, para não tratar status e densidade como preferência da igreja.

**Why P1**: O plano termina no documento. Sem isso a costura fica só no código.

**Acceptance Criteria**:

1. The sistema SHALL citar `videiraBrand` em `docs/design-system.md` e SHALL listar as chaves `primary`, `primaryHover`, `primaryForeground`, `primarySubtle` e `chord` como o que a marca altera. (DS-28)
2. The sistema SHALL afirmar em `docs/design-system.md` que neutros, status, densidade mesa/estante, estrutura da cifra, raio e famílias tipográficas não mudam com a marca. (DS-29)
3. The sistema SHALL remover de `docs/design-system.md` a frase `Status ainda não está em globals.css`. (DS-30)

**Independent Test**: Leitura de `docs/design-system.md` encontra `videiraBrand`, as cinco chaves, a lista do que fica fixo, e não encontra a frase antiga de status ausente.

---

## Edge Cases

- IF o objeto de marca chega vazio THEN o sistema SHALL falhar em `primary` com `Brand color primary is required.` (DS-03)
- IF a cor vem como `hsl(136, 42%, 33%)` THEN o sistema SHALL rejeitar com a mensagem de canais HSL de DS-04. (DS-04)
- IF `closeOnOverlay` é falso THEN o clique no overlay não fecha. Escape ainda fecha. (DS-23, DS-35)
- IF o dialog fecha sem foco anterior THEN o sistema não lança erro. (DS-36)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| DS-01 | P1: Marca Videira no documento | - | In Tasks |
| DS-02 | P1: Marca Videira no documento | - | In Tasks |
| DS-03 | P1: Marca Videira no documento | - | In Tasks |
| DS-04 | P1: Marca Videira no documento | - | In Tasks |
| DS-05 | P1: Marca Videira no documento | - | In Tasks |
| DS-06 | P1: Marca Videira no documento | - | In Tasks |
| DS-07 | P1: Marca Videira no documento | - | In Tasks |
| DS-08 | P1: Marca Videira no documento | - | In Tasks |
| DS-09 | P1: Marca Videira no documento | - | In Tasks |
| DS-10 | P1: Marca Videira no documento | - | In Tasks |
| DS-11 | P1: Status que não é marca | - | In Tasks |
| DS-12 | P1: Status que não é marca | - | In Tasks |
| DS-13 | P1: Status que não é marca | - | In Tasks |
| DS-14 | P1: Status que não é marca | - | In Tasks |
| DS-15 | P1: Status que não é marca | - | In Tasks |
| DS-16 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-17 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-18 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-19 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-20 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-21 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-22 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-23 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-24 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-25 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-26 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-27 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-31 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-32 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-33 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-34 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-35 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-36 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-37 | P1: Primitivos nos pontos que já vazam | - | In Tasks |
| DS-28 | P1: Contrato escrito | - | In Tasks |
| DS-29 | P1: Contrato escrito | - | In Tasks |
| DS-30 | P1: Contrato escrito | - | In Tasks |

**Coverage:** 37 total, 0 mapped to tasks, 37 unmapped.

---

## Success Criteria

- [ ] `brandStyle(videiraBrand)` reproduz o verde claro atual e rejeita hex e chave faltante.
- [ ] O `<html>` recebe essas variáveis. O tema escuro não passa a ler `--brand-*` para primário e acorde.
- [ ] Nenhum `.tsx` em `app/` ou `components/` usa paleta `red` nem a classe `ds-button-primary`.
- [ ] O dialog de seguidores fecha com Escape, devolve o foco e não fecha pelo overlay enquanto `busy`.
- [ ] `docs/design-system.md` distingue o que a marca altera do que fica no produto.
