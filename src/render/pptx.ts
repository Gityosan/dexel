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
import { resolveDeck } from "../layout/index.js";
import { bareHex, bestOn, getTheme, type ThemeTokens } from "../theme/index.js";

/** Resolve a series-palette color (bare hex), wrapping past the palette length. */
function seriesHex(t: ThemeTokens, i: number): string {
  return bareHex(t.color.series[i % t.color.series.length]!);
}

type Pct = `${number}%`;
type Pos = { x: Pct; y: Pct; w: Pct; h: Pct };
type VAlign = "top" | "middle" | "bottom";
type PptxShapes = PptxInstance["ShapeType"];
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
): void {
  for (const s of layoutDiagram(block)) {
    if (s.kind === "box") {
      const series = s.seriesIndex !== undefined ? seriesHex(t, s.seriesIndex) : undefined;
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
      const color = s.seriesIndex !== undefined ? seriesHex(t, s.seriesIndex) : bareHex(t.color.accent);
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
    } else {
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
): void {
  const fg = bareHex(t.color.fg);
  const accent = bareHex(t.color.accent);
  const muted = bareHex(t.color.muted);

  switch (block.type) {
    case "text":
      switch (block.variant) {
        case "heading":
          slide.addText(block.text, {
            ...p,
            valign,
            bold: true,
            fontSize: isTitleLayout ? 40 : 30,
            color: isTitleLayout ? accent : fg,
            fontFace: t.font.heading,
          });
          return;
        case "subheading":
          slide.addText(block.text, {
            ...p,
            valign,
            fontSize: 22,
            color: muted,
            fontFace: t.font.heading,
          });
          return;
        default:
          slide.addText(block.text, {
            ...p,
            valign,
            fontSize: 18,
            color: fg,
            fontFace: t.font.body,
          });
          return;
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
    case "code":
      slide.addText(block.code, {
        ...p,
        valign: "top",
        fontSize: 14,
        color: fg,
        fontFace: t.font.mono,
        align: "left",
        shape: shapes.rect,
        fill: { color: bareHex(t.color.surface) },
        line: { color: bareHex(t.color.border), width: 1 },
      });
      return;
    case "kpi":
      slide.addText(
        [
          { text: `${block.value}\n`, options: { fontSize: 44, bold: true, color: accent } },
          { text: block.label, options: { fontSize: 16, color: muted } },
        ],
        { ...p, valign, align: "center", fontFace: t.font.body },
      );
      return;
    case "image":
      slide.addImage({
        ...p,
        // pptxgenjs takes a file path or inline `data` (a data URI sans prefix).
        ...(block.src.startsWith("data:")
          ? { data: block.src.replace(/^data:/, "") }
          : { path: block.src }),
        sizing: { type: block.fit, w: 0, h: 0 },
        altText: block.alt,
      });
      return;
    case "diagram":
      if (block.kind === "structured") {
        drawStructuredDiagram(slide, block, rect, t, shapes);
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
  const t = getTheme(deck.theme);
  const mermaidSvgs = await prerenderMermaid(deck, opts?.mermaid);
  const pptx = new Pptx();
  pptx.layout = deck.aspect === "4:3" ? "LAYOUT_4x3" : "LAYOUT_WIDE";
  if (deck.meta?.title) pptx.title = deck.meta.title;
  if (deck.meta?.author) pptx.author = deck.meta.author;
  const shapes = pptx.ShapeType;

  for (const resolved of resolveDeck(deck)) {
    const slide = pptx.addSlide();
    slide.background = { color: bareHex(t.color.bg) };
    if (resolved.notes) slide.addNotes(resolved.notes);
    const isTitleLayout =
      resolved.layout === "title" || resolved.layout === "section-divider";
    for (const { slot, block } of resolved.placements) {
      addBlock(
        slide,
        block,
        pos(slot.rect),
        slot.rect,
        valignOf(slot.vAnchor),
        isTitleLayout,
        t,
        shapes,
        mermaidSvgs,
      );
    }
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
