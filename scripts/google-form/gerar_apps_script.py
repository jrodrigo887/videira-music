#!/usr/bin/env python3
"""Gera Code.gs a partir de data/musicas.json."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "musicas.json"
OUT = Path(__file__).resolve().parent / "Code.gs"
# Google Forms aceita dezenas de opções em checkbox; 63 cabe em uma pergunta.
MAX_OPTIONS_ONE_QUESTION = 100


def js_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def main() -> None:
    songs = json.loads(DATA.read_text(encoding="utf-8"))
    labels = [f"{s['id']:02d}. {s['title']}" for s in songs]
    choice_lines = ",\n    ".join(js_string(l) for l in labels)

    if len(labels) > MAX_OPTIONS_ONE_QUESTION:
        raise SystemExit(
            f"{len(labels)} músicas — reduza a lista ou ajuste MAX_OPTIONS_ONE_QUESTION e use blocos."
        )

    body = f"""/**
 * Gerado por scripts/google-form/gerar_apps_script.py
 * Projeto: https://script.google.com → Novo projeto → colar → Executar createSongPollForm
 */
const FORM_TITLE = {js_string("Enquete — repertório ensaio (Videira Music)")};
const FORM_DESCRIPTION = {js_string(
        "Marque todas as músicas que você gostaria de ensaiar. "
        + "Pode escolher quantas quiser. Leva cerca de 2 minutos."
    )};
const SONG_LABELS = [
    {choice_lines}
];

/**
 * Cria o formulário + planilha de respostas e grava IDs nas propriedades do script.
 */
function createSongPollForm() {{
  const ss = SpreadsheetApp.create("Enquete Videira Music — respostas");
  const form = FormApp.create(FORM_TITLE);
  form.setDescription(FORM_DESCRIPTION);
  form.setCollectEmail(false);
  form.setAllowResponseEdits(true);
  form.setLimitOneResponsePerUser(false);
  form.setConfirmationMessage(
    "Obrigado! Suas escolhas foram registradas. "
    + "Você pode fechar esta página."
  );

  form.addTextItem().setTitle("Seu nome").setHelpText("Opcional, mas ajuda o louvor a saber quem respondeu.").setRequired(false);

  form
    .addCheckboxItem()
    .setTitle("Quais músicas você quer no ensaio?")
    .setHelpText("Marque todas as que deseja. Role a lista para ver as 63 opções.")
    .setChoiceValues(SONG_LABELS);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  const ranking = ss.insertSheet("Ranking");
  ranking.getRange("A1:C1").setValues([["Música", "Votos", "ID"]]);
  ranking.getRange("A2:C2").setValues([["(menu Enquete → Atualizar ranking)", "", ""]]);

  const props = PropertiesService.getScriptProperties();
  props.setProperty("SPREADSHEET_ID", ss.getId());
  props.setProperty("FORM_ID", form.getId());

  ScriptApp.newTrigger("addEnqueteMenu")
    .forSpreadsheet(ss)
    .onOpen()
    .create();

  const formUrl = form.getPublishedUrl();
  const editUrl = form.getEditUrl();
  const sheetUrl = ss.getUrl();

  Logger.log("=== ENQUETE CRIADA ===");
  Logger.log("Link para o grupo (WhatsApp): " + formUrl);
  Logger.log("Editar formulário: " + editUrl);
  Logger.log("Planilha de respostas: " + sheetUrl);

  return {{ formUrl: formUrl, editUrl: editUrl, sheetUrl: sheetUrl }};
}}

function addEnqueteMenu() {{
  SpreadsheetApp.getUi()
    .createMenu("Enquete")
    .addItem("Atualizar ranking", "atualizarRanking")
    .addToUi();
}}

/**
 * Conta votos na coluna de checkboxes e preenche a aba Ranking.
 * Rode de novo quando entrarem novas respostas.
 */
function atualizarRanking() {{
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("SPREADSHEET_ID");
  if (!sheetId) {{
    throw new Error("Execute createSongPollForm primeiro.");
  }}

  const ss = SpreadsheetApp.openById(sheetId);
  let respostas = null;
  ss.getSheets().forEach(function (sheet) {{
    if (respostas) return;
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const row1 = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (let i = 0; i < row1.length; i++) {{
      if (String(row1[i]).indexOf("Quais músicas") !== -1) {{
        respostas = sheet;
        break;
      }}
    }}
  }});
  if (!respostas) {{
    throw new Error("Aba de respostas não encontrada. Abra a planilha vinculada ao form.");
  }}
  const data = respostas.getDataRange().getValues();
  if (data.length < 2) {{
    SpreadsheetApp.openById(sheetId).getSheetByName("Ranking").getRange("A2").setValue("Nenhuma resposta ainda.");
    return;
  }}

  const header = data[0];
  let musicCol = -1;
  for (let c = 0; c < header.length; c++) {{
    const h = String(header[c]);
    if (h.indexOf("Quais músicas") !== -1) {{
      musicCol = c;
      break;
    }}
  }}
  if (musicCol === -1) {{
    throw new Error("Coluna da enquete não encontrada. Cabeçalho: " + header.join(" | "));
  }}

  const counts = {{}};
  SONG_LABELS.forEach(function (label) {{
    counts[label] = 0;
  }});

  for (let r = 1; r < data.length; r++) {{
    const cell = data[r][musicCol];
    if (!cell) continue;
    String(cell)
      .split(",")
      .map(function (s) {{ return s.trim(); }})
      .filter(Boolean)
      .forEach(function (choice) {{
        if (counts.hasOwnProperty(choice)) {{
          counts[choice]++;
        }} else {{
          counts[choice] = (counts[choice] || 0) + 1;
        }}
      }});
  }}

  const rows = Object.keys(counts).map(function (label) {{
    const id = label.substring(0, 2);
    return [label, counts[label], id];
  }});
  rows.sort(function (a, b) {{
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], "pt-BR");
  }});

  const ranking = ss.getSheetByName("Ranking") || ss.insertSheet("Ranking");
  ranking.clear();
  ranking.getRange(1, 1, 1, 3).setValues([["Música", "Votos", "ID"]]);
  if (rows.length) {{
    ranking.getRange(2, 1, rows.length + 1, 3).setValues(rows);
  }}
  ranking.autoResizeColumns(1, 3);
  Logger.log("Ranking atualizado: " + rows.length + " músicas.");
}}
"""
    OUT.write_text(body, encoding="utf-8")
    print(f"Gerado {OUT} ({len(labels)} músicas, 1 pergunta checkbox)")


if __name__ == "__main__":
    main()
