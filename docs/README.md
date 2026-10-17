# Documentacao do Videira Music

Esta pasta concentra a especificacao inicial do produto antes da implementacao da aplicacao principal.

## Documentos

- [Padrão de interface](design-system.md): densidades mesa e estante, tokens, componentes e acessibilidade.
- [Modelo de dominio](domain.md): vocabulário e entidades principais.
- [Formatos de cifra](chart-formats.md): cifra com letra e cifra por compassos.
- [Telas do MVP](mvp-screens.md): biblioteca, editores, leitor e setlists.
- [Transposicao](transposition.md): parsing e regras de transposicao de acordes.
- [Decisao de plataforma](platform-decision.md): escolha inicial por PWA responsiva.
- [Plano tecnico](implementation-plan.md): stack, estrutura sugerida e primeiras tarefas de codigo.
- [Banco de dados Postgres](database.md): `DATABASE_URL`, `DIRECT_URL`, migrations, seed e deploy na Vercel.
- [Fluxo modular do MVP](technical-design/videira-music-mvp-flow.excalidraw): diagrama Excalidraw do fluxo entre interface, modulos de dominio e persistencia.

## Ordem de leitura recomendada

1. `design-system.md`
2. `domain.md`
3. `chart-formats.md`
4. `transposition.md`
5. `mvp-screens.md`
6. `platform-decision.md`
7. `implementation-plan.md`
