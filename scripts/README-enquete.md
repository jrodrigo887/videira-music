# Enquete de repertório

Use **Google Forms** — um link no WhatsApp, sem digitar as 63 músicas.

→ Guia completo: **[google-form/README.md](google-form/README.md)**

```bash
./scripts/preparar-google-form.sh
# ou: python3 scripts/parse_lista.py && python3 scripts/google-form/gerar_apps_script.py
```

Depois cole `scripts/google-form/Code.gs` no [Apps Script](https://script.google.com) e execute `createSongPollForm`.

---

Outras opções (não recomendadas para 63 músicas):

- `scripts/whatsapp-polls/` — várias enquetes nativas no WhatsApp (máx. 12 opções cada)
- `scripts/gerar_lotes_enquete.py` — JSON usado pelo envio WhatsApp
