# SignalBridge

**News to Client Conversations** — เชื่อมข่าวธุรกิจกับ Research, Case Study และ Industry Insights เพื่อเตรียมบทสนทนากับลูกค้า

Current release: **2.2.0 — Knowledge Sharing, Rules + Templates**. The Hybrid AI architecture is documented for review; Gemini, Ollama, embeddings and semantic event deduplication are **not implemented or enabled** in this release.

## What the code does

- Reads source-backed RSS business signals and a Google Sheets Brand Master.
- Separates **New Opportunity / Upsales / Needs Classification** using explicit customer status.
- Selects 1–3 relevant, readable knowledge documents with content-based link labels.
- Generates separately editable official **TH / EN** email drafts without pricing, inventory or media package recommendations.
- Sends internal digests in full batches of 20 unsent signals, weekdays **08:30 ≤ Bangkok time < 18:00**.
- Requires final human review before creating a customer Gmail Draft. Customer sending remains manual.
- Keeps headline-based signal IDs and delivery history to prevent resending the same stored signal.

## Code and documentation

| Path | Contents |
|---|---|
| `apps-script/` | Complete Apps Script backend, pure engine, seed, review UI and manifest |
| `README-TH.md` | Installation and operating guide in Thai |
| `docs/ARCHITECTURE.md` | Current architecture and proposed Hybrid AI architecture |
| `docs/WORKFLOW.md` | Node responsibilities, tools and proposed duplicate policy |
| `docs/STATUS.md` | Implemented versus proposed features and validation limits |
| `Preview.html` | Offline demonstration using fictional signals and documents |
| `Install-Guide.html` | Installation guide with exact copyable source files |
| `scripts/` | Portable builders and package validation |
| `tests/` | Pure-engine, simulated Google integration and optional browser tests |
| `data/` | Non-confidential configuration and fictional examples |

## Quick start

1. Open the offline `Preview.html` to review the interaction. It does not send email or connect to Google.
2. Follow [the Thai guide](README-TH.md) to install the five files in a **separate bound Apps Script project**.
3. Connect your real Brand Master and Drive knowledge folder privately. Replace the three fictional `Demo ...` brand rows before using discovery.
4. Test real Drive access and a customer Gmail Draft before enabling the schedule.

The committed seed contains **no real account book, recipient addresses, private Drive IDs, research extracts or credentials**. News fetching and digest sending start disabled. Do not combine these files with another application's `Code.gs` in the same Apps Script project.

## Rebuild and test

```bash
python3 scripts/build_preview.py
python3 scripts/build_guide.py
python3 scripts/validate_package.py
node tests/core.test.cjs
node tests/server.test.cjs
```

The optional browser check uses Playwright and an installed Chromium:

```bash
npm install --no-save playwright
npx playwright install chromium
node tests/ui.test.cjs
```

## Important boundaries

Headline duplicate detection is implemented. Recognizing different headlines about the same event and limiting a digest to one signal per brand are **design proposals**, not current runtime guarantees. News defaults to a 14-day maximum age; "new to the queue" does not mean published today.

Apps Script triggers and service quotas do not guarantee an exact 08:30 dispatch or unlimited throughput. Live Google OAuth, OCR and Gmail delivery still require account-level validation. Source files and Drive permissions are never made public by this application.

The project name is SignalBridge. The existing repository slug can be renamed independently; no repository visibility, Google deployment or legacy workflow is changed by adding this source package.
