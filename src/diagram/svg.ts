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

function box(
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  ctx: Ctx,
): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" `,
    `fill="${ctx.t.color.bg}" stroke="${ctx.t.color.accent}" stroke-width="2"/>`,
    `<text x="${cx}" y="${cy}" fill="${ctx.t.color.fg}" font-size="16" `,
    `text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text>`,
  ].join("");
}

function flow(d: StructuredDiagram, ctx: Ctx): string {
  const pad = 16;
  const gap = 28;
  const n = Math.max(1, d.nodes.length);
  const bw = (ctx.w - 2 * pad - (n - 1) * gap) / n;
  const bh = Math.min(80, ctx.h - 2 * pad);
  const y = (ctx.h - bh) / 2;
  const xOf = (i: number) => pad + i * (bw + gap);

  const boxes = d.nodes.map((node, i) =>
    box(xOf(i), y, bw, bh, node.label, ctx),
  );

  // Arrows: explicit edges if present, otherwise sequential.
  const indexOf = new Map(d.nodes.map((node, i) => [node.id, i]));
  const pairs = d.edges.length
    ? d.edges.map((e) => [indexOf.get(e.from), indexOf.get(e.to)] as const)
    : d.nodes.slice(1).map((_, i) => [i, i + 1] as const);
  const arrows = pairs
    .filter(([a, b]) => a !== undefined && b !== undefined && a < b!)
    .map(([a, b]) => {
      const x1 = xOf(a!) + bw;
      const x2 = xOf(b!);
      return `<line x1="${x1}" y1="${y + bh / 2}" x2="${x2}" y2="${y + bh / 2}" stroke="${ctx.t.color.muted}" stroke-width="2" marker-end="url(#arrow)"/>`;
    });

  return [...arrows, ...boxes].join("");
}

function matrix2x2(d: StructuredDiagram, ctx: Ctx): string {
  const pad = 16;
  const x0 = pad;
  const y0 = pad;
  const w = ctx.w - 2 * pad;
  const h = ctx.h - 2 * pad;
  const midX = x0 + w / 2;
  const midY = y0 + h / 2;
  const axes = [
    `<line x1="${midX}" y1="${y0}" x2="${midX}" y2="${y0 + h}" stroke="${ctx.t.color.muted}" stroke-width="2"/>`,
    `<line x1="${x0}" y1="${midY}" x2="${x0 + w}" y2="${midY}" stroke="${ctx.t.color.muted}" stroke-width="2"/>`,
  ];
  const quads = [
    { x: x0, y: y0 },
    { x: midX, y: y0 },
    { x: x0, y: midY },
    { x: midX, y: midY },
  ];
  const cells = d.nodes.slice(0, 4).map((node, i) => {
    const q = quads[i]!;
    return box(q.x + 8, q.y + 8, w / 2 - 16, h / 2 - 16, node.label, ctx);
  });
  return [...axes, ...cells].join("");
}

/** Generic fallback: a labeled vertical stack of nodes (keeps text, no layout). */
function stack(d: StructuredDiagram, ctx: Ctx): string {
  const pad = 16;
  const n = Math.max(1, d.nodes.length);
  const gap = 12;
  const bh = Math.min(56, (ctx.h - 2 * pad - (n - 1) * gap) / n);
  return d.nodes
    .map((node, i) =>
      box(pad, pad + i * (bh + gap), ctx.w - 2 * pad, bh, node.label, ctx),
    )
    .join("");
}

const ARROW_MARKER =
  '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 Z" fill="currentColor"/></marker></defs>';

/**
 * Render a structured diagram to a standalone SVG string — the single shared
 * diagram axis. pptx converts these to native shapes (follow-up); pdf embeds the
 * SVG; md inlines it.
 */
export function renderDiagramSvg(d: StructuredDiagram, opts?: SvgOptions): string {
  const t = opts?.theme ?? getTheme("default");
  const ctx: Ctx = { w: opts?.width ?? 800, h: opts?.height ?? 450, t };

  let body: string;
  switch (d.pattern) {
    case "flow":
      body = flow(d, ctx);
      break;
    case "matrix-2x2":
      body = matrix2x2(d, ctx);
      break;
    default:
      body = stack(d, ctx);
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ctx.w} ${ctx.h}" `,
    `width="${ctx.w}" height="${ctx.h}" color="${t.color.muted}">`,
    ARROW_MARKER,
    body,
    "</svg>",
  ].join("");
}
