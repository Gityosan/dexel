import type { Block, SlideDeck } from "../ir/index.js";
import { resolveDeck, type ResolvedSlide } from "../layout/index.js";

/** Layouts whose heading is the top-level (h1) heading rather than a slide title. */
const TOP_LEVEL_HEADING = new Set(["title", "section-divider"]);

function headingHashes(slide: ResolvedSlide): string {
  return TOP_LEVEL_HEADING.has(slide.layout) ? "#" : "##";
}

function blockToMarkdown(block: Block, slide: ResolvedSlide): string {
  switch (block.type) {
    case "text":
      switch (block.variant) {
        case "heading":
          return `${headingHashes(slide)} ${block.text}`;
        case "subheading":
          return `### ${block.text}`;
        default:
          return block.text;
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
      return `\`\`\`${lang}\n${block.code}\n\`\`\``;
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
      // Structured diagrams keep their text as a labeled list so no information
      // is lost in the flow demotion.
      return [
        `**[diagram: ${block.pattern}]**`,
        ...block.nodes.map((n) => `- ${n.label}`),
        ...block.edges.map(
          (e) => `- ${e.from} → ${e.to}${e.label ? ` (${e.label})` : ""}`,
        ),
      ].join("\n");
  }
}

/**
 * Render a deck to Markdown by demoting each slide to a heading + body flow,
 * walking the template's `flowOrder` (already applied to `placements`). All body
 * text survives as real Markdown text.
 */
export function renderMarkdown(deck: SlideDeck): string {
  const slides = resolveDeck(deck);
  return slides
    .map((slide) =>
      slide.placements
        .map((p) => blockToMarkdown(p.block, slide))
        .join("\n\n"),
    )
    .join("\n\n---\n\n")
    .concat("\n");
}
