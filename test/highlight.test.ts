import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  lookupHighlight,
  prehighlightDeck,
  renderPptx,
  SlideDeck,
} from "../src/index.js";

const codeDeck = SlideDeck.parse({
  slides: [
    {
      layout: "code",
      blocks: [
        { type: "text", variant: "heading", text: "Code" },
        { type: "code", language: "ts", code: "const x: number = 1; // hi" },
      ],
    },
  ],
});

describe("syntax highlighting", () => {
  it("tokenizes code blocks with shiki", async () => {
    const map = await prehighlightDeck(codeDeck);
    const tokens = lookupHighlight(map, "ts", "const x: number = 1; // hi");
    expect(tokens).toBeTruthy();
    const colors = new Set(tokens!.flat().map((t) => t.color));
    expect(colors.size).toBeGreaterThan(2); // keyword/identifier/comment differ
  });

  it("skips blocks without a language", async () => {
    const map = await prehighlightDeck(
      SlideDeck.parse({
        slides: [
          {
            layout: "code",
            blocks: [
              { type: "text", variant: "heading", text: "x" },
              { type: "code", code: "plain text" },
            ],
          },
        ],
      }),
    );
    expect(map.size).toBe(0);
  });

  it("draws a filename tab above the code (pptx + html + md)", async () => {
    const deck = SlideDeck.parse({
      slides: [
        {
          layout: "code",
          blocks: [
            { type: "text", variant: "heading", text: "H" },
            { type: "code", language: "ts", filename: "app.ts", code: "const x=1;" },
          ],
        },
      ],
    });
    const { renderHtml, renderMarkdown } = await import("../src/index.js");
    expect(renderMarkdown(deck)).toContain("`app.ts`");
    const html = renderHtml(deck);
    expect(html).toContain("app.ts");
    expect(html).toContain("border-radius:6px 6px 0 0"); // rounded-top tab
    const zip = await JSZip.loadAsync(await renderPptx(deck));
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(xml).toContain('prst="round2SameRect"'); // top-rounded tab shape
    expect(xml).toContain("app.ts");
  });

  it("emits per-token colors in the pptx code shape", async () => {
    const zip = await JSZip.loadAsync(await renderPptx(codeDeck));
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    const colors = new Set(
      [...xml.matchAll(/srgbClr val="([0-9A-Fa-f]{6})"/g)].map((m) => m[1]),
    );
    // Several distinct token colors + padding inset (lIns) on the code box.
    expect(colors.size).toBeGreaterThan(3);
    expect(/lIns=/.test(xml)).toBe(true);
  });
});
