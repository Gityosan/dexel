import type { StructuredDiagram } from "./svg.js";

/** A laid-out box, in normalized 0–1 coordinates relative to the diagram area. */
export interface DiagBox {
  kind: "box";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** When true, render the label only (no rectangle) — used for venn labels. */
  plain?: boolean;
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

/** A laid-out ellipse (venn circles), in normalized 0–1 coordinates. */
export interface DiagEllipse {
  kind: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Fill opacity 0–1 so overlaps remain visible. */
  fillOpacity: number;
}

export type DiagShape = DiagBox | DiagLine | DiagEllipse;

const box = (
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  plain = false,
): DiagBox => ({ kind: "box", x, y, w, h, label, ...(plain ? { plain } : {}) });

const line = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  arrow: boolean,
): DiagLine => ({ kind: "line", x1, y1, x2, y2, arrow });

const ellipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fillOpacity: number,
): DiagEllipse => ({ kind: "ellipse", cx, cy, rx, ry, fillOpacity });

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

const PAD = 0.06;

function flow(d: StructuredDiagram): DiagShape[] {
  const padX = 0.03;
  const gap = 0.04;
  const n = Math.max(1, d.nodes.length);
  const bw = (1 - 2 * padX - (n - 1) * gap) / n;
  const bh = 0.42;
  const y = (1 - bh) / 2;
  const xOf = (i: number) => padX + i * (bw + gap);

  const boxes: DiagShape[] = d.nodes.map((node, i) =>
    box(xOf(i), y, bw, bh, node.label),
  );

  const indexOf = new Map(d.nodes.map((node, i) => [node.id, i]));
  const pairs = d.edges.length
    ? d.edges.map((e) => [indexOf.get(e.from), indexOf.get(e.to)] as const)
    : d.nodes.slice(1).map((_, i) => [i, i + 1] as const);
  const arrows: DiagShape[] = pairs
    .filter(([a, b]) => a !== undefined && b !== undefined && a < b!)
    .map(([a, b]) => line(xOf(a!) + bw, y + bh / 2, xOf(b!), y + bh / 2, true));

  return [...arrows, ...boxes];
}

function matrix2x2(d: StructuredDiagram): DiagShape[] {
  const x0 = PAD;
  const y0 = PAD;
  const w = 1 - 2 * PAD;
  const h = 1 - 2 * PAD;
  const midX = x0 + w / 2;
  const midY = y0 + h / 2;
  const inset = 0.02;

  const axes: DiagShape[] = [
    line(midX, y0, midX, y0 + h, false),
    line(x0, midY, x0 + w, midY, false),
  ];
  const quads = [
    { x: x0, y: y0 },
    { x: midX, y: y0 },
    { x: x0, y: midY },
    { x: midX, y: midY },
  ];
  const cells: DiagShape[] = d.nodes.slice(0, 4).map((node, i) => {
    const q = quads[i]!;
    return box(q.x + inset, q.y + inset, w / 2 - 2 * inset, h / 2 - 2 * inset, node.label);
  });
  return [...axes, ...cells];
}

function funnel(d: StructuredDiagram): DiagShape[] {
  const gap = 0.02;
  const n = Math.max(1, d.nodes.length);
  const rowH = (1 - 2 * PAD - (n - 1) * gap) / n;
  const values = d.nodes.map((nd) => nd.value ?? 1);
  const maxV = Math.max(...values, 1);
  const wMin = 0.25;
  const wMax = 1 - 2 * PAD;
  return d.nodes.map((nd, i) => {
    const w = wMin + (wMax - wMin) * (values[i]! / maxV);
    const y = PAD + i * (rowH + gap);
    const label = nd.value !== undefined ? `${nd.label} (${nd.value})` : nd.label;
    return box((1 - w) / 2, y, w, rowH, label);
  });
}

function pyramid(d: StructuredDiagram): DiagShape[] {
  const gap = 0.02;
  const nodes = [...d.nodes];
  if (nodes.every((nd) => nd.level !== undefined)) {
    nodes.sort((a, b) => a.level! - b.level!);
  }
  const n = Math.max(1, nodes.length);
  const rowH = (1 - 2 * PAD - (n - 1) * gap) / n;
  const wMin = 0.2;
  const wMax = 1 - 2 * PAD;
  return nodes.map((nd, i) => {
    const w = n === 1 ? wMax : wMin + (wMax - wMin) * (i / (n - 1));
    const y = PAD + i * (rowH + gap);
    return box((1 - w) / 2, y, w, rowH, nd.label);
  });
}

function timeline(d: StructuredDiagram): DiagShape[] {
  const nodes = [...d.nodes];
  if (nodes.every((nd) => nd.date !== undefined)) {
    nodes.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }
  const n = Math.max(1, nodes.length);
  const axisY = 0.5;
  const bw = Math.min(0.22, (1 - 2 * PAD) / n - 0.02);
  const bh = 0.22;
  const shapes: DiagShape[] = [line(PAD, axisY, 1 - PAD, axisY, false)];
  nodes.forEach((nd, i) => {
    const cx = n === 1 ? 0.5 : PAD + (i / (n - 1)) * (1 - 2 * PAD);
    const above = i % 2 === 0;
    const by = above ? axisY - 0.06 - bh : axisY + 0.06;
    const x = clamp(cx - bw / 2, 0, 1 - bw);
    shapes.push(line(cx, axisY, cx, above ? by + bh : by, false));
    const label = nd.date !== undefined ? `${nd.date}\n${nd.label}` : nd.label;
    shapes.push(box(x, by, bw, bh, label));
  });
  return shapes;
}

