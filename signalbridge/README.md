# SignalBridge 2.3 — Company Gemini workflow

News to Client Conversations for Plan B Media. Google Apps Script collects RSS signals, classifies brands, ranks 1–3 knowledge documents and sends internal batches of 20. Salespeople use company Gemini in the browser, import independently editable TH/EN drafts, review the evidence and create a Gmail Draft.

## Deployment

Use `Install-Guide.html` for the five Apps Script source files and installation instructions. Read `docs/PRODUCTION.md` for activation, migration, live acceptance checks, monitoring and rollback. This source package calls no LLM API, requires no model installation and does not enable a paid AI service.

Brand and knowledge records in the public seed are fictional. Keep company brand imports, document extracts, contact details and live settings out of the public repository.

## Verification

Run `node tests/core.test.cjs`, `node tests/server.test.cjs`, and `python3 scripts/validate_package.py`. `Preview.html` is an offline fixture, not a production deployment. Live Google OAuth, OCR, corporate Gemini access and Gmail delivery require verification in the installing account.

## Operating limits

Internal digest: weekdays Asia/Bangkok, from 08:30 inclusive to 18:00 exclusive. Exactly 20 eligible signals per batch; smaller queues wait. Apps Script polls every five minutes and dispatch time depends on Google triggers and quotas. Customer emails remain manually sent.

Deduplication covers delivered IDs, normalized brand/headline and equivalent source URLs. Differently worded reporting of the same event can require human review. A brand can recur for a new event. Only the installer account administers the bound Sheet and generates drafts in this release.
