/**
 * Types for action click dispatcher.
 */

import type { App } from "obsidian";
import type { CommandExecutor } from "../../actions-manager/create-action-executor";

export type ActionClickContext = {
	app: App;
	commandExecutor: CommandExecutor | null;
};
