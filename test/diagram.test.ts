import { describe, expect, it } from "vitest";
import {
  Block,
  type DiagBox,
  layoutDiagram,
  renderDiagramSvg,
  type StructuredDiagram,
} from "../src/index.js";

function diagram(over: Partial<StructuredDiagram>): StructuredDiagram {
  return Block.parse({
    type: "diagram",
    kind: "structured",
    pattern: "flow",
    nodes: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    edges: [{ from: "a", to: "b" }],
    ...over,
  }) as StructuredDiagram;
}

describe("renderDiagramSvg", () => {
  it("emits a well-formed svg with the node labels", () => {
    const svg = renderDiagramSvg(diagram({}));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain(">A<");
    expect(svg).toContain(">B<");
  });

  it("draws an arrow for flow edges", () => {
    expect(renderDiagramSvg(diagram({}))).toContain("marker-end=\"url(#arrow)\"");
  });

  it("lays out matrix-2x2 with axes and up to four cells", () => {
    const svg = renderDiagramSvg(
      diagram({
        pattern: "matrix-2x2",
        nodes: [
          { id: "1", label: "Q1" },
          { id: "2", label: "Q2" },
          { id: "3", label: "Q3" },
          { id: "4", label: "Q4" },
        ],
        edges: [],
      }),
    );
    expect(svg).toContain(">Q1<");
    expect(svg).toContain(">Q4<");
    expect((svg.match(/<rect /g) ?? []).length).toBe(4);
  });

  it("escapes XML-significant characters in labels", () => {
    const svg = renderDiagramSvg(
      diagram({
        pattern: "pyramid",
        nodes: [{ id: "a", label: "<A & B>" }],
        edges: [],
      }),
    );
    expect(svg).toContain("&lt;A &amp; B&gt;");
    expect(svg).not.toContain("<A & B>");
  });

  it("honors a custom size", () => {
    const svg = renderDiagramSvg(diagram({}), { width: 400, height: 200 });
    expect(svg).toContain('viewBox="0 0 400 200"');
  });
});

describe("layoutDiagram (shared geometry)", () => {
  it("lays flow nodes as boxes with arrows, all within the unit area", () => {
    const shapes = layoutDiagram(diagram({}));
    const boxes = shapes.filter((s) => s.kind === "box");
    const lines = shapes.filter((s) => s.kind === "line");
    expect(boxes).toHaveLength(2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ arrow: true });
    for (const b of boxes as DiagBox[]) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(1);
      expect(b.y + b.h).toBeLessThanOrEqual(1);
    }
  });

  it("lays matrix-2x2 as two axis lines (no arrows) plus four cells", () => {
    const shapes = layoutDiagram(
      diagram({
        pattern: "matrix-2x2",
        nodes: [
          { id: "1", label: "Q1" },
          { id: "2", label: "Q2" },
          { id: "3", label: "Q3" },
          { id: "4", label: "Q4" },
        ],
        edges: [],
      }),
    );
    expect(shapes.filter((s) => s.kind === "box")).toHaveLength(4);
    const lines = shapes.filter((s) => s.kind === "line");
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.kind === "line" && !l.arrow)).toBe(true);
  });
});
