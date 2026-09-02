# Listune Top Chart

> JSON API for Spotify top daily tracks data, scraped from [Kworb.net](https://kworb.net) and enriched with official Spotify metadata.

## Overview

Listune Top Chart is a **JSON-only API service** built with Next.js that scrapes Spotify daily track chart data from Kworb.net, enriches it with high-res album cover art and Spotify links via token-free Spotify oEmbed, and serves it through clean REST endpoints backed by **Drizzle ORM**.

### Key Features

- **Top Daily Tracks** — Scraped from Kworb.net for 20+ countries + global
- **Token-Free Metadata Enrichment** — Direct Spotify Track ID extraction with official Spotify oEmbed cover art resolution (100% free, 0 rate limits, no API keys needed)
- **Multi-Dialect Database** — Powered by **Drizzle ORM** with automatic dialect support for **MySQL**, **PostgreSQL**, and **SQLite**
- **Historical Data & Deltas** — Daily snapshots with computed rank changes (`rankDelta`, `previousRank`)
- **Multi-Country Support** — Global + 19 country-specific charts
- **Auto-Refresh Cron** — Automated data refresh via GitHub Actions or manual trigger endpoint

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Database | MySQL / PostgreSQL / SQLite |
| ORM | [Drizzle ORM](https://orm.drizzle.team/) & [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) |
| Drivers | `mysql2` (MySQL), `pg` (PostgreSQL), `@libsql/client` (SQLite) |
| Scraping | [Cheerio](https://cheerio.js.org/) |
| Metadata | Spotify oEmbed API (Token-Free) |
| Deployment | Vercel / Hostinger / Node.js Server |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn / pnpm
- MySQL, PostgreSQL, or local SQLite database

### Installation

```bash
# Clone the repository
git clone https://github.com/lrmn7/listune-top-chart.git
cd listune-top-chart

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Environment Variables

Edit `.env` according to your database:

```env
# ==============================================================================
# Listune Top Chart — Environment Configuration
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Server Configuration
# ------------------------------------------------------------------------------
PORT=3000

# ------------------------------------------------------------------------------
# 2. Database Connection (Drizzle ORM Multi-Dialect)
# ------------------------------------------------------------------------------
# Listune auto-detects dialect based on your DATABASE_URL prefix:
#
#   • SQLite (Local / Default)    : "file:./dev.db"
#   • PostgreSQL (Supabase, Neon) : "postgresql://user:password@host:5432/dbname"
#   • MySQL (Hostinger, Aiven)    : "mysql://user:password@host:3306/dbname"
#
DATABASE_URL="file:./dev.db"

# ------------------------------------------------------------------------------
# 3. Security & Admin Authentication
# ------------------------------------------------------------------------------
# Secret key required in x-admin-secret header for POST /api/scrape-chart
ADMIN_SECRET=your_secure_admin_secret_key_here

# ------------------------------------------------------------------------------
# 4. Data Scraper & Chart Settings
# ------------------------------------------------------------------------------
# Comma-separated country codes to scrape and store daily from Kworb.net.
# Supported codes: global, id, my, us, gb, nl, jp, de, fr, br, mx, kr, in, au, es, it, ca, se, ph, tr, ar
SCRAPE_COUNTRIES=global,id,my,us,gb,nl,jp,de,fr,br,mx,kr,in,au,es,it,ca,se,ph,tr,ar

# Number of top tracks and artists to fetch per country (default: 25, max: 200)
TOP_TRACKS_LIMIT=25
TOP_ARTISTS_LIMIT=25
```

> [!NOTE]
> **No Spotify Client ID or Secret required!** Metadata and cover art are resolved automatically via Kworb Spotify URLs and official Spotify oEmbed.

---

## Database Management with Drizzle ORM

The system automatically detects your database type from `DATABASE_URL`:

- **MySQL**: `src/lib/db/schema/mysql.ts`
- **PostgreSQL**: `src/lib/db/schema/pg.ts`
- **SQLite**: `src/lib/db/schema/sqlite.ts` (Auto-initializes tables & indexes on launch)

### Useful Database Commands

```bash
# Push schema directly to your database
npm run db:push

# Generate SQL migrations
npm run db:generate

# Launch Drizzle Studio web GUI
npm run db:studio

# Check data count in database
node check-data.js

# Run data refresh manually
node refresh-data.js
```

### Running the App

```bash
# Development server
npm run dev

# Production build & start
npm run build
npm run start

# All-in-one production deploy
npm run start:prod
```

---

## API Endpoints

### Tracks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats/tracks` | Top daily tracks with streams, rank, and Spotify metadata |
| `GET` | `/api/stats/tracks/history` | Track stream/rank history over time |
| `GET` | `/api/stats/countries` | List of supported countries |
| `GET` | `/api/stats/last-updated` | Timestamp of last data refresh |
| `GET` | `/api/test-db` | Database connection diagnostic tool |

### Query Parameters

#### `/api/stats/tracks`
| Param | Default | Description |
|-------|---------|-------------|
| `country` | `global` | Country code (e.g., `id`, `us`, `gb`, `my`) |
| `limit` | `25` | Number of tracks to return |

#### `/api/stats/tracks/history`
| Param | Default | Description |
|-------|---------|-------------|
| `trackName` | — | Track name (required) |
| `artistName` | — | Artist name (required) |
| `country` | `global` | Country code |
| `days` | `30` | Number of days of history |

### Admin & Cron

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cron/refresh?secret=YOUR_ADMIN_SECRET` | Trigger data refresh via query secret |
| `POST` | `/api/cron/refresh` | Trigger data refresh with `Bearer <ADMIN_SECRET>` header |

### Example Response

```json
GET /api/stats/tracks?country=global&limit=1

{
  "tracks": [
    {
      "trackId": "3h5T5JypYU7huFiVYhv1dr",
      "name": "BbY WOW (w/ Judeline, rusowsky)",
      "mainArtistName": "KAROL G",
      "rank": 1,
      "previousRank": 1,
      "rankDelta": 0,
      "dailyStreams": 8500000,
      "totalStreams": 3200000000,
      "imageUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0221deb742375f88edfb2e7368",
      "previewUrl": null,
      "spotifyUrl": "https://open.spotify.com/track/3h5T5JypYU7huFiVYhv1dr",
      "lastUpdated": "2026-09-02T03:00:00.000Z"
    }
  ]
}
```

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── cron/refresh/         # Data refresh endpoint
│   │   ├── debug-ranks/          # Duplicate rank cleaner
│   │   ├── test-db/              # Database health check
│   │   └── stats/
│   │       ├── tracks/           # Top tracks API
│   │       │   └── history/      # Historical stream data
│   │       ├── countries/        # Supported countries list
│   │       └── last-updated/     # Last refresh timestamp
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # Interactive API playground UI
├── lib/
│   ├── db.ts                     # Unified multi-dialect Drizzle ORM client
│   ├── db/
│   │   └── schema/
│   │       ├── mysql.ts          # MySQL Drizzle schema
│   │       ├── pg.ts             # PostgreSQL Drizzle schema
│   │       ├── sqlite.ts         # SQLite Drizzle schema
│   │       └── index.ts          # Schema barrel export
│   ├── types.ts                  # TypeScript interfaces
│   ├── spotify/
│   │   └── metadata.ts           # Token-free Spotify oEmbed metadata resolver
│   ├── services/
│   │   └── statsProvider.ts      # Core aggregation and scraping service
│   └── scraping/
│       ├── kworbTracks.ts        # Global top tracks scraper
│       ├── kworbCountry.ts       # Multi-country chart scraper
│       └── kworbIndonesia.ts     # Indonesia-specific scraper
├── drizzle.config.ts             # Drizzle Kit multi-dialect configuration
├── refresh-worker.ts             # Standalone CLI refresh runner
├── refresh-data.js               # CLI trigger script
├── check-data.ts                 # Database status inspector
└── server.js                     # Custom server (Hostinger LiteSpeed / Node compatible)
```

---

## Data Flow

```
Kworb.net  ──scrape (cheerio)──▶  Raw Track & Spotify Track ID
                                       │
                                       ▼
                             Spotify oEmbed API
                          (Album Cover Art & URL)
                                       │
                                       ▼
                               statsProvider.ts
                               (Merge & Enrich)
                                       │
                                       ▼
                           Drizzle ORM / Database
                        (MySQL / PostgreSQL / SQLite)
                                       │
                                       ▼
                                JSON API Routes
```

---

## Deployment Guide

### Hybrid Setup (GitHub Actions + Vercel)

- **GitHub Actions**: Handles daily scraping and database population.
- **Vercel**: Serves the high-speed serverless JSON API.
- **Database (MySQL / Postgres)**: Shared storage.

#### Step 1: GitHub Actions Secrets
In your GitHub repo under **Settings → Secrets and variables → Actions**, add:

| Secret | Description | Example |
|--------|-------------|---------|
| `DATABASE_URL` | Database connection string | `mysql://user:pass@host:3306/dbname` |
| `ADMIN_SECRET` | Secret for refresh authorization | `your_secret_string` |
| `SCRAPE_COUNTRIES` | Countries to scrape (optional) | `global,id,my,us,gb` |
| `TOP_TRACKS_LIMIT` | Track limit per country (optional) | `25` |

#### Step 2: Deploy to Vercel
1. Import repo on [vercel.com](https://vercel.com).
2. Set `DATABASE_URL` and `ADMIN_SECRET` in Vercel environment variables.
3. Deploy!

---

## Supported Countries

| Code | Country | Code | Country |
|------|---------|------|---------|
| `global` | 🌍 Global | `kr` | 🇰🇷 South Korea |
| `id` | 🇮🇩 Indonesia | `in` | 🇮🇳 India |
| `my` | 🇲🇾 Malaysia | `au` | 🇦🇺 Australia |
| `us` | 🇺🇸 United States | `es` | 🇪🇸 Spain |
| `gb` | 🇬🇧 United Kingdom | `it` | 🇮🇹 Italy |
| `jp` | 🇯🇵 Japan | `ca` | 🇨🇦 Canada |
| `de` | 🇩🇪 Germany | `se` | 🇸🇪 Sweden |
| `fr` | 🇫🇷 France | `ph` | 🇵🇭 Philippines |
| `br` | 🇧🇷 Brazil | `tr` | 🇹🇷 Turkey |
| `mx` | 🇲🇽 Mexico | `ar` | 🇦🇷 Argentina |
| `nl` | 🇳🇱 Netherlands | | |

---

## License

MIT License. For educational and personal use.
