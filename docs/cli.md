# CLI

The `dexel` bin (built on citty). After `npm run build`, run via `node
dist/cli/run.mjs …`, or `dexel …` once installed.

## `dexel render <input> -t <target>`

Render a deck JSON file (or `-` for stdin) to a target format.

| Flag | Description |
|---|---|
| `<input>` | path to the deck JSON, or `-` for stdin |
| `-t, --target` | `md` \| `html` \| `htmlslides` \| `pptx` \| `pdf` (required) |
| `-o, --out` | output file (text targets default to stdout; binary targets require it) |
| `--mermaid` | render mermaid diagrams (pdf / pptx) |
| `--font-body` / `--font-heading` / `--font-mono` | font files to embed (pdf) — overrides the bundled default |

> pdf bundles a Noto Sans JP subset and uses it by default, so Japanese renders
> without any `--font-*` flag. Pass `--font-body` (etc.) for fuller glyph coverage
> or a custom typeface; `--font-mono` to keep code monospaced with CJK.

```bash
dexel render deck.json -t md                       # → stdout
dexel render deck.json -t pptx -o deck.pptx
dexel render deck.json -t pdf  -o deck.pdf \
  --mermaid --font-body /path/to/NotoSansJP.ttf
cat deck.json | dexel render - -t html -o deck.html
```

Text targets (`md`, `html`) print to stdout when `--out` is omitted; binary
targets (`pptx`, `pdf`) require `--out` and exit non-zero otherwise. Malformed or
missing input is reported as an error with a non-zero exit code.

## `dexel patterns`

List the available layout patterns and their slots.

## `dexel mcp`

Start the MCP builder server over stdio (same as the `dexel-mcp` bin). See
[mcp.md](./mcp.md).
