import { z } from "zod";
import { Rect } from "./primitives.js";

/**
 * The enumerated layout patterns. Coverage spans every tier; the tier only
 * encodes implementation priority. Exposed to the LLM as an enum so a pattern
 * is *selected*, never free-described.
 */
export const LayoutPattern = z.enum([
  // Tier 1 — MVP
  "title",
  "section-divider",
  "title-content",
  "two-column",
  "bullet-list",
  // Tier 2 — common business decks
  "comparison",
  "kpi-highlight",
  "image-caption",
  "quote",
  "agenda",
  "toc",
  // Tier 3 — nice to have
  "timeline",
  "process-steps",
  "content-diagram",
  "grid-cards",
  "full-bleed",
  // Technical
  "code",
  "code-explain",
]);

export type LayoutPattern = z.infer<typeof LayoutPattern>;

/** The semantic role a slot plays, used to bind blocks and to style content. */
export const SlotRole = z.enum([
  "heading",
  "subheading",
  "body",
  "image",
  "diagram",
  "kpi",
  "code",
]);

export type SlotRole = z.infer<typeof SlotRole>;

/** Vertical anchoring within a slot, used to absorb the 16:9 ⇄ 4:3 ratio gap. */
export const VAnchor = z.enum(["top", "center", "bottom"]);

export type VAnchor = z.infer<typeof VAnchor>;

/** A single positioned region within a layout template. */
export const Slot = z.object({
  id: z.string(),
  rect: Rect,
  role: SlotRole,
  vAnchor: VAnchor.default("top"),
  /** When true, renderers draw a surface panel (fill + border) behind the slot. */
  surface: z.boolean().default(false),
});

export type Slot = z.infer<typeof Slot>;

/**
 * The central asset: one pattern ⇒ one template. Fixed-canvas targets use
 * `rect`; flow targets (md / Google Doc) walk `flowOrder`. Embedding the flow
 * order in the template keeps the demotion rules out of the renderers.
 */
export const LayoutTemplate = z
  .object({
    pattern: LayoutPattern,
    slots: z.array(Slot),
    flowOrder: z.array(z.string()),
  })
  .refine(
    (t) => {
      const ids = new Set(t.slots.map((s) => s.id));
      return (
        ids.size === t.slots.length && t.flowOrder.every((id) => ids.has(id))
      );
    },
    { message: "slot ids must be unique and flowOrder may only reference them" },
  );

export type LayoutTemplate = z.infer<typeof LayoutTemplate>;
