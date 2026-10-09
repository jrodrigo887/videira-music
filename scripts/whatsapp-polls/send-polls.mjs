/**
 * Envia enquetes nativas do WhatsApp a partir de data/enquete-lotes.json
 *
 * Uso:
 *   cd scripts/whatsapp-polls && npm install
 *   export WHATSAPP_GROUP_ID="120363...@g.us"   # ID do grupo
 *   npm run dry-run
 *   npm run send
 *
 * Na 1ª execução: escaneie o QR no terminal (sessão fica em .wwebjs_auth/).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import qrcode from "qrcode-terminal";
import wweb from "whatsapp-web.js";

const { Client, LocalAuth, Poll } = wweb;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const LOTES = path.join(ROOT, "data/enquete-lotes.json");

const DRY_RUN = process.env.DRY_RUN === "1";
const CHAT_ID = process.env.WHATSAPP_GROUP_ID || process.env.WHATSAPP_CHAT_ID;
const DELAY_MS = Number(process.env.POLL_DELAY_MS || "4000");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadPayload() {
  return JSON.parse(fs.readFileSync(LOTES, "utf8"));
}

async function main() {
  const payload = loadPayload();

  if (DRY_RUN) {
    console.log("=== DRY RUN ===\n");
    console.log(payload.intro_message);
    console.log("");
    for (const p of payload.polls) {
      console.log(`--- Poll ${p.part}/${p.total_parts} ---`);
      console.log("Pergunta:", p.question);
      console.log("Opções:", p.options.length);
      p.options.forEach((o) => console.log("  •", o));
      console.log("");
    }
    console.log(`Total: ${payload.polls.length} enquetes, ${payload.total_songs} músicas`);
    return;
  }

  if (!CHAT_ID) {
    console.error(
      "Defina WHATSAPP_GROUP_ID (ex.: 120363...@g.us). Veja README.md para achar o ID."
    );
    process.exit(1);
  }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, ".wwebjs_auth") }),
    puppeteer: { headless: true, args: ["--no-sandbox"] },
  });

  client.on("qr", (qr) => {
    console.log("Escaneie o QR com WhatsApp → Aparelhos conectados:");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", async () => {
    console.log("Conectado. Enviando enquetes para", CHAT_ID);
    try {
      await client.sendMessage(CHAT_ID, payload.intro_message);
      await sleep(DELAY_MS);

      for (const p of payload.polls) {
        const poll = new Poll(p.question, p.options, {
          allowMultipleAnswers: p.allow_multiple_answers !== false,
        });
        await client.sendMessage(CHAT_ID, poll);
        console.log(`Enviada parte ${p.part}/${p.total_parts}`);
        await sleep(DELAY_MS);
      }
      console.log("Concluído.");
    } catch (err) {
      console.error(err);
    } finally {
      await client.destroy();
      process.exit(0);
    }
  });

  client.on("auth_failure", () => {
    console.error("Falha de autenticação.");
    process.exit(1);
  });

  await client.initialize();
}

main();
