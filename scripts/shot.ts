// Screenshot HTML slides to PNG — a dev helper for eyeballing `htmlslides` output.
//
//   npm run build                         # needed: the script imports dist/
//   npm run shot -- deck.json             # → shots/deck-1.png, deck-2.png, ...
//   npm run shot -- a.json b.html         # decks and/or pre-rendered HTML
//   npm run shot -- deck.json --out pics --scale 3 --embed-font
//
// Renders each input to the `htmlslides` target (JSON decks) or loads it
// directly (.html), opens it in headless Chromium, and writes one PNG per
// slide. Requires the optional `puppeteer` dev dependency (bundles Chromium).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", default: "shots" },
    scale: { type: "string", default: "2" },
    "embed-font": { type: "boolean", default: false },
    full: { type: "boolean", default: false },
  },
});

if (positionals.length === 0) {
  console.error(
    "usage: npm run shot -- <deck.json|slides.html>... [--out dir] [--scale n] [--embed-font] [--full]",
  );
  process.exit(1);
}

const scale = Number(values.scale) || 2;
const outDir = resolve(values.out ?? "shots");

const puppeteer = await import("puppeteer").then(
  (m) => m.default,
  () => {
    console.error(
      "This script needs puppeteer (bundles Chromium):\n  npm i -D puppeteer",
    );
    process.exit(1);
  },
);

// JSON decks are rendered via the package; .html inputs are used as-is.
const { renderHtmlSlides, SlideDeck } = await import("dexel").catch(() => {
  console.error("Could not import 'dexel'. Run `npm run build` first.");
  process.exit(1);
});

/** Resolve an input path to an HTML string + a base name for the output files. */
async function toHtml(path: string): Promise<{ name: string; html: string }> {
  const name = basename(path).replace(/\.(json|html?)$/i, "");
  if (/\.html?$/i.test(path)) {
    return { name, html: await readFile(path, "utf8") };
  }
  const deck = SlideDeck.parse(JSON.parse(await readFile(path, "utf8")));
  return {
    name,
    html: renderHtmlSlides(deck, { embedFont: values["embed-font"] }),
  };
}

await mkdir(outDir, { recursive: true });
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: scale });

  for (const input of positionals) {
    const { name, html } = await toHtml(input);
    // Load via a temp file so file:// relative assets (if any) resolve.
    const tmp = join(tmpdir(), `dexel-shot-${name}-${Date.now()}.html`);
    await writeFile(tmp, html);
    await page.goto(`file://${tmp}`, { waitUntil: "networkidle0" });

    if (values.full) {
      const out = join(outDir, `${name}.png`);
      await page.screenshot({ path: out, fullPage: true });
      console.log("wrote", out);
      continue;
    }

    const slides = await page.$$(".slide");
    if (slides.length === 0) {
      console.warn(`no .slide elements in ${input} — skipped`);
      continue;
    }
    for (let i = 0; i < slides.length; i++) {
      const out = join(outDir, `${name}-${i + 1}.png`);
      await slides[i]!.screenshot({ path: out });
      console.log("wrote", out);
    }
  }
} finally {
  await browser.close();
}
