import { describe, expect, it } from "vitest";
import {
  Block,
  renderDiagramSvg,
  renderHtml,
  renderMarkdown,
  SlideDeck,
  type StructuredDiagram,
} from "../src/index.js";

// A representative deck spanning layouts and block types. Markdown/HTML/SVG
// output is fully deterministic, so snapshots give regression coverage on the
// exact rendered text (binary pptx/pdf are covered by structural assertions).
const deck = SlideDeck.parse({
  theme: "corporate",
  slides: [
    {
      layout: "title",
      blocks: [
        { type: "text", variant: "heading", text: "Dexel デモ" },
        { type: "text", variant: "subheading", text: "2026 Q3" },
      ],
    },
    {
      layout: "title-content",
      blocks: [
        { type: "text", variant: "heading", text: "概要" },
        {
          type: "list",
          items: [{ text: "ポイント1" }, { text: "詳細", level: 1 }],
        },
      ],
    },
    {
      layout: "kpi-highlight",
      blocks: [
        { type: "text", variant: "heading", text: "指標" },
        { type: "kpi", value: "99%", label: "Uptime" },
        { type: "kpi", value: "12ms", label: "p50", caption: "median" },
      ],
    },
    {
      layout: "comparison",
      blocks: [
        { type: "text", variant: "heading", text: "比較" },
        { type: "text", variant: "subheading", text: "案A" },
        { type: "text", variant: "body", text: "速い" },
        { type: "text", variant: "subheading", text: "案B" },
        { type: "text", variant: "body", text: "安い" },
      ],
    },
    {
      layout: "quote",
      blocks: [
        { type: "text", variant: "body", text: "シンプルさは究極の洗練。" },
        { type: "text", variant: "subheading", text: "— Da Vinci" },
      ],
    },
    {
      layout: "grid-cards",
      blocks: [
        { type: "text", variant: "heading", text: "特徴" },
        { type: "text", variant: "body", text: "1ソース" },
        { type: "text", variant: "body", text: "複数形式" },
        { type: "text", variant: "body", text: "実テキスト" },
      ],
    },
    {
      layout: "code",
      blocks: [
        { type: "text", variant: "heading", text: "使い方" },
        { type: "code", language: "ts", code: 'render(deck, "md");' },
      ],
    },
    {
      layout: "title-content",
      blocks: [
        { type: "text", variant: "heading", text: "フロー" },
        {
          type: "diagram",
          kind: "structured",
          pattern: "flow",
          slot: "body",
          nodes: [
            { id: "a", label: "入力" },
            { id: "b", label: "変換" },
            { id: "c", label: "出力" },
          ],
          edges: [
            { from: "a", to: "b" },
            { from: "b", to: "c" },
          ],
        },
      ],
    },
  ],
});

function structured(over: Record<string, unknown>): StructuredDiagram {
  return Block.parse({
    type: "diagram",
    kind: "structured",
    ...over,
  }) as StructuredDiagram;
}

describe("output snapshots", () => {
  it("renders the deck to Markdown", () => {
    expect(renderMarkdown(deck)).toMatchSnapshot();
  });

  it("renders the deck to HTML", () => {
    expect(renderHtml(deck)).toMatchSnapshot();
  });

  it("renders a funnel diagram to SVG", () => {
    const svg = renderDiagramSvg(
      structured({
        pattern: "funnel",
        nodes: [
          { id: "a", label: "Leads", value: 100 },
          { id: "b", label: "Qualified", value: 60 },
          { id: "c", label: "Won", value: 25 },
        ],
        edges: [],
      }),
    );
    expect(svg).toMatchSnapshot();
  });

  it("renders a venn diagram to SVG", () => {
    const svg = renderDiagramSvg(
      structured({
        pattern: "venn",
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        edges: [],
      }),
    );
    expect(svg).toMatchSnapshot();
  });
});
