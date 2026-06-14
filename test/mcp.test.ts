import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createMcpServer } from "../src/mcp/server.js";

let client: Client;

beforeEach(async () => {
  const server = createMcpServer();
  client = new Client({ name: "test", version: "0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
});

function textOf(result: CallToolResult): string {
  const first = result.content[0]!;
  if (first.type !== "text") throw new Error("expected text content");
  return first.text;
}

async function call(name: string, args: Record<string, unknown>) {
  return (await client.callTool({
    name,
    arguments: args,
  })) as CallToolResult;
}

describe("dexel MCP server", () => {
  it("exposes the builder tools (incl. enumerated layout patterns)", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "create_deck",
        "add_section",
        "render",
        "export_deck_json",
        "import_deck_json",
      ]),
    );
    // The layout pattern is surfaced as an enum in the tool schema.
    const addSection = tools.find((t) => t.name === "add_section")!;
    const layout = (
      addSection.inputSchema.properties as Record<string, { enum?: string[] }>
    ).layout!;
    expect(layout.enum).toContain("title");
    expect(layout.enum).toContain("two-column");
  });

  it("drives a full create → add → render flow", async () => {
    const created = JSON.parse(
      textOf(await call("create_deck", { theme: "corporate", aspect: "16:9" })),
    );
    expect(created.deckId).toBeTruthy();
    expect(created.summary.availableLayouts).toContain("title");

    const added = JSON.parse(
      textOf(
        await call("add_section", {
          deckId: created.deckId,
          layout: "title",
          blocks: [{ type: "text", variant: "heading", text: "Q3 レビュー" }],
        }),
      ),
    );
    expect(added.summary.sectionCount).toBe(1);

    const md = textOf(await call("render", { deckId: created.deckId, target: "md" }));
    expect(md).toContain("# Q3 レビュー");

    const pptxB64 = textOf(
      await call("render", { deckId: created.deckId, target: "pptx" }),
    );
    // base64 of an OPC zip starts with "UEsD" ("PK\x03\x04").
    expect(pptxB64.startsWith("UEsD")).toBe(true);
  });

  it("round-trips a deck via export/import", async () => {
    const { deckId } = JSON.parse(textOf(await call("create_deck", {})));
    await call("add_section", {
      deckId,
      layout: "bullet-list",
      blocks: [
        { type: "text", variant: "heading", text: "Agenda" },
        { type: "list", items: [{ text: "a" }] },
      ],
    });
    const exported = JSON.parse(textOf(await call("export_deck_json", { deckId })));

    const imported = JSON.parse(
      textOf(await call("import_deck_json", { deck: exported })),
    );
    expect(imported.deckId).not.toBe(deckId);
    expect(imported.summary.sectionCount).toBe(1);
  });

  it("reports a helpful error for an unknown deckId", async () => {
    const result = await call("add_section", {
      deckId: "missing",
      layout: "title",
      blocks: [],
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Unknown deckId");
  });
});
