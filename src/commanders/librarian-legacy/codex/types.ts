import type { TextStatusLegacy } from "../../../types/common-interface/enums";

/**
 * Back link to parent Codex.
 * Null for root Library Codex.
 */
export type BackLink = {
	/** Link target (e.g., "__Season_1-Avatar") */
	target: string;
	/** Display text (e.g., "Season 1") */
	displayName: string;
} | null;

/**
 * Single item in a Codex list.
 * Items can have nested children:
 * - Sections: children are their contents (sections, books, scrolls)
 * - Books: children are their pages
 * - Scrolls/Page: no children
 */
export type CodexItem = {
	/** Link target (file basename without extension) */
	target: string;
	/** Display name shown in link */
	displayName: string;
	/** Status determines checkbox state */
	status: TextStatusLegacy;
	/** Nested children */
	children: CodexItem[];
};

/**
 * Full Codex content model.
 */
export type CodexContent = {
	/** Back link to parent (null for root) */
	backLink: BackLink;
	/** List items with nested structure */
	items: CodexItem[];
};
