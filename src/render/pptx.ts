import pptxgen from "pptxgenjs";
import type { Block, SlideDeck } from "../ir/index.js";

// Under NodeNext the default-import *type* of pptxgenjs resolves to the module
// namespace, while the runtime value is the constructor. Bridge that gap with a
// typed constructor alias derived from the package's own `default` export.
type PptxCtor = (typeof pptxgen)["default"];
type PptxInstance = InstanceType<PptxCtor>;
type PptxSlide = ReturnType<PptxInstance["addSlide"]>;
const Pptx = pptxgen as unknown as PptxCtor;
import { resolveDeck } from "../layout/index.js";
import { bareHex, getTheme, type ThemeTokens } from "../theme/index.js";

type Pct = `${number}%`;
type Pos = { x: Pct; y: Pct; w: Pct; h: Pct };
type VAlign = "top" | "middle" | "bottom";

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

function addBlock(
  slide: PptxSlide,
  block: Block,
  p: Pos,
  valign: VAlign,
  isTitleLayout: boolean,
  t: ThemeTokens,
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
        path: block.src,
        sizing: { type: block.fit, w: 0, h: 0 },
        altText: block.alt,
      });
      return;
    case "diagram":
      // Native shape / image-embed rendering is a follow-up (spec §7). For now
      // the textual content is preserved so no information is lost.
      slide.addText(
        block.kind === "mermaid"
          ? `[mermaid diagram]\n${block.source}`
          : `[${block.pattern}]\n${block.nodes.map((n) => n.label).join(" → ")}`,
        { ...p, valign: "top", fontSize: 14, color: muted, fontFace: t.font.mono },
      );
      return;
  }
}

/**
 * Render a deck to a .pptx file (returned as a Buffer). Body content is emitted
 * as native PowerPoint text frames; the shared normalized coordinate template is
 * mapped to percentage positions so it works for both 16:9 and 4:3.
 */
export async function renderPptx(deck: SlideDeck): Promise<Buffer> {
  const t = getTheme(deck.theme);
  const pptx = new Pptx();
  pptx.layout = deck.aspect === "4:3" ? "LAYOUT_4x3" : "LAYOUT_WIDE";
  if (deck.meta?.title) pptx.title = deck.meta.title;
  if (deck.meta?.author) pptx.author = deck.meta.author;

  for (const resolved of resolveDeck(deck)) {
    const slide = pptx.addSlide();
    slide.background = { color: bareHex(t.color.bg) };
    const isTitleLayout =
      resolved.layout === "title" || resolved.layout === "section-divider";
    for (const { slot, block } of resolved.placements) {
      addBlock(
        slide,
        block,
        pos(slot.rect),
        valignOf(slot.vAnchor),
        isTitleLayout,
        t,
      );
    }
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
