# SignalBridge

**News to Client Conversations**

โปรเจกต์รุ่นล่าสุดเชื่อมข่าวธุรกิจกับ Research, Case Study และ Industry Insights เพื่อเตรียมอีเมล TH/EN ที่ผู้ขายตรวจได้ก่อนส่ง

## Latest source package

| Resource | Link |
|---|---|
| Complete source and tests | [signalbridge/](signalbridge/) |
| Project overview | [SignalBridge README](signalbridge/README.md) |
| Thai installation guide | [คู่มือติดตั้ง](signalbridge/README-TH.md) |
| Workflow and duplicate policy | [Workflow](signalbridge/docs/WORKFLOW.md) |
| Current and proposed AI architecture | [Architecture](signalbridge/docs/ARCHITECTURE.md) |
| Implemented versus planned features | [Status](signalbridge/docs/STATUS.md) |
| Offline demo / exact code copy guide | [Preview](signalbridge/Preview.html) / [Install guide](signalbridge/Install-Guide.html) |

**Release 2.2.0** contains the knowledge-sharing **Rules + Templates** implementation. Gemini, Ollama, embeddings and semantic event deduplication remain documented design proposals; no LLM service or production Google deployment has been enabled.

Public seed uses fictional examples. Connect real account data and private knowledge sources in Google Sheets/Drive rather than committing them here. The source package passed 59 pure-engine and 30 simulated Google integration checks; live account checks are still required.

## Existing runtime

The earlier repository files at `apps-script/`, `scripts/`, `docs/` and `skills/` and their automation workflows are retained for compatibility. They are separate from the new `signalbridge/apps-script/` package. Install SignalBridge in its own bound Apps Script project; do not mix the two `Code.gs` files.

The displayed project name is now SignalBridge. The repository URL retains its previous slug until the repository itself is renamed in GitHub settings.
