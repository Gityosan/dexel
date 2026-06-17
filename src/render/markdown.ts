import { renderDiagramSvg } from "../diagram/index.js";
import { textRuns, type Block, type SlideDeck } from "../ir/index.js";
import { resolveDeck, type ResolvedSlide } from "../layout/index.js";
import { resolveDeckTheme, themeColor, type ThemeTokens } from "../theme/index.js";

/** Layouts whose heading is the top-level (h1) heading rather than a slide title. */
const TOP_LEVEL_HEADING = new Set(["title", "section-divider"]);

function headingHashes(slide: ResolvedSlide): string {
  return TOP_LEVEL_HEADING.has(slide.layout) ? "#" : "##";
}

/** Render rich text runs to inline Markdown (with raw HTML for color/highlight). */
function runsToMarkdown(
  text: Parameters<typeof textRuns>[0],
  t: ThemeTokens,
): string {
  return textRuns(text)
    .map((r) => {
      let s = r.text;
      if (r.bold) s = `**${s}**`;
      if (r.italic) s = `*${s}*`;
      if (r.highlight) {
        s = `<mark style="background:${themeColor(t, r.highlight, t.color.accent)}">${s}</mark>`;
      }
      if (r.color) {
        s = `<span style="color:${themeColor(t, r.color, t.color.fg)}">${s}</span>`;
      }
      return s;
    })
    .join("");
}

function blockToMarkdown(
  block: Block,
  slide: ResolvedSlide,
  theme: ThemeTokens,
): string {
  switch (block.type) {
    case "text": {
      const inline = runsToMarkdown(block.text, theme);
      switch (block.variant) {
        case "heading":
          return `${headingHashes(slide)} ${inline}`;
        case "subheading":
          return `### ${inline}`;
        default:
          return inline;
      }
    }
    case "list":
      return block.items
        .map((item, i) => {
          const indent = "  ".repeat(item.level);
          const marker = block.ordered ? `${i + 1}.` : "-";
          return `${indent}${marker} ${item.text}`;
        })
        .join("\n");
    case "code": {
      const lang = block.language ?? "";
      const fence = `\`\`\`${lang}\n${block.code}\n\`\`\``;
      return block.filename ? `\`${block.filename}\`\n${fence}` : fence;
    }
    case "kpi": {
      const caption = block.caption ? ` — ${block.caption}` : "";
      return `**${block.value}** ${block.label}${caption}`;
    }
    case "image":
      return `![${block.alt ?? ""}](${block.src})`;
    case "diagram":
      if (block.kind === "mermaid") {
        return `\`\`\`mermaid\n${block.source}\n\`\`\``;
      }
      // Structured diagrams inline the shared SVG (Markdown allows raw HTML).
      return renderDiagramSvg(block, { theme });
  }
}

/**
 * Render a deck to Markdown by demoting each slide to a heading + body flow,
 * walking the template's `flowOrder` (already applied to `placements`). All body
 * text survives as real Markdown text.
 */
export function renderMarkdown(deck: SlideDeck): string {
  const slides = resolveDeck(deck);
  const theme = resolveDeckTheme(deck.theme);
  return slides
    .map((slide) =>
      slide.placements
        .map((p) => blockToMarkdown(p.block, slide, theme))
        .join("\n\n"),
    )
    .join("\n\n---\n\n")
    .concat("\n");
}
