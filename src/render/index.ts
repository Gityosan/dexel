import type { SlideDeck } from "../ir/index.js";
import { renderHtml } from "./html.js";
import { renderMarkdown } from "./markdown.js";

export * from "./markdown.js";
export * from "./html.js";

/** Output targets. Fixed-canvas targets (pptx / pdf) are not yet implemented. */
export type RenderTarget = "md" | "html" | "pptx" | "pdf";

/** Targets with a working renderer today. */
export const supportedTargets: RenderTarget[] = ["md", "html"];

/** Render a deck to the given target. Throws for not-yet-implemented targets. */
export function render(deck: SlideDeck, target: RenderTarget): string {
  switch (target) {
    case "md":
      return renderMarkdown(deck);
    case "html":
      return renderHtml(deck);
    case "pptx":
    case "pdf":
      throw new Error(
        `Render target "${target}" is not implemented yet. Supported: ${supportedTargets.join(", ")}`,
      );
  }
}
