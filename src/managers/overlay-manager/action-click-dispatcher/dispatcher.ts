/**
 * Dispatcher for action button clicks.
 *
 * Since OverlayActionKind is now a subset of CommandKind, we can dispatch
 * directly without translation (except for selection-based commands).
 */

import { MarkdownView } from "obsidian";
import { logger } from "../../../utils/logger";
import { CommandKind } from "../../actions-manager/types";
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
		case CommandKind.TranslateSelection:
			if (selection) {
				await commandExecutor({
					kind: CommandKind.TranslateSelection,
					payload: { selection },
				});
			}
			break;

		case CommandKind.SplitInBlocks:
			if (selection) {
				await commandExecutor({
					kind: CommandKind.SplitInBlocks,
					payload: { fileContent: "", selection },
				});
			}
			break;

		case CommandKind.Generate:
			await commandExecutor({
				kind: CommandKind.Generate,
				payload: {},
			});
			break;

		case CommandKind.GoToPrevPage:
			await commandExecutor({
				kind: CommandKind.GoToPrevPage,
				payload: {},
			});
			break;

		case CommandKind.GoToNextPage:
			await commandExecutor({
				kind: CommandKind.GoToNextPage,
				payload: {},
			});
			break;

		default:
			logger.warn(
				`[dispatchActionClick] Unknown action: ${JSON.stringify({ actionId })}`,
			);
	}
}
