/**
 * Headless mermaid → SVG rendering.
 *
 * mermaid is browser-oriented, so we host it on a jsdom DOM and stub the SVG
 * measurement API (`getBBox`) jsdom lacks. `htmlLabels` is disabled so labels
 * are real SVG `<text>` (no `<foreignObject>`), which keeps the output embeddable
 * by svg-to-pdfkit. The DOM + mermaid are initialized lazily and once.
 */
import type { SlideDeck } from "../ir/index.js";
import { resolveDeckTheme, type ThemeTokens } from "../theme/index.js";

/** Renders mermaid source to an SVG string. */
export type MermaidRenderer = (source: string) => Promise<string>;

/** How a renderer should handle mermaid: off, the built-in, or a custom renderer. */
export type MermaidOption = boolean | MermaidRenderer;

type MermaidModule = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
};

let init: Promise<MermaidModule> | undefined;
let counter = 0;

interface MinEl {
  textContent: string | null;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}
interface MinDoc {
  documentElement: MinEl;
  querySelectorAll(sel: string): Iterable<MinEl>;
}
interface DomWindow {
  DOMParser: new () => { parseFromString(s: string, type: string): MinDoc };
  XMLSerializer: new () => { serializeToString(node: unknown): string };
}
let domWindow: DomWindow | undefined;

// Stroke/fill colors and weights — enough to make CSS-styled lines visible.
// Deliberately excludes stroke-dasharray (svg-to-pdfkit rejects some values).
const SVG_PRESENTATION = new Set([
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "opacity",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
]);

/** Drop @-rules (e.g. @keyframes) so the simple rule regex stays well-behaved. */
function stripAtRules(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    if (css[i] !== "@") {
      out += css[i++];
      continue;
    }
    let j = i;
    while (j < css.length && css[j] !== "{" && css[j] !== ";") j++;
    if (css[j] === ";") {
      i = j + 1;
      continue;
    }
    let depth = 0;
    while (j < css.length) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}" && --depth === 0) {
        j++;
        break;
      }
      j++;
    }
    i = j;
  }
  return out;
}

/**
 * svg-to-pdfkit (used for pdf) ignores `<style>` CSS, so mermaid lines styled
 * by class (with an inline `stroke="none"` that CSS overrides) vanish while the
 * filled arrowheads remain. Promote the stylesheet rules to presentation
 * attributes — matching how an SVG renderer cascades CSS over those attributes.
 */
function inlineSvgCss(svg: string, win: DomWindow): string {
  if (!svg.includes("<style")) return svg;
  let doc: MinDoc;
  try {
    doc = new win.DOMParser().parseFromString(svg, "image/svg+xml");
  } catch {
    return svg;
  }
  for (const styleEl of Array.from(doc.querySelectorAll("style"))) {
    const css = stripAtRules(styleEl.textContent ?? "");
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = rule[1]!.trim();
      if (!selector) continue;
      let els: MinEl[];
      try {
        // Query at document level so selectors that reference the root svg's id
        // (mermaid scopes its rules by id) resolve correctly.
        els = Array.from(doc.querySelectorAll(selector));
      } catch {
        continue;
      }
      for (const decl of rule[2]!.split(";")) {
        const idx = decl.indexOf(":");
        if (idx < 0) continue;
        const prop = decl.slice(0, idx).trim().toLowerCase();
        const val = decl.slice(idx + 1).replace(/!important/gi, "").trim();
        if (!val || !SVG_PRESENTATION.has(prop)) continue;
        for (const el of els) el.setAttribute(prop, val);
      }
    }
  }
  // Neutralize stroke-dasharray (mermaid uses "1,0" for solid lines, which
  // pdfkit rejects once the line is actually stroked).
  for (const el of Array.from(doc.querySelectorAll("[stroke-dasharray]"))) {
    el.setAttribute("stroke-dasharray", "none");
  }
  for (const el of Array.from(doc.querySelectorAll("[style]"))) {
    const style = el.getAttribute("style");
    if (style && /stroke-dasharray/i.test(style)) {
      el.setAttribute(
        "style",
        style.replace(/stroke-dasharray\s*:[^;]*;?/gi, ""),
      );
    }
  }
  try {
    return new win.XMLSerializer().serializeToString(doc.documentElement);
  } catch {
    return svg;
  }
}

