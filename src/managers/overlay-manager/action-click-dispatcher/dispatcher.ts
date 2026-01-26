/**
 * Dispatcher for action button clicks.
 */

import { MarkdownView } from "obsidian";
import { ActionKind } from "../../../deprecated-services/obsidian-services/deprecated-overlay-manager/types";
import { logger } from "../../../utils/logger";
import { OverlayActionKind } from "../action-definitions";
import type { ActionClickContext } from "./types";

/**
 * Dispatch an action click to the appropriate command executor.
 */
export async function dispatchActionClick(
	actionId: string,
	context: ActionClickContext,
): Promise<void> {
	const { app, commandExecutor } = context;

	if (!commandExecutor) {
		logger.warn("[dispatchActionClick] No commandExecutor provided");
		return;
	}

	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const selection = view?.editor?.getSelection() ?? "";

	switch (actionId) {
		case OverlayActionKind.Translate:
			if (selection) {
				await commandExecutor({
					kind: ActionKind.TranslateSelection,
					payload: { selection },
				});
			}
			break;

		case OverlayActionKind.SplitInBlocks:
			if (selection) {
				await commandExecutor({
					kind: ActionKind.SplitInBlocks,
					payload: { fileContent: "", selection },
				});
			}
			break;

		case OverlayActionKind.ExplainGrammar:
			if (selection) {
				await commandExecutor({
					kind: ActionKind.ExplainGrammar,
					payload: { selection },
				});
			}
			break;

		case OverlayActionKind.Generate:
			await commandExecutor({
				kind: ActionKind.Generate,
				payload: {},
			});
			break;

		default:
			logger.warn(
				`[dispatchActionClick] Unknown action: ${JSON.stringify({ actionId })}`,
			);
	}
}
