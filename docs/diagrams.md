# Diagram patterns

Two input systems, one shared layout/render axis.

## Structured (nodes/edges)

Authored as `nodes` + `edges`; laid out into normalized primitives and rendered
to **SVG** (pdf, md) and **native pptx shapes**. Categorical patterns color their
items from the theme's `series` palette.

| Pattern | Node fields used | Validation |
|---|---|---|
| `flow` | `label` | ≥ 2 nodes. Adjacent edges → straight arrow; skip/backward/self edges → routed elbow |
| `cycle` | `label` | ≥ 2 nodes; nodes placed on a circle, looped arrows |
| `pyramid` | `label`, `level?` | ≥ 1 node; ordered by `level`, widening to the base |
| `matrix-2x2` | `label` | 1–4 nodes (quadrants) |
| `funnel` | `label`, **`value`** | ≥ 2 nodes, each with a numeric `value`; bars sized by value with connecting lines. `orientation: "horizontal"` lays steps left-to-right (default vertical) |
| `org-tree` | `label`, `parent?` | tree (single root, no cycles) via `parent`/edges |
| `tree` | `label`, `parent?` | tree (single root, no cycles) via `parent`/edges |
| `timeline` | `label`, **`date`** | ≥ 1 node; each node needs a `date` (sorted along an axis) |
| `venn` | `label` | 2–3 nodes (overlapping circles) |

Always enforced (every pattern):

- node `id`s are unique;
- every `edge.from`/`edge.to` and every `node.parent` references an existing id;
- a node cannot be its own parent.

`structuredDiagramIssues(diagram)` is exported if you want to validate outside
the schema; the same checks run during `Block`/`SlideDeck` parsing.

```ts
{ type: "diagram", kind: "structured", pattern: "funnel",
  nodes: [ { id: "a", label: "Leads", value: 100 },
           { id: "b", label: "Won", value: 40 } ],
  edges: [] }
```

## Mermaid (source string)

Authored as raw mermaid; rendered headlessly to SVG.

| Pattern (hint) | Typical use |
|---|---|
| `sequence` | sequence diagrams |
| `state` | state machines |
| `er` | entity-relationship |
| `arch` | architecture / node-and-connector |

```ts
{ type: "diagram", kind: "mermaid", source: "graph TD; A-->B; B-->C;" }
```

Per target:

- **md** keeps a ` ```mermaid ` fence (rendered natively by many viewers);
- **html** keeps `<pre class="mermaid">` (rendered client-side);
- **pdf** embeds the rendered SVG as vector (enable with the `mermaid` option /
  `--mermaid`);
- **pptx** embeds the rendered SVG as a native image (enable with the `mermaid`
  option); otherwise the source text is kept.

When the built-in renderer is used, mermaid is tinted with the deck's theme
colors (accent → borders, etc.) for brand consistency.
