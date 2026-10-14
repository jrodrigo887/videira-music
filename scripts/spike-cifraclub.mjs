// Spike: verifica se o Cifra Club responde a um Chromium automatizado e quais seletores existem no DOM atual.
// Uso: node scripts/spike-cifraclub.mjs <url> [--headed]
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] ?? "https://www.cifraclub.com.br/vocal-livre/a-comecar-em-mim/";
const headed = process.argv.includes("--headed");
const outDir = path.resolve(".cache/cifraclub");

// Classes CSS do site sao hashes que mudam a cada build; usar apenas atributos data-*, tags semanticas e JSON-LD.
const PROBES = [
  "pre[data-chord-content]",
  "pre[data-chord-content] b[data-chord-name]",
  "[data-chord-config]",
  "h1",
  "h1 + a h2",
  'script[type="application/ld+json"]',
];

const slug = new URL(url).pathname.split("/").filter(Boolean).join("__");

const browser = await chromium.launch({ headless: !headed });
const page = await browser.newPage({ locale: "pt-BR" });

const startedAt = Date.now();
const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(2_000);

console.log(`status: ${response?.status()} (${Date.now() - startedAt} ms)`);
console.log(`final url: ${page.url()}`);
console.log(`title: ${await page.title()}`);

console.log("\nseletores:");
for (const selector of PROBES) {
  const elements = page.locator(selector);
  const count = await elements.count();
  const sample = count ? (await elements.first().innerText()).replace(/\s+/g, " ").slice(0, 80) : "";
  console.log(`  ${selector.padEnd(26)} ${String(count).padStart(4)}  ${sample}`);
}

const config = page.locator("[data-chord-config]").first();
if (await config.count()) {
  const configText = await config.innerText();
  const key = configText.match(/Tom:\s*([^\n]+)/)?.[1]?.trim();
  const capo = configText.match(/Capotraste:\s*([^\n]+)/)?.[1]?.trim();
  console.log(`\ntom: ${key ?? "-"} | capotraste: ${capo ?? "-"}`);
}

const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
for (const block of jsonLd) {
  const data = JSON.parse(block);
  if ([data["@type"]].flat().includes("MusicComposition")) {
    console.log(`composicao: ${data.name} | compositores: ${(data.composer ?? []).map((person) => person.name).join(", ")}`);
  }
  if (data.byArtist) {
    console.log(`artista: ${data.byArtist.name}`);
  }
}

const pre = page.locator("pre[data-chord-content]").first();
if (await pre.count()) {
  const text = await pre.innerText();
  const chordTokens = await pre.locator("b[data-chord-name]").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-chord-name")),
  );
  console.log(`\n<pre>: ${text.split("\n").length} linhas, ${chordTokens.length} <b>`);
  console.log(`acordes unicos: ${[...new Set(chordTokens)].join(" ")}`);
  console.log("\nprimeiras linhas:\n" + text.split("\n").slice(0, 16).join("\n"));
}

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, `${slug}.html`), await page.content());
await page.screenshot({ path: path.join(outDir, `${slug}.png`), fullPage: false });
console.log(`\nsalvo em ${path.relative(process.cwd(), outDir)}/${slug}.{html,png}`);

await browser.close();
