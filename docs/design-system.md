# Padrão de interface — Videira Music

> **Status:** vigente para telas novas e para qualquer refatoração visual.
> **Público:** quem escreve UI neste repositório.
> **Base:** o que o produto já é (PWA de repertório, cifra e setlist) mais os padrões de mercado que resolvem esse uso: tokens em três camadas (W3C Design Tokens), páginas de administração (Shopify Polaris), contraste e alvo de toque (WCAG 2.2 AA), texto de interface (GOV.UK Design System) e estados de componente (IBM Carbon).

A interface tem um trabalho: deixar o músico achar a música, ler o acorde e seguir o setlist sem pensar na ferramenta. Tudo que não serve a isso fica quieto.

## 1. A regra que distingue este produto

Existem duas densidades. Elas compartilham tokens e não compartilham layout.

| | Mesa | Estante |
|---|---|---|
| Quando | Biblioteca, editor, grupos, usuários, importação | Modo leitura e play do setlist |
| Quem | Líder ou gestor, sentado, as duas mãos | Músico em ensaio ou culto, celular ou tablet, pouca luz |
| Densidade | Lista, filtro, formulário, uma ação primária | Cifra grande, poucos controles, alvo de toque largo |
| Largura | `max-w-6xl`, padding de página | A cifra ocupa a largura; o chrome recua |
| O que pode competir com o conteúdo | Título e um botão | Nada. Tom, tamanho da fonte e próximo item ficam na borda |

```
MESA                              ESTANTE
┌────────────────────────────┐    ┌──────────────────────┐
│ Videira Music    nav       │    │ tom −  G  +     Aa   │
├────────────────────────────┤    ├──────────────────────┤
│ eyebrow                    │    │                      │
│ Título            [Ação]   │    │  C            G      │
│ busca / filtro             │    │  Grande é o Senhor  │
│ lista ou formulário        │    │                      │
└────────────────────────────┘    │  Am           D      │
                                  └──────────────────────┘
```

Se uma tela mistura as duas (detalhe da música com preview), a cifra segue a estante e o restante segue a mesa. Não existe um terceiro modo.

## 2. Assinatura

A única cor que significa “isto é música” é a tinta do acorde (`text-chord` / `--color-chord`). Título, navegação e botão primário usam o verde da marca porque são a Videira. O acorde usa o mesmo verde porque, na leitura, ele precisa ser o elemento que o olho acha primeiro — negrito, linha própria, cor estável no claro e no escuro.

Não introduza uma segunda cor de marca para “dar vida” à tela. Status (erro, aviso, sucesso) é a única família cromática extra, e ela não pinta acorde, título nem navegação.

## 3. Tokens

Três camadas. Componente novo consome só a terceira.

| Camada | Onde vive | Exemplo | Quem pode usar |
|---|---|---|---|
| Primitiva | `--videira-*`, `--neutral-*` em `app/globals.css` | `--videira-700` | Só o mapeamento semântico |
| Semântica | `--color-*` | `--color-primary`, `--color-chord` | Tailwind: `bg-primary`, `text-chord` |
| Componente | classes `.ds-*` | `.ds-button`, `.ds-input` | JSX |

Trocar a paleta é editar primitivos e revisar o mapa semântico. Não é caçar hex no JSX.

### 3.1 Papéis de cor

| Token Tailwind | Papel | Uso |
|---|---|---|
| `canvas` | Fundo da página | `body`. Nunca um card |
| `surface` | Folha | Cards, inputs, header |
| `surface-elevated` | Folha acima de outra | Menu, dialog, popover |
| `surface-muted` | Recuo | Filtro, compasso, bloco auxiliar |
| `content` | Texto principal | Títulos, letra, labels |
| `content-muted` | Texto de apoio | Descrição, meta secundária |
| `content-subtle` | Texto terciário | Placeholder, versão, dica |
| `content-inverse` | Texto sobre primário | Label do botão primário |
| `border` / `border-strong` | Divisão | Card, input; strong só quando a borda é o único separador |
| `primary` | Ação e navegação | Um por região. Hover em `primary-hover` |
| `primary-subtle` | Seleção leve | Badge, item ativo, linha selecionada |
| `chord` | Tinta do acorde | Só acorde e tom quando o tom é dado musical |
| `focus` | Anel de teclado | `focus-visible`, nunca hover |

