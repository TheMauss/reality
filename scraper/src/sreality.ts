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
  price: number;
  lat: number | null;
  lon: number | null;
  region_id: number;
  district_id: number | null;
}

// category_main_cb: 1=byty, 2=domy, 3=pozemky, 4=komerční, 5=ostatní
// category_type_cb: 1=prodej, 2=nájem
// category_sub_cb: sub-categories for byty/domy (used to break large result sets)
const BYT_SUBS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16]; // 1+kk,1+1,...,6+,atypicky
const DUM_SUBS = [37, 39, 43, 44, 33, 54]; // rodinny,vila,chalupa,chata,na-klic,vicegeneracni

interface SearchConfig {
  main: number;
  type: number;
  label: string;
  sub?: number; // category_sub_cb for breaking down large categories
}

// Build configs: byty/domy split by sub-category for more complete results
const SEARCH_CONFIGS: SearchConfig[] = [
  // Byty — split by sub to get past 2000-result limit
  ...BYT_SUBS.map(sub => ({ main: 1, type: 1, label: "byty-prodej", sub })),
  ...BYT_SUBS.map(sub => ({ main: 1, type: 2, label: "byty-najem", sub })),
  // Domy — split by sub
  ...DUM_SUBS.map(sub => ({ main: 2, type: 1, label: "domy-prodej", sub })),
  ...DUM_SUBS.map(sub => ({ main: 2, type: 2, label: "domy-najem", sub })),
  // Pozemky, komerční, ostatní — no sub needed (smaller categories)
  { main: 3, type: 1, label: "pozemky-prodej" },
  { main: 3, type: 2, label: "pozemky-najem" },
  { main: 4, type: 1, label: "komercni-prodej" },
  { main: 4, type: 2, label: "komercni-najem" },
  { main: 5, type: 1, label: "ostatni-prodej" },
  { main: 5, type: 2, label: "ostatni-najem" },
];

// All 14 Czech regions
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
const MAX_PAGES = 100; // ~6000 listings per category per region (Sreality caps at ~2000 but some categories are larger)

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractArea(estate: SrealityEstate): number | null {
  const match = estate.name.match(/(\d+)\s*m²/);
  if (match) return parseInt(match[1], 10);
  return null;
}

// Maps category_sub_cb to the URL slug used by Sreality
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
  if (match) return match[1];
  return "atypicky";
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
): Promise<SrealityResponse> {
  const params = new URLSearchParams({
    category_main_cb: categoryMain.toString(),
    category_type_cb: categoryType.toString(),
    per_page: PER_PAGE.toString(),
    page: page.toString(),
  });
  // Use district-level filter if available, otherwise region
  if (districtId) {
    params.set("locality_district_id", districtId.toString());
  } else {
    params.set("locality_region_id", regionId.toString());
  }
  if (categorySub) {
    params.set("category_sub_cb", categorySub.toString());
  }

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

export interface DistrictInfo {
  id: number;
  region_id: number;
  name: string;
}

/**
 * Scrape listings per district for more complete results and district_id mapping.
 * Falls back to region-level for configs where district doesn't apply.
 */
export async function scrapeAllListings(
  regionIds?: number[],
  districts?: DistrictInfo[]
): Promise<ParsedListing[]> {
  const allListings: ParsedListing[] = [];
  const seenIds = new Set<string>();

  const regionsToScrape = regionIds
    ? REGIONS.filter((r) => regionIds.includes(r.id))
    : REGIONS;

  // If districts provided, scrape per-district for finer granularity
  if (districts && districts.length > 0) {
    const filteredDistricts = regionIds
      ? districts.filter(d => regionIds.includes(d.region_id))
      : districts;

    console.log(`Scraping ${filteredDistricts.length} districts across ${regionsToScrape.length} regions`);

    for (const district of filteredDistricts) {
      const region = REGIONS.find(r => r.id === district.region_id);
      console.log(`\n=== District: ${district.name} (id=${district.id}, region=${region?.name}) ===`);

      for (const config of SEARCH_CONFIGS) {
        const subLabel = config.sub ? ` (sub=${config.sub})` : "";
        let page = 1;
        let hasMore = true;
        let count = 0;

        while (hasMore && page <= MAX_PAGES) {
          try {
            const data = await fetchPage(config.main, config.type, district.region_id, page, config.sub, district.id);
            const estates = data._embedded?.estates || [];

            if (estates.length === 0) {
              hasMore = false;
              break;
            }

            for (const estate of estates) {
              if (!estate.price || estate.price <= 1) continue;
              const eid = estate.hash_id.toString();
              if (seenIds.has(eid)) continue;
              seenIds.add(eid);

              allListings.push({
                id: eid,
                title: estate.name,
                url: buildListingUrl(
                  estate.hash_id,
                  config.type,
                  config.main,
                  estate.seo?.locality || "",
                  estate.seo?.category_sub_cb || 0,
                  estate.name
                ),
                location: estate.locality || estate.seo?.locality || district.name,
                area_m2: extractArea(estate),
                category: config.label,
                price: estate.price,
                lat: estate.gps?.lat ?? null,
                lon: estate.gps?.lon ?? null,
                region_id: district.region_id,
                district_id: district.id,
              });
              count++;
            }

            if (estates.length < PER_PAGE) {
              hasMore = false;
            } else {
              page++;
              await delay(350);
            }
          } catch (err) {
            console.error(`    Error ${config.label}${subLabel} page ${page}:`, err);
            hasMore = false;
          }
        }

        if (count > 0) {
          console.log(`  ${config.label}${subLabel}: ${count} listings (${page} pages)`);
        }
      }

      console.log(`  District total so far: ${allListings.length} listings`);
    }
  } else {
    // Fallback: region-level scraping (no district_id)
    for (const region of regionsToScrape) {
      console.log(`\n=== Region: ${region.name} (id=${region.id}) ===`);

      for (const config of SEARCH_CONFIGS) {
        const subLabel = config.sub ? ` (sub=${config.sub})` : "";
        console.log(`  Scraping ${config.label}${subLabel}...`);
        let page = 1;
        let hasMore = true;
        let regionCategoryCount = 0;

        while (hasMore && page <= MAX_PAGES) {
          try {
            const data = await fetchPage(config.main, config.type, region.id, page, config.sub);
            const estates = data._embedded?.estates || [];

            if (estates.length === 0) {
              hasMore = false;
              break;
            }

            for (const estate of estates) {
              if (!estate.price || estate.price <= 1) continue;
              const eid = estate.hash_id.toString();
              if (seenIds.has(eid)) continue;
              seenIds.add(eid);

              allListings.push({
                id: eid,
                title: estate.name,
                url: buildListingUrl(
                  estate.hash_id,
                  config.type,
                  config.main,
                  estate.seo?.locality || "",
                  estate.seo?.category_sub_cb || 0,
                  estate.name
                ),
                location: estate.locality || estate.seo?.locality || region.name,
                area_m2: extractArea(estate),
                category: config.label,
                price: estate.price,
                lat: estate.gps?.lat ?? null,
                lon: estate.gps?.lon ?? null,
                region_id: region.id,
                district_id: null,
              });
              regionCategoryCount++;
            }

            if (estates.length < PER_PAGE) {
              hasMore = false;
            } else {
              page++;
              await delay(400);
            }
          } catch (err) {
            console.error(`    Error on page ${page}:`, err);
            hasMore = false;
          }
        }

        console.log(`    → ${regionCategoryCount} listings (${page} pages)`);
      }
    }
  }

  console.log(`\nTotal scraped: ${allListings.length} unique listings`);
  return allListings;
}
