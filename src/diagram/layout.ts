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
  /** Index into the theme's categorical `series` palette (categorical patterns). */
  seriesIndex?: number;
  /** Explicit color override (theme token name or raw color). */
  color?: string;
  /** An icon (image data URI / path, or a glyph) drawn at the box's left. */
  icon?: string;
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
  /** Index into the theme's categorical `series` palette. */
  seriesIndex?: number;
  /** Explicit color override (theme token name or raw color). */
  color?: string;
}

export type DiagShape = DiagBox | DiagLine | DiagEllipse | DiagPolygon;

/** A filled polygon (e.g. a funnel trapezoid), in normalized 0–1 coordinates. */
export interface DiagPolygon {
  kind: "polygon";
  points: Array<[number, number]>;
  label?: string;
  seriesIndex?: number;
  /** Explicit color override (theme token name or raw color). */
  color?: string;
}

const box = (
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  opts: { plain?: boolean; series?: number; color?: string; icon?: string } = {},
): DiagBox => ({
  kind: "box",
  x,
  y,
  w,
  h,
  label,
  ...(opts.plain ? { plain: true } : {}),
  ...(opts.series !== undefined ? { seriesIndex: opts.series } : {}),
  ...(opts.color ? { color: opts.color } : {}),
  ...(opts.icon ? { icon: opts.icon } : {}),
});

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
  series?: number,
  color?: string,
): DiagEllipse => ({
  kind: "ellipse",
  cx,
  cy,
  rx,
  ry,
  fillOpacity,
  ...(series !== undefined ? { seriesIndex: series } : {}),
  ...(color ? { color } : {}),
});

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

  const midY = y + bh / 2;
  const laneBelow = Math.min(0.97, y + bh + 0.08);
  const laneAbove = Math.max(0.03, y - 0.08);

  const boxes: DiagShape[] = d.nodes.map((node, i) =>
    box(xOf(i), y, bw, bh, node.label, { color: node.color, icon: node.icon }),
  );

  const indexOf = new Map(d.nodes.map((node, i) => [node.id, i]));
  const pairs = d.edges.length
    ? d.edges.map((e) => [indexOf.get(e.from), indexOf.get(e.to)] as const)
    : d.nodes.slice(1).map((_, i) => [i, i + 1] as const);

  // Every valid edge is drawn: adjacent steps as a straight arrow, and skip /
  // backward / self edges routed as an elbow so none are silently dropped.
  const arrows: DiagShape[] = [];
  for (const [a, b] of pairs) {
    if (a === undefined || b === undefined) continue;
    if (b === a + 1) {
      arrows.push(line(xOf(a) + bw, midY, xOf(b), midY, true));
    } else if (a === b) {
      const x1 = xOf(a) + bw * 0.35;
      const x2 = xOf(a) + bw * 0.65;
      arrows.push(line(x1, y, x1, laneAbove, false));
      arrows.push(line(x1, laneAbove, x2, laneAbove, false));
      arrows.push(line(x2, laneAbove, x2, y, true));
    } else {
      const sx = xOf(a) + bw / 2;
      const tx = xOf(b) + bw / 2;
      arrows.push(line(sx, y + bh, sx, laneBelow, false));
      arrows.push(line(sx, laneBelow, tx, laneBelow, false));
      arrows.push(line(tx, laneBelow, tx, y + bh, true));
    }
  }

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
    return box(q.x + inset, q.y + inset, w / 2 - 2 * inset, h / 2 - 2 * inset, node.label, { series: i, color: node.color, icon: node.icon });
  });
  return [...axes, ...cells];
}

/**
 * A funnel: each stage is a trapezoid whose top edge matches its own value and
 * whose bottom edge matches the next stage's value, so the stages form one
 * continuous narrowing shape (no gaps, no separate connectors). `orientation:
 * "horizontal"` runs the funnel left-to-right with height-by-value instead.
 */
