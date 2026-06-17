import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import {
  type MermaidOption,
  prerenderMermaid,
  renderDiagramSvg,
} from "../diagram/index.js";
import type { Block, SlideDeck, VAnchor } from "../ir/index.js";
import { bundledJpFontPath } from "./fonts.js";
import { themeColor } from "../theme/index.js";
import {
  type HighlightedCode,
  lookupHighlight,
  prehighlightDeck,
} from "./highlight.js";
import { resolveDeck } from "../layout/index.js";
import { resolveDeckTheme, type ThemeTokens } from "../theme/index.js";
import { type Box, canvasPt, insetRect, placeRect, type Size } from "./geometry.js";

type Doc = InstanceType<typeof PDFDocument>;

/** Paths to TrueType/OpenType font files to embed (and subset) for each role. */
export interface PdfFonts {
  heading?: string;
  body?: string;
  mono?: string;
}

export interface PdfOptions {
  /**
   * Font files to embed. Required for non-Latin scripts (e.g. Japanese): pdfkit
   * embeds and subsets the given TTF/OTF via fontkit. Without them, the standard
   * Latin-only PDF fonts are used.
   */
  fonts?: PdfFonts;
  /**
   * Render mermaid diagrams to embedded SVG. `true` uses the built-in headless
   * renderer; a function supplies a custom mermaid→SVG renderer. When omitted,
   * mermaid diagrams fall back to their source text.
   */
  mermaid?: MermaidOption;
}

interface ResolvedFonts {
  heading: string;
  body: string;
  mono: string;
}

/** Register any provided font files and return the font name to use per role. */
function setupFonts(doc: Doc, fonts: PdfFonts | undefined): ResolvedFonts {
  // Default body/heading to the bundled Japanese font so CJK text renders as
  // real text out of the box (the standard PDF fonts garble it). Mono stays
  // Courier for monospaced code; pass `fonts.mono` for Japanese in code.
  const bodyPath = fonts?.body ?? bundledJpFontPath();
  const body = bodyPath
    ? (doc.registerFont("body", bodyPath), "body")
    : "Helvetica";
  const heading = fonts?.heading
    ? (doc.registerFont("heading", fonts.heading), "heading")
    : body === "body"
      ? body // reuse the embedded body font (JP) rather than Latin-only bold
      : "Helvetica-Bold";
  const mono = fonts?.mono
    ? (doc.registerFont("mono", fonts.mono), "mono")
    : "Courier";
  return { heading, body, mono };
}

type TextOpts = {
  font: string;
  size: number;
  color: string;
  align?: "left" | "center" | "right";
  vAnchor?: VAnchor;
  bold?: boolean;
};

/**
 * Largest size ≤ `maxSize` at which the text fits the box: every explicit line
 * fits the width (CJK has no break opportunities, so pdfkit won't wrap it) and
 * the wrapped height fits. Shrink-to-fit so headings/dense panels never clip.
 */
function fitSize(doc: Doc, text: string, font: string, box: Box, maxSize: number): number {
  doc.font(font);
  const lines = text.split("\n");
  let size = maxSize;
  while (size > 8) {
    doc.fontSize(size);
    const widest = Math.max(0, ...lines.map((l) => doc.widthOfString(l)));
    if (widest <= box.w && doc.heightOfString(text, { width: box.w }) <= box.h) {
      break;
    }
    size -= 1;
  }
  return size;
}

/** Draw text inside a box, honoring vertical anchoring via measured height. */
function drawText(doc: Doc, text: string, box: Box, o: TextOpts): void {
  const size = fitSize(doc, text, o.font, box, o.size);
  doc.font(o.font).fontSize(size).fillColor(o.color);
  const align = o.align ?? "left";
  const textHeight = doc.heightOfString(text, { width: box.w, align });
  let y = box.y;
  if (o.vAnchor === "center") y = box.y + Math.max(0, (box.h - textHeight) / 2);
  else if (o.vAnchor === "bottom") y = box.y + Math.max(0, box.h - textHeight);
  doc.text(text, box.x, y, { width: box.w, height: box.h, align });
  if (o.bold) {
    // The embedded fonts ship Regular only; fake bold with a hairline offset draw.
    doc.text(text, box.x + 0.4, y, { width: box.w, height: box.h, align });
  }
}

