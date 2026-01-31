import { Notice } from "obsidian";
import type { Librarian } from "../../commanders/librarian/librarian";
import type { Textfresser } from "../../commanders/textfresser/textfresser";
import { logger } from "../../utils/logger";
import type { VaultActionManager } from "../obsidian/vault-action-manager";
import {
	type ExplainGrammarPayload,
	explainGrammarCommand,
} from "./commands/explain-grammar-command";
import {
	makeNavigatePageCommand,
	type NavigatePagePayload,
} from "./commands/navigate-pages-command";
import { splitIntoPagesCommand } from "./commands/split-into-pages-command";
import {
	type SplitInBlocksPayload,
	splitSelectionBlocksCommand,
} from "./commands/split-selection-blocks-command";
import {
	type TestButtonPayload,
	testButtonCommand,
} from "./commands/test-button-command";
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
	vaultActionManager: VaultActionManager;
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
	const { librarian, textfresser, vaultActionManager } = managers;

	const notify = (message: string) => {
		new Notice(message);
	};

	const navigatePageCommand = makeNavigatePageCommand(
		librarian,
		vaultActionManager,
	);

	return async function executeCommand<K extends CommandKind>(
		command: ExecuteCommandInput<K>,
	): Promise<void> {
		const { kind, payload } = command;

		switch (kind) {
			case CommandKind.NavigatePage: {
				const p = payload as NavigatePagePayload;
				await navigatePageCommand(p);
				break;
			}

			case CommandKind.MakeText:
			case CommandKind.SplitToPages: {
				// Both actions do the same thing - split scroll into pages
				await splitIntoPagesCommand({
					librarian,
					vaultActionManager,
				});
				break;
			}

			case CommandKind.SplitInBlocks: {
				const p = payload as SplitInBlocksPayload;
				const contentResult =
					await vaultActionManager.getOpenedContent();
				if (contentResult.isErr()) {
					notify(`Error: ${contentResult.error}`);
					break;
				}
				splitSelectionBlocksCommand(
					{ ...p, fileContent: contentResult.value },
					{
						notify,
						replaceSelection: (text: string) => {
							vaultActionManager.openedFileService.replaceSelection(
								text,
							);
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

			case CommandKind.ExplainGrammar: {
				const p = payload as ExplainGrammarPayload;
				await explainGrammarCommand(p, {});
				break;
			}

			case CommandKind.Generate: {
				if (!textfresser) {
					logger.warn("[CommandExecutor] Textfresser not initialized");
					break;
				}
				await textfresser.generate();
				break;
			}

			case CommandKind.TestButton: {
				const p = payload as TestButtonPayload;
				testButtonCommand(p);
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
