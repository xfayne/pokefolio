# Collection Overview

The owner approved this scope on 2026-11-28 and explicitly fixed the Wishlist
estimate to LP with no extra condition control. Set-completion goals, duplicate
management and condition/finish charts were rejected.

## Counts and navigation

- In Collection counts current held physical copies with received possession.
- On the Way counts pending held copies. Unknown receipt is reported separately.
- Removed-import/purchase and disposed copies are excluded.
- Wishlist counts distinct wishes not already received/pending, preserving priority.
- Tiles open the existing received/pending Cards or remaining-only Wishlist views.
  This never deletes wishes or changes their manual ordering. Reordering is
  unavailable in the projected subset; clear the filter to reorder the full list.

## Estimates and comparisons

The LP budget uses one English default-printing LP quote per remaining catalog
card (same edition/finish mapping as Wishlist). Shipping, taxes and fees are
excluded. Missing or conflicting latest quotes and unavailable FX remain
unpriced. The known subtotal always shows covered/total; no partial subtotal is
presented as a complete budget. Empty Wishlist is zero; wholly unpriced is unavailable.

Received-copy market prices must match catalog card, edition, language, finish
and condition. The English-only provider cannot value foreign/unknown languages.
Cost comparisons require card, shipping, tax and fee cost evidence; dated
reference FX is reused from the finance domain. Unknown cost dates cannot be
replaced by creation/import dates. Returns with zero cost have no invented ROI.
Gains include FX effects when display and purchase currencies differ.

Value concentration aggregates priced physical copies by catalog card and shows
the top five cards as a share of priced received value, with coverage. It excludes
pending copies. The screen does not request the historical market API or AI.

## Personal highlights

`users/{uid}/preferences/collection` contains at most five distinct catalog card
IDs plus a server timestamp. Strict owner-only rules deny foreign/anonymous access,
unknown fields, duplicate/invalid IDs, oversized lists and deletion. Selecting
highlights never moves cards in the Binder or changes copies. Disposed/unavailable
cards are hidden from highlights; stale selections are only removed on explicit save.
Preference read failure prevents saving a replacement.

## Verification

Focused pure tests cover possession/disposition/removal, Wishlist projections, LP
variant matching, zero/partial/missing/conflicting prices, concentration, complete
cost evidence, dated FX and foreign-language exclusion. Mobile E2E covers tile
navigation, preference selection in sample mode, detail handoff, fixed LP, narrow
widths, English/Hebrew rendering and accessibility. Rules tests cover the isolated
preference. Live signed-in data is not used by tests.
