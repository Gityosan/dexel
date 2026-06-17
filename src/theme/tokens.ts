import type { ThemeName, ThemeSpec } from "../ir/index.js";
import { bestOn, mix } from "./color.js";

export interface ThemeFont {
  heading: string;
  body: string;
  mono: string;
}

/**
 * The fully-resolved design tokens a renderer consumes. Kept renderer-agnostic:
 * each target maps these onto its own native mechanism.
 */
export interface ThemeTokens {
  color: {
    /** Slide background. */
    bg: string;
    /** Primary text. */
    fg: string;
    /** Accent for headings, KPIs, and diagram strokes. */
    accent: string;
    /** Legible text color on an accent fill. */
    onAccent: string;
    /** Secondary / caption text. */
    muted: string;
    /** Panel/card/code background, a step off `bg`. */
    surface: string;
    /** Subtle outline/divider color. */
    border: string;
    /** Categorical palette for multi-item diagrams (funnel, venn, …). */
    series: string[];
  };
  font: ThemeFont;
}

const JP_SANS = "Noto Sans JP";
const JP_MONO = "Noto Sans Mono";

/** Sequential tints of the accent — a fallback when a theme omits `series`. */
function fallbackSeries(accent: string, bg: string, fg: string): string[] {
  return [
    accent,
    mix(accent, fg, 0.25),
    mix(accent, bg, 0.3),
    mix(accent, fg, 0.5),
    mix(accent, bg, 0.5),
    mix(accent, fg, 0.7),
  ];
}

/** Resolve an authored theme spec into full tokens, deriving what is omitted. */
export function resolveTheme(spec: ThemeSpec): ThemeTokens {
  const c = spec.color;
  return {
    color: {
      bg: c.bg,
      fg: c.fg,
      accent: c.accent,
      onAccent: c.onAccent ?? bestOn(c.accent),
      muted: c.muted ?? mix(c.bg, c.fg, 0.45),
      surface: c.surface ?? mix(c.bg, c.fg, 0.05),
      border: c.border ?? mix(c.bg, c.fg, 0.14),
      series: c.series ?? fallbackSeries(c.accent, c.bg, c.fg),
    },
    font: {
      heading: spec.font?.heading ?? JP_SANS,
      body: spec.font?.body ?? JP_SANS,
      mono: spec.font?.mono ?? JP_MONO,
    },
  };
}

/** Built-in theme specs (curated series; neutrals derived). */
const specs: Record<ThemeName, ThemeSpec> = {
  default: {
    color: {
      bg: "#FFFFFF",
      fg: "#1A1A1A",
      accent: "#2563EB",
      series: ["#2563EB", "#16A34A", "#F59E0B", "#DC2626", "#9333EA", "#0891B2"],
    },
  },
  dark: {
    color: {
      bg: "#0F172A",
      fg: "#F1F5F9",
      accent: "#38BDF8",
      series: ["#38BDF8", "#34D399", "#FBBF24", "#F87171", "#C084FC", "#22D3EE"],
    },
  },
  corporate: {
    color: {
      bg: "#FFFFFF",
      fg: "#0B1F3A",
      accent: "#1D4ED8",
      series: ["#1D4ED8", "#0E7490", "#15803D", "#B45309", "#7E22CE", "#475569"],
    },
  },
  minimal: {
    color: {
      bg: "#FAFAFA",
      fg: "#111111",
      accent: "#111111",
      series: ["#111111", "#444444", "#777777", "#9A9A9A", "#BDBDBD", "#DADADA"],
    },
  },
  vivid: {
    color: {
      bg: "#FFFFFF",
      fg: "#18181B",
      accent: "#DB2777",
      series: ["#DB2777", "#7C3AED", "#2563EB", "#059669", "#EA580C", "#CA8A04"],
    },
  },
};

/** Built-in resolved themes, keyed by the IR's `ThemeName`. */
export const themes: Record<ThemeName, ThemeTokens> = Object.fromEntries(
  (Object.keys(specs) as ThemeName[]).map((name) => [
    name,
    resolveTheme(specs[name]),
  ]),
) as Record<ThemeName, ThemeTokens>;

/** Resolve a theme's tokens by name. */
export function getTheme(name: ThemeName): ThemeTokens {
  return themes[name];
}

/** Resolve a deck's theme (a built-in name or a custom spec) to tokens. */
export function resolveDeckTheme(theme: ThemeName | ThemeSpec): ThemeTokens {
  return typeof theme === "string" ? getTheme(theme) : resolveTheme(theme);
}

/** Strip a leading "#" from a hex color (pptx wants bare RRGGBB). */
export function bareHex(hex: string): string {
  return hex.startsWith("#") ? hex.slice(1) : hex;
}

const NAMED_COLORS = new Set([
  "bg",
  "fg",
  "accent",
  "onAccent",
  "muted",
  "surface",
  "border",
]);

/**
 * Resolve a color reference from a block/node: a theme token name
 * (accent/muted/fg/…) maps to the theme; anything else is treated as a raw
 * color. Returns `fallback` when no reference is given.
 */
export function themeColor(
  t: ThemeTokens,
  ref: string | undefined,
  fallback: string,
): string {
  if (!ref) return fallback;
  if (NAMED_COLORS.has(ref)) {
    return (t.color as unknown as Record<string, string>)[ref] ?? fallback;
  }
  return ref;
}
