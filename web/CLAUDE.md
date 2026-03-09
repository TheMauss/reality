# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CenovýPád** — a Czech real estate price monitoring platform. Scrapes Sreality.cz, detects price drops, and provides market analytics (rental yields, price trends, spread analysis) across Czech regions.

This is the **web/** frontend of a monorepo:
```
reality/
├── web/        ← you are here (Next.js frontend)
├── scraper/    ← Node.js Sreality scraper
├── alerts/     ← Email & Telegram notifications
└── shared/     ← Shared types & DB utilities
```

## Commands

```bash
npm run dev     # Start dev server at http://localhost:3000
npm run build   # Production build
npm start       # Run production server
npm run lint    # ESLint checks
```

No test suite is configured.

## Architecture

### Database
- SQLite via `better-sqlite3`, opened **read-only** in `src/lib/db.ts`
- Default path: `../cenovypad.db` (parent directory), overridden by `SQLITE_PATH` env var
- The scraper (not this app) writes to the DB; the web app only reads

Key tables: `listings`, `price_drops`, `sold_regions`, `sold_districts`, `sold_wards`, `sold_price_history`, `sold_transactions`

### API Routes (`src/app/api/`)
All 17 routes are Next.js App Router route handlers that query SQLite directly and return JSON. No ORM — raw SQL via better-sqlite3.

Key routes: `/api/drops`, `/api/listings`, `/api/listing`, `/api/stats`, `/api/regions`, `/api/districts`, `/api/sold/*`, `/api/map/*`

### Pages
- `/` — Price drops feed (homepage)
- `/inzerce` — All listings with filters
- `/prodeje` — Regional sales analytics
- `/prodeje/kraj/[id]`, `/prodeje/okres/[id]`, `/prodeje/obec/[id]` — Region/district/ward detail
- `/data` — Spread, yield, price trend dashboard
- `/mapa` — Interactive Leaflet map
- `/trh` — Market analysis
- `/listing/[id]` — Single listing detail with price history

### Key Implementation Details
- **Maps** use Leaflet + react-leaflet with dynamic imports (client-side only)
- **`src/lib/sreality-url.ts`** fixes malformed Sreality.cz image URLs
- Dark theme with CSS variables defined in `globals.css`; Tailwind CSS 4 via PostCSS
- Path alias `@/*` maps to `src/*`
- TypeScript strict mode enabled
