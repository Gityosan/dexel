import { describe, expect, it } from "vitest";
import { createDeck, DeckSession } from "../src/index.js";

describe("DeckSession", () => {
  it("creates a deck with defaults and an empty summary", () => {
    const s = createDeck();
    const summary = s.summary();
    expect(summary.theme).toBe("default");
    expect(summary.aspect).toBe("16:9");
    expect(summary.sectionCount).toBe(0);
    expect(summary.availableLayouts).toContain("title");
  });

  it("echoes a refreshed summary (incl. pattern hints) on every addSection", () => {
    const s = createDeck({ theme: "corporate", aspect: "4:3" });
    const summary = s.addSection("title", [
      { type: "text", variant: "heading", text: "T" },
    ]);
    expect(summary.theme).toBe("corporate");
    expect(summary.sectionCount).toBe(1);
    expect(summary.sections[0]).toMatchObject({ index: 0, layout: "title" });
    // Context-degradation mitigation: hints are always present.
    const titleHint = summary.layoutHints.find((h) => h.pattern === "title");
    expect(titleHint?.slots.map((sl) => sl.id)).toContain("subtitle");
  });

  it("reports overflow blocks in the summary", () => {
    const s = createDeck();
    const summary = s.addSection("section-divider", [
      { type: "text", variant: "heading", text: "One" },
      { type: "text", variant: "body", text: "extra" },
    ]);
    expect(summary.sections[0]!.overflow).toBe(1);
  });

  it("rejects invalid layouts and blocks", () => {
    const s = createDeck();
    expect(() =>
      // @ts-expect-error invalid layout pattern
      s.addSection("nope", []),
    ).toThrow();
    expect(() =>
      s.addSection("title", [
        // @ts-expect-error invalid block type
        { type: "bogus", text: "x" },
      ]),
    ).toThrow();
  });

  it("renders through the session", () => {
    const s = createDeck();
    s.addSection("title", [{ type: "text", variant: "heading", text: "Hi" }]);
    expect(s.render("md")).toContain("# Hi");
    expect(s.render("html")).toContain("<h1>Hi</h1>");
  });

  it("round-trips via JSON export/import for stateless reproduction", () => {
    const s = createDeck({ theme: "dark" });
    s.addSection("bullet-list", [
      { type: "text", variant: "heading", text: "Agenda" },
      { type: "list", items: [{ text: "a" }] },
    ]);
    const json = s.toJSON();
    const restored = DeckSession.fromJSON(json);
    expect(restored.summary().theme).toBe("dark");
    expect(restored.summary().sectionCount).toBe(1);
    expect(restored.render("md")).toBe(s.render("md"));
  });
});
