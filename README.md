# AI Sales Radar

Thailand-first sales opportunity discovery and preparation system.

## Production flow

GitHub Actions schedule → Google News RSS discovery → rule pre-filter →
**optional Gemini enrichment** → grounded validation → deterministic rule scoring →
Top 20 → Google Sheets + GitHub Pages → credential matching → editable email →
**human final decision**.

The production workflow does not check Salesforce, discover contacts, send emails,
recommend media placements, or determine account ownership. Sales manually selects
Available / Existing Client / Has Owner / Skip, reviews the email, and sends via Gmail.

## Gemini integration (v2.4.0)

The server-side module `scripts/gemini-enrich.mjs` sends **public RSS headlines only**
to Gemini, in up to **three batches of ten rule-ranked candidate brands** per run.
It requests structured JSON for brand normalization, signal classification,
Thailand relevance, business context, why-now hypothesis, sales angle, next best
action, and evidence confidence.

Only validated results are used. Brand names must appear in source headlines.
Gemini cannot assign arbitrary opportunity scores. The existing rule engine
recalculates signal and timing points, deduplicates canonical brand names, and
selects the Top 20. Original headline evidence and source links are preserved.

The static `docs/data/daily.json` contains an `aiEnrichment` run summary and
validated per-lead `ai` metadata when available. The dashboard joins these
AI insights to same-day Google Sheet records by brand name; its fallback JSON
mode also preserves AI metadata. No API credentials are stored in public files.

### One-time activation

1. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
2. Name the secret exactly `GEMINI_API_KEY`, and paste your Google AI Studio
   API key **there**, never into chat, code, Issues, or public dashboard.
3. The workflow already sets `GEMINI_ENABLED=true` and defaults to
   `gemini-3.1-flash-lite`. No additional configuration is needed for a
   supported key/project. You can change `GEMINI_MODEL` in the workflow.
4. On the next scheduled workflow run, inspect the `Gemini enrichment` log
   and the `aiEnrichment.status` field in `docs/data/daily.json`.

If the secret is missing, the API is unavailable, quota is exceeded, a model
is not accessible, or JSON validation fails, the workflow **continues with
the original rule-only Top 20**. It does not retry mutating Google Sheet sync
or automatically send outreach. `success` means some AI records passed
validation; check `accepted` versus `attempted` for coverage.

**Cost:** Google API Free Tier availability and limits depend on the project,
region, billing, and model. If billing is enabled, API requests may incur
charges. This workflow caps calls to three per run and does not enable Google
Search Grounding, URL Context, or other extra-cost tools.

## Verification

```sh
node --test tests/gemini-enrich.test.mjs
node --check scripts/discover.mjs
node --check scripts/gemini-enrich.mjs
node --check docs/app.js
```

GitHub Actions runs tests before each discovery. Daily Radar keeps its
08:17 Asia/Bangkok schedule; GitHub scheduled jobs are best-effort and may
be delayed. The latest committed radar data can be viewed on GitHub Pages.

## Repository

- `scripts/discover.mjs`: public RSS, rule pre-filter, AI hook, deterministic
  score/rank, history
- `scripts/gemini-enrich.mjs`: bounded Gemini REST requests, validation,
  safe fallback
- `scripts/sync-sheet.mjs`: Apps Script ContentService sync
- `docs/`: dashboard and public daily JSON
- `apps-script/`: existing Google Sheet/credential bridge
- `tests/`: mock API and safety/fallback tests
