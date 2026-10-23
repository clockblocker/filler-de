import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { Effect, Exit } from "effect";
import { Notice, type Plugin } from "obsidian";
import type { KnowledgeQueue } from "../commanders/classify";
import {
	CANCEL_RESET_COMMAND_NAME,
	type DictionaryResetCommand,
	RESET_COMMAND_NAME,
} from "../commanders/dictionary-reset/reset-command";
import { RESTART_LIBRARIAN_COMMAND_NAME } from "../commanders/librarian/runtime/describe-librarian-stop";
import { tagLineCopyEmbedBehavior } from "../managers/obsidian/behavior-manager";
import { CommandKind } from "../managers/obsidian/command-executor";
import type { PluginRuntime } from "../runtime/plugin-runtime";
import { recentTrace } from "../utils/recent-trace";

/** What the palette commands reach; null while the plugin still loads. */
export type PluginCommandDeps = {
	/** Runs a command's program under `command.<id>`, and reads synchronously. */
	readonly runtime: Pick<
		PluginRuntime<never, unknown>,
		"command" | "readSync"
	>;
	readonly execute: (kind: CommandKind) => void;
	readonly vam: () => VaultActionManager | null;
	readonly knowledgeQueue: () => KnowledgeQueue | null;
	readonly dictionaryReset: () => DictionaryResetCommand | null;
	/** The "Restart Librarian" program. */
	readonly restartLibrarian: Effect.Effect<void>;
	readonly stillLoading: () => void;
};

const notify = (message: string) =>
	Effect.sync(() => {
		new Notice(message);
	});

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
				const selection = deps.runtime.readSync(vam.getSelectionInfo());
				if (Exit.isSuccess(selection) && selection.value) {
					// Selection is collected by CommandContext in executor
					deps.execute(CommandKind.SplitInBlocks);
				} else {
					void deps.runtime.command(
						"split-selection-in-blocks",
						tagLineCopyEmbedBehavior(vam),
					);
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
			// The command's program starts at once, so E2E finds the opening
			// right after running the command.
			if (reset)
				void deps.runtime.command(
					"reset-dictionary-from-old-notes",
					reset.open,
				);
			else deps.stillLoading();
		},
		id: "reset-dictionary-from-old-notes",
		name: RESET_COMMAND_NAME,
	});

	plugin.addCommand({
		callback: () => {
			const reset = deps.dictionaryReset();
			void deps.runtime.command(
				"cancel-dictionary-reset",
				(reset?.cancel ?? Effect.succeed(false)).pipe(
					Effect.flatMap((cancelled) =>
						notify(
							cancelled
								? "Cancelling the dictionary reset after its current step"
								: "No dictionary reset is running",
						),
					),
				),
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
		callback: () => {
			void deps.runtime.command(
				"restart-librarian",
				deps.restartLibrarian,
			);
		},
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
