import { existsSync } from "node:fs";
import pptxgen from "pptxgenjs";
import type { Block, SlideDeck } from "../ir/index.js";

// Under NodeNext the default-import *type* of pptxgenjs resolves to the module
// namespace, while the runtime value is the constructor. Bridge that gap with a
// typed constructor alias derived from the package's own `default` export.
type PptxCtor = (typeof pptxgen)["default"];
type PptxInstance = InstanceType<PptxCtor>;
type PptxSlide = ReturnType<PptxInstance["addSlide"]>;
const Pptx = pptxgen as unknown as PptxCtor;
import {
  layoutDiagram,
  type MermaidOption,
  prerenderMermaid,
} from "../diagram/index.js";
import {
  type HighlightedCode,
  lookupHighlight,
  prehighlightDeck,
} from "./highlight.js";
import { insetRect } from "./geometry.js";
import { resolveDeck } from "../layout/index.js";
import {
  bareHex,
  bestOn,
  resolveDeckTheme,
  themeColor,
  type ThemeTokens,
} from "../theme/index.js";

/** Resolve a series-palette color (bare hex), wrapping past the palette length. */
function seriesHex(t: ThemeTokens, i: number): string {
  return bareHex(t.color.series[i % t.color.series.length]!);
}

/** Node fill (bare hex): explicit color > series palette > undefined. */
function nodeHex(
  t: ThemeTokens,
  color: string | undefined,
  seriesIndex: number | undefined,
): string | undefined {
  if (color) return bareHex(themeColor(t, color, t.color.accent));
  if (seriesIndex !== undefined) return seriesHex(t, seriesIndex);
  return undefined;
}

type Pct = `${number}%`;
type Pos = { x: Pct; y: Pct; w: Pct; h: Pct };
type VAlign = "top" | "middle" | "bottom";
type PptxShapes = PptxInstance["ShapeType"];
// `custGeom` is a valid runtime shape name but is missing from the typings.
const CUST_GEOM = "custGeom" as Parameters<PptxSlide["addShape"]>[0];
type Rect = { x: number; y: number; w: number; h: number };

const pct = (n: number): Pct => `${n * 100}%`;

const valignOf = (a: "top" | "center" | "bottom"): VAlign =>
  a === "center" ? "middle" : a;

/** Normalized rect → pptxgenjs percentage-string position (canvas-size agnostic). */
function pos(rect: { x: number; y: number; w: number; h: number }): Pos {
  return {
    x: `${rect.x * 100}%`,
    y: `${rect.y * 100}%`,
    w: `${rect.w * 100}%`,
    h: `${rect.h * 100}%`,
  };
}

type StructuredDiagram = Extract<Block, { type: "diagram"; kind: "structured" }>;

/**
 * Draw a structured diagram as native PowerPoint shapes (rounded-rect text
 * boxes, connector lines, and ellipses for venn), using the shared diagram
 * layout. Diagram-local normalized coordinates are mapped into the slot's
 * normalized rect, then to percentages.
 */
