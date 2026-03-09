import "dotenv/config";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH =
  process.env.SQLITE_PATH || path.join(__dirname, "..", "..", "cenovypad.db");

const SREALITY_BASE = "https://www.sreality.cz/api/v1/price_map";
const DATE_FROM = "2018-01";
const _now = new Date();
const DATE_TO = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}`;

// Yearly ranges for transaction fetching (bypasses estate_list cap ~1800)
const YEAR_RANGES = [
  { from: "2018-01", to: "2018-12" },
  { from: "2019-01", to: "2019-12" },
  { from: "2020-01", to: "2020-12" },
  { from: "2021-01", to: "2021-12" },
  { from: "2022-01", to: "2022-12" },
  { from: "2023-01", to: "2023-12" },
  { from: "2024-01", to: "2024-12" },
  { from: "2025-01", to: "2025-12" },
  { from: "2026-01", to: "2026-12" },
];

// Scrape both byty (1) and domy (2) from cenová mapa
const SOLD_CATEGORIES = [
  { main: "1", label: "byty" },
  { main: "2", label: "domy" },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let requestCount = 0;
let rateLimitHits = 0;

async function srealityFetch(
  apiPath: string,
  params: Record<string, string>,
  retries = 3
): Promise<unknown> {
  const sp = new URLSearchParams(params);
  const url = `${SREALITY_BASE}/${apiPath}?${sp}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    requestCount++;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "cs-CZ,cs;q=0.9",
      },
    });

    if (res.status === 429) {
      rateLimitHits++;
      const waitMs = Math.min(2000 * Math.pow(2, attempt), 30000);
      console.warn(`  ⚠ Rate limited (429), waiting ${waitMs / 1000}s... (attempt ${attempt}/${retries})`);
      await delay(waitMs);
      continue;
    }

    if (!res.ok) {
      if (attempt < retries) {
        await delay(1000 * attempt);
        continue;
      }
      throw new Error(`Sreality API ${res.status} for ${url}`);
    }

    return res.json();
  }

  throw new Error(`Failed after ${retries} retries: ${url}`);
}

interface SrealityLocality {
  name: string;
  entity_type: string;
  entity_id: number;
  seo_name: string;
}

interface SrealityAggItem {
  locality: SrealityLocality;
  avg_price_per_sqm: number | null;
  num_transactions: number;
  price_change: number | null;
}

interface SrealityEstate {
  transaction_id: number;
  title: string;
  validation_date: string;
  currency: string;
  locality: {
    gps_lat: number;
    gps_lon: number;
    housenumber: string;
    municipality: string;
    municipality_id: number;
    ward: string;
    ward_id: number;
    ward_seo_name: string;
  };
}

interface SrealityGraphPoint {
  year: number;
  month: number;
  avg_price_per_sqm: number;
}

interface WardInfo {
  id: number;
  districtId: number;
  regionId: number;
  name: string;
  avgPriceM2: number;
  // If true, this is a municipality that has sub-wards (needs drill-down)
  hasSubWards?: boolean;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- Regions / kraje
    CREATE TABLE IF NOT EXISTS sold_regions (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      seo_name TEXT,
      avg_price_m2 REAL,
      transactions INTEGER,
      price_change REAL,
      scraped_at TEXT NOT NULL
    );

