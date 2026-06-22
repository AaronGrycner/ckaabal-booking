# ckaabal Booking CRM

Internal tool for researching live music venues and managing show booking outreach for [ckaabal](https://ckaabal.com).

**Nothing is sent automatically** — the app finds venues, researches booker contacts and genre fit, and drafts booking pitches for manual review.

## Quick start

```bash
npm install
mkdir -p data
npm run db:push
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_PLACES_API_KEY` | For real search | Google Cloud API key with **Places API (New)** enabled |
| `PAGESPEED_API_KEY` | Optional | PageSpeed Insights API key (background research) |
| `MOCK_MODE` | Optional | Set `true` to use sample venue data without API keys |
| `DATABASE_URL` | Optional | Default: `file:./data/booking-crm.db` |
| `OUTREACH_BAND_NAME` | Optional | Band name for email generation (default: ckaabal) |
| `OUTREACH_EPK_URL` | Optional | EPK link for tracked email clicks |
| `OUTREACH_WEBSITE` | Optional | Band website (default: ckaabal.com) |

Without `GOOGLE_PLACES_API_KEY`, mock mode activates automatically.

## Turso (remote database)

When `TURSO_DATABASE_URL` is set in `.env.local`, the app uses Turso instead of local SQLite.

```bash
# One-time: install CLI and log in
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login

# Create db, push schema, write credentials to .env.local
npm run db:setup-turso
```

For Vercel, set the same `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in project environment variables.

## Usage

1. Enter a **venue type** (e.g. `live music venues`) and **location** (e.g. `Nashville TN`)
2. Results appear from Google Places within seconds
3. Site research runs **in the background** — contacts, genres, and booking signals
4. Sort by fit score (best venues first, pending at bottom)
5. Open a venue to review research and generate a booking pitch email
6. Export to CSV for offline work

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:push` | Sync SQLite schema |
| `npm run db:generate` | Generate migrations |
| `npm run db:migrate` | Run migrations |

## Architecture notes

- **Next.js App Router** + Server Actions
- **SQLite** via Drizzle ORM (local storage)
- Search saves venues immediately; contact/genre research runs async
- Fit scoring prioritizes booker contacts, live music signals, and genre match
- AI drafts band booking pitches anchored on venue-specific research

## Compliance

- Uses Google Places Text Search and PageSpeed Insights APIs
- Fetches venue websites directly for contact and genre research
- No automated email or bulk outreach
