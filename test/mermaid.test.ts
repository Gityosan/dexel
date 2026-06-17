import { describe, expect, it } from "vitest";
import { renderMermaidSvg, renderPdf, SlideDeck } from "../src/index.js";

const isPdf = (buf: Buffer) => buf.subarray(0, 5).toString("latin1") === "%PDF-";

function mermaidDeck() {
  return SlideDeck.parse({
    slides: [
      {
        layout: "title-content",
        blocks: [
          { type: "text", variant: "heading", text: "Flow" },
          {
            type: "diagram",
            kind: "mermaid",
            slot: "body",
            source: "graph TD; A-->B; B-->C;",
          },
        ],
      },
    ],
  });
}

describe("renderMermaidSvg (headless)", () => {
  it("renders mermaid source to an SVG", async () => {
    const svg = await renderMermaidSvg("graph TD; A-->B; B-->C;");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("</svg>");
    expect(svg).toContain("flowchart");
    expect(svg.length).toBeGreaterThan(1000);
  }, 30000);

  it("inlines CSS so class-styled lines keep a visible stroke", async () => {
    // svg-to-pdfkit ignores <style>; the stroke must be a presentation attribute.
    const svg = await renderMermaidSvg("sequenceDiagram\n A->>B: hi");
    const line = svg.match(/<line[^>]*class="messageLine0"[^>]*>/)?.[0] ?? "";
    expect(line).toMatch(/\sstroke="#[0-9a-fA-F]+"/);
    expect(line).not.toContain('stroke="none"');
  }, 30000);
});

describe("mermaid theme linkage", () => {
  it("tints diagrams with the deck's accent color", async () => {
    const { prerenderMermaid, SlideDeck } = await import("../src/index.js");
    const deck = SlideDeck.parse({
      theme: { color: { bg: "#FFFFFF", fg: "#101010", accent: "#FF0066" } },
      slides: [
        {
          layout: "title-content",
          blocks: [
            { type: "text", variant: "heading", text: "M" },
            { type: "diagram", kind: "mermaid", slot: "body", source: "graph TD; A-->B;" },
          ],
        },
      ],
    });
    const map = await prerenderMermaid(deck, true);
    const svg = [...map.values()][0] ?? "";
    expect(svg.toUpperCase()).toContain("FF0066"); // accent → mermaid border
  }, 30000);
});

describe("pdf mermaid embedding", () => {
  it("embeds via a custom renderer when provided", async () => {
    let called = "";
    const buf = await renderPdf(mermaidDeck(), {
      mermaid: async (src) => {
        called = src;
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
      },
    });
    expect(isPdf(buf)).toBe(true);
    expect(called).toContain("A-->B");
  });

  it("embeds the built-in mermaid render as vector (larger than text fallback)", async () => {
    const deck = mermaidDeck();
    const withMermaid = await renderPdf(deck, { mermaid: true });
    const textFallback = await renderPdf(deck);
    expect(isPdf(withMermaid)).toBe(true);
    expect(isPdf(textFallback)).toBe(true);
    expect(withMermaid.length).toBeGreaterThan(textFallback.length);
  }, 30000);
});
