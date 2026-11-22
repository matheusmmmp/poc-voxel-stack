// Gera a ficha do asset pelo próprio estúdio (window.__estudio.ficha) e salva o PNG. Uso: node tools/gerar_ficha.cjs <saida.png> [altura em voxels]
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const saida = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  await page.goto("http://localhost:8820/estudio.html");
  await page.waitForFunction(() => window.__poc && window.__poc.PET_MUSH && window.__poc.PET_MUSH.usados, null, { timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  const altura = process.argv[3] ? +process.argv[3] : null;   // altura em voxels (o modelo ocupa altura + 1 camadas)
  if (altura) {
    // espera o modelo NOVO (o objeto troca quando a reconversão termina) e o empilhamento que a troca dispara
    await page.evaluate((h) => { window.__antigo = window.__poc.PET_MUSH; const el = document.getElementById("altura"); el.value = h; el.dispatchEvent(new Event("change")); }, altura);
    await page.waitForFunction(() => window.__poc.PET_MUSH !== window.__antigo && window.__poc.PET === window.__poc.PET_MUSH, null, { timeout: 120000 });
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(800);
  const url = await page.evaluate(() => window.__estudio.ficha());
  fs.writeFileSync(saida, Buffer.from(url.split(",")[1], "base64"));
  console.log("ok", saida, fs.statSync(saida).size, "bytes");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
