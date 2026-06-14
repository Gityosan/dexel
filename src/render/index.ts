import type { SlideDeck } from "../ir/index.js";
import { renderHtml } from "./html.js";
import { renderMarkdown } from "./markdown.js";
import { renderPptx } from "./pptx.js";

export * from "./markdown.js";
export * from "./html.js";
export * from "./pptx.js";

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

/** Render a deck to a binary target. */
export function renderToBuffer(
  deck: SlideDeck,
  target: BinaryTarget,
): Promise<Buffer> {
  switch (target) {
    case "pptx":
      return renderPptx(deck);
    case "pdf":
      throw new Error("Render target \"pdf\" is not implemented yet.");
  }
}
