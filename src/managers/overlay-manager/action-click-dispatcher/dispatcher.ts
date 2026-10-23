/**
 * Dispatcher for action button clicks.
 *
 * Since OverlayActionKind is a subset of CommandKind, we can dispatch
 * directly without translation. Selection is handled by CommandContext in executor.
 */

import { Effect } from "effect";
import type { OverlayActionKind } from "../action-definitions/types";
import type { ActionClickContext } from "./types";

/**
 * Dispatch an action click to the command executor, which runs the command
 * under its own span and logs how it failed; ends once the command did.
 */
export const dispatchActionClick = (
	actionId: OverlayActionKind,
	{ commandExecutor }: ActionClickContext,
): Effect.Effect<void> => Effect.promise(() => commandExecutor(actionId));
