import { z } from "zod";

/**
 * A coordinate or size expressed in normalized canvas units (0–1).
 *
 * The IR keeps all geometry normalized so a single coordinate template can be
 * shared across the fixed-canvas renderers (pptx → EMU, pdf → pt).
 */
export const Normalized = z.number().min(0).max(1);

const WITHIN_CANVAS = 1 + 1e-6;

/**
 * A rectangle in normalized canvas coordinates (0–1), origin at the top-left.
 * Constrained to stay within the unit canvas.
 */
export const Rect = z
  .object({
    x: Normalized,
    y: Normalized,
    w: Normalized,
    h: Normalized,
  })
  .refine((r) => r.x + r.w <= WITHIN_CANVAS && r.y + r.h <= WITHIN_CANVAS, {
    message: "rect must stay within the normalized canvas (x+w ≤ 1, y+h ≤ 1)",
  });

export type Rect = z.infer<typeof Rect>;
