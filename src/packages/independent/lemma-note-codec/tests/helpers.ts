import {
	ParsingError,
	parseAsLemmaRecord,
	parseAsPendingSemanticRelationRecord,
	parseAsReadingEntry,
	parseAsSurfaceEntry,
} from "dumdict";
import {
	type CodecIssue,
	type LemmaNoteData,
	type LemmaNoteParse,
	parse,
} from "../src";

function unwrap<T>(parsed: T | ParsingError): T {
	if (parsed instanceof ParsingError) throw parsed;
	return parsed;
}

/** A fixture as dumdict's parsers normalize it, which is what parse returns. */
export function normalized(data: LemmaNoteData<"de">): LemmaNoteData<"de"> {
	return {
		lemmaRecord: unwrap(parseAsLemmaRecord(data.lemmaRecord, "de")),
		ownedSurfaceEntries: data.ownedSurfaceEntries.map((entry) =>
			unwrap(parseAsSurfaceEntry(entry, "de")),
		),
		pendingRelations: data.pendingRelations.map((record) =>
			unwrap(parseAsPendingSemanticRelationRecord(record, "de")),
		),
		readingEntries: data.readingEntries.map((entry) =>
			unwrap(parseAsReadingEntry(entry, "de")),
		),
	};
}

export function parseDe(markdown: string): LemmaNoteParse<"de"> {
	return parse(markdown, { language: "de" });
}

/** The data of a note that must parse. */
export function validData(markdown: string): LemmaNoteData<"de"> {
	const { data } = parseDe(markdown);
	if (!data.ok)
		throw new Error(
			`Expected a valid note: ${data.issues.map((issue) => issue.message).join("; ")}`,
		);
	return data.data;
}

/** The issue tags of a note that must not parse. */
export function issueTags(markdown: string): CodecIssue["_tag"][] {
	const { data } = parseDe(markdown);
	if (data.ok) throw new Error("Expected an invalid note");
	return data.issues.map((issue) => issue._tag);
}
