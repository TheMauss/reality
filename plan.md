# Watchdog — Implementační plán

## Funkce watchdogu

### 1. Filtry (uživatel si nastaví)
- **Kategorie** — byty/domy/pozemky × prodej/nájem
- **Lokalita** — kraj, okres, město
- **Cenové rozpětí** — min/max cena
- **Plocha** — min/max m²
- **Klíčová slova** — hledání v titulku/popisu (např. "balkon", "garáž")
- **Pod tržní cenou** — listing je X % pod průměrnou prodejní cenou/m² v dané obci/okrese (z `sold_transactions`)

### 2. Typy sledování (kombinovatelné)
- **Nové inzeráty** — notifikace na nový listing odpovídající filtrům
- **Cenové poklesy** — sledování poklesů cen (min X %)
- **Podhodnocené listingy** — cena/m² je X % pod lokálním průměrem prodejních cen
- **Návrat odstraněných** — listing byl odstraněn a znovu se objevil

### 3. Notifikace
- **Email** (Resend)
- **Telegram**
- **Frekvence** — okamžitě / denní souhrn / týdenní souhrn

### 4. Dashboard (web)
- Přehled aktivních watchdogů
- Historie matchnutých listingů per watchdog
- Zapnutí/vypnutí jednotlivých watchdogů

---

## Implementační kroky

### Krok 1: DB schema — nové tabulky

**`watchdogs`** — definice hlídacích psů
```sql
CREATE TABLE IF NOT EXISTS watchdogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,                    -- uživatelský název ("Byty Praha pod 5M")
  active INTEGER NOT NULL DEFAULT 1,     -- 0/1 zapnuto/vypnuto

  -- Filtry
  category TEXT,                         -- "byty-prodej", "domy-najem", ...
  region_id INTEGER,
  district_id INTEGER,
  location TEXT,                         -- LIKE match na město
  price_min INTEGER,
  price_max INTEGER,
  area_min REAL,
  area_max REAL,
  keywords TEXT,                         -- JSON array ["balkon", "garáž"]

  -- Typy sledování
  watch_new INTEGER NOT NULL DEFAULT 1,         -- nové inzeráty
  watch_drops INTEGER NOT NULL DEFAULT 0,       -- cenové poklesy
  watch_drops_min_pct REAL DEFAULT 5,           -- min % poklesu
  watch_underpriced INTEGER NOT NULL DEFAULT 0, -- pod tržní cenou
  watch_underpriced_pct REAL DEFAULT 15,        -- X % pod průměrem
  watch_returned INTEGER NOT NULL DEFAULT 0,    -- návrat odstraněných

  -- Notifikace
  notify_email INTEGER NOT NULL DEFAULT 1,
  notify_telegram INTEGER NOT NULL DEFAULT 0,
  notify_frequency TEXT NOT NULL DEFAULT 'instant', -- instant/daily/weekly

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_wd_user ON watchdogs(user_id);
CREATE INDEX idx_wd_active ON watchdogs(active);
```

**`watchdog_matches`** — nalezené shody
```sql
CREATE TABLE IF NOT EXISTS watchdog_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watchdog_id INTEGER NOT NULL REFERENCES watchdogs(id),
  listing_id TEXT NOT NULL,
  match_type TEXT NOT NULL,              -- "new" / "drop" / "underpriced" / "returned"
  match_detail TEXT,                     -- JSON: { drop_pct, old_price, new_price } nebo { avg_price_m2, listing_price_m2, diff_pct }
  notified INTEGER NOT NULL DEFAULT 0,  -- 0/1 už bylo odesláno
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_wm_watchdog ON watchdog_matches(watchdog_id, created_at);
CREATE INDEX idx_wm_listing ON watchdog_matches(listing_id);
CREATE INDEX idx_wm_notified ON watchdog_matches(notified);
```

Soubor: `shared/db.ts` — přidat CREATE TABLE do `initDb()`

---

### Krok 2: Watchdog engine — `scraper/src/watchdog.ts`

Nový modul s hlavní funkcí `runWatchdog()`, volaný po každém scrape runu:

```
runWatchdog(events: ScrapeEvents)
  │
  ├── Načti všechny aktivní watchdogy z DB
  │
  ├── Pro každý event (new/drop/returned):
  │   ├── Najdi watchdogy kde filtr matchuje listing
  │   ├── Zkontroluj typ sledování (watch_new, watch_drops, ...)
  │   └── Vlož do watchdog_matches
  │
  ├── Podhodnocené listingy (batch):
  │   ├── Načti watchdogy s watch_underpriced=1
  │   ├── Pro relevantní listingy spočítej cenu/m²
  │   ├── Porovnej s avg_price_m2 z sold_wards/sold_districts
  │   └── Pokud diff >= watch_underpriced_pct → vlož match
  │
  └── Odešli notifikace:
      ├── instant → okamžitě email/telegram
      ├── daily/weekly → jen uloží, odesílá se cronem
      └── Označ notified=1
```

