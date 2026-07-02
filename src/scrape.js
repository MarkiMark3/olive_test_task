import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(stealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_URL =
  "https://us-store.msi.com/Motherboards/Intel-Platform-Motherboard/INTEL-Z890/MAG-Z890-TOMAHAWK-WIFI";
const OUTPUT_FILE = path.join(__dirname, "..", "output", "product.json");

async function scrape() {
  console.log("Launching stealth browser...");
  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  console.log("Navigating to MSI product page...");
  await page.goto(TARGET_URL, { waitUntil: "load", timeout: 60000 });

  await page.waitForSelector("h2.crop-text-2.title", { timeout: 15000 });
  await page
    .waitForSelector("#average-rating-info", { timeout: 10000 })
    .catch(() => {});
  await page.waitForSelector("#prices-new", { timeout: 10000 }).catch(() => {});
  await page
    .waitForSelector("#carouselImages", { timeout: 10000 })
    .catch(() => {});

  const data = await page.evaluate((pageUrl) => {
    const titleEl = document.querySelector("h2.crop-text-2.title");
    const title = titleEl ? titleEl.textContent.trim() : null;

    const priceEl = document.querySelector("#prices-new");
    const priceText = priceEl
      ? priceEl.textContent.replace(/[^0-9.]/g, "")
      : null;
    const price = priceText ? parseFloat(priceText) : null;

    let availability = null;
    if (priceEl && priceEl.parentElement) {
      const stockSpan = priceEl.parentElement.querySelector(
        "span:not(#prices-new)",
      );
      if (stockSpan) {
        const text = stockSpan.textContent.toLowerCase();
        if (text.includes("in stock")) availability = "in_stock";
        else if (text.includes("out of stock")) availability = "out_of_stock";
      }
    }

    const imgElements = Array.from(
      document.querySelectorAll(
        "#carouselImages .swiper-slide:not(.swiper-slide-duplicate) img",
      ),
    );

    const allImages = imgElements
      .map((img) => img.getAttribute("popup_img") || img.src || img.currentSrc)
      .filter(Boolean);

    const imageUrl = allImages.length > 0 ? allImages[0] : null;
    const additionalImageUrls = allImages.length > 1 ? allImages.slice(1) : [];

    let starRating = null;
    let reviewCount = null;
    const ratingEl = document.querySelector("#average-rating-info");
    if (ratingEl) {
      const match = ratingEl.textContent
        .trim()
        .match(/^([\d.]+)\s*\(([\d]+)\)/);
      if (match) {
        starRating = parseFloat(match[1]);
        reviewCount = parseInt(match[2], 10);
      }
    }

    const categoryTree = [];
    const breadcrumbs = Array.from(
      document.querySelectorAll(".breadcrumbs li, .breadcrumb li"),
    );
    breadcrumbs.forEach((item, idx) => {
      const link = item.querySelector("a");
      const name = (link ? link.textContent : item.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!name) return;

      const url =
        idx === breadcrumbs.length - 1 ? pageUrl : link ? link.href : null;
      categoryTree.push({ name, url });
    });

    const specs = [];
    const listItems = Array.from(
      document.querySelectorAll("#description-list ul li"),
    );
    listItems.forEach((li) => {
      const text = li.textContent.replace(/\s+/g, " ").trim();
      if (text) {
        const colonIndex = text.indexOf(":");
        if (colonIndex !== -1) {
          specs.push({
            name: text.slice(0, colonIndex).trim(),
            value: text.slice(colonIndex + 1).trim(),
          });
        } else {
          specs.push({
            name: "Feature",
            value: text,
          });
        }
      }
    });

    return {
      url: pageUrl,
      item_id: pageUrl.split("/").filter(Boolean).pop() || null,
      title,
      brand: "MSI",
      product_category: categoryTree.map((c) => c.name).join(" > ") || null,
      category_tree: categoryTree,
      price,
      sale_price: null,
      availability,
      image_url: imageUrl,
      additional_image_urls: additionalImageUrls,
      specs,
      star_rating: starRating,
      review_count: reviewCount,
      scraped_at: new Date().toISOString(),
    };
  }, TARGET_URL);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), "utf-8");

  console.log("Extraction complete!");
  console.log(JSON.stringify(data, null, 2));

  await browser.close();
}

scrape().catch((err) => {
  console.error("Execution failed:", err);
  process.exitCode = 1;
});
