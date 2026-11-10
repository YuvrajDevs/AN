# Legal AI: sector landscape (November 2026)

*Generated with Strata from public data and checked by hand. Data snapshot: 9 November 2026.*
*Underlying exports: [companies](data/legal-ai-companies.csv) · [funding rounds](data/legal-ai-funding.csv). Every funding figure below links back to an SEC filing in the export.*

## Summary

- **Formation has roughly doubled as a share of startups.** Legal AI was 1.1–1.4% of each year's Y Combinator companies in 2020–2022 and 2.0–2.9% from 2023 to 2026. Of the 102 legal companies YC has ever funded, 49 (48%) joined in 2024 or later.
- **The new wave targets disputes and outcomes, not documents.** Contracts & CLM, the largest subsector built mostly before 2023, added only 3 companies since 2024 and has the most exits (4 of 15 acquired). Since 2024, new companies have clustered in litigation, plaintiff/personal-injury work and regulatory compliance (7 each).
- **Capital is concentrated in one horizontal platform.** Of $1.05B sold in Regulation D offerings across the cohort, Legora accounts for $892.5M (85%) across four filings in 18 months. Its latest Form D shows a $550M offering still open.
- **More companies sell legal outcomes instead of software seats.** Six of the nine AI-native law firms, and seven of the eight plaintiff-side tools, joined YC in 2024 or later.

## 1. Scope and method

**Universe.** All 102 companies in the public Y Combinator directory tagged *LegalTech* or listed under the *Legal* sub-industry. The YC directory is a consistent, public, dated census of one large early-stage investor's portfolio. It is not the whole market: well-known legal AI companies that did not go through YC are outside this sample.

**Pipeline.** Strata's YC connector pulled the directory and its SEC connector searched EDGAR for Form D (Regulation D) filings by each company. Raw records went through the same ingest pipeline the product runs in production (event bus → processor → MongoDB), and the figures here come from the platform's aggregation pipelines and CSV exports.

**Funding data.** A Form D reports the size of an exempt offering and the amount sold so far, with the date of first sale. It is primary-source and free, but it does not name the round or the investors, and many companies never file one. Linking filings to companies is error-prone because legal names collide: EDGAR returned 234 candidate filings across the three sectors Strata tracks, and 98 were rejected. Examples from this sector: *Flo Health, Inc.* and *Flo Technologies, Inc.* matched Flo (YC S19, a legal-talent platform); *Praxis Labs* matched Praxis (YC F26); *BLEE LLC* matched Blee. **12 of the 102 companies** have linked Form D filings with disclosed amounts. Funding totals below are therefore a floor, not market size.

**Classification.** The taxonomy has ten subsectors (table below). Strata's offline classifier proposed a label for each company with a confidence score, and then an analyst reviewed **all 102**. The classifier was right on 75.5% of them; the analyst corrected the rest. Fifteen companies tagged "legal" in the directory were judged out of scope (for example litigation finance, a tax firm, law-enforcement software, generic voice agents), leaving **87 classified companies**. One tie-break rule matters: a licensed AI-native law firm is classified as a *law firm* whatever its practice area, so an AI-native immigration firm counts as a law firm, not as immigration software.

## 2. Taxonomy and market map

| Subsector | Definition (abridged) | Companies | Active | Form D sold |
|---|---|---:|---:|---:|
| Contracts & CLM | Drafting, review, negotiation, signing and lifecycle management of contracts; transactional diligence | 15 | 10 | $24.8M |
| Litigation & Research | Legal research, discovery and document review, case strategy, class-action origination | 11 | 8 | $54.7M |
| Regulatory & Compliance | Regulatory intelligence, compliance reviews, government requests, public policy, trade compliance | 11 | 10 | $39.2M |
| AI-native Law Firms | Licensed firms delivering legal work themselves, with technology as leverage | 9 | 8 | — |
| Consumer & SMB Legal | Wills, divorce, debt, tickets, entity formation | 9 | 6 | $5.5M |
| Plaintiff & PI | Intake, medical-record retrieval, demand letters and case building for plaintiff firms | 8 | 7 | $11.2M |
| AI Legal Workspaces | Horizontal assistants, agents and "operating systems" spanning practice areas | 8 | 8 | $892.5M |
| Legal Ops & Practice Mgmt | E-billing, spend, timekeeping, practice management, legal talent | 8 | 6 | $11.7M |
| IP & Patents | Patent drafting and prosecution, infringement detection, brand/IP enforcement | 5 | 5 | — |
| Immigration | Visa and citizenship applications, employer immigration compliance | 3 | 2 | $6.3M |
| *Out of scope* | Tagged legal but not Legal AI | *15* | | |

Across the cohort, 82 companies are active, 11 acquired and 9 inactive. The median YC-listed team size is 7, which reflects how young the cohort is.

### Classified companies (34 of 87)

Selected to cover every subsector. Team sizes and one-liners come from the YC directory; "Form D disclosed" is the sum of amounts sold across the company's linked filings.

