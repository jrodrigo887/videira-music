# Decisao de plataforma

## Decisao

Comecar como **PWA web responsiva**.

## Motivos

- O principal uso inicial deve acontecer em celular, tablet e notebook durante estudo, ensaio e culto.
- Uma PWA permite entregar experiencia instalavel sem iniciar com lojas de aplicativos.
- O mesmo codigo atende edicao em desktop e leitura em dispositivos moveis.
- Recursos offline podem ser adicionados de forma incremental.
- Reduz o custo inicial em comparacao com web + aplicativo nativo.

## Stack recomendada para o inicio

- Next.js com TypeScript.
- React para UI.
- Tailwind CSS para velocidade de prototipacao visual.
- Persistencia inicial local ou banco leve, evoluindo para banco relacional.
- Testes unitarios para parsing e transposicao desde o inicio.

## Prioridades por dispositivo

### Celular

- Busca de musica.
- Modo leitura.
- Transposicao rapida.
- Uso em setlist.

### Tablet

- Leitura em culto/ensaio.
- Edicao simples.
- Visualizacao de grade de compassos.

### Desktop

- Edicao completa.
- Organizacao do repertorio.
- Revisao de dados.

## Recursos PWA desejados

- Instalar na tela inicial.
- Cache de cifras abertas recentemente.
- Modo offline para setlists baixadas.
- Layout responsivo para leitura.
- Persistencia de preferencias locais, como tamanho da fonte e tema.

## Alternativas descartadas neste momento

### Aplicativo nativo primeiro

Nao recomendado para o MVP porque aumenta o custo inicial e retarda a validacao do modelo de cifra.

### Apenas web desktop

Nao recomendado porque o principal momento de uso tende a ser leitura em celular/tablet.

### API primeiro

Nao recomendado porque o risco principal ainda esta no produto: formato de cifra, edicao, leitura e transposicao. A API deve nascer depois que o modelo estiver validado.
