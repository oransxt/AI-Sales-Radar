# Workflow — Company Gemini through the browser

| Step | Software | Processing and result |
|---|---|---|
| 1 | Google Sheets | Brand Master with stable IDs and verified EXISTING / PROSPECT / NEW status. UNKNOWN waits before customer draft. |
| 2 | Google Drive + Apps Script | Index the Research / Case Study / Industry Overview folders. Retain content summaries, semantic link labels, tags, version and access metadata. Unreadable files wait for correction. |
| 3 | RSS + Apps Script | Discover headlines with business signals. Store source link, publisher and publication date. Default maximum news age: 14 days. |
| 4 | Apps Script + Sheets | Suppress prior IDs, normalized headlines and equivalent source URLs. Classify New Opportunity / Upsales and propose an objective from rules. |
| 5 | Apps Script | Rank relevant readable knowledge and prepare official TH/EN templates, maximum three distinct topics. |
| 6 | Gmail + Apps Script | Deliver an internal digest once 20 eligible unsent signals exist. Repeat in the weekday 08:30–17:59 Bangkok window. A shorter queue waits. |
| 7 | Sheet Review | Salesperson verifies the original article, brand status and relevant knowledge, then saves the selected context. |
| 8 | Company Gemini in browser | Salesperson copies the prepared prompt, reads/supplies permitted evidence and requests official TH/EN drafts. No automated AI connection. |
| 9 | Sheet Review | Paste matching JSON. The system imports TH/EN text only, clears approval and requires verification. Alternatively use and edit the template. |
| 10 | Sheet Review + Gmail | Confirm knowledge/access and recipient, select TH or EN, save, create Gmail Draft, then send manually. |

## Facts and assumptions

Rules infer a possible objective from a headline. This does not establish the client's confirmed brief or budget. Company Gemini must not invent statistics, a past client relationship, inaccessible document content or unsupported solution claims.

## Timing and duplicate policy

The queue is new-to-system and unsent, not necessarily news published today. Exact 08:30 dispatch cannot be guaranteed with Apps Script triggers. Dispatch never intentionally occurs outside the configured window. Quotas can pause delivery. No fake or stale signals fill a partial batch.

Brand recurrence is allowed for distinct events. Deterministic keys suppress exact headline/source duplicates, including IDs that differ between manual imports. Different reporting of one event may still need human judgement. This implementation does not claim semantic deduplication or automatic reading of original article bodies.
