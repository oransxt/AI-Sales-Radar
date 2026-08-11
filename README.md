# AI Sales Radar

Thailand-first sales opportunity radar for OOH/DOOH.

Current implementation checkpoint: **Version 1.9.3.2 — 100% Free Online Edition**.

## V1 flow

1. Daily Thailand-first brand discovery from public online sources
2. Rank top 20 by commercial opportunity
3. Manual Salesforce ownership check
4. Internal credential library using Google Drive links
5. Multiple credential selection per brand
6. Daily automation via GitHub Actions
7. Static online dashboard via GitHub Pages

## Free runtime architecture

- GitHub repository: free
- GitHub Pages: free
- GitHub Actions: free for this public repository within GitHub's included limits
- Discovery: public Google News RSS searches focused on Thailand
- Scoring: local JavaScript commercial scoring rules
- History / duplicate detection: repository JSON data
- Credential recommendation: industry + tag matching in the browser
- Salesforce ownership check: manual human-in-the-loop

There is **no paid OpenAI API dependency in Version 1 runtime**.

## Internal credential types

- Industry Overview
- Case Study
- New Launches
- Media Credentials

## Version history

- 1.0 Daily Brand Discovery
- 1.1 Salesforce Check
- 1.2 Internal Knowledge Links
- 1.3 Multiple Credential Types
- 1.4 Credential Recommendation
- 1.5 Thailand Brand Discovery Engine
- 1.6 Ranking & Scoring
- 1.7 Duplicate / History Logic
- 1.8 Daily Review Experience
- 1.9 Final Data Structure
- 1.9.1 First local working implementation
- 1.9.2 GitHub Online Edition
- 1.9.3 Replace paid API runtime with free public-source discovery
- 1.9.3.1 Improve recency and brand extraction
- 1.9.3.2 Refine narrative headline brand detection
