import { readFileSync } from "node:fs";
import { renderDiagramSvg } from "../diagram/index.js";
import type { Block, SlideDeck, Slot } from "../ir/index.js";
import { resolveDeck, type ResolvedSlide } from "../layout/index.js";
import { resolveDeckTheme, themeColor, type ThemeTokens } from "../theme/index.js";
import { bundledJpFontPath } from "./fonts.js";
import { escapeHtml, runsToHtml } from "./html.js";

export interface HtmlSlidesOptions {
  /**
   * Embed the body font via @font-face so Japanese renders in any browser
   * (no reliance on a system font). `true` uses the bundled Noto Sans JP subset;
   * a string is a path to a TTF/OTF. Adds the font (base64) to the HTML.
   */
  embedFont?: boolean | string;
}

/**
 * Render a deck to self-contained **HTML slides**: each slide is a fixed-size
 * 16:9 / 4:3 page laid out with CSS, slots absolutely positioned from their
 * normalized rects. Unlike `renderHtml` (a flow demotion for Google Doc paste),
 * this preserves the slide layout — open it in a browser, or print to PDF (one
 * slide per page). A small inline script shrinks overflowing text to fit.
 */
export function renderHtmlSlides(
  deck: SlideDeck,
  opts?: HtmlSlidesOptions,
): string {
  const t = resolveDeckTheme(deck.theme);
  const px = deck.aspect === "4:3" ? { w: 960, h: 720 } : { w: 1280, h: 720 };
  const slides = resolveDeck(deck);
  const total = slides.length;
  const body = slides
    .map((s, i) => slideHtml(s, i + 1, total, px, t, deck))
    .join("\n");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<style>${fontFaceCss(t, opts?.embedFont)}${css(px, t)}</style>
</head>
<body>
${body}
${FIT_SCRIPT}
</body>
</html>
`;
}

/** Optional @font-face embedding the body font (base64) for portability. */
function fontFaceCss(t: ThemeTokens, embed: boolean | string | undefined): string {
  if (!embed) return "";
  const path = typeof embed === "string" ? embed : bundledJpFontPath();
  if (!path) return "";
  try {
    const b64 = readFileSync(path).toString("base64");
    return `@font-face{font-family:'${t.font.body}';src:url('data:font/ttf;base64,${b64}') format('truetype');font-display:swap}\n`;
  } catch {
    return "";
  }
}

function css(px: { w: number; h: number }, t: ThemeTokens): string {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#e5e7eb;font-family:${t.font.body},sans-serif;
--bg:${t.color.bg};--fg:${t.color.fg};--accent:${t.color.accent};--muted:${t.color.muted};--surface:${t.color.surface};--border:${t.color.border}}
.slide{position:relative;width:${px.w}px;height:${px.h}px;background:var(--bg);color:var(--fg);
overflow:hidden;margin:16px auto;box-shadow:0 2px 10px rgba(0,0,0,.25)}
.slot{position:absolute;display:flex;flex-direction:column;overflow:hidden}
.slot.surface{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px}
.fit{width:100%}
.txt{white-space:pre-line}
.heading{font-weight:bold;color:var(--fg)}
.subheading{color:var(--muted)}
.kpi{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%}
.kpi b{color:var(--accent)}
.kpi span{color:var(--muted)}
ul,ol{padding-left:1.3em}
pre{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:12px;overflow:auto;font-family:${t.font.mono},monospace}
.tab{display:inline-block;padding:4px 12px;background:var(--border);border-radius:6px 6px 0 0;font-family:${t.font.mono},monospace;font-size:12px}
.chrome{position:absolute;color:var(--muted);font-size:11px}
img.block{width:100%;height:100%;object-fit:contain}
@media print{body{background:#fff}.slide{margin:0;box-shadow:none}@page{size:${px.w}px ${px.h}px;margin:0}}
`;
}

const FIT_SCRIPT = `<script>
for (const slot of document.querySelectorAll('.slot')) {
  const el = slot.querySelector('.fit'); if (!el) continue;
  let size = parseFloat(getComputedStyle(el).fontSize);
  let guard = 0;
  while (guard++ < 60 && (el.scrollHeight > slot.clientHeight || el.scrollWidth > slot.clientWidth) && size > 8) {
    size -= 1; el.style.fontSize = size + 'px';
  }
}
</script>`;

