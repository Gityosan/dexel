/**
 * Headless mermaid → SVG rendering.
 *
 * mermaid is browser-oriented, so we host it on a jsdom DOM and stub the SVG
 * measurement API (`getBBox`) jsdom lacks. `htmlLabels` is disabled so labels
 * are real SVG `<text>` (no `<foreignObject>`), which keeps the output embeddable
 * by svg-to-pdfkit. The DOM + mermaid are initialized lazily and once.
 */

/** Renders mermaid source to an SVG string. */
export type MermaidRenderer = (source: string) => Promise<string>;

type MermaidModule = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
};

let init: Promise<MermaidModule> | undefined;
let counter = 0;

async function ensureMermaid(): Promise<MermaidModule> {
  init ??= (async () => {
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM("<!DOCTYPE html><body></body>", {
      pretendToBeVisual: true,
    });
    const w = dom.window as unknown as Record<string, unknown>;
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
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      htmlLabels: false,
      flowchart: { htmlLabels: false },
    });
    return mermaid;
  })();
  return init;
}

/** The built-in headless mermaid renderer. */
export const renderMermaidSvg: MermaidRenderer = async (source) => {
  const mermaid = await ensureMermaid();
  const { svg } = await mermaid.render(`dexel-mermaid-${counter++}`, source);
  return svg;
};
