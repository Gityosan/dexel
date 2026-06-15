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