function funnel(d: StructuredDiagram): DiagShape[] {
  const horizontal = d.orientation === "horizontal";
  const n = Math.max(1, d.nodes.length);
  const values = d.nodes.map((nd) => nd.value ?? 1);
  const maxV = Math.max(...values, 1);
  const min = 0.16;
  const max = 1 - 2 * PAD;
  const labels = d.nodes.map((nd) =>
    nd.value !== undefined ? `${nd.label} (${nd.value})` : nd.label,
  );
  const sizeAt = (i: number) => min + (max - min) * (values[i]! / maxV);

  return d.nodes.map((node, i) => {
    const a = sizeAt(i);
    const b = i < n - 1 ? sizeAt(i + 1) : a; // last stage: flat bottom/right
    let points: Array<[number, number]>;
    if (horizontal) {
      const stageW = (1 - 2 * PAD) / n;
      const x0 = PAD + i * stageW;
      const x1 = x0 + stageW;
      points = [
        [x0, 0.5 - a / 2],
        [x1, 0.5 - b / 2],
        [x1, 0.5 + b / 2],
        [x0, 0.5 + a / 2],
      ];
    } else {
      const stageH = (1 - 2 * PAD) / n;
      const y0 = PAD + i * stageH;
      const y1 = y0 + stageH;
      points = [
        [0.5 - a / 2, y0],
        [0.5 + a / 2, y0],
        [0.5 + b / 2, y1],
        [0.5 - b / 2, y1],
      ];
    }
    return {
      kind: "polygon",
      points,
      label: labels[i]!,
      seriesIndex: i,
      ...(node.color ? { color: node.color } : {}),
    };
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
    return box((1 - w) / 2, y, w, rowH, nd.label, { series: i, color: nd.color, icon: nd.icon });
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
    shapes.push(box(x, by, bw, bh, label, { color: nd.color, icon: nd.icon }));
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
    shapes.push(box(p.x - bw / 2, p.y - bh / 2, bw, bh, nd.label, { series: i, color: nd.color, icon: nd.icon }));
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
    if (b) shapes.push(box(b.x, b.y, b.w, b.h, nd.label, { color: nd.color, icon: nd.icon }));
  }
  return shapes;
}

function venn(d: StructuredDiagram): DiagShape[] {
  const op = 0.25;
  const shapes: DiagShape[] = [];
  if (d.nodes.length <= 2) {
    // Two overlapping lobes filling the box; labels sit in the outer lobes.
    const circles = [
      { cx: 0.37, cy: 0.5 },
      { cx: 0.63, cy: 0.5 },
    ];
    const labels = [
      { x: 0.04, y: 0.43 },
      { x: 0.72, y: 0.43 },
    ];
    d.nodes.slice(0, 2).forEach((nd, i) => {
      shapes.push(ellipse(circles[i]!.cx, circles[i]!.cy, 0.32, 0.36, op, i, nd.color));
      shapes.push(box(labels[i]!.x, labels[i]!.y, 0.24, 0.14, nd.label, { plain: true }));
    });
  } else {
    // Three circles in a triangle, filling the box; labels in the outer lobes.
    const circles = [
      { cx: 0.5, cy: 0.33 },
      { cx: 0.33, cy: 0.64 },
      { cx: 0.67, cy: 0.64 },
    ];
    const labels = [
      { x: 0.38, y: 0.03 },
      { x: 0.05, y: 0.82 },
      { x: 0.71, y: 0.82 },
    ];
    d.nodes.slice(0, 3).forEach((nd, i) => {
      shapes.push(ellipse(circles[i]!.cx, circles[i]!.cy, 0.3, 0.3, op, i, nd.color));
      shapes.push(box(labels[i]!.x, labels[i]!.y, 0.24, 0.14, nd.label, { plain: true }));
    });
  }
  return shapes;
}

function stack(d: StructuredDiagram): DiagShape[] {
  const n = Math.max(1, d.nodes.length);
  const gap = 0.03;
  const bh = Math.min(0.18, (1 - 2 * PAD - (n - 1) * gap) / n);
  return d.nodes.map((node, i) =>
    box(PAD, PAD + i * (bh + gap), 1 - 2 * PAD, bh, node.label, { color: node.color, icon: node.icon }),
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
