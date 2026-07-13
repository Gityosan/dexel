import { readFile, writeFile } from "node:fs/promises";
import { defineCommand } from "citty";
import { consola } from "consola";
import {
  getLayoutTemplate,
  render as renderText,
  renderHtmlSlides,
  renderToBuffer,
  SlideDeck,
  supportedLayouts,
  type BinaryTarget,
  type RenderOptions,
  type TextTarget,
} from "../index.js";

const VERSION = "0.0.0";

const TEXT_TARGETS = new Set(["md", "html", "htmlslides"]);
const BINARY_TARGETS = new Set(["pptx", "pdf"]);

async function readInput(path: string): Promise<string> {
  if (path === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8");
  }
  return readFile(path, "utf8");
}

const renderCommand = defineCommand({
  meta: {
    name: "render",
    description: "Render a deck JSON file to a target format",
  },
  args: {
    input: {
      type: "positional",
      description: "Path to the deck JSON file, or - for stdin",
      required: true,
    },
    target: {
      type: "string",
      description: "Output format: md | html | htmlslides | pptx | pdf",
      alias: "t",
      required: true,
    },
    out: {
      type: "string",
      description: "Output file path (text targets default to stdout)",
      alias: "o",
    },
    mermaid: {
      type: "boolean",
      description: "Render mermaid diagrams (pdf / pptx)",
    },
    "font-body": { type: "string", description: "Body font file to embed (pdf)" },
    "font-heading": {
      type: "string",
      description: "Heading font file to embed (pdf)",
    },
    "font-mono": { type: "string", description: "Mono font file to embed (pdf)" },
    "embed-font": {
      type: "boolean",
      description: "Embed the JP font via @font-face (htmlslides)",
    },
  },
  async run({ args }) {
    let deck;
    try {
      deck = SlideDeck.parse(JSON.parse(await readInput(args.input)));
    } catch (e) {
      consola.error(
        `Could not read deck "${args.input}": ${e instanceof Error ? e.message : String(e)}`,
      );
      process.exitCode = 1;
      return;
    }
    const target = args.target;

    if (TEXT_TARGETS.has(target)) {
      const output =
        target === "htmlslides"
          ? renderHtmlSlides(deck, { embedFont: args["embed-font"] })
          : renderText(deck, target as TextTarget);
      if (args.out) {
        await writeFile(args.out, output);
        consola.success(`Wrote ${target} → ${args.out}`);
      } else {
        process.stdout.write(output);
      }
      return;
    }

    if (BINARY_TARGETS.has(target)) {
      if (!args.out) {
        consola.error(`--out is required for binary target "${target}"`);
        process.exitCode = 1;
        return;
      }
      const opts: RenderOptions = {
        pptx: { mermaid: args.mermaid },
        pdf: {
          mermaid: args.mermaid,
          fonts: {
            body: args["font-body"],
            heading: args["font-heading"],
            mono: args["font-mono"],
          },
        },
      };
      const buf = await renderToBuffer(deck, target as BinaryTarget, opts);
      await writeFile(args.out, buf);
      consola.success(`Wrote ${target} (${buf.length} bytes) → ${args.out}`);
      return;
    }

    consola.error(`Unknown target "${target}". Use md | html | htmlslides | pptx | pdf.`);
    process.exitCode = 1;
  },
});

const patternsCommand = defineCommand({
  meta: {
    name: "patterns",
    description: "List the available layout patterns and their slots",
  },
  run() {
    for (const pattern of supportedLayouts) {
      const slots = getLayoutTemplate(pattern).slots.map(
        (s) => `${s.id}:${s.role}`,
      );
      consola.log(`${pattern}  [${slots.join(", ")}]`);
    }
  },
});

const mcpCommand = defineCommand({
  meta: {
    name: "mcp",
    description: "Start the MCP builder server over stdio",
  },
  async run() {
    // Lazy import so the MCP SDK is only loaded for this subcommand.
    const [{ createMcpServer }, { StdioServerTransport }] = await Promise.all([
      import("../mcp/server.js"),
      import("@modelcontextprotocol/sdk/server/stdio.js"),
    ]);
    await createMcpServer().connect(new StdioServerTransport());
  },
});

export const main = defineCommand({
  meta: {
    name: "dexel",
    version: VERSION,
    description: "One structured deck definition → pptx / pdf / md / Google Doc",
  },
  subCommands: {
    render: renderCommand,
    patterns: patternsCommand,
    mcp: mcpCommand,
  },
});
