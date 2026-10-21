import type { PathEntry } from "./notes";

/**
 * The version of what a cached entry holds. Bump it whenever the codec, the
 * dumdict record schemas or the store's reading of a note change, so a
 * persisted cache from an older build misses instead of serving stale data.
 */
const NOTE_CACHE_VERSION = "dictionary-note-cache/6";

/** A path's entry without its path, as plain JSON. */
type CachedEntry = PathEntry extends infer E
	? E extends PathEntry
		? Omit<E, "path">
		: never
	: never;

/**
 * A cached read of one note, valid while the file's `mtime` and `size` are
 * unchanged and its `version` is the store's. It is plain JSON, so a host
 * may persist it between sessions.
 */
export type CachedNote = {
	readonly version: string;
	readonly mtime: number;
	readonly size: number;
	readonly entry: CachedEntry;
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
	if (entry.kind === "quarantined" && entry.reason._tag === "Unreadable")
		return undefined;
	const { path: _path, ...rest } = entry;
	return {
		entry: rest as CachedEntry,
		mtime: stat.mtime,
		size: stat.size,
		version: NOTE_CACHE_VERSION,
	};
}

export const fromCached = (path: string, cached: CachedNote): PathEntry =>
	({ ...cached.entry, path }) as PathEntry;