function cycle(d: StructuredDiagram): DiagShape[] {
  const n = Math.max(1, d.nodes.length);
  const cx = 0.5;
  const cy = 0.5;
  const r = 0.34;
  const bw = 0.22;
  const bh = 0.14;
  const pts = d.nodes.map((_, i) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
  });
  const shapes: DiagShape[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    shapes.push(line(a.x, a.y, b.x, b.y, true));
  }
  d.nodes.forEach((nd, i) => {
    const p = pts[i]!;
    shapes.push(box(p.x - bw / 2, p.y - bh / 2, bw, bh, nd.label));
  });
  return shapes;
}

function tree(d: StructuredDiagram): DiagShape[] {
  const children = new Map<string, string[]>();
  const parentOf = new Map<string, string>();
  const link = (parent: string, child: string) => {
    parentOf.set(child, parent);
    const a = children.get(parent);
    if (a) a.push(child);
    else children.set(parent, [child]);
  };
  for (const nd of d.nodes) if (nd.parent !== undefined) link(nd.parent, nd.id);
  for (const e of d.edges) link(e.from, e.to);

  // Assign nodes to depth levels via BFS from the roots.
  const levels: string[][] = [];
  const seen = new Set<string>();
  let frontier = d.nodes.filter((nd) => !parentOf.has(nd.id)).map((nd) => nd.id);
  while (frontier.length) {
    levels.push(frontier);
    frontier.forEach((id) => seen.add(id));
    const next: string[] = [];
    for (const id of frontier) {
      for (const c of children.get(id) ?? []) if (!seen.has(c)) next.push(c);
    }
    frontier = next;
  }

  const depthCount = Math.max(1, levels.length);
  const rowH = Math.min(0.18, (1 - 2 * PAD) / depthCount - 0.04);
  const rowGap =
    depthCount > 1 ? (1 - 2 * PAD - rowH * depthCount) / (depthCount - 1) : 0;
  const pos = new Map<string, DiagBox>();
  levels.forEach((ids, depth) => {
    const m = ids.length;
    const bw = Math.min(0.24, (1 - 2 * PAD) / m - 0.02);
    const y = PAD + depth * (rowH + rowGap);
    ids.forEach((id, i) => {
      const cx = m === 1 ? 0.5 : PAD + (i / (m - 1)) * (1 - 2 * PAD);
      pos.set(id, box(clamp(cx - bw / 2, 0, 1 - bw), y, bw, rowH, ""));
    });
  });

  const shapes: DiagShape[] = [];
  for (const [child, parent] of parentOf) {
    const p = pos.get(parent);
    const c = pos.get(child);
    if (p && c) shapes.push(line(p.x + p.w / 2, p.y + p.h, c.x + c.w / 2, c.y, false));
  }
  for (const nd of d.nodes) {
    const b = pos.get(nd.id);
    if (b) shapes.push(box(b.x, b.y, b.w, b.h, nd.label));
  }
  return shapes;
}

function venn(d: StructuredDiagram): DiagShape[] {
  const op = 0.25;
  const shapes: DiagShape[] = [];
  if (d.nodes.length <= 2) {
    const circles = [
      { cx: 0.4, cy: 0.5 },
      { cx: 0.6, cy: 0.5 },
    ];
    const labels = [
      { x: 0.08, y: 0.42 },
      { x: 0.72, y: 0.42 },
    ];
    d.nodes.slice(0, 2).forEach((nd, i) => {
      shapes.push(ellipse(circles[i]!.cx, circles[i]!.cy, 0.27, 0.27, op));
      shapes.push(box(labels[i]!.x, labels[i]!.y, 0.2, 0.16, nd.label, true));
    });
  } else {
    const circles = [
      { cx: 0.5, cy: 0.36 },
      { cx: 0.37, cy: 0.62 },
      { cx: 0.63, cy: 0.62 },
    ];
    const labels = [
      { x: 0.4, y: 0.08 },
      { x: 0.1, y: 0.72 },
      { x: 0.7, y: 0.72 },
    ];
    d.nodes.slice(0, 3).forEach((nd, i) => {
      shapes.push(ellipse(circles[i]!.cx, circles[i]!.cy, 0.25, 0.25, op));
      shapes.push(box(labels[i]!.x, labels[i]!.y, 0.2, 0.14, nd.label, true));
    });
  }
  return shapes;
}

function stack(d: StructuredDiagram): DiagShape[] {
  const n = Math.max(1, d.nodes.length);
  const gap = 0.03;
  const bh = Math.min(0.18, (1 - 2 * PAD - (n - 1) * gap) / n);
  return d.nodes.map((node, i) =>
    box(PAD, PAD + i * (bh + gap), 1 - 2 * PAD, bh, node.label),
  );
}

/**
 * Lay out a structured diagram into primitive boxes, lines, and ellipses in
 * normalized 0–1 coordinates. The single source of truth for diagram geometry,
 * consumed by both the SVG renderer and the native pptx-shape renderer.
 */
export function layoutDiagram(d: StructuredDiagram): DiagShape[] {
  switch (d.pattern) {
    case "flow":
      return flow(d);
    case "matrix-2x2":
      return matrix2x2(d);
    case "funnel":
      return funnel(d);
    case "pyramid":
      return pyramid(d);
    case "timeline":
      return timeline(d);
    case "cycle":
      return cycle(d);
    case "tree":
    case "org-tree":
      return tree(d);
    case "venn":
      return venn(d);
    default:
      return stack(d);
  }
}