function slideHtml(
  s: ResolvedSlide,
  page: number,
  total: number,
  px: { w: number; h: number },
  t: ThemeTokens,
  deck: SlideDeck,
): string {
  const isTitle = s.layout === "title" || s.layout === "section-divider";
  const slots = s.placements
    .map((p) => slotHtml(p.slot, p.block, px, t, isTitle))
    .join("\n");
  const chrome = deck.chrome && !isTitle ? chromeHtml(deck.chrome, page, total) : "";
  return `<section class="slide">\n${slots}\n${chrome}\n</section>`;
}

function slotHtml(
  slot: Slot,
  block: Block,
  px: { w: number; h: number },
  t: ThemeTokens,
  isTitle: boolean,
): string {
  const left = Math.round(slot.rect.x * px.w);
  const top = Math.round(slot.rect.y * px.h);
  const w = Math.round(slot.rect.w * px.w);
  const h = Math.round(slot.rect.h * px.h);
  const justify =
    slot.vAnchor === "center"
      ? "center"
      : slot.vAnchor === "bottom"
        ? "flex-end"
        : "flex-start";
  const cls = slot.surface ? "slot surface" : "slot";
  const style = `left:${left}px;top:${top}px;width:${w}px;height:${h}px;justify-content:${justify}`;
  return `<div class="${cls}" style="${style}">${blockHtml(block, { w, h }, t, isTitle)}</div>`;
}

function blockHtml(
  block: Block,
  px: { w: number; h: number },
  t: ThemeTokens,
  isTitle: boolean,
): string {
  switch (block.type) {
    case "text": {
      const inline = runsToHtml(block.text, t);
      const align = block.align ? `text-align:${block.align};` : "";
      const color = block.color
        ? `color:${themeColor(t, block.color, t.color.fg)};`
        : "";
      if (block.variant === "heading") {
        const size = isTitle ? t.type.title : t.type.heading;
        const def = isTitle ? `color:${t.color.accent};` : "";
        return `<div class="fit txt heading" style="font-size:${size}pt;${def}${color}${align}">${inline}</div>`;
      }
      if (block.variant === "subheading") {
        return `<div class="fit txt subheading" style="font-size:${t.type.subheading}pt;${color}${align}">${inline}</div>`;
      }
      return `<div class="fit txt" style="font-size:${t.type.body}pt;${color}${align}">${inline}</div>`;
    }
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const items = block.items
        .map(
          (it) =>
            `<li style="margin-left:${it.level * 1.2}em">${escapeHtml(it.text)}</li>`,
        )
        .join("");
      return `<${tag} class="fit" style="font-size:${t.type.body}pt">${items}</${tag}>`;
    }
    case "code": {
      const pre = `<pre style="font-size:${t.type.code}pt"><code>${escapeHtml(block.code)}</code></pre>`;
      return block.filename
        ? `<div class="tab">${escapeHtml(block.filename)}</div>${pre}`
        : pre;
    }
    case "kpi": {
      const caption = block.caption
        ? ` <small>${escapeHtml(block.caption)}</small>`
        : "";
      return `<div class="kpi"><b style="font-size:${t.type.kpi}pt">${escapeHtml(block.value)}</b><span style="font-size:14pt">${escapeHtml(block.label)}${caption}</span></div>`;
    }
    case "image":
      return `<img class="block" style="object-fit:${block.fit}" src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt ?? "")}">`;
    case "diagram":
      if (block.kind === "structured") {
        return renderDiagramSvg(block, { width: px.w, height: px.h, theme: t });
      }
      return `<pre class="mermaid">${escapeHtml(block.source)}</pre>`;
  }
}

function chromeHtml(
  chrome: NonNullable<SlideDeck["chrome"]>,
  page: number,
  total: number,
): string {
  const parts: string[] = [];
  if (chrome.footer) {
    parts.push(
      `<div class="chrome" style="left:4%;bottom:3%">${escapeHtml(chrome.footer)}</div>`,
    );
  }
  if (chrome.pageNumbers) {
    parts.push(
      `<div class="chrome" style="right:4%;bottom:3%">${page} / ${total}</div>`,
    );
  }
  if (chrome.logo) {
    parts.push(
      `<img src="${escapeHtml(chrome.logo)}" style="position:absolute;right:3%;top:3%;height:8%;object-fit:contain">`,
    );
  }
  return parts.join("\n");
}
