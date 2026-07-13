import { textRuns, type Block, type SlideDeck } from "../ir/index.js";
import { resolveDeck, type ResolvedSlide } from "../layout/index.js";
import { resolveDeckTheme, themeColor, type ThemeTokens } from "../theme/index.js";

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

/** Render rich text runs to inline HTML with styled spans. */
export function runsToHtml(
  text: Parameters<typeof textRuns>[0],
  t: ThemeTokens,
): string {
  return textRuns(text)
    .map((r) => {
      const inner = escapeHtml(r.text);
      const styles: string[] = [];
      if (r.bold) styles.push("font-weight:bold");
      if (r.italic) styles.push("font-style:italic");
      if (r.color) styles.push(`color:${themeColor(t, r.color, t.color.fg)}`);
      if (r.highlight) {
        styles.push(`background:${themeColor(t, r.highlight, t.color.accent)}`);
      }
      return styles.length
        ? `<span style="${styles.join(";")}">${inner}</span>`
        : inner;
    })
    .join("");
}

function blockToHtml(block: Block, slide: ResolvedSlide, t: ThemeTokens): string {
  switch (block.type) {
    case "text": {
      const inline = runsToHtml(block.text, t);
      switch (block.variant) {
        case "heading": {
          const tag = TOP_LEVEL_HEADING.has(slide.layout) ? "h1" : "h2";
          return `<${tag}>${inline}</${tag}>`;
        }
        case "subheading":
          return `<h3>${inline}</h3>`;
        default:
          return `<p>${inline}</p>`;
      }
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
      const radius = block.filename ? "0 6px 6px 6px" : "6px";
      const style = ` style="padding:12px;background:#f6f8fa;border:1px solid #e1e4e8;border-radius:${radius};overflow:auto"`;
      const pre = `<pre${style}><code${cls}>${escapeHtml(block.code)}</code></pre>`;
      if (!block.filename) return pre;
      const tab = `<div style="display:inline-block;padding:4px 12px;background:#e1e4e8;border:1px solid #e1e4e8;border-bottom:none;border-radius:6px 6px 0 0;font-family:monospace;font-size:12px">${escapeHtml(block.filename)}</div>`;
      return `${tab}\n${pre}`;
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
  const t = resolveDeckTheme(deck.theme);
  const body = slides
    .map(
      (slide) =>
        `<section>\n${slide.placements
          .map((p) => blockToHtml(p.block, slide, t))
          .join("\n")}\n</section>`,
    )
    .join("\n<hr>\n");
  return `<!doctype html>\n<html>\n<body>\n${body}\n</body>\n</html>\n`;
}
