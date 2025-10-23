export type CodexChapter = {
	pathParts: string[];
	title: string;
	done: boolean;
};

export type CodexSerializeOptions = {
	indent?: string; // default: '\t'
	bullets?: string[]; // default: ['-', '*', '-', '*']
	boldGroups?: boolean; // default: true
	displayText?: (title: string, path: string[]) => string;
	linkTarget?: (title: string, path: string[]) => string;
	groupSort?: (a: string, b: string) => number;
	leafSort?: (a: CodexChapter, b: CodexChapter) => number;
};

export type CodexNormalizeOptions = {
	deriveTitleFromTarget?: (target: string) => string;
	spacesPerIndent?: number;
};
