import type {
  Aspect,
  BlockInput,
  LayoutPattern,
  SlideDeck,
  SlotRole,
  ThemeRef,
} from "../ir/index.js";
import { Slide, SlideDeck as SlideDeckSchema } from "../ir/index.js";
import {
  getLayoutTemplate,
  resolveSlide,
  supportedLayouts,
} from "../layout/index.js";
import {
  type BinaryTarget,
  render,
  type RenderOptions,
  renderToBuffer,
  type TextTarget,
} from "../render/index.js";

/** A compact description of one section in the deck. */
export interface SectionSummary {
  index: number;
  layout: LayoutPattern;
  blockCount: number;
  /** Number of blocks that did not fit the layout's slots. */
  overflow: number;
}

/** The slots a layout offers, surfaced to guide block authoring. */
export interface LayoutHint {
  pattern: LayoutPattern;
  slots: { id: string; role: SlotRole }[];
}

/**
 * The deck state echoed back after every mutation. Re-stating the section list
 * and the selectable patterns on each call is the spec's context-degradation
 * mitigation: a long-running builder never loses track of its options.
 */
export interface DeckSummary {
  theme: ThemeRef;
  aspect: Aspect;
  sectionCount: number;
  sections: SectionSummary[];
  /** Patterns that may be passed to `addSection` (enumerated, not free-form). */
  availableLayouts: LayoutPattern[];
  /** Slot layout for each available pattern. */
  layoutHints: LayoutHint[];
}

function layoutHints(): LayoutHint[] {
  return supportedLayouts.map((pattern) => ({
    pattern,
    slots: getLayoutTemplate(pattern).slots.map((s) => ({
      id: s.id,
      role: s.role,
    })),
  }));
}

/**
 * A stateful deck builder. Sections are stacked one pattern at a time; the full
 * deck is held as validated IR so it can be exported/imported as JSON for
 * stateless reproduction.
 */
export class DeckSession {
  private deck: SlideDeck;

  constructor(deck: SlideDeck) {
    this.deck = deck;
  }

  /** Append a section and return the refreshed deck summary. */
  addSection(layout: LayoutPattern, blocks: BlockInput[]): DeckSummary {
    // Validate the section as IR before committing it.
    const slide = Slide.parse({ layout, blocks });
    // Surface fit problems early rather than at render time.
    getLayoutTemplate(layout);
    this.deck.slides.push(slide);
    return this.summary();
  }

  summary(): DeckSummary {
    return {
      theme: this.deck.theme,
      aspect: this.deck.aspect,
      sectionCount: this.deck.slides.length,
      sections: this.deck.slides.map((slide, index) => {
        const resolved = resolveSlide(slide);
        return {
          index,
          layout: slide.layout,
          blockCount: slide.blocks.length,
          overflow: resolved.overflow.length,
        };
      }),
      availableLayouts: [...supportedLayouts],
      layoutHints: layoutHints(),
    };
  }

  /** Render the deck to a text target (md / html). */
  render(target: TextTarget): string {
    return render(this.deck, target);
  }

  /** Render the deck to a binary target (pptx / pdf). */
  renderToBuffer(target: BinaryTarget, opts?: RenderOptions): Promise<Buffer> {
    return renderToBuffer(this.deck, target, opts);
  }

  /** The validated deck IR, for `export_deck_json`. */
  toJSON(): SlideDeck {
    return this.deck;
  }

  /** Rebuild a session from previously exported IR (`import_deck_json`). */
  static fromJSON(deck: unknown): DeckSession {
    return new DeckSession(SlideDeckSchema.parse(deck));
  }
}

/** Create a new builder session (`create_deck`). */
export function createDeck(opts?: {
  theme?: ThemeRef;
  aspect?: Aspect;
}): DeckSession {
  const deck = SlideDeckSchema.parse({
    theme: opts?.theme,
    aspect: opts?.aspect,
    slides: [],
  });
  return new DeckSession(deck);
}
