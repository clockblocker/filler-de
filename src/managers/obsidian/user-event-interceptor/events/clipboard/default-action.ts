/**
 * Default action for clipboard events.
 *
 * After behaviors have transformed the payload, this applies the final clipboard data.
 */

import type { ChainResult } from "../../types/transform-kind";
import { ClipboardCodec } from "./codec";
import type { ClipboardPayload } from "./payload";

/**
 * Execute the default clipboard action after behavior chain.
 *
 * @param result - Result from chain execution
 * @param evt - Original clipboard event (for clipboardData access)
 */
export async function executeClipboardDefaultAction(
	result: ChainResult<ClipboardPayload>,
	evt: ClipboardEvent,
): Promise<void> {
	switch (result.outcome) {
		case "skipped":
			// Do nothing - behavior chain decided to skip
			return;

		case "replaced":
			// Run the replacement action
			await result.action();
			return;

		case "completed": {
			// Apply the final payload to clipboard
			if (evt.clipboardData) {
				ClipboardCodec.decode(result.data, evt.clipboardData);
			}
			return;
		}
	}
}
