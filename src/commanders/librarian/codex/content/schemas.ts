export {
	type CodexLine,
	type CodexLineForChildSectionCodex,
	CodexLineForChildSectionCodexSchema,
	type CodexLineForFile,
	CodexLineForFileSchema,
	type CodexLineForMdFile,
	CodexLineForMdFileSchema,
	type CodexLineForParentSectionCodex,
	CodexLineForParentSectionCodexSchema,
	CodexLineSchema,
	CodexLineType,
	CodexLineTypeSchema,
} from "./schema/line";

// CodexLineType is exported as both const and type from line.ts
// Import the type directly: import type { CodexLineType } from "./schema/line"
