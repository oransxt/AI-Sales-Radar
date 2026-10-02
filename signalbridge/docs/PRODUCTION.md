# Production installation and operations — SignalBridge 2.3.1

## Deployment inputs

| Input | Required value |
|---|---|
| Installing account | Company Google account permitted to use Sheets, Apps Script, Gmail, Drive and company Gemini |
| Operating Sheet | New bound Sheet for SignalBridge. The owner installs scripts in Extensions / Apps Script. |
| Brand Master | Replace demo rows or point Settings at the verified company Sheet. Stable unique ID, brand, customer_type are required. |
| Knowledge folder | Company Drive folder with approved readable files. The private deployment package includes the folder ID supplied by the user. |
| Sender | Actual sales_name and official signature_th / signature_en |
| Internal digest | Verified internal recipient addresses, same domain as installer, maximum 10 |

`All My Brands.xlsx` supplies brand names only. Do not treat list membership as proof of an existing client. The private import uses UNKNOWN until verified. The source import and live configuration stay out of the public repository.

## Installation

1. Create the operating Sheet and bound Apps Script project. Copy Code.gs, Core.gs, Seed.gs, Review.html and appsscript.json from Install-Guide.html. Enable the Advanced Drive service v3. No paid AI service or model installation is needed.
2. Run setup using the installing company account, authorize Google services and reload the Sheet. Use a separate project from the old workflow. Keep old schedules inactive when switching to avoid two collectors delivering the same news.
3. Replace Brands demo rows with the private import or use brand_sheet_id / brand_sheet_tab. Verify EXISTING / PROSPECT / NEW for brands that will receive customer drafts. Leave uncertain status UNKNOWN.
4. Set the knowledge root, real sender, signatures and internal digest recipients. Keep news_enabled and digest_enabled FALSE during source and draft validation. Edit only actual values, not table headers.
5. Run runAutomation to index the folder. Multiple runs may be needed for pagination and OCR. Review Documents summaries, labels and READY/ERROR status against source files. For unreadable files use a verified Docs/Slides/text companion in the knowledge folder. The app does not change source sharing permissions.
6. Add one real dated signal in InputsV2, process it, then inspect Review. Check brand classification, selected 1–3 knowledge documents, source date and formal template quality. Test both new and existing clients.
7. Save selected context. On the Company Gemini tab prepare/copy prompt, open the company account in the browser, read or supply permitted source evidence and paste the resulting JSON. Verify TH/EN and reject unsupported details. Save edits before approval.
8. Verify the intended recipient and document access, choose a language, confirm and create Gmail Draft. Inspect the draft in Gmail. Customer Send is manual. Draft creation itself sends no customer message.
9. Enable news_enabled and configure approved RSS feeds / watchlist. Choose news_max_age_days (default 14). Every brand is scanned in rotating queries, not all at once. Do not place fake signals in the live Sheet to fill a digest.
10. Set digest_enabled TRUE and digest_to. Use the menu to inspect production readiness, then activateProduction to install the weekday polling schedule. If readiness fails, fix each listed blocker. The schedule can activate outside hours but sends only in the permitted window.

## Live acceptance checks

### Existing installation and seller-confirmed master

When the seller confirms that every listed brand is an existing account in their own book, set those rows to `EXISTING`. This represents the account relationship, not proof that every brand has purchased. An explicitly identified brand outside the master is a New Opportunity and starts without an inherited recipient. Verified brand identity takes precedence over another company mentioned as a partner in the same headline. Unidentified or ambiguous brands are held for review; a general RSS feed does not automatically discover every new company. Use `InputsV2.brand` or an approved `Feeds.brand_hint` for outside-master brands.

For a configured Sheet, replace `Code.gs`, `Core.gs` and `Review.html` from the current installation guide. Existing Settings, delivery history and master IDs remain in place. Confirm Advanced Drive v3 is enabled, save, authorize with the installing company account, then run `showProductionStatus` and `runAutomation`. Inspect the review and first real digest before ongoing use. Run `activateProduction` to create the polling trigger. The connected Drive tools can update spreadsheet contents but cannot execute or update the bound Apps Script project in this workflow.

