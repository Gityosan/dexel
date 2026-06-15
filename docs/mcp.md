# MCP server

The builder exposed as MCP tools, so an LLM (e.g. Claude) can stack a deck one
pattern at a time and render it. The core stays free of the MCP SDK; import the
server from the `dexel/mcp` subpath, or run the `dexel-mcp` / `dexel mcp` bin
(stdio).

```ts
import { createMcpServer } from "dexel/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

await createMcpServer().connect(new StdioServerTransport());
```

Each server owns its own session registry, so instances are independent.

## Tools

| Tool | Input | Result |
|---|---|---|
| `create_deck` | `theme?`, `aspect?` | `{ deckId, summary }` |
| `add_section` | `deckId`, `layout` (enum), `blocks` | `{ summary }` |
| `render` | `deckId`, `target` (`md`/`html`/`pptx`/`pdf`), `mermaid?` | text, or base64 for binary targets |
| `export_deck_json` | `deckId` | the deck IR as JSON |
| `import_deck_json` | `deck` | `{ deckId, summary }` |

## Design

- **Patterns are enums** in the tool schema — the model selects a layout, it never
  free-describes one.
- **`add_section` echoes the deck summary every call** — the section list plus the
  selectable patterns and each pattern's slots. This is the context-degradation
  mitigation: a long build never loses track of its options.
- The IR's Zod schemas are reused directly as the tool input schemas, so blocks
  (including the diagram union) are validated at the boundary and surfaced to the
  model as JSON Schema.
- `export_deck_json` / `import_deck_json` give stateless reproduction alongside
  the stateful session.

## Flow

```
create_deck(theme, aspect) -> deckId
add_section(deckId, layout, blocks) -> { summary }   // repeat per slide
render(deckId, target) -> output                      // md/html text, pptx/pdf base64
```
