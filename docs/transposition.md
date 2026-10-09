# Transposicao de acordes

Este documento define as regras iniciais para reconhecer e transpor acordes.

## Objetivo

A transposicao deve alterar apenas notas musicais dentro dos acordes. Qualidade, extensoes e modificadores devem ser preservados.

Exemplos:

- `C` transposto +2 semitons vira `D`.
- `Am7` transposto +2 semitons vira `Bm7`.
- `D/F#` transposto +2 semitons vira `E/G#`.
- `Bbmaj7` transposto +2 semitons vira `Cmaj7`.

## Notas suportadas

Conjunto cromatico com sustenidos:

```text
C C# D D# E F F# G G# A A# B
```

Conjunto cromatico com bemois:

```text
C Db D Eb E F Gb G Ab A Bb B
```

Regra inicial:

- Se o acorde original usa bemol, preferir saida com bemol.
- Se o acorde original usa sustenido, preferir saida com sustenido.
- Se a musica possui tom com bemol, preferir saida com bemol.
- Caso contrario, preferir sustenidos.

## Formato de acorde

Um acorde deve ser parseado em quatro partes:

```text
root + quality + modifiers + bass
```

Exemplos:

| Acorde | root | quality/modifiers | bass |
| --- | --- | --- | --- |
| `C` | `C` | `` | `` |
| `Am` | `A` | `m` | `` |
| `G7` | `G` | `7` | `` |
| `Bbmaj7` | `Bb` | `maj7` | `` |
| `D/F#` | `D` | `` | `F#` |
| `C#m7(b5)` | `C#` | `m7(b5)` | `` |

## Regex inicial

Uma expressao regular inicial para reconhecimento:

```text
^([A-G](?:#|b)?)([^/\\s]*)(?:/([A-G](?:#|b)?))?$
```

Partes:

- Grupo 1: nota raiz.
- Grupo 2: qualidade, extensoes e alteracoes.
- Grupo 3: baixo alternativo.

## Regras de transposicao

1. Converter `root` para indice cromatico.
2. Somar o deslocamento em semitons.
3. Normalizar o resultado entre `0` e `11`.
4. Escolher grafia com sustenido ou bemol.
5. Repetir o mesmo processo para `bass`, quando existir.
6. Manter `quality/modifiers` exatamente como digitado.

## Casos que devem funcionar no MVP

- Acordes maiores: `C`, `D`, `E`.
- Menores: `Am`, `C#m`, `Bbm`.
- Setimas: `G7`, `Fmaj7`, `Bm7`.
- Suspensos: `Dsus4`, `Asus`.
- Adicionados: `Cadd9`, `G2`.
- Diminutos e meio-diminutos em texto: `Bdim`, `Bm7(b5)`.
- Baixo alternativo: `D/F#`, `G/B`, `A/C#`.

## Casos fora do MVP

- Analise harmonica funcional.
- Nashville Number System como formato principal.
- Poliacordes complexos.
- Conversao entre cifra e partitura completa.

## Testes obrigatorios futuros

Quando a implementacao de codigo comecar, criar testes unitarios para:

- Parsing de acorde simples.
- Parsing de acorde com baixo.
- Transposicao positiva e negativa.
- Preferencia de bemol e sustenido.
- Preservacao de extensoes.
- Falha controlada para texto que nao e acorde.