function drawBlock(
  doc: Doc,
  block: Block,
  box: Box,
  vAnchor: VAnchor,
  isTitleLayout: boolean,
  t: ThemeTokens,
  f: ResolvedFonts,
  mermaidSvgs: Map<string, string>,
  highlights: Map<string, HighlightedCode>,
): void {
  switch (block.type) {
    case "text": {
      const override = block.color
        ? themeColor(t, block.color, t.color.fg)
        : undefined;
      const align = block.align;
      switch (block.variant) {
        case "heading":
          drawText(doc, block.text, box, {
            font: f.heading,
            size: isTitleLayout ? 40 : 30,
            color: override ?? (isTitleLayout ? t.color.accent : t.color.fg),
            vAnchor,
            bold: true,
            align,
          });
          return;
        case "subheading":
          drawText(doc, block.text, box, {
            font: f.heading,
            size: 22,
            color: override ?? t.color.muted,
            vAnchor,
            align,
          });
          return;
        default:
          drawText(doc, block.text, box, {
            font: f.body,
            size: 18,
            color: override ?? t.color.fg,
            vAnchor,
            align,
          });
          return;
      }
    }
    case "list": {
      const lines = block.items
        .map((item, i) => {
          const indent = "    ".repeat(item.level);
          const marker = block.ordered ? `${i + 1}.` : "•";
          return `${indent}${marker} ${item.text}`;
        })
        .join("\n");
      drawText(doc, lines, box, { font: f.body, size: 18, color: t.color.fg });
      return;
    }
    case "code": {
      // Optional filename tab (rounded top corners) above the panel.
      let panel = box;
      if (block.filename) {
        const tabH = 22;
        const r = 6;
        doc.font(f.mono).fontSize(11);
        const tabW = Math.min(box.w, doc.widthOfString(block.filename) + 20);
        const tx = box.x;
        const ty = box.y;
        doc
          .save()
          .moveTo(tx, ty + tabH)
          .lineTo(tx, ty + r)
          .quadraticCurveTo(tx, ty, tx + r, ty)
          .lineTo(tx + tabW - r, ty)
          .quadraticCurveTo(tx + tabW, ty, tx + tabW, ty + r)
          .lineTo(tx + tabW, ty + tabH)
          .lineTo(tx, ty + tabH)
          .fillColor(t.color.border)
          .fill()
          .restore();
        doc
          .fillColor(t.color.fg)
          .text(block.filename, tx + 10, ty + 6, { width: tabW - 16, lineBreak: false });
        panel = { x: box.x, y: box.y + tabH, w: box.w, h: box.h - tabH };
      }
      // Surface panel + subtle border behind the code (derived neutrals).
      doc
        .save()
        .rect(panel.x, panel.y, panel.w, panel.h)
        .fillColor(t.color.surface)
        .fill()
        .rect(panel.x, panel.y, panel.w, panel.h)
        .lineWidth(1)
        .strokeColor(t.color.border)
        .stroke()
        .restore();
      const pad = 8;
      const size = 13;
      const lineH = size * 1.35;
      const innerX = panel.x + pad;
      const innerW = panel.w - 2 * pad;
      const bottom = panel.y + panel.h - pad;
      doc.font(f.mono).fontSize(size);
      const hl = lookupHighlight(highlights, block.language, block.code);
      if (hl) {
        hl.forEach((line, i) => {
          const y = panel.y + pad + i * lineH;
          if (y + lineH > bottom + lineH) return; // clip overflowing lines
          let x = innerX;
          for (const tok of line) {
            if (!tok.content) continue;
            doc.fillColor(tok.color).text(tok.content, x, y, { lineBreak: false });
            x += doc.widthOfString(tok.content);
            if (x > innerX + innerW) break; // clip overflowing columns
          }
        });
      } else {
        doc.fillColor(t.color.fg).text(block.code, innerX, panel.y + pad, {
          width: innerW,
          height: panel.h - 2 * pad,
        });
      }
      return;
    }
    case "kpi": {
      // Value in the upper part, label below with a clear gap.
      const valueH = box.h * 0.52;
      drawText(
        doc,
        block.value,
        { ...box, h: valueH },
        {
          font: f.heading,
          size: 44,
          color: t.color.accent,
          align: "center",
          vAnchor: "bottom",
          bold: true,
        },
      );
      const labelY = box.y + valueH + box.h * 0.08;
      drawText(
        doc,
        block.label,
        { x: box.x, y: labelY, w: box.w, h: box.y + box.h - labelY },
        { font: f.body, size: 16, color: t.color.muted, align: "center", vAnchor: "top" },
      );
      return;
    }
    case "image":
      try {
        // Decode data URIs to a Buffer; pdfkit takes a path or Buffer.
        const src = block.src.startsWith("data:")
          ? Buffer.from(block.src.slice(block.src.indexOf(",") + 1), "base64")
          : block.src;
        doc.image(src, box.x, box.y, {
          fit: [box.w, box.h],
          align: "center",
          valign: "center",
        });
      } catch {
        // Unloadable image → a gray placeholder rectangle with a caption.
        doc
          .save()
          .rect(box.x, box.y, box.w, box.h)
          .fillColor(t.color.border)
          .fill()
          .rect(box.x, box.y, box.w, box.h)
          .lineWidth(1)
          .strokeColor(t.color.muted)
          .stroke()
          .restore();
        drawText(doc, block.alt ?? "image", box, {
          font: f.body,
          size: 12,
          color: t.color.fg,
          align: "center",
          vAnchor: "center",
        });
      }
      return;
    case "diagram":
      if (block.kind === "structured") {
        const svg = renderDiagramSvg(block, {
          width: box.w,
          height: box.h,
          theme: t,
        });
        // svg-to-pdfkit draws SVG <text> with the doc's font; force the embedded
        // (CJK-capable) body font so Japanese diagram labels render.
        SVGtoPDF(doc, svg, box.x, box.y, {
          width: box.w,
          height: box.h,
          fontCallback: () => f.body,
        });
        return;
      }
      {
        const svg = mermaidSvgs.get(block.source);
        if (svg) {
          SVGtoPDF(doc, svg, box.x, box.y, {
            width: box.w,
            height: box.h,
            preserveAspectRatio: "xMidYMid meet",
            fontCallback: () => f.body,
          });
          return;
        }
        // No mermaid renderer enabled — preserve the source text.
        drawText(doc, `[mermaid diagram]\n${block.source}`, box, {
          font: f.mono,
          size: 12,
          color: t.color.muted,
        });
      }
      return;
  }
}

