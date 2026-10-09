# Formatos de cifra

O Videira Music deve armazenar cifras em um formato estruturado, mesmo quando a experiencia de edicao parecer texto livre. Isso permite transposicao, renderizacao em diferentes layouts e exportacao futura.

## Formato 1: cifra com letra

Referencia principal: ChordPro.

No editor, o usuario pode digitar algo proximo de:

```text
{title: A Comecar em Mim}
{key: A}

[A]A comecar em [E/G#]mim
[F#m]Quebra coracoes, [D]Senhor
```

Estrutura interna sugerida:

```json
{
  "format": "lyrics",
  "key": "A",
  "timeSignature": "4/4",
  "sections": [
    {
      "type": "verse",
      "label": "Verso 1",
      "content": {
        "lines": [
          {
            "text": "A comecar em mim",
            "chords": [
              { "symbol": "A", "position": 0 },
              { "symbol": "E/G#", "position": 12 }
            ]
          }
        ]
      }
    }
  ]
}
```

### Regras

- A cifra com letra deve preservar a letra sem os marcadores de acorde.
- Os acordes devem ser armazenados separadamente com posicao.
- O texto original pode ser salvo como `source` para auditoria e reprocessamento.
- A renderizacao deve alinhar acordes acima da letra, mas o armazenamento nao deve depender de espacos manuais.

## Formato 2: cifra sem letra por compassos

Referencia principal: lead sheet simplificada, iReal Pro e leitura de palco.

No editor, o usuario pode digitar algo proximo de:

```text
[Intro]
| G | D/F# | Em | C |

[Verso]
| G | D/F# | Em | C |
| G/B | Am | D | D |
```

Estrutura interna sugerida:

```json
{
  "format": "grid",
  "key": "G",
  "timeSignature": "4/4",
  "sections": [
    {
      "type": "intro",
      "label": "Intro",
      "content": {
        "measures": [
          { "chords": [{ "symbol": "G", "beats": 4 }] },
          { "chords": [{ "symbol": "D/F#", "beats": 4 }] },
          { "chords": [{ "symbol": "Em", "beats": 4 }] },
          { "chords": [{ "symbol": "C", "beats": 4 }] }
        ]
      }
    }
  ]
}
```

### Regras

- Cada barra vertical `|` representa limite de compasso.
- Um compasso pode conter um ou mais acordes.
- Quando nao houver duracao explicita, os acordes dividem o compasso igualmente.
- A secao define o contexto visual e musical dos compassos.
- Repeticoes devem ser representadas de forma estruturada, nao apenas como texto.

## Formato canonico

A aplicacao deve usar uma estrutura canonica comum para ambos os formatos:

```json
{
  "songId": "song_001",
  "format": "lyrics",
  "key": "A",
  "timeSignature": "4/4",
  "sections": []
}
```

Difere apenas o conteudo de cada secao:

- `lyrics`: `content.lines`
- `grid`: `content.measures`

## Importacao e exportacao futuras

- Importar ChordPro para `lyrics`.
- Exportar `lyrics` para ChordPro.
- Exportar `grid` como texto por compassos.
- Avaliar MusicXML apenas em etapa futura, quando houver necessidade real de interoperabilidade com editores de partitura.
