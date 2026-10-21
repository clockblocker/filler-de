/**
 * The dictionary's metadata namespaces (#112): one per note kind, from the
 * Lemma note codec's specs. Each escapes `[` while it sits in frontmatter,
 * so the "Hide metadata" toggle works for dictionary notes too: no link
 * inside the data reaches Obsidian's link index in either format.
 */

import {
	LEMMA_NOTE_METADATA,
	READING_NOTE_METADATA,
} from "@textfresser/lemma-note-codec";
import { defineNestedNamespace } from "./namespace";

/** A Lemma note's data: `lemmaNote`. */
export const LemmaNoteMetadata = defineNestedNamespace({
	...LEMMA_NOTE_METADATA,
	escapeLinksInFrontmatter: true,
});

/** A Reading note's data: `readingNote`. */
export const ReadingNoteMetadata = defineNestedNamespace({
	...READING_NOTE_METADATA,
	escapeLinksInFrontmatter: true,
});
