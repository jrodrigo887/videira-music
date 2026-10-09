# Plano tecnico de implementacao

Este documento traduz a especificacao inicial em uma sequencia pratica para iniciar o produto.

## Estado atual do repositorio

- `lean intercept.md`: nota inicial do produto.
- `data/musicas.json`: catalogo inicial de 63 musicas.
- `scripts/`: automacoes relacionadas a enquetes e Google Forms.
- Nao ha ainda uma aplicacao principal com `src/`.

## Stack inicial proposta

- Next.js + TypeScript.
- React.
- Tailwind CSS.
- Vitest para testes unitarios.
- ESLint e Prettier.
- Persistencia inicial em arquivos JSON ou storage local durante prototipo.
- Banco relacional em etapa posterior, preferencialmente PostgreSQL.

## Estrutura inicial sugerida

```text
app/
  page.tsx
  songs/
    page.tsx
    [songId]/
      page.tsx
  setlists/
    page.tsx
components/
  chord-chart/
  songs/
  setlists/
lib/
  chords/
    parse-chord.ts
    transpose-chord.ts
  charts/
    parse-lyrics-chart.ts
    parse-grid-chart.ts
  data/
    songs.ts
types/
  music.ts
docs/
```

## Ordem recomendada de implementacao

### 1. Criar base da aplicacao

- Inicializar Next.js com TypeScript.
- Configurar lint e testes.
- Criar layout base.
- Criar pagina inicial com link para biblioteca.

### 2. Tipar o dominio

- Criar tipos `Song`, `ChordChart`, `Section`, `Measure`, `Chord` e `Setlist`.
- Criar adaptador para carregar `data/musicas.json`.
- Normalizar temporariamente `meta` para exibicao.

### 3. Implementar acordes

- Criar parser de acordes.
- Criar transpositor.
- Cobrir com testes unitarios antes de ligar na UI.

### 4. Criar biblioteca de musicas

- Listar musicas do arquivo existente.
- Busca por titulo e meta.
- Tela de detalhe da musica.

### 5. Criar renderizador de cifra com letra

- Aceitar entrada estilo ChordPro simplificado.
- Parsear acordes entre colchetes.
- Renderizar acordes acima da linha de letra.
- Permitir transposicao no preview.

### 6. Criar renderizador de cifra por compassos

- Aceitar entrada com barras de compasso.
- Parsear secoes e compassos.
- Renderizar grade responsiva.
- Permitir transposicao no preview.

### 7. Criar setlists

- Criar setlist local.
- Adicionar musicas.
- Ordenar musicas.
- Abrir modo leitura sequencial.

### 8. Evoluir persistencia

- Comecar com dados locais para validar UX.
- Depois definir banco e autenticacao.
- API publica fica fora da primeira fase.

## Primeiras tarefas de codigo

1. Criar projeto Next.js no repositorio sem remover os scripts existentes.
2. Mover ou manter `data/musicas.json` como seed inicial.
3. Criar `types/music.ts` com o modelo do dominio.
4. Criar `lib/chords/parse-chord.ts`.
5. Criar `lib/chords/transpose-chord.ts`.
6. Criar testes para parser e transposicao.
7. Criar tela `/songs` usando o catalogo atual.

## Riscos tecnicos

- Parsing de acordes pode crescer em complexidade; manter parser pequeno no MVP.
- Edicao visual por compassos pode ficar complexa; comecar com entrada textual + preview.
- Direitos autorais impedem importar conteudo de sites de cifras sem licenca.
- Offline/PWA deve vir depois da leitura e transposicao estarem estaveis.

## Criterio de pronto da proxima fase

A proxima fase termina quando existir uma PWA simples capaz de:

- Listar as musicas de `data/musicas.json`.
- Abrir detalhe de uma musica.
- Renderizar uma cifra com letra de exemplo.
- Renderizar uma cifra por compassos de exemplo.
- Transpor acordes nos dois formatos.
