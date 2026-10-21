import type { CodecIssue, LemmaRecords } from "@textfresser/lemma-note-codec";
import { readBundle, readingBlockIds } from "./bundle";
import { contentHash } from "./content-hash";
import { lemmaKeyOf } from "./keys";

/** Every record of one Lemma. TODO(#113): split across its Lemma and Reading notes. */
export type NoteData = LemmaRecords<"de">;

/** Each Reading's header Block ID in its Lemma's bundle, by Reading key. */
type NoteBlockIds = {
	readonly readings: ReadonlyMap<string, string>;
};

/** A Lemma note whose records the codec accepted. */
export type LemmaNoteEntry = {
	readonly kind: "lemma";
	readonly path: string;
	readonly hash: string;
	readonly lemmaKey: string;
	readonly data: NoteData;
	readonly blockIds: NoteBlockIds;
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
export type PathEntry = LemmaNoteEntry | QuarantinedEntry;

/**
 * What a file's content makes it: a Lemma note when the codec accepts it,
 * and quarantined otherwise. A note's metadata, not its path, says which
 * Lemma it holds.
 */
export function classifyNote(path: string, content: string): PathEntry {
	const hash = contentHash(content);
	const { data } = readBundle(content);
	if (data.ok) return lemmaEntry(path, hash, data.data);
	return {
		hash,
		kind: "quarantined",
		path,
		reason: { _tag: "InvalidNote", issues: data.issues },
	};
}

export function lemmaEntry(
	path: string,
	hash: string,
	data: NoteData,
): LemmaNoteEntry {
	return {
		blockIds: {
			readings: readingBlockIds(
				data.readingEntries.map(({ reading }) => reading),
			),
		},
		data,
		hash,
		kind: "lemma",
		lemmaKey: lemmaKeyOf(data.lemmaRecord.lemma),
		path,
	};
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
