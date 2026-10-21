import {
	freeformOf,
	NOTE_PLACEHOLDER,
	parseLemmaNote,
	parseReadingNote,
} from "@textfresser/lemma-note-codec";
import { holdsFreeformText } from "./internal/dictionary-notes";
import {
	LemmaNoteMetadata,
	noteMetadataHelper,
	ReadingNoteMetadata,
} from "./internal/note-metadata";

/**
 * The user's text in a Lemma or Reading note's file: every body line no
 * Rendering Seal claims, without the Note placeholder.
 */
export function freeformOfNote(
	content: string,
	kind: "lemma" | "reading",
): string[] {
	const body = noteMetadataHelper.body(content);
	const segments =
		kind === "lemma"
			? parseLemmaNote(
					{
						body,
						metadata:
							noteMetadataHelper.read(
								content,
								LemmaNoteMetadata,
								"Hidden",
							) ?? undefined,
					},
					{ language: "de" },
				).document.segments
			: parseReadingNote(
					{
						body,
						metadata:
							noteMetadataHelper.read(
								content,
								ReadingNoteMetadata,
								"Hidden",
							) ?? undefined,
					},
					{ language: "de" },
				).document.segments;
	return freeformOf(segments).filter(
		(text) => placedFreeform(text) !== NOTE_PLACEHOLDER,
	);
}

/** Whether `text` already stands, as whole paragraphs, in one of these freeform runs. */
export const holdsFreeform = holdsFreeformText;

/** Text as it is placed: without CRs, trailing spaces or blank edge lines. */
export const placedFreeform = (text: string): string =>
	text
		.replace(/\r\n?/gu, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/u, ""))
		.join("\n")
		.replace(/^\n+|\n+$/gu, "");
