# Intermediate representation (IR)

The IR is a set of Zod schemas (exported from the package root). Parsing applies
defaults and validation; every renderer consumes the parsed deck.

## SlideDeck

```ts
SlideDeck = {
  theme: ThemeName        // default "default"
  aspect: "16:9" | "4:3"  // default "16:9"
  meta?: { title?, author?, date? }
  slides: Slide[]
}
```

`ThemeName` ∈ `default | dark | corporate | minimal | vivid`.

## Slide

```ts
Slide = {
  layout: LayoutPattern   // one of the 17 patterns (see layouts.md)
  blocks: Block[]
  notes?: string          // speaker notes (emitted in pptx)
}
```

Blocks are bound to the layout's slots by the engine: an explicit `slot` id wins,
otherwise a block is placed in the first free slot whose role it can fill, then
any free slot. Blocks that don't fit are reported as `overflow` (not dropped).

## Block

A discriminated union on `type`. Every block may carry an optional `slot` (a slot
id to bind to).

| `type` | fields |
|---|---|
| `text` | `variant: heading \| subheading \| body \| paragraph` (default `body`), `text`, `color?` (token name or hex), `align?` |
| `list` | `ordered` (default false), `items: { text, level }[]` |
| `code` | `language?`, `filename?` (shown as a tab), `code`, `showLineNumbers` (default false) |
| `image` | `src` (file path or data URI), `alt?`, `fit: contain \| cover` |
| `kpi` | `value`, `label`, `caption?` |
| `diagram` | discriminated on `kind` — see below |

### DiagramBlock

```ts
// structured: authored as nodes/edges
{ type: "diagram", kind: "structured", pattern: StructuredDiagramPattern,
  orientation?: "horizontal" | "vertical",  // for funnel
  nodes: DiagramNode[], edges: DiagramEdge[] }

// mermaid: authored as mermaid source
{ type: "diagram", kind: "mermaid", pattern?: MermaidDiagramPattern, source: string }
```

```ts
DiagramNode = { id, label, group?, value?, level?, date?, parent?, color? }
DiagramEdge = { from, to, label? }
```

The optional node fields are pattern-specific (see [diagrams.md](./diagrams.md)).

## LayoutTemplate

The central asset. One pattern ⇒ one template; fixed-canvas renderers use `rect`,
flow renderers walk `flowOrder`.

```ts
LayoutTemplate = {
  pattern: LayoutPattern
  slots: {
    id, role,                        // role ∈ heading|subheading|body|image|diagram|kpi|code
    rect: { x, y, w, h },            // normalized 0–1, origin top-left
    vAnchor: top | center | bottom,  // absorbs the 16:9 ⇄ 4:3 gap
    surface: boolean                 // draw a surface panel behind the slot
  }[]
  flowOrder: string[]                // slot ids in demotion order
}
```
