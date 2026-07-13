import { describe, expect, it } from "vitest";
import { canvasPt, placeRect } from "../src/index.js";

describe("geometry", () => {
  it("uses PowerPoint-compatible point canvases", () => {
    expect(canvasPt("16:9")).toEqual({ w: 960, h: 540 });
    expect(canvasPt("4:3")).toEqual({ w: 720, h: 540 });
  });

  it("resolves normalized rects onto an absolute canvas", () => {
    const canvas = canvasPt("16:9");
    expect(placeRect({ x: 0.5, y: 0.5, w: 0.25, h: 0.5 }, canvas)).toEqual({
      x: 480,
      y: 270,
      w: 240,
      h: 270,
    });
  });
});
