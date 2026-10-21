import {
	ParsingError,
	parseAsLemmaRecord,
	parseAsPendingSemanticRelationRecord,
	parseAsReadingEntry,
	parseAsSurfaceEntry,
} from "dumdict";
import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import {
	type BodySegment,
	type CodecIssue,
	type DataResult,
	freeformOf,
	type LemmaNoteData,
	type LemmaRecords,
	parseLemmaNote,
	parseReadingNote,
	type ReadingNoteData,
	type SerializedNote,
} from "../src";

function unwrap<T>(parsed: T | ParsingError): T {
	if (parsed instanceof ParsingError) throw parsed;
	return parsed;
}

/** A fixture as dumdict's parsers normalize it, which is what parse returns. */
function normalized(records: LemmaRecords<"de">): LemmaRecords<"de"> {
	return {
		lemmaRecord: unwrap(parseAsLemmaRecord(records.lemmaRecord, "de")),
		ownedSurfaceEntries: records.ownedSurfaceEntries.map((entry) =>
			unwrap(parseAsSurfaceEntry(entry, "de")),
		),
		pendingRelations: records.pendingRelations.map((record) =>
			unwrap(parseAsPendingSemanticRelationRecord(record, "de")),
		),
		readingEntries: records.readingEntries.map((entry) =>
			unwrap(parseAsReadingEntry(entry, "de")),
		),
	};
}

/** What a Lemma note of `records` holds. */
export function lemmaNoteDataOf(
	records: LemmaRecords<"de">,
): LemmaNoteData<"de"> {
	const { lemmaRecord, ownedSurfaceEntries } = normalized(records);
	return { lemmaRecord, ownedSurfaceEntries };
}

/** What the Reading note of `reading` holds. */
export function readingNoteDataOf(
	records: LemmaRecords<"de">,
	reading: Dumling.Reading<"de">,
): ReadingNoteData<"de"> {
	const { pendingRelations, readingEntries } = normalized(records);
	const key = readingIdentityKey(reading);
	const readingEntry = readingEntries.find(
		(entry) => readingIdentityKey(entry.reading) === key,
	);
	if (readingEntry === undefined) throw new Error("No such Reading");
	return {
		pendingRelations: pendingRelations.filter(
			(record) => readingIdentityKey(record.sourceReading) === key,
		),
		readingEntry,
	};
}

/** The data of a result that must be valid. */
export function valid<T>(result: DataResult<T>): T {
	if (!result.ok)
		throw new Error(
			`Expected valid data: ${result.issues.map((issue) => issue.message).join("; ")}`,
		);
	return result.data;
}

export const parseLemma = (note: SerializedNote<unknown>) =>
	parseLemmaNote(note as never, { language: "de" });

export const parseReading = (note: SerializedNote<unknown>) =>
	parseReadingNote(note as never, { language: "de" });

/** The issue tags of a result that must be invalid. */
export function issueTags<T>(result: DataResult<T>): CodecIssue["_tag"][] {
	if (result.ok) throw new Error("Expected invalid data");
	return result.issues.map((issue) => issue._tag);
}

/** A note's user text, as its parse reads it. */
export const freeformTexts = (parsed: {
	readonly document: { readonly segments: readonly BodySegment[] };
}) => freeformOf(parsed.document.segments);
