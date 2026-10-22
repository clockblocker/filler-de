/**
 * Vault paths as strings: `/`-separated and relative to the vault root,
 * which is `""`. This is the one place that decides when two such paths name
 * the same file and when one lies under another.
 *
 * Every comparison first normalizes both paths as Obsidian's `normalizePath`
 * does (Obsidian 1.14.4): runs of `/` and `\` become one `/`, leading and
 * trailing slashes go, non-breaking spaces become spaces, and the result is
 * composed to NFC. Obsidian applies that to every path it creates and
 * composes the names it reads from disk, so its own paths are already in
 * this form. Unlike `normalizePath`, the root stays `""`, as VAM formats it.
 *
 * Case is the one choice a caller makes, by picking an identity:
 *
 * - `VaultPath.caseSensitive` compares paths as Obsidian's lookup does.
 *   `getAbstractFileByPath` is an exact match, so `worter/a.md` does not
 *   find `Worter/a.md`. Use it wherever the result feeds a lookup, a
 *   path-keyed map, or a rename that may change only case.
 * - The vault's own identity, `VaultActionManager.paths`, compares as the
 *   vault's file system does: case-insensitively on macOS and Windows,
 *   where `worter/a.md` and `Worter/a.md` are one file. Use it to ask
 *   whether two paths would land on one file.
 */

/** Same-file and containment checks under one case policy. */
export type VaultPathIdentity = {
	/** Whether paths that differ only in case count as one. */
	readonly caseInsensitive: boolean;
	/**
	 * The form two paths share exactly when they are one path: normalized,
	 * and lowercased when case is ignored. Use it as a map key.
	 */
	readonly key: (path: string) => string;
	/** Whether `a` and `b` are one path. */
	readonly same: (a: string, b: string) => boolean;
	/**
	 * Whether `path` lies below `prefix`, by whole segments: `Worter` covers
	 * `Worter/a.md` but not `Worterbuch/a.md`. The root `""` covers every
	 * other path. With `inclusive`, `prefix` covers itself too.
	 */
	readonly isUnder: (
		path: string,
		prefix: string,
		options: { readonly inclusive: boolean },
	) => boolean;
};

/** How the vault's file system compares names. */
export type VaultFileSystem = {
	readonly caseInsensitive: boolean;
};

const ROOT = "";
const SEPARATOR_RUNS = /[\\/]+/g;
const EDGE_SLASHES = /^\/+|\/+$/g;
const NON_BREAKING_SPACES = / | /g;

function normalize(path: string): string {
	return path
		.replace(SEPARATOR_RUNS, "/")
		.replace(EDGE_SLASHES, "")
		.replace(NON_BREAKING_SPACES, " ")
		.normalize("NFC");
}

/** The folder holding `path`; `undefined` for the root, which has none. */
function parent(path: string): string | undefined {
	const normalized = normalize(path);
	if (normalized === ROOT) return undefined;
	const slash = normalized.lastIndexOf("/");
	return slash === -1 ? ROOT : normalized.slice(0, slash);
}

/** The path of `segments` joined below one another, normalized. */
function join(...segments: readonly string[]): string {
	return normalize(segments.join("/"));
}

function makeIdentity(caseInsensitive: boolean): VaultPathIdentity {
	const key = caseInsensitive
		? (path: string) => normalize(path).toLowerCase()
		: normalize;
	return Object.freeze({
		caseInsensitive,
		isUnder: (path, prefix, { inclusive }) => {
			const pathKey = key(path);
			const prefixKey = key(prefix);
			if (pathKey === prefixKey) return inclusive;
			return prefixKey === ROOT || pathKey.startsWith(`${prefixKey}/`);
		},
		key,
		same: (a, b) => key(a) === key(b),
	});
}

const caseSensitive = makeIdentity(false);
const caseInsensitive = makeIdentity(true);

export const VaultPath = Object.freeze({
	/** Compares as the vault's file system would if it ignored case. */
	caseInsensitive,
	/** Compares as Obsidian's lookup does: case matters. */
	caseSensitive,
	/** The identity of a file system with the given case policy. */
	forFileSystem: (fileSystem: VaultFileSystem): VaultPathIdentity =>
		fileSystem.caseInsensitive ? caseInsensitive : caseSensitive,
	join,
	/** `path` in the form Obsidian keys it, with the root as `""`. */
	normalize,
	parent,
	/** The vault root. */
	root: ROOT,
});
