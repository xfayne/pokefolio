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
compact cropping; details/zoom reserve a portrait footprint and display the complete
high-resolution image (with a standard-image fallback) without cropping. The shared
shimmer, fade-in and error fallback reproduce the Vintage Binder loading behavior.
Keep all form text at least 16px to prevent iPhone input zoom. Preserve RTL logical
spacing and keyboard focus indicators. Existing mobile CI covers both languages.

Import directly from each module (for example `@/components/ui/disclosure`).
No new UI dependency or data/storage behavior is introduced by this extraction.

## Authoritative bold weight (2026-11-20)

All emphasized UI text uses `--font-weight-bold: 700`, matching card names in
Collection → Cards. The semibold/extrabold/black Tailwind aliases resolve to the
same token; component CSS also uses it. Do not introduce another bold weight.
Regular/medium supporting text remains lighter. This supersedes older 800/900
counts, headings and condition-selector notes.
