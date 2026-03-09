import { NextResponse } from "next/server";

const NUTS3_URL =
  "https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_20M_2021_4326_LEVL_3.geojson";

/**
 * Fetches Eurostat NUTS3 boundaries for Czech Republic (14 kraje).
 * Cached for 30 days — only downloads the full EU file once, filters to CZ.
 */
export async function GET() {
  try {
    const res = await fetch(NUTS3_URL, {
      next: { revalidate: 60 * 60 * 24 * 30 }, // 30 days
    });

    if (!res.ok) throw new Error(`Eurostat API ${res.status}`);

    const data = (await res.json()) as {
      type: string;
      features: Array<{ properties: { CNTR_CODE: string } }>;
    };

    const czFeatures = data.features.filter(
      (f) => f.properties.CNTR_CODE === "CZ"
    );

    return NextResponse.json(
      { type: "FeatureCollection", features: czFeatures },
      { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch GeoJSON", detail: String(err) },
      { status: 502 }
    );
  }
}
