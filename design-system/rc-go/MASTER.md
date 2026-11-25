# RC Go — Design System (Master)

> Written by hand from the ui-ux-pro-max Quick Reference rules. The skill's search CLI needs Python, which isn't installed on this machine, so no search results were used.

## Product
- **Type:** Hyperlocal mobility + delivery marketplace (ride-hailing, parcel, food/grocery/retail) for Redemption City, Mowe, Ogun State.
- **Pattern:** Map-first, like Uber and InDrive. The map fills the screen and a bottom sheet sits over it on phones, or a right-hand panel on screens ≥ 900px. Pricing works by offer and counter-offer.
- **Users:** Customers (residents and visitors), Keke riders, bicycle dispatch riders, vendors (restaurants, supermarkets, retailers), Admin.

## Brand colours (taken from the RCCG emblem + the camp gate)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand` | `#232060` | `#2E2A7A` | RCCG indigo – headers, brand surfaces |
| `--action` | `#0B7A3E` | `#22B567` | RCCG green – primary CTAs, money, "go" |
| `--danger` | `#C81E26` | `#F0545B` | RCCG red – cancel, reject, errors |
| `--info` | `#1479B8` | `#4FB3EA` | Camp-gate sky blue – routes, info |
| `--warn` | `#B26B00` | `#F2B33D` | Pending, stars |
| `--bg` / `--card` | `#F5F6FA` / `#FFF` | `#0E0E1A` / `#1C1C31` | Surfaces |
| `--text` / `--muted` | `#14142B` / `#565670` | `#F1F1F7` / `#A9A9C2` | ≥ 4.5:1 on their surfaces |

## Typography
- **Plus Jakarta Sans** 400/500/600/700/800, loaded with `display=swap`.
- Scale: 12 · 14 · 16 (body) · 18 · 22 · 28. Line height 1.5. Prices use `tabular-nums`.

## Layout & interaction
- Mobile-first. Breakpoints: 600 / 900 / 1200.
- Bottom tab bar (≤ 4 items) on phones. Left rail on screens ≥ 900px.
- Touch targets ≥ 44px. Spacing scale 4/8/12/16/24/32.
- Radius 12 (controls), 18 (cards/sheets). One elevation scale: `--sh-1`, `--sh-2`.
- Icons: Lucide (one stroke family). Custom SVG for the Keke.
- Motion: 150–250ms ease-out. Honours `prefers-reduced-motion`.
- Each screen has a single primary CTA. Destructive actions are red and kept apart from it.
- Forms: visible labels, an error shown under the field, autosaved drafts (rider KYC).

## Anti-patterns to avoid
- Emoji as icons. Colour as the only sign of status (always add a text label).
- Placeholder-only labels. Hover-only actions. Horizontal scrolling on phones.
