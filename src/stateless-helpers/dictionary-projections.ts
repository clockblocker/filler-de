/**
 * The projections the dictionary notes show (#120): German inflection
 * tables from the batteries' German Inflection Pack (`dumcorpus/inflection`,
 * projected by `dumdict/inflection`), drawn in the dictionary's line style
 * by the Lemma note codec, and each Reading's Tags.
 */

import { inflectionFromPack } from "@textfresser/lemma-note-codec";
import { readingTags } from "@textfresser/lemma-note-projections";
import { inflectionPacks } from "dumcorpus/inflection";

export const dictionaryProjections = {
	inflection: inflectionFromPack(inflectionPacks.de),
	tags: readingTags,
} as const;
