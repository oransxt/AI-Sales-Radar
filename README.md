# AI Sales Radar

Thailand-first AI sales opportunity radar for OOH/DOOH.

Current implementation checkpoint: **Version 1.9.2 — GitHub Online Edition**.

## V1 flow

1. Daily Thailand-first brand discovery
2. Rank top 20 by commercial opportunity
3. Manual Salesforce ownership check
4. Internal credential library (Google Drive links)
5. Multiple credential selection per brand
6. Daily automation via GitHub Actions
7. Static online dashboard via GitHub Pages

## Internal credential types

- Industry Overview
- Case Study
- New Launches
- Media Credentials

## Security

Never commit `OPENAI_API_KEY` to this repository. Store it as a GitHub Actions repository secret named `OPENAI_API_KEY`.

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
