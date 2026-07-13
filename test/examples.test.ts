import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LayoutPattern,
  MermaidDiagramPattern,
  render,
  renderToBuffer,
  SlideDeck,
  StructuredDiagramPattern,
} from "../src/index.js";

const read = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), "utf8");

describe("examples/sample-deck.json", () => {
  const deck = SlideDeck.parse(JSON.parse(read("../examples/sample-deck.json")));

  it("is a valid deck", () => {
    expect(deck.slides.length).toBeGreaterThan(10);
  });

  it("renders to every text target", () => {
    expect(render(deck, "md")).toContain("# dexel デモ");
    expect(render(deck, "html")).toContain("<h1>dexel デモ</h1>");
  });

  it("renders to every binary target", async () => {
    const pptx = await renderToBuffer(deck, "pptx");
    expect(pptx.subarray(0, 2).toString("latin1")).toBe("PK");
    const pdf = await renderToBuffer(deck, "pdf");
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("documentation stays in sync with the code", () => {
  it("documents every layout pattern", () => {
    const doc = read("../docs/layouts.md");
    for (const pattern of LayoutPattern.options) {
      expect(doc, `layouts.md is missing "${pattern}"`).toContain(`\`${pattern}\``);
    }
  });

  it("documents every diagram pattern", () => {
    const doc = read("../docs/diagrams.md");
    for (const pattern of [
      ...StructuredDiagramPattern.options,
      ...MermaidDiagramPattern.options,
    ]) {
      expect(doc, `diagrams.md is missing "${pattern}"`).toContain(
        `\`${pattern}\``,
      );
    }
  });
});
