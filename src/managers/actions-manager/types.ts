import { z } from "zod";
import { ALL_LIBRARIAN_COMMAND_KINDS } from "../../commanders/librarian/commands/types";
import { ALL_TEXTFRESSER_COMMAND_KINDS } from "../../commanders/textfresser/commands/types";
import type { SelectionInfo } from "../obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../obsidian/vault-action-manager/types/split-path";

// ─── CommandKind - Command Executor Action Kinds ───

const COMMAND_KIND_STR = [
	...ALL_TEXTFRESSER_COMMAND_KINDS,
	...ALL_LIBRARIAN_COMMAND_KINDS,
] as const;

export const CommandKindSchema = z.enum(COMMAND_KIND_STR);
export type CommandKind = z.infer<typeof CommandKindSchema>;
export const CommandKind = CommandKindSchema.enum;

/**
 * Context collected once at command invocation.
 * Passed to all commands by default.
 */
export type CommandContext = {
	/** Selection info from vam.selection.getInfo() */
	selection: SelectionInfo | null;
	/** Current md file path from vam.mdPwd() */
	splitPath: SplitPathToMdFile | null;
};
