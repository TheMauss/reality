import { NextRequest, NextResponse } from "next/server";

interface NominatimResult {
  place_id: number;
  display_name: string;
  type: string;
  class: string;
  address: {
    road?: string;
    pedestrian?: string;
    suburb?: string;
    quarter?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

function formatResult(r: NominatimResult): { label: string; sublabel: string; icon: string; type: string } | null {
  const a = r.address;
  const city = a.city || a.town || a.village || a.municipality || "";
  const suburb = a.suburb || a.quarter || a.city_district || "";
  const county = a.county || "";
  const state = a.state || "";
  const postcode = a.postcode || "";

  // Street / road
  if (a.road || a.pedestrian) {
    const street = a.road || a.pedestrian || "";
    const area = suburb || city;
    if (!street || !city) return null;
    return {
      label: area ? `${street}, ${area}` : street,
      sublabel: [city !== area ? city : "", postcode, county].filter(Boolean).join(" · "),
      icon: "📍",
      type: "Ulice",
    };
  }

  // Suburb / quarter / city_district (e.g. Vinohrady)
  if ((a.suburb || a.quarter) && city) {
    const name = a.suburb || a.quarter || "";
    return {
      label: name,
      sublabel: [city, county].filter(Boolean).join(" · "),
      icon: "🏘️",
      type: "Čtvrť",
    };
  }

  // City district (Praha 1, Praha 2, …)
  if (a.city_district && city) {
    return {
      label: a.city_district,
      sublabel: [city, county].filter(Boolean).join(" · "),
      icon: "📍",
      type: "Část města",
    };
  }

  // City / town
  if (city) {
    return {
      label: city,
      sublabel: [county, state].filter(Boolean).join(" · "),
      icon: city.toLowerCase().includes("praha") ? "🏙️"
          : city.toLowerCase().includes("brno")  ? "🏛️"
          : "🏙️",
      type: city === (a.city || "") ? "Město" : "Obec",
    };
  }

  // Village
  if (a.village || a.municipality) {
    const name = a.village || a.municipality || "";
    return {
      label: name,
      sublabel: [county, state].filter(Boolean).join(" · "),
      icon: "🌾",
      type: "Obec",
    };
  }

  // County / region
  if (county && !city) {
    return {
      label: county,
      sublabel: state,
      icon: "🗺️",
      type: "Kraj",
    };
  }

  return null;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("countrycodes", "cz");
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "10");
    url.searchParams.set("dedupe", "1");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Cenolov/1.0 (https://cenolov.cz)",
        "Accept-Language": "cs,en",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return NextResponse.json([]);

    const data: NominatimResult[] = await res.json();

    // Deduplicate by label
    const seen = new Set<string>();
    const results = data
      .map(formatResult)
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => {
        const key = r.label.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 7);

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
