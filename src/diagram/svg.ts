import type { DiagBox, DiagEllipse, DiagLine } from "./layout.js";
import { layoutDiagram } from "./layout.js";
import type { DiagramBlock } from "../ir/index.js";
import { getTheme, type ThemeTokens } from "../theme/index.js";

/** The structured (node/edge) variant of a diagram block. */
export type StructuredDiagram = Extract<DiagramBlock, { kind: "structured" }>;

export interface SvgOptions {
  width?: number;
  height?: number;
  theme?: ThemeTokens;
}

function escapeXml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
}

interface Ctx {
  w: number;
  h: number;
  t: ThemeTokens;
}

function svgBox(b: DiagBox, ctx: Ctx): string {
  const x = b.x * ctx.w;
  const y = b.y * ctx.h;
  const w = b.w * ctx.w;
  const h = b.h * ctx.h;
  const rect = b.plain
    ? ""
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${ctx.t.color.bg}" stroke="${ctx.t.color.accent}" stroke-width="2"/>`;
  return [
    rect,
    `<text x="${x + w / 2}" y="${y + h / 2}" fill="${ctx.t.color.fg}" font-size="16" `,
    `text-anchor="middle" dominant-baseline="central">${escapeXml(b.label)}</text>`,
  ].join("");
}

function svgEllipse(e: DiagEllipse, ctx: Ctx): string {
  return [
    `<ellipse cx="${e.cx * ctx.w}" cy="${e.cy * ctx.h}" `,
    `rx="${e.rx * ctx.w}" ry="${e.ry * ctx.h}" `,
    `fill="${ctx.t.color.accent}" fill-opacity="${e.fillOpacity}" `,
    `stroke="${ctx.t.color.accent}" stroke-width="2"/>`,
  ].join("");
}

function svgLine(l: DiagLine, ctx: Ctx): string {
  const marker = l.arrow ? ' marker-end="url(#arrow)"' : "";
  return [
    `<line x1="${l.x1 * ctx.w}" y1="${l.y1 * ctx.h}" `,
    `x2="${l.x2 * ctx.w}" y2="${l.y2 * ctx.h}" `,
    `stroke="${ctx.t.color.muted}" stroke-width="2"${marker}/>`,
  ].join("");
}

const ARROW_MARKER =
  '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 Z" fill="currentColor"/></marker></defs>';

/**
 * Render a structured diagram to a standalone SVG string — the shared diagram
 * axis. pptx converts the same layout to native shapes; pdf embeds this SVG; md
 * inlines it.
 */
export function renderDiagramSvg(
  d: StructuredDiagram,
  opts?: SvgOptions,
): string {
  const t = opts?.theme ?? getTheme("default");
  const ctx: Ctx = { w: opts?.width ?? 800, h: opts?.height ?? 450, t };

  const body = layoutDiagram(d)
    .map((s) => {
      switch (s.kind) {
        case "box":
          return svgBox(s, ctx);
        case "line":
          return svgLine(s, ctx);
        case "ellipse":
          return svgEllipse(s, ctx);
      }
    })
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ctx.w} ${ctx.h}" `,
    `width="${ctx.w}" height="${ctx.h}" color="${t.color.muted}">`,
    ARROW_MARKER,
    body,
    "</svg>",
  ].join("");
}
