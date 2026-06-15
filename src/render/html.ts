import type { Block, SlideDeck } from "../ir/index.js";
import { resolveDeck, type ResolvedSlide } from "../layout/index.js";

const TOP_LEVEL_HEADING = new Set(["title", "section-divider"]);

/** Escape text for safe inclusion in HTML element content / attributes. */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

function blockToHtml(block: Block, slide: ResolvedSlide): string {
  switch (block.type) {
    case "text":
      switch (block.variant) {
        case "heading": {
          const tag = TOP_LEVEL_HEADING.has(slide.layout) ? "h1" : "h2";
          return `<${tag}>${escapeHtml(block.text)}</${tag}>`;
        }
        case "subheading":
          return `<h3>${escapeHtml(block.text)}</h3>`;
        default:
          return `<p>${escapeHtml(block.text)}</p>`;
      }
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const items = block.items
        .map((item) => `  <li>${escapeHtml(item.text)}</li>`)
        .join("\n");
      return `<${tag}>\n${items}\n</${tag}>`;
    }
    case "code": {
      const cls = block.language ? ` class="language-${block.language}"` : "";
      const style =
        ' style="padding:12px;background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;overflow:auto"';
      return `<pre${style}><code${cls}>${escapeHtml(block.code)}</code></pre>`;
    }
    case "kpi": {
      const caption = block.caption
        ? ` <small>${escapeHtml(block.caption)}</small>`
        : "";
      return `<p><strong>${escapeHtml(block.value)}</strong> ${escapeHtml(block.label)}${caption}</p>`;
    }
    case "image":
      return `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt ?? "")}">`;
    case "diagram":
      if (block.kind === "mermaid") {
        // Diagrams don't survive a Google Doc paste; the source is kept as text
        // and the image is delivered separately (per spec §7).
        return `<pre class="mermaid">${escapeHtml(block.source)}</pre>`;
      }
      return [
        `<p><strong>[diagram: ${escapeHtml(block.pattern)}]</strong></p>`,
        "<ul>",
        ...block.nodes.map((n) => `  <li>${escapeHtml(n.label)}</li>`),
        ...block.edges.map(
          (e) =>
            `  <li>${escapeHtml(e.from)} → ${escapeHtml(e.to)}${
              e.label ? ` (${escapeHtml(e.label)})` : ""
            }</li>`,
        ),
        "</ul>",
      ].join("\n");
  }
}

/**
 * Render a deck to rich HTML intended for pasting into Google Docs. Each slide
 * is demoted to a flow via the template's `flowOrder`; all text is escaped and
 * preserved as real text.
 */
export function renderHtml(deck: SlideDeck): string {
  const slides = resolveDeck(deck);
  const body = slides
    .map(
      (slide) =>
        `<section>\n${slide.placements
          .map((p) => blockToHtml(p.block, slide))
          .join("\n")}\n</section>`,
    )
    .join("\n<hr>\n");
  return `<!doctype html>\n<html>\n<body>\n${body}\n</body>\n</html>\n`;
}
