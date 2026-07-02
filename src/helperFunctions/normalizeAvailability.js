export function normalizeAvailability(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/(out of stock|sold out|unavailable|notify me)/.test(t))
    return "out_of_stock";
  if (/(pre[\s-]?order|coming soon)/.test(t)) return "pre_order";
  if (/(in stock|available|in-stock|ships)/.test(t)) return "in_stock";
  return null;
}
