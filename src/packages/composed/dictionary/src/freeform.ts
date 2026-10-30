import {
	freeformOf,
	NOTE_PLACEHOLDER,
	parseLemmaNote,
	parseReadingNote,
} from "@textfresser/lemma-note-codec";
import { canonicalJson } from "common-utils";
import type * as Dumling from "dumling/types";
import {
	holdsFreeformText,
	writeLemmaNote,
	writeReadingNote,
} from "./internal/dictionary-notes";
import {
	LemmaNoteMetadata,
	noteMetadataHelper,
	ReadingNoteMetadata,
} from "./internal/note-metadata";
import { classifyFile } from "./notes";

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

/**
 * Why a note's content with `text` placed in it does not stand, if it does
 * not: it must read back as the same kind of note with the same records,
 * `data`, and with the text whole in its freeform. `appendFreeform` asks it
 * of the note it is about to write, `freeformPlacementProblem` of a probe.
 */
export function placedNoteProblem(input: {
	readonly path: string;
	readonly kind: "lemma" | "reading";
	readonly content: string;
	readonly data: unknown;
	readonly text: string;
}): string | undefined {
	const entry = classifyFile(input.path, input.content);
	if (
		entry.kind !== input.kind ||
		canonicalJson(entry.data) !== canonicalJson(input.data)
	)
		return "the note would not parse back to its records with the text in it";
	if (!holdsFreeform(freeformOfNote(input.content, input.kind), input.text))
		return "the text would not read back whole from the note";
	return undefined;
}

const PROBE_LEMMA: Dumling.Lemma<"de", "Lexeme", "VERB"> = {
	canonicalForm: "prüfen",
	coreFeatures: { hasSepPrefix: null },
	family: "Lexeme",
	kind: "VERB",
	language: "de",
	unitKind: "Lemma",
};

const PROBE_READING: Dumling.Reading<"de", "Lexeme", "VERB"> = {
	emojiDescription: "🧪",
	lemma: PROBE_LEMMA,
	unitKind: "Reading",
};

const PROBE_RECORDS = {
	lemmaRecord: { lemma: PROBE_LEMMA },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		{
			attestationLinks: [],
			attestedTranslations: [],
			notes: "",
			reading: PROBE_READING,
		},
	],
};

const PROBE_PATH = "Worter/de/Lexeme/VERB/p/prü/prüfe/🧪 prüfen.md";

/**
 * Why `text` cannot be placed as freeform in a dictionary note, if it
 * cannot: the check `appendFreeform` runs (`placedNoteProblem`), run on a
 * probe Reading note and a probe Lemma note in either metadata format, so a
 * caller can tell before any note of the text's Lemma exists. The reset's
 * Dry run asks it of each freeform Block it plans to re-attach.
 */
export function freeformPlacementProblem(text: string): string | undefined {
	const placed = placedFreeform(text);
	if (placed.trim() === "") return "the text is empty";
	for (const format of ["Hidden", "Frontmatter"] as const) {
		const probes = [
			{
				kind: "reading",
				write: (extraFreeform: readonly string[]) =>
					writeReadingNote(PROBE_RECORDS, PROBE_READING, {
						extraFreeform,
						format,
						language: "de",
					}),
			},
			{
				kind: "lemma",
				write: (extraFreeform: readonly string[]) =>
					writeLemmaNote(PROBE_RECORDS, {
						extraFreeform,
						format,
						language: "de",
					}),
			},
		] as const;
		for (const { kind, write } of probes) {
			try {
				const empty = write([])("");
				const before = classifyFile(PROBE_PATH, empty);
				const problem = placedNoteProblem({
					content: write([placed])(empty),
					data:
						before.kind === "lemma" || before.kind === "reading"
							? before.data
							: undefined,
					kind,
					path: PROBE_PATH,
					text: placed,
				});
				if (problem !== undefined) return problem;
			} catch (cause) {
				return cause instanceof Error ? cause.message : String(cause);
			}
		}
	}
	return undefined;
}
