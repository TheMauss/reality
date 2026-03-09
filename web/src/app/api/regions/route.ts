import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/**
 * Extracts Czech region (kraj) from location string.
 * Sreality locations typically end with the region or city name.
 */
const REGION_EXTRACT = `
  CASE
    WHEN location LIKE '%Praha%' THEN 'Praha'
    WHEN location LIKE '%Brno%' OR location LIKE '%Blansko%' OR location LIKE '%Břeclav%' OR location LIKE '%Hodonín%' OR location LIKE '%Vyškov%' OR location LIKE '%Znojmo%' THEN 'Jihomoravský'
    WHEN location LIKE '%Ostrava%' OR location LIKE '%Karviná%' OR location LIKE '%Frýdek%' OR location LIKE '%Opava%' OR location LIKE '%Nový Jičín%' OR location LIKE '%Bruntál%' THEN 'Moravskoslezský'
    WHEN location LIKE '%Plzeň%' OR location LIKE '%Klatovy%' OR location LIKE '%Domažlice%' OR location LIKE '%Rokycany%' OR location LIKE '%Tachov%' THEN 'Plzeňský'
    WHEN location LIKE '%Liberec%' OR location LIKE '%Jablonec%' OR location LIKE '%Semily%' OR location LIKE '%Česká Lípa%' THEN 'Liberecký'
    WHEN location LIKE '%Olomouc%' OR location LIKE '%Prostějov%' OR location LIKE '%Přerov%' OR location LIKE '%Šumperk%' OR location LIKE '%Jeseník%' THEN 'Olomoucký'
    WHEN location LIKE '%Zlín%' OR location LIKE '%Kroměříž%' OR location LIKE '%Uherské%' OR location LIKE '%Vsetín%' THEN 'Zlínský'
    WHEN location LIKE '%Hradec Králové%' OR location LIKE '%Trutnov%' OR location LIKE '%Náchod%' OR location LIKE '%Jičín%' OR location LIKE '%Rychnov%' THEN 'Královéhradecký'
    WHEN location LIKE '%Pardubice%' OR location LIKE '%Chrudim%' OR location LIKE '%Svitavy%' OR location LIKE '%Ústí nad Orlicí%' THEN 'Pardubický'
    WHEN location LIKE '%Ústí nad Labem%' OR location LIKE '%Teplice%' OR location LIKE '%Most%' OR location LIKE '%Chomutov%' OR location LIKE '%Děčín%' OR location LIKE '%Litoměřice%' OR location LIKE '%Louny%' THEN 'Ústecký'
    WHEN location LIKE '%Karlovy Vary%' OR location LIKE '%Sokolov%' OR location LIKE '%Cheb%' THEN 'Karlovarský'
    WHEN location LIKE '%České Budějovice%' OR location LIKE '%Tábor%' OR location LIKE '%Písek%' OR location LIKE '%Strakonice%' OR location LIKE '%Prachatice%' OR location LIKE '%Jindřichův Hradec%' OR location LIKE '%Český Krumlov%' THEN 'Jihočeský'
    WHEN location LIKE '%Jihlava%' OR location LIKE '%Třebíč%' OR location LIKE '%Žďár%' OR location LIKE '%Pelhřimov%' OR location LIKE '%Havlíčkův Brod%' THEN 'Vysočina'
    WHEN location LIKE '%Kladno%' OR location LIKE '%Mladá Boleslav%' OR location LIKE '%Příbram%' OR location LIKE '%Kolín%' OR location LIKE '%Kutná Hora%' OR location LIKE '%Benešov%' OR location LIKE '%Beroun%' OR location LIKE '%Mělník%' OR location LIKE '%Nymburk%' OR location LIKE '%Rakovník%' THEN 'Středočeský'
    ELSE 'Ostatní'
  END
`;

/** Maps our region names to Sreality price map region IDs */
export const REGION_TO_SREALITY_ID: Record<string, number> = {
  Praha: 10,
  Jihočeský: 1,
  Plzeňský: 2,
  Karlovarský: 3,
  Ústecký: 4,
  Liberecký: 5,
  Královéhradecký: 6,
  Pardubický: 7,
  Olomoucký: 8,
  Zlínský: 9,
  Středočeský: 11,
  Moravskoslezský: 12,
  Vysočina: 13,
  Jihomoravský: 14,
};

export async function GET() {
  const db = getDB();

  const regions = db
    .prepare(
      `SELECT
        ${REGION_EXTRACT} as region,
        COUNT(*) as total_listings,
        COUNT(CASE WHEN category = 'byty-prodej' THEN 1 END) as byty_prodej,
        COUNT(CASE WHEN category = 'byty-najem' THEN 1 END) as byty_najem,
        COUNT(CASE WHEN category = 'domy-prodej' THEN 1 END) as domy_prodej,
        COUNT(CASE WHEN category = 'domy-najem' THEN 1 END) as domy_najem,
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as avg_price_m2_prodej,
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-najem' THEN price * 1.0 / area_m2 END)) as avg_price_m2_najem,
        ROUND(AVG(CASE WHEN category = 'byty-prodej' THEN price END)) as avg_price_byt_prodej,
        ROUND(AVG(CASE WHEN category = 'byty-najem' THEN price END)) as avg_price_byt_najem,
        ROUND(MIN(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as min_price_m2,
        ROUND(MAX(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as max_price_m2
      FROM listings
      GROUP BY region
      HAVING byty_prodej > 0
      ORDER BY avg_price_m2_prodej DESC`
    )
    .all();

  const countryTotal = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-prodej' THEN price * 1.0 / area_m2 END)) as avg_price_m2,
        ROUND(AVG(CASE WHEN category = 'byty-prodej' THEN price END)) as avg_price,
        ROUND(AVG(CASE WHEN area_m2 > 0 AND category = 'byty-najem' THEN price * 1.0 / area_m2 END)) as avg_rent_m2,
        ROUND(AVG(CASE WHEN category = 'byty-najem' THEN price END)) as avg_rent
      FROM listings`
    )
    .get();

  return NextResponse.json({ regions, countryTotal });
}
