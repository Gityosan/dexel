import { z } from "zod";

/**
 * Predefined design-token themes. A deck selects a theme by name; the concrete
 * tokens (color / typography / spacing / diagram style) are resolved per target
 * at render time and mapped onto each target's native theme mechanism.
 */
export const ThemeName = z.enum([
  "default",
  "dark",
  "corporate",
  "minimal",
  "vivid",
]);

export type ThemeName = z.infer<typeof ThemeName>;

/** Authored theme colors. Only bg/fg/accent are required; the rest derive. */
export const ThemeColorSpec = z.object({
  bg: z.string(),
  fg: z.string(),
  accent: z.string(),
  muted: z.string().optional(),
  surface: z.string().optional(),
  border: z.string().optional(),
  onAccent: z.string().optional(),
  series: z.array(z.string()).optional(),
});
export type ThemeColorSpec = z.infer<typeof ThemeColorSpec>;

export const ThemeFontSpec = z.object({
  heading: z.string().optional(),
  body: z.string().optional(),
  mono: z.string().optional(),
});
export type ThemeFontSpec = z.infer<typeof ThemeFontSpec>;

/** Font sizes (pt) per role; any omitted size falls back to a default. */
export const ThemeTypeSpec = z.object({
  title: z.number().optional(),
  heading: z.number().optional(),
  subheading: z.number().optional(),
  body: z.number().optional(),
  kpi: z.number().optional(),
  code: z.number().optional(),
  caption: z.number().optional(),
});
export type ThemeTypeSpec = z.infer<typeof ThemeTypeSpec>;

/** A full custom theme spec (resolved to tokens at render time). */
export const ThemeSpec = z.object({
  color: ThemeColorSpec,
  font: ThemeFontSpec.optional(),
  type: ThemeTypeSpec.optional(),
});
export type ThemeSpec = z.infer<typeof ThemeSpec>;

/** A deck's theme: a built-in name, or a full custom spec. */
export const ThemeRef = z.union([ThemeName, ThemeSpec]);
export type ThemeRef = z.infer<typeof ThemeRef>;