| Subsector | Company | YC | Status | Team | Form D disclosed | What it does (YC directory) |
|---|---|---|---|---:|---:|---|
| Contracts & CLM | Dioptra | W22 | acquired | 4 | $0.5M | Automated contract review with AI |
| Contracts & CLM | Draftwise | S20 | active | 50 | — | Contract and negotiation AI built for lawyers |
| Contracts & CLM | Ironclad | S15 | active | 700 | $22.8M | AI-powered contract management |
| Contracts & CLM | Keynua | W19 | active | 15 | $1.6M | E-signatures with identity verification for Latin America |
| Contracts & CLM | Tower | W24 | active | 3 | — | M&A due diligence platform powered by AI |
| Litigation & Research | Casetext | S13 | acquired | 50 | $54.0M | We make the world's laws free and understandable. |
| Litigation & Research | Crimson | X25 | active | 7 | — | The AI Associate for Litigation Lawyers |
| Litigation & Research | Darrow | W21 | active | 95 | — | Bring Justice to Light |
| Litigation & Research | Kalinda | S25 | active | 2 | $0.7M | Deep research for class action law firms |
| Regulatory & Compliance | ComplyDo | F25 | active | 17 | — | Global Compliance for Enterprises |
| Regulatory & Compliance | Fed10 | W26 | active | 3 | — | AI Agents for Government Affairs |
| Regulatory & Compliance | Kodex | S21 | active | 30 | $31.5M | Easiest way for companies to process data requests from gove… |
| Regulatory & Compliance | Regology | S18 | acquired | 60 | $7.7M | AI Agents for Regulatory Compliance |
| Regulatory & Compliance | Tarifflo Inc. | S26 | active | 5 | — | Supply chain compliance and cost savings |
| AI-native Law Firms | Blueshoe | X25 | active | 2 | — | The AI-Native Consumer + Plaintiff Law Firm |
| AI-native Law Firms | General Legal | W26 | active | 40 | — | Elite AI law firm for high growth companies |
| AI-native Law Firms | Moritz | W26 | active | 10 | — | Global AI-native law firm handling legal work with same-day… |
| Consumer & SMB | Upsolve | W19 | active | 12 | — | Helping low-income Americans overcome debt and rebuild credi… |
| Consumer & SMB | Wevorce | W13 | active | 11 | $5.5M | Changing divorce for good by making it a way less horrible e… |
| Plaintiff & PI | Andco | X26 | active | 3 | — | Agents that build personal injury cases |
| Plaintiff & PI | Codes Health | S24 | active | 45 | — | AI-native medical record retrieval |
| Plaintiff & PI | Hona | W23 | active | 32 | $11.2M | Personal Injury Legal Work - Automated |
| Plaintiff & PI | Mimos | S25 | active | 2 | — | The growth OS for plaintiff-side law firms |
| AI Legal Workspaces | Legora | W24 | active | 900 | $892.5M | The agentic operating system for legal work |
| AI Legal Workspaces | Lexi | F25 | active | 15 | — | AI Operating System for Legal Teams |
| AI Legal Workspaces | Neomatter | F26 | active | 2 | — | AI that works for in-house legal teams |
| AI Legal Workspaces | Parley | S24 | active | 3 | — | Legal Agent that delivers finished work |
| Legal Ops | PointOne | W24 | active | 35 | — | AI Time Platform for Law Firms |
| Legal Ops | SimpleLegal | S13 | acquired | 60 | $11.7M | Legal Operations for corporate legal teams. |
| IP & Patents | MarqVision | S21 | active | 200 | — | IP operating software for brands and content companies |
| IP & Patents | Patent Watch | F25 | active | 6 | — | AI for detecting patent infringements |
| IP & Patents | Solve Intelligence | S23 | active | 70 | — | AI patent drafting, prosecution, litigation and more for leg… |
| Immigration | Gale | W25 | active | 3 | — | Fast and Data-Driven Immigration Platform |
| Immigration | SimpleCitizen | S16 | acquired | 23 | $6.3M | From signup to citizenship, only SimpleCitizen guides applic… |

The full list of 102, with classifications and confidence, is in the [companies export](data/legal-ai-companies.csv).

## 3. Funding trends

**Formation.** Raw counts of YC legal companies per batch year rose from 3 (2020) to 8, 9, 10, 14, 18 and 17 (2021–2026). Raw counts overstate the trend, because YC moved from two batches a year to four (Spring and Fall batches appear from 2024–25), so the whole directory grew too. Normalised by all YC companies in the same year, Legal AI's share was:

| | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Legal AI companies | 6 | 3 | 8 | 9 | 10 | 14 | 18 | 17 |
| All YC companies | 368 | 438 | 725 | 631 | 494 | 590 | 620 | 835 |
| Share | 1.6% | 0.7% | 1.1% | 1.4% | 2.0% | 2.4% | 2.9% | 2.0% |

The 2026 share is provisional: the Fall 2026 batch is still being added to the directory.

**Disclosed capital (Form D).** Amounts sold by year of first sale:

