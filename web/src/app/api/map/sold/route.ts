import { NextRequest, NextResponse } from "next/server";

const SREALITY_BASE = "https://www.sreality.cz/api/v1/price_map";

async function srealityFetch(path: string, params: Record<string, string>) {
  const sp = new URLSearchParams(params);
  const res = await fetch(`${SREALITY_BASE}/${path}?${sp}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`Sreality API ${res.status}`);
  return res.json();
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
    ward: string;
    ward_id: number;
  };
}

/**
 * Returns sold transactions with GPS for map display.
 * Fetches ward-level data from Sreality price map, then fetches
 * individual transactions for each ward (with GPS).
 *
 * Query params:
 * - locality: Sreality locality (default: region,10 = Prague)
 * - ward_id: specific ward to fetch transactions for
 * - date_from, date_to: date range
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dateFrom = sp.get("date_from") || "2024-01";
  const dateTo = sp.get("date_to") || "2026-02";
  const locality = sp.get("locality") || "region,10";
  const wardId = sp.get("ward_id");

  try {
    if (wardId) {
      // Fetch individual transactions for a specific ward
      const data = await srealityFetch("list", {
        category_main_cb: "1",
        date_from: dateFrom,
        date_to: dateTo,
        locality: `ward,${wardId}`,
      });

      const estates: SrealityEstate[] = data.result?.estate_list || [];
      const transactions = estates.map((e) => ({
        id: e.transaction_id,
        title: e.title,
        date: e.validation_date,
        lat: e.locality.gps_lat,
        lon: e.locality.gps_lon,
        address: `${e.locality.ward}${e.locality.housenumber ? ` ${e.locality.housenumber}` : ""}`,
        ward: e.locality.ward,
      }));

      return NextResponse.json({ transactions });
    }

    // Fetch ward list for the region
    const listData = await srealityFetch("list", {
      category_main_cb: "1",
      date_from: dateFrom,
      date_to: dateTo,
      locality,
    });

    const wards = (listData.result?.aggregated_list || [])
      .filter((a: { avg_price_per_sqm: number | null }) => a.avg_price_per_sqm !== null)
      .map(
        (a: {
          locality: {
            name: string;
            entity_id: number;
            seo_name: string;
          };
          avg_price_per_sqm: number;
          num_transactions: number;
          price_change: number | null;
        }) => ({
          name: a.locality.name,
          wardId: a.locality.entity_id,
          avgPriceM2: a.avg_price_per_sqm,
          transactions: a.num_transactions,
          priceChange: a.price_change,
        })
      );

    // Fetch first 10 wards' transactions to get GPS pins quickly
    const topWards = wards.slice(0, 15);
    const wardTransactions = await Promise.all(
      topWards.map(async (ward: { wardId: number; name: string; avgPriceM2: number }) => {
        try {
          const data = await srealityFetch("list", {
            category_main_cb: "1",
            date_from: dateFrom,
            date_to: dateTo,
            locality: `ward,${ward.wardId}`,
          });
          const estates: SrealityEstate[] = data.result?.estate_list || [];
          return estates.map((e) => ({
            id: e.transaction_id,
            title: e.title,
            date: e.validation_date,
            lat: e.locality.gps_lat,
            lon: e.locality.gps_lon,
            address: `${e.locality.ward}${e.locality.housenumber ? ` ${e.locality.housenumber}` : ""}`,
            ward: e.locality.ward,
            wardAvgPriceM2: ward.avgPriceM2,
          }));
        } catch {
          return [];
        }
      })
    );

    const allTransactions = wardTransactions.flat();

    return NextResponse.json({
      wards,
      transactions: allTransactions,
      totalWards: wards.length,
      loadedWards: topWards.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch sold map data", detail: String(err) },
      { status: 502 }
    );
  }
}
