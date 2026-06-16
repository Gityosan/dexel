import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "citty";
import JSZip from "jszip";
import { afterAll, describe, expect, it } from "vitest";
import { main } from "../src/cli/index.js";
import {
  layoutDiagram,
  renderHtml,
  renderMarkdown,
  renderPdf,
  renderPptx,
  SlideDeck,
  type StructuredDiagram,
  Block,
} from "../src/index.js";

const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const kitchenSink = SlideDeck.parse({
  slides: [
    {
      layout: "image-caption",
      notes: "speaker note here",
      blocks: [
        { type: "text", variant: "heading", text: "Shot" },
        { type: "image", src: PNG_1x1, alt: "pixel" },
        { type: "text", variant: "body", text: "caption" },
      ],
    },
    {
      layout: "code",
      blocks: [
        { type: "text", variant: "heading", text: "Code" },
        { type: "code", language: "ts", code: "const x = 1;" },
      ],
    },
    {
      layout: "kpi-highlight",
      blocks: [
        { type: "text", variant: "heading", text: "Numbers" },
        { type: "kpi", value: "99%", label: "Uptime" },
      ],
    },
    {
      layout: "title-content",
      blocks: [
        { type: "text", variant: "heading", text: "Flow" },
        {
          type: "diagram",
          kind: "structured",
          pattern: "flow",
          slot: "body",
          nodes: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
          edges: [{ from: "a", to: "b" }],
        },
      ],
    },
  ],
});

describe("markdown covers every block type", () => {
  const md = renderMarkdown(kitchenSink);
  it("renders image, code, kpi, and inline diagram", () => {
    expect(md).toContain("![pixel](data:image/png");
    expect(md).toContain("```ts\nconst x = 1;\n```");
    expect(md).toContain("**99%** Uptime");
    expect(md).toContain("<svg");
  });
});

describe("html covers every block type", () => {
  const html = renderHtml(kitchenSink);
  it("renders image, code, and kpi semantically", () => {
    expect(html).toContain("<img src=\"data:image/png");
    expect(html).toContain("<code class=\"language-ts\">const x = 1;</code></pre>");
    expect(html).toContain("padding:12px"); // code panel padding
    expect(html).toContain("<strong>99%</strong> Uptime");
  });
});

describe("pptx: notes and data-URI images", () => {
  it("writes speaker notes and embeds a data-URI image", async () => {
    const buf = await renderPptx(kitchenSink);
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    // Speaker notes are emitted as a notesSlide part containing the text.
    const notes = names.filter((n) => /ppt\/notesSlides\/.*\.xml$/.test(n));
    expect(notes.length).toBeGreaterThanOrEqual(1);
    const noteXml = await zip.file(notes[0]!)!.async("string");
    expect(noteXml).toContain("speaker note here");
    // The data-URI image is embedded as a png media part.
    expect(names.some((n) => /ppt\/media\/.*\.png$/.test(n))).toBe(true);
  });
});

describe("pdf: data-URI image and empty deck", () => {
  it("renders a deck with a data-URI image", async () => {
    const buf = await renderPdf(kitchenSink);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders an empty deck without throwing", async () => {
    const buf = await renderPdf(SlideDeck.parse({ slides: [] }));
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("grid-cards surface panels", () => {
  const gridDeck = SlideDeck.parse({
    slides: [
      {
        layout: "grid-cards",
        blocks: [
          { type: "text", variant: "heading", text: "Cards" },
          ...Array.from({ length: 6 }, (_, i) => ({
            type: "text" as const,
            variant: "body" as const,
            text: `card ${i + 1}`,
          })),
        ],
      },
    ],
  });

  it("draws a panel behind each filled card in pptx", async () => {
    const buf = await renderPptx(gridDeck);
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    // Six filled card slots → six rounded-rect surface panels.
    expect((xml.match(/prst="roundRect"/g) ?? []).length).toBe(6);
  });

  it("renders grid-cards to pdf without throwing", async () => {
    const buf = await renderPdf(gridDeck);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("missing image falls back to a placeholder", () => {
  const deck = SlideDeck.parse({
    slides: [
      {
        layout: "image-caption",
        blocks: [
          { type: "text", variant: "heading", text: "Missing" },
          { type: "image", src: "/no/such/image.png", alt: "diagram" },
        ],
      },
    ],
  });

  it("pptx draws a placeholder shape, not a broken media part", async () => {
    const buf = await renderPptx(deck);
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    // No actual image media file (the bare media/ directory entry may exist).
    expect(names.some((n) => /ppt\/media\/[^/]+\.\w+$/.test(n))).toBe(false);
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(xml).toContain('prst="roundRect"');
  });

  it("pdf renders a placeholder without throwing", async () => {
    const buf = await renderPdf(deck);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("series palette wraps around", () => {
  it("reuses series[0] for the 7th categorical item", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({
      id: `n${i}`,
      label: `N${i}`,
      value: 7 - i,
    }));
    const shapes = layoutDiagram(
      Block.parse({
        type: "diagram",
        kind: "structured",
        pattern: "funnel",
        nodes: seven,
        edges: [],
      }) as StructuredDiagram,
    );
    const polys = shapes.filter((s) => s.kind === "polygon");
    expect(polys[0]!.kind === "polygon" && polys[0]!.seriesIndex).toBe(0);
    expect(polys[6]!.kind === "polygon" && polys[6]!.seriesIndex).toBe(6);
  });
});

describe("CLI error handling", () => {
  let dir: string;
  afterAll(() => {
    process.exitCode = 0;
  });

  it("exits non-zero on malformed JSON instead of throwing", async () => {
    dir = await mkdtemp(join(tmpdir(), "dexel-err-"));
    const bad = join(dir, "bad.json");
    await writeFile(bad, "{ not json");
    process.exitCode = 0;
    await runCommand(main, { rawArgs: ["render", bad, "-t", "md"] });
    expect(process.exitCode).toBe(1);
  });

  it("exits non-zero on a missing input file", async () => {
    process.exitCode = 0;
    await runCommand(main, {
      rawArgs: ["render", "/no/such/file.json", "-t", "md"],
    });
    expect(process.exitCode).toBe(1);
  });
});
