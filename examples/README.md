# Examples

## `sample-deck.json`

A full deck JSON exercising every layout pattern and several diagram patterns.
Render it with the CLI (after `npm run build`):

```bash
dexel render examples/sample-deck.json -t md
dexel render examples/sample-deck.json -t pptx -o /tmp/deck.pptx
dexel render examples/sample-deck.json -t pdf  -o /tmp/deck.pdf --mermaid
```

> The `image-caption` and `full-bleed` slides reference image paths that don't
> exist, so they render dexel's gray **placeholder** — swap in your own image
> paths (or data URIs) to see real images.

## `builder.mjs`

The same deck built programmatically with the stateful builder API:

```bash
npm run build
node examples/builder.mjs        # writes examples/out/deck.{md,html,pptx,pdf}
```

`examples/out/` is git-ignored.
