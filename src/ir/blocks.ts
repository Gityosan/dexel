import { z } from "zod";
import {
  DiagramEdge,
  DiagramNode,
  MermaidDiagramPattern,
  StructuredDiagramPattern,
} from "./diagram.js";

/**
 * Optional explicit binding to a layout slot id. When omitted, the layout
 * engine assigns the block to a slot by role and document order.
 */
const slot = z.string().optional();

/** Heading / subheading / body / paragraph text. */
export const TextBlock = z.object({
  type: z.literal("text"),
  slot,
  variant: z
    .enum(["heading", "subheading", "body", "paragraph"])
    .default("body"),
  text: z.string(),
});

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
  code: z.string(),
  showLineNumbers: z.boolean().default(false),
});

export type CodeBlock = z.infer<typeof CodeBlock>;

/**
 * A figure, in one of two input systems: a structured node/edge schema or raw
 * mermaid source. Discriminated on `kind`.
 */
export const DiagramBlock = z.discriminatedUnion("kind", [
  z.object({
    type: z.literal("diagram"),
    kind: z.literal("structured"),
    slot,
    pattern: StructuredDiagramPattern,
    nodes: z.array(DiagramNode),
    edges: z.array(DiagramEdge),
  }),
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
