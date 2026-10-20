import type { CodecIssue } from "@textfresser/lemma-note-codec";
import type { PendingSemanticRelationRecord } from "dumdict";
import { lemmaEntry, type NoteData, type PathEntry } from "./note-entry";

/**
 * The version of what a cached entry holds. Bump it whenever the codec, the
 * dumdict record schemas or the store's reading of a note change, so a
 * persisted cache from an older build misses instead of serving stale data.
 */
export const NOTE_CACHE_VERSION = "dictionary-note-cache/1";

/**
 * A cached read of one note, valid while the file's `mtime` and `size` are
 * unchanged and its `version` is the store's. It is plain JSON, so a host
 * may persist it between sessions.
 */
export type CachedNote = {
	readonly version: string;
	readonly mtime: number;
	readonly size: number;
	readonly entry:
		| {
				readonly kind: "lemma";
				readonly hash: string;
				readonly data: NoteData;
		  }
		| {
				readonly kind: "shadow";
				readonly hash: string;
				readonly owned: boolean;
		  }
		| {
				readonly kind: "quarantined";
				readonly hash: string;
				readonly issues: readonly CodecIssue[];
				readonly pendingRelations: readonly PendingSemanticRelationRecord<"de">[];
		  };
};

/**
 * The startup cache keyed by `(path, mtime)`: a hit skips reading and
 * parsing the note. The store writes entries as it reads notes and drops
 * the ones its own writes make stale.
 */
export type DictionaryNoteCache = {
	readonly get: (path: string) => CachedNote | undefined;
	readonly set: (path: string, note: CachedNote) => void;
	readonly delete: (path: string) => void;
};

export function createMemoryNoteCache(): DictionaryNoteCache & {
	readonly entries: () => ReadonlyMap<string, CachedNote>;
} {
	const notes = new Map<string, CachedNote>();
	return {
		delete: (path) => {
			notes.delete(path);
		},
		entries: () => notes,
		get: (path) => notes.get(path),
		set: (path, note) => {
			notes.set(path, note);
		},
	};
}

/** Whether a cached note may stand for a file with this stat. */
export const cacheHit = (
	cached: CachedNote | undefined,
	stat: { readonly mtime: number; readonly size: number },
): cached is CachedNote =>
	cached !== undefined &&
	cached.version === NOTE_CACHE_VERSION &&
	cached.mtime === stat.mtime &&
	cached.size === stat.size;

/** The cached form of an entry; unreadable files are never cached. */
export function toCached(
	entry: PathEntry,
	stat: { readonly mtime: number; readonly size: number },
): CachedNote | undefined {
	const base = {
		mtime: stat.mtime,
		size: stat.size,
		version: NOTE_CACHE_VERSION,
	};
	switch (entry.kind) {
		case "lemma":
			return {
				...base,
				entry: { data: entry.data, hash: entry.hash, kind: "lemma" },
			};
		case "shadow":
			return {
				...base,
				entry: { hash: entry.hash, kind: "shadow", owned: entry.owned },
			};
		case "quarantined":
			return entry.reason._tag === "InvalidNote"
				? {
						...base,
						entry: {
							hash: entry.hash,
							issues: entry.reason.issues,
							kind: "quarantined",
							pendingRelations: entry.pendingRelations,
						},
					}
				: undefined;
	}
}

export function fromCached(path: string, cached: CachedNote): PathEntry {
	const { entry } = cached;
	switch (entry.kind) {
		case "lemma":
			return lemmaEntry(path, entry.hash, entry.data);
		case "shadow":
			return {
				hash: entry.hash,
				kind: "shadow",
				owned: entry.owned,
				path,
			};
		case "quarantined":
			return {
				hash: entry.hash,
				kind: "quarantined",
				path,
				pendingRelations: entry.pendingRelations,
				reason: { _tag: "InvalidNote", issues: entry.issues },
			};
	}
}
