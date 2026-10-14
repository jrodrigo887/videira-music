# Importação e persistência de cifras - Contexto

**Gathered:** 2026-10-09  
**Spec:** `.specs/features/chart-import/spec.md`  
**Status:** Ready for design

## Feature Boundary

Esta feature entrega as fatias 6, 7 e 9 do discovery: importar por texto ou URL, revisar o `ImportDraft`, vincular ou criar uma música, persistir a cifra localmente e disponibilizá-la na biblioteca e no detalhe. Não inclui busca no Cifra Club, importação em lote, sincronização remota ou redistribuição.

## Implementation Decisions

### Fluxo de revisão

- A revisão mostra texto original e preview lado a lado em telas largas e empilhados no celular.
- Warnings apontam a linha original quando esse dado existir.
- O usuário confirma o tom explicitamente antes de salvar.
- O usuário pode alterar o tipo de uma seção sem perder seu rótulo original.
- O draft permanece somente em memória até o salvamento.

### Vínculo com música

- Correspondências por título e artista são sugestões.
- Nenhuma música é vinculada automaticamente.
- O usuário confirma uma música existente ou cria uma nova.
- Uma música criada localmente aparece na biblioteca e em buscas futuras.

### Repetição e concorrência

- Uma cifra salva com a mesma `origin.url` é aberta sem novo acesso ao Cifra Club.
- Requisições para URLs diferentes são enfileiradas para respeitar o intervalo global de 10 segundos.
- Escritas locais são serializadas para evitar perda de atualização.

### Falhas

- Falha externa abre o caminho para colar texto, preservando a URL como origem quando aplicável.
- Falha de persistência não descarta o draft nem navega para outra tela.
- A aplicação não registra letra ou cifra integral em logs.

### Agent's Discretion

- Escolha do mecanismo de storage do navegador, desde que fique atrás de contratos de repositório e sobreviva a reload.
- Organização interna dos componentes do workflow.
- Duração exata do timeout e do fechamento por inatividade, desde que sejam documentadas e testáveis.
- Estratégia de normalização para sugestões de música, sem vínculo automático.

### Declined / Undiscussed Gray Areas → Assumptions

- Texto de entrada limitado a 500 KiB para proteger a UI.
- Dados locais não expiram automaticamente.
- Chromium ausente é tratado como falha explícita do adaptador com orientação de instalação.

## Specific References

- Fluxo e guardrails: `api/Untitled/docs/discovery-importacao-cifras.md`.
- Componentes devem reutilizar tokens e classes do design system existente.

## Deferred Ideas

- Upload de `.txt` ou `.cho`.
- Bookmarklet como plano B se o navegador headed deixar de funcionar.
- Sincronização, autenticação e banco relacional.
- Preservação estruturada de tablaturas.