`accent` existe no tema e hoje aponta para o mesmo verde que `primary`. Não use `accent` até existir um papel que `primary` não cubra. Badge operacional é `ds-badge` (`primary-subtle`).

### 3.2 O que ainda falta nos tokens

Status ainda não está em `globals.css`. Até entrar, não invente `text-red-600` na página. Quando for implementado, o mapa é este:

| Token | Papel | Exemplo de texto |
|---|---|---|
| `danger` | Ação destrutiva e erro de campo | Excluir, “Informe o título.” |
| `warning` | Consequência reversível com impacto | “3 grupos seguem este setlist.” |
| `success` | Confirmação curta | “Setlist publicado.” |

Cor de status nunca é o único sinal. Erro leva ícone ou texto; destrutivo leva o verbo (“Excluir música”) e, se houver impacto, um dialog.

### 3.3 Proibido em código novo

- `text-slate-*`, `bg-white`, `text-black`, `bg-leaf-*`, hex solto, `shadow-xs` fora da escala da seção 6.
- `primary` e `accent` no mesmo controle.
- Pintar a letra da cifra com `text-chord`. Letra é `content`. Acorde é `chord`.

## 4. Tipografia

Duas famílias, já carregadas no layout. Não adicionar uma terceira para “título de marketing”.

| Papel | Família | Por quê |
|---|---|---|
| Interface e letra | Atkinson Hyperlegible (`font-sans` / `font-lyrics`) | Desenhada para baixa visão. É a fonte de quem lê no celular no escuro |
| Acorde, tom, código | JetBrains Mono (`font-chord`) | `0`/`O` e `I`/`l` não se confundem. Acorde é dado, não prosa |

Escala. Fora dela, o tamanho é exceção e precisa de motivo (controle de fonte da estante, que é preferência do músico, não do layout).

| Papel | Classe | Onde |
|---|---|---|
| Eyebrow | `ds-eyebrow` | Um rótulo curto acima do `h1`: “Modo leitura”, “Biblioteca” |
| Título de página | `text-3xl font-bold tracking-tight` | Um `h1` por página |
| Título de seção | `text-lg font-bold` | `h2` dentro do card ou dialog |
| Corpo | `text-base` (16px) | Texto, input, item de lista no celular |
| Apoio | `text-sm text-content-muted` | Meta, ajuda, botão de mesa |
| Dado | `text-xs font-semibold` | Badge, versão |

Inputs ficam em 16px (`text-base` em `.ds-input`) para o iOS não dar zoom ao focar.

Na estante, o tamanho da cifra é preferência (`--chart-font-size`), com piso legível e teto que ainda caiba um trecho na tela. A interface em volta não escala junto.

## 5. Espaço, raio, alvo

Escala de 4px, como na maioria dos sistemas enterprise (Carbon, Polaris). Use a escala do Tailwind; não invente `p-[13px]`.

| Uso | Valor |
|---|---|
| Entre ícone e label | `gap-2` (8px) |
| Entre controles irmãos | `gap-2` ou `gap-3` |
| Padding de card | `p-6` (já em `.ds-card`) |
| Padding de bloco auxiliar | `p-4` (já em `.ds-card-muted`) |
| Padding de página | `px-4 py-8` no `main` |
| Entre blocos de página | `space-y-6` |

Raio comunica o que a coisa é:

| Raio | Coisa |
|---|---|
| `rounded-full` | Botão, badge, chip, controle de ícone |
| `rounded-2xl` | Card |
| `rounded-xl` | Input, item de menu, compasso, bloco auxiliar |
| `rounded-lg` | Marca compacta (o “V” do header) |

