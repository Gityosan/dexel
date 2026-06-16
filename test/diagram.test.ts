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

  it("routes backward / skip / self flow edges instead of dropping them", () => {
    const nodes = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ];
    const arrowed = (shapes: ReturnType<typeof layoutDiagram>) =>
      shapes.filter((s) => s.kind === "line" && s.arrow);

    // Backward edge c → a: routed as an elbow (3 segments, 1 arrowhead).
    const back = layoutDiagram(
      diagram({ pattern: "flow", nodes, edges: [{ from: "c", to: "a" }] }),
    );
    expect(back.filter((s) => s.kind === "line")).toHaveLength(3);
    expect(arrowed(back)).toHaveLength(1);

    // Skip-forward edge a → c: also routed (not a straight line through B).
    const skip = layoutDiagram(
      diagram({ pattern: "flow", nodes, edges: [{ from: "a", to: "c" }] }),
    );
    expect(skip.filter((s) => s.kind === "line")).toHaveLength(3);

    // Self edge a → a: a small loop above the box.
    const self = layoutDiagram(
      diagram({ pattern: "flow", nodes, edges: [{ from: "a", to: "a" }] }),
    );
    expect(self.filter((s) => s.kind === "line")).toHaveLength(3);
    expect(arrowed(self)).toHaveLength(1);
  });

  it("keeps adjacent flow edges as a single straight arrow", () => {
    const adjacent = layoutDiagram(
      diagram({
        pattern: "flow",
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        edges: [{ from: "a", to: "b" }],
      }),
    );
    expect(adjacent.filter((s) => s.kind === "line")).toHaveLength(1);
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

  it("colors categorical patterns from the theme series palette", () => {
    const svg = renderDiagramSvg(
      diagram({
        pattern: "funnel",
        nodes: [
          { id: "a", label: "A", value: 100 },
          { id: "b", label: "B", value: 50 },
        ],
        edges: [],
      }),
    );
    // default theme series[0]/[1].
    expect(svg).toContain('fill="#2563EB"');
    expect(svg).toContain('fill="#16A34A"');
  });

  it("renders venn as overlapping ellipses", () => {
    const svg = renderDiagramSvg(
      diagram({
        pattern: "venn",
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        edges: [],
      }),
    );
    expect((svg.match(/<ellipse /g) ?? []).length).toBe(2);
    expect(svg).toContain(">A<");
  });
});

describe("dedicated diagram layouts", () => {
  const boxesOf = (shapes: ReturnType<typeof layoutDiagram>) =>
    shapes.filter((s): s is DiagBox => s.kind === "box");

  it("funnel: continuous trapezoids whose top width tracks the value", () => {
    const shapes = layoutDiagram(
      diagram({
        pattern: "funnel",
        nodes: [
          { id: "a", label: "Leads", value: 100 },
          { id: "b", label: "Won", value: 40 },
        ],
        edges: [],
      }),
    );
    const polys = shapes.filter((s) => s.kind === "polygon");
    expect(polys).toHaveLength(2);
    // Vertical funnel: top edge of step 0 (points 0..1) is wider than step 1's.
    const topWidth = (p: (typeof polys)[number]) =>
      p.kind === "polygon" ? p.points[1]![0] - p.points[0]![0] : 0;
    expect(topWidth(polys[0]!)).toBeGreaterThan(topWidth(polys[1]!));
    // Stages are continuous: step 0's bottom edge equals step 1's top edge.
    if (polys[0]!.kind === "polygon" && polys[1]!.kind === "polygon") {
      expect(polys[0]!.points[3]![0]).toBeCloseTo(polys[1]!.points[0]![0], 5);
    }
    expect(polys[0]!.kind === "polygon" && polys[0]!.label).toContain("100");
  });

  it("funnel: horizontal orientation lays steps left-to-right", () => {
    const polys = layoutDiagram(
      diagram({
        pattern: "funnel",
        orientation: "horizontal",
        nodes: [
          { id: "a", label: "A", value: 100 },
          { id: "b", label: "B", value: 50 },
          { id: "c", label: "C", value: 20 },
        ],
        edges: [],
      }),
    ).filter((s) => s.kind === "polygon");
    expect(polys).toHaveLength(3);
    // Left x of each trapezoid increases across the steps.
    const leftX = (i: number) =>
      polys[i]!.kind === "polygon" ? polys[i]!.points[0]![0] : 0;
    expect(leftX(0)).toBeLessThan(leftX(1));
    expect(leftX(1)).toBeLessThan(leftX(2));
  });

  it("pyramid: bottom tier wider than the apex, ordered by level", () => {
    const boxes = boxesOf(
      layoutDiagram(
        diagram({
          pattern: "pyramid",
          nodes: [
            { id: "c", label: "C", level: 2 },
            { id: "a", label: "A", level: 0 },
            { id: "b", label: "B", level: 1 },
          ],
          edges: [],
        }),
      ),
    );
    expect(boxes.map((b) => b.label)).toEqual(["A", "B", "C"]);
    expect(boxes[2]!.w).toBeGreaterThan(boxes[0]!.w);
  });

  it("timeline: an axis plus one box per node", () => {
    const shapes = layoutDiagram(
      diagram({
        pattern: "timeline",
        nodes: [
          { id: "b", label: "B", date: "2026-02" },
          { id: "a", label: "A", date: "2026-01" },
        ],
        edges: [],
      }),
    );
    expect(boxesOf(shapes)).toHaveLength(2);
    expect(shapes.some((s) => s.kind === "line")).toBe(true);
    // Sorted by date: A (Jan) before B (Feb).
    expect(boxesOf(shapes)[0]!.label).toContain("A");
  });

  it("cycle: n boxes and n looping arrows", () => {
    const shapes = layoutDiagram(
      diagram({
        pattern: "cycle",
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        edges: [],
      }),
    );
    expect(boxesOf(shapes)).toHaveLength(3);
    expect(shapes.filter((s) => s.kind === "line" && s.arrow)).toHaveLength(3);
  });

  it("tree: a box per node and n-1 connectors", () => {
    const shapes = layoutDiagram(
      diagram({
        pattern: "tree",
        nodes: [
          { id: "r", label: "R" },
          { id: "a", label: "A", parent: "r" },
          { id: "b", label: "B", parent: "r" },
        ],
        edges: [],
      }),
    );
    expect(boxesOf(shapes)).toHaveLength(3);
    expect(shapes.filter((s) => s.kind === "line")).toHaveLength(2);
  });

  it("venn: ellipses plus plain (borderless) labels", () => {
    const shapes = layoutDiagram(
      diagram({
        pattern: "venn",
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        edges: [],
      }),
    );
    expect(shapes.filter((s) => s.kind === "ellipse")).toHaveLength(3);
    expect(boxesOf(shapes).filter((b) => b.plain)).toHaveLength(3);
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
