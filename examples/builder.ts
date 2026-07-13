// Programmatic deck authoring with the stateful builder.
//
//   npm run build     # produces dist/ that "dexel" resolves to
//   npm run example   # runs this file via unrun
//
// Writes examples/out/deck.{md,html,pptx,pdf}.
import { mkdir, writeFile } from "node:fs/promises";
import { createDeck } from "dexel";

const deck = createDeck({ theme: "vivid", aspect: "16:9" });

deck.addSection("title", [
  { type: "text", variant: "heading", text: "四半期レビュー" },
  { type: "text", variant: "subheading", text: "2026 Q3" },
]);

deck.addSection("kpi-highlight", [
  { type: "text", variant: "heading", text: "ハイライト" },
  { type: "kpi", value: "+20%", label: "売上" },
  { type: "kpi", value: "-3pt", label: "解約率" },
]);

// add_section echoes the deck summary every call (the context-degradation
// mitigation): the section list plus the selectable patterns and their slots.
const summary = deck.addSection("title-content", [
  { type: "text", variant: "heading", text: "ファネル" },
  {
    type: "diagram",
    kind: "structured",
    pattern: "funnel",
    slot: "body",
    nodes: [
      { id: "a", label: "訪問", value: 1000 },
      { id: "b", label: "登録", value: 400 },
      { id: "c", label: "課金", value: 80 },
    ],
    edges: [],
  },
]);

console.log(`sections: ${summary.sectionCount}`);
console.log(`available layouts: ${summary.availableLayouts.join(", ")}`);

const out = new URL("./out/", import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL("deck.md", out), deck.render("md"));
await writeFile(new URL("deck.html", out), deck.render("html"));
await writeFile(new URL("deck.pptx", out), await deck.renderToBuffer("pptx"));
await writeFile(new URL("deck.pdf", out), await deck.renderToBuffer("pdf"));
console.log("wrote examples/out/deck.{md,html,pptx,pdf}");
