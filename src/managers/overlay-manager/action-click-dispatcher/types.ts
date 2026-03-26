/**
 * Types for action click dispatcher.
 */

import type { VaultActionManager } from "@textfresser/vault-action-manager";
import type { App } from "obsidian";
import type { CommandExecutor } from "../../obsidian/command-executor";

export type ActionClickContext = {
	app: App;
	commandExecutor: CommandExecutor | null;
	vam: VaultActionManager;
};
