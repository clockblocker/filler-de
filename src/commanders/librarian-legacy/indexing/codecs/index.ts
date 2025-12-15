// Guards & primitives

// Codex
export {
	type CodexBaseame,
	CodexBaseameSchemaLegacy,
	isCodexBasenameLegacy,
	treePathToCodexBasename,
} from "./basenames/codex";

export {
	isNoteBasenameLegacy,
	type NoteBasenameLegacy,
	NoteBasenameLegacySchemaLegacy,
} from "./basenames/note";

export {
	isPageBasenameLegacy,
	type PageBasenameLegacy,
	PageBasenameLegacySchemaLegacy,
	treePathToPageBasenameLegacy,
} from "./basenames/page";

export {
	isScrollBasename,
	type ScrollBasename,
	ScrollBasenameSchemaLegacy,
	treePathToScrollBasename,
} from "./basenames/scroll";

export {
	type NodeNameLegacy,
	NodeNameLegacySchemaLegacy,
	type TreePathLegacyLegacy,
	TreePathLegacyLegacySchemaLegacy,
	toNodeNameLegacy,
} from "./guards";

export {
	intFromPageNumberStringLegacy,
	intInPageRangeSchemaLegacy,
	type PageNumber,
	PageNumberSchemaLegacy,
	pageNumberFromInt,
} from "./primitives";

// Library basename union
import type { CodexBaseame } from "./basenames/codex";
import type { NoteBasenameLegacy } from "./basenames/note";

export type LibraryBasename = CodexBaseame | NoteBasenameLegacy;
