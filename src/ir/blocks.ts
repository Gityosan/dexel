import { z } from "zod";
import {
  DiagramEdge,
  DiagramNode,
  MermaidDiagramPattern,
  StructuredDiagramPattern,
  structuredDiagramIssues,
} from "./diagram.js";

/**
 * Optional explicit binding to a layout slot id. When omitted, the layout
 * engine assigns the block to a slot by role and document order.
 */
const slot = z.string().optional();

/** Heading / subheading / body / paragraph text. */
/** An inline run of text with optional formatting (for rich text). */
export const TextRun = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  /** Text color: a theme token name (accent/muted/…) or a raw hex. */
  color: z.string().optional(),
  /** Marker/highlight background: a token name or raw hex. */
  highlight: z.string().optional(),
});
export type TextRun = z.infer<typeof TextRun>;

export const TextBlock = z.object({
  type: z.literal("text"),
  slot,
  variant: z
    .enum(["heading", "subheading", "body", "paragraph"])
    .default("body"),
  /** Plain string, or rich inline runs (bold/italic/color/highlight). */
  text: z.union([z.string(), z.array(TextRun)]),
  /** Override color: a theme token name (accent/muted/fg/…) or a raw hex. */
  color: z.string().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

/** Normalize a text block's `text` to runs. */
export function textRuns(text: string | TextRun[]): TextRun[] {
  return typeof text === "string" ? [{ text }] : text;
}

/** The plain concatenated string of a text block's `text`. */
export function plainText(text: string | TextRun[]): string {
  return typeof text === "string" ? text : text.map((r) => r.text).join("");
}

export type TextBlock = z.infer<typeof TextBlock>;

/** A (possibly nested) bullet or numbered list. */
export const ListBlock = z.object({
  type: z.literal("list"),
  slot,
  ordered: z.boolean().default(false),
  items: z.array(
    z.object({
      text: z.string(),
      level: z.number().int().min(0).default(0),
    }),
  ),
});

export type ListBlock = z.infer<typeof ListBlock>;

/** Monospaced code with optional language for syntax highlighting. */
export const CodeBlock = z.object({
  type: z.literal("code"),
  slot,
  language: z.string().optional(),
  /** Optional filename shown as a tab above the code panel. */
  filename: z.string().optional(),
  code: z.string(),
  showLineNumbers: z.boolean().default(false),
});

export type CodeBlock = z.infer<typeof CodeBlock>;

/**
 * A figure, in one of two input systems: a structured node/edge schema or raw
 * mermaid source. Discriminated on `kind`.
 */
const StructuredDiagramBlock = z
  .object({
    type: z.literal("diagram"),
    kind: z.literal("structured"),
    slot,
    pattern: StructuredDiagramPattern,
    /** Layout direction for orientation-aware patterns (e.g. funnel). */
    orientation: z.enum(["horizontal", "vertical"]).optional(),
    nodes: z.array(DiagramNode),
    edges: z.array(DiagramEdge),
  })
  .superRefine((d, ctx) => {
    for (const message of structuredDiagramIssues(d)) {
      ctx.addIssue({ code: "custom", message });
    }
  });

export const DiagramBlock = z.discriminatedUnion("kind", [
  StructuredDiagramBlock,
  z.object({
    type: z.literal("diagram"),
    kind: z.literal("mermaid"),
    slot,
    pattern: MermaidDiagramPattern.optional(),
    source: z.string(),
  }),
]);

export type DiagramBlock = z.infer<typeof DiagramBlock>;

/** A raster/vector image referenced by path, URL, or data URI. */
export const ImageBlock = z.object({
  type: z.literal("image"),
  slot,
  src: z.string(),
  alt: z.string().optional(),
  fit: z.enum(["contain", "cover"]).default("contain"),
});

export type ImageBlock = z.infer<typeof ImageBlock>;

/** A large highlighted number with a label and optional caption. */
export const KpiBlock = z.object({
  type: z.literal("kpi"),
  slot,
  value: z.string(),
  label: z.string(),
  caption: z.string().optional(),
});

export type KpiBlock = z.infer<typeof KpiBlock>;

/** The content that fills a slot. Discriminated on `type`. */
export const Block = z.discriminatedUnion("type", [
  TextBlock,
  ListBlock,
  CodeBlock,
  DiagramBlock,
  ImageBlock,
  KpiBlock,
]);

export type Block = z.infer<typeof Block>;

/** Block as accepted *before* schema defaults are applied (for authoring APIs). */
export type BlockInput = z.input<typeof Block>;
