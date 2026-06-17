import { z } from "zod";
import { Slide } from "./slide.js";
import { ThemeRef } from "./theme.js";

/** Supported canvas aspect ratios. The ratio gap is absorbed via slot vAnchor. */
export const Aspect = z.enum(["16:9", "4:3"]);

export type Aspect = z.infer<typeof Aspect>;

/** Optional deck-level metadata, surfaced on title slides and document headers. */
export const DeckMeta = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  date: z.string().optional(),
});

export type DeckMeta = z.infer<typeof DeckMeta>;

/** The whole deck: the root of the intermediate representation. */
export const SlideDeck = z.object({
  theme: ThemeRef.default("default"),
  aspect: Aspect.default("16:9"),
  meta: DeckMeta.optional(),
  slides: z.array(Slide),
});

export type SlideDeck = z.infer<typeof SlideDeck>;
