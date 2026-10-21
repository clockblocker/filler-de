/**
 * What each Markdown file under `Worter/` is (ADR-0015). A note's metadata,
 * never its path, says which Lemma or Reading it holds; the path only tells
 * the kind of a note without dictionary metadata.
 */

import {
	type CodecIssue,
	type LemmaNoteData,
	type LemmaRecords,
	parseLemmaNote,
	parseNotePath,
	parseReadingNote,
	type ReadingNoteData,
	type RenderingSeal,
} from "@textfresser/lemma-note-codec";
import { contentHash } from "./content-hash";
import { CrossroadNoteMetadata } from "./crossroad";
import {
	LemmaNoteMetadata,
	noteMetadataHelper,
	ReadingNoteMetadata,
} from "./internal/note-metadata";
import { lemmaKeyOf, readingKeyOf } from "./keys";

/** Every record of one Lemma, from its Lemma note and its Reading notes. */
export type NoteData = LemmaRecords<"de">;

/** A Lemma note whose metadata the codec accepted. */
export type LemmaNoteEntry = {
	readonly kind: "lemma";
	readonly path: string;
	readonly hash: string;
	readonly lemmaKey: string;
	readonly data: LemmaNoteData<"de">;
};

/** A Reading note whose metadata the codec accepted. */
export type ReadingNoteEntry = {
	readonly kind: "reading";
	readonly path: string;
	readonly hash: string;
	readonly lemmaKey: string;
	readonly readingKey: string;
	readonly data: ReadingNoteData<"de">;
};

/**
 * A Crossroad note: one with `crossroadNote` metadata, or a file at a
 * Crossroad path without dictionary metadata, such as the empty note a
 * click on an uncreated Crossroad link leaves (`key` undefined).
 */
type CrossroadEntry = {
	readonly kind: "crossroad";
	readonly path: string;
	readonly hash: string;
	readonly key: string | undefined;
	/** Its renderings' seals, as its metadata holds them; none without metadata. */
	readonly rendering: readonly RenderingSeal[] | undefined;
	/** Whether the file holds nothing but whitespace. */
	readonly empty: boolean;
};

/**
 * A note directly in `Worter/` without dictionary metadata, as Obsidian
 * creates one for an unresolved bare link. Reported; #115 heals it.
 */
type StrayEntry = {
	readonly kind: "stray";
	readonly path: string;
	readonly hash: string;
};

/**
 * An empty file at an exact Lemma or Reading note path, as a click on a
 * link to a removed note leaves. Reported and left alone: the store never
 * writes a note over it.
 */
type EmptyEntry = {
	readonly kind: "empty";
	readonly path: string;
	readonly hash: string;
};

export type QuarantineReason =
	| {
			/** The codec rejected the note; it is never read as data or overwritten. */
			readonly _tag: "InvalidNote";
			readonly issues: readonly CodecIssue[];
	  }
	| {
			/** The file exists but could not be read. */
			readonly _tag: "Unreadable";
			readonly message: string;
	  };

export type QuarantinedEntry = {
	readonly kind: "quarantined";
	readonly path: string;
	readonly hash: string;
	readonly reason: QuarantineReason;
};

/** What the index holds for one Markdown path under `Worter/`. */
export type PathEntry =
	| LemmaNoteEntry
	| ReadingNoteEntry
	| CrossroadEntry
	| StrayEntry
	| EmptyEntry
	| QuarantinedEntry;

const invalid = (
	path: string,
	hash: string,
	issues: readonly CodecIssue[],
): QuarantinedEntry => ({
	hash,
	kind: "quarantined",
	path,
	reason: { _tag: "InvalidNote", issues },
});

const issue = (message: string): CodecIssue => ({
	_tag: "InvalidMetadata",
	message,
});

/**
 * What a file's content makes it. Dictionary metadata decides: a Lemma or
 * Reading note when the codec accepts it, quarantined when it does not.
 * Without any, the path decides: a Crossroad note, a stray, or an empty
 * file at a note path; anything else, such as a note in the retired marker
 * format, is quarantined. Never throws.
 */
