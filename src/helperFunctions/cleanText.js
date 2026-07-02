export function cleanText(value) {
  if (value === null || value === undefined) return null;
  const t = String(value).replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}
