import z from "zod";
import { FILE } from "../../../../../obsidian-vault-action-manager/types/literals";
import { SCROLL_NODE_TYPE } from "../../../types/literals";

const ChildSectionCodexLineTypeSchema = z.literal("ChildSectionCodex");
export type CHILD_SECTION_CODEX_LINE_TYPE = z.infer<
	typeof ChildSectionCodexLineTypeSchema
>;
export const CHILD_SECTION_CODEX_LINE_TYPE =
	ChildSectionCodexLineTypeSchema.value;

const ParentSectionCodexLineTypeSchema = z.literal("ParentSectionCodex");
export type PARENT_SECTION_CODEX_LINE_TYPE = z.infer<
	typeof ParentSectionCodexLineTypeSchema
>;
export const PARENT_SECTION_CODEX_LINE_TYPE =
	ParentSectionCodexLineTypeSchema.value;

// ────────────────────────────────────────────────────────────────────────────

export const CodexLineTypeSchema = z.enum([
	SCROLL_NODE_TYPE,
	FILE,
	CHILD_SECTION_CODEX_LINE_TYPE,
	PARENT_SECTION_CODEX_LINE_TYPE,
]);

export type CodexLineType = z.infer<typeof CodexLineTypeSchema>;
export const CodexLineType = CodexLineTypeSchema.enum;
