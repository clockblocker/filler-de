import { PathParts } from '../../types/general';

export type ChapterItem = {
	pathParts: string[];
	title: string;
	done: boolean;
};

export type ChapterSerializeOptions = {
	indent?: string; // default: '\t'
	bullets?: string[]; // default: ['-', '*', '-', '*']
	boldGroups?: boolean; // default: true
	displayText?: (title: string, path: string[]) => string;
	linkTarget?: (title: string, path: string[]) => string;
	groupSort?: (a: string, b: string) => number;
	leafSort?: (a: ChapterItem, b: ChapterItem) => number;
};

export type NormalizeOptions = {
	/**
	 * When a wikilink has no display (`[[Target]]`), how to derive a title for the preview.
	 * Default: strip "-index" suffix; then replace underscores with spaces.
	 */
	deriveTitleFromTarget?: (target: string) => string;

	/**
	 * Treat N spaces as one indentation level. Tabs always count as 1 level.
	 * Default: 2
	 */
	spacesPerIndent?: number;
};
