/**
 * Dispatcher for action button clicks.
 *
 * Since OverlayActionKind is now a subset of CommandKind, we can dispatch
 * directly without translation. Selection is handled by CommandContext in executor.
 */

import { logger } from "../../../utils/logger";
import { CommandKind } from "../../actions-manager/types";
import type { ActionClickContext } from "./types";

/**
 * Dispatch an action click to the appropriate command executor.
 * Selection-based commands get context from VAM internally.
 */
export async function dispatchActionClick(
	actionId: string,
	context: ActionClickContext,
): Promise<void> {
	const { commandExecutor } = context;

	if (!commandExecutor) {
		logger.warn("[dispatchActionClick] No commandExecutor provided");
		return;
	}

	switch (actionId) {
		case CommandKind.TranslateSelection:
			await commandExecutor({
				kind: CommandKind.TranslateSelection,
				payload: {},
			});
			break;

		case CommandKind.SplitInBlocks:
			await commandExecutor({
				kind: CommandKind.SplitInBlocks,
				payload: {},
			});
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
