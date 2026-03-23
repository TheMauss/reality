interface SrealityEstate {
  hash_id: number;
  name: string;
  price: number;
  locality: string;
  seo: {
    locality: string;
    category_main_cb: number;
    category_sub_cb: number;
    category_type_cb: number;
  };
  gps?: {
    lat: number;
    lon: number;
  };
  labelsAll?: Array<{ title_name?: string }>;
  items?: Array<{ name: string; value: number | string }>;
}

interface SrealityResponse {
  _embedded: {
    estates: SrealityEstate[];
  };
  result_size: number;
  per_page: number;
}

export interface ParsedListing {
  id: string;
  title: string;
  url: string;
  location: string;
  area_m2: number | null;
  category: string;
  dispozice: string | null;
  price: number;
  lat: number | null;
  lon: number | null;
  region_id: number;
  district_id: number | null;
}

// category_main_cb: 1=byty, 2=domy, 3=pozemky, 4=komerční, 5=ostatní
// category_type_cb: 1=prodej, 2=nájem
const BYT_SUBS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16]; // 1+kk,1+1,...,6+,atypicky
const DUM_SUBS = [37, 39, 43, 44, 33, 54]; // rodinny,vila,chalupa,chata,na-klic,vicegeneracni

interface SearchConfig {
  main: number;
  type: number;
  label: string;
  sub?: number;
}

const SEARCH_CONFIGS: SearchConfig[] = [
  ...BYT_SUBS.map(sub => ({ main: 1, type: 1, label: "byty-prodej", sub })),
  ...BYT_SUBS.map(sub => ({ main: 1, type: 2, label: "byty-najem", sub })),
  ...DUM_SUBS.map(sub => ({ main: 2, type: 1, label: "domy-prodej", sub })),
  ...DUM_SUBS.map(sub => ({ main: 2, type: 2, label: "domy-najem", sub })),
  { main: 3, type: 1, label: "pozemky-prodej" },
  { main: 3, type: 2, label: "pozemky-najem" },
  { main: 4, type: 1, label: "komercni-prodej" },
  { main: 4, type: 2, label: "komercni-najem" },
  { main: 5, type: 1, label: "ostatni-prodej" },
  { main: 5, type: 2, label: "ostatni-najem" },
];

// Fast scan configs: no sub-category filter so each request covers the whole category.
// Sreality sorts by "trideni=2" (newest/last-updated first), so repriced listings
// bubble to the top alongside new ones — both get caught.
const FAST_SCAN_CONFIGS: SearchConfig[] = [
  { main: 1, type: 1, label: "byty-prodej" },
  { main: 1, type: 2, label: "byty-najem" },
  { main: 2, type: 1, label: "domy-prodej" },
  { main: 2, type: 2, label: "domy-najem" },
  { main: 3, type: 1, label: "pozemky-prodej" },
  { main: 4, type: 1, label: "komercni-prodej" },
];

const REGIONS = [
  { id: 1, name: "Jihočeský" },
  { id: 2, name: "Plzeňský" },
  { id: 3, name: "Karlovarský" },
  { id: 4, name: "Ústecký" },
  { id: 5, name: "Liberecký" },
  { id: 6, name: "Královéhradecký" },
  { id: 7, name: "Pardubický" },
  { id: 8, name: "Olomoucký" },
  { id: 9, name: "Zlínský" },
  { id: 10, name: "Praha" },
  { id: 11, name: "Středočeský" },
  { id: 12, name: "Moravskoslezský" },
  { id: 13, name: "Vysočina" },
  { id: 14, name: "Jihomoravský" },
];

const BASE_URL = "https://www.sreality.cz/api/cs/v2/estates";
const PER_PAGE = 60;
const MAX_PAGES = 33;              // Sreality hard cap ~2000 results per query
const MAX_RESULT_SIZE = PER_PAGE * MAX_PAGES; // 1980
const PRICE_MAX = 999_999_999;     // 1B CZK practical upper bound
const MAX_SPLIT_DEPTH = 8;         // 2^8 = 256 sub-buckets per range — enough for any district

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractArea(estate: SrealityEstate): number | null {
  const match = estate.name.match(/(\d+)\s*m²/);
  if (match) return parseInt(match[1], 10);
  return null;
}

const BYT_SUB_SLUGS: Record<number, string> = {
  2: "1+kk", 3: "1+1", 4: "2+kk", 5: "2+1",
  6: "3+kk", 7: "3+1", 8: "4+kk", 9: "4+1",
  10: "5+kk", 11: "5+1", 12: "6-a-vice", 16: "atypicky",
};

const DUM_SUB_SLUGS: Record<number, string> = {
  37: "rodinny", 39: "vila", 43: "chalupa", 44: "chata",
  33: "na-klic", 54: "vicegeneracni",
};

function extractDispositionFromName(name: string): string {
  const match = name.match(/(\d\+(?:kk|\d))/i);
  if (match) return match[1].toLowerCase();
  return "atypicky";
}

