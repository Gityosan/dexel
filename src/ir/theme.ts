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
