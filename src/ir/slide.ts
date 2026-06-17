import { z } from "zod";
import { Block } from "./blocks.js";
import { LayoutPattern, LayoutTemplate } from "./layout.js";

/**
 * A single slide: a chosen layout plus the blocks that fill its slots. `layout`
 * is a built-in pattern name, or a full inline `LayoutTemplate` for a custom slot
 * arrangement. The IR is slide-oriented; flow targets are produced by an explicit
 * demotion driven by the template's `flowOrder`.
 */
export const Slide = z.object({
  layout: z.union([LayoutPattern, LayoutTemplate]),
  blocks: z.array(Block),
  notes: z.string().optional(),
});

export type Slide = z.infer<typeof Slide>;