### Reviewed knowledge summaries

An operator may prepare `Documents` rows from a source they have actually read: exact file ID, source URL, `modified_at`, folder path, kind, TH/EN summaries, semantic labels, topic, tags and observed permissions. Use `READY` only after checking those fields against the file. This can seed image-only, large or poorly extracted documents without changing the source PDF or its sharing. The folder scan retains a reviewed summary while the source timestamp, folder and kind match; a change invalidates that review. Large or unreadable changed files require a renewed human read and summary.

Use `HELD` with a reason for a source that contains internal-only pages or is unsuitable for customer sharing. An unchanged held source remains excluded during refresh. Text marked for internal use cannot pass automatic description. An externally suitable edition or reviewed derivative is required before making it eligible.

| Check | Expected outcome |
|---|---|
| UNKNOWN brand | Appears as needing classification and cannot create customer draft |
| Existing / prospect | Upsales / New Opportunity matches verified Master |
| Knowledge relevance and 4th document | Only related documents, maximum 3; no forced third |
| Modified / unreadable document | Blocks or waits for corrected content before customer draft |
| Restricted Drive link | Recipient access explicitly checked, no public sharing changes |
| Gemini account | Company account and permitted source handling confirmed |
| JSON for another Signal/version or malformed/URL-containing body | Import rejected |
| TH/EN switching | Independent edits retained and chosen language appears in Gmail Draft |
| Customer draft | Formal text, semantic Drive labels, source reference, no attachment, no automated customer send |
| 19 eligible unsent signals | Queue waits without sending |
| 20 eligible unsent signals | One internal digest in work window, history becomes SENT |
| Already delivered IDs/headlines/source URL | No duplicate inclusion in later batches |
| Differently phrased news about the same event | Seller checks manually; no semantic AI guarantee |
| Night/weekend, insufficient mail quota | Digest waits |
| Uncertain network outcome | Hold and reconcile Sent/Draft before retry |

Use a separate test Sheet for synthetic cases and boundary-time simulations. Production acceptance uses authentic signals only. An internal first digest can only be verified once 20 real eligible signals exist during the work window. Trigger timing is approximate and cannot guarantee exactly 08:30.

## Operations and ownership

The installing owner monitors Apps Script Executions, AuditV2, InputsV2 ERROR, Documents ERROR, Deliveries UNCERTAIN, Mail quota and last-run timestamp. No automatic external alert is configured in this release. Review errors daily and inspect the first live digest and customer draft directly in Gmail.

Record actual elapsed human minutes and clicks for the same 20-signal / five-email workload. Planning baseline is 280 minutes / 320 clicks. Target with manual company Gemini is 90 minutes / 120 clicks: 25 minutes / 35 clicks for signal review, 45 minutes / 55 clicks for knowledge and AI drafting, 20 minutes / 30 clicks for final editing and Gmail Drafts. These are targets, not measured results. Knowledge relevance target is 90% of reviewed recommended documents, with follow-up within one business day.

This release has one owner-only review account. Team digest recipients can receive email but cannot administer or approve through this owner-only interface. Multi-user review requires an explicit access model and additional implementation.

## Migration and rollback

Back up the old Sheet and source. Install 2.3.1 into a separate Sheet. Stop old SignalBridge/legacy digest schedules before activating the new schedule. Carry over verified Brands, Documents, InputsV2, Signals and Deliveries only with matching table headers and source versions, then validate the working copy. Preserve delivery history to prevent resending previously reported news. If no history is migrated, set the freshness range and review initial queues manually; the application cannot infer past deliveries in another system.

For rollback, run stopSchedule, set digest_enabled FALSE and keep Signals/Deliveries/AuditV2. Restore the previous source and Sheet backup in the original project only if needed. Do not run setup during an active sending window: setup stops the project's schedule. Never delete delivery history to clear a queue. Customer drafts already created remain in Gmail for manual review.

## References

- Google Apps Script installable triggers: https://developers.google.com/apps-script/guides/triggers/installable
- Google service quotas: https://developers.google.com/apps-script/guides/services/quotas
