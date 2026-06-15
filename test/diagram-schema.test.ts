import { describe, expect, it } from "vitest";
import { Block, structuredDiagramIssues } from "../src/index.js";

function parse(diagram: Record<string, unknown>) {
  return Block.safeParse({
    type: "diagram",
    kind: "structured",
    ...diagram,
  });
}

describe("structured diagram validation", () => {
  it("rejects edges that reference unknown nodes", () => {
    const result = parse({
      pattern: "flow",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      edges: [{ from: "a", to: "ghost" }],
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues.some((i) => /ghost/.test(i.message))).toBe(true);
  });

  it("rejects duplicate node ids", () => {
    const issues = structuredDiagramIssues({
      pattern: "flow",
      nodes: [
        { id: "a", label: "A" },
        { id: "a", label: "A2" },
      ],
      edges: [],
    });
    expect(issues.some((m) => /duplicate node id/.test(m))).toBe(true);
  });

  it("enforces cardinality per pattern", () => {
    expect(parse({ pattern: "flow", nodes: [{ id: "a", label: "A" }], edges: [] }).success).toBe(
      false,
    );
    expect(
      parse({
        pattern: "venn",
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
          { id: "d", label: "D" },
        ],
        edges: [],
      }).success,
    ).toBe(false);
    expect(
      parse({
        pattern: "matrix-2x2",
        nodes: Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, label: `N${i}` })),
        edges: [],
      }).success,
    ).toBe(false);
  });

  it("requires funnel values and timeline dates", () => {
    expect(
      parse({
        pattern: "funnel",
        nodes: [
          { id: "a", label: "Leads", value: 100 },
          { id: "b", label: "Signups" },
        ],
        edges: [],
      }).success,
    ).toBe(false);
    expect(
      parse({
        pattern: "funnel",
        nodes: [
          { id: "a", label: "Leads", value: 100 },
          { id: "b", label: "Signups", value: 40 },
        ],
        edges: [],
      }).success,
    ).toBe(true);
    expect(
      parse({
        pattern: "timeline",
        nodes: [{ id: "a", label: "Kickoff" }],
        edges: [],
      }).success,
    ).toBe(false);
    expect(
      parse({
        pattern: "timeline",
        nodes: [{ id: "a", label: "Kickoff", date: "2026-Q1" }],
        edges: [],
      }).success,
    ).toBe(true);
  });

  it("validates tree structure (single root, no cycles)", () => {
    // Valid tree via parent fields.
    expect(
      structuredDiagramIssues({
        pattern: "tree",
        nodes: [
          { id: "root", label: "Root" },
          { id: "a", label: "A", parent: "root" },
          { id: "b", label: "B", parent: "root" },
        ],
        edges: [],
      }),
    ).toEqual([]);

    // Cycle: every node has a parent → no root.
    const cyclic = structuredDiagramIssues({
      pattern: "tree",
      nodes: [
        { id: "a", label: "A", parent: "b" },
        { id: "b", label: "B", parent: "a" },
      ],
      edges: [],
    });
    expect(cyclic.some((m) => /exactly one root/.test(m))).toBe(true);

    // Two disconnected roots.
    const forest = structuredDiagramIssues({
      pattern: "org-tree",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      edges: [],
    });
    expect(forest.some((m) => /one root|connected/.test(m))).toBe(true);
  });
});