**Klíčové funkce:**

```typescript
// Hlavní entry point — volá se po scrape
export function runWatchdog(db: Database, events: ScrapeEvents): void

// Zkontroluje zda listing odpovídá filtrům watchdogu
function matchesFilter(listing: Listing, watchdog: Watchdog): boolean

// Spočítá průměrnou prodejní cenu/m² pro lokalitu listingu
function getLocalAvgPriceM2(db: Database, listing: Listing): number | null

// Zkontroluje zda je listing podhodnocený
function isUnderpriced(listing: Listing, avgPriceM2: number, thresholdPct: number): boolean

// Odešle notifikace pro instant watchdogy
function sendInstantNotifications(db: Database, matches: WatchdogMatch[]): Promise<void>
```

**Interface `ScrapeEvents`:**
```typescript
interface ScrapeEvents {
  newListings: Listing[]
  priceDrops: { listing: Listing, oldPrice: number, newPrice: number, dropPct: number }[]
  returnedListings: Listing[]
}
```

---

### Krok 3: Integrace do scraperu

Soubor: `scraper/src/scrape.ts`

- V `runScrape()` a `runFastScan()` — sbírat eventy (new, drop, returned) do pole
- Po dokončení scrape volat `runWatchdog(db, events)`
- Přidat do logování počet watchdog matchů

---

### Krok 4: Notifikace — rozšířit alerts

Soubor: `alerts/src/notifier.ts` (nebo nový `alerts/src/watchdog-notify.ts`)

- **Instant**: volá se přímo z watchdog engine po matchi
- **Daily digest**: cron job (08:00) — sesbírá neodeslaný `watchdog_matches` za posledních 24h, seskupí per watchdog, odešle email/telegram
- **Weekly digest**: cron job (pondělí 08:00) — stejné, za 7 dní
- Email šablona: tabulka matchů s odkazem na listing, typ matche, detail (pokles %, pod průměrem %)
- Telegram zpráva: formátovaný text s emoji a odkazy

---

### Krok 5: API routes (web)

**CRUD watchdogů:**
- `GET /api/watchdogs` — seznam watchdogů uživatele
- `POST /api/watchdogs` — vytvořit nový watchdog
- `PUT /api/watchdogs/[id]` — upravit watchdog
- `DELETE /api/watchdogs/[id]` — smazat watchdog
- `PATCH /api/watchdogs/[id]/toggle` — zapnout/vypnout

**Historie matchů:**
- `GET /api/watchdogs/[id]/matches` — matchnuté listingy pro daný watchdog (s paginací)

**Průměrné ceny (helper):**
- `GET /api/avg-price?district_id=X&category=Y` — vrátí avg cenu/m² pro lokalitu (pro UI preview)

---

### Krok 6: Frontend — watchdog dashboard

**Stránka `/watchdog`:**
- Seznam watchdogů uživatele (karty s názvem, filtry, počet matchů, toggle)
- Tlačítko "Nový watchdog" → formulář/modal
- Klik na watchdog → detail s historií matchů

**Formulář nového watchdogu:**
- Název
- Kategorie (select)
- Lokalita (kraj → okres → město kaskáda)
- Cenové rozpětí (range inputs)
- Plocha (range inputs)
- Klíčová slova (tag input)
- Pod tržní cenou (checkbox + % input, zobrazí aktuální průměr pro vybranou lokalitu)
- Typy sledování (checkboxy)
- Notifikace (email/telegram checkboxy, frekvence select)

**Matchnuté listingy:**
- Tabulka/karty s listing info + typ matche + detail (pokles %, pod průměrem %)
- Odkaz na detail listingu

---

### Krok 7: Telegram bot — nové příkazy

Soubor: `alerts/src/telegram.ts`

- `/watchdog list` — seznam aktivních watchdogů
- `/watchdog add <název>` — quick-create s defaultním nastavením (nové byty-prodej, instant)
- `/watchdog pause <id>` — pozastavit
- `/watchdog resume <id>` — obnovit
- `/watchdog delete <id>` — smazat

---

## Pořadí implementace

1. **DB schema** — tabulky `watchdogs` + `watchdog_matches` (v `shared/db.ts`)
2. **Watchdog engine** — nový `scraper/src/watchdog.ts` s matchováním a underpriced logikou
3. **Integrace do scraperu** — sbírat eventy, volat engine
4. **API routes** — CRUD + matches
5. **Notifikace** — instant + digest cron
6. **Frontend** — dashboard stránka
7. **Telegram** — nové příkazy
