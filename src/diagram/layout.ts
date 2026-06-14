import type { StructuredDiagram } from "./svg.js";

/** A laid-out box, in normalized 0–1 coordinates relative to the diagram area. */
export interface DiagBox {
  kind: "box";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

/** A laid-out connector/axis line, in normalized 0–1 coordinates. */
export interface DiagLine {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  arrow: boolean;
}

export type DiagShape = DiagBox | DiagLine;

function flow(d: StructuredDiagram): DiagShape[] {
  const padX = 0.03;
  const gap = 0.04;
  const n = Math.max(1, d.nodes.length);
  const bw = (1 - 2 * padX - (n - 1) * gap) / n;
  const bh = 0.42;
  const y = (1 - bh) / 2;
  const xOf = (i: number) => padX + i * (bw + gap);

  const boxes: DiagShape[] = d.nodes.map((node, i) => ({
    kind: "box",
    x: xOf(i),
    y,
    w: bw,
    h: bh,
    label: node.label,
  }));

  const indexOf = new Map(d.nodes.map((node, i) => [node.id, i]));
  const pairs = d.edges.length
    ? d.edges.map((e) => [indexOf.get(e.from), indexOf.get(e.to)] as const)
    : d.nodes.slice(1).map((_, i) => [i, i + 1] as const);
  const arrows: DiagShape[] = pairs
    .filter(([a, b]) => a !== undefined && b !== undefined && a < b!)
    .map(([a, b]) => ({
      kind: "line",
      x1: xOf(a!) + bw,
      y1: y + bh / 2,
      x2: xOf(b!),
      y2: y + bh / 2,
      arrow: true,
    }));

  return [...arrows, ...boxes];
}

function matrix2x2(d: StructuredDiagram): DiagShape[] {
  const pad = 0.03;
  const x0 = pad;
  const y0 = pad;
  const w = 1 - 2 * pad;
  const h = 1 - 2 * pad;
  const midX = x0 + w / 2;
  const midY = y0 + h / 2;
  const inset = 0.02;

  const axes: DiagShape[] = [
    { kind: "line", x1: midX, y1: y0, x2: midX, y2: y0 + h, arrow: false },
    { kind: "line", x1: x0, y1: midY, x2: x0 + w, y2: midY, arrow: false },
  ];
  const quads = [
    { x: x0, y: y0 },
    { x: midX, y: y0 },
    { x: x0, y: midY },
    { x: midX, y: midY },
  ];
  const cells: DiagShape[] = d.nodes.slice(0, 4).map((node, i) => {
    const q = quads[i]!;
    return {
      kind: "box",
      x: q.x + inset,
      y: q.y + inset,
      w: w / 2 - 2 * inset,
      h: h / 2 - 2 * inset,
      label: node.label,
    };
  });
  return [...axes, ...cells];
}

function stack(d: StructuredDiagram): DiagShape[] {
  const pad = 0.04;
  const n = Math.max(1, d.nodes.length);
  const gap = 0.03;
  const bh = Math.min(0.18, (1 - 2 * pad - (n - 1) * gap) / n);
  return d.nodes.map((node, i) => ({
    kind: "box",
    x: pad,
    y: pad + i * (bh + gap),
    w: 1 - 2 * pad,
    h: bh,
    label: node.label,
  }));
}

/**
 * Lay out a structured diagram into primitive boxes and lines in normalized
 * 0–1 coordinates. This is the single source of truth for diagram geometry; the
 * SVG renderer and the native pptx-shape renderer both consume it.
 */
export function layoutDiagram(d: StructuredDiagram): DiagShape[] {
  switch (d.pattern) {
    case "flow":
      return flow(d);
    case "matrix-2x2":
      return matrix2x2(d);
    default:
      return stack(d);
  }
}
