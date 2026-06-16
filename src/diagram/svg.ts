import type { DiagBox, DiagEllipse, DiagLine, DiagPolygon } from "./layout.js";
import { layoutDiagram } from "./layout.js";
import type { DiagramBlock } from "../ir/index.js";
import { bestOn, getTheme, type ThemeTokens } from "../theme/index.js";

/** Resolve a series-palette color, wrapping if there are more items than colors. */
function seriesColor(t: ThemeTokens, i: number): string {
  return t.color.series[i % t.color.series.length]!;
}

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

  let rect = "";
  let textColor = ctx.t.color.fg;
  if (!b.plain) {
    const series =
      b.seriesIndex !== undefined ? seriesColor(ctx.t, b.seriesIndex) : undefined;
    const fill = series ?? ctx.t.color.bg;
    const stroke = series ?? ctx.t.color.accent;
    if (series) textColor = bestOn(series);
    rect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  }
  return [
    rect,
    `<text x="${x + w / 2}" y="${y + h / 2}" fill="${textColor}" font-size="16" `,
    `text-anchor="middle" dominant-baseline="central">${escapeXml(b.label)}</text>`,
  ].join("");
}

function svgEllipse(e: DiagEllipse, ctx: Ctx): string {
  const color =
    e.seriesIndex !== undefined
      ? seriesColor(ctx.t, e.seriesIndex)
      : ctx.t.color.accent;
  return [
    `<ellipse cx="${e.cx * ctx.w}" cy="${e.cy * ctx.h}" `,
    `rx="${e.rx * ctx.w}" ry="${e.ry * ctx.h}" `,
    `fill="${color}" fill-opacity="${e.fillOpacity}" `,
    `stroke="${color}" stroke-width="2"/>`,
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

function svgPolygon(p: DiagPolygon, ctx: Ctx): string {
  const color =
    p.seriesIndex !== undefined
      ? seriesColor(ctx.t, p.seriesIndex)
      : ctx.t.color.accent;
  const pts = p.points
    .map(([x, y]) => `${x * ctx.w},${y * ctx.h}`)
    .join(" ");
  const poly = `<polygon points="${pts}" fill="${color}" stroke="${ctx.t.color.bg}" stroke-width="1"/>`;
  if (!p.label) return poly;
  const cx = (p.points.reduce((s, [x]) => s + x, 0) / p.points.length) * ctx.w;
  const cy = (p.points.reduce((s, [, y]) => s + y, 0) / p.points.length) * ctx.h;
  return `${poly}<text x="${cx}" y="${cy}" fill="${bestOn(color)}" font-size="16" text-anchor="middle" dominant-baseline="central">${escapeXml(p.label)}</text>`;
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
        case "polygon":
          return svgPolygon(s, ctx);
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
