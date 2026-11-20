> Approved visual direction: 2026-11-19. This original specification predates some later screen decisions. [Current decisions](decisions.md) override stale proposal status, links and navigation descriptions below.

# Pokefolio — Design System v1

Date: 2026-11-19. Status: PROPOSED — requires user approval. Issue: https://github.com/xfayne/pokefolio/issues/4

## Authority and scope

The approved Dashboard composition is the visual anchor: approved/dashboard.png

This document proposes shared design decisions for subsequent screen mocks. It does not implement application UI, change the current theme, or approve all of Issue #4. Exact utility names and Tailwind v4 theme values below are authoritative for this proposal; generated artwork is illustrative and cannot define exact font rendering or color values. Existing main uses Tailwind 4.3.5, shadcn-style local components and lucide-react. Existing dark/mint shell styling is provisional and differs from the approved dashboard direction.

## 1. Visual direction

Adventure Blue: premium financial clarity, spacious summaries, dense usable card lists, playful collecting accents. Light content surfaces with deep navy header/navigation. Scenic art belongs in the Dashboard hero, not repeated behind tables or forms. Card art provides most of the color. Avoid glass effects behind essential text.

## 2. Color roles

Use built-in Tailwind v4 colors directly. The exact color references are CSS variables such as `var(--color-blue-600)`, not approximated hex values from older Tailwind versions. Do not override the built-in palette to match generated pixels.

| Role | Tailwind utilities | Usage |
| --- | --- | --- |
| Primary action | `bg-blue-600 text-white hover:bg-blue-700` | Primary buttons and selected controls |
| Text link | `text-blue-700 hover:text-blue-800` | See all, View transactions |
| App background | `bg-blue-50` | Page canvas |
| Surface | `bg-white` | Cards, sheets, forms |
| Quiet surface | `bg-slate-100` | Inactive segments and placeholders |
| Header / bottom navigation | `bg-slate-900 text-white` | Stable navigation frame |
| Primary text | `text-slate-950` | Headings, values |
| Secondary text | `text-slate-600` | Supporting labels |
| Borders | `border-blue-100` or `divide-slate-200` | Decorative card borders / row separators |
| Input boundary | `border-slate-500` | Visible field boundary; not decorative blue-100 |
| Positive result | `text-emerald-700 bg-emerald-50` | Signed gains, with + and a label/icon |
| Negative / error | `text-rose-700 bg-rose-50` | Signed losses / errors, with text |
| Warning / missing data | `text-amber-800 bg-amber-50` | Missing/estimated cost; never imply zero |
| Informational status | `text-blue-800 bg-blue-100` | Coverage and informational badges |
| Decorative chart | `stroke-teal-500 fill-teal-100` | Value line / area; pair with readable summary and chart labels |
| Decorative collecting accent | `text-amber-500` | Trophy / rarity flourish; not essential small text |

Brand red is reserved for the central Poké Ball artwork. Financial loss uses rose plus explicit meaning, never Poké Ball red alone. Active navigation uses cyan and semibold labels with semantic aria-current. The owner removed the underline indicator on 2026-11-20 to keep the bar compact. Dark mode is a later design proposal; navy navigation does not imply a complete dark theme.

## 3. Typography

Proposed font family: Inter for English/Latin, Noto Sans Hebrew for Hebrew, system sans-serif fallback. Self-host only required font files when implementing. Define `--font-sans` once through Tailwind v4 `@theme`, then use `font-sans`. Font choice is proposed, not installed.

| Purpose | Utilities | Default size |
| --- | --- | --- |
| Main portfolio number | `text-4xl font-bold tracking-tight tabular-nums` | 36px |
| Page title | `text-2xl font-bold tracking-tight` | 24px |
| Section title | `text-xl font-semibold` | 20px |
| Summary value | `text-2xl font-bold tabular-nums` | 24px |
| Standard body / every input | `text-base leading-6` | 16px |
| Compact row label | `text-sm font-medium leading-5` | 14px |
| Supporting text | `text-sm leading-5 text-slate-600` | 14px |
| Badge / navigation caption | `text-xs font-medium leading-4` | 12px |

Use 400/500/600/700 weights. Keep financial amounts in isolated LTR spans with `dir="ltr"`, `tabular-nums`, locale-aware formatting, and explicit currency. Do not use uppercase microcopy as a substitute for hierarchy. Essential touch targets remain large even when their labels use text-xs.

## 4. Spacing, shape and elevation

| Purpose | Utilities | Size |
| --- | --- | --- |
| Very small spacing | `gap-1` | 4px |
| Icon/text spacing | `gap-2` | 8px |
| Dense row padding | `p-3` | 12px |
| Page gutters / regular card padding | `px-4`, `p-4` | 16px |
| Between sections | `space-y-6` | 24px |
| Spacious summary padding | `p-6` | 24px |
| Small controls | `rounded-lg` | 8px radius |
| Inputs / buttons | `rounded-xl` | 12px radius |
| Cards | `rounded-2xl` | 16px radius |
| Sheets | `rounded-t-3xl` | 24px top radius |
| Chips / central ball | `rounded-full` | Full rounding |
| Main cards | `border border-blue-100 shadow-sm` | Subtle elevation |
| Overlays | `shadow-xl` | Modal/sheet elevation only |

