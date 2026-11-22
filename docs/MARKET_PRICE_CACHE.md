# Market pricing and history — Issue #18

The existing staging Worker exposes `POST /api/market/prices` for current public
prices and provider-supplied history. No finance engine, new screen, daily collector,
per-user valuation snapshots or permanent price archive is introduced.

## Request and contract

Send `{ "products": ["106521", "90137"], "period": "1y" }` with the existing
Firebase owner token and approved Origin. At most 20 positive TCGplayer product IDs
are accepted; periods are `7d`, `30d`, `90d`, `180d`, `1y`. The body is bounded to
2 KiB. Existing verified-project, signature, issuer, audience and verified-owner-email
checks protect the shared account quota. The current single-owner allowlist must
be deliberately revised before serving multiple users; the cache itself is public
market data and has no user identifiers.

Each result contains `productId`, `cache` (`fresh`, `stale`, `unavailable`), nullable
`data`, `error` and `retryAfter`. The versioned data envelope records provider,
source, product ID, currency, requested window and fetch time. Each exact variant
records language, printing, condition, USD integer minor units, provider observation
timestamp/status and dated history points. Expired current quotes are null; missing
history days remain missing. This is a provider observation, not an executable offer.

The JustTCG adapter fetches all variants for a product and leaves exact selection
to callers. Responses do not substitute condition/printing siblings. Ambiguous
products, variants and contradictory same-day prices are rejected. Provider bodies,
credentials and raw network errors are never returned. The provider host is fixed;
clients cannot supply outbound URLs. Buffering and provider timeout are bounded.

## Cache and coordination

KV keys separate schema/provider, currency, product and history window. Each product
envelope contains ALL printing/language/condition variants, so different conditions
share one upstream lookup without sharing their prices. Freshness is 24 hours;
KV retention is seven days solely to permit an explicitly stale fallback.

KV hits bypass coordination. Misses route to one SQLite-backed Durable Object for
the **provider quota account**, not one object for every user or every request.
It serializes cold fetches, rechecks cached products and fetches only remaining
misses in a batch. A durable mirror bridges KV's eventually consistent negative
lookups, retains data across eviction and is purged after seven days by a cleanup
alarm. The alarm never calls JustTCG. This short-lived mirror is not historical
collection storage. If a user returns after expiry, history is fetched again.

Quota reservations are durable BEFORE outbound requests, including failed ones.
Conservative local budgets are 9 calls per trailing minute, 90 per UTC day and
900 per trailing 31 days. The provider's monthly window depends on account creation;
the rolling window avoids assuming a calendar-month reset. Headroom covers the
owner's manual checks, but independent calls outside this Worker cannot be counted.
Provider 429 responses remain authoritative, and persisted cooldown honors numeric
Retry-After (bounded to one day). Failures get 120 seconds of cooldown; auth failures
get an hour. There are no automatic upstream retries. Partial batches can return
fresh and stale/unavailable results together. Cache/coordination failures fail closed.

Only staging uses this provider key/coordinator. Before another deployment starts
using the SAME provider key, route misses through the same account coordinator;
independent counters in staging/production would not enforce a shared quota.

## Frontend integration boundary

`services/market-history.ts` provides validated Worker calls and a React Query hook
for canonical 20-product batches. Public responses can be reused across accounts;
auth tokens and private records never enter public query keys/data. Successful
fresh results expire according to the server fetch time, rather than restarting
24 hours on every client read. Stale/unavailable results have a short cooldown.
There are no automatic frontend retries. The exact-variant selector refuses unknown
edition/language/finish, mismatched conditions and ambiguous matches.

`resolveMarketProduct` reuses existing catalog matching, known promo IDs and special
Machamp/Ancient Mew mappings. Existing screen pricing still uses its current
TCGTracking adapter. The new history hook is ready for the next #18 performance
engine/#12 integration; this increment does not silently replace existing prices.

## Configuration and release

Staging entrypoint: `ebay-worker/worker-entry.js`. Bind `MARKET_CACHE`,
`PRICE_COORDINATOR` (`PriceCoordinator`, SQLite migration `market-prices-v1`), and
secret `JUSTTCG_API_KEY`. The existing owner email binding is reused. Keep all
existing provider secrets, Firebase project and shipping configuration on upload.
The production Wrangler file stays unchanged and uses its existing entrypoint.

Do not commit the key or put it in frontend environment variables. Deploy after
required PR checks pass; deployment remains manual through authorized tooling,
not CI cloud mutations. No Firestore rules, portfolio records, legacy app or
production resources need changing. Rollback the staging entrypoint to `index.js`
while preserving the unused DO class export if required by Cloudflare migration
rules; retain its namespace until a deliberate cleanup migration. Disable/remove
the new route in a follow-up change rather than deleting existing provider bindings.

## Provider terms and limitations

Owner confirmed personal use only. JustTCG explicitly supports free personal,
non-commercial projects. Its detailed indefinite storage grant is worded for paid
tiers; this implementation retains a bounded response cache and does not promise
perpetual archive rights. Before changing retention or opening to other users,
recheck https://justtcg.com/terms and https://justtcg.com/docs/commercial-use.
This is an unresolved documentation distinction, not a claim of explicit approval
of all free-tier retention. No paid subscription was created.

Provider changes/expiry, sparse markets and missing days remain possible. One-year
availability was verified with a Free key for Fossil Gengar #5, Neo Discovery
Umbreon #13 and WoTC Promo Mew #9; this is a sample, not a complete-catalog guarantee.
POST batch lookups require `priceHistoryDuration` on EACH item; the query-string
parameter alone returned only seven days during evaluation.

## Validation

`node --test ebay-worker/*.test.mjs` covers provider normalization, cache hit/miss,
overlapping batches, restart with delayed KV, quota windows, cooldown, cleanup,
partial/stale responses and auth/origin gates. `node ebay-worker/market-prices.runtime.mjs`
uses workerd/SQLite/KV/RPC with synthetic provider and JWT fixtures to check concurrent
misses, authenticated cache reads, denied anonymous access and persistent restart.
Run `npm ci --prefix ebay-worker` first. The Worker CI runs this runtime check.
Frontend tests cover response identity/window validation, exact variant selection
and unavailable results; existing catalog tests verify the shared resolver refactor.
