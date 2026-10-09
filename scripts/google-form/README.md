# Enquete no Google Forms (repertório do ensaio)

Fluxo recomendado: **1 link no WhatsApp**, **63 músicas** já preenchidas, respostas na **planilha** e ranking por script.

## Passo 1 — Gerar o script a partir da lista

Na raiz do repositório:

```bash
python3 scripts/parse_lista.py
python3 scripts/google-form/gerar_apps_script.py
```

Isso lê `lista-musicas-gospel-ensaio.md` e atualiza `scripts/google-form/Code.gs`.

## Passo 2 — Criar o formulário (uma vez)

1. Abra [Google Apps Script](https://script.google.com) com a conta Google que vai **donar** o form (ex.: e-mail do ministério).
2. **Novo projeto** → apague o `Code.gs` padrão → cole todo o conteúdo de `scripts/google-form/Code.gs`.
3. Salve o projeto (nome sugerido: `Enquete Videira Music`).
4. No dropdown de funções, escolha **`createSongPollForm`** → **Executar**.
5. Na primeira vez: **Revisar permissões** → conta Google → **Avançado** → **Acessar** (projeto seu).
6. Abra **Execuções** (ícone de relógio) → clique na execução concluída → **Registros** / **Logs**.

   Você verá três URLs:

   - **Link para o grupo** → `https://docs.google.com/forms/d/e/...` (envie no WhatsApp)
   - **Editar formulário**
   - **Planilha de respostas**

Guarde o link do formulário; é o único que o time precisa.

## Passo 3 — Divulgar no WhatsApp

Exemplo de mensagem:

```text
🎵 Enquete — repertório do ensaio

Escolha as músicas que vocês querem ensaiar (pode marcar várias):
👉 [cole o link do Forms]

Respostas até [data]. Obrigado!
```

## Passo 4 — Ver resultado (ranking)

Quando houver respostas:

1. Volte ao **mesmo projeto** no Apps Script.
2. Execute a função **`atualizarRanking`**.
3. Abra a **planilha de respostas** → aba **`Ranking`** (músicas ordenadas por quantidade de votos).

Repita `atualizarRanking` quando quiser atualizar a contagem.

Na **planilha de respostas**, ao abrir o arquivo deve aparecer o menu **Enquete → Atualizar ranking** (configurado automaticamente na criação).

## Atualizar a lista de músicas

Se `lista-musicas-gospel-ensaio.md` mudar:

```bash
python3 scripts/parse_lista.py
python3 scripts/google-form/gerar_apps_script.py
```

O Google **não atualiza** um form já publicado só com o script. Opções:

- **Nova enquete:** rode `createSongPollForm` de novo (cria form + planilha novos) e envie o link novo; ou  
- **Edite manualmente** o form existente (pergunta de checkbox) se forem poucas mudanças.

## O que o formulário contém

- Campo opcional: **Seu nome**
- Uma pergunta **Caixas de seleção** com as **63 músicas** (rótulos `01.` … `63.` para facilitar o ranking)
- Respostas vinculadas automaticamente à planilha **Enquete Videira Music — respostas**
