/**
 * Gerado por scripts/google-form/gerar_apps_script.py
 * Projeto: https://script.google.com → Novo projeto → colar → Executar createSongPollForm
 */
const FORM_TITLE = "Enquete — repertório ensaio (Videira Music)";
const FORM_DESCRIPTION = "Marque todas as músicas que você gostaria de ensaiar. Pode escolher quantas quiser. Leva cerca de 2 minutos.";
const SONG_LABELS = [
    "01. A começar em mim",
    "02. Abraça-me",
    "03. Aclame ao Senhor",
    "04. Agradeço",
    "05. Ajuntamento",
    "06. Amigo de Deus",
    "07. Aos Pés da Cruz",
    "08. Aqui estamos oh Deus",
    "09. Até aqui",
    "10. Boa companhia",
    "11. Bondade",
    "12. Canção da Graça",
    "13. Cantarei teu amor pra sempre",
    "14. Comigo Estás",
    "15. Deus Eterno",
    "16. Deus me Ama",
    "17. Digno é o Senhor · Aline Barros",
    "18. Doce Nome",
    "19. É o teu povo",
    "20. Ele continua sendo bom",
    "21. Ele é exaltado",
    "22. Entre Nós",
    "23. Entrega",
    "24. És",
    "25. Essência da adoração",
    "26. Eterno Deus (Everlasting God)",
    "27. Eu te agradeço",
    "28. Eu vou construir",
    "29. Graça sem Fim",
    "30. Grande é o Senhor",
    "31. Jesus em Tua Presença",
    "32. Mais que uma voz",
    "33. Me derramar",
    "34. Motivos sem Fim",
    "35. Não é mais segredo",
    "36. Não tenhas sobre Ti",
    "37. Nosso louvor",
    "38. O Pulso, a Pulsação",
    "39. Perdão e Graça",
    "40. Perto Quero Estar",
    "41. Poder do teu amor",
    "42. Porque Ele vive",
    "43. Preciso de Ti",
    "44. Pulmões",
    "45. Quebrantado",
    "46. Recomeçar",
    "47. Reina em Mim",
    "48. Salvador Maravilhoso",
    "49. Sol a meia-noite",
    "50. Sonda-me, Usa-me",
    "51. Teu amor é incrível",
    "52. Todo Dia",
    "53. Todo Som",
    "54. Tributo a Yehovah",
    "55. Tu és soberano + Senhor, formoso és",
    "56. Tu me faz feliz (Made Me Glad)",
    "57. Tu sondas",
    "58. Vem",
    "59. Vem andar comigo",
    "60. Vem de Ti, Senhor",
    "61. Venha sobre nós",
    "62. Vim para adorar-te",
    "63. Vou seguir com fé"
];

/**
 * Cria o formulário + planilha de respostas e grava IDs nas propriedades do script.
 */
function createSongPollForm() {
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

  return { formUrl: formUrl, editUrl: editUrl, sheetUrl: sheetUrl };
}

function addEnqueteMenu() {
  SpreadsheetApp.getUi()
    .createMenu("Enquete")
    .addItem("Atualizar ranking", "atualizarRanking")
    .addToUi();
}

/**
 * Conta votos na coluna de checkboxes e preenche a aba Ranking.
 * Rode de novo quando entrarem novas respostas.
 */
function atualizarRanking() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("SPREADSHEET_ID");
  if (!sheetId) {
    throw new Error("Execute createSongPollForm primeiro.");
  }

  const ss = SpreadsheetApp.openById(sheetId);
  let respostas = null;
  ss.getSheets().forEach(function (sheet) {
    if (respostas) return;
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const row1 = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (let i = 0; i < row1.length; i++) {
      if (String(row1[i]).indexOf("Quais músicas") !== -1) {
        respostas = sheet;
        break;
      }
    }
  });
  if (!respostas) {
    throw new Error("Aba de respostas não encontrada. Abra a planilha vinculada ao form.");
  }
  const data = respostas.getDataRange().getValues();
  if (data.length < 2) {
    SpreadsheetApp.openById(sheetId).getSheetByName("Ranking").getRange("A2").setValue("Nenhuma resposta ainda.");
    return;
  }

  const header = data[0];
  let musicCol = -1;
  for (let c = 0; c < header.length; c++) {
    const h = String(header[c]);
    if (h.indexOf("Quais músicas") !== -1) {
      musicCol = c;
      break;
    }
  }
  if (musicCol === -1) {
    throw new Error("Coluna da enquete não encontrada. Cabeçalho: " + header.join(" | "));
  }

  const counts = {};
  SONG_LABELS.forEach(function (label) {
    counts[label] = 0;
  });

  for (let r = 1; r < data.length; r++) {
    const cell = data[r][musicCol];
    if (!cell) continue;
    String(cell)
      .split(",")
      .map(function (s) { return s.trim(); })
      .filter(Boolean)
      .forEach(function (choice) {
        if (counts.hasOwnProperty(choice)) {
          counts[choice]++;
        } else {
          counts[choice] = (counts[choice] || 0) + 1;
        }
      });
  }

  const rows = Object.keys(counts).map(function (label) {
    const id = label.substring(0, 2);
    return [label, counts[label], id];
  });
  rows.sort(function (a, b) {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], "pt-BR");
  });

  const ranking = ss.getSheetByName("Ranking") || ss.insertSheet("Ranking");
  ranking.clear();
  ranking.getRange(1, 1, 1, 3).setValues([["Música", "Votos", "ID"]]);
  if (rows.length) {
    ranking.getRange(2, 1, rows.length, 3).setValues(rows);
  }
  ranking.autoResizeColumns(1, 3);
  Logger.log("Ranking atualizado: " + rows.length + " músicas.");
}