Alvo de toque:

| Contexto | Mínimo | Como |
|---|---|---|
| Mesa | 40px de altura | `.ds-button` / `.ds-button-secondary` |
| Estante e qualquer controle usado em pé | 44×44px | WCAG 2.2 (2.5.8) e HIG. Play, transpor, fonte, próximo |
| Ícone sem label | 44×44 na estante, 36×36 só na mesa se tiver `aria-label` | O lápis de editar no play deve ir para 44px |

Área clicável inclui o padding. Dois alvos não ficam a menos de 8px um do outro na estante.

## 6. Elevação

Quatro níveis. Sombra não decora; ela diz o que está na frente.

| Nível | Tratamento | Uso |
|---|---|---|
| 0 | `canvas`, sem borda | Página |
| 1 | `surface` + `border` + sombra do `.ds-card` | Card, lista |
| 2 | `surface/95` + `backdrop-blur` + borda inferior | Header sticky |
| 3 | `surface-elevated` + overlay `bg-black/40` | Dialog, menu mobile |

Não empilhe card dentro de card com a mesma sombra. O de dentro é `ds-card-muted` (nível auxiliar, sem sombra própria).

## 7. Componentes

Use a classe pronta. Se a tela precisa de variação, componha utilitário semântico em cima dela. Se a variação se repetir em duas telas, ela vira classe em `globals.css`, não cópia de className.

| Classe | Uso | Não usar para |
|---|---|---|
| `.ds-button` | A ação primária da região | Segunda ação, link de navegação, destrutivo |
| `.ds-button-secondary` | Cancelar, ação alternativa, navegação entre itens | A ação que a pessoa veio fazer |
| `.ds-input` | Texto, busca, número | Select nativo sem estilo, textarea de cifra |
| `.ds-card` | Um assunto por card | A página inteira |
| `.ds-card-muted` | Grupo de campos ou nota dentro do card | Card de topo |
| `.ds-badge` | Metadado operacional: tom, origem, papel | Chamada de marketing |
| `.ds-eyebrow` | Contexto do `h1` | Título |
| `.ds-link` | Link no meio do texto | Botão que navega. Navegação principal é link com classe de nav |

Um região (página, card, dialog, barra) tem no máximo um `.ds-button`. Os outros são secundários. Ordem no dialog: secundário à esquerda, primário à direita.

Ação destrutiva é secundária até a confirmação. No dialog, o botão que executa o dano usa o token `danger` quando ele existir; até lá, o rótulo carrega o verbo específico (“Excluir”, não “Confirmar”) e o secundário é “Cancelar”.

### 7.1 Anatomia de página (mesa)

Ordem fixa, de Polaris adaptada ao que já renderizamos:

1. Eyebrow opcional, só se o `h1` sozinho for ambíguo.
2. `h1` + no máximo uma ação primária na mesma linha (`flex` com `justify-between`).
3. Texto de apoio em uma frase, se a página precisa de contexto. Sem parágrafo de boas-vindas.
4. Busca ou filtros, quando a página é um índice.
5. Conteúdo.
6. Estado vazio no lugar do conteúdo, não abaixo dele.

### 7.2 Anatomia da estante

1. Barra mínima: voltar, tom atual, transpor, tamanho da fonte. Sem eyebrow competindo com a cifra.
2. Cifra. Seções com o respiro de `.music-sections`.
3. Anterior / próximo no setlist, alvo de 44px, longe da cifra.

Rolagem automática, se existir, é opt-in e respeita `prefers-reduced-motion`.

### 7.3 Cifra

Classes em `globals.css`: `.music-chart`, `.music-sections`, `.music-lines`, `.music-line`, `.music-lyrics`, `.music-chords`, `.music-measure`.