async function ensureMermaid(): Promise<MermaidModule> {
  init ??= (async () => {
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM("<!DOCTYPE html><body></body>", {
      pretendToBeVisual: true,
    });
    const w = dom.window as unknown as Record<string, unknown>;
    domWindow = dom.window as unknown as DomWindow;
    const g = globalThis as unknown as Record<string, unknown>;
    g.window ??= w;
    g.document ??= w.document;
    for (const k of [
      "CSSStyleSheet",
      "Element",
      "SVGElement",
      "Node",
      "DOMParser",
      "XMLSerializer",
      "HTMLElement",
      "getComputedStyle",
    ]) {
      if (w[k] && !(k in g)) g[k] = w[k];
    }
    // jsdom does not implement SVG layout/measurement; provide rough stubs so
    // mermaid (with htmlLabels off) can size nodes. Text width is estimated from
    // character count; node boxes get a constant size.
    const svgProto = (w.SVGElement as { prototype: Record<string, unknown> })
      ?.prototype;
    if (svgProto) {
      svgProto.getBBox ??= function (this: { textContent?: string }) {
        const len = (this.textContent ?? "").length;
        return { x: 0, y: 0, width: Math.max(40, len * 8), height: 24 };
      };
      svgProto.getComputedTextLength ??= function (this: {
        textContent?: string;
      }) {
        return (this.textContent ?? "").length * 8;
      };
      svgProto.getSubStringLength ??= function (
        this: unknown,
        _start: number,
        length: number,
      ) {
        return length * 8;
      };
    }

    const mermaid = (await import("mermaid")).default as unknown as MermaidModule;
    mermaid.initialize(BASE_CONFIG);
    return mermaid;
  })();
  return init;
}

const BASE_CONFIG = {
  startOnLoad: false,
  securityLevel: "loose",
  htmlLabels: false,
  flowchart: { htmlLabels: false },
} as const;

/** Map a deck's theme tokens to mermaid theme variables (brand-consistent). */
function mermaidThemeVars(t: ThemeTokens): Record<string, string> {
  return {
    primaryColor: t.color.surface,
    primaryBorderColor: t.color.accent,
    primaryTextColor: t.color.fg,
    lineColor: t.color.muted,
    secondaryColor: t.color.series[1] ?? t.color.accent,
    tertiaryColor: t.color.series[2] ?? t.color.surface,
    background: t.color.bg,
    fontFamily: t.font.body,
  };
}

/** Re-initialize mermaid so diagrams use the deck's colors. */
async function configureMermaidTheme(t: ThemeTokens): Promise<void> {
  const mermaid = await ensureMermaid();
  mermaid.initialize({
    ...BASE_CONFIG,
    theme: "base",
    themeVariables: mermaidThemeVars(t),
  });
}

/** The built-in headless mermaid renderer. */
export const renderMermaidSvg: MermaidRenderer = async (source) => {
  const mermaid = await ensureMermaid();
  const { svg } = await mermaid.render(`dexel-mermaid-${counter++}`, source);
  return domWindow ? inlineSvgCss(svg, domWindow) : svg;
};

/**
 * Pre-render every mermaid source in a deck to SVG (keyed by source). Renderers
 * are synchronous once drawing, so mermaid must be resolved up front. Returns an
 * empty map when mermaid is disabled.
 */
export async function prerenderMermaid(
  deck: SlideDeck,
  option: MermaidOption | undefined,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!option) return out;
  let renderer: MermaidRenderer;
  if (typeof option === "function") {
    renderer = option;
  } else {
    // Built-in: tint mermaid with the deck's theme colors.
    await configureMermaidTheme(resolveDeckTheme(deck.theme));
    renderer = renderMermaidSvg;
  }
  for (const slide of deck.slides) {
    for (const block of slide.blocks) {
      if (
        block.type === "diagram" &&
        block.kind === "mermaid" &&
        !out.has(block.source)
      ) {
        out.set(block.source, await renderer(block.source));
      }
    }
  }
  return out;
}
