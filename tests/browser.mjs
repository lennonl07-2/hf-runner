import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:3210");
  await page
    .getByRole("heading", { name: "Todo el potencial. Cero descargas." })
    .waitFor();
  await page.screenshot({ path: "docs/home-desktop.png", fullPage: true });
  await page
    .getByRole("textbox", { name: "Enlace o ID del modelo" })
    .fill("https://huggingface.co/Qwen/Qwen-Image-2.1");
  await page
    .getByRole("button", { name: "Analizar modelo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Analizar modelo", exact: true })
    .waitFor({ timeout: 120000 });
  await page
    .getByRole("heading", { name: "Qwen-Image-2.1", exact: true, level: 2 })
    .waitFor();
  assert((await page.locator(".option-card").count()) > 0);
  assert(
    (await page.getByText("Image Generation", { exact: true }).count()) > 0,
  );
  await page.screenshot({ path: "docs/results-desktop.png", fullPage: true });
  const here = page.getByRole("button", { name: "Usar aquí", exact: true });
  if (await here.count()) {
    await page
      .locator(".option-card")
      .filter({ hasText: "Qwen-Image-2.1 Create" })
      .first()
      .getByRole("button", { name: "Usar aquí" })
      .click();
    await page.locator(".executor").waitFor();
    assert((await page.locator(".executor textarea").count()) > 0);
    await page.screenshot({
      path: "docs/executor-desktop.png",
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Guardar favorito" }).click();
  assert(
    (await page
      .getByRole("heading", { name: "Favoritos", exact: true })
      .count()) > 0,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/results-mobile.png", fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile overflow",
  );
  const storage = await page.evaluate(() => ({ ...localStorage }));
  assert(!JSON.stringify(storage).includes("Authorization"));
  assert(!JSON.stringify(storage).includes("hf_"));
  await fs.writeFile(
    "docs/browser-check.json",
    JSON.stringify(
      {
        cards: await page.locator(".option-card").count(),
        errors,
        storageKeys: Object.keys(storage),
        mobileOverflow: false,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: real Qwen analysis, generated form, favorite, mobile layout, no JS errors.",
  );
} finally {
  await browser.close();
}
