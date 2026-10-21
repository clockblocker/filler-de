/**
 * The wikilink that ends at `closePos`, the offset of its `]]`, read from
 * the editor's text. Pure, so the detector's rules are testable without an
 * editor.
 */

export type CompletedLink = {
	/** The link's content between `[[` and `]]`, trimmed. */
	readonly linkContent: string;
	/** Where the content starts, padding included: right after `[[`. */
	readonly contentFrom: number;
	/** Where `]]` starts. */
	readonly closePos: number;
	/** Whether the link is an embed, `![[…]]`. */
	readonly embed: boolean;
};

/**
 * Skips a nested link, a link that already has an alias (`|`), one that
 * spans lines, and empty content.
 */
export function completedLinkAt(
	text: string,
	closePos: number,
): CompletedLink | null {
	const openPos = text.lastIndexOf("[[", closePos);
	if (openPos === -1) return null;

	const between = text.slice(openPos + 2, closePos);

	if (between.includes("[[")) return null;
	if (between.includes("|")) return null;
	if (between.includes("\n")) return null;

	const linkContent = between.trim();
	if (!linkContent) return null;

	return {
		closePos,
		contentFrom: openPos + 2,
		embed: text[openPos - 1] === "!",
		linkContent,
	};
}
