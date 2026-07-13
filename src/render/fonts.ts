import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FONT_REL = ["assets", "fonts", "noto-sans-jp-subset.ttf"];

let cached: string | null | undefined;

/**
 * Resolve the bundled default Japanese font (a Noto Sans JP subset covering
 * Latin, kana, and the common kanji range). Walks up from this module so it
 * works both from `dist/` and from `src/` during tests. Returns undefined if the
 * asset is missing (e.g. a stripped install).
 */
export function bundledJpFontPath(): string | undefined {
  if (cached !== undefined) return cached ?? undefined;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, ...FONT_REL);
    if (existsSync(candidate)) {
      cached = candidate;
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  cached = null;
  return undefined;
}
