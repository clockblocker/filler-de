import type { TextStatus } from "../../../types/common-interface/enums";

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
 * Can be nested (for sections) or flat (for book pages).
 */
export type CodexItem = {
	/** Link target (file basename without extension) */
	target: string;
	/** Display name shown in link */
	displayName: string;
	/** Status determines checkbox state */
	status: TextStatus;
	/** Nested children (only for section codex, empty for book pages) */
	children: CodexItem[];
};

/**
 * Full Codex content model.
 */
export type CodexContent = {
	/** Back link to parent (null for root) */
	backLink: BackLink;
	/** List items (nested for section, flat for book) */
	items: CodexItem[];
};

/**
 * Codex type determines formatting behavior.
 */
export type CodexType = "section" | "book";
