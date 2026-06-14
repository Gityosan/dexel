import { z } from "zod";
import { Block } from "./blocks.js";
import { LayoutPattern } from "./layout.js";

/**
 * A single slide: a chosen layout pattern plus the blocks that fill its slots.
 * The IR is slide-oriented and fixed; flow targets are produced by an explicit
 * demotion driven by the template's `flowOrder`.
 */
export const Slide = z.object({
  layout: LayoutPattern,
  blocks: z.array(Block),
  notes: z.string().optional(),
});

export type Slide = z.infer<typeof Slide>;
