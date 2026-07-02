import { cleanText } from "../helperFunctions/cleanText.js";
import { normalizeAvailability } from "../helperFunctions/normalizeAvailability.js";
import { toNumber } from "../helperFunctions/toNumber.js";
import { parseJsonLdProduct } from "../parser/parseJsonLdProduct.js";

export function buildProductData(raw, finalUrl) {
  const ldProduct = parseJsonLdProduct(raw.ldJsonBlocks || []);

  const title =
    cleanText(raw.title) ||
    cleanText(ldProduct && ldProduct.name) ||
    cleanText(raw.metaTitle);

  let brand = null;
  if (ldProduct && ldProduct.brand) {
    brand =
      typeof ldProduct.brand === "string"
        ? ldProduct.brand
        : ldProduct.brand.name || null;
  }
  if (!brand) {
    const haystack = `${title || ""} ${raw.metaDescription || ""}`;
    if (/\bMSI\b/i.test(haystack)) brand = "MSI";
  }
  brand = cleanText(brand);

  const categoryTree = (raw.categoryTree || [])
    .filter((c) => c.name)
    .map((c, index, arr) => ({
      name: cleanText(c.name),
      url: !c.url && index === arr.length - 1 ? finalUrl : c.url || null,
    }));

  const productCategory = categoryTree.length
    ? categoryTree.map((c) => c.name).join(" > ")
    : null;

  const description =
    cleanText(ldProduct && ldProduct.description) ||
    cleanText(raw.metaDescription) ||
    cleanText(raw.description);

  let price = null;
  let saleprice = null;

  if (ldProduct && ldProduct.offers) {
    const offer = Array.isArray(ldProduct.offers)
      ? ldProduct.offers[0]
      : ldProduct.offers;
    if (offer) {
      const p = toNumber(
        offer.price ||
          (offer.priceSpecification && offer.priceSpecification.price),
      );
      if (p !== null) price = p;
    }
  }

  const priceMatches =
    (raw.mainText || "").match(/(?<!\+)\$[\d,]+\.\d{2}(?!\d)/g) || [];
  const parsedMatches = priceMatches.map(toNumber).filter((n) => n !== null);

  if (parsedMatches.length >= 2) {
    const [first, second] = parsedMatches;
    if (price === null) price = Math.max(first, second);
    const lower = Math.min(first, second);
    if (lower !== price) saleprice = lower;
  } else if (parsedMatches.length === 1) {
    if (price === null) price = parsedMatches[0];
  }

  let availability = null;
  if (ldProduct && ldProduct.offers) {
    const offer = Array.isArray(ldProduct.offers)
      ? ldProduct.offers[0]
      : ldProduct.offers;
    if (offer && offer.availability)
      availability = normalizeAvailability(offer.availability);
  }
  if (!availability) {
    availability = normalizeAvailability(raw.mainText || "");
  }

  const toAbsolute = (src) => {
    try {
      return new URL(src, finalUrl).href;
    } catch (err) {
      return src;
    }
  };

  let imageUrls = (raw.imageSrcs || []).map(toAbsolute).filter(Boolean);
  if (ldProduct && ldProduct.image) {
    const ldImages = Array.isArray(ldProduct.image)
      ? ldProduct.image
      : [ldProduct.image];
    imageUrls = [...ldImages.map(toAbsolute), ...imageUrls];
  }
  if (raw.metaImage) imageUrls = [toAbsolute(raw.metaImage), ...imageUrls];

  const bySize = (url) => {
    const m = url.match(/-(\d+)x(\d+)(?=\.\w+(?:$|\?))/);
    return m ? parseInt(m[1], 10) * parseInt(m[2], 10) : 0;
  };
  const canonicalKey = (url) =>
    url.replace(/-\d+x\d+(?=\.\w+(?:$|\?))/, "").split("?")[0];

  const bestByKey = new Map();
  const orderByKey = [];
  imageUrls.forEach((url) => {
    const key = canonicalKey(url);
    if (!bestByKey.has(key)) {
      bestByKey.set(key, url);
      orderByKey.push(key);
    } else if (bySize(url) > bySize(bestByKey.get(key))) {
      bestByKey.set(key, url);
    }
  });

  const dedupedImages = orderByKey.map((key) => bestByKey.get(key));
  const imageUrl = dedupedImages.length ? dedupedImages[0] : null;
  const additionalImageUrls = dedupedImages.slice(1);

  const specs = (raw.specs || []).map((s) => ({
    name: s.name,
    value: s.value,
  }));

  let itemId =
    (ldProduct && (ldProduct.sku || ldProduct.productID)) ||
    raw.domProductId ||
    null;
  if (!itemId) {
    const slug = decodeURIComponent(
      finalUrl.split("/").filter(Boolean).pop() || "",
    );
    itemId = slug || null;
  }
  itemId = itemId !== null ? String(itemId) : null;

  let mpn = (ldProduct && ldProduct.mpn) || null;
  if (!mpn) {
    const specHit = specs.find((s) =>
      /manufacturer\s*(number|part\s*number)/i.test(s.name),
    );
    if (specHit) mpn = specHit.value;
  }
  mpn = cleanText(mpn);

  let gtin =
    (ldProduct &&
      (ldProduct.gtin13 ||
        ldProduct.gtin12 ||
        ldProduct.gtin8 ||
        ldProduct.gtin ||
        ldProduct.gtin14)) ||
    null;
  if (!gtin) {
    const specHit = specs.find((s) =>
      /\b(gtin|upc|ean|barcode)\b/i.test(s.name),
    );
    if (specHit) gtin = specHit.value;
  }
  gtin = cleanText(gtin);

  let starRating = null;
  let reviewCount = null;

  if (ldProduct && ldProduct.aggregateRating) {
    starRating = toNumber(ldProduct.aggregateRating.ratingValue);
    reviewCount = toNumber(
      ldProduct.aggregateRating.reviewCount ||
        ldProduct.aggregateRating.ratingCount,
    );
  }
  if (starRating === null && raw.domRating)
    starRating = toNumber(raw.domRating);
  if (reviewCount === null && raw.domReviewCount)
    reviewCount = toNumber(raw.domReviewCount);

  if (starRating === null && raw.rawRatingText) {
    const match = raw.rawRatingText.match(/^([\d.]+)\s*\(([\d]+)\)/);
    if (match) {
      starRating = parseFloat(match[1]);
      reviewCount = parseInt(match[2], 10);
    }
  }

  return {
    url: finalUrl,
    item_id: itemId,
    title,
    brand,
    product_category: productCategory,
    category_tree: categoryTree,
    description,
    price,
    sale_price: saleprice,
    availability,
    image_url: imageUrl,
    additional_image_urls: additionalImageUrls,
    specs,
    star_rating: starRating,
    review_count: reviewCount,
    gtin,
    mpn,
    scraped_at: new Date().toISOString(),
  };
}
