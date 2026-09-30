# Workflow and node responsibilities

| Node | Current code | Proposed AI extension | Tools / apps |
|---|---|---|---|
| 1. Index Knowledge | Read supported files, hold unreadable content, derive summaries/tags from rules | Evidence-backed chunks, bilingual summaries and embeddings | Drive, Apps Script; proposed Gemini/Ollama |
| 2. Collect Signals | RSS headline, publisher, URL and date | Read permitted original article content; distinguish publication and event dates | RSS, source sites, Apps Script |
| 3. Identify Brand | Exact brand/alias and verified feed hints | Evidence-assisted entity resolution; ambiguous results held | Sheets Brand Master |
| 4. Classify Customer | Explicit EXISTING / PROSPECT / UNKNOWN | Still database-controlled; LLM cannot invent purchase history | Sheets + rules |
| 5. Understand Signal | Launch / expansion / campaign / event / funding rules | Facts, inferred objectives, evidence and uncertainties | Proposed Gemini/Ollama |
| 6. Match Knowledge | Tags, industry and topic filters; max three distinct documents | Hybrid retrieval then evidence-based reranking | Documents index; proposed embeddings + AI |
| 7. Draft TH/EN | Official contextual templates, separately editable | Grounded business-specific bilingual writing | Core engine; proposed AI |
| 8. Validate | Sources, date, recipient, final gate, doc version/access and max-three cap | Additional claim and bilingual-consistency review | Apps Script + proposed AI |
| 9. Notify | Full batches of 20 unsent signals during Bangkok work window | Same sending policy; quota-limited work resumes from checkpoints | Sheets + Gmail |
| 10. Final Review | Sheet modal edits then Gmail Draft; manual customer send | Same human decision | Review UI + Gmail |
| 11. Feedback | Edits stored per signal | Curated approved examples for subsequent prompts | Sheets |

## Proposed event duplicate policy — not yet implemented

Brand recurrence and event duplication are different. One brand may have a genuinely new event after a prior event was delivered. Different publishers reporting the same launch should share one canonical event and multiple source references.

Canonical records should retain brand_id, event_type, product/project, location, event_date, first_seen_at, updated_at, source references and delivery state. Similarity is a candidate-finding aid; date/entity/material-difference checks and evidence decide merges. Ambiguous comparisons are held for human review.

| Case | Target behavior |
|---|---|
| Same signal already delivered | Exclude across all future batches |
| Same event, different URL or headline | Merge sources, do not create another deliverable signal |
| Republished old announcement | Exclude unless evidence demonstrates a material new event |
| Same brand, different product launch or branch opening | New event eligible |
| Same brand, material update to an old event | Explicitly label update and show what changed; hold ambiguous cases |
| Several new events for one brand in the same batch | Proposed maximum one signal per canonical brand per batch; other fresh events wait |

The current runtime implements only normalized brand/headline IDs plus delivered-signal history. It does **not** implement event-level semantic comparison or the proposed per-brand batch limit.

## Freshness and queue rules

- A newly discovered article is not necessarily newly published. Current maximum age defaults to 14 days and is configurable.
- Twenty means twenty eligible, unsent signals, not necessarily twenty completed customer drafts. Missing knowledge can appear as a gap in the internal digest but blocks a customer knowledge-sharing draft.
- Fewer than twenty remain queued; stale or rejected entries never fill the batch.
- Work-window gate: weekdays 08:30 inclusive to 18:00 exclusive in Asia/Bangkok; timing is approximate.
- Customer sending is manual. An internal digest never authorizes automatic customer outreach.
