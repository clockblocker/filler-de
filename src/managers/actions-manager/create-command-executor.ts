import { Notice } from "obsidian";
import type { LibrarianCommandKind } from "../../commanders/librarian/commands/types";
import type { Librarian } from "../../commanders/librarian/librarian";
import type { Textfresser } from "../../commanders/textfresser/textfresser";
import { logger } from "../../utils/logger";
import type { VaultActionManager } from "../obsidian/vault-action-manager";
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
		const splitPath = vam.mdPwd();
		let activeFile: CommandContext["activeFile"] = null;
		if (splitPath) {
			const contentResult = vam.getOpenedContent();
			if (contentResult.isOk()) {
				activeFile = { content: contentResult.value, splitPath };
			}
		}
		return {
			activeFile,
			selection: vam.selection.getInfo(),
		};
	}

	return async function executeCommand(kind: CommandKind): Promise<void> {
		const context = collectContext();

		switch (kind) {
			case CommandKind.GoToPrevPage:
			case CommandKind.GoToNextPage:
			case CommandKind.MakeText:
			case CommandKind.SplitToPages:
			case CommandKind.SplitInBlocks: {
				// Delegate to librarian - codex guard handled internally
				const librarianKind = kind as LibrarianCommandKind;
				await librarian.executeCommand(librarianKind, context, notify);
				break;
			}

			case CommandKind.TranslateSelection:
			case CommandKind.Generate:
			case CommandKind.Lemma: {
				await textfresser.executeCommand(kind, context);
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
