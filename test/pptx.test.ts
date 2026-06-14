import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { renderPptx, renderToBuffer, SlideDeck } from "../src/index.js";

async function slideXml(buf: Buffer, n = 1): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  return zip.file(`ppt/slides/slide${n}.xml`)!.async("string");
}

const deck = SlideDeck.parse({
  theme: "corporate",
  aspect: "16:9",
  meta: { title: "Deck", author: "Ada" },
  slides: [
    {
      layout: "title",
      blocks: [
        { type: "text", variant: "heading", text: "タイトル" },
        { type: "text", variant: "subheading", text: "Subtitle" },
      ],
    },
    {
      layout: "bullet-list",
      blocks: [
        { type: "text", variant: "heading", text: "Agenda" },
        { type: "list", items: [{ text: "one" }, { text: "two", level: 1 }] },
      ],
    },
  ],
});

describe("renderPptx", () => {
  it("produces a valid .pptx (zip) buffer", async () => {
    const buf = await renderPptx(deck);
    expect(buf.length).toBeGreaterThan(1000);
    // PPTX is an OPC zip; zip files start with the local file header "PK\x03\x04".
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("is reachable through renderToBuffer", async () => {
    const buf = await renderToBuffer(deck, "pptx");
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("4:3 decks render too", async () => {
    const buf = await renderPptx(SlideDeck.parse({ aspect: "4:3", slides: [] }));
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("renders structured diagrams as native shapes (rounded rects + lines)", async () => {
    const buf = await renderPptx(
      SlideDeck.parse({
        slides: [
          {
            layout: "title-content",
            blocks: [
              { type: "text", variant: "heading", text: "Flow" },
              {
                type: "diagram",
                kind: "structured",
                pattern: "flow",
                slot: "body",
                nodes: [
                  { id: "a", label: "Alpha" },
                  { id: "b", label: "Beta" },
                ],
                edges: [{ from: "a", to: "b" }],
              },
            ],
          },
        ],
      }),
    );
    const xml = await slideXml(buf);
    // Native geometry, not an image or a text placeholder.
    expect(xml).toContain('prst="roundRect"');
    expect(xml).toContain('prst="line"');
    // Node labels are real text inside the shapes.
    expect(xml).toContain("<a:t>Alpha</a:t>");
    expect(xml).toContain("<a:t>Beta</a:t>");
  });
});
