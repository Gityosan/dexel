import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import {
  type MermaidOption,
  prerenderMermaid,
  renderDiagramSvg,
} from "../diagram/index.js";
import type { Block, SlideDeck, VAnchor } from "../ir/index.js";
import { bundledJpFontPath } from "./fonts.js";
import { resolveDeck } from "../layout/index.js";
import { getTheme, type ThemeTokens } from "../theme/index.js";
import { type Box, canvasPt, placeRect, type Size } from "./geometry.js";

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
};

/** Draw text inside a box, honoring vertical anchoring via measured height. */
function drawText(doc: Doc, text: string, box: Box, o: TextOpts): void {
  doc.font(o.font).fontSize(o.size).fillColor(o.color);
  const align = o.align ?? "left";
  const textHeight = doc.heightOfString(text, { width: box.w, align });
  let y = box.y;
  if (o.vAnchor === "center") y = box.y + Math.max(0, (box.h - textHeight) / 2);
  else if (o.vAnchor === "bottom") y = box.y + Math.max(0, box.h - textHeight);
  doc.text(text, box.x, y, { width: box.w, height: box.h, align });
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
): void {
  switch (block.type) {
    case "text":
      switch (block.variant) {
        case "heading":
          drawText(doc, block.text, box, {
            font: f.heading,
            size: isTitleLayout ? 40 : 30,
            color: isTitleLayout ? t.color.accent : t.color.fg,
            vAnchor,
          });
          return;
        case "subheading":
          drawText(doc, block.text, box, {
            font: f.heading,
            size: 22,
            color: t.color.muted,
            vAnchor,
          });
          return;
        default:
          drawText(doc, block.text, box, {
            font: f.body,
            size: 18,
            color: t.color.fg,
            vAnchor,
          });
          return;
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
    case "code":
      // Surface panel + subtle border behind the code (uses the derived neutrals).
      doc
        .rect(box.x, box.y, box.w, box.h)
        .fillColor(t.color.surface)
        .fill()
        .rect(box.x, box.y, box.w, box.h)
        .lineWidth(1)
        .strokeColor(t.color.border)
        .stroke();
      drawText(doc, block.code, box, { font: f.mono, size: 14, color: t.color.fg });
      return;
    case "kpi":
      drawText(doc, block.value, box, {
        font: f.heading,
        size: 44,
        color: t.color.accent,
        align: "center",
        vAnchor,
      });
      drawText(
        doc,
        block.label,
        { ...box, y: box.y + box.h * 0.6 },
        { font: f.body, size: 16, color: t.color.muted, align: "center" },
      );
      return;
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
        SVGtoPDF(doc, svg, box.x, box.y, { width: box.w, height: box.h });
        return;
      }
      {
        const svg = mermaidSvgs.get(block.source);
        if (svg) {
          SVGtoPDF(doc, svg, box.x, box.y, {
            width: box.w,
            height: box.h,
            preserveAspectRatio: "xMidYMid meet",
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
  const t = getTheme(deck.theme);
  const canvas: Size = canvasPt(deck.aspect);
  // Mermaid rendering is async, so resolve all diagrams before drawing.
  const mermaidSvgs = await prerenderMermaid(deck, opts?.mermaid);
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

  for (const resolved of resolveDeck(deck)) {
    doc.addPage({ size: [canvas.w, canvas.h], margin: 0 });
    doc.rect(0, 0, canvas.w, canvas.h).fill(t.color.bg);
    const isTitleLayout =
      resolved.layout === "title" || resolved.layout === "section-divider";
    for (const { slot, block } of resolved.placements) {
      const box = placeRect(slot.rect, canvas);
      if (slot.surface) {
        doc
          .save()
          .rect(box.x, box.y, box.w, box.h)
          .fillColor(t.color.surface)
          .fill()
          .rect(box.x, box.y, box.w, box.h)
          .lineWidth(1)
          .strokeColor(t.color.border)
          .stroke()
          .restore();
      }
      drawBlock(doc, block, box, slot.vAnchor, isTitleLayout, t, f, mermaidSvgs);
    }
  }

  doc.end();
  return done;
}
