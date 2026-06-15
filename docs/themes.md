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
}

ThemeTokens = {
  color: { bg, fg, accent, onAccent, muted, surface, border, series: string[] }
  font:  { heading, body, mono }   // default Noto Sans JP / Noto Sans Mono
}
```

`resolveTheme(spec)` derives anything omitted:

- **neutrals** — `surface = mix(bg, fg, 5%)`, `border = 14%`, `muted = 45%`;
- **onAccent** — black or white, whichever has more WCAG contrast on `accent`;
- **series** — falls back to accent tints (built-in themes ship a curated 6-color
  palette).

Color helpers `mix`, `relativeLuminance`, and `bestOn` are exported.

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

`resolveTheme` accepts any spec; supply only what you want and let the rest
derive:

```ts
import { resolveTheme } from "dexel";
const tokens = resolveTheme({
  color: { bg: "#0B0B0F", fg: "#EDEDED", accent: "#22D3EE" },
});
```

(Wiring a custom resolved theme into the named-theme registry is not yet exposed;
the five built-in names are the current selection surface.)
