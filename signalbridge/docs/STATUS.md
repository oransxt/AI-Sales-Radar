# Implementation status

Release **SignalBridge 2.3.1**, prepared 2026-10-01.

| Capability | Status |
|---|---|
| Rules-based discovery, objective inference, Brand Master classification | Implemented |
| 1–3 knowledge topics and content-derived labels | Implemented, extraction/keyword limits apply |
| TH/EN templates and independently editable drafts | Implemented |
| Company Gemini prompt and JSON import | Implemented as a manual browser handoff |
| ID/headline/source duplicate protection across delivered IDs | Implemented |
| Internal 20-signal weekday digest and delivery reconciliation | Implemented, live account not activated |
| Owner-only review and customer Gmail Draft | Implemented, customer sending manual |
| Read-only production readiness report and activation gate | Implemented |
| Original article reading / semantic event deduplication | Human review, not automated |
| LLM API / model worker / embedding service | Not used |
| Live Google installation, OAuth, corporate Gemini and Gmail validation | Requires account-level installation and live checks |

The public package contains no real client import, company contact addresses, knowledge extracts or Drive library IDs. News and digest switches remain disabled by default until deployment settings are supplied.

Tests use fictional fixtures and in-memory Google service mocks. They do not certify real OAuth, Drive OCR, corporate permissions or email deliverability. See PRODUCTION.md for live checks, monitoring and rollback.
