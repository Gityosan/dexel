import { LayoutTemplate, type LayoutPattern } from "../ir/index.js";

/** Parse-validate a template literal at module load so registry data can't drift. */
const define = (t: unknown): LayoutTemplate => LayoutTemplate.parse(t);

const M = 0.08; // standard horizontal margin (normalized)

/**
 * Tier-1 layout templates — coordinates filled in normalized 0–1 units against a
 * 16:9 design grid. The 4:3 ratio gap is absorbed at render time via each slot's
 * `vAnchor`; the coordinates themselves are shared across every fixed-canvas
 * target.
 */
export const layoutTemplates: Partial<Record<LayoutPattern, LayoutTemplate>> = {
  title: define({
    pattern: "title",
    slots: [
      {
        id: "title",
        role: "heading",
        rect: { x: 0.1, y: 0.36, w: 0.8, h: 0.18 },
        vAnchor: "center",
      },
      {
        id: "subtitle",
        role: "subheading",
        rect: { x: 0.1, y: 0.55, w: 0.8, h: 0.1 },
        vAnchor: "top",
      },
      {
        id: "meta",
        role: "body",
        rect: { x: 0.1, y: 0.84, w: 0.8, h: 0.08 },
        vAnchor: "bottom",
      },
    ],
    flowOrder: ["title", "subtitle", "meta"],
  }),

  "section-divider": define({
    pattern: "section-divider",
    slots: [
      {
        id: "heading",
        role: "heading",
        rect: { x: 0.1, y: 0.4, w: 0.8, h: 0.2 },
        vAnchor: "center",
      },
    ],
    flowOrder: ["heading"],
  }),

  "title-content": define({
    pattern: "title-content",
    slots: [
      {
        id: "heading",
        role: "heading",
        rect: { x: M, y: 0.08, w: 1 - 2 * M, h: 0.14 },
        vAnchor: "top",
      },
      {
        id: "body",
        role: "body",
        rect: { x: M, y: 0.26, w: 1 - 2 * M, h: 0.66 },
        vAnchor: "top",
      },
    ],
    flowOrder: ["heading", "body"],
  }),

  "two-column": define({
    pattern: "two-column",
    slots: [
      {
        id: "heading",
        role: "heading",
        rect: { x: M, y: 0.08, w: 1 - 2 * M, h: 0.14 },
        vAnchor: "top",
      },
      {
        id: "left",
        role: "body",
        rect: { x: M, y: 0.26, w: 0.42, h: 0.66 },
        vAnchor: "top",
      },
      {
        id: "right",
        role: "body",
        rect: { x: 0.5, y: 0.26, w: 0.42, h: 0.66 },
        vAnchor: "top",
      },
    ],
    flowOrder: ["heading", "left", "right"],
  }),

  "bullet-list": define({
    pattern: "bullet-list",
    slots: [
      {
        id: "heading",
        role: "heading",
        rect: { x: M, y: 0.08, w: 1 - 2 * M, h: 0.14 },
        vAnchor: "top",
      },
      {
        id: "lead",
        role: "body",
        rect: { x: M, y: 0.24, w: 1 - 2 * M, h: 0.1 },
        vAnchor: "top",
      },
      {
        id: "bullets",
        role: "body",
        rect: { x: M, y: 0.36, w: 1 - 2 * M, h: 0.56 },
        vAnchor: "top",
      },
    ],
    flowOrder: ["heading", "lead", "bullets"],
  }),
};

/** Layout patterns that currently have a concrete template (Tier-1). */
export const supportedLayouts = Object.keys(layoutTemplates) as LayoutPattern[];

/** Look up a template, throwing a clear error for patterns not yet implemented. */
export function getLayoutTemplate(pattern: LayoutPattern): LayoutTemplate {
  const tpl = layoutTemplates[pattern];
  if (!tpl) {
    throw new Error(
      `No layout template for pattern "${pattern}". Supported: ${supportedLayouts.join(", ")}`,
    );
  }
  return tpl;
}
