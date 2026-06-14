import type { ThemeName } from "../ir/index.js";

/**
 * The resolved design tokens for a theme. Kept renderer-agnostic: each target
 * maps these onto its own native theme mechanism (pptx theme colors/fonts, pdf
 * draw colors, CSS custom properties for md/html).
 */
export interface ThemeTokens {
  color: {
    /** Slide background. */
    bg: string;
    /** Primary text. */
    fg: string;
    /** Secondary / caption text. */
    muted: string;
    /** Accent used for headings, KPIs, and diagram strokes. */
    accent: string;
  };
  font: {
    heading: string;
    body: string;
    mono: string;
  };
}

const JP_SANS = "Noto Sans JP";
const JP_MONO = "Noto Sans Mono";

const base = {
  font: { heading: JP_SANS, body: JP_SANS, mono: JP_MONO },
} satisfies Pick<ThemeTokens, "font">;

/** Built-in themes, keyed by the IR's `ThemeName`. */
export const themes: Record<ThemeName, ThemeTokens> = {
  default: {
    color: { bg: "#FFFFFF", fg: "#1A1A1A", muted: "#6B7280", accent: "#2563EB" },
    ...base,
  },
  dark: {
    color: { bg: "#0F172A", fg: "#F1F5F9", muted: "#94A3B8", accent: "#38BDF8" },
    ...base,
  },
  corporate: {
    color: { bg: "#FFFFFF", fg: "#0B1F3A", muted: "#5B6B7F", accent: "#1D4ED8" },
    ...base,
  },
  minimal: {
    color: { bg: "#FAFAFA", fg: "#111111", muted: "#777777", accent: "#111111" },
    ...base,
  },
  vivid: {
    color: { bg: "#FFFFFF", fg: "#18181B", muted: "#71717A", accent: "#DB2777" },
    ...base,
  },
};

/** Resolve a theme's tokens by name. */
export function getTheme(name: ThemeName): ThemeTokens {
  return themes[name];
}

/** Strip a leading "#" from a hex color (pptx wants bare RRGGBB). */
export function bareHex(hex: string): string {
  return hex.startsWith("#") ? hex.slice(1) : hex;
}
