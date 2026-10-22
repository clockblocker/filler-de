import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { Effect, Exit } from "effect";
import { type App, Notice, type Plugin } from "obsidian";
import type { KnowledgeQueue } from "../commanders/classify";
import {
	CANCEL_RESET_COMMAND_NAME,
	type DictionaryResetCommand,
	RESET_COMMAND_NAME,
} from "../commanders/dictionary-reset/reset-command";
import { RESTART_LIBRARIAN_COMMAND_NAME } from "../commanders/librarian/runtime/describe-librarian-stop";
import { tagLineCopyEmbedBehavior } from "../managers/obsidian/behavior-manager";
import { CommandKind } from "../managers/obsidian/command-executor";
import { recentTrace } from "../utils/recent-trace";

/** What the palette commands reach; null while the plugin still loads. */
export type PluginCommandDeps = {
	readonly app: App;
	readonly execute: (kind: CommandKind) => void;
	readonly vam: () => VaultActionManager | null;
	readonly knowledgeQueue: () => KnowledgeQueue | null;
	readonly dictionaryReset: () => DictionaryResetCommand | null;
	readonly restartLibrarian: () => void;
	readonly stillLoading: () => void;
};

/** Adds the plugin's command palette commands. */
export function registerCommands(plugin: Plugin, deps: PluginCommandDeps) {
	plugin.addCommand({
		editorCheckCallback: () => {
			return false;
		},
		id: "fill-template",
		name: "Generate a dictionary entry for the word in the title of the file",
	});

	plugin.addCommand({
		editorCheckCallback: () => {
			return false;
		},
		id: "duplicate-selection",
		name: "Add links to normal/inf forms to selected text",
	});

	plugin.addCommand({
		editorCheckCallback: (checking: boolean) => {
			if (!checking) {
				// Selection is collected by CommandContext in executor
				deps.execute(CommandKind.TranslateSelection);
			}
			return true;
		},
		id: "translate-selection",
		name: "Translate selected text",
	});

	plugin.addCommand({
		editorCheckCallback: (checking: boolean) => {
			if (!checking) {
				const vam = deps.vam();
				if (!vam) return true;
				// Check if there's a selection via VAM
				const selection = Effect.runSyncExit(vam.getSelectionInfo());
				if (Exit.isSuccess(selection) && selection.value) {
					// Selection is collected by CommandContext in executor
					deps.execute(CommandKind.SplitInBlocks);
				} else {
					tagLineCopyEmbedBehavior({ app: deps.app, vam });
				}
			}
			return true;
		},
		id: "split-selection-in-blocks",
		name: "Split selected text in blocks",
	});

	plugin.addCommand({
		editorCheckCallback: () => {
			// TODO: insertReplyFromKeymaker - command handles selection internally
			return false;
		},
		id: "check-ru-de-translation",
		name: "Keymaker",
	});

	plugin.addCommand({
		editorCheckCallback: () => {
			// TODO: librarian.ls - command handles selection internally
			return false;
		},
		id: "check-schriben",
		name: "Schriben check",
	});

	plugin.addCommand({
		editorCheckCallback: (checking: boolean) => {
			if (!checking) {
				deps.execute(CommandKind.Classify);
			}
			return true;
		},
		id: "classify-selection",
		name: "Classify selection",
	});

	plugin.addCommand({
		callback: () => {
			const cancelled = deps.knowledgeQueue()?.cancelAll() ?? 0;
			new Notice(
				cancelled > 0
					? `Cancelled Knowledge generation for ${cancelled} Reading${cancelled === 1 ? "" : "s"}`
					: "No Knowledge generation is running",
			);
		},
		id: "cancel-knowledge-generation",
		name: "Cancel background Knowledge generation",
	});

	plugin.addCommand({
		callback: () => {
			const reset = deps.dictionaryReset();
			if (reset) reset.open();
			else deps.stillLoading();
		},
		id: "reset-dictionary-from-old-notes",
		name: RESET_COMMAND_NAME,
	});

	plugin.addCommand({
		callback: () => {
			new Notice(
				deps.dictionaryReset()?.cancel()
					? "Cancelling the dictionary reset after its current step"
					: "No dictionary reset is running",
			);
		},
		id: "cancel-dictionary-reset",
		name: CANCEL_RESET_COMMAND_NAME,
	});

	plugin.addCommand({
		editorCheckCallback: (checking: boolean) => {
			if (!checking) {
				deps.execute(CommandKind.SplitToPages);
			}
			return true;
		},
		id: "split-to-pages",
		name: "Split file into pages",
	});

	plugin.addCommand({
		callback: deps.restartLibrarian,
		id: "restart-librarian",
		name: RESTART_LIBRARIAN_COMMAND_NAME,
	});

	plugin.addCommand({
		callback: () => {
			void navigator.clipboard.writeText(recentTrace.render()).then(
				() => new Notice("Copied the recent trace"),
				() => new Notice("⚠ Could not copy the recent trace"),
			);
		},
		id: "copy-recent-trace",
		name: "Copy recent trace",
	});
}
