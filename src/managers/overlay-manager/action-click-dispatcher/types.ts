/**
 * Types for action click dispatcher.
 */

import type { CommandExecutor } from "../../obsidian/command-executor";

export type ActionClickContext = {
	commandExecutor: CommandExecutor | null;
};
