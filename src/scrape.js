import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import { extractFromPage } from "./extractor/extractFromPage.js";
import { buildProductData } from "./builder/buildProductData.js";

chromium.use(stealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_URL =
  "https://us-store.msi.com/Motherboards/Intel-Platform-Motherboard/INTEL-Z890/MAG-Z890-TOMAHAWK-WIFI";

const OUTPUT_DIR = path.join(__dirname, "..", "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "product.json");

async function scrape() {
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    await page.goto(TARGET_URL, {
      waitUntil: "load",
      timeout: 60000,
    });

    const delay = 3000 + Math.random() * 2000;

    await page.waitForTimeout(delay);

    await page.waitForSelector("h2.crop-text-2.title, h1", { timeout: 30000 });
    await page
      .waitForSelector("#average-rating-info", { timeout: 10000 })
      .catch(() => {});

    await Promise.race([
      page
        .waitForSelector("text=/\\$[0-9]/", { timeout: 15000 })
        .catch(() => {}),
      page.waitForTimeout(15000),
    ]);

    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});

    const raw = await page.evaluate(extractFromPage);
    const finalUrl = page.url();

    const product = buildProductData(raw, finalUrl);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(product, null, 2), "utf-8");

    console.log(JSON.stringify(product, null, 2));
  } finally {
    await browser.close();
  }
}

scrape().catch((err) => {
  console.error("Scrape failed:", err);
  process.exitCode = 1;
});