export function classifyFile(path: string, content: string): PathEntry {
	const hash = contentHash(content);
	const lemma = noteMetadataHelper.inspect(
		content,
		LemmaNoteMetadata,
		"Hidden",
	);
	const reading = noteMetadataHelper.inspect(
		content,
		ReadingNoteMetadata,
		"Hidden",
	);
	const crossroad = noteMetadataHelper.inspect(
		content,
		CrossroadNoteMetadata,
		"Hidden",
	);
	const held = [lemma, reading, crossroad].filter(
		(read) => read.kind !== "Absent",
	);
	if (held.length > 1)
		return invalid(path, hash, [
			issue("The note holds the metadata of more than one note kind"),
		]);
	const body = () => noteMetadataHelper.body(content);

	const unreadable =
		lemma.kind === "Invalid"
			? lemma.issue
			: reading.kind === "Invalid"
				? reading.issue
				: undefined;
	if (unreadable !== undefined)
		return invalid(path, hash, [
			issue(
				`The note's dictionary metadata is unreadable: ${unreadable.kind}`,
			),
		]);
	if (lemma.kind === "Valid") {
		const { data } = parseLemmaNote(
			{ body: body(), metadata: lemma.value },
			{ language: "de" },
		);
		if (!data.ok) return invalid(path, hash, data.issues);
		return {
			data: data.data,
			hash,
			kind: "lemma",
			lemmaKey: lemmaKeyOf(data.data.lemmaRecord.lemma),
			path,
		};
	}
	if (reading.kind === "Valid") {
		const { data } = parseReadingNote(
			{ body: body(), metadata: reading.value },
			{ language: "de" },
		);
		if (!data.ok) return invalid(path, hash, data.issues);
		const entry = data.data.readingEntry;
		return {
			data: data.data,
			hash,
			kind: "reading",
			lemmaKey: lemmaKeyOf(entry.reading.lemma),
			path,
			readingKey: readingKeyOf(entry.reading),
		};
	}
	if (crossroad.kind === "Invalid")
		return invalid(path, hash, [
			issue(
				`The note's Crossroad metadata is unreadable: ${crossroad.issue.kind}`,
			),
		]);
	const empty = content.trim() === "";
	if (crossroad.kind === "Valid")
		return {
			empty,
			hash,
			key: crossroad.value.key,
			kind: "crossroad",
			path,
			rendering: crossroad.value.rendering,
		};

	const parsed = parseNotePath(path);
	if (parsed.ok)
		switch (parsed.value.type) {
			case "crossroad":
				return {
					empty,
					hash,
					key: undefined,
					kind: "crossroad",
					path,
					rendering: undefined,
				};
			case "stray":
				return { hash, kind: "stray", path };
			case "lemma":
			case "reading":
				if (empty) return { hash, kind: "empty", path };
		}
	// Without metadata the codec tells a retired marker-format note apart.
	const { data } = parseLemmaNote(
		{ body: body(), metadata: undefined },
		{ language: "de" },
	);
	return invalid(path, hash, data.ok ? [] : data.issues);
}

export const unreadableEntry = (
	path: string,
	message: string,
): QuarantinedEntry => ({
	hash: "",
	kind: "quarantined",
	path,
	reason: { _tag: "Unreadable", message },
});

const isUnreadable = (entry: PathEntry): boolean =>
	entry.kind === "quarantined" && entry.reason._tag === "Unreadable";

/**
 * Whether two entries for one path index the same thing. A file that stays
 * unreadable is unchanged, so it moves the revision once, not per event.
 */
export const sameEntry = (
	left: PathEntry | undefined,
	right: PathEntry | undefined,
): boolean => {
	if (left === right) return true;
	if (left === undefined || right === undefined) return false;
	if (isUnreadable(left) || isUnreadable(right))
		return isUnreadable(left) && isUnreadable(right);
	return left.kind === right.kind && left.hash === right.hash;
};
