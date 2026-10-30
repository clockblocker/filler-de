/**
 * The projections the dictionary notes show (#120): German inflection
 * tables from the batteries' German Inflection Pack (`dumcorpus/inflection`,
 * projected by `dumdict/inflection`), drawn in the dictionary's line style
 * by the Lemma note codec, each Reading's Tags, and German's Morpheme Policy
 * (`dumcorpus/inventories`) for the morphemes line's walk (#268).
 */

import { inflectionFromPack } from "@textfresser/lemma-note-codec";
import { readingTags } from "@textfresser/lemma-note-projections";
import { inflectionPacks } from "dumcorpus/inflection";
import { germanMorphemePolicy } from "dumcorpus/inventories";

export const dictionaryProjections = {
	inflection: inflectionFromPack(inflectionPacks.de),
	morphemePolicy: germanMorphemePolicy,
	tags: readingTags,
} as const;
