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
