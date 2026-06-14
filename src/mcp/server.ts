import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createDeck, DeckSession } from "../builder/index.js";
import { Aspect, Block, LayoutPattern, ThemeName } from "../ir/index.js";
import type { BinaryTarget, TextTarget } from "../render/index.js";

const VERSION = "0.0.0";

function jsonResult(obj: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2),
      },
    ],
  };
}

function errorResult(e: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
    isError: true,
  };
}

/**
 * Build a dexel MCP server: a stateful builder exposed as tools. Each server
 * owns its own session registry, so instances are independent (and testable in
 * isolation). The builder pattern from the design spec — create_deck /
 * add_section / render — is the first-class interface.
 */
export function createMcpServer(): McpServer {
  const sessions = new Map<string, DeckSession>();
  const server = new McpServer({ name: "dexel", version: VERSION });

  const requireSession = (deckId: string): DeckSession => {
    const session = sessions.get(deckId);
    if (!session) throw new Error(`Unknown deckId: ${deckId}`);
    return session;
  };

  server.registerTool(
    "create_deck",
    {
      title: "Create deck",
      description:
        "Start a new slide deck builder session. Returns a deckId and the deck summary (sections so far + the selectable layout patterns and their slots).",
      inputSchema: { theme: ThemeName.optional(), aspect: Aspect.optional() },
    },
    ({ theme, aspect }) => {
      const session = createDeck({ theme, aspect });
      const deckId = randomUUID();
      sessions.set(deckId, session);
      return jsonResult({ deckId, summary: session.summary() });
    },
  );

  server.registerTool(
    "add_section",
    {
      title: "Add section",
      description:
        "Append a slide by selecting a layout pattern (enum) and providing its blocks. Returns the refreshed deck summary — the section list plus the selectable patterns and each pattern's slots — so a long-running build never loses context.",
      inputSchema: {
        deckId: z.string(),
        layout: LayoutPattern,
        blocks: z.array(Block),
      },
    },
    ({ deckId, layout, blocks }) => {
      try {
        return jsonResult({ summary: requireSession(deckId).addSection(layout, blocks) });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "render",
    {
      title: "Render deck",
      description:
        "Render the deck to a target. Text targets (md, html) return text; binary targets (pptx, pdf) return base64-encoded bytes. Set mermaid=true to render mermaid diagrams into pdf.",
      inputSchema: {
        deckId: z.string(),
        target: z.enum(["md", "html", "pptx", "pdf"]),
        mermaid: z.boolean().optional(),
      },
    },
    async ({ deckId, target, mermaid }) => {
      try {
        const session = requireSession(deckId);
        if (target === "md" || target === "html") {
          return jsonResult(session.render(target as TextTarget));
        }
        const buf = await session.renderToBuffer(target as BinaryTarget, {
          pdf: { mermaid },
        });
        return jsonResult(buf.toString("base64"));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "export_deck_json",
    {
      title: "Export deck JSON",
      description: "Return the deck's full IR as JSON for stateless reproduction.",
      inputSchema: { deckId: z.string() },
    },
    ({ deckId }) => {
      try {
        return jsonResult(requireSession(deckId).toJSON());
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "import_deck_json",
    {
      title: "Import deck JSON",
      description:
        "Create a session from previously exported deck IR. Returns the new deckId and summary.",
      inputSchema: { deck: z.unknown() },
    },
    ({ deck }) => {
      try {
        const session = DeckSession.fromJSON(deck);
        const deckId = randomUUID();
        sessions.set(deckId, session);
        return jsonResult({ deckId, summary: session.summary() });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  return server;
}
