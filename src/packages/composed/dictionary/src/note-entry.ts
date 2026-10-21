import {
	blockIdsOf,
	type CodecIssue,
	type LemmaNoteData,
	type NoteBlockIds,
	parse,
} from "@textfresser/lemma-note-codec";
import { contentHash } from "./content-hash";
import { lemmaKeyOf } from "./keys";

export type NoteData = LemmaNoteData<"de">;

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
	const { data } = parse(content, { language: "de" });
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
		blockIds: blockIdsOf(data),
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
