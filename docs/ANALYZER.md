# React condition analyzer (#16)

Analyze uses the owner-approved Classic Red vector frame. On 2026-11-22 the owner
approved the actual SVG prototype, a unified results screen (no Front/Back result
sections), pixel typography for headings/status, and Pokédex-inspired controls.
The main application shell remains Adventure Blue. Input slots may identify front
and back; result photos form one numbered gallery. Single-side inputs are valid.

The frame has fixed-proportion SVG top/bottom caps and stretchable straight side
walls. This preserves the lens and decoration while accommodating longer results.
Its blue lens pulses and indicator lamps alternate only during an AI request;
completion lights green. Reduced motion disables animation. Pixelify Sans is
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