This Month: `p-6 space-y-6`; distinct header, metrics and footer. Metrics use `grid grid-cols-2 gap-4`; optional responsive stacking when translations or large text need it. Footer uses `border-t pt-4` with a minimum 44px interactive target. Dense holdings rows use `p-3 gap-3` and at least `min-h-16`; spacious summary rules must not inflate large collection lists.

## 5. Shared component recipes

| Component | Proposed Tailwind recipe |
| --- | --- |
| Primary button | `min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700` |
| Secondary button | `min-h-11 rounded-xl border border-slate-500 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-50` |
| Icon action | `flex size-11 items-center justify-center rounded-xl` plus accessible name |
| Field | `min-h-11 w-full rounded-xl border border-slate-500 bg-white px-3 text-base text-slate-950` |
| Card | `rounded-2xl border border-blue-100 bg-white p-4 shadow-sm` |
| Compact badge | `inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium` plus semantic colors |
| Segmented control | `grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1` with `min-h-11 rounded-lg` choices |
| Selected segment | `bg-blue-600 text-white shadow-sm` |
| Keyboard focus | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600` |
| Disabled | `disabled:cursor-not-allowed disabled:opacity-50` with actual disabled semantics |

Use existing local shadcn/ui approach and named Lucide-family imports from react-icons/lu (owner-requested 2026-11-20), normally `size-5` with consistent stroke width. Do not add another UI library. Follow semantic component variants where already present; map those roles to palette tokens once during approved implementation. Keep static class variants discoverable by Tailwind, rather than constructing class names dynamically.

## 6. Navigation and approved Dashboard rules

- Bottom destinations: Collection, Wishlist, raised central Poké Ball / Dashboard, Analyze, Transactions.
- Top actions: Search and Settings. Deals is an internal Wishlist tab.
- Dashboard order: Collection Value chart, Recent Acquisitions, This Month, Top Holdings.
- Chart choices: 1M, 3M, 1Y, All. Selected choice visually filled.
- Do not restore the removed P/L on known-cost holdings note.
- Use safe-area bottom padding, reserve scroll padding for the full bottom bar including raised ball, and keep all content reachable above the bar/keyboard.
- Proposed navigation targets: `min-h-16`; active state uses cyan/semibold labels and `aria-current`, without an underline indicator. The raised ball still has a readable Dashboard label.
- Existing Binder page behavior, empty pockets, moves and Wishlist drag ordering remain unchanged.

## 7. Motion, states and accessibility

- Controls: `transition-colors duration-150 ease-out`.
- Disclosure/sheet transitions: `duration-200 ease-out`; animate only properties that preserve stable content and focus.
- Prefer stable image dimensions (`aspect-[5/7] object-contain`) and placeholders to prevent flashes/layout shifts.
- Respect reduced motion through `motion-reduce:transition-none motion-reduce:animate-none`; do not animate the full screen on every tab click.
- Empty state: concise explanation and one relevant action. Error state: readable cause and retry. Loading: stable skeleton layout; preserve stale readable content during refetch when appropriate.
- Financial unknowns: show Unknown / unavailable, not $0 or invented returns. Gains/losses always include sign and meaningful label.
- Standard text contrast target 4.5:1; large text and essential non-text graphics 3:1. Palette choice alone is not proof: verify actual component pairs, states, chart marks and overlays during implementation.
- Touch targets at least 44px; input text at least 16px on mobile; keyboard focus visible; programmatic labels and validation messages required.
- RTL: use `ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`; mirror directional arrows only, never money or card art. Verify large text, long Hebrew labels, 320px width, and software keyboard.

## 8. Next design approvals

1. Review this visual system and bilingual font specimens.
2. Shared components/states board and navigation selected/unselected/scroll states.
3. Collection Overview / Cards; Binder reference behavior preserved.
4. Wishlist / Deals, including ordering and internal tabs.
5. Transactions, purchase/sale and shipment views; align financial fields with separately approved data model.
6. Analyze and Settings, plus Hebrew/RTL representative screens.
7. Approved design documentation and small implementation PRs; do not mark Issue #4 complete from a design board alone.

## Technical references

- https://tailwindcss.com/docs/colors — Tailwind v4 built-in palette.
- https://tailwindcss.com/docs/theme — CSS-first theme variables.
- Main repository files inspected: README.md, PROJECT_CONTEXT.md, frontend/package.json, frontend/src/styles.css. Issue #4 navigation update supersedes the older navigation list still present in PROJECT_CONTEXT.md.

