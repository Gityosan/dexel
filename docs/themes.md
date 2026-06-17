# Themes

A theme is design tokens, mapped onto each target's native mechanism (pptx theme
colors/fonts, pdf draw colors, CSS-like values for md/html). A deck selects one by
name (`ThemeName`): `default`, `dark`, `corporate`, `minimal`, `vivid`.

## Authoring vs. resolved

Themes are authored as a small **`ThemeSpec`** and resolved to full
**`ThemeTokens`**:

```ts
ThemeSpec = {
  color: { bg, fg, accent, series?, muted?, surface?, border?, onAccent? }
  font?: { heading?, body?, mono? }
  type?: { title?, heading?, subheading?, body?, kpi?, code?, caption? }  // pt
}

ThemeTokens = {
  color: { bg, fg, accent, onAccent, muted, surface, border, series: string[] }
  font:  { heading, body, mono }   // default Noto Sans JP / Noto Sans Mono
  type:  { title, heading, subheading, body, kpi, code, caption }  // font sizes (pt)
}
```

`resolveTheme(spec)` derives anything omitted:

- **neutrals** — `surface = mix(bg, fg, 5%)`, `border = 14%`, `muted = 45%`;
- **onAccent** — black or white, whichever has more WCAG contrast on `accent`;
- **series** — falls back to accent tints (built-in themes ship a curated 6-color
  palette).

Color helpers `mix`, `relativeLuminance`, and `bestOn` are exported.

The `font` names label the typefaces for pptx/HTML. For **pdf**, glyphs must be
embedded: a Noto Sans JP subset ships and is used by default (so Japanese works
with no setup); override per role with the `pdf.fonts` option.

## Where tokens are used

| Token | Used for |
|---|---|
| `bg` | slide background |
| `fg` | primary text |
| `muted` | subheadings, captions, diagram connector lines |
| `accent` | title headings, KPI values, diagram strokes |
| `onAccent` | text on an accent/series fill |
| `surface` / `border` | code panels, grid-card panels (`surface: true` slots) |
| `series[]` | categorical diagrams: funnel, pyramid, matrix-2x2, cycle, venn |

Sequential diagrams (flow, tree, timeline) use `accent`; categorical ones cycle
through `series` (wrapping if there are more items than colors), with labels
recolored for contrast.

## Custom theme

A deck's `theme` accepts either a built-in name **or a full `ThemeSpec`** — supply
only what you want and let the rest derive:

```ts
const deck = SlideDeck.parse({
  theme: {
    color: { bg: "#0B0B0F", fg: "#EDEDED", accent: "#22D3EE" },
    // muted/surface/border/onAccent/series derive; font is optional
  },
  slides: [...],
});
```

The same works through the builder (`createDeck({ theme: { color: {...} } })`).
`resolveTheme(spec)` / `resolveDeckTheme(name | spec)` are exported if you want
the tokens directly.
