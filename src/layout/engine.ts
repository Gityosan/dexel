import type {
  Block,
  LayoutPattern,
  LayoutTemplate,
  Slide,
  SlideDeck,
  Slot,
  SlotRole,
} from "../ir/index.js";
import { getLayoutTemplate } from "./templates.js";

/** A block bound to a concrete slot. */
export interface PlacedBlock {
  slot: Slot;
  block: Block;
}

/** A slide whose blocks have been resolved onto its layout template's slots. */
export interface ResolvedSlide {
  layout: LayoutPattern;
  template: LayoutTemplate;
  /** Placements ordered by the template's `flowOrder` (drives flow demotion). */
  placements: PlacedBlock[];
  /** Blocks with no available slot — surfaced rather than silently dropped. */
  overflow: Block[];
  /** Speaker notes carried through from the slide (used by pptx). */
  notes?: string;
}

/**
 * The slot roles a block can occupy, most-preferred first. Used to auto-assign
 * blocks to slots when no explicit `slot` is given.
 */
export function blockRoles(block: Block): SlotRole[] {
  switch (block.type) {
    case "text":
      switch (block.variant) {
        case "heading":
          return ["heading"];
        case "subheading":
          return ["subheading", "heading"];
        default:
          return ["body"];
      }
    case "list":
      return ["body"];
    case "code":
      return ["code", "body"];
    case "diagram":
      return ["diagram", "image", "body"];
    case "image":
      return ["image", "diagram", "body"];
    case "kpi":
      return ["kpi", "body"];
  }
}

/**
 * Bind a slide's blocks to its template slots. Explicit `block.slot` bindings are
 * honored first; the rest are auto-assigned to the first free role-compatible
 * slot, then to any free slot. Anything left over becomes overflow.
 */
export function resolveSlide(slide: Slide): ResolvedSlide {
  const template = getLayoutTemplate(slide.layout);
  const slotById = new Map(template.slots.map((s) => [s.id, s]));
  const used = new Set<string>();
  const placements: PlacedBlock[] = [];
  const overflow: Block[] = [];

  // Pass 1: explicit bindings.
  const auto: Block[] = [];
  for (const block of slide.blocks) {
    if (block.slot === undefined) {
      auto.push(block);
      continue;
    }
    const slot = slotById.get(block.slot);
    if (slot && !used.has(slot.id)) {
      used.add(slot.id);
      placements.push({ slot, block });
    } else {
      overflow.push(block);
    }
  }

  // Pass 2: auto-assignment by role, then by any free slot.
  for (const block of auto) {
    let target: Slot | undefined;
    for (const role of blockRoles(block)) {
      target = template.slots.find((s) => !used.has(s.id) && s.role === role);
      if (target) break;
    }
    target ??= template.slots.find((s) => !used.has(s.id));
    if (target) {
      used.add(target.id);
      placements.push({ slot: target, block });
    } else {
      overflow.push(block);
    }
  }

  // Order placements by flowOrder so renderers can walk them directly.
  const rank = new Map(template.flowOrder.map((id, i) => [id, i]));
  placements.sort(
    (a, b) =>
      (rank.get(a.slot.id) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(b.slot.id) ?? Number.MAX_SAFE_INTEGER),
  );

  return {
    layout: slide.layout,
    template,
    placements,
    overflow,
    ...(slide.notes !== undefined ? { notes: slide.notes } : {}),
  };
}

/** Resolve every slide in a deck. */
export function resolveDeck(deck: SlideDeck): ResolvedSlide[] {
  return deck.slides.map(resolveSlide);
}
