# homesight

BuyerLens-style web prototype for U.S. home buyers: paste a listing URL and get an instant analysis.

## What it does

- Primary flow: user pastes a listing URL (Zillow/Redfin/Realtor.com compatible format)
- Generates instant analysis output:
  - deal score
  - fair-value estimate
  - neighborhood fit score
  - estimated monthly payment
  - risk flags and next buyer actions
- Includes a clear B2C subscription positioning (`BuyerLens Pro`) for serious buyers
  - free trial call-to-action
  - monthly pricing model
  - premium features (alerts, history, negotiation playbook)

## Run locally

Because this is a static single-page site, you can open `index.html` directly in a browser.

If you prefer serving it over HTTP:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.