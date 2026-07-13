import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "citty";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { main } from "../src/cli/index.js";

let dir: string;
let deckPath: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "dexel-cli-"));
  deckPath = join(dir, "deck.json");
  await writeFile(
    deckPath,
    JSON.stringify({
      theme: "corporate",
      slides: [
        {
          layout: "title",
          blocks: [{ type: "text", variant: "heading", text: "見出し" }],
        },
      ],
    }),
  );
});

afterAll(() => {
  process.exitCode = 0;
});

describe("dexel CLI", () => {
  it("renders a deck to a markdown file", async () => {
    const out = join(dir, "out.md");
    await runCommand(main, {
      rawArgs: ["render", deckPath, "--target", "md", "--out", out],
    });
    expect(await readFile(out, "utf8")).toContain("# 見出し");
  });

  it("renders a deck to a pptx file", async () => {
    const out = join(dir, "out.pptx");
    await runCommand(main, {
      rawArgs: ["render", deckPath, "-t", "pptx", "-o", out],
    });
    const buf = await readFile(out);
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("errors (exit code 1) on a binary target without --out", async () => {
    process.exitCode = 0;
    await runCommand(main, { rawArgs: ["render", deckPath, "-t", "pdf"] });
    expect(process.exitCode).toBe(1);
  });
});
