import { Notice } from "obsidian";
import { isCodexSplitPath } from "../../commanders/librarian/healer/library-tree/codex/helpers";
import type { Librarian } from "../../commanders/librarian/librarian";
import type { Textfresser } from "../../commanders/textfresser/textfresser";
import { logger } from "../../utils/logger";
import type { VaultActionManager } from "../obsidian/vault-action-manager";
import {
	goToNextPageCommand,
	goToPrevPageCommand,
} from "./commands/navigate-pages-command";
import { splitIntoPagesCommand } from "./commands/split-into-pages-command";
import { splitSelectionBlocksCommand } from "./commands/split-selection-blocks-command";
import { type CommandContext, CommandKind } from "./types";

/**
 * Managers needed to build command executor.
 */
export type CommandExecutorManagers = {
	librarian: Librarian;
	textfresser: Textfresser;
	vam: VaultActionManager;
};

/**
 * Create command executor with injected managers.
 * Returns a function that executes commands by kind.
 */
export function createCommandExecutor(managers: CommandExecutorManagers) {
	const { librarian, textfresser, vam } = managers;

	const notify = (message: string) => {
		new Notice(message);
	};

	/**
	 * Collect command context once at invocation.
	 */
	function collectContext(): CommandContext {
		return {
			selection: vam.selection.getInfo(),
			splitPath: vam.mdPwd(),
		};
	}

	return async function executeCommand(kind: CommandKind): Promise<void> {
		const context = collectContext();

		// Block non-nav commands on codex files
		const isNavCommand =
			kind === CommandKind.GoToPrevPage ||
			kind === CommandKind.GoToNextPage;

		if (!isNavCommand) {
			const currentFile = vam.mdPwd();
			if (currentFile && isCodexSplitPath(currentFile)) {
				return; // silently skip on codex
			}
		}

		switch (kind) {
			case CommandKind.GoToPrevPage:
				await goToPrevPageCommand(vam);
				break;

			case CommandKind.GoToNextPage:
				await goToNextPageCommand(vam);
				break;

			case CommandKind.MakeText:
			case CommandKind.SplitToPages: {
				// Both actions do the same thing - split scroll into pages
				await splitIntoPagesCommand({
					librarian,
					vam,
				});
				break;
			}

			case CommandKind.SplitInBlocks: {
				await splitSelectionBlocksCommand(context, { notify, vam });
				break;
			}

			case CommandKind.TranslateSelection: {
				await textfresser.translateSelection(context);
				break;
			}

			case CommandKind.Generate: {
				await textfresser.generate(context);
				break;
			}

			case CommandKind.Lemma: {
				await textfresser.lemma(context);
				break;
			}

			default: {
				const exhaustiveCheck: never = kind;
				logger.error(
					`[CommandExecutor] Unknown command kind: ${exhaustiveCheck}`,
				);
			}
		}
	};
}

/**
 * Type for the returned executor function.
 */
export type CommandExecutor = ReturnType<typeof createCommandExecutor>;
