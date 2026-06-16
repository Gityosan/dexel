import type { Aspect } from "../ir/index.js";

export interface Size {
  w: number;
  h: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Canvas size in PostScript points for a given aspect ratio, matching the
 * PowerPoint conventions the pptx renderer uses (height fixed at 540pt).
 */
export function canvasPt(aspect: Aspect): Size {
  return aspect === "4:3" ? { w: 720, h: 540 } : { w: 960, h: 540 };
}

/** Resolve a normalized (0–1) rect onto an absolute canvas. */
export function placeRect(rect: Box, canvas: Size): Box {
  return {
    x: rect.x * canvas.w,
    y: rect.y * canvas.h,
    w: rect.w * canvas.w,
    h: rect.h * canvas.h,
  };
}

/** Shrink a rect on all sides by `pad` (same units as the rect). */
export function insetRect(box: Box, pad: number): Box {
  return {
    x: box.x + pad,
    y: box.y + pad,
    w: Math.max(0, box.w - 2 * pad),
    h: Math.max(0, box.h - 2 * pad),
  };
}
