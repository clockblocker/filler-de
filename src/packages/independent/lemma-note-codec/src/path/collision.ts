/**
 * Path collisions (ADR-0015). APFS and NTFS compare names case-insensitively
 * and APFS normalization-insensitively too, and Obsidian resolves links
 * case-insensitively, so two notes whose paths differ only there are one
 * file. Two identities whose paths share a collision key collide, and so do
 * two spellings of one folder. A collision is reported, never overwritten.
 */

const DOTLESS_I = "ı";

/**
 * The full Unicode case fold of a string, as Python's `str.casefold` does
 * it: `ß` and `ẞ` fold to `ss`, `ﬁ` to `fi`, `Σ`, `σ` and `ς` to one letter.
 * JavaScript has no case fold, so each code point is lowercased, uppercased
 * and lowercased again, which expands `ß` through `SS` and gives every case
 * pair one form. Only the dotless `ı`, which full folding keeps apart from
 * `i`, is left as it is. The result is NFC.
 */
export function caseFold(text: string): string {
	let folded = "";
	for (const char of text.normalize("NFC"))
		folded +=
			char === DOTLESS_I
				? char
				: char.toLowerCase().toUpperCase().toLowerCase();
	return folded.normalize("NFC");
}

/**
 * The key two paths share exactly when a case-insensitive file system
 * treats them as one: the case fold of the NFC path. `Maße.md`, `MASSE.md`
 * and `MAẞE.md` share one, and so do an NFC and an NFD `Mütter.md`.
 */
export function pathCollisionKey(path: string): string {
	return caseFold(path.normalize("NFC"));
}

/** One identity's claim on a path. `owner` is its identity key. */
export type PathClaim = {
	readonly path: string;
	readonly owner: string;
};

/**
 * Two claims whose paths collide at one component, which is given as the
 * path up to and including it. A `file` collision is two owners of one
 * note. A `folder` collision is two spellings of one folder, of which only
 * the first can exist on disk.
 */
export type PathCollision = {
	readonly component: "file" | "folder";
	readonly key: string;
	readonly first: PathClaim;
	readonly second: PathClaim;
};

/**
 * Every collision among the claims, in claim order. Each file path is
 * checked against every other, and each of its folders against the first
 * spelling of that folder. A folder's new spelling is reported once, at the
 * shallowest folder where it differs, and a file's against every earlier
 * owner. Claims of one owner never collide with each other, since they are
 * one note; a second spelling of one owner's path is the store's to heal.
 */
export function findPathCollisions(
	claims: Iterable<PathClaim>,
): PathCollision[] {
	const files = new Map<string, PathClaim[]>();
	const folders = new Map<string, PathClaim[]>();
	const collisions: PathCollision[] = [];
	for (const claim of claims) {
		const segments = claim.path.normalize("NFC").split("/");
		// Below a folder spelled two ways, every deeper folder is too; only
		// the shallowest is reported.
		let diverged = false;
		for (let end = 1; end < segments.length; end++) {
			const folder = segments.slice(0, end).join("/");
			const key = pathCollisionKey(folder);
			const seen = folders.get(key);
			const spelling = { owner: claim.owner, path: folder };
			if (seen === undefined) {
				folders.set(key, [spelling]);
				continue;
			}
			const [first] = seen;
			if (first === undefined || first.path === folder) continue;
			if (!seen.some(({ path }) => path === folder)) {
				seen.push(spelling);
				if (!diverged)
					collisions.push({
						component: "folder",
						first,
						key,
						second: spelling,
					});
			}
			diverged = true;
		}
		const path = segments.join("/");
		const key = pathCollisionKey(path);
		const seen = files.get(key) ?? [];
		if (seen.some(({ owner }) => owner === claim.owner)) continue;
		for (const first of seen)
			collisions.push({
				component: "file",
				first,
				key,
				second: { owner: claim.owner, path },
			});
		files.set(key, [...seen, { owner: claim.owner, path }]);
	}
	return collisions;
}