function drawStructuredDiagram(
  slide: PptxSlide,
  block: StructuredDiagram,
  rect: Rect,
  t: ThemeTokens,
  shapes: PptxShapes,
  canvasIn: { w: number; h: number },
): void {
  for (const s of layoutDiagram(block)) {
    if (s.kind === "box") {
      const series = nodeHex(t, s.color, s.seriesIndex);
      slide.addText(s.label, {
        x: pct(rect.x + s.x * rect.w),
        y: pct(rect.y + s.y * rect.h),
        w: pct(s.w * rect.w),
        h: pct(s.h * rect.h),
        ...(s.plain
          ? {}
          : {
              shape: shapes.roundRect,
              fill: { color: series ?? bareHex(t.color.bg) },
              line: { color: series ?? bareHex(t.color.accent), width: 1.5 },
            }),
        color: series ? bareHex(bestOn(`#${series}`)) : bareHex(t.color.fg),
        align: "center",
        valign: "middle",
        fontSize: 14,
        fontFace: t.font.body,
      });
    } else if (s.kind === "ellipse") {
      const color = nodeHex(t, s.color, s.seriesIndex) ?? bareHex(t.color.accent);
      slide.addShape(shapes.ellipse, {
        x: pct(rect.x + (s.cx - s.rx) * rect.w),
        y: pct(rect.y + (s.cy - s.ry) * rect.h),
        w: pct(2 * s.rx * rect.w),
        h: pct(2 * s.ry * rect.h),
        fill: {
          color,
          transparency: Math.round((1 - s.fillOpacity) * 100),
        },
        line: { color, width: 1.5 },
      });
    } else if (s.kind === "line") {
      slide.addShape(shapes.line, {
        x: pct(rect.x + s.x1 * rect.w),
        y: pct(rect.y + s.y1 * rect.h),
        w: pct((s.x2 - s.x1) * rect.w),
        h: pct((s.y2 - s.y1) * rect.h),
        line: {
          color: bareHex(t.color.muted),
          width: 1.5,
          endArrowType: s.arrow ? "triangle" : "none",
        },
      });
    } else {
      // Polygon (funnel trapezoid) → native custom geometry. OOXML path
      // coordinates are local to the shape, so work in inches from the shape's
      // top-left rather than slide percentages.
      const color = nodeHex(t, s.color, s.seriesIndex) ?? bareHex(t.color.accent);
      const sp = s.points.map(
        ([px, py]) => [rect.x + px * rect.w, rect.y + py * rect.h] as const,
      );
      const minX = Math.min(...sp.map((p) => p[0]));
      const minY = Math.min(...sp.map((p) => p[1]));
      const maxX = Math.max(...sp.map((p) => p[0]));
      const maxY = Math.max(...sp.map((p) => p[1]));
      slide.addShape(CUST_GEOM, {
        x: minX * canvasIn.w,
        y: minY * canvasIn.h,
        w: (maxX - minX) * canvasIn.w,
        h: (maxY - minY) * canvasIn.h,
        points: [
          ...sp.map((p, i) => ({
            x: (p[0] - minX) * canvasIn.w,
            y: (p[1] - minY) * canvasIn.h,
            ...(i === 0 ? { moveTo: true } : {}),
          })),
          { close: true as const },
        ],
        fill: { color },
        line: { color: bareHex(t.color.bg), width: 1 },
      });
      if (s.label) {
        slide.addText(s.label, {
          x: pct(minX),
          y: pct(minY),
          w: pct(maxX - minX),
          h: pct(maxY - minY),
          align: "center",
          valign: "middle",
          color: bareHex(bestOn(`#${color}`)),
          fontSize: 14,
          fontFace: t.font.body,
        });
      }
    }
  }
}

