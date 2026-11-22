// Tira as capturas do README só com modelos de licença livre (Mushnub e Nature Kit, CC0). Rode sem o assets/agumon.glb na pasta
// (como num clone do repositório) e com o servidor na porta 8820. Uso: node tools/capturas_readme.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const esperarPronto = (page) => page.waitForFunction(() => window.__poc && window.__poc.PET_MUSH && window.__poc.PET_MUSH.usados, null, { timeout: 90000 });
(async () => {
  fs.mkdirSync("docs", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => console.error("pageerror:", e.message));

  // a POC original: o Mushnub na ilha com o Nature Kit
  await page.goto("http://localhost:8820/index.html");
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "docs/ilha.png" });

  // o estúdio com o Mushnub (a reserva quando o agumon.glb não está na pasta)
  await page.goto("http://localhost:8820/estudio.html");
  await esperarPronto(page);
  await page.evaluate(() => document.fonts.ready);
  const info = await page.evaluate(() => document.getElementById("info").textContent + " | " + window.__poc.PET.nome);
  console.log("estudio:", info);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "docs/estudio.png" });

  // as fatias abertas, no modo foto
  await page.evaluate(() => { window.__estudio.modoFoto(true); window.__estudio.irPreset("tres"); window.__estudio.explodir(); });
  await page.waitForTimeout(900);
  await page.screenshot({ path: "docs/fatias_abertas.png" });
  await page.evaluate(() => window.__estudio.modoFoto(false));
  await page.waitForTimeout(1500);

  // a ficha do asset
  const url = await page.evaluate(() => window.__estudio.ficha());
  fs.writeFileSync("docs/ficha_mushnub.png", Buffer.from(url.split(",")[1], "base64"));

  // a página do Agumon também cai no Mushnub
  await page.goto("http://localhost:8820/agumon.html");
  await esperarPronto(page);
  console.log("agumon.html:", await page.evaluate(() => window.__poc.PET_MUSH.nome));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
