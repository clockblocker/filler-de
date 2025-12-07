// Guards & primitives

// Codex
export {
	type CodexBaseame,
	CodexBaseameSchema,
	isCodexBasename,
	treePathToCodexBasename,
} from "./basenames/codex";

export {
	isNoteBasename,
	type NoteBasename,
	NoteBasenameSchema,
} from "./basenames/note";

export {
	isPageBasename,
	type PageBasename,
	PageBasenameSchema,
	treePathToPageBasename,
} from "./basenames/page";

export {
	isScrollBasename,
	type ScrollBasename,
	ScrollBasenameSchema,
	treePathToScrollBasename,
} from "./basenames/scroll";

export {
	type NodeName,
	NodeNameSchema,
	type TreePath,
	TreePathSchema,
	toNodeName,
} from "./guards";

export {
	intFromPageNumberString,
	intInPageRangeSchema,
	type PageNumber,
	PageNumberSchema,
	pageNumberFromInt,
} from "./primitives";

// Library basename union
import type { CodexBaseame } from "./basenames/codex";
import type { NoteBasename } from "./basenames/note";

export type LibraryBasename = CodexBaseame | NoteBasename;