- Acorde: `.music-chords`, negrito, `chord`.
- Letra: `.music-lyrics`, peso regular, `content`.
- Compasso: `.music-measure`.
- Fonte da cifra: `font-chord`.
- `whitespace-pre` permanece. Alinhamento do acorde sobre a sílaba é o produto; não quebrar isso com `text-wrap`.

### 7.4 Formulário

Padrão GOV.UK, que é o que menos erra em produto operacional:

- Label visível acima do campo, associado por `htmlFor` / `id`. Placeholder não substitui label.
- Ajuda opcional entre o label e o campo, em `text-sm text-content-muted`.
- Erro abaixo do campo, ligado por `aria-describedby`, além de `aria-invalid`.
- Um erro diz o que falhou e o que fazer: “Informe o título.”, não “Campo obrigatório.” e não “Ops!”.
- Submit em `.ds-button`. Enquanto salva, o botão fica `disabled` e o rótulo muda para o gerúndio da mesma ação: “Salvar” → “Salvando…”.
- Agrupe com `fieldset` / `legend` quando os campos são uma pergunta só (destinos do setlist, capacidades de um papel).

### 7.5 Dialog

O dialog de seguidores é o mínimo. Todo dialog novo precisa de:

- `role="dialog"`, `aria-modal="true"`, título com `aria-labelledby`.
- Foco vai para o dialog ao abrir e volta para o controle que abriu ao fechar.
- `Escape` cancela. Clique no overlay cancela, exceto quando a ação é destrutiva e já está `busy`.
- Com `busy`, os dois botões ficam `disabled`.
- Trava o scroll do `body`, como o menu do header já faz.

### 7.6 Feedback

| Situação | Onde aparece | Some sozinho? |
|---|---|---|
| Erro de campo | No campo | Não |
| Erro de ação (salvar, importar) | No topo da região, em texto | Não, até a próxima tentativa |
| Sucesso de ação curta | Junto da região, uma linha | Pode, depois de ~4s, se o resultado também estiver visível na tela |
| Impacto em outros grupos | Dialog, antes de executar | Não |

Não use toast para erro. A pessoa precisa achar a mensagem sem ter visto o canto da tela.

### 7.7 Vazio e carregamento

Vazio é um convite com a mesma ação que a página oferece quando há dados. “Nenhuma música neste grupo.” e o botão “Importar cifra”, se a pessoa pode importar. Sem ilustração, sem desculpa.

Carregamento de página é o estado da própria região (texto “Carregando setlist…” ou skeleton na forma do card). Não bloqueie a aplicação inteira por um painel.

## 8. Texto de interface

Português do Brasil, frase com inicial maiúscula, sem ponto final em botão, label e item de menu.

- O botão diz o que acontece: “Publicar setlist”, “Convidar”, “Arquivar grupo”.
- O mesmo verbo atravessa o fluxo. Quem clica em “Publicar” vê “Publicando…” e depois “Setlist publicado.”.
- Nomeie pelo que a pessoa reconhece. “Grupo”, “setlist”, “cifra”, “tom”. Não “entidade”, “resource”, “payload”.
- Capacidade não aparece na interface. Aparece a ação. Quem não pode executar não vê o controle (o servidor continua sendo a autoridade; isso está no discovery de permissões).
- Números e nomes em frase usam a forma certa: “1 grupo segue este setlist” / “3 grupos seguem este setlist”.

## 9. Tema

Três caminhos, já ligados no Tailwind (`darkMode` por `.dark` e `[data-theme="dark"]`):

1. `prefers-color-scheme`, quando não houver escolha salva.
2. `data-theme="light" | "dark"` no `html`, quando houver escolha salva.
3. Classe `.dark` como alternativa equivalente.

Hoje o layout força `className="light"`. A estante é a primeira tela que deve honrar a preferência do sistema e, em seguida, a escolha persistida (tamanho de fonte e tema, como em `docs/platform-decision.md`). A mesa pode seguir a mesma preferência; não criamos um tema diferente por densidade.

