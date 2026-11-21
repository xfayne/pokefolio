# Shared UI

Use these local components when implementing another screen. Preserve the approved
Adventure Blue presentation; do not copy inventory JSX or invent new surface colors.

| Component | Purpose | State ownership |
| --- | --- | --- |
| `Card`, `ListCard` | Panel and compact list-item surfaces | Stateless |
| `Button` | Primary/outline actions | Caller handles actions |
| `Input`, `Field`, `SearchInput`, `Select` | Labelled text/search and native selection | Controlled by caller |
| `DisclosureButton`, `DisclosureContent`, `DisclosureChevron` | Accessible animated accordion parts | Caller MUST provide `open`, ID and toggle handler |
| `PokemonArt` | Shared thumbnail/detail/zoom framing, image-loading shimmer and fallback | Presentation only; accepts URL/alt, no catalog dependency |
| `UtilitySheet` | Modal utility screen, header, entry motion, focus restoration | Caller owns contents/back/close |
| `EmptyState`, `LoadingState`, `ErrorState` | Shared screen states | Caller supplies copy/actions |

## Palette and behavior contracts

`frontend/src/styles.css` defines `--surface-panel`, `--surface-border` and
`--surface-field` once. Shared surfaces use those tokens. Typography, framing,
reduced-motion rules and disclosure animation also live there; keep new screen
styles scoped and avoid overriding shared controls.

Shared disclosures deliberately have no product default. Cards list: all CLOSED.
Card Details / Your copies: OPEN for exactly one copy, otherwise CLOSED. These
rules belong to inventory consumers and their regression tests, not the UI kit.
Use stable IDs; a closed disclosure retains its children but makes them inert and
hidden from assistive technology. Do not nest buttons or place business data in UI state.

Use `PokemonArt` for thumbnails, Card Details and full-card zoom. Thumbnails retain
compact cropping; Card Details must keep its original small square frame, with
the image's TOP edge flush to the frame (no synthetic padding or empty stripe). **Never change the Card Details frame
dimensions to a portrait card shape.** Full-card zoom alone uses a portrait footprint
and an uncropped image. Both detail and zoom request high-resolution artwork with
standard-resolution fallback. During the shared Vintage Binder-style shimmer,
**all thumbnails and detail frames have transparent borders and no frame shadow**;
the yellow frame and detail shadow appear only with a successfully loaded image.
Keep a 220ms reveal and accessible error fallback. The owner's History reference
shows **inverted bottom header corners**: the header's navy color curves OUTWARD
into the left and right cutouts at the top of the light content panel.
Implement using sticky header corner overlays plus **rounded top corners of the
light main content**, and keep the main content bottom corners square. Do not
substitute ordinary bottom-left/right border-radius on the header; that produces
the opposite shape. The corner overlays must remain in view on scroll.
Keep all form text at least 16px to prevent iPhone input zoom. Preserve RTL logical
spacing and keyboard focus indicators. Existing mobile CI covers both languages.

Import directly from each module (for example `@/components/ui/disclosure`).
No new UI dependency or data/storage behavior is introduced by this extraction.

## Collection card sort keys (2026-11-21)

Collection Cards offers value, name, copy count, newest purchase date and
set/card number. Date sorting groups all currently held physical copies of one
catalog card into one row and uses its newest **known** acquisition date.
An unknown date is sorted last, not replaced with a fabricated date. Set/number
sorts alphabetically by set, then by the numeric card number (not lexicographically),
with stable tie-breaking. The existing compact copy rows and disclosure defaults
are unchanged.

## Authoritative bold weight (2026-11-20)

All emphasized UI text uses `--font-weight-bold: 700`, matching card names in
Collection → Cards. The semibold/extrabold/black Tailwind aliases resolve to the
same token; component CSS also uses it. Do not introduce another bold weight.
Regular/medium supporting text remains lighter. This supersedes older 800/900
counts, headings and condition-selector notes.
