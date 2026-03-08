interface SrealityEstate {
  hash_id: number;
  name: string;
  price: number;
  locality: string;
  seo: {
    locality: string;
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

interface ParsedListing {
  id: string;
  title: string;
  url: string;
  location: string;
  area_m2: number | null;
  category: string;
  price: number;
}

// category_main_cb: 1=byty, 2=domy
// category_type_cb: 1=prodej, 2=nájem
const SEARCH_CONFIGS = [
  { main: 1, type: 1, label: "byty-prodej" },
  { main: 1, type: 2, label: "byty-najem" },
  { main: 2, type: 1, label: "domy-prodej" },
  { main: 2, type: 2, label: "domy-najem" },
];

const BASE_URL = "https://www.sreality.cz/api/cs/v2/estates";
const PER_PAGE = 60;
const MAX_PAGES = 10; // 600 listings per category

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractArea(estate: SrealityEstate): number | null {
  const match = estate.name.match(/(\d+)\s*m²/);
  if (match) return parseInt(match[1], 10);
  return null;
}

function buildListingUrl(hashId: number): string {
  return `https://www.sreality.cz/detail/prodej/byt/${hashId}`;
}

async function fetchPage(
  categoryMain: number,
  categoryType: number,
  page: number
): Promise<SrealityResponse> {
  const params = new URLSearchParams({
    category_main_cb: categoryMain.toString(),
    category_type_cb: categoryType.toString(),
    locality_region_id: "10", // Praha
    per_page: PER_PAGE.toString(),
    page: page.toString(),
  });

  const url = `${BASE_URL}?${params}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Sreality API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<SrealityResponse>;
}

export async function scrapeAllListings(): Promise<ParsedListing[]> {
  const allListings: ParsedListing[] = [];

  for (const config of SEARCH_CONFIGS) {
    console.log(`Scraping ${config.label}...`);
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= MAX_PAGES) {
      try {
        const data = await fetchPage(config.main, config.type, page);
        const estates = data._embedded?.estates || [];

        if (estates.length === 0) {
          hasMore = false;
          break;
        }

        for (const estate of estates) {
          if (!estate.price || estate.price <= 1) continue;

          allListings.push({
            id: estate.hash_id.toString(),
            title: estate.name,
            url: buildListingUrl(estate.hash_id),
            location: estate.locality || estate.seo?.locality || "Praha",
            area_m2: extractArea(estate),
            category: config.label,
            price: estate.price,
          });
        }

        console.log(`  Page ${page}: ${estates.length} listings`);

        if (estates.length < PER_PAGE) {
          hasMore = false;
        } else {
          page++;
          await delay(1500); // rate limiting
        }
      } catch (err) {
        console.error(`  Error on page ${page}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`Total scraped: ${allListings.length} listings`);
  return allListings;
}