Contraste mínimo WCAG 2.2 AA:

- Texto comum: 4.5:1 contra a superfície imediata.
- Texto grande (a partir de 24px, ou 18.5px em negrito) e acorde em tamanho de estante: 3:1.
- Borda de input e anel de foco: 3:1 contra a superfície.
- Acorde sobre `surface` e sobre `surface-muted` precisa passar nos dois temas. Se um verde novo falhar, escurece no claro ou clareia no escuro — não troque a família.

Não comunique estado só por cor. Item ativo tem peso ou fundo `primary-subtle`, não apenas tinta verde.

## 10. Movimento

Um momento, não espalhado. O que já vale:

- Cor e borda em `transition` nos controles `.ds-*` (~150ms).
- Menu mobile entra por cima; não anima layout da página.

Respeite `prefers-reduced-motion: reduce`: sem translação, sem rolagem automática, opacidade instantânea. Hover não é o único caminho para a ação; tudo que o hover revela também existe em foco e em toque.

## 11. Responsivo

Mobile first. Breakpoint do Tailwind, sem valor arbitrário.

| Largura | O que muda |
|---|---|
| Base (<640px) | Nav vira botão “Menu”. Ação primária pode ir para largura total em formulário curto (`w-full`). Lista em uma coluna |
| `sm` | Header mostra a marca “V” e os links em linha |
| `lg` | Editor de cifra pode colocar texto e preview lado a lado. Abaixo disso, preview embaixo |

A estante não ganha coluna extra. Em tablet, a cifra cresce; os controles continuam na barra.

Toque e teclado coexistem. Ordem de tabulação segue a ordem visual. O menu móvel fecha com `Escape` e devolve o foco ao botão que abriu.

## 12. Acessibilidade — o que revisar em toda tela

Checklist curto, alinhado a WCAG 2.2 AA:

- Um `h1`, hierarquia sem pulo (`h1` → `h2` → `h3`).
- Todo controle tem nome acessível (texto visível ou `aria-label`).
- Foco visível com o anel `focus` (as classes `.ds-*` já trazem `focus-visible:ring-4`). Não remova outline sem substituir.
- Contraste do texto e do acorde nos dois temas.
- Alvo de 44px na estante.
- Formulário com label, erro e `aria-invalid`.
- Dialog com título, foco preso na prática (abrir, Escape, devolver foco) e scroll travado.
- Ícone decorativo com `aria-hidden`. Ícone funcional com nome.
- `lang="pt-BR"` permanece no `html`.

## 13. Como acrescentar um padrão

1. Procure neste documento e em `.ds-*`. Se existir, use.
2. Se for variação de uma tela só, componha utilitário semântico (`bg-surface`, `text-content-muted`, `border-border`).
3. Se a mesma variação aparecer de novo, extraia classe `.ds-*` em `app/globals.css` e registre uma linha na tabela da seção 7.
4. Cor nova entra como primitivo, depois como token semântico, depois no `tailwind.config.ts`. Não o contrário.
5. Atualize este arquivo no mesmo PR da classe.

## 14. Referências

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — contraste, foco, alvo de toque 2.5.8.
- [W3C Design Tokens](https://www.designtokens.org/) — primitivo, semântico, componente.
- [Shopify Polaris](https://polaris.shopify.com/) — estrutura de página de índice e recurso.
- [IBM Carbon](https://carbondesignsystem.com/) — espaçamento em grade de 8, estados de componente.
- [GOV.UK Design System](https://design-system.service.gov.uk/) — label, erro, texto de botão.
- [Apple HIG — layout](https://developer.apple.com/design/human-interface-guidelines/layout) — alvo mínimo de 44pt em controle de uso frequente.

Documentos vizinhos: [telas do MVP](mvp-screens.md), [decisão de plataforma](platform-decision.md), [formatos de cifra](chart-formats.md).