function extractDispozice(categoryMain: number, categorySub: number, name: string): string | null {
  if (categoryMain === 1) {
    // byty — použij slug nebo extrahuj z názvu
    return BYT_SUB_SLUGS[categorySub] || extractDispositionFromName(name);
  }
  if (categoryMain === 2) {
    // domy — typ domu jako dispozice
    return DUM_SUB_SLUGS[categorySub] || extractDispositionFromName(name);
  }
  // pozemky, komerční, ostatní — bez dispozice
  return null;
}

function buildListingUrl(
  hashId: number,
  categoryType: number,
  categoryMain: number,
  seoLocality: string,
  categorySub: number,
  name: string
): string {
  const type = categoryType === 1 ? "prodej" : "pronajem";
  const mainMap: Record<number, string> = { 1: "byt", 2: "dum", 3: "pozemek", 4: "komercni", 5: "ostatni" };
  const main = mainMap[categoryMain] || "byt";
  const locality = seoLocality || "ceska-republika";

  let disposition: string;
  if (categoryMain === 1) {
    disposition = BYT_SUB_SLUGS[categorySub] || extractDispositionFromName(name);
  } else {
    disposition = DUM_SUB_SLUGS[categorySub] || extractDispositionFromName(name);
  }

  return `https://www.sreality.cz/detail/${type}/${main}/${disposition}/${locality}/${hashId}`;
}

async function fetchPage(
  categoryMain: number,
  categoryType: number,
  regionId: number,
  page: number,
  categorySub?: number,
  districtId?: number,
  priceFrom?: number,
  priceTo?: number,
  sort?: number, // trideni: 0=default, 2=newest/last-updated first
): Promise<SrealityResponse> {
  const params = new URLSearchParams({
    category_main_cb: categoryMain.toString(),
    category_type_cb: categoryType.toString(),
    per_page: PER_PAGE.toString(),
    page: page.toString(),
  });
  if (districtId) {
    params.set("locality_district_id", districtId.toString());
  } else {
    params.set("locality_region_id", regionId.toString());
  }
  if (categorySub) {
    params.set("category_sub_cb", categorySub.toString());
  }
  if (priceFrom !== undefined) params.set("price_from", priceFrom.toString());
  if (priceTo !== undefined) params.set("price_to", priceTo.toString());
  if (sort !== undefined) params.set("trideni", sort.toString());

  const url = `${BASE_URL}?${params}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "cs-CZ,cs;q=0.9",
      },
    });

    if (res.status === 429) {
      const waitMs = 3000 * Math.pow(2, attempt);
      console.warn(`    ⚠ Rate limited, waiting ${waitMs / 1000}s...`);
      await delay(waitMs);
      continue;
    }

    if (!res.ok) {
      if (attempt < 3) {
        await delay(1000 * attempt);
        continue;
      }
      throw new Error(`Sreality API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<SrealityResponse>;
  }

  throw new Error(`Failed after retries: ${url}`);
}

/**
 * Scrape a single category+locality+price_range bucket.
 * If result_size > Sreality's cap, recursively splits by price range (binary search)
 * until each sub-bucket fits within the API limit.
 */