function addBlock(
  slide: PptxSlide,
  block: Block,
  p: Pos,
  rect: Rect,
  valign: VAlign,
  isTitleLayout: boolean,
  t: ThemeTokens,
  shapes: PptxShapes,
  mermaidSvgs: Map<string, string>,
  highlights: Map<string, HighlightedCode>,
  canvasIn: { w: number; h: number },
): void {
  const fg = bareHex(t.color.fg);
  const accent = bareHex(t.color.accent);
  const muted = bareHex(t.color.muted);

  switch (block.type) {
    case "text": {
      const override = block.color
        ? bareHex(themeColor(t, block.color, t.color.fg))
        : undefined;
      const alignOpt = block.align ? { align: block.align } : {};
      switch (block.variant) {
        case "heading":
          slide.addText(block.text, {
            ...p,
            valign,
            ...alignOpt,
            bold: true,
            fontSize: isTitleLayout ? 40 : 30,
            color: override ?? (isTitleLayout ? accent : fg),
            fontFace: t.font.heading,
          });
          return;
        case "subheading":
          slide.addText(block.text, {
            ...p,
            valign,
            ...alignOpt,
            fontSize: 22,
            color: override ?? muted,
            fontFace: t.font.heading,
          });
          return;
        default:
          slide.addText(block.text, {
            ...p,
            valign,
            ...alignOpt,
            fontSize: 18,
            color: override ?? fg,
            fontFace: t.font.body,
          });
          return;
      }
    }
    case "list":
      slide.addText(
        block.items.map((item) => ({
          text: item.text,
          options: {
            bullet: block.ordered
              ? { type: "number" as const }
              : { indent: 15 },
            indentLevel: item.level,
          },
        })),
        { ...p, valign, fontSize: 18, color: fg, fontFace: t.font.body },
      );
      return;
    case "code": {
      const tabH = 0.055;
      const panelRect = block.filename
        ? { x: rect.x, y: rect.y + tabH, w: rect.w, h: Math.max(0, rect.h - tabH) }
        : rect;
      if (block.filename) {
        const tabW = Math.min(rect.w, 0.05 + block.filename.length * 0.011);
        slide.addText(block.filename, {
          x: pct(rect.x),
          y: pct(rect.y),
          w: pct(tabW),
          h: pct(tabH),
          shape: shapes.round2SameRect, // top-two corners rounded → a tab
          fill: { color: bareHex(t.color.border) },
          line: { color: bareHex(t.color.border), width: 1 },
          color: bareHex(t.color.fg),
          align: "center",
          valign: "middle",
          fontSize: 11,
          fontFace: t.font.mono,
          margin: 2,
        });
      }
      const panel = {
        ...pos(panelRect),
        valign: "top" as const,
        fontSize: 14,
        fontFace: t.font.mono,
        align: "left" as const,
        shape: shapes.rect,
        fill: { color: bareHex(t.color.surface) },
        line: { color: bareHex(t.color.border), width: 1 },
        margin: 8, // padding inside the panel
      };
      const hl = lookupHighlight(highlights, block.language, block.code);
      if (hl) {
        const runs = hl.flatMap((line, i) => [
          ...line.map((tok) => ({
            text: tok.content,
            options: { color: bareHex(tok.color) },
          })),
          { text: i < hl.length - 1 ? "\n" : "", options: {} },
        ]);
        slide.addText(runs, panel);
      } else {
        slide.addText(block.code, { ...panel, color: fg });
      }
      return;
    }
    case "kpi":
      slide.addText(
        [
          {
            text: block.value,
            options: { fontSize: 44, bold: true, color: accent, breakLine: true },
          },
          {
            text: block.label,
            options: { fontSize: 16, color: muted, paraSpaceBefore: 8 },
          },
        ],
        { ...p, valign, align: "center", fontFace: t.font.body },
      );
      return;
    case "image": {
      // pptxgenjs reads file paths at write time (a missing path throws), so
      // only embed data URIs or existing files; otherwise draw a placeholder.
      if (block.src.startsWith("data:") || existsSync(block.src)) {
        slide.addImage({
          ...p,
          ...(block.src.startsWith("data:")
            ? { data: block.src.replace(/^data:/, "") }
            : { path: block.src }),
          sizing: { type: block.fit, w: 0, h: 0 },
          altText: block.alt,
        });
      } else {
        slide.addText(block.alt ?? "image", {
          ...p,
          shape: shapes.roundRect,
          fill: { color: bareHex(t.color.border) },
          line: { color: bareHex(t.color.muted), width: 1 },
          color: bareHex(bestOn(t.color.border)),
          align: "center",
          valign: "middle",
          fontSize: 14,
          fontFace: t.font.body,
        });
      }
      return;
    }
    case "diagram":
      if (block.kind === "structured") {
        drawStructuredDiagram(slide, block, rect, t, shapes, canvasIn);
        return;
      }
      {
        const svg = mermaidSvgs.get(block.source);
        if (svg) {
          // PowerPoint 2016+ renders embedded SVG natively (asvg:svgBlip);
          // pptxgenjs handles the OOXML wiring. No rasterizer needed.
          slide.addImage({
            ...p,
            data: `image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
          });
          return;
        }
        // No mermaid renderer enabled — preserve the source text.
        slide.addText(`[mermaid diagram]\n${block.source}`, {
          ...p,
          valign: "top",
          fontSize: 14,
          color: muted,
          fontFace: t.font.mono,
        });
      }
      return;
  }
}

export interface PptxOptions {
  /**
   * Render mermaid diagrams and embed them as SVG images (PowerPoint 2016+
   * renders SVG natively). `true` uses the built-in headless renderer; a function
   * supplies a custom mermaid→SVG renderer. When omitted, mermaid diagrams fall
   * back to their source text.
   */
  mermaid?: MermaidOption;
}

/**
 * Render a deck to a .pptx file (returned as a Buffer). Body content is emitted
 * as native PowerPoint text frames; the shared normalized coordinate template is
 * mapped to percentage positions so it works for both 16:9 and 4:3.
 */
export async function renderPptx(
  deck: SlideDeck,
  opts?: PptxOptions,
): Promise<Buffer> {
  const t = resolveDeckTheme(deck.theme);
  const mermaidSvgs = await prerenderMermaid(deck, opts?.mermaid);
  const highlights = await prehighlightDeck(deck);
  const pptx = new Pptx();
  pptx.layout = deck.aspect === "4:3" ? "LAYOUT_4x3" : "LAYOUT_WIDE";
  // Slide size in inches, for native custom geometry (local path coordinates).
  const canvasIn = deck.aspect === "4:3" ? { w: 10, h: 7.5 } : { w: 13.333, h: 7.5 };
  if (deck.meta?.title) pptx.title = deck.meta.title;
  if (deck.meta?.author) pptx.author = deck.meta.author;
  const shapes = pptx.ShapeType;
  const resolvedSlides = resolveDeck(deck);

  resolvedSlides.forEach((resolved, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: bareHex(t.color.bg) };
    if (resolved.notes) slide.addNotes(resolved.notes);
    const isTitleLayout =
      resolved.layout === "title" || resolved.layout === "section-divider";
    for (const { slot, block } of resolved.placements) {
      if (slot.surface) {
        slide.addShape(shapes.roundRect, {
          ...pos(slot.rect),
          fill: { color: bareHex(t.color.surface) },
          line: { color: bareHex(t.color.border), width: 1 },
        });
      }
      // Surface panels (e.g. grid cards) inset their content for padding.
      const content = slot.surface ? insetRect(slot.rect, 0.012) : slot.rect;
      addBlock(
        slide,
        block,
        pos(content),
        content,
        valignOf(slot.vAnchor),
        isTitleLayout,
        t,
        shapes,
        mermaidSvgs,
        highlights,
        canvasIn,
      );
    }
    if (deck.chrome && !isTitleLayout) {
      drawChrome(slide, deck.chrome, index + 1, resolvedSlides.length, t);
    }
  });

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

/** Page number / footer / logo on a content slide. */
function drawChrome(
  slide: PptxSlide,
  chrome: NonNullable<SlideDeck["chrome"]>,
  page: number,
  total: number,
  t: ThemeTokens,
): void {
  const muted = bareHex(t.color.muted);
  if (chrome.footer) {
    slide.addText(chrome.footer, {
      x: "4%", y: "94.5%", w: "60%", h: "4%",
      fontSize: 9, color: muted, align: "left", fontFace: t.font.body,
    });
  }
  if (chrome.pageNumbers) {
    slide.addText(`${page} / ${total}`, {
      x: "80%", y: "94.5%", w: "16%", h: "4%",
      fontSize: 9, color: muted, align: "right", fontFace: t.font.body,
    });
  }
  if (chrome.logo) {
    if (chrome.logo.startsWith("data:") || existsSync(chrome.logo)) {
      slide.addImage({
        x: "88%", y: "3%", w: "9%", h: "8%",
        ...(chrome.logo.startsWith("data:")
          ? { data: chrome.logo.replace(/^data:/, "") }
          : { path: chrome.logo }),
        sizing: { type: "contain", w: 0, h: 0 },
      });
    }
  }
}
