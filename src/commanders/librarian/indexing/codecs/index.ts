// Guards & primitives

// Codex
export {
	type CodexBaseame,
	CodexBaseameSchema,
	isCodexBasename,
	treePathToCodexBasename,
} from "./codex";
export {
	type NodeName,
	NodeNameSchema,
	type TreePath,
	TreePathSchema,
	toNodeName,
} from "./guards";

export {
	isNoteBasename,
	type NoteBasename,
	NoteBasenameSchema,
} from "./note";

export {
	isPageBasename,
	type PageBasename,
	PageBasenameSchema,
	treePathToPageBasename,
} from "./page";

export {
	intFromPageNumberString,
	intInPageRangeSchema,
	type PageNumber,
	PageNumberSchema,
	pageNumberFromInt,
} from "./primitives";

export {
	isScrollBasename,
	type ScrollBasename,
	ScrollBasenameSchema,
	treePathToScrollBasename,
} from "./scroll";

// Library basename union
import type { CodexBaseame } from "./codex";
import type { NoteBasename } from "./note";

export type LibraryBasename = CodexBaseame | NoteBasename;
