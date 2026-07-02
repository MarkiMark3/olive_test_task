export function extractFromPage() {
  const result = {};

  function cleanTextLocal(value) {
    if (value === null || value === undefined) return null;
    const t = String(value).replace(/\s+/g, " ").trim();
    return t.length ? t : null;
  }

  const bodyText = document.body ? document.body.innerText || "" : "";
  const recommendedIdx = bodyText.search(/RECOMMENDED FOR YOU/i);
  const mainText =
    recommendedIdx > -1 ? bodyText.slice(0, recommendedIdx) : bodyText;

  const ldJsonBlocks = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  )
    .map((el) => el.textContent)
    .filter(Boolean);
  result.ldJsonBlocks = ldJsonBlocks;

  const getMeta = (selector) => {
    const el = document.querySelector(selector);
    return el ? el.getAttribute("content") : null;
  };
  result.metaDescription =
    getMeta('meta[name="description"]') ||
    getMeta('meta[property="og:description"]');
  result.metaTitle = getMeta('meta[property="og:title"]');
  result.metaImage = getMeta('meta[property="og:image"]');
  result.canonicalUrl =
    (document.querySelector('link[rel="canonical"]') || {}).href || null;

  let titleEl = document.querySelector("h2.crop-text-2.title");

  if (!titleEl) {
    const allH1s = Array.from(document.querySelectorAll("h1"));
    for (const h1 of allH1s) {
      const text = h1.textContent.trim();
      if (/cookie|choice|regarding cookies|consent|privacy/i.test(text))
        continue;
      if (
        h1.closest(
          '#cookie, [id*="cookie" i], [class*="cookie" i], #onetrust-consent-sdk',
        )
      )
        continue;
      titleEl = h1;
      break;
    }
  }

  if (!titleEl) {
    titleEl = document.querySelector(
      ".page-title span, .product-info-main .page-title, h1.product-title",
    );
  }

  result.title = titleEl ? titleEl.textContent.trim() : null;

  let crumbContainer =
    document.querySelector('[itemtype*="BreadcrumbList"]') ||
    document.querySelector('nav[aria-label="breadcrumb" i]') ||
    document.querySelector(".breadcrumb, ol.breadcrumb, ul.breadcrumb");

  if (!crumbContainer) {
    const candidates = Array.from(document.querySelectorAll("nav, ol, ul"));
    crumbContainer =
      candidates.find((el) => {
        const links = el.querySelectorAll("a");
        if (links.length < 2 || links.length > 8) return false;
        const text = el.textContent.trim();
        return /home/i.test(text) && text.length < 400;
      }) || null;
  }

  const categoryTree = [];
  if (crumbContainer) {
    const items = crumbContainer.querySelectorAll(
      'li, [itemprop="itemListElement"]',
    );
    const source = items.length
      ? Array.from(items)
      : Array.from(crumbContainer.children);
    source.forEach((item) => {
      const link = item.querySelector("a");
      const name = (link ? link.textContent : item.textContent || "").trim();
      if (!name) return;
      const url = link ? link.href : null;
      categoryTree.push({ name, url });
    });
  }
  result.categoryTree = categoryTree;

  let description = null;
  if (titleEl) {
    let node = titleEl.nextElementSibling;
    let hops = 0;
    while (node && hops < 12 && !description) {
      const tag = node.tagName ? node.tagName.toLowerCase() : "";
      const text = (node.textContent || "").trim();
      if (tag === "p" && text.length > 40) {
        description = text;
      } else if (
        text.length > 60 &&
        !/^https?:/i.test(text) &&
        node.querySelectorAll("li").length === 0
      ) {
        description = text;
      }
      node = node.nextElementSibling;
      hops += 1;
    }
  }
  result.description = description;

  const allImgs = Array.from(document.querySelectorAll("img"));
  let galleryImgs = [];
  if (titleEl) {
    const titleNorm = titleEl.textContent.trim().toLowerCase();
    galleryImgs = allImgs.filter((img) => {
      const alt = (img.getAttribute("alt") || "").trim().toLowerCase();
      return alt && alt === titleNorm;
    });
  }
  if (!galleryImgs.length) {
    galleryImgs = allImgs.filter((img) =>
      /\/catalog\//i.test(img.src || img.currentSrc || ""),
    );
  }
  const imageSrcs = galleryImgs
    .map((img) => img.getAttribute("src") || img.currentSrc)
    .filter(Boolean);
  result.imageSrcs = imageSrcs;

  const specs = [];
  const seenSpecKeys = new Set();
  const pushSpec = (name, value) => {
    const n = cleanTextLocal(name);
    const v = cleanTextLocal(value);
    if (!n) return;
    const dedupeKey = `${n}::${v}`;
    if (seenSpecKeys.has(dedupeKey)) return;
    seenSpecKeys.add(dedupeKey);
    specs.push({ name: n, value: v });
  };

  const tables = Array.from(document.querySelectorAll("table"));
  tables.forEach((table) => {
    const rows = Array.from(table.querySelectorAll("tr"));
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll("th, td"));
      if (cells.length === 2) {
        pushSpec(cells[0].textContent, cells[1].textContent);
      }
    });
  });

  if (!specs.length) {
    Array.from(document.querySelectorAll("dl")).forEach((dl) => {
      const dts = Array.from(dl.querySelectorAll("dt"));
      dts.forEach((dt) => {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName && dd.tagName.toLowerCase() === "dd") {
          pushSpec(dt.textContent, dd.textContent);
        }
      });
    });
  }
  result.specs = specs;

  result.mainText = mainText;

  const idInput =
    document.querySelector('input[name="product_id"]') ||
    document.querySelector("[data-product-id]") ||
    document.querySelector("[data-entity-id]");
  result.domProductId = idInput
    ? idInput.getAttribute("value") ||
      idInput.getAttribute("data-product-id") ||
      idInput.getAttribute("data-entity-id")
    : null;

  const ratingEl = document.querySelector('[itemprop="ratingValue"]');
  const reviewCountEl = document.querySelector('[itemprop="reviewCount"]');
  result.domRating = ratingEl
    ? ratingEl.getAttribute("content") || ratingEl.textContent
    : null;
  result.domReviewCount = reviewCountEl
    ? reviewCountEl.getAttribute("content") || reviewCountEl.textContent
    : null;

  const directRatingInfo = document.querySelector("#average-rating-info");
  result.rawRatingText = directRatingInfo
    ? directRatingInfo.textContent.trim()
    : null;

  return result;
}
