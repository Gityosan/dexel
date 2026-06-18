# dexel documentation

One structured deck definition → **pptx / pdf / md / Google Doc**. Built to be
driven by an LLM over MCP: the model stacks slides by choosing from enumerated
layout and diagram patterns, then renders to any target.

## Reference

- [Intermediate representation (IR)](./ir.md) — the deck schema: `SlideDeck`,
  `Slide`, blocks, diagrams.
- [Layout patterns](./layouts.md) — the 17 layouts and their slots.
- [Diagram patterns](./diagrams.md) — structured and mermaid diagrams, with the
  per-pattern node/edge requirements.
- [Themes](./themes.md) — design tokens, derivation, and the categorical series.
- [CLI](./cli.md) — `dexel render` / `patterns` / `mcp`.
- [MCP server](./mcp.md) — the builder tools.

## Quickstart

```bash
npm install
npm run build
```

```ts
import { createDeck } from "dexel";

const deck = createDeck({ theme: "corporate", aspect: "16:9" });
deck.addSection("title", [
  { type: "text", variant: "heading", text: "Q3 レビュー" },
]);
const md = deck.render("md");
const pptx = await deck.renderToBuffer("pptx");
const pdf = await deck.renderToBuffer("pdf"); // Japanese works by default
```

Or from a deck JSON file, see [`../examples`](../examples).

## How it fits together

```
SlideDeck (Zod IR)
   │  resolve: blocks → layout-template slots (normalized 0–1 coords)
   ├─ pptx  : native text frames + shapes (EMU)
   ├─ pdf   : drawText + embedded SVG (pt), JP font subsetting
   ├─ md         : flowOrder demotion (real text + inline SVG)
   ├─ html       : flowOrder demotion (Google Doc paste)
   └─ htmlslides : CSS-laid-out 16:9 pages (browser / print-to-PDF)
```

All body text stays as real text in every target. Geometry is stored normalized
so the fixed-canvas renderers (pptx, pdf) share one coordinate template, while
flow targets (md, Google Doc) are produced by an explicit demotion driven by
each template's `flowOrder`.
