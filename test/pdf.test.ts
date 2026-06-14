import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderPdf, renderToBuffer, SlideDeck } from "../src/index.js";

/** A CJK-capable font, if one is available on this machine. */
const JP_FONT = [
  "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
  "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
  "/etc/alternatives/fonts-japanese-gothic.ttf",
].find((p) => existsSync(p));

const isPdf = (buf: Buffer) => buf.subarray(0, 5).toString("latin1") === "%PDF-";

const latinDeck = SlideDeck.parse({
  theme: "minimal",
  slides: [
    {
      layout: "title",
      blocks: [
        { type: "text", variant: "heading", text: "Hello" },
        { type: "text", variant: "subheading", text: "World" },
      ],
    },
  ],
});

describe("renderPdf", () => {
  it("produces a valid PDF with the standard Latin fonts", async () => {
    const buf = await renderPdf(latinDeck);
    expect(isPdf(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
  });

  it("is reachable through renderToBuffer", async () => {
    const buf = await renderToBuffer(latinDeck, "pdf");
    expect(isPdf(buf)).toBe(true);
  });

  it.skipIf(!JP_FONT)(
    "embeds and subsets a Japanese font so JP text renders (the MVP gate)",
    async () => {
      const deck = SlideDeck.parse({
        slides: [
          {
            layout: "title-content",
            blocks: [
              { type: "text", variant: "heading", text: "日本語の見出し" },
              {
                type: "text",
                variant: "body",
                text: "本文も実テキストとして埋め込まれる。",
              },
            ],
          },
        ],
      });

      const buf = await renderPdf(deck, {
        fonts: { body: JP_FONT, heading: JP_FONT, mono: JP_FONT },
      });

      expect(isPdf(buf)).toBe(true);
      // An embedded TrueType program is present...
      expect(buf.toString("latin1")).toContain("FontFile2");
      // ...but subset, so the output is far smaller than the ~6MB source font.
      expect(buf.length).toBeLessThan(2_000_000);
    },
  );
});
