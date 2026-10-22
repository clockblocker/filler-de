/**
 * Obsidian's link updater, as the test vaults imitate it: after a move it
 * rewrites, in place, each wikilink that named a moved file by name or by
 * path, and leaves the rest of the file as it was.
 */

const WIKILINK = /(!?\[\[)([^\]|#\n]*)([^\]\n]*\]\])/g;

const withoutMd = (path: string) => path.replace(/\.md$/, "");

/** Whether the wikilink target `target` names the file at `path`. */
const names = (target: string, path: string) =>
	target === path ||
	target === withoutMd(path) ||
	target === withoutMd(path).split("/").at(-1);

/**
 * `content` with each wikilink to an old path of `moves` (old path to new
 * path) pointing at the new path.
 */
export function rewriteWikilinks(
	content: string,
	moves: ReadonlyMap<string, string>,
): string {
	return content.replace(WIKILINK, (link, open, target, rest) => {
		for (const [from, to] of moves)
			if (names(target, from)) return `${open}${withoutMd(to)}${rest}`;
		return link;
	});
}
