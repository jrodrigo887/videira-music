#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python3 scripts/parse_lista.py
python3 scripts/google-form/gerar_apps_script.py
echo ""
echo "Próximo passo: copie scripts/google-form/Code.gs para https://script.google.com"
echo "e execute a função createSongPollForm (detalhes em scripts/google-form/README.md)."
