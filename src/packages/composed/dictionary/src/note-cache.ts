import type { CodecIssue } from "@textfresser/lemma-note-codec";
import { lemmaEntry, type NoteData, type PathEntry } from "./note-entry";

/**
 * A cached read of one note, valid while the file's `mtime` and `size` are
 * unchanged. It is plain JSON, so a host may persist it between sessions.
 */
export type CachedNote = {
	readonly mtime: number;
	readonly size: number;
	readonly entry:
		| {
				readonly kind: "lemma";
				readonly hash: string;
				readonly data: NoteData;
		  }
		| { readonly kind: "shadow"; readonly hash: string }
		| {
				readonly kind: "quarantined";
				readonly hash: string;
				readonly issues: readonly CodecIssue[];
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

/** The cached form of an entry; unreadable files are never cached. */
export function toCached(
	entry: PathEntry,
	stat: { readonly mtime: number; readonly size: number },
): CachedNote | undefined {
	const base = { mtime: stat.mtime, size: stat.size };
	switch (entry.kind) {
		case "lemma":
			return {
				...base,
				entry: { data: entry.data, hash: entry.hash, kind: "lemma" },
			};
		case "shadow":
			return { ...base, entry: { hash: entry.hash, kind: "shadow" } };
		case "quarantined":
			return entry.reason._tag === "InvalidNote"
				? {
						...base,
						entry: {
							hash: entry.hash,
							issues: entry.reason.issues,
							kind: "quarantined",
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
			return { hash: entry.hash, kind: "shadow", path };
		case "quarantined":
			return {
				hash: entry.hash,
				kind: "quarantined",
				path,
				reason: { _tag: "InvalidNote", issues: entry.issues },
			};
	}
}
