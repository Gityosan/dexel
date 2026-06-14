# dexel

One structured definition → multiple slide formats (**pptx / pdf / md / Google Doc**).

`dexel` takes a single structured deck definition (a Zod-validated intermediate
representation) and renders it to several targets. It is designed to be driven by
an LLM over MCP: Claude builds a deck by selecting from enumerated **layout
patterns** and **diagram patterns** rather than solving free-form coordinate
layout.

Two core values:

1. **One source → many formats**, with body text preserved as real text in every
   format.
2. **Choose-from-a-list authoring** — the LLM picks from enumerated patterns and
   stacks them, sidestepping free-layout coordinate solving.

## Status

Early scaffolding. This commit lands the project tooling and the **intermediate
representation (IR)** — the Zod schemas for the whole deck. Renderers, the layout
engine, diagrams, themes, and the MCP builder session are not implemented yet
(see the design spec and the implementation order below).

## The IR

The IR is slide-oriented and fixed at one slide per logical unit. Flow targets
(md / Google Doc) are produced by an explicit *demotion* driven by each layout
template's `flowOrder`, so renderers never branch per target.

```
SlideDeck            theme · aspect (16:9 | 4:3) · meta · slides[]
 └─ Slide            layout (LayoutPattern) · blocks[]
     └─ Block        text | list | code | diagram | image | kpi
          └─ Diagram structured (nodes/edges) | mermaid (source)

LayoutTemplate       pattern · slots[] (normalized rect + role + vAnchor) · flowOrder
```

All geometry is stored in **normalized coordinates (0–1)** so a single template
can be shared by the fixed-canvas renderers (pptx → EMU, pdf → pt); the 16:9 ⇄
4:3 gap is absorbed via per-slot vertical anchoring.

Everything is exported from the package root:

```ts
import { SlideDeck, type SlideDeck as Deck } from "dexel";

const deck = SlideDeck.parse({
  theme: "corporate",
  aspect: "16:9",
  slides: [
    {
      layout: "title",
      blocks: [
        { type: "text", variant: "heading", text: "Q3 Review" },
        { type: "text", variant: "subheading", text: "2026" },
      ],
    },
  ],
});
```

## Development

```bash
npm install
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run build     # tsdown → dist/
npm run check     # publint
```

## Tech stack

TypeScript · Zod v4 (IR) · tsdown (build) · vitest + fast-check (tests) ·
eslint + prettier. Planned: pptxgenjs, pdfkit + fontkit (JP font subsetting),
mermaid, citty (CLI), and the MCP SDK.

## Implementation order (from the design spec)

1. Japanese font embedding (pdfkit + fontkit subsetting) — the first gate.
2. **IR Zod schema — done.**
3. Tier-1 layout templates (coordinates).
4. Layout engine (pattern → normalized coordinates, 16:9 / 4:3).
5. pptx / pdf renderers (shared coordinate template, real text).
6. md / html renderers (flowOrder demotion).
7. Structured diagrams (SVG + pptx shapes).
8. Mermaid diagrams (SVG / PNG).
9. Theme (token) system.
10. MCP builder session (`create_deck` / `add_section` / `render`).
11. Tier 2 / Tier 3 / technical layout coverage.
