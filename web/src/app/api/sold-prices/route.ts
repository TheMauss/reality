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
    next: { revalidate: 86400 }, // cache 24h
  });
  if (!res.ok) throw new Error(`Sreality API ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dateFrom = sp.get("date_from") || "2020-01";
  const dateTo = sp.get("date_to") || "2026-02";
  const locality = sp.get("locality") || ""; // empty = CR-wide (returns regions)

  try {
    const baseParams: Record<string, string> = {
      category_main_cb: "1",
      date_from: dateFrom,
      date_to: dateTo,
    };
    if (locality) {
      baseParams.locality = locality;
    }

    // Fetch both list (sub-areas) and graph (monthly) in parallel
    const [listData, graphData] = await Promise.all([
      srealityFetch("list", baseParams),
      srealityFetch("graph", baseParams),
    ]);

    const list = listData.result;
    const graph = graphData.result;

    // Sub-areas (regions when CR-wide, districts when region, wards when district)
    const areas = (list.aggregated_list || [])
      .filter(
        (a: { avg_price_per_sqm: number | null }) =>
          a.avg_price_per_sqm !== null
      )
      .map(
        (a: {
          locality: {
            name: string;
            entity_type: string;
            entity_id: number;
            seo_name: string;
          };
          avg_price_per_sqm: number;
          num_transactions: number;
          price_change: number | null;
        }) => ({
          name: a.locality.name,
          entityType: a.locality.entity_type,
          entityId: a.locality.entity_id,
          seoName: a.locality.seo_name,
          avgPriceM2: a.avg_price_per_sqm,
          transactions: a.num_transactions,
          priceChange: a.price_change,
        })
      );

    // Monthly price history
    const monthlyPrices = (graph.graph_main || []).map(
      (g: { year: number; month: number; avg_price_per_sqm: number }) => ({
        year: g.year,
        month: g.month,
        avgPriceM2: g.avg_price_per_sqm,
        label: `${String(g.month).padStart(2, "0")}/${g.year}`,
      })
    );

    return NextResponse.json({
      overall: {
        avgPriceM2: list.avg_price_per_sqm,
        transactions: list.num_transactions,
        priceChange: list.price_change,
      },
      areas,
      monthlyPrices,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch sold prices", detail: String(err) },
      { status: 502 }
    );
  }
}
