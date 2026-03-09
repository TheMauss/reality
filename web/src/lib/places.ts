export interface KnownPlace {
  name: string;       // display name
  context: string;    // e.g. "Praha 7", "Brno", "Ostrava"
  type: string;       // "Čtvrť" | "Město" | "Obvod" | "Obec"
  lat: number;
  lon: number;
  bbox?: [number, number, number, number]; // [minLat, maxLat, minLon, maxLon]
}

// Normalize for fuzzy matching: remove diacritics, lowercase, trim
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Prague neighborhoods & districts
const PRAGUE: KnownPlace[] = [
  { name: "Praha 1",       context: "Praha",    type: "Obvod",  lat: 50.0874, lon: 14.4213, bbox: [50.074, 50.102, 14.393, 14.449] },
  { name: "Praha 2",       context: "Praha",    type: "Obvod",  lat: 50.0757, lon: 14.4378, bbox: [50.064, 50.088, 14.418, 14.458] },
  { name: "Praha 3",       context: "Praha",    type: "Obvod",  lat: 50.0813, lon: 14.4647, bbox: [50.068, 50.095, 14.443, 14.492] },
  { name: "Praha 4",       context: "Praha",    type: "Obvod",  lat: 50.0404, lon: 14.4537, bbox: [50.013, 50.069, 14.393, 14.514] },
  { name: "Praha 5",       context: "Praha",    type: "Obvod",  lat: 50.0579, lon: 14.3930, bbox: [50.013, 50.086, 14.322, 14.432] },
  { name: "Praha 6",       context: "Praha",    type: "Obvod",  lat: 50.1044, lon: 14.3678, bbox: [50.065, 50.145, 14.290, 14.432] },
  { name: "Praha 7",       context: "Praha",    type: "Obvod",  lat: 50.1049, lon: 14.4361, bbox: [50.090, 50.121, 14.401, 14.465] },
  { name: "Praha 8",       context: "Praha",    type: "Obvod",  lat: 50.1178, lon: 14.4656, bbox: [50.093, 50.153, 14.427, 14.527] },
  { name: "Praha 9",       context: "Praha",    type: "Obvod",  lat: 50.1203, lon: 14.5103, bbox: [50.095, 50.148, 14.476, 14.560] },
  { name: "Praha 10",      context: "Praha",    type: "Obvod",  lat: 50.0668, lon: 14.4929, bbox: [50.044, 50.094, 14.458, 14.537] },
  { name: "Praha 11",      context: "Praha",    type: "Obvod",  lat: 50.0241, lon: 14.5074, bbox: [50.003, 50.048, 14.477, 14.541] },
  { name: "Praha 12",      context: "Praha",    type: "Obvod",  lat: 50.0071, lon: 14.4383, bbox: [49.977, 50.033, 14.395, 14.480] },
  { name: "Praha 13",      context: "Praha",    type: "Obvod",  lat: 50.0454, lon: 14.3512, bbox: [50.017, 50.069, 14.302, 14.392] },
  { name: "Praha 14",      context: "Praha",    type: "Obvod",  lat: 50.1054, lon: 14.5511, bbox: [50.075, 50.133, 14.517, 14.593] },
  { name: "Praha 15",      context: "Praha",    type: "Obvod",  lat: 50.0534, lon: 14.5378, bbox: [50.030, 50.076, 14.506, 14.575] },
  { name: "Praha 21",      context: "Praha",    type: "Obvod",  lat: 50.0912, lon: 14.5889, bbox: [50.063, 50.117, 14.554, 14.628] },
  { name: "Letná",         context: "Praha 7",  type: "Čtvrť",  lat: 50.1002, lon: 14.4266, bbox: [50.092, 50.108, 14.405, 14.448] },
  { name: "Vinohrady",     context: "Praha 2/3",type: "Čtvrť",  lat: 50.0739, lon: 14.4556, bbox: [50.065, 50.084, 14.437, 14.475] },
  { name: "Žižkov",        context: "Praha 3",  type: "Čtvrť",  lat: 50.0829, lon: 14.4611, bbox: [50.073, 50.095, 14.440, 14.490] },
  { name: "Holešovice",    context: "Praha 7",  type: "Čtvrť",  lat: 50.1034, lon: 14.4514, bbox: [50.093, 50.116, 14.424, 14.480] },
  { name: "Dejvice",       context: "Praha 6",  type: "Čtvrť",  lat: 50.1014, lon: 14.3908, bbox: [50.089, 50.116, 14.362, 14.419] },
  { name: "Smíchov",       context: "Praha 5",  type: "Čtvrť",  lat: 50.0699, lon: 14.4038, bbox: [50.056, 50.083, 14.381, 14.425] },
  { name: "Nusle",         context: "Praha 4",  type: "Čtvrť",  lat: 50.0574, lon: 14.4417, bbox: [50.048, 50.068, 14.424, 14.462] },
  { name: "Vršovice",      context: "Praha 10", type: "Čtvrť",  lat: 50.0621, lon: 14.4664, bbox: [50.050, 50.075, 14.444, 14.492] },
  { name: "Pankrác",       context: "Praha 4",  type: "Čtvrť",  lat: 50.0545, lon: 14.4323, bbox: [50.046, 50.063, 14.416, 14.451] },
  { name: "Nové Město",    context: "Praha 1/2",type: "Čtvrť",  lat: 50.0766, lon: 14.4268, bbox: [50.065, 50.088, 14.408, 14.448] },
  { name: "Staré Město",   context: "Praha 1",  type: "Čtvrť",  lat: 50.0879, lon: 14.4208, bbox: [50.082, 50.094, 14.407, 14.435] },
  { name: "Malá Strana",   context: "Praha 1",  type: "Čtvrť",  lat: 50.0875, lon: 14.4027, bbox: [50.080, 50.096, 14.388, 14.418] },
  { name: "Hradčany",      context: "Praha 1",  type: "Čtvrť",  lat: 50.0924, lon: 14.3967, bbox: [50.086, 50.100, 14.381, 14.414] },
  { name: "Josefov",       context: "Praha 1",  type: "Čtvrť",  lat: 50.0906, lon: 14.4177, bbox: [50.087, 50.094, 14.412, 14.424] },
  { name: "Bubeneč",       context: "Praha 6",  type: "Čtvrť",  lat: 50.1003, lon: 14.4031, bbox: [50.090, 50.111, 14.379, 14.426] },
  { name: "Střešovice",    context: "Praha 6",  type: "Čtvrť",  lat: 50.0996, lon: 14.3714, bbox: [50.088, 50.112, 14.349, 14.394] },
  { name: "Břevnov",       context: "Praha 6",  type: "Čtvrť",  lat: 50.0784, lon: 14.3575, bbox: [50.065, 50.093, 14.334, 14.381] },
  { name: "Veleslavín",    context: "Praha 6",  type: "Čtvrť",  lat: 50.0989, lon: 14.3449, bbox: [50.088, 50.112, 14.320, 14.368] },
  { name: "Kobylisy",      context: "Praha 8",  type: "Čtvrť",  lat: 50.1299, lon: 14.4378, bbox: [50.119, 50.141, 14.412, 14.465] },
  { name: "Troja",         context: "Praha 7",  type: "Čtvrť",  lat: 50.1178, lon: 14.4230, bbox: [50.107, 50.129, 14.398, 14.448] },
  { name: "Libeň",         context: "Praha 8",  type: "Čtvrť",  lat: 50.1156, lon: 14.4631, bbox: [50.103, 50.130, 14.435, 14.494] },
  { name: "Karlín",        context: "Praha 8",  type: "Čtvrť",  lat: 50.0948, lon: 14.4561, bbox: [50.087, 50.103, 14.438, 14.477] },
  { name: "Vysočany",      context: "Praha 9",  type: "Čtvrť",  lat: 50.1064, lon: 14.4967, bbox: [50.094, 50.120, 14.466, 14.525] },
  { name: "Prosek",        context: "Praha 9",  type: "Čtvrť",  lat: 50.1248, lon: 14.5011, bbox: [50.112, 50.137, 14.474, 14.528] },
  { name: "Chodov",        context: "Praha 11", type: "Čtvrť",  lat: 50.0254, lon: 14.5029, bbox: [50.010, 50.041, 14.477, 14.530] },
  { name: "Háje",          context: "Praha 11", type: "Čtvrť",  lat: 50.0168, lon: 14.5238, bbox: [50.003, 50.031, 14.503, 14.549] },
  { name: "Modřany",       context: "Praha 12", type: "Čtvrť",  lat: 49.9971, lon: 14.4297, bbox: [49.980, 50.013, 14.397, 14.462] },
  { name: "Braník",        context: "Praha 4",  type: "Čtvrť",  lat: 50.0226, lon: 14.4162, bbox: [50.010, 50.036, 14.396, 14.438] },
  { name: "Barrandov",     context: "Praha 5",  type: "Čtvrť",  lat: 50.0179, lon: 14.3935, bbox: [50.005, 50.031, 14.369, 14.418] },
  { name: "Zbraslav",      context: "Praha 16", type: "Čtvrť",  lat: 49.9691, lon: 14.3978, bbox: [49.953, 49.984, 14.372, 14.424] },
  { name: "Řepy",          context: "Praha 17", type: "Čtvrť",  lat: 50.0624, lon: 14.2978, bbox: [50.047, 50.079, 14.270, 14.326] },
  { name: "Stodůlky",      context: "Praha 13", type: "Čtvrť",  lat: 50.0449, lon: 14.3409, bbox: [50.030, 50.059, 14.312, 14.369] },
  { name: "Zličín",        context: "Praha 17", type: "Čtvrť",  lat: 50.0570, lon: 14.2819, bbox: [50.043, 50.071, 14.255, 14.309] },
  { name: "Hostivař",      context: "Praha 15", type: "Čtvrť",  lat: 50.0488, lon: 14.5341, bbox: [50.035, 50.063, 14.507, 14.562] },
  { name: "Strašnice",     context: "Praha 10", type: "Čtvrť",  lat: 50.0694, lon: 14.5009, bbox: [50.057, 50.083, 14.476, 14.528] },
  { name: "Záběhlice",     context: "Praha 10", type: "Čtvrť",  lat: 50.0531, lon: 14.4878, bbox: [50.041, 50.066, 14.465, 14.511] },
  { name: "Michle",        context: "Praha 4",  type: "Čtvrť",  lat: 50.0501, lon: 14.4633, bbox: [50.038, 50.063, 14.441, 14.487] },
  { name: "Krč",           context: "Praha 4",  type: "Čtvrť",  lat: 50.0298, lon: 14.4389, bbox: [50.015, 50.045, 14.413, 14.466] },
  { name: "Podolí",        context: "Praha 4",  type: "Čtvrť",  lat: 50.0417, lon: 14.4178, bbox: [50.030, 50.054, 14.395, 14.441] },
  { name: "Hlubočepy",     context: "Praha 5",  type: "Čtvrť",  lat: 50.0328, lon: 14.3878, bbox: [50.019, 50.047, 14.364, 14.412] },
  { name: "Motol",         context: "Praha 5",  type: "Čtvrť",  lat: 50.0688, lon: 14.3548, bbox: [50.056, 50.082, 14.330, 14.379] },
  { name: "Radlice",       context: "Praha 5",  type: "Čtvrť",  lat: 50.0588, lon: 14.3848, bbox: [50.046, 50.072, 14.362, 14.408] },
  { name: "Jinonice",      context: "Praha 5",  type: "Čtvrť",  lat: 50.0478, lon: 14.3648, bbox: [50.034, 50.062, 14.340, 14.390] },
  { name: "Nové Butovice", context: "Praha 13", type: "Čtvrť",  lat: 50.0524, lon: 14.3428, bbox: [50.040, 50.065, 14.318, 14.367] },
  { name: "Anděl",         context: "Praha 5",  type: "Čtvrť",  lat: 50.0698, lon: 14.4038, bbox: [50.063, 50.077, 14.390, 14.418] },
];

