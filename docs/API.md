# REST API reference

Base URL: `/api` (the web app proxies it; the API itself listens on port 4000).

**Auth.** Sign in with `POST /api/auth/login`. The response sets an `httpOnly` session cookie and also returns a `token` for API clients, which they send as `Authorization: Bearer <token>`. Every route except `/health` and `/auth/*` requires a signed-in user.

**Roles.** `viewer` can read; `analyst` can also write (taxonomy, reviews, rounds, briefs); `admin` can also manage users and run connectors. The *Min role* column below gives the lowest role that may call each route.

**Errors.** Errors return `{ "error": { "code", "message", "details?" } }` with a matching status:

| Status | Code |
|---|---|
| 400 | `bad_request`, `blocked_url` |
| 401 | `unauthorized` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 | `conflict` |
| 413 | `payload_too_large` |
| 415 | `unsupported_media_type` |
| 429 | `rate_limited` |
| 500 | `internal` |

For validation errors, `details` lists `{ path, message }` for each failing field.

**Limits.** 300 requests per minute per user (or per IP when signed out); 20 failed logins per 15 minutes per IP; 60 LLM-backed operations per hour per user. JSON bodies are capped at 100 kB.

## Auth

| Method | Path | Min role | Notes |
|---|---|---|---|
| POST | `/auth/login` | — | `{ email, password }` → `{ user, token }` + cookie |
| POST | `/auth/register` | — | `{ email, password, name }`; always creates a `viewer` (when `ALLOW_SIGNUP=true`) |
| POST | `/auth/logout` | — | Clears the cookie |
| GET | `/auth/me` | viewer | Current user |

## Companies

| Method | Path | Min role | Notes |
|---|---|---|---|
| GET | `/companies` | viewer | Query: `q`, `sector`, `subsector` (comma list), `status`, `state` (`unclassified`, `auto`, `pending_review`, `reviewed`), `country`, `batchYearFrom`, `batchYearTo`, `minRaised`, `hasFunding`, `notable`, `sort` (`relevance`, `name`, `raised`, `recent_round`, `team`, `newest`), `page`, `pageSize` (≤100) → `{ items, total, page, pageSize }` |
| GET | `/companies/export.csv` | viewer | Same filters; streamed CSV |
| GET | `/companies/:slug` | viewer | `{ company, rounds, sources, classificationHistory, watchlists }` |
| PATCH | `/companies/:slug` | analyst | `{ notable?, oneLiner? }` |
| POST | `/companies/:slug/classify` | analyst | `{ provider?, async? }`: re-runs the classifier (LLM rate-limited) |

## Funding

| Method | Path | Min role | Notes |
|---|---|---|---|
| GET | `/funding` | viewer | Query: `sector`, `roundType`, `from`, `to`, `includeAccelerator`, `limit` (≤200), `page` → `{ items, total }` |
| GET | `/funding/recent` | viewer | Latest 15 non-accelerator rounds |
| GET | `/funding/export.csv` | viewer | Rounds with source URLs |
| POST | `/funding` | analyst | `{ companySlug, date, roundType, amountUsd \| null, investors[], sourceUrl, sourceTitle, sourceExcerpt }`. The source is required; a duplicate (company + date + type) returns 409; triggers `funding.created` (alerts) |

## Sectors and taxonomy

| Method | Path | Min role | Notes |
|---|---|---|---|
| GET | `/sectors` | viewer | Taxonomy tree with company counts |
| GET | `/sectors/:slug/landscape` | viewer | KPIs, market map, cohorts, funding by year and subsector, notable companies, latest rounds (cached) |
| POST | `/sectors` | analyst | `{ name, slug?, parentSlug?, description?, keywords?, tracked?, sourceTags? }` |
| PATCH | `/sectors/:slug` | analyst | Any of `name`, `description`, `keywords`, `tracked`, `sourceTags`, `order` |
| DELETE | `/sectors/:slug` | admin | 409 if the node has children or companies are classified into it |

## Review queue

| Method | Path | Min role | Notes |
|---|---|---|---|
| GET | `/review` | viewer | Query: `sector`, `limit`, `cursor`; lowest confidence first → `{ items, total }` |
| POST | `/review/:id/decision` | analyst | `{ action: "accept" \| "override", subsectorSlug?, note? }`; the decision is final (409 if already decided) |

## Watchlists and alerts

| Method | Path | Min role | Notes |
|---|---|---|---|
| GET | `/watchlists` | viewer | The caller's lists only |
| POST | `/watchlists` | viewer | `{ name, sectorSlugs[], companySlugs[], minAmountUsd?, webhookUrl? }`; the webhook must be `https` and resolve to a public address |
| PATCH | `/watchlists/:id` | viewer (owner) | Same fields; another user's list returns 404 |
| POST | `/watchlists/:id/companies` | viewer (owner) | `{ companySlug }` |
| DELETE | `/watchlists/:id/companies/:slug` | viewer (owner) | |
| DELETE | `/watchlists/:id` | viewer (owner) | Also deletes its alerts |
| GET | `/alerts` | viewer | Query: `unread`, `limit` → `{ items, unread }` |
| GET | `/alerts/unread-count` | viewer | |
| POST | `/alerts/read` | viewer | `{ ids[] }` or `{ all: true }` |

## Briefs

| Method | Path | Min role | Notes |
|---|---|---|---|
| GET | `/briefs` | viewer | Query: `scopeType`, `slug` |
| GET | `/briefs/:id` | viewer | Sections, claims with `sourceIds`, populated sources, rejected claims |
| POST | `/briefs` | analyst | `{ scope: { type: "sector" \| "company", slug }, provider? }` → 202; generated by a background job (LLM rate-limited) |

## Operations

| Method | Path | Min role | Notes |
|---|---|---|---|
| GET | `/health` | — | `{ status, mongo, redis, eventBus }`; 503 if MongoDB is down |
| GET | `/meta` | viewer | LLM providers, event bus, review threshold, job counts |
| GET | `/dashboard` | viewer | Totals, per-sector rollup, quarterly funding |
| GET | `/ingest/runs` | viewer | Last 30 connector runs (`succeeded`, `partial`, `failed`, with the first error messages) |
| POST | `/ingest/runs` | admin | `{ connector: "yc" \| "sec_form_d" \| "rss" \| "github", params }` → 202 |
| GET | `/users` | admin | |
| PATCH | `/users/:id` | admin | `{ role }`; you cannot change your own role |

## Example

```bash
TOKEN=$(curl -s localhost:4000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"analyst@strata.local","password":"strata-demo-2026"}' | jq -r .token)
curl -s "localhost:4000/api/companies?sector=legal-ai&hasFunding=true&sort=raised" -H "Authorization: Bearer $TOKEN" | jq '.items[].name'
```
