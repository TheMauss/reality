/**
 * Fix broken Sreality URLs that are missing disposition and locality segments.
 *
 * Old format (broken):  /detail/prodej/byt/{hash_id}  (4 segments)
 * Correct format:       /detail/prodej/byt/3+kk/praha-smichov/{hash_id}  (6 segments)
 *
 * When we don't have seo locality, we extract what we can from the title
 * and location fields stored in our DB.
 */
export function fixSrealityUrl(
  url: string | null,
  listingId: string,
  title?: string | null,
  location?: string | null,
  category?: string | null
): string {
  // If URL already has 6 segments (correct), return as-is
  if (url) {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts.length >= 6) return url;
  }

  // Determine type and main from category or URL
  let type = "prodej";
  let main = "byt";

  if (category) {
    if (category.includes("najem")) type = "pronajem";
    if (category.includes("domy")) main = "dum";
  } else if (url) {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts[1]) type = parts[1];
    if (parts[2]) main = parts[2];
  }

  // Extract disposition from title: "Prodej bytu 3+kk 84 m²" -> "3+kk"
  let disposition = "atypicky";
  if (title) {
    const match = title.match(/(\d\+(?:kk|\d))/i);
    if (match) disposition = match[1];
  }

  // Build locality slug from location: "Praha 5 - Smíchov" -> "praha-5-smichov"
  let locality = "praha";
  if (location) {
    locality = location
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove diacritics
      .replace(/[^a-z0-9]+/g, "-")     // non-alphanumeric to dash
      .replace(/^-+|-+$/g, "");         // trim dashes
  }

  return `https://www.sreality.cz/detail/${type}/${main}/${disposition}/${locality}/${listingId}`;
}
