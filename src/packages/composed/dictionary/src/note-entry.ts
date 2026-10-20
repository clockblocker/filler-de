import {
	blockIdsOf,
	type CodecIssue,
	type LemmaNoteData,
	type NoteBlockIds,
	parse,
	parseNotePath,
} from "@textfresser/lemma-note-codec";
import type { PendingSemanticRelationRecord } from "dumdict";
import { contentHash } from "./content-hash";
import { lemmaKeyOf } from "./keys";
import { isStoreShadow } from "./shadow-note";

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

/** A file at a Shadow note path that holds no Lemma note. */
type ShadowNoteEntry = {
	readonly kind: "shadow";
	readonly path: string;
	readonly hash: string;
	/**
	 * Whether the file holds exactly the body the store writes for this
	 * Shadow. Only such a note may be removed; any other is the user's.
	 */
	readonly owned: boolean;
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
	/**
	 * The pending relations of the note's parts that did validate. They are
	 * never data, but keep their Shadow notes from being removed.
	 */
	readonly pendingRelations: readonly PendingSemanticRelationRecord<"de">[];
};

/** What the index holds for one Markdown path under `Worter/`. */
export type PathEntry = LemmaNoteEntry | ShadowNoteEntry | QuarantinedEntry;

/**
 * What a file's content makes it: a Lemma note when the codec accepts it, a
 * Shadow note when it sits at a Shadow path, and quarantined otherwise. A
 * note's metadata, not its path, says which Lemma it holds.
 */
export function classifyNote(path: string, content: string): PathEntry {
	const hash = contentHash(content);
	const { data } = parse(content, { language: "de" });
	if (data.ok) return lemmaEntry(path, hash, data.data);
	const parsedPath = parseNotePath(path);
	if (parsedPath.ok && parsedPath.value.type === "shadow")
		return {
			hash,
			kind: "shadow",
			owned: isStoreShadow(path, content),
			path,
		};
	return {
		hash,
		kind: "quarantined",
		path,
		pendingRelations: data.partial.pendingRelations,
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
	pendingRelations: [],
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

/** The pending relations a path's file holds, whether or not it is data. */
export function pendingOfEntry(
	entry: PathEntry | undefined,
): readonly PendingSemanticRelationRecord<"de">[] {
	switch (entry?.kind) {
		case "lemma":
			return entry.data.pendingRelations;
		case "quarantined":
			return entry.pendingRelations;
		default:
			return [];
	}
}
