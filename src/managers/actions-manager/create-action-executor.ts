import { Notice } from "obsidian";
import type { Librarian } from "../../commanders/librarian/librarian";
import {
	ActionKind,
	type ActionPayloads,
} from "../../deprecated-services/obsidian-services/deprecated-overlay-manager/types";
import { logger } from "../../utils/logger";
import type { VaultActionManager } from "../obsidian/vault-action-manager";
import {
	type ExplainGrammarPayload,
	explainGrammarCommand,
} from "./commands/explain-grammar-command";
import {
	type GeneratePayload,
	generateCommand,
} from "./commands/generate-command";
import {
	type NavigatePagePayload,
	makeNavigatePageCommand,
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

/**
 * Managers needed to build action executor.
 */
export type ActionExecutorManagers = {
	librarian: Librarian | null;
	vaultActionManager: VaultActionManager;
};

/**
 * Action to execute with typed payload.
 */
export type ExecuteActionInput<K extends ActionKind = ActionKind> = {
	kind: K;
	payload: ActionPayloads[K];
};

/**
 * Create action executor with injected managers.
 * Returns a function that executes actions by kind.
 */
export function createActionExecutor(managers: ActionExecutorManagers) {
	const { librarian, vaultActionManager } = managers;

	const notify = (message: string) => {
		new Notice(message);
	};

	const navigatePageCommand = makeNavigatePageCommand(
		librarian,
		vaultActionManager,
	);

	return async function executeAction<K extends ActionKind>(
		action: ExecuteActionInput<K>,
	): Promise<void> {
		const { kind, payload } = action;

		switch (kind) {
			case ActionKind.NavigatePage: {
				const p = payload as NavigatePagePayload;
				await navigatePageCommand(p);
				break;
			}

			case ActionKind.MakeText:
			case ActionKind.SplitToPages: {
				// Both actions do the same thing - split scroll into pages
				await splitIntoPagesCommand({
					librarian,
					vaultActionManager,
				});
				break;
			}

			case ActionKind.SplitInBlocks: {
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

			case ActionKind.TranslateSelection: {
				const p = payload as TranslateSelectionPayload;
				await translateSelectionCommand(p, {});
				break;
			}

			case ActionKind.ExplainGrammar: {
				const p = payload as ExplainGrammarPayload;
				await explainGrammarCommand(p, {});
				break;
			}

			case ActionKind.Generate: {
				const p = payload as GeneratePayload;
				await generateCommand(p, {});
				break;
			}

			default: {
				const exhaustiveCheck: never = kind;
				logger.error(
					`[ActionExecutor] Unknown action kind: ${exhaustiveCheck}`,
				);
			}
		}
	};
}

/**
 * Type for the returned executor function.
 */
export type ActionExecutor = ReturnType<typeof createActionExecutor>;
