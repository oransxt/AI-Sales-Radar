# Implementation status

Release **SignalBridge 2.2.0**, prepared 2026-09-30. This release renames and packages the tested knowledge-sharing baseline for source control. No paid or free LLM API is called by the shipped runtime.

| Capability | Status |
|---|---|
| Brand Master classification | Implemented; real statuses must be supplied |
| Rules-based knowledge matching and content-derived link labels | Implemented with extraction limits |
| 1–3 distinct knowledge topics | Implemented |
| Official TH/EN template drafts and independent edits | Implemented |
| Internal 20-signal weekday digest | Implemented; not activated in a real account |
| Final review and customer Gmail Draft | Implemented; customer sending is manual |
| Normalized-headline duplicate detection and delivery history | Implemented |
| Original article analysis | Proposed; current discovery reads RSS metadata/headlines |
| Gemini / Ollama / embeddings / RAG | Proposed; not implemented |
| Semantic event deduplication | Proposed; not implemented |
| One signal per brand per batch | Proposed; not implemented |
| Human-feedback prompt memory | Proposed; not implemented |
| Live Google installation | Not performed |

The public package uses fictional brand examples and contains no actual Drive library IDs or research extracts. Default `news_enabled`, `watchlist_news_enabled` and `digest_enabled` are false. Empty knowledge seed ensures sample research cannot be mistaken for verified live documents.

The integration suite uses in-memory Google service mocks and an explicitly injected fictional fixture. Offline browser tests validate editing/export flows only. These checks do not certify Google OCR, OAuth scopes, Gmail delivery or API quotas in the user's account.

The proposed AI design needs model/account eligibility, hardware capacity for private jobs and a representative evidence-grounding evaluation before activation. Software/API fees can be zero within free quota; local computation still uses an existing machine and electricity.
