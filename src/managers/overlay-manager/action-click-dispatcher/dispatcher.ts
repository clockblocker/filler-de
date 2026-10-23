/**
 * Dispatcher for action button clicks.
 *
 * Since OverlayActionKind is a subset of CommandKind, we can dispatch
 * directly without translation. Selection is handled by CommandContext in executor.
 */

import type { OverlayActionKind } from "../action-definitions/types";
import type { ActionClickContext } from "./types";

/**
 * Dispatch an action click to the command executor, which runs the command
 * under its own span and logs how it failed.
 */
export async function dispatchActionClick(
	actionId: OverlayActionKind,
	{ commandExecutor }: ActionClickContext,
): Promise<void> {
	await commandExecutor(actionId);
}
