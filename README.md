# homesight

MVP for U.S. home buyers: paste a listing URL and get an instant analysis backed by real external data.

## What it does

- Accepts listing URL input and sends it to a backend analyzer (`POST /api/analyze`)
- Pulls listing metadata from the real listing page (JSON-LD/meta extraction)
- Enriches with live public data:
  - 30-year mortgage rate from FRED
  - geocoding from Nominatim (OpenStreetMap)
  - nearby amenity counts from Overpass API
  - current local weather from Open-Meteo
- Returns a buyer-facing analysis payload:
  - deal score
  - estimated monthly payment
  - data coverage summary
  - risk flags
  - recommended actions
- Includes subscription positioning (`Homesight Pro`) for serious buyers (B2C)

## Run locally

Install dependencies and run the web app + API server:

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Test

```bash
npm test
```