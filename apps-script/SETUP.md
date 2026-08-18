# AI Sales Radar v1.9.5 — Google Apps Script API Bridge

This bridge connects the existing GitHub Pages dashboard to the Google Sheet:

`AI Sales Radar — Master Data & Activity`

Spreadsheet ID:
`1CC6qCo8ThdOiSfmfVdzxSuTArVQ5ZVfmRmw5lUNw6oo`

## What it supports

- Read latest `Daily_Radar`
- Read `Brand_Master`
- Read `Activity_Log`
- Update `Salesforce_Status`
- Append `STATUS_CHANGED` and other activities
- Sync future Daily Radar results directly into Google Sheets
- Preserve Brand IDs and existing Salesforce status

## One-time deployment

1. Open the Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with the contents of `apps-script/Code.gs` from this repository.
4. In Apps Script Project Settings, enable the manifest file if needed and use `apps-script/appsscript.json`.
5. Run `setupBridge()` once.
6. Approve the requested Google Sheets / Apps Script permissions.
7. Open the **Execution log** and copy the generated `RADAR_API_KEY`.
   - Keep this key private.
   - Do not commit it to GitHub.
8. Click **Deploy → New deployment → Web app**.
9. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**
10. Deploy and copy the Web App URL.

## Test

Open:

`WEB_APP_URL?action=health&key=YOUR_RADAR_API_KEY`

Expected JSON:

```json
{
  "ok": true,
  "version": "1.9.5"
}
```

## API examples

### Latest Daily Radar

`GET WEB_APP_URL?action=daily-radar&key=YOUR_KEY`

### Brands

`GET WEB_APP_URL?action=brands&key=YOUR_KEY`

Optional:

`&status=Available&limit=100`

### Activities

`GET WEB_APP_URL?action=activities&key=YOUR_KEY&brandId=BR0236`

### Update Salesforce status

POST JSON to the Web App URL:

```json
{
  "key": "YOUR_KEY",
  "action": "status",
  "brandId": "BR0236",
  "status": "Available",
  "origin": "Dashboard"
}
```

Allowed statuses:

- Not Checked
- Available
- Has Owner
- Existing Client
- Skip

The bridge updates `Brand_Master`, updates the latest matching `Daily_Radar` record, and appends a `STATUS_CHANGED` record to `Activity_Log`.

### Sync a Daily Radar batch

```json
{
  "key": "YOUR_KEY",
  "action": "sync-radar",
  "discoveryDate": "2026-08-18",
  "engineVersion": "free-radar-v1",
  "items": [
    {
      "rank": 1,
      "brand": "Example Brand",
      "company": "Example Co.",
      "industry": "Retail",
      "brandType": "Emerging",
      "buyingSignal": "Opened a new flagship store in Bangkok",
      "signalDate": "2026-08-18",
      "whyNow": "Immediate launch and traffic-driving window",
      "priority": "HIGH",
      "revenueMin": 2,
      "revenueMax": 5,
      "sourceUrl1": "https://example.com/article"
    }
  ]
}
```

For a brand already in `Brand_Master`, the script keeps its existing `Salesforce_Status` and updates its latest signal/history. New brands receive the next `BR####` ID automatically.

## Security design

The Web App is technically reachable from the internet, but every GET and POST request requires `RADAR_API_KEY` stored in Apps Script Script Properties. The key must not be hard-coded in this public GitHub repository.

For the dashboard integration, store the Web App URL and API key in the user's browser only (for example localStorage) and provide a Settings screen to rotate/update them.

If the API key is exposed, run `rotateApiKey()` in Apps Script and update the dashboard setting.