/**
 * Render a deck to a PDF (returned as a Buffer). Body text is drawn directly at
 * resolved coordinates (path A) as real text, sharing the normalized coordinate
 * template with the pptx renderer. Embedded fonts are subset automatically.
 */
export async function renderPdf(
  deck: SlideDeck,
  opts?: PdfOptions,
): Promise<Buffer> {
  const t = resolveDeckTheme(deck.theme);
  const canvas: Size = canvasPt(deck.aspect);
  // Mermaid and syntax highlighting are async, so resolve them before drawing.
  const mermaidSvgs = await prerenderMermaid(deck, opts?.mermaid);
  const highlights = await prehighlightDeck(deck);
  const doc = new PDFDocument({
    size: [canvas.w, canvas.h],
    margin: 0,
    autoFirstPage: false,
    info: {
      ...(deck.meta?.title ? { Title: deck.meta.title } : {}),
      ...(deck.meta?.author ? { Author: deck.meta.author } : {}),
    },
  });
  const f = setupFonts(doc, opts?.fonts);

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const resolvedSlides = resolveDeck(deck);
  resolvedSlides.forEach((resolved, index) => {
    doc.addPage({ size: [canvas.w, canvas.h], margin: 0 });
    doc.rect(0, 0, canvas.w, canvas.h).fill(t.color.bg);
    const isTitleLayout =
      resolved.layout === "title" || resolved.layout === "section-divider";
    for (const { slot, block } of resolved.placements) {
      const slotBox = placeRect(slot.rect, canvas);
      if (slot.surface) {
        doc
          .save()
          .rect(slotBox.x, slotBox.y, slotBox.w, slotBox.h)
          .fillColor(t.color.surface)
          .fill()
          .rect(slotBox.x, slotBox.y, slotBox.w, slotBox.h)
          .lineWidth(1)
          .strokeColor(t.color.border)
          .stroke()
          .restore();
      }
      // Surface panels (e.g. grid cards) inset their content for padding.
      const box = slot.surface ? insetRect(slotBox, 10) : slotBox;
      drawBlock(
        doc,
        block,
        box,
        slot.vAnchor,
        isTitleLayout,
        t,
        f,
        mermaidSvgs,
        highlights,
      );
    }
    if (deck.chrome && !isTitleLayout) {
      drawChrome(doc, deck.chrome, index + 1, resolvedSlides.length, t, f, canvas);
    }
  });

  doc.end();
  return done;
}

/** Page number / footer / logo on a content slide. */
function drawChrome(
  doc: Doc,
  chrome: NonNullable<SlideDeck["chrome"]>,
  page: number,
  total: number,
  t: ThemeTokens,
  f: ResolvedFonts,
  canvas: Size,
): void {
  const y = canvas.h * 0.945;
  const h = canvas.h * 0.04;
  if (chrome.footer) {
    drawText(doc, chrome.footer, { x: canvas.w * 0.04, y, w: canvas.w * 0.6, h }, {
      font: f.body,
      size: 9,
      color: t.color.muted,
      align: "left",
    });
  }
  if (chrome.pageNumbers) {
    drawText(doc, `${page} / ${total}`, { x: canvas.w * 0.8, y, w: canvas.w * 0.16, h }, {
      font: f.body,
      size: 9,
      color: t.color.muted,
      align: "right",
    });
  }
  if (chrome.logo) {
    try {
      const src = chrome.logo.startsWith("data:")
        ? Buffer.from(chrome.logo.slice(chrome.logo.indexOf(",") + 1), "base64")
        : chrome.logo;
      doc.image(src, canvas.w * 0.88, canvas.h * 0.03, {
        fit: [canvas.w * 0.09, canvas.h * 0.08],
        align: "right",
      });
    } catch {
      /* missing logo → skip */
    }
  }
}
