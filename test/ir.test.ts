import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  Block,
  LayoutTemplate,
  Rect,
  SlideDeck,
  type SlideDeck as SlideDeckType,
} from "../src/index.js";

describe("SlideDeck", () => {
  it("parses a minimal deck and applies defaults", () => {
    const parsed = SlideDeck.parse({
      slides: [
        {
          layout: "title",
          blocks: [{ type: "text", text: "Hello" }],
        },
      ],
    });

    expect(parsed.theme).toBe("default");
    expect(parsed.aspect).toBe("16:9");
    expect(parsed.slides[0]!.blocks[0]).toMatchObject({
      type: "text",
      variant: "body",
    });
  });

  it("round-trips deck metadata and a chosen theme/aspect", () => {
    const deck: SlideDeckType = SlideDeck.parse({
      theme: "dark",
      aspect: "4:3",
      meta: { title: "Q3 Review", author: "Ada", date: "2026-06-14" },
      slides: [],
    });

    expect(deck.theme).toBe("dark");
    expect(deck.aspect).toBe("4:3");
    expect(deck.meta?.title).toBe("Q3 Review");
  });

  it("rejects an unknown layout pattern", () => {
    const result = SlideDeck.safeParse({
      slides: [{ layout: "carousel", blocks: [] }],
    });
    expect(result.success).toBe(false);
  });
});

describe("Block discriminated union", () => {
  it("accepts every block type", () => {
    const blocks = [
      { type: "text", variant: "heading", text: "Title" },
      { type: "list", items: [{ text: "a" }, { text: "b", level: 1 }] },
      { type: "code", language: "ts", code: "const x = 1;" },
      { type: "image", src: "./shot.png", alt: "screenshot" },
      { type: "kpi", value: "98%", label: "Uptime" },
    ];
    for (const block of blocks) {
      expect(Block.safeParse(block).success).toBe(true);
    }
  });

  it("discriminates structured vs mermaid diagrams on `kind`", () => {
    const structured = Block.parse({
      type: "diagram",
      kind: "structured",
      pattern: "flow",
      nodes: [
        { id: "a", label: "Start" },
        { id: "b", label: "End" },
      ],
      edges: [{ from: "a", to: "b" }],
    });
    expect(structured).toMatchObject({ kind: "structured", pattern: "flow" });

    const mermaid = Block.parse({
      type: "diagram",
      kind: "mermaid",
      source: "sequenceDiagram\n A->>B: hi",
    });
    expect(mermaid).toMatchObject({ kind: "mermaid" });
  });

  it("rejects a structured diagram missing nodes", () => {
    const result = Block.safeParse({
      type: "diagram",
      kind: "structured",
      pattern: "flow",
      edges: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("Rect", () => {
  it("rejects rectangles that leave the unit canvas", () => {
    expect(Rect.safeParse({ x: 0.8, y: 0, w: 0.5, h: 0.2 }).success).toBe(false);
    expect(Rect.safeParse({ x: -0.1, y: 0, w: 0.2, h: 0.2 }).success).toBe(
      false,
    );
  });

  it("accepts any in-bounds rectangle (property)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (x, y, w, h) => {
          fc.pre(x + w <= 1 && y + h <= 1);
          expect(Rect.safeParse({ x, y, w, h }).success).toBe(true);
        },
      ),
    );
  });
});

describe("LayoutTemplate", () => {
  it("accepts a template whose flowOrder references its slots", () => {
    const tpl = LayoutTemplate.parse({
      pattern: "title-content",
      slots: [
        {
          id: "heading",
          role: "heading",
          rect: { x: 0.08, y: 0.1, w: 0.84, h: 0.15 },
        },
        {
          id: "body",
          role: "body",
          rect: { x: 0.08, y: 0.3, w: 0.84, h: 0.6 },
        },
      ],
      flowOrder: ["heading", "body"],
    });
    expect(tpl.slots[0]!.vAnchor).toBe("top");
  });

  it("rejects a flowOrder referencing an unknown slot", () => {
    const result = LayoutTemplate.safeParse({
      pattern: "title-content",
      slots: [
        { id: "heading", role: "heading", rect: { x: 0, y: 0, w: 1, h: 0.2 } },
      ],
      flowOrder: ["heading", "ghost"],
    });
    expect(result.success).toBe(false);
  });
});
