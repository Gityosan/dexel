import { describe, expect, it } from "vitest";
import {
  render,
  renderHtml,
  renderHtmlSlides,
  renderMarkdown,
  SlideDeck,
} from "../src/index.js";

const deck = SlideDeck.parse({
  theme: "corporate",
  aspect: "16:9",
  slides: [
    {
      layout: "title",
      blocks: [
        { type: "text", variant: "heading", text: "Q3 レビュー" },
        { type: "text", variant: "subheading", text: "2026" },
      ],
    },
    {
      layout: "bullet-list",
      blocks: [
        { type: "text", variant: "heading", text: "成果" },
        { type: "text", variant: "body", text: "今期のハイライト" },
        {
          type: "list",
          items: [
            { text: "売上 +20%" },
            { text: "解約率 -3%", level: 1 },
          ],
        },
      ],
    },
  ],
});

describe("renderMarkdown", () => {
  const md = renderMarkdown(deck);

  it("keeps body text as real text (Japanese preserved)", () => {
    expect(md).toContain("Q3 レビュー");
    expect(md).toContain("今期のハイライト");
  });

  it("uses h1 for title-slide headings and h2 elsewhere", () => {
    expect(md).toContain("# Q3 レビュー");
    expect(md).toContain("## 成果");
  });

  it("demotes lists with nesting and a slide separator", () => {
    expect(md).toContain("- 売上 +20%");
    expect(md).toContain("  - 解約率 -3%");
    expect(md).toContain("\n---\n");
  });

  it("renders rich text runs (bold / highlight) inline", () => {
    const d = SlideDeck.parse({
      slides: [
        {
          layout: "title-content",
          blocks: [
            {
              type: "text",
              variant: "heading",
              text: [
                { text: "Plain " },
                { text: "marked", highlight: "#FFF176", bold: true },
              ],
            },
          ],
        },
      ],
    });
    expect(renderMarkdown(d)).toContain("<mark style=\"background:#FFF176\">**marked**</mark>");
    const html = renderHtml(d);
    expect(html).toContain("font-weight:bold");
    expect(html).toContain("background:#FFF176");
  });

  it("inlines structured diagrams as SVG", () => {
    const d = SlideDeck.parse({
      slides: [
        {
          layout: "title-content",
          blocks: [
            { type: "text", variant: "heading", text: "図" },
            {
              type: "diagram",
              kind: "structured",
              pattern: "flow",
              slot: "body",
              nodes: [
                { id: "a", label: "Start" },
                { id: "b", label: "End" },
              ],
              edges: [{ from: "a", to: "b" }],
            },
          ],
        },
      ],
    });
    const md = renderMarkdown(d);
    expect(md).toContain("<svg");
    expect(md).toContain(">Start<");
  });

  it("fences mermaid diagrams", () => {
    const d = SlideDeck.parse({
      slides: [
        {
          layout: "title-content",
          blocks: [
            { type: "text", variant: "heading", text: "図" },
            {
              type: "diagram",
              kind: "mermaid",
              slot: "body",
              source: "graph TD; A-->B",
            },
          ],
        },
      ],
    });
    expect(renderMarkdown(d)).toContain("```mermaid\ngraph TD; A-->B\n```");
  });
});

describe("renderHtml", () => {
  const html = renderHtml(deck);

  it("emits semantic tags with preserved text", () => {
    expect(html).toContain("<h1>Q3 レビュー</h1>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>売上 +20%</li>");
  });

  it("escapes HTML-significant characters", () => {
    const d = SlideDeck.parse({
      slides: [
        {
          layout: "title-content",
          blocks: [
            { type: "text", variant: "heading", text: "A & B <c>" },
          ],
        },
      ],
    });
    const out = renderHtml(d);
    expect(out).toContain("A &amp; B &lt;c&gt;");
    expect(out).not.toContain("<c>");
  });
});

describe("renderHtmlSlides", () => {
  const d = SlideDeck.parse({
    chrome: { pageNumbers: true },
    slides: [
      {
        layout: "title-content",
        blocks: [
          {
            type: "text",
            variant: "heading",
            text: [{ text: "H " }, { text: "hi", highlight: "#FFEE00" }],
          },
          { type: "text", variant: "body", text: "body" },
        ],
      },
    ],
  });
  const html = renderHtmlSlides(d);

  it("lays out absolutely positioned slots on a fixed-size slide", () => {
    expect(html).toContain("class=\"slide\"");
    expect(html).toContain("position:absolute");
    expect(html).toContain("@page"); // printable to PDF
  });

  it("renders rich highlight via CSS and a page number", () => {
    expect(html).toContain("background:#FFEE00");
    expect(html).toContain("1 / 1");
  });
});

describe("render dispatch", () => {
  it("routes the text targets", () => {
    expect(render(deck, "md")).toBe(renderMarkdown(deck));
    expect(render(deck, "html")).toBe(renderHtml(deck));
  });
});
