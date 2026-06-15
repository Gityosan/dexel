import { describe, expect, it } from "vitest";
import {
  bestOn,
  getTheme,
  mix,
  relativeLuminance,
  resolveTheme,
} from "../src/index.js";

describe("color utilities", () => {
  it("mixes hex colors linearly", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mix("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(mix("#000000", "#FFFFFF", 1)).toBe("#FFFFFF");
  });

  it("computes relative luminance", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("picks a legible on-color by contrast", () => {
    expect(bestOn("#0F172A")).toBe("#FFFFFF"); // dark → white text
    expect(bestOn("#FACC15")).toBe("#111111"); // light → dark text
  });
});

describe("resolveTheme", () => {
  it("derives the neutral ramp, onAccent, and series when omitted", () => {
    const t = resolveTheme({
      color: { bg: "#FFFFFF", fg: "#000000", accent: "#2563EB" },
    });
    expect(t.color.surface).toBe(mix("#FFFFFF", "#000000", 0.05));
    expect(t.color.border).toBe(mix("#FFFFFF", "#000000", 0.14));
    expect(t.color.muted).toBe(mix("#FFFFFF", "#000000", 0.45));
    expect(t.color.onAccent).toBe("#FFFFFF");
    expect(t.color.series.length).toBeGreaterThanOrEqual(4);
    expect(t.font.body).toBe("Noto Sans JP");
  });

  it("respects explicit overrides", () => {
    const t = resolveTheme({
      color: {
        bg: "#FFFFFF",
        fg: "#000000",
        accent: "#2563EB",
        muted: "#ABCDEF",
        series: ["#111111", "#222222"],
      },
    });
    expect(t.color.muted).toBe("#ABCDEF");
    expect(t.color.series).toEqual(["#111111", "#222222"]);
  });
});

describe("built-in themes", () => {
  it("expose a curated series and derived neutrals", () => {
    const t = getTheme("default");
    expect(t.color.series).toHaveLength(6);
    expect(t.color.onAccent).toBeTruthy();
    expect(t.color.surface).toBeTruthy();
    expect(t.color.border).toBeTruthy();
  });
});
