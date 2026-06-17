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

/** Deck chrome drawn on content slides (not title / section-divider). */
export const DeckChrome = z.object({
  pageNumbers: z.boolean().default(false),
  footer: z.string().optional(),
  /** Logo image (file path or data URI), placed top-right. */
  logo: z.string().optional(),
});

export type DeckChrome = z.infer<typeof DeckChrome>;

/** The whole deck: the root of the intermediate representation. */
export const SlideDeck = z.object({
  theme: ThemeRef.default("default"),
  aspect: Aspect.default("16:9"),
  meta: DeckMeta.optional(),
  chrome: DeckChrome.optional(),
  slides: z.array(Slide),
});

export type SlideDeck = z.infer<typeof SlideDeck>;
