/**
 * Types for action click dispatcher.
 */

import type { App } from "obsidian";
import type { CommandExecutor } from "../../actions-manager/create-action-executor";
import type { SplitPathToMdFile } from "../../obsidian/vault-action-manager/types/split-path";

export type ActionClickContext = {
	app: App;
	commandExecutor: CommandExecutor | null;
	getCurrentFilePath: () => SplitPathToMdFile | null;
};
