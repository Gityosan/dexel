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

Early but end-to-end for the MVP core. Implemented:

- **IR** — Zod schemas for the whole deck.
- **Layouts** — **all 17 `LayoutPattern`s** (Tier-1/2/3 + technical: e.g.
  comparison, kpi-highlight, quote, timeline, process-steps, grid-cards,
  full-bleed, code, code-explain), plus a **layout engine** that binds blocks to
  slots and reports overflow.
- **Renderers** — Markdown, HTML (Google Doc paste), pptx (native text frames),
  and pdf (real text at coordinates, with **Japanese font embedding + subsetting**).
- **Diagrams** — shared normalized layout for structured patterns (flow,
  matrix-2x2, generic fallback): SVG for pdf (vector) and md (inline), and
  **native PowerPoint shapes** (rounded rects + connector lines) for pptx.
  **Mermaid** renders headlessly (jsdom) to SVG, embedded as vector in pdf and as
  a native SVG image in pptx (no rasterizer); md/html keep native mermaid
  fences/blocks.
- **Themes** — 5 built-in token sets.
- **Builder session** — stateful `createDeck` / `addSection` / `render`, echoing
  a deck summary with selectable pattern hints on every step.
- **MCP server** — the builder exposed as tools (`create_deck`, `add_section`,
  `render`, `export_deck_json`, `import_deck_json`) over stdio, with layout
  patterns surfaced as enums. Importable at `dexel/mcp`; runnable as `dexel-mcp`.
- **CLI** — `dexel render <deck.json> -t <md|html|pptx|pdf> -o out`, plus
  `dexel patterns` and `dexel mcp` (citty + consola).

The MVP implementation order (below) is complete.

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

TypeScript · Zod v4 (IR) · pptxgenjs (pptx) · pdfkit + fontkit + svg-to-pdfkit
(pdf, JP font subsetting) · mermaid + jsdom (headless diagrams) ·
@modelcontextprotocol/sdk (MCP) · tsdown (build) · vitest + fast-check (tests) ·
eslint + prettier.

## Authoring with the builder

```ts
import { createDeck } from "dexel";

const deck = createDeck({ theme: "corporate", aspect: "16:9" });
deck.addSection("title", [
  { type: "text", variant: "heading", text: "Q3 レビュー" },
  { type: "text", variant: "subheading", text: "2026" },
]);
const summary = deck.addSection("bullet-list", [
  { type: "text", variant: "heading", text: "成果" },
  { type: "list", items: [{ text: "売上 +20%" }] },
]);
// `summary` re-states sections + selectable pattern hints every call.

const md = deck.render("md");
const pdf = await deck.renderToBuffer("pdf", {
  pdf: { fonts: { body: "/path/to/NotoSansJP.ttf" } },
});
```

## CLI

```bash
dexel render deck.json -t md                 # → stdout
dexel render deck.json -t pptx -o deck.pptx  # binary targets need --out
dexel render deck.json -t pdf  -o deck.pdf \
  --mermaid --font-body /path/to/NotoSansJP.ttf
dexel patterns                               # list layouts + their slots
dexel mcp                                    # start the MCP server (stdio)
```

`render` reads the deck JSON from a file or `-` (stdin).

## Driving it from an LLM (MCP)

The same builder is exposed as an MCP server. Run `dexel-mcp` (stdio), or embed
it:

```ts
import { createMcpServer } from "dexel/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

await createMcpServer().connect(new StdioServerTransport());
```

Tools: `create_deck` → `add_section` (layout chosen from an enum; the response
re-states the deck summary + pattern slots every call) → `render`, plus
`export_deck_json` / `import_deck_json`.

## Implementation order (from the design spec)

1. Japanese font embedding (pdfkit + fontkit subsetting) — **done.**
2. IR Zod schema — **done.**
3. Tier-1 layout templates (coordinates) — **done.**
4. Layout engine (pattern → normalized coordinates, 16:9 / 4:3) — **done.**
5. pptx / pdf renderers (shared coordinate template, real text) — **done.**
6. md / html renderers (flowOrder demotion) — **done.**
7. Structured diagrams (SVG + pptx shapes) — **done** (md/pdf SVG + pptx native
   shapes).
8. Mermaid diagrams (SVG / PNG) — **done** for md/html (native), pdf (headless
   SVG embed), and pptx (native SVG image embed).
9. Theme (token) system — **done** (minimal token set).
10. MCP builder session (`create_deck` / `add_section` / `render`) — **done**
    (stdio server + tools).
11. Tier 2 / Tier 3 / technical layout coverage — **done** (all 17 patterns).
