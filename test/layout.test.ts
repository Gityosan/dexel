import { describe, expect, it } from "vitest";
import {
  getLayoutTemplate,
  resolveSlide,
  Slide,
  supportedLayouts,
} from "../src/index.js";

describe("layout templates", () => {
  it("provides all five Tier-1 patterns", () => {
    expect(new Set(supportedLayouts)).toEqual(
      new Set([
        "title",
        "section-divider",
        "title-content",
        "two-column",
        "bullet-list",
      ]),
    );
  });

  it("throws a helpful error for an unimplemented pattern", () => {
    expect(() => getLayoutTemplate("comparison")).toThrow(/not yet|Supported/i);
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
