import { describe, expect, it } from "vitest";
import {
  getLayoutTemplate,
  LayoutPattern,
  resolveSlide,
  Slide,
  supportedLayouts,
} from "../src/index.js";

describe("layout templates", () => {
  it("provides all five Tier-1 patterns", () => {
    for (const p of [
      "title",
      "section-divider",
      "title-content",
      "two-column",
      "bullet-list",
    ] as const) {
      expect(supportedLayouts).toContain(p);
    }
  });

  it("now has a template for every LayoutPattern in the IR", () => {
    for (const pattern of LayoutPattern.options) {
      expect(supportedLayouts).toContain(pattern);
      expect(() => getLayoutTemplate(pattern)).not.toThrow();
    }
  });

  it("throws a helpful error for an unknown pattern", () => {
    expect(() =>
      getLayoutTemplate("nope" as (typeof LayoutPattern.options)[number]),
    ).toThrow(/Supported/i);
  });

  it("resolves Tier-3 grid-cards, full-bleed, and code-explain", () => {
    const grid = resolveSlide(
      Slide.parse({
        layout: "grid-cards",
        blocks: [
          { type: "text", variant: "heading", text: "Cards" },
          { type: "text", variant: "body", text: "1" },
          { type: "text", variant: "body", text: "2" },
          { type: "text", variant: "body", text: "3" },
        ],
      }),
    );
    expect(grid.placements.map((p) => p.slot.id)).toEqual([
      "heading",
      "c1",
      "c2",
      "c3",
    ]);

    // full-bleed draws the image first (background) then the heading overlay.
    const bleed = resolveSlide(
      Slide.parse({
        layout: "full-bleed",
        blocks: [
          { type: "text", variant: "heading", text: "Overlay" },
          { type: "image", src: "bg.png" },
        ],
      }),
    );
    expect(bleed.placements.map((p) => p.slot.id)).toEqual(["image", "heading"]);

    const codeExplain = resolveSlide(
      Slide.parse({
        layout: "code-explain",
        blocks: [
          { type: "text", variant: "heading", text: "Snippet" },
          { type: "code", language: "ts", code: "const x = 1;" },
          { type: "text", variant: "body", text: "explanation" },
        ],
      }),
    );
    expect(codeExplain.placements.map((p) => p.slot.id)).toEqual([
      "heading",
      "code",
      "explain",
    ]);
  });

  it("resolves Tier-2 comparison and kpi-highlight layouts", () => {
    const cmp = resolveSlide(
      Slide.parse({
        layout: "comparison",
        blocks: [
          { type: "text", variant: "heading", text: "A vs B" },
          { type: "text", variant: "subheading", text: "Plan A" },
          { type: "text", variant: "body", text: "details A" },
          { type: "text", variant: "subheading", text: "Plan B" },
          { type: "text", variant: "body", text: "details B" },
        ],
      }),
    );
    expect(cmp.placements.map((p) => p.slot.id)).toEqual([
      "heading",
      "leftTitle",
      "left",
      "rightTitle",
      "right",
    ]);

    const kpi = resolveSlide(
      Slide.parse({
        layout: "kpi-highlight",
        blocks: [
          { type: "text", variant: "heading", text: "Numbers" },
          { type: "kpi", value: "99%", label: "Uptime" },
          { type: "kpi", value: "12ms", label: "p50" },
        ],
      }),
    );
    expect(kpi.placements.map((p) => p.slot.id)).toEqual([
      "heading",
      "kpi1",
      "kpi2",
    ]);
    expect(kpi.overflow).toHaveLength(0);
  });
});

describe("resolveSlide", () => {
  it("auto-assigns blocks to role-compatible slots in flowOrder", () => {
    const slide = Slide.parse({
      layout: "title-content",
      blocks: [
        { type: "text", variant: "heading", text: "Heading" },
        { type: "list", items: [{ text: "point" }] },
      ],
    });
    const resolved = resolveSlide(slide);
    expect(resolved.placements.map((p) => p.slot.id)).toEqual([
      "heading",
      "body",
    ]);
    expect(resolved.overflow).toHaveLength(0);
  });

  it("respects flowOrder even when blocks are authored out of order", () => {
    const slide = Slide.parse({
      layout: "title-content",
      blocks: [
        { type: "text", variant: "body", text: "body first" },
        { type: "text", variant: "heading", text: "heading second" },
      ],
    });
    const resolved = resolveSlide(slide);
    expect(resolved.placements.map((p) => p.slot.id)).toEqual([
      "heading",
      "body",
    ]);
  });

  it("honors an explicit slot binding", () => {
    const slide = Slide.parse({
      layout: "two-column",
      blocks: [
        { type: "text", variant: "heading", text: "H" },
        { type: "text", variant: "body", slot: "right", text: "R" },
        { type: "text", variant: "body", text: "L" },
      ],
    });
    const resolved = resolveSlide(slide);
    const byId = Object.fromEntries(
      resolved.placements.map((p) => [p.slot.id, p.block]),
    );
    expect(byId.right).toMatchObject({ text: "R" });
    expect(byId.left).toMatchObject({ text: "L" });
  });

  it("places heading + body + diagram together (mixed content)", () => {
    const resolved = resolveSlide(
      Slide.parse({
        layout: "content-diagram",
        blocks: [
          { type: "text", variant: "heading", text: "H" },
          { type: "text", variant: "body", text: "lead" },
          {
            type: "diagram",
            kind: "structured",
            pattern: "flow",
            nodes: [
              { id: "a", label: "A" },
              { id: "b", label: "B" },
            ],
            edges: [{ from: "a", to: "b" }],
          },
        ],
      }),
    );
    expect(resolved.placements.map((p) => p.slot.id)).toEqual([
      "heading",
      "body",
      "diagram",
    ]);
    expect(resolved.overflow).toHaveLength(0);
  });

  it("accepts a caption alongside a diagram in process-steps / timeline", () => {
    for (const [layout, diagramSlot, pattern] of [
      ["process-steps", "steps", "flow"],
      ["timeline", "timeline", "timeline"],
    ] as const) {
      const resolved = resolveSlide(
        Slide.parse({
          layout,
          blocks: [
            { type: "text", variant: "heading", text: "H" },
            {
              type: "diagram",
              kind: "structured",
              pattern,
              slot: diagramSlot,
              nodes: [
                { id: "a", label: "A", date: "2026-01" },
                { id: "b", label: "B", date: "2026-02" },
              ],
              edges: [],
            },
            { type: "text", variant: "body", text: "caption" },
          ],
        }),
      );
      expect(resolved.overflow).toHaveLength(0);
      expect(resolved.placements.map((p) => p.slot.id)).toContain("caption");
    }
  });

  it("reports blocks that do not fit as overflow", () => {
    const slide = Slide.parse({
      layout: "section-divider",
      blocks: [
        { type: "text", variant: "heading", text: "One" },
        { type: "text", variant: "body", text: "extra" },
      ],
    });
    const resolved = resolveSlide(slide);
    expect(resolved.placements).toHaveLength(1);
    expect(resolved.overflow).toHaveLength(1);
    expect(resolved.overflow[0]).toMatchObject({ text: "extra" });
  });
});
