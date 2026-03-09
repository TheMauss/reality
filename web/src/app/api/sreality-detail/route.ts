import { NextRequest, NextResponse } from "next/server";

interface SrealityImage {
  _links: {
    view?: { href: string };
    dynamicDown?: { href: string };
    gallery?: { href: string };
  };
}

interface SrealityItem {
  name: string;
  value: string | number;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://www.sreality.cz/api/cs/v2/estates/${id}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
        next: { revalidate: 3600 }, // cache 1h
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Sreality API error", status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json();

    // Extract images
    const images: string[] = (data._embedded?.images || [])
      .map((img: SrealityImage) => {
        const href =
          img._links?.view?.href ||
          img._links?.dynamicDown?.href?.replace("{width}", "800").replace("{height}", "600") ||
          img._links?.gallery?.href ||
          "";
        return href;
      })
      .filter(Boolean);

    // Extract description
    const description: string = data.text?.value || "";

    // Extract items/params
    const items: { name: string; value: string }[] = (data.items || []).map(
      (item: SrealityItem) => ({
        name: item.name,
        value: String(item.value),
      })
    );

    // Price info
    const priceNote: string =
      data.items?.find((i: SrealityItem) => i.name === "Poznámka k ceně")
        ?.value || "";

    // Map location
    const mapLat: number | null = data.map?.lat || null;
    const mapLon: number | null = data.map?.lon || null;

    return NextResponse.json({
      images,
      description,
      items,
      priceNote,
      map: mapLat && mapLon ? { lat: mapLat, lon: mapLon } : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch from Sreality" },
      { status: 502 }
    );
  }
}