| Year | Offerings | Sold |
|---|---:|---:|
| 2012–2019 | 11 | $68.6M |
| 2020–2022 | 6 | $51.7M |
| 2024 | 1 | $11.2M |
| 2025 | 3 | $251.4M |
| 2026 | 3 | $663.0M |

The pre-2023 filings show the earlier generation's financing: Casetext filed four offerings between 2015 and 2021 ($54.0M sold in total, including $25.0M with first sale in December 2021); Ironclad filed a $22.75M offering with first sale in September 2018; SimpleLegal and Wevorce raised single-digit to low-double-digit millions. From 2024, the totals come almost entirely from Legora. The other recent filers are Hona ($11.2M, April 2024), Kodex ($21.2M of a $22.0M offering, September 2025) and Kalinda ($0.7M, April 2026).

## 4. Insights

### 1. Legal became one of YC's growth categories after 2023, without a dominant incumbent in most niches
The share of YC companies in Legal AI roughly doubled, from 1.1–1.4% to 2.0–2.9%, and almost half of all YC legal companies ever funded joined in 2024–2026. Most of these companies are tiny (the median listed team is 7), and outside the workspace layer no company has more than $55M of disclosed Form D sales. For deal sourcing this is a long tail of early companies in narrow workflows. The useful screen is evidence of traction (team growth, a first Form D, customers named in public profiles) rather than a hunt for category leaders, which mostly do not exist yet below the platform layer.

### 2. The center of gravity moved from documents to disputes and compliance
Contracts was the first Legal AI category: 12 of its 15 companies joined YC before 2024, including Ironclad (S15), AXDRAFT, Draftwise and Dioptra, and it now has the most exits (4 acquisitions, more than any other subsector). Since 2024 only 3 new contracts companies have joined, against 7 each in litigation & research, plaintiff & PI, and regulatory & compliance. Read with the exits, contracts looks like a consolidating layer where point tools are being absorbed. New entrants are going after work where the "document" is evidence, such as medical records (Codes Health, Andco), class-action research (Kalinda), and depositions and trial prep (Draft The Record, Crimson), or where regulation keeps changing (Fed10 on legislation, Tarifflo on customs, ComplyDo on enterprise GRC).

### 3. Capital is concentrating in the horizontal layer, and Form D shows it before press coverage does
Legora's four Form D filings show amounts sold of $79.8M (first sale May 2025), $150.4M (October 2025), $441.5M of a $600.1M offering (March 2026) and $220.8M of a $550M offering (October 2026): **$892.5M, or 85% of all disclosed capital in the cohort**. Legora's own directory profile describes a $600M Series D at a $5.6B valuation, which matches the $600.1M offering size in the March 2026 filing, so the filing and the company's self-report agree. The October 2026 filing, which shows $550M offered and $220.8M sold, is the kind of signal Strata's alerts are built for: a regulatory filing that reveals the size of an open raise. The analyst read is that a horizontal "operating system for legal work" is attracting most of the growth capital. Point solutions will need either a defensible specialist workflow (patents, plaintiff work, compliance) or a distribution path into that platform.

### 4. Business models are moving from software seats to legal outcomes
Nine companies are AI-native law firms that deliver legal work themselves, and six of them joined YC in 2024 or later (General Legal, Moritz, Vector Legal, LegalOS, Blueshoe and Wingman Law). Seven of the eight plaintiff & PI companies, whose customers are paid on case outcomes, are equally recent. None of these firms has a linked Form D, so they are invisible to filing-based funding trackers, and they are classified as law firms rather than software. Two questions follow for an investor. How does an outcome-priced business scale its margins compared with SaaS? And which jurisdictions let non-lawyers own law firms? The second is outside this dataset but decides where the model can grow.

## 5. What to watch next

- **New Form D filings from the 2024–2026 cohort.** Most of these companies have no filing yet. A first Form D is usually the earliest public sign of a priced round, so Strata's "Legal AI — every new filing" watchlist is set up to alert on it.
- **Whether the open Legora offering closes near its $550M size,** which would be visible in a Form D/A amendment.
- **Consolidation in contracts.** With 4 of 15 contracts companies already acquired and few new entrants, further acquisitions of the remaining independents (for example Draftwise or Docsum) would confirm the pattern in insight 2.
- **Outcome-priced models raising institutional money.** If AI-native law firms start filing Form Ds, that would show investors pricing them like software companies rather than law firms.

## 6. Caveats

- **Sample:** YC companies only. The trends describe YC's selection as much as the market.
- **Survivorship:** the directory lists companies' current status; some early companies may have left it.
- **Funding coverage:** Form D covers 12 of 102 companies. Companies that raise abroad, through SAFEs that never trigger a filing, or under different legal names are undercounted. Amounts are "sold as of filing", not final round sizes, and the round name and investors are never disclosed.
- **Classification:** every label in this report was reviewed by an analyst, but subsector boundaries (for example litigation vs. plaintiff, workspaces vs. legal ops) involve judgment. The definitions used are in the Strata taxonomy and can be edited there.
