# Design System Videira

O design system do Videira Music usa tokens semanticos em cima de Tailwind CSS. A marca pode mudar de cor sem exigir refatoracao dos componentes, desde que a UI continue usando tokens como `primary`, `surface`, `content` e `border`.

## Onde Trocar a Paleta

As cores ficam centralizadas em `app/globals.css`.

- Tokens primitivos guardam a materia-prima da marca: `--videira-*`, `--oracao-*`, `--neutral-*`.
- Tokens semanticos definem o uso na interface: `--color-primary`, `--color-accent`, `--color-surface`, `--color-content`, `--color-border`.
- Componentes e paginas devem consumir apenas os tokens semanticos expostos no Tailwind.

Para trocar a paleta no futuro, ajuste primeiro os tokens primitivos e depois revise apenas os mapeamentos semanticos.

## Primary vs Accent

Use `primary` para acoes e navegacao principais:

- CTA principal.
- Links de navegacao.
- Foco da jornada produtiva.
- Chords e informacoes diretamente ligadas ao repertorio.

Use `accent` com parcimonia:

- Comunicacoes devocionais ou institucionais.
- Badges de destaque.
- Estados especiais que precisam diferenciar do fluxo operacional.

O verde representa a identidade Videira e a base de uso diario sobre fundo limpo branco/neutro, destacando apenas elementos-chave como acordes, artista, tom e acoes primarias (inspirado na legibilidade do Cifra Club).

## Light e Dark

O tema suporta tres caminhos:

- `prefers-color-scheme`, como fallback automatico.
- Classe `.dark` aplicada no `html` ou em um container.
- Atributo `data-theme="dark"` para integracao futura com um seletor persistido.

Tambem existem overrides para `.light` e `data-theme="light"` quando for necessario forcar o tema claro.

## Classes Recomendadas

Use os atomos abaixo para manter consistencia:

- `.ds-button` para acoes primarias.
- `.ds-button-secondary` para acoes secundarias.
- `.ds-card` para containers principais.
- `.ds-card-muted` para blocos auxiliares dentro de cards.
- `.ds-input` para campos de formulario.
- `.ds-badge` para metadados operacionais.
- `.ds-badge-accent` para destaques institucionais.
- `.ds-eyebrow` para rotulos curtos acima de titulos.
- `.ds-link` para links textuais importantes.

Quando uma tela precisar de algo mais especifico, componha utilitarios semanticos do Tailwind:

```tsx
<section className="rounded-3xl border border-border bg-surface p-6 text-content">
  <p className="text-content-muted">Conteudo auxiliar</p>
</section>
```

Evite cores rigidas como `text-slate-600`, `bg-white` ou `text-leaf-700` em novas interfaces. Prefira `text-content-muted`, `bg-surface`, `text-primary` e equivalentes.
