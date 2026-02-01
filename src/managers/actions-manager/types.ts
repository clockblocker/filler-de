import { z } from "zod";
import { ALL_TEXTFRESSER_COMMAND_KINDS } from "../../commanders/textfresser/commands/types";
import type {
	SplitPathToMdFile,
} from "../obsidian/vault-action-manager/types/split-path";

// ─── CommandKind - Command Executor Action Kinds ───

const COMMAND_KIND_STR = [
	...ALL_TEXTFRESSER_COMMAND_KINDS,
	"MakeText",
	"NavigatePage",
	"SplitInBlocks",
	"SplitToPages",
	"TestButton",
	"TranslateSelection",
] as const;

export const CommandKindSchema = z.enum(COMMAND_KIND_STR);
export type CommandKind = z.infer<typeof CommandKindSchema>;
export const CommandKind = CommandKindSchema.enum;

/**
 * Typed payloads per command kind.
 * Each executor receives only its typed payload.
 */
export type CommandPayloads = {
	NavigatePage: {
		direction: "prev" | "next";
		currentFilePath: SplitPathToMdFile;
	};
	SplitInBlocks: { selection: string; fileContent: string };
	MakeText: Record<string, never>;
	SplitToPages: Record<string, never>;
	TestButton: { filePath: SplitPathToMdFile };
	TranslateSelection: { selection: string };
	ExplainGrammar: { selection: string };
	Generate: Record<string, never>;
};

// ─── Deprecated Types (for backward compatibility) ───

/**
 * @deprecated Use CommandKind instead. Alias for backward compatibility.
 */
export const ActionKind = CommandKind;
/**
 * @deprecated Use CommandKind instead. Alias for backward compatibility.
 */
export type ActionKind = CommandKind;

/**
 * @deprecated Use CommandPayloads instead. Alias for backward compatibility.
 */
export type ActionPayloads = CommandPayloads;