    -- Districts / okresy
    CREATE TABLE IF NOT EXISTS sold_districts (
      id INTEGER PRIMARY KEY,
      region_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      seo_name TEXT,
      avg_price_m2 REAL,
      transactions INTEGER,
      price_change REAL,
      scraped_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sd_region ON sold_districts(region_id);

    -- Wards / části obcí (obce)
    CREATE TABLE IF NOT EXISTS sold_wards (
      id INTEGER PRIMARY KEY,
      district_id INTEGER,
      region_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      seo_name TEXT,
      avg_price_m2 REAL,
      transactions INTEGER,
      price_change REAL,
      scraped_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sw_district ON sold_wards(district_id);
    CREATE INDEX IF NOT EXISTS idx_sw_region ON sold_wards(region_id);

    -- Individual transactions
    CREATE TABLE IF NOT EXISTS sold_transactions (
      id INTEGER PRIMARY KEY,
      ward_id INTEGER NOT NULL,
      title TEXT,
      validation_date TEXT,
      lat REAL,
      lon REAL,
      address TEXT,
      municipality TEXT,
      ward_name TEXT,
      ward_avg_price_m2 REAL,
      scraped_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_st_ward ON sold_transactions(ward_id);
    CREATE INDEX IF NOT EXISTS idx_st_date ON sold_transactions(validation_date);
    CREATE INDEX IF NOT EXISTS idx_st_latlon ON sold_transactions(lat, lon);

    -- Monthly price history per locality
    CREATE TABLE IF NOT EXISTS sold_price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      avg_price_m2 REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'byty',
      scraped_at TEXT NOT NULL,
      UNIQUE(entity_type, entity_id, year, month, category)
    );
    CREATE INDEX IF NOT EXISTS idx_sph_entity ON sold_price_history(entity_type, entity_id);
  `);

  // Migration: add category column if not exists
  try { db.exec("ALTER TABLE sold_price_history ADD COLUMN category TEXT NOT NULL DEFAULT 'byty'"); } catch { /* exists */ }
  try { db.exec("DROP INDEX IF EXISTS sqlite_autoindex_sold_price_history_1"); } catch { /* */ }
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sph_unique ON sold_price_history(entity_type, entity_id, year, month, category)"); } catch { /* */ }

  // Migration: add category to transactions
  try { db.exec("ALTER TABLE sold_transactions ADD COLUMN category TEXT NOT NULL DEFAULT 'byty'"); } catch { /* exists */ }
  // Migration: add area_m2
  try { db.exec("ALTER TABLE sold_transactions ADD COLUMN area_m2 REAL"); } catch { /* exists */ }
}

/**
 * Fetch transactions for a single ward, splitting by year to maximize results.
 * Returns all unique transaction IDs found.
 */
async function fetchWardTransactionsYearly(
  categoryMain: string,
  wardId: number,
): Promise<SrealityEstate[]> {
  const allEstates = new Map<number, SrealityEstate>();

  // Fetch each year in parallel (max 3 concurrent to avoid rate limits)
  for (let i = 0; i < YEAR_RANGES.length; i += 3) {
    const batch = YEAR_RANGES.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(range =>
        srealityFetch("list", {
          category_main_cb: categoryMain,
          date_from: range.from,
          date_to: range.to,
          locality: `ward,${wardId}`,
        }) as Promise<{ result: { estate_list: SrealityEstate[] | null } }>
      )
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const estates = result.value.result?.estate_list || [];
      for (const e of estates) {
        allEstates.set(e.transaction_id, e);
      }
    }
  }

  return Array.from(allEstates.values());
}

/**
 * Check if a municipality has sub-wards by querying it.
 * Returns sub-wards if they exist, or empty array if it's a leaf ward.
 */
async function fetchMunicipalitySubWards(
  categoryMain: string,
  municipalityId: number,
): Promise<SrealityAggItem[]> {
  const data = (await srealityFetch("list", {
    category_main_cb: categoryMain,
    date_from: DATE_FROM,
    date_to: DATE_TO,
    locality: `municipality,${municipalityId}`,
  })) as { result: { aggregated_list?: SrealityAggItem[]; estate_list?: SrealityEstate[] | null; num_transactions: number } };

  const subWards = (data.result?.aggregated_list || []).filter(
    a => a.num_transactions > 0
  );

  return subWards;
}

/** Parse area midpoint from transaction title.
 *  "Byt 2+1, 56–60 m²" → 58,  "Rodinný dům, 150 m²" → 150 */
function parseArea(title: string): number | null {
  const range = title.match(/(\d+)[–\-](\d+)\s*m[²2]/);
  if (range) return (parseInt(range[1]) + parseInt(range[2])) / 2;
  const exact = title.match(/(\d+)\s*m[²2]/);
  if (exact) return parseInt(exact[1]);
  return null;
}

/** Backfill area_m2 for existing rows that have NULL */
function backfillAreaM2(db: Database.Database) {
  const rows = db.prepare("SELECT id, title FROM sold_transactions WHERE area_m2 IS NULL").all() as { id: number; title: string }[];
  if (rows.length === 0) return;
  console.log(`  Backfilling area_m2 for ${rows.length} transactions...`);
  const update = db.prepare("UPDATE sold_transactions SET area_m2 = ? WHERE id = ?");
  const run = db.transaction(() => {
    let updated = 0;
    for (const row of rows) {
      const area = parseArea(row.title);
      if (area !== null) { update.run(area, row.id); updated++; }
    }
    console.log(`  area_m2 backfilled: ${updated}/${rows.length}`);
  });
  run();
}

export async function runSoldScrape() {
  const startTime = Date.now();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  initSchema(db);

  backfillAreaM2(db);

  const now = new Date().toISOString();
  console.log("=== Sold Prices Scraper (celá ČR) ===");
  console.log(`Date range: ${DATE_FROM} to ${DATE_TO}`);
  console.log(`Categories: ${SOLD_CATEGORIES.map(c => c.label).join(", ")}`);
  console.log(`Year ranges for transactions: ${YEAR_RANGES.length} years`);

  let grandTotalTransactions = 0;

  for (const category of SOLD_CATEGORIES) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`=== Category: ${category.label} (category_main_cb=${category.main}) ===`);
    console.log(`${"=".repeat(50)}`);

    // --- Step 1: Fetch all regions (kraje) ---
    console.log("\n[1/6] Fetching regions...");
    const regionListData = (await srealityFetch("list", {
      category_main_cb: category.main,
      date_from: DATE_FROM,
      date_to: DATE_TO,
    })) as { result: { aggregated_list: SrealityAggItem[]; avg_price_per_sqm: number; num_transactions: number } };

    const regions = regionListData.result.aggregated_list.filter(
      (a) => a.avg_price_per_sqm !== null
    );

    console.log(`  Found ${regions.length} regions, total num_transactions: ${regionListData.result.num_transactions}`);

    const upsertRegion = db.prepare(`
      INSERT OR REPLACE INTO sold_regions (id, name, seo_name, avg_price_m2, transactions, price_change, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of regions) {
      upsertRegion.run(
        r.locality.entity_id,
        r.locality.name,
        r.locality.seo_name,
        r.avg_price_per_sqm,
        r.num_transactions,
        r.price_change,
        now
      );
    }

    // Fetch CR-wide price history
    console.log("  Fetching CR-wide price history...");
    const crGraphData = (await srealityFetch("graph", {
      category_main_cb: category.main,
      date_from: DATE_FROM,
      date_to: DATE_TO,
    })) as { result: { graph_main: SrealityGraphPoint[] } };

    const upsertHistory = db.prepare(`
      INSERT OR REPLACE INTO sold_price_history (entity_type, entity_id, year, month, avg_price_m2, category, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertHistoryBatch = db.transaction(
      (points: SrealityGraphPoint[], entityType: string, entityId: number) => {
        for (const p of points) {
          upsertHistory.run(entityType, entityId, p.year, p.month, p.avg_price_per_sqm, category.label, now);
        }
      }
    );

    insertHistoryBatch(crGraphData.result.graph_main, "country", 112);

    // --- Step 2: For each region, fetch districts ---
    console.log("\n[2/6] Fetching districts per region...");

    const upsertDistrict = db.prepare(`
      INSERT OR REPLACE INTO sold_districts (id, region_id, name, seo_name, avg_price_m2, transactions, price_change, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const allDistricts: Array<{
      id: number;
      regionId: number;
      name: string;
      avgPriceM2?: number;
    }> = [];

    for (const region of regions) {
      const regionId = region.locality.entity_id;
      console.log(`  Region: ${region.locality.name} (id=${regionId})`);

      try {
        const [distListData, regionGraphData] = await Promise.all([
          srealityFetch("list", {
            category_main_cb: category.main,
            date_from: DATE_FROM,
            date_to: DATE_TO,
            locality: `region,${regionId}`,
          }) as Promise<{ result: { aggregated_list: SrealityAggItem[] } }>,
          srealityFetch("graph", {
            category_main_cb: category.main,
            date_from: DATE_FROM,
            date_to: DATE_TO,
            locality: `region,${regionId}`,
          }) as Promise<{ result: { graph_main: SrealityGraphPoint[] } }>,
        ]);

        insertHistoryBatch(regionGraphData.result.graph_main, "region", regionId);

        const districts = distListData.result.aggregated_list.filter(
          (a) => a.avg_price_per_sqm !== null
        );

        const insertDistrictBatch = db.transaction(() => {
          for (const d of districts) {
            upsertDistrict.run(
              d.locality.entity_id,
              regionId,
              d.locality.name,
              d.locality.seo_name,
              d.avg_price_per_sqm,
              d.num_transactions,
              d.price_change,
              now
            );
            allDistricts.push({
              id: d.locality.entity_id,
              regionId,
              name: d.locality.name,
              avgPriceM2: d.avg_price_per_sqm ?? undefined,
            });
          }
        });
        insertDistrictBatch();

        console.log(`    → ${districts.length} districts`);
      } catch (err) {
        console.error(`    Error: ${err}`);
      }

      await delay(300);
    }

    // --- Step 3: Fetch district-level price history ---
    console.log(`\n[3/6] Fetching price history for ${allDistricts.length} districts...`);

    for (let i = 0; i < allDistricts.length; i += 5) {
      const batch = allDistricts.slice(i, i + 5);

      const results = await Promise.allSettled(
        batch.map(async (district) => {
          const graphData = (await srealityFetch("graph", {
            category_main_cb: category.main,
            date_from: DATE_FROM,
            date_to: DATE_TO,
            locality: `district,${district.id}`,
          })) as { result: { graph_main: SrealityGraphPoint[] } };

          return { district, points: graphData.result.graph_main || [] };
        })
      );

      const insertBatch = db.transaction(() => {
        for (const result of results) {
          if (result.status !== "fulfilled") continue;
          const { district, points } = result.value;
          for (const p of points) {
            upsertHistory.run("district", district.id, p.year, p.month, p.avg_price_per_sqm, category.label, now);
          }
        }
      });
      insertBatch();

      if ((i + 5) % 50 === 0 || i + 5 >= allDistricts.length) {
        console.log(
          `  Progress: ${Math.min(i + 5, allDistricts.length)}/${allDistricts.length} districts`
        );
      }

      await delay(300);
    }

    // --- Step 4: For each district, fetch wards/obce + detect municipalities with sub-wards ---
    console.log(`\n[4/6] Fetching wards for ${allDistricts.length} districts...`);

    const upsertWard = db.prepare(`
      INSERT OR REPLACE INTO sold_wards (id, district_id, region_id, name, seo_name, avg_price_m2, transactions, price_change, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const allWards: WardInfo[] = [];
    // Municipalities that need sub-ward drill-down
    const municipalitiesWithSubWards: WardInfo[] = [];

    // Prague region ID = 10
    const PRAGUE_REGION_ID = 10;
    const pragueDistricts: typeof allDistricts = [];
    const nonPragueDistricts = allDistricts.filter((d) => {
      if (d.regionId === PRAGUE_REGION_ID) {
        pragueDistricts.push(d);
        return false;
      }
      return true;
    });

    console.log(`  Non-Prague districts: ${nonPragueDistricts.length}, Prague parts: ${pragueDistricts.length}`);

    // Fetch wards for non-Prague districts
    for (let i = 0; i < nonPragueDistricts.length; i += 3) {
      const batch = nonPragueDistricts.slice(i, i + 3);

      const results = await Promise.allSettled(
        batch.map(async (district) => {
          const wardListData = (await srealityFetch("list", {
            category_main_cb: category.main,
            date_from: DATE_FROM,
            date_to: DATE_TO,
            locality: `district,${district.id}`,
          })) as { result: { aggregated_list: SrealityAggItem[] } };

          return {
            district,
            wards: wardListData.result.aggregated_list.filter(
              (a) => a.num_transactions > 0
            ),
          };
        })
      );

      const insertWardBatch = db.transaction(() => {
        for (const result of results) {
          if (result.status !== "fulfilled") continue;
          const { district, wards } = result.value;

          for (const w of wards) {
            upsertWard.run(
              w.locality.entity_id,
              district.id,
              district.regionId,
              w.locality.name,
              w.locality.seo_name,
              w.avg_price_per_sqm,
              w.num_transactions,
              w.price_change,
              now
            );

            const wardInfo: WardInfo = {
              id: w.locality.entity_id,
              districtId: district.id,
              regionId: district.regionId,
              name: w.locality.name,
              avgPriceM2: w.avg_price_per_sqm!,
            };

            // Large municipalities likely have sub-wards (entity_type is "municipality")
            // Municipalities with 100+ transactions likely have sub-divisions worth drilling into
            if (w.locality.entity_type === "municipality" && w.num_transactions >= 100) {
              wardInfo.hasSubWards = true;
              municipalitiesWithSubWards.push(wardInfo);
            }

            allWards.push(wardInfo);
          }
        }
      });
      insertWardBatch();

      if ((i + 3) % 15 === 0 || i + 3 >= nonPragueDistricts.length) {
        console.log(
          `  Progress: ${Math.min(i + 3, nonPragueDistricts.length)}/${nonPragueDistricts.length} districts, ${allWards.length} wards found`
        );
      }

      await delay(400);
    }

    console.log(`  Total wards: ${allWards.length}, municipalities needing sub-ward drill-down: ${municipalitiesWithSubWards.length}`);

    // --- Step 4.5: Drill down into large municipalities to get sub-wards ---
    if (municipalitiesWithSubWards.length > 0) {
      console.log(`\n[4.5/6] Drilling into ${municipalitiesWithSubWards.length} large municipalities for sub-wards...`);

      for (let i = 0; i < municipalitiesWithSubWards.length; i += 3) {
        const batch = municipalitiesWithSubWards.slice(i, i + 3);

        const results = await Promise.allSettled(
          batch.map(muni => fetchMunicipalitySubWards(category.main, muni.id))
        );

        const insertBatch = db.transaction(() => {
          for (let j = 0; j < batch.length; j++) {
            const result = results[j];
            if (result.status !== "fulfilled") continue;
            const subWards = result.value;
            const muni = batch[j];

            if (subWards.length === 0) {
              // No sub-wards — leaf municipality, allow step 6 to fetch its transactions
              muni.hasSubWards = false;
              continue;
            }

            console.log(`    ${muni.name}: ${subWards.length} sub-wards found`);

            for (const sw of subWards) {
              upsertWard.run(
                sw.locality.entity_id,
                muni.districtId,
                muni.regionId,
                sw.locality.name,
                sw.locality.seo_name,
                sw.avg_price_per_sqm,
                sw.num_transactions,
                sw.price_change,
                now
              );
              allWards.push({
                id: sw.locality.entity_id,
                districtId: muni.districtId,
                regionId: muni.regionId,
                name: sw.locality.name,
                avgPriceM2: sw.avg_price_per_sqm!,
              });
            }

            // Mark the parent municipality — we'll skip fetching transactions
            // for it directly since we'll get them from sub-wards
            muni.hasSubWards = true;
          }
        });
        insertBatch();

        await delay(300);
      }
    }

    // --- Step 5: Prague — fetch sub-wards for each city part ---
    console.log(
      `\n[5/6] Fetching Prague sub-wards for ${pragueDistricts.length} city parts...`
    );

    const upsertTransaction = db.prepare(`
      INSERT OR REPLACE INTO sold_transactions (id, ward_id, title, validation_date, lat, lon, address, municipality, ward_name, ward_avg_price_m2, category, area_m2, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let totalTransactions = 0;

    for (let i = 0; i < pragueDistricts.length; i += 5) {
      const batch = pragueDistricts.slice(i, i + 5);

      const results = await Promise.allSettled(
        batch.map(async (district) => {
          const data = (await srealityFetch("list", {
            category_main_cb: category.main,
            date_from: DATE_FROM,
            date_to: DATE_TO,
            locality: `ward,${district.id}`,
          })) as { result: { estate_list: SrealityEstate[] | null; aggregated_list?: SrealityAggItem[] } };

          const estates = data.result?.estate_list || [];
          const subWards = (data.result?.aggregated_list || []).filter(
            (a) => a.num_transactions > 0
          );
          return { district, estates, subWards };
        })
      );

      const insertBatch = db.transaction(() => {
        for (const result of results) {
          if (result.status !== "fulfilled") continue;
          const { district, estates, subWards } = result.value;

          for (const w of subWards) {
            upsertWard.run(
              w.locality.entity_id,
              district.id,
              PRAGUE_REGION_ID,
              w.locality.name,
              w.locality.seo_name,
              w.avg_price_per_sqm,
              w.num_transactions,
              w.price_change,
              now
            );
            allWards.push({
              id: w.locality.entity_id,
              districtId: district.id,
              regionId: PRAGUE_REGION_ID,
              name: w.locality.name,
              avgPriceM2: w.avg_price_per_sqm!,
            });
          }

          // Save direct Prague transactions
          for (const e of estates) {
            upsertTransaction.run(
              e.transaction_id,
              district.id,
              e.title,
              e.validation_date,
              e.locality.gps_lat,
              e.locality.gps_lon,
              `${e.locality.ward}${e.locality.housenumber ? ` ${e.locality.housenumber}` : ""}`,
              e.locality.municipality,
              e.locality.ward,
              district.avgPriceM2 || 0,
              category.label,
              parseArea(e.title),
              now
            );
            totalTransactions++;
          }
        }
      });
      insertBatch();

      if ((i + 5) % 25 === 0 || i + 5 >= pragueDistricts.length) {
        console.log(
          `  Prague progress: ${Math.min(i + 5, pragueDistricts.length)}/${pragueDistricts.length} parts, ${totalTransactions} transactions`
        );
      }

      await delay(300);
    }

    console.log(`  Prague direct: ${totalTransactions} transactions, ${allWards.filter(w => w.regionId === PRAGUE_REGION_ID).length} sub-wards`);

    // --- Step 6: Fetch transactions for all wards, YEARLY to maximize results ---
    // Skip municipalities that have sub-wards (we fetch their sub-wards instead)
    const wardsToFetch = allWards.filter(w => !w.hasSubWards);
    console.log(
      `\n[6/6] Fetching transactions for ${wardsToFetch.length} wards (yearly split, ${YEAR_RANGES.length} years each)...`
    );

    let wardsDone = 0;
    const BATCH_SIZE = 3; // Lower batch size because each ward does multiple year requests

    for (let i = 0; i < wardsToFetch.length; i += BATCH_SIZE) {
      const batch = wardsToFetch.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(ward => fetchWardTransactionsYearly(category.main, ward.id))
      );

      const insertBatch = db.transaction(() => {
        for (let j = 0; j < batch.length; j++) {
          const result = results[j];
          if (result.status !== "fulfilled") continue;
          const ward = batch[j];
          const estates = result.value;

          for (const e of estates) {
            upsertTransaction.run(
              e.transaction_id,
              ward.id,
              e.title,
              e.validation_date,
              e.locality.gps_lat,
              e.locality.gps_lon,
              `${e.locality.ward}${e.locality.housenumber ? ` ${e.locality.housenumber}` : ""}`,
              e.locality.municipality,
              e.locality.ward,
              ward.avgPriceM2,
              category.label,
              parseArea(e.title),
              now
            );
            totalTransactions++;
          }
        }
      });
      insertBatch();

      wardsDone += batch.length;
      if (wardsDone % 50 === 0 || wardsDone >= wardsToFetch.length) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const rps = (requestCount / ((Date.now() - startTime) / 1000)).toFixed(1);
        console.log(
          `  Progress: ${wardsDone}/${wardsToFetch.length} wards, ${totalTransactions} transactions | ${elapsed}min elapsed, ${rps} req/s, ${rateLimitHits} rate limits`
        );
      }

      await delay(200);
    }

    console.log(`\n--- ${category.label}: ${totalTransactions} transactions, ${allWards.length} wards ---`);
    grandTotalTransactions += totalTransactions;

  } // end category loop

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`=== ALL DONE in ${totalTime} minutes ===`);
  console.log(`  Total transactions: ${grandTotalTransactions}`);
  console.log(`  API requests: ${requestCount}`);
  console.log(`  Rate limit hits: ${rateLimitHits}`);

  db.close();
}

// Run directly
runSoldScrape().catch(console.error);
