---
name: ai-sales-radar
description: Thailand-first sales opportunity radar for OOH/DOOH teams. Finds and ranks 20 brands with fresh commercial buying signals, routes them through a human Salesforce ownership check, and recommends multiple relevant sales credentials from a configurable knowledge library.
version: 1.9.3.4
---

# AI Sales Radar Skill

## Purpose

Help a salesperson spend less time searching and more time selling by turning public market signals into a prioritized daily list of commercial opportunities.

The skill is designed for OOH/DOOH sales teams in Thailand, but the framework can be adapted to other markets by changing the discovery sources, scoring rules, and credential library.

## Core workflow

1. Discover candidate brands from the external world.
2. Filter for Thailand relevance.
3. Detect commercial buying signals.
4. Score and rank candidates by sales potential.
5. Return the top 20 opportunities for the day.
6. Require a human Salesforce ownership check.
7. Continue only with brands marked Available.
8. Match the brand to multiple relevant internal credentials.
9. Prepare the brand for the next opportunity-analysis flow.

## External-world signals

Prioritize fresh, commercially meaningful signals such as:

- New product or service launch
- New brand entering Thailand
- New store, branch, showroom, hospital, property project, or venue
- Expansion in Thailand
- Major marketing campaign
- New presenter, ambassador, celebrity, creator, or partnership
- Event or sponsorship activity
- Funding, investment, IPO, M&A, or major corporate growth
- Rebranding or repositioning
- Large promotion or seasonal campaign
- Hiring for marketing, brand, trade marketing, media, or growth roles
- Rapid social or e-commerce momentum
- Emerging Thai/local brands with strong TikTok, Instagram, creator, marketplace, or physical expansion signals

Do not focus only on famous brands. Include promising local, social-first, online-first, SME, and foreign brands entering Thailand when the evidence suggests potential media spend.

## Thailand-first rule

A candidate must have credible Thailand relevance. Examples include:

- Thai operation or local entity
- Thai distributor/importer
- Official Thailand social or e-commerce presence
- Product/service sold in Thailand
- Thailand-specific launch or campaign
- Thai creators or consumers showing meaningful momentum
- New branch/store/project in Thailand
- Clear intent to enter or expand in Thailand

Global popularity alone is not enough.

## Daily diversity target

Aim for a balanced top 20 rather than allowing one category to dominate. As a guide:

- Established brands with fresh buying signals
- Growing Thai/local brands
- TikTok/Instagram/social-first emerging brands
- Foreign brands entering Thailand
- High-potential wildcard opportunities

Do not enforce quotas when better revenue opportunities exist, but maintain reasonable industry diversity.

## Opportunity score

Score each candidate out of 100:

- Thailand Relevance: 20
- Buying Signal Strength: 20
- Revenue Potential: 20
- OOH Fit: 15
- Momentum / Growth: 10
- Timing / Urgency: 10
- Evidence Quality: 5

Priority bands:

- 85–100: Hot
- 70–84: High
- 55–69: Medium
- Below 55: Watchlist

Rank primarily by expected commercial value, not popularity.

## Evidence rule

Do not add a brand to the daily top 20 without evidence.

For each lead, retain at least one source URL and preferably multiple independent signals when available. Distinguish an official source from press, social, marketplace, or secondary coverage.

Avoid presenting inferred budget or revenue potential as reported fact. Label it as an estimate.

## History and duplicate logic

Maintain brand history whenever storage is available.

Rules:

- Do not repeat a brand every day when there is no materially new signal.
- A brand may return when a substantially stronger or newer signal appears.
- A previous Has Owner result should enter cooldown unless a major new signal appears.
- Skip should reduce priority temporarily, not permanently blacklist the brand.
- Available brands leave discovery and move into the opportunity pipeline.
- Existing Client should be retained for future reactivation/upsell logic rather than treated as a new-account lead.

Useful states:

- Not Checked
- Available
- Has Owner
- Existing Client
- Skip

## Daily output

For each of the 20 brands show:

- Rank
- Brand
- Company
- Industry
- Brand Type: Established / Emerging Thai / Social-first / New to Thailand / Local SME
- Buying Signal
- Signal Date
- Why Now
- Thailand Evidence
- Momentum
- Opportunity Score
- Priority
- Estimated Revenue Potential
- Source URL(s)
- Salesforce Status

The salesperson should be able to review and set Salesforce status with minimal clicks.

## Human-in-the-loop Salesforce gate

The skill must not assume account ownership.

The salesperson checks Salesforce and sets one of:

- Available
- Has Owner
- Existing Client
- Skip

Only Available brands continue to deeper new-business analysis.

This manual gate is intentional sales governance, not a missing feature.

## Internal Knowledge Library

Support a configurable library of links or files grouped into four credential types:

1. Industry Overview
2. Case Study
3. New Launches
4. Media Credentials

Each credential should contain or be tagged with:

- Credential name
- Credential type
- Industry
- Tags
- URL or file reference
- Active / inactive status

The library may point to Google Drive, SharePoint, internal storage, or another approved repository.

## Multiple credential matching

One brand may require multiple credentials across multiple categories.

Match using:

- Brand industry
- Buying signal
- Likely campaign objective
- Audience
- Market / geography
- Relevant media category
- Credential tags

Return an AI/rule-recommended credential pack, but allow the salesperson to add or remove items before sending.

Example structure:

Industry Overview
- Automotive Overview

Case Study
- EV Launch Case Study
- Premium DOOH Case Study

New Launches
- New premium network launch

Media Credentials
- Signature DOOH
- Plan B TV
- Airport Media

## Commercial principles

Optimize for revenue and salesperson time.

When ranking or recommending, consider:

- Budget potential
- Campaign objective
- Suitable media assets
- Closing probability
- Expected revenue
- Upsell potential
- Urgency
- Existing commercial momentum

Do not recommend a small tactical lead over a materially larger and more actionable opportunity only because the smaller brand is more socially popular.

## Zero-cost mode

The skill can operate without a paid LLM API.

In zero-cost mode:

- Use public RSS/search/trend sources allowed by the implementation.
- Use deterministic keyword and rule-based signal classification.
- Use rule-based opportunity scoring.
- Use tag/industry matching for credentials.
- Use GitHub Actions or another free scheduler where practical.

Keep the data schema compatible with a future LLM layer so paid AI can be added later without changing the user workflow.

## Safety and data governance

- Never expose API keys, credentials, or private tokens in browser code or repositories.
- Do not upload confidential client materials to public storage.
- Respect internal account-ownership governance.
- Keep reported facts separate from inferred opportunity estimates.
- Preserve source URLs for validation.

## Next-stage handoff

After the salesperson marks a brand Available and approves relevant credentials, hand the brand to the opportunity-analysis flow with:

- Brand and company
- Industry
- Buying signal
- Source evidence
- Opportunity score
- Estimated revenue range
- Selected credential pack
- Salesforce status = Available

The next stage may then generate campaign objective, recommended media package, pricing strategy, sales angle, email draft, and next best action.
