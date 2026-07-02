export function parseJsonLdProduct(blocks) {
  for (const raw of blocks) {
    try {
      const parsed = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of candidates) {
        const graph = node["@graph"] ? node["@graph"] : [node];
        for (const g of graph) {
          const type = g["@type"];
          const isProduct =
            type === "Product" ||
            (Array.isArray(type) && type.includes("Product"));
          if (isProduct) return g;
        }
      }
    } catch (err) {}
  }
  return null;
}
