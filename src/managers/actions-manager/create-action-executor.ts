import { Notice } from "obsidian";
import type { Librarian } from "../../commanders/librarian/librarian";
import type { Textfresser } from "../../commanders/textfresser/textfresser";
import { logger } from "../../utils/logger";
import type { VaultActionManager } from "../obsidian/vault-action-manager";
import {
	goToNextPageCommand,
	goToPrevPageCommand,
} from "./commands/navigate-pages-command";
import { splitIntoPagesCommand } from "./commands/split-into-pages-command";
import {
	type SplitInBlocksPayload,
	splitSelectionBlocksCommand,
} from "./commands/split-selection-blocks-command";
import {
	type TranslateSelectionPayload,
	translateSelectionCommand,
} from "./commands/translate-selection-command";
import { CommandKind, type CommandPayloads } from "./types";

/**
 * Managers needed to build command executor.
 */
export type CommandExecutorManagers = {
	librarian: Librarian | null;
	textfresser: Textfresser | null;
	vam: VaultActionManager;
};

/**
 * Command to execute with typed payload.
 */
export type ExecuteCommandInput<K extends CommandKind = CommandKind> = {
	kind: K;
	payload: CommandPayloads[K];
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

	return async function executeCommand<K extends CommandKind>(
		command: ExecuteCommandInput<K>,
	): Promise<void> {
		const { kind, payload } = command;

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
				const p = payload as SplitInBlocksPayload;
				const contentResult = await vam.getOpenedContent();
				if (contentResult.isErr()) {
					notify(`Error: ${contentResult.error}`);
					break;
				}
				splitSelectionBlocksCommand(
					{ ...p, fileContent: contentResult.value },
					{
						notify,
						replaceSelection: (text: string) => {
							vam.openedFileService.replaceSelection(text);
						},
					},
				);
				break;
			}

			case CommandKind.TranslateSelection: {
				const p = payload as TranslateSelectionPayload;
				await translateSelectionCommand(p, {});
				break;
			}

			case CommandKind.Generate: {
				if (!textfresser) {
					logger.warn(
						"[CommandExecutor] Textfresser not initialized",
					);
					break;
				}
				await textfresser.generate();
				break;
			}

			case CommandKind.Lemma: {
				if (!textfresser) {
					logger.warn(
						"[CommandExecutor] Textfresser not initialized",
					);
					break;
				}
				await textfresser.lemma();
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
