import type { SlideDeck } from "../ir/index.js";
import { renderHtml } from "./html.js";
import { renderMarkdown } from "./markdown.js";
import { renderPdf, type PdfOptions } from "./pdf.js";
import { renderPptx, type PptxOptions } from "./pptx.js";

export * from "./markdown.js";
export * from "./html.js";
export * from "./pptx.js";
export * from "./pdf.js";
export * from "./fonts.js";
export * from "./highlight.js";
export * from "./geometry.js";

/** Text output targets (synchronous, return a string). */
export type TextTarget = "md" | "html";
/** Binary output targets (asynchronous, return a Buffer). */
export type BinaryTarget = "pptx" | "pdf";
export type RenderTarget = TextTarget | BinaryTarget;

/** Render a deck to a text target. */
export function render(deck: SlideDeck, target: TextTarget): string {
  switch (target) {
    case "md":
      return renderMarkdown(deck);
    case "html":
      return renderHtml(deck);
  }
}

export interface RenderOptions {
  /** Options forwarded to the pptx renderer (e.g. mermaid embedding). */
  pptx?: PptxOptions;
  /** Options forwarded to the pdf renderer (e.g. font embedding, mermaid). */
  pdf?: PdfOptions;
}

/** Render a deck to a binary target. */
export function renderToBuffer(
  deck: SlideDeck,
  target: BinaryTarget,
  opts?: RenderOptions,
): Promise<Buffer> {
  switch (target) {
    case "pptx":
      return renderPptx(deck, opts?.pptx);
    case "pdf":
      return renderPdf(deck, opts?.pdf);
  }
}
