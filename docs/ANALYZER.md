# React condition analyzer (#16)

Analyze uses the owner-approved Classic Red vector frame. On 2026-11-22 the owner
approved the actual SVG prototype, a unified results screen (no Front/Back result
sections), pixel typography for headings/status, and Pokédex-inspired controls.
The main application shell remains Adventure Blue. Input slots may identify front
and back; result photos form one numbered gallery. Single-side inputs are valid.

The frame has fixed-proportion SVG top/bottom caps and stretchable straight side
walls. It fills the app viewport between the header and bottom navigation, with
no outer spacing or document scrolling. Only the light display scrolls; the lens
and frame stay in place. Header/navigation remain in flex flow, including safe
areas and taller Hebrew labels. The native image picker supports camera/library
selection; separate Take photo and Add close-up controls were removed at the
owner's request. Multiple selections still support up to eight images.
During an AI request the main glass blinks white while its metal ring stays
steady; the small green/yellow lamps alternate in their existing colors. Completed
results color the main lens NM green, LP lime, MP yellow, HP orange or DMG red. Reduced motion disables animation. Pixelify Sans is
self-hosted and scoped to analyzer headings/actions; Hebrew uses the existing
Noto Sans Hebrew fallback and findings keep the normal readable body font.

`frontend/src/features/analyze/` owns the React UI, input reduction and typed
boundary/cache adapters. The existing Worker grading rubric, Gemini integration,
owner allowlist and endpoints are unchanged:

- `POST /api/resolve-ebay-link`: authenticated listing lookup, no AI request.
- `POST /api/analyze-upload`: 1–8 JPEG photos reduced locally from inputs <=16 MB.
- `POST /api/analyze-condition`: manual eBay analysis, preserving original indices.

Photo upload bytes and object URLs remain in memory and are released on removal,
reset, account change or unmount. No localStorage, Firestore or Storage photo save
is added. eBay analysis evidence uses the existing owner-only
`users/{uid}/conditionAnalyses/{key}` schema; no rules deployment is required.
Missing caches permit a manual analysis; unreadable caches require a second
explicit click to start a new request. Save failures preserve the result and
support a save-only retry. Reanalysis is explicitly labelled as a new AI request.

Geometry uses the image's natural aspect ratio, never a cover crop. Locations
must use valid original image indices and normalized boxes. Unlocated findings
remain text without fabricated markers. Clicking a located finding opens its
photo and highlights the evidence box. All results are estimates, not authenticity
or professional grading. Provider findings are displayed verbatim and are not
translated by a second AI call.

Verification: owner-cache/API boundaries, invalid responses, cached results,
manual triggers, unified findings/zoom, save-only retries, account changes and
request cancellation are covered by Vitest. Mobile Playwright covers local file
selection, mode toggles, zoom dismissal, accessibility, RTL/320px bounds and
reduced motion. CI/deployment receipts determine release status; mocked tests do
not establish a live authenticated provider call.

Issue #16 includes catalog/Wishlist behaviors beyond this analyzer increment;
this PR does not claim to close the entire issue.

## Result refinements — 2026-11-22

Detected wear precedes the unified photo gallery. Grade breakdown & limitations
is an always-visible section with the same pixel heading as Detected wear.
Bars show only original probabilities >=5%, sorted descending without
renormalizing values; the selected grade/confidence and actual limitations remain
unchanged. The owner removed the estimate chip and standalone disclaimer copy.
The grading API, prompt, results and cache documents are unchanged.

## Blue lens flash and instrument readout — 2026-11-22

The owner clarified that busy keeps the blue glass, with a brief radial white
light inside its bounds every 0.7 seconds. The metal rim stays steady. Small
green/yellow lamps alternate opacity every 0.45 seconds over dark backings,
avoiding animated SVG brightness filters on mobile WebKit. Reduced-motion
preferences remain respected. Completed grade colors are unchanged.

The outer enclosure is square and the SVG end caps trim their transparent
vertical margins; the inner display retains its rounding. Hide confidence and
photo-coverage copy without changing their stored values. Rename the heading
to Grade breakdown (actual limitation findings remain visible). Replace native
meters with accessible segmented LCD-style readouts, retaining original
probabilities, the >=5% filter and descending order.

## Molded perimeter correction — 2026-11-22

Squaring only the base rectangles left the header plaque, perimeter highlight,
right header seam and lower lip visibly rounded over a red backing. The owner
rejected that result. The actual visible plaque/trim paths now turn at square
outer corners. The right perimeter uses one continuous rail at the same source
x-coordinate across all three slices; the redundant inset right stroke was
removed. The existing palette/gradients, lens, lamps, central stepped seam and
rounded inner display are preserved. Review full-resolution cap crops as well
as viewport bounds; a small thumbnail alone can hide a rail discontinuity.

The owner approved the direct SVG render of this corrected contour on
2026-11-22 before publication. Publish that exact artwork without further redesign.

## Slice seam correction — 2026-11-22

The stretchable middle SVG overlaps each fixed cap by one CSS pixel behind it.
This prevents fractional clip edges on mobile from exposing a dark horizontal
hairline above the heading or at the lower join. Artwork and layout are unchanged;
Playwright checks both overlaps.

## Remove listing photos (2026-11-26)

The approved top-right X removes a listing thumbnail immediately; tapping the
image still opens its preview. Analyze is disabled for an empty selection. The
selection-specific authenticated endpoint verifies retained URLs against the
current eBay listing, sends up to eight retained images in gallery order and
returns indices relative to that gallery. Changed listings are rejected before
inference. Filtered results remain session-only, without reading or overwriting
the full-listing cache; ordinary full-listing and manual-upload analysis are
unchanged. Deploy the staging Worker before releasing the frontend; older
Workers do not recognize the selection-specific endpoint and cannot silently
analyze excluded photos.
