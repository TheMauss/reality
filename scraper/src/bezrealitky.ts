// Bezrealitky.cz scraper via GraphQL API

const GQL_URL = "https://api.bezrealitky.cz/graphql/";

const GQL_QUERY = `
query ListAdverts($offerType: [OfferType], $estateType: [EstateType], $limit: Int, $offset: Int, $order: ResultOrder, $regionOsmIds: [ID]) {
  listAdverts(
    offerType: $offerType
    estateType: $estateType
    limit: $limit
    offset: $offset
    order: $order
    regionOsmIds: $regionOsmIds
  ) {
    list {
      id
      uri
      title
      description
      price
      surface
      gps { lat lng }
      address(locale: CS)
      mainImage { url(filter: RECORD_MAIN) }
    }
    totalCount
  }
}
`;

export interface ParsedBRListing {
  source_id: string;
  title: string;
  url: string;
  location: string;
  area_m2: number | null;
  category: string;
  dispozice: string | null;
  price: number;
  lat: number | null;
  lon: number | null;
  description: string | null;
  image_url: string | null;
  region_id: null;
}

type OfferType = "PRODEJ" | "PRONAJEM";
type EstateType = "BYT" | "DUM" | "POZEMEK" | "KOMERCNI";

interface ScanConfig {
  offerType: OfferType;
  estateType: EstateType[];
  category: string;
}

const SCAN_CONFIGS: ScanConfig[] = [
  { offerType: "PRODEJ",   estateType: ["BYT"],      category: "byty-prodej" },
  { offerType: "PRONAJEM", estateType: ["BYT"],      category: "byty-najem" },
  { offerType: "PRODEJ",   estateType: ["DUM"],      category: "domy-prodej" },
  { offerType: "PRONAJEM", estateType: ["DUM"],      category: "domy-najem" },
  { offerType: "PRODEJ",   estateType: ["POZEMEK"],  category: "pozemky-prodej" },
  { offerType: "PRODEJ",   estateType: ["KOMERCNI"], category: "komercni-prodej" },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GQLAdvert {
  id: string;
  uri: string;
  title: string | null;
  description: string | null;
  price: number | null;
  surface: number | null;
  gps: { lat: number; lng: number } | null;
  address: string | null;
  mainImage: { url: string } | null;
}

interface GQLResponse {
  data?: {
    listAdverts?: {
      list: GQLAdvert[];
      totalCount: number;
    };
  };
  errors?: Array<{ message: string }>;
}

async function fetchGQL(
  offerType: OfferType,
  estateType: EstateType[],
  limit: number,
  offset: number,
  order?: string,
): Promise<{ list: GQLAdvert[]; totalCount: number }> {
  const variables: Record<string, unknown> = { offerType: [offerType], estateType, limit, offset, regionOsmIds: [51684] };
  if (order) variables.order = order;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(GQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Origin": "https://www.bezrealitky.cz",
          "Referer": "https://www.bezrealitky.cz/",
        },
        body: JSON.stringify({ query: GQL_QUERY, variables }),
      });
    } catch (err) {
      if (attempt < 3) {
        await delay(1000 * attempt);
        continue;
      }
      throw err;
    }

    if (res.status === 429) {
      const waitMs = 3000 * Math.pow(2, attempt);
      console.warn(`    ⚠ Bezrealitky rate limited, waiting ${waitMs / 1000}s...`);
      await delay(waitMs);
      continue;
    }

    if (!res.ok) {
      if (attempt < 3) {
        await delay(1000 * attempt);
        continue;
      }
      throw new Error(`Bezrealitky API error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as GQLResponse;
    if (json.errors && json.errors.length > 0) {
      throw new Error(`Bezrealitky GraphQL error: ${json.errors[0].message}`);
    }

    const result = json.data?.listAdverts;
    if (!result) throw new Error("Bezrealitky: empty listAdverts in response");
    return result;
  }

  throw new Error(`Bezrealitky: failed after retries (${offerType} ${estateType.join(",")} offset=${offset})`);
}

function extractDispoziceBR(title: string | null, category: string): string | null {
  if (!title) return null;
  // pokoj / spolubydlení
  if (/pokoj|spolubydl/i.test(title)) {
    return /spolubydl/i.test(title) ? "spolecne bydleni" : "pokoj";
  }
  // byty/domy — disposition like 2+kk, 3+1 etc.
  if (category.startsWith("byty") || category.startsWith("domy")) {
    const match = title.match(/(\d\+(?:kk|\d))/i);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

function parseAdvert(advert: GQLAdvert, category: string): ParsedBRListing | null {
  const price = advert.price;
  if (!price || price <= 1) return null;

  const url = `https://www.bezrealitky.cz/nemovitosti-byty-domy/${advert.uri}`;
  const location = advert.address || "";
  const title = advert.title || location || `Bezrealitky #${advert.id}`;

  return {
    source_id: advert.id,
    title,
    url,
    location,
    area_m2: advert.surface ?? null,
    category,
    dispozice: extractDispoziceBR(title, category),
    price,
    lat: advert.gps?.lat ?? null,
    lon: advert.gps?.lng ?? null,
    description: advert.description ?? null,
    image_url: advert.mainImage?.url ?? null,
    region_id: null,
  };
}

export async function scrapeAllBezrealitky(
  _regionIds?: number[],
): Promise<ParsedBRListing[]> {
  const results: ParsedBRListing[] = [];
  const seenIds = new Set<string>();
  const LIMIT = 25;
  const PAGE_DELAY = 400;

  for (const config of SCAN_CONFIGS) {
    console.log(`\nBR full: ${config.category}`);
    let offset = 0;
    let totalCount = Infinity;

    while (offset < totalCount) {
      try {
        const page = await fetchGQL(config.offerType, config.estateType, LIMIT, offset);
        totalCount = page.totalCount;

        for (const advert of page.list) {
          if (seenIds.has(advert.id)) continue;
          seenIds.add(advert.id);
          const parsed = parseAdvert(advert, config.category);
          if (parsed) results.push(parsed);
        }

        console.log(`  offset=${offset} total=${totalCount} so_far=${results.length}`);

        if (page.list.length < LIMIT) break;
        offset += LIMIT;
        await delay(PAGE_DELAY);
      } catch (err) {
        console.error(`  BR full error at offset=${offset}:`, err);
        break;
      }
    }
  }

  console.log(`\nBR full: ${results.length} listings scraped`);
  return results;
}

export async function scrapeLatestBezrealitky(
  knownSourceIds: Set<string>,
): Promise<ParsedBRListing[]> {
  const results: ParsedBRListing[] = [];
  const seenIds = new Set<string>();
  const LIMIT = 25;
  const MAX_PAGES = 3;
  const FAST_DELAY = 150;

  for (const config of SCAN_CONFIGS) {
    let hitKnown = false;

    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * LIMIT;
      if (page > 0) await delay(FAST_DELAY);

      let pageData: { list: GQLAdvert[]; totalCount: number };
      try {
        pageData = await fetchGQL(config.offerType, config.estateType, LIMIT, offset, "TIMEORDER_DESC");
      } catch (err) {
        console.error(`  BR fast error (${config.category} page=${page}):`, err);
        break;
      }

      for (const advert of pageData.list) {
        if (knownSourceIds.has(advert.id)) {
          hitKnown = true;
          break;
        }
        if (seenIds.has(advert.id)) continue;
        seenIds.add(advert.id);
        const parsed = parseAdvert(advert, config.category);
        if (parsed) results.push(parsed);
      }

      if (hitKnown || pageData.list.length < LIMIT) break;
    }

    await delay(FAST_DELAY);
  }

  return results;
}
