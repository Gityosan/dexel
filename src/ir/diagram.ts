import { z } from "zod";

/**
 * Structured-schema diagrams: authored as nodes/edges and rendered to native
 * pptx shapes or shared SVG.
 */
export const StructuredDiagramPattern = z.enum([
  "flow",
  "cycle",
  "pyramid",
  "matrix-2x2",
  "funnel",
  "org-tree",
  "timeline",
  "venn",
  "tree",
]);

export type StructuredDiagramPattern = z.infer<typeof StructuredDiagramPattern>;

/**
 * Mermaid-string diagrams: authored as mermaid source and rendered to SVG
 * (pptx embeds a rasterized image instead of native shapes).
 */
export const MermaidDiagramPattern = z.enum(["sequence", "state", "er", "arch"]);

export type MermaidDiagramPattern = z.infer<typeof MermaidDiagramPattern>;

/**
 * A node in a structured diagram. Most fields are optional and only meaningful
 * for certain patterns (see `structuredDiagramIssues` for the per-pattern
 * requirements): `value` for funnel stages, `level` for pyramid tiers, `date`
 * for timeline points, `parent` for tree / org-tree hierarchy.
 */
export const DiagramNode = z.object({
  id: z.string(),
  label: z.string(),
  group: z.string().optional(),
  value: z.number().optional(),
  level: z.number().int().min(0).optional(),
  date: z.string().optional(),
  parent: z.string().optional(),
  /** Override color: a theme token name (accent/series/…) or a raw hex. */
  color: z.string().optional(),
});

export type DiagramNode = z.infer<typeof DiagramNode>;

/** A directed connection between two diagram nodes. */
export const DiagramEdge = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});

export type DiagramEdge = z.infer<typeof DiagramEdge>;

interface StructuredDiagramShape {
  pattern: StructuredDiagramPattern;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** Validate the tree/org-tree hierarchy (parent fields and/or from→to edges). */
function treeIssues(d: StructuredDiagramShape, ids: Set<string>): string[] {
  const issues: string[] = [];
  const n = d.nodes.length;
  if (n === 0) return ["tree requires at least 1 node"];

  const parentCount = new Map<string, number>(d.nodes.map((node) => [node.id, 0]));
  const bump = (child: string) =>
    parentCount.set(child, (parentCount.get(child) ?? 0) + 1);
  for (const node of d.nodes) {
    if (node.parent !== undefined && ids.has(node.parent)) bump(node.id);
  }
  for (const e of d.edges) {
    if (ids.has(e.to)) bump(e.to); // from → to is parent → child
  }

  let links = 0;
  let roots = 0;
  for (const node of d.nodes) {
    const count = parentCount.get(node.id) ?? 0;
    links += count;
    if (count === 0) roots += 1;
    if (count > 1) issues.push(`tree node "${node.id}" has multiple parents`);
  }
  if (roots !== 1) issues.push(`tree must have exactly one root (found ${roots})`);
  if (links !== n - 1) {
    issues.push(
      `tree must form a connected hierarchy (expected ${n - 1} parent links, found ${links})`,
    );
  }
  return issues;
}

/**
 * The concrete, per-pattern requirements for a structured diagram — the open
 * question from the design spec made explicit. Returns human-readable problems
 * (empty array = valid); attached to the IR via a refinement, and reusable for
 * external validation.
 */
export function structuredDiagramIssues(d: StructuredDiagramShape): string[] {
  const issues: string[] = [];

  // Referential integrity (all patterns).
  const ids = new Set<string>();
  for (const node of d.nodes) {
    if (ids.has(node.id)) issues.push(`duplicate node id "${node.id}"`);
    ids.add(node.id);
  }
  for (const e of d.edges) {
    if (!ids.has(e.from)) issues.push(`edge.from "${e.from}" is not a node id`);
    if (!ids.has(e.to)) issues.push(`edge.to "${e.to}" is not a node id`);
  }
  for (const node of d.nodes) {
    if (node.parent === undefined) continue;
    if (node.parent === node.id) {
      issues.push(`node "${node.id}" cannot be its own parent`);
    } else if (!ids.has(node.parent)) {
      issues.push(`node "${node.id}" parent "${node.parent}" is not a node id`);
    }
  }

  // Per-pattern cardinality and required fields.
  const n = d.nodes.length;
  switch (d.pattern) {
    case "matrix-2x2":
      if (n < 1 || n > 4) issues.push("matrix-2x2 requires 1–4 nodes");
      break;
    case "venn":
      if (n < 2 || n > 3) issues.push("venn requires 2–3 nodes");
      break;
    case "flow":
    case "cycle":
      if (n < 2) issues.push(`${d.pattern} requires at least 2 nodes`);
      break;
    case "funnel":
      if (n < 2) issues.push("funnel requires at least 2 nodes");
      for (const node of d.nodes) {
        if (node.value === undefined) {
          issues.push(`funnel node "${node.id}" requires a numeric value`);
        }
      }
      break;
    case "timeline":
      if (n < 1) issues.push("timeline requires at least 1 node");
      for (const node of d.nodes) {
        if (node.date === undefined) {
          issues.push(`timeline node "${node.id}" requires a date`);
        }
      }
      break;
    case "pyramid":
      if (n < 1) issues.push("pyramid requires at least 1 node");
      break;
    case "tree":
    case "org-tree":
      issues.push(...treeIssues(d, ids));
      break;
  }

  return issues;
}
