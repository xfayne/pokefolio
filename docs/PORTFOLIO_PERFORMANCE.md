# Portfolio performance — Issue #18

`frontend/src/domain/performance.ts` is a read-only, provider-neutral engine. It
accepts owner-scoped domain records, normalized exact-variant price series, dated
USD-base reference FX and the selected display currency. It has no DOM, provider,
Firestore write, Binder or Wishlist dependency.

## Metrics

| Metric | Definition |
| --- | --- |
| Collection value | Matching market observations for received, held physical copies |
| Known cost | Complete four-component acquisition bases of those holdings |
| Unrealized P/L | Market value minus basis on the SAME copies with both observations |
| ROI | Matched unrealized P/L divided by matched basis; absent for zero/missing basis |
| Realized P/L | Active sale net proceeds minus immutable per-line acquisition basis snapshots |
| Monthly purchase spend | Recorded purchase payable totals dated in that month; not inferred payment cash |
| Monthly copies acquired | Physical copies linked to purchases dated in that month, including pending copies |

Totals carry covered/total counts. An empty portfolio has zero value; an unpriced
nonempty portfolio has unavailable value. Incomplete costs, unallocated lots,
unknown grades and ambiguous variants stay outside matched ROI. Known childhood
market values may contribute to value without contributing to cost-basis ROI.
Pending/sold/returned/lost/gifted copies do not count as received holdings.
Cost estimates propagate; market values are estimates, not guaranteed sales prices.

Each physical ID counts separately. Sales use their original frozen `basisCosts`;
missing snapshots stay unavailable, rather than falling back to today's editable
costs. Reversed sales contribute zero and restore the same physical copy identity.
Acquisition/shipping allocation logic remains in the existing transaction planner.

## Currency policy

Native amounts stay unchanged. Cross-currency acquisition bases use a dated
reference rate on the known acquisition date. Sale net proceeds use the sale date.
Current market value uses current-date reference FX; historical market value uses
the valuation day's FX. Matching price appreciation uses the SAME current display
FX on both observations, so currency movement is not mislabeled price appreciation.
No current-rate fallback is used for historical costs. Missing dates/FX exclude
that comparison and retain coverage messages. Reference FX conversions are labeled
estimated; no actual bank execution rate is claimed.

Frankfurter, already used by display-currency settings, supplies anonymous daily
reference series for the last year plus one lookup for each distinct older cost
date if needed. Public results use React Query with 24-hour freshness and no
automatic retry. Latest prior observations up to seven days old may cover weekends
and holidays; future rates are never used. Minor units are rounded half-up once
per basis/amount, with signed values handled symmetrically. No rates are persisted
into user transactions and no paid service is added.

## Historical ownership

The existing private revision collection is read separately, paginated by recorded
time for the last year (250/page, max 5,000; truncation is explicit). Existing
portfolio writes invalidate its owner-scoped query prefix. It performs no writes
or rules changes. The engine validates snapshots and walks each copy's revision
chain backwards. This preserves receipt, sales/reversals and metadata changes.

This is **recorded-time history**. A purchase date is not proof of delivery.
Historical received ownership starts no earlier than the recorded copy creation
and delivery evidence. Pre-import holdings are not reconstructed by applying
today's possession/condition to earlier dates. Missing audits produce explicit
unknown-history gaps; receipt is never backdated to the purchase date. Within a
calendar day the final recorded state is used. Charts must label this history
boundary, include coverage and not plot unknown history as zero.

Daily values use observed prices for the exact date/printing/condition. Missing
days are gaps, never synthesized or silently forward-filled. Adjacent-day price
comparison includes only physical copies present on both days with unchanged
printing/condition and available prices. Newly received copies, removals and
condition edits do not inflate this price-change figure. It is an estimated
matched-holdings comparison, not formal TWR/MWR. Provider history is bounded to
its supplied one-year window; “All” cannot manufacture older market data.

## Validation and next integration

Synthetic tests cover duplicate copies, pending/disposed exclusions, unknown costs
and grades, incomplete lot allocation, partial sales/reversal, receipt audit gaps,
historical condition changes, exact-day missing quotes, dated FX, signed rounding,
new additions versus market change and owner/duplicate validation. Strict English
variant selection accepts the existing canonical language value `en` as well as
the provider label `English`; neither permits another language.

This increment supplies the engine and read-only history/FX adapters. Dashboard
layout and live price/record hooks follow under #12 using the approved mock.

## Dashboard integration

Dashboard consumes `useDashboard` and the same pure selector for all metrics.
Current holdings and recorded historical variants resolve distinct catalog products;
the Worker receives public product IDs only, after sign-in. One-year market batches
and dated reference FX reuse the public query cache across periods/navigation.
Private audits remain in the owner-scoped portfolio cache. Unknown editions,
languages, finishes and conditions never trigger speculative provider matching.

The approved mobile layout supplies the banner, value panel, three recent physical
copies, monthly summary and top received holdings. The metric picker switches value,
estimated matched-holdings price change and realized sale P/L; missing observations
break charts. Periods never extrapolate older history. Monthly selection changes
recorded purchases, not confirmed cash settlements. Exact-copy links preserve the
purchase's physical ID or open that copy in Collection. The opt-in
`#/dashboard?dashboard=sample` uses synthetic, memory-only data and makes no
portfolio or authenticated pricing requests. No user data is written by Dashboard.
