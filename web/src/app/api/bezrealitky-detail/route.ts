import { NextRequest, NextResponse } from "next/server";

const GQL_URL = "https://api.bezrealitky.cz/graphql/";

const GQL_QUERY = `
query Advert($id: ID!) {
  advert(id: $id) {
    id
    title
    description
    price
    surface
    address(locale: CS)
    gps { lat lng }
    publicImages { url(filter: RECORD_MAIN) }
  }
}
`;

export async function GET(req: NextRequest) {
  const sourceId = req.nextUrl.searchParams.get("id");
  if (!sourceId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const res = await fetch(GQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "cs-CZ,cs;q=0.9",
        "Origin": "https://www.bezrealitky.cz",
        "Referer": `https://www.bezrealitky.cz/`,
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
      },
      body: JSON.stringify({ query: GQL_QUERY, variables: { id: sourceId } }),
      next: { revalidate: 3600 },
    });

    const json = await res.json();
    const advert = json.data?.advert;
    if (!advert) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      images: (advert.publicImages || []).map((img: { url: string }) => img.url).filter(Boolean),
      description: advert.description || "",
      items: [],
      map: advert.gps ? { lat: advert.gps.lat, lon: advert.gps.lng } : null,
    });
  } catch (err) {
    console.error("bezrealitky-detail error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
