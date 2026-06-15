# Layout patterns

17 patterns, all implemented. Pass the pattern name as `Slide.layout`; fill its
slots with blocks (by `slot` id or by role). `dexel patterns` prints this catalog
from the live templates.

Slots are listed as `id:role`. The first heading-role slot takes a `heading`
text block; subheading/body/kpi/code/image/diagram slots take the matching block.

## Tier 1 — MVP

| Pattern | Slots (`id:role`) |
|---|---|
| `title` | `title:heading`, `subtitle:subheading`, `meta:body` |
| `section-divider` | `heading:heading` |
| `title-content` | `heading:heading`, `body:body` |
| `two-column` | `heading:heading`, `left:body`, `right:body` |
| `bullet-list` | `heading:heading`, `lead:body`, `bullets:body` |

## Tier 2 — business decks

| Pattern | Slots (`id:role`) |
|---|---|
| `comparison` | `heading:heading`, `leftTitle:subheading`, `left:body`, `rightTitle:subheading`, `right:body` |
| `kpi-highlight` | `heading:heading`, `kpi1:kpi`, `kpi2:kpi`, `kpi3:kpi` |
| `image-caption` | `heading:heading`, `image:image`, `caption:body` |
| `quote` | `quote:body`, `attribution:subheading` |
| `agenda` | `heading:heading`, `items:body` |
| `toc` | `heading:heading`, `items:body` |

## Tier 3

| Pattern | Slots (`id:role`) | Notes |
|---|---|---|
| `timeline` | `heading:heading`, `timeline:diagram`, `caption:body` | structured `timeline` diagram + optional caption |
| `process-steps` | `heading:heading`, `steps:diagram`, `caption:body` | structured `flow` diagram + optional caption |
| `content-diagram` | `heading:heading`, `body:body`, `diagram:diagram` | heading + lead text + a diagram (mixed content) |
| `grid-cards` | `heading:heading`, `c1`–`c6:body` | card slots are surface panels |
| `full-bleed` | `image:image`, `heading:heading` | full-canvas image with a heading overlay |

## Technical

| Pattern | Slots (`id:role`) |
|---|---|
| `code` | `heading:heading`, `code:code` |
| `code-explain` | `heading:heading`, `code:code`, `explain:body` |

## Notes

- Coordinates are normalized (0–1) and shared by pptx and pdf; md/html demote via
  each template's `flowOrder`.
- `vAnchor` (top/center/bottom) absorbs the 16:9 ⇄ 4:3 ratio difference.
- Slots with `surface: true` (e.g. grid-cards) render a panel (surface fill +
  border) behind their content.
