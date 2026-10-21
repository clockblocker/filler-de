import {
	crossroadNotePath,
	lemmaNotePath,
	readingNotePath,
} from "@textfresser/lemma-note-codec";
import type * as Dumling from "dumling/types";
import {
	noteMetadataHelper,
	ReadingNoteMetadata,
} from "../../src/internal/note-metadata";

export const lemmaPath = (lemma: Dumling.Lemma<"de">): string =>
	lemmaNotePath(lemma).path;

export const readingPath = (reading: Dumling.Reading<"de">): string =>
	readingNotePath(reading).path;

export const crossroadPath = (spelling: string): string =>
	crossroadNotePath(spelling, "de").path;

/** A Reading note's file with its Reading's notes replaced, as a hand edit of its metadata leaves it. */
export function withReadingNotes(content: string, notes: string): string {
	return noteMetadataHelper.update(
		ReadingNoteMetadata,
		(value) => (value === null ? null : { ...value, notes }),
		"Hidden",
	)(content);
}
