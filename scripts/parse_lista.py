#!/usr/bin/env python3
"""Extrai músicas de lista-musicas-gospel-ensaio.md → JSON."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LISTA = ROOT / "lista-musicas-gospel-ensaio.md"
OUT = ROOT / "data" / "musicas.json"

LINE_RE = re.compile(
    r"^\d+\.\s+(.+?)(?:\s+—\s+(.+))?\s*$"
)


def parse_lista(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    in_list = False
    songs: list[dict] = []

    for line in text.splitlines():
        if line.strip() == "## Lista completa (A–Z)":
            in_list = True
            continue
        if in_list and line.strip().startswith("---"):
            break
        if not in_list:
            continue

        m = LINE_RE.match(line.strip())
        if not m:
            continue

        title = m.group(1).strip()
        meta = (m.group(2) or "").strip()
        songs.append(
            {
                "id": len(songs) + 1,
                "title": title,
                "meta": meta,
                "label": f"{len(songs) + 1}. {title}"[:100],
            }
        )

    return songs


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else LISTA
    songs = parse_lista(path)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(songs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(songs)} músicas → {OUT}")


if __name__ == "__main__":
    main()
