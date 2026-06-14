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
 * A node in a structured diagram. The precise required fields differ per
 * pattern (see spec §未決事項); kept intentionally generic until per-pattern
 * schemas are pinned down.
 */
export const DiagramNode = z.object({
  id: z.string(),
  label: z.string(),
  group: z.string().optional(),
});

export type DiagramNode = z.infer<typeof DiagramNode>;

/** A directed connection between two diagram nodes. */
export const DiagramEdge = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});

export type DiagramEdge = z.infer<typeof DiagramEdge>;
