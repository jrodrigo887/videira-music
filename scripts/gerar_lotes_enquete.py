#!/usr/bin/env python3
"""
Gera lotes de enquete (máx. 12 opções — limite do WhatsApp) e mensagem introdutória.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "musicas.json"
OUT = ROOT / "data" / "enquete-lotes.json"
MAX_OPTIONS = 12


def chunk(items: list, size: int) -> list[list]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def main() -> None:
    songs = json.loads(DATA.read_text(encoding="utf-8"))
    batches = chunk(songs, MAX_OPTIONS)
    total = len(batches)

    payload = {
        "whatsapp_limit_options": MAX_OPTIONS,
        "total_songs": len(songs),
        "total_polls": total,
        "intro_message": (
            "🎵 *Enquete — repertório do ensaio*\n\n"
            f"Vamos escolher o repertório entre {len(songs)} músicas. "
            f"Respondam às *{total} enquetes* abaixo (marquem todas que vocês querem ensaiar).\n\n"
            "_Cada enquete tem no máximo 12 opções — é limitação do WhatsApp._"
        ),
        "polls": [],
    }

    for i, batch in enumerate(batches, start=1):
        options = [s["label"] for s in batch]
        payload["polls"].append(
            {
                "part": i,
                "total_parts": total,
                "question": f"Quais destas músicas você quer no ensaio? (Parte {i}/{total})",
                "options": options,
                "allow_multiple_answers": True,
            }
        )

    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{total} enquetes → {OUT}")
    print(f"Músicas por enquete: {[len(b) for b in batches]}")


if __name__ == "__main__":
    main()
