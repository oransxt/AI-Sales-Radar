# SignalBridge

**News to Client Conversations**

ระบบรวบรวมข่าวธุรกิจ คัด Research / Case Study / Industry Insights และเตรียมบทสนทนากับลูกค้า

## Latest implementation package — 2.3.1

- [Source and tests](signalbridge/)
- [Thai installation guide](signalbridge/README-TH.md) and [exact code copy guide](signalbridge/Install-Guide.html)
- [Production installation, acceptance and rollback](signalbridge/docs/PRODUCTION.md)
- [Workflow](signalbridge/docs/WORKFLOW.md), [Architecture](signalbridge/docs/ARCHITECTURE.md) and [Status](signalbridge/docs/STATUS.md)

Apps Script handles rules-based discovery/classification, knowledge matching and internal digests of20 eligible unsent signals on weekdays08:30–17:59 Bangkok. Salespeople use **company Gemini in the browser**, import TH/EN text, inspect evidence and choose a language before creating Gmail Draft. Customer Send is manual. No LLM API or local model is used.

Checks:76 pure-engine and40 simulated Google integration checks pass. Live company Google authorization, Drive OCR/access, Gemini account and Gmail delivery remain account-level installation checks. Review is owner-only in this release.

The public seed uses fictional brands. Real Brand Master imports, contacts, knowledge extracts and live Settings remain in private company Sheets/Drive. Deterministic ID/headline/source URL deduplication is implemented; differently worded same-event news needs human review.

## Existing runtime

The older root apps-script/, scripts/, docs/, skills/ and automation files remain for compatibility. Use signalbridge/apps-script/ in a separate bound Sheet project. Stop the old digest schedule and preserve delivery history during migration. This source update does not deploy or activate either Google workflow.

The project name is SignalBridge. The repository retains its original URL slug.
