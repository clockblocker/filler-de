/**
 * Types for action click dispatcher.
 */

import type { App } from "obsidian";
import type { CommandExecutor } from "../../obsidian/command-executor";
import type { VaultActionManager } from "../../obsidian/vault-action-manager";

export type ActionClickContext = {
	app: App;
	commandExecutor: CommandExecutor | null;
	vam: VaultActionManager;
};