// Czech cities
const CITIES: KnownPlace[] = [
  { name: "Praha",     context: "Hlavní město", type: "Město", lat: 50.0755, lon: 14.4378, bbox: [49.942, 50.177, 14.224, 14.707] },
  { name: "Brno",      context: "Jihomoravský", type: "Město", lat: 49.1951, lon: 16.6068, bbox: [49.114, 49.282, 16.431, 16.769] },
  { name: "Ostrava",   context: "Moravskoslezský", type: "Město", lat: 49.8209, lon: 18.2625, bbox: [49.741, 49.912, 18.104, 18.421] },
  { name: "Plzeň",     context: "Plzeňský",    type: "Město", lat: 49.7384, lon: 13.3736, bbox: [49.671, 49.805, 13.259, 13.488] },
  { name: "Liberec",   context: "Liberecký",   type: "Město", lat: 50.7663, lon: 15.0543, bbox: [50.710, 50.823, 14.953, 15.168] },
  { name: "Olomouc",   context: "Olomoucký",   type: "Město", lat: 49.5938, lon: 17.2509, bbox: [49.545, 49.643, 17.159, 17.343] },
  { name: "České Budějovice", context: "Jihočeský", type: "Město", lat: 48.9747, lon: 14.4742, bbox: [48.930, 49.020, 14.399, 14.549] },
  { name: "Hradec Králové", context: "Královéhradecký", type: "Město", lat: 50.2092, lon: 15.8328, bbox: [50.161, 50.258, 15.742, 15.924] },
  { name: "Pardubice", context: "Pardubický",  type: "Město", lat: 50.0343, lon: 15.7812, bbox: [49.993, 50.076, 15.697, 15.865] },
  { name: "Zlín",      context: "Zlínský",     type: "Město", lat: 49.2252, lon: 17.6669, bbox: [49.170, 49.281, 17.574, 17.760] },
  { name: "Havířov",   context: "Moravskoslezský", type: "Město", lat: 49.7784, lon: 18.4310, bbox: [49.740, 49.817, 18.368, 18.494] },
  { name: "Kladno",    context: "Středočeský", type: "Město", lat: 50.1472, lon: 14.1055, bbox: [50.110, 50.185, 14.040, 14.171] },
  { name: "Most",      context: "Ústecký",     type: "Město", lat: 50.5027, lon: 13.6361, bbox: [50.461, 50.544, 13.561, 13.711] },
  { name: "Opava",     context: "Moravskoslezský", type: "Město", lat: 49.9383, lon: 17.9048, bbox: [49.887, 49.990, 17.822, 17.988] },
  { name: "Frýdek-Místek", context: "Moravskoslezský", type: "Město", lat: 49.6836, lon: 18.3509, bbox: [49.641, 49.726, 18.272, 18.430] },
  { name: "Karviná",   context: "Moravskoslezský", type: "Město", lat: 49.8555, lon: 18.5434, bbox: [49.817, 49.894, 18.471, 18.616] },
  { name: "Jihlava",   context: "Vysočina",    type: "Město", lat: 49.3961, lon: 15.5912, bbox: [49.349, 49.443, 15.514, 15.668] },
  { name: "Ústí nad Labem", context: "Ústecký", type: "Město", lat: 50.6607, lon: 14.0323, bbox: [50.612, 50.710, 13.932, 14.133] },
  { name: "Teplice",   context: "Ústecký",     type: "Město", lat: 50.6404, lon: 13.8254, bbox: [50.596, 50.685, 13.749, 13.902] },
  { name: "Děčín",     context: "Ústecký",     type: "Město", lat: 50.7739, lon: 14.2104, bbox: [50.723, 50.825, 14.138, 14.283] },
  { name: "Chomutov",  context: "Ústecký",     type: "Město", lat: 50.4609, lon: 13.4175, bbox: [50.414, 50.508, 13.339, 13.496] },
  { name: "Prostějov", context: "Olomoucký",   type: "Město", lat: 49.4722, lon: 17.1075, bbox: [49.428, 49.517, 17.026, 17.189] },
  { name: "Přerov",    context: "Olomoucký",   type: "Město", lat: 49.4558, lon: 17.4515, bbox: [49.407, 49.505, 17.357, 17.546] },
  { name: "Česká Lípa", context: "Liberecký",  type: "Město", lat: 50.6854, lon: 14.5376, bbox: [50.640, 50.731, 14.452, 14.623] },
  { name: "Třebíč",    context: "Vysočina",    type: "Město", lat: 49.2147, lon: 15.8793, bbox: [49.168, 49.262, 15.800, 15.959] },
  { name: "Mladá Boleslav", context: "Středočeský", type: "Město", lat: 50.4116, lon: 14.9063, bbox: [50.366, 50.458, 14.832, 14.981] },
  { name: "Znojmo",    context: "Jihomoravský", type: "Město", lat: 48.8554, lon: 16.0488, bbox: [48.808, 48.903, 15.966, 16.132] },
  { name: "Kolín",     context: "Středočeský", type: "Město", lat: 50.0282, lon: 15.2001, bbox: [49.983, 50.073, 15.126, 15.274] },
  { name: "Příbram",   context: "Středočeský", type: "Město", lat: 49.6942, lon: 14.0077, bbox: [49.647, 49.742, 13.930, 14.086] },
  { name: "Cheb",      context: "Karlovarský", type: "Město", lat: 50.0803, lon: 12.3742, bbox: [50.033, 50.128, 12.295, 12.454] },
  { name: "Karlovy Vary", context: "Karlovarský", type: "Město", lat: 50.2301, lon: 12.8722, bbox: [50.179, 50.281, 12.782, 12.962] },
  { name: "Tábor",     context: "Jihočeský",   type: "Město", lat: 49.4147, lon: 14.6555, bbox: [49.367, 49.463, 14.573, 14.738] },
];

export const ALL_PLACES: KnownPlace[] = [...PRAGUE, ...CITIES];

// Build search index: normalized key → place
const INDEX = new Map<string, KnownPlace>();
for (const p of ALL_PLACES) {
  INDEX.set(normalize(p.name), p);
}

export function searchKnownPlaces(query: string, limit = 5): KnownPlace[] {
  const q = normalize(query);
  if (q.length < 2) return [];

  const results: Array<{ place: KnownPlace; score: number }> = [];

  for (const place of ALL_PLACES) {
    const key = normalize(place.name);
    if (key.startsWith(q)) {
      // Prefix match — score by how close the lengths are (shorter = more precise match)
      results.push({ place, score: 100 - (key.length - q.length) });
    } else if (key.includes(q)) {
      results.push({ place, score: 50 - key.indexOf(q) });
    }
  }

  // Also check context (e.g. query "praha 3" matches context "Praha 3")
  for (const place of ALL_PLACES) {
    const ctxKey = normalize(place.name + " " + place.context);
    if (!results.find(r => r.place === place) && ctxKey.includes(q)) {
      results.push({ place, score: 30 });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.place);
}
