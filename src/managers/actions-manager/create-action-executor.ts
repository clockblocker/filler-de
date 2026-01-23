import { Notice } from "obsidian";
import type { Librarian } from "../../commanders/librarian/librarian";
import {
	ActionKind,
	type ActionPayloads,
} from "../../deprecated-services/obsidian-services/deprecated-overlay-manager/types";
import { logger } from "../../utils/logger";
import type { VaultActionManager } from "../obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../obsidian/vault-action-manager/types/split-path";
import {
	type ExplainGrammarPayload,
	explainGrammarAction,
} from "./actions/executors/explain-grammar-action";
import {
	type GeneratePayload,
	generateAction,
} from "./actions/executors/generate-action";
import {
	type NavigatePagePayload,
	navigatePageAction,
} from "./actions/executors/navigate-pages-action";
import { splitIntoPagesAction } from "./actions/executors/split-into-pages";
import {
	type SplitInBlocksPayload,
	splitSelectionInBlocksAction,
} from "./actions/executors/split-selection-blocks-action";
import {
	type TranslateSelectionPayload,
	translateSelectionAction,
} from "./actions/executors/translate-selection-action";

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

	return async function executeAction<K extends ActionKind>(
		action: ExecuteActionInput<K>,
	): Promise<void> {
		const { kind, payload } = action;

		switch (kind) {
			case ActionKind.NavigatePage: {
				const p = payload as NavigatePagePayload;
				await navigatePageAction(p, {
					getAdjacentPage: (path: SplitPathToMdFile, dir: -1 | 1) => {
						if (!librarian) return null;
						return dir === -1
							? librarian.getPrevPage(path)
							: librarian.getNextPage(path);
					},
					navigate: async (path: SplitPathToMdFile) => {
						await vaultActionManager.cd(path);
					},
				});
				break;
			}

			case ActionKind.MakeText:
			case ActionKind.SplitToPages: {
				// Both actions do the same thing - split scroll into pages
				await splitIntoPagesAction({
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
				splitSelectionInBlocksAction(
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
				await translateSelectionAction(p, {});
				break;
			}

			case ActionKind.ExplainGrammar: {
				const p = payload as ExplainGrammarPayload;
				await explainGrammarAction(p, {});
				break;
			}

			case ActionKind.Generate: {
				const p = payload as GeneratePayload;
				await generateAction(p, {});
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