async function scrapeBucket(
  config: SearchConfig,
  regionId: number,
  districtId: number | undefined,
  priceFrom: number,
  priceTo: number,
  depth: number,
): Promise<SrealityEstate[]> {
  const firstData = await fetchPage(config.main, config.type, regionId, 1, config.sub, districtId, priceFrom, priceTo);
  const resultSize = firstData.result_size || 0;
  const firstEstates = firstData._embedded?.estates || [];

  // If over cap and can still split, recurse with halved price ranges
  if (resultSize > MAX_RESULT_SIZE && depth < MAX_SPLIT_DEPTH) {
    const mid = Math.floor((priceFrom + priceTo) / 2);
    if (mid > priceFrom && mid < priceTo) {
      const lower = await scrapeBucket(config, regionId, districtId, priceFrom, mid, depth + 1);
      const upper = await scrapeBucket(config, regionId, districtId, mid + 1, priceTo, depth + 1);
      return [...lower, ...upper];
    }
    console.warn(`  ⚠ Price range ${priceFrom}-${priceTo} unsplittable, result_size=${resultSize} — accepting truncation`);
  }

  // Paginate all available pages
  const results: SrealityEstate[] = [...firstEstates];
  let page = 2;
  let hasMore = firstEstates.length === PER_PAGE;

  while (hasMore && page <= MAX_PAGES) {
    await delay(350);
    const data = await fetchPage(config.main, config.type, regionId, page, config.sub, districtId, priceFrom, priceTo);
    const estates = data._embedded?.estates || [];
    if (estates.length === 0) break;
    results.push(...estates);
    if (estates.length < PER_PAGE) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return results;
}

function parseListing(
  estate: SrealityEstate,
  config: SearchConfig,
  regionId: number,
  districtId: number | null,
  fallbackLocality: string,
): ParsedListing {
  const categorySub = estate.seo?.category_sub_cb || 0;
  return {
    id: estate.hash_id.toString(),
    title: estate.name,
    url: buildListingUrl(
      estate.hash_id,
      config.type,
      config.main,
      estate.seo?.locality || "",
      categorySub,
      estate.name
    ),
    location: estate.locality || estate.seo?.locality || fallbackLocality,
    area_m2: extractArea(estate),
    category: config.label,
    dispozice: extractDispozice(config.main, categorySub, estate.name),
    price: estate.price,
    lat: estate.gps?.lat ?? null,
    lon: estate.gps?.lon ?? null,
    region_id: regionId,
    district_id: districtId,
  };
}

export interface DistrictInfo {
  id: number;
  region_id: number;
  name: string;
}

export async function scrapeAllListings(
  regionIds?: number[],
  districts?: DistrictInfo[]
): Promise<ParsedListing[]> {
  const allListings: ParsedListing[] = [];
  const seenIds = new Set<string>();

  const regionsToScrape = regionIds
    ? REGIONS.filter((r) => regionIds.includes(r.id))
    : REGIONS;

  if (districts && districts.length > 0) {
    const filteredDistricts = regionIds
      ? districts.filter(d => regionIds.includes(d.region_id))
      : districts;

    console.log(`Scraping ${filteredDistricts.length} districts across ${regionsToScrape.length} regions`);

    for (const district of filteredDistricts) {
      const region = REGIONS.find(r => r.id === district.region_id);
      console.log(`\n=== District: ${district.name} (id=${district.id}, region=${region?.name}) ===`);

      for (const config of SEARCH_CONFIGS) {
        const subLabel = config.sub ? ` sub=${config.sub}` : "";
        const estates = await scrapeBucket(config, district.region_id, district.id, 0, PRICE_MAX, 0);

        let count = 0;
        for (const estate of estates) {
          if (!estate.price || estate.price <= 1) continue;
          const eid = estate.hash_id.toString();
          if (seenIds.has(eid)) continue;
          seenIds.add(eid);
          allListings.push(parseListing(estate, config, district.region_id, district.id, district.name));
          count++;
        }

        if (count > 0) {
          console.log(`  ${config.label}${subLabel}: ${count}`);
        }
      }

      console.log(`  → Total so far: ${allListings.length}`);
    }
  } else {
    for (const region of regionsToScrape) {
      console.log(`\n=== Region: ${region.name} (id=${region.id}) ===`);

      for (const config of SEARCH_CONFIGS) {
        const subLabel = config.sub ? ` sub=${config.sub}` : "";
        const estates = await scrapeBucket(config, region.id, undefined, 0, PRICE_MAX, 0);

        let count = 0;
        for (const estate of estates) {
          if (!estate.price || estate.price <= 1) continue;
          const eid = estate.hash_id.toString();
          if (seenIds.has(eid)) continue;
          seenIds.add(eid);
          allListings.push(parseListing(estate, config, region.id, null, region.name));
          count++;
        }

        if (count > 0) {
          console.log(`  ${config.label}${subLabel}: ${count}`);
        }
      }
    }
  }

  console.log(`\nTotal scraped: ${allListings.length} unique listings`);
  return allListings;
}

/**
 * Fast scan: sort by newest/last-updated, stop early when we hit a known listing.
 * Catches new listings and repriced ones (Sreality bumps updated listings to top).
 * Does NOT handle delistings — that requires a full scan.
 *
 * @param knownIds  Set of listing IDs already in DB. Used for early termination.
 * @param regionIds Optional filter; defaults to all 14 regions.
 */
export async function scrapeLatestListings(
  knownIds: Set<string>,
  regionIds?: number[],
): Promise<ParsedListing[]> {
  const regionsToScan = regionIds
    ? REGIONS.filter(r => regionIds.includes(r.id))
    : REGIONS;

  const results: ParsedListing[] = [];
  const seenIds = new Set<string>();
  const MAX_FAST_PAGES = 3; // max 180 listings per category+region before we give up
  const FAST_DELAY = 80;    // ms between requests — lighter than full scan's 350ms

  for (const region of regionsToScan) {
    for (const config of FAST_SCAN_CONFIGS) {
      let hitKnown = false;

      for (let page = 1; page <= MAX_FAST_PAGES; page++) {
        if (page > 1) await delay(FAST_DELAY);

        let data: SrealityResponse;
        try {
          data = await fetchPage(config.main, config.type, region.id, page, undefined, undefined, undefined, undefined, 2);
        } catch {
          break; // skip this config on error, don't abort whole scan
        }

        const estates = data._embedded?.estates || [];
        if (estates.length === 0) break;

        for (const estate of estates) {
          const id = estate.hash_id.toString();

          if (knownIds.has(id)) {
            // First listing we already know → everything after is also known (sorted by newest)
            hitKnown = true;
            break;
          }

          if (!estate.price || estate.price <= 1) continue;
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          results.push(parseListing(estate, config, region.id, null, region.name));
        }

        if (hitKnown || estates.length < PER_PAGE) break;
      }

      await delay(FAST_DELAY);
    }
  }

  return results;
}
