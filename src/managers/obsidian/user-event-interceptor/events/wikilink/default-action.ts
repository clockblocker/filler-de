/**
 * Default action for wikilink events.
 *
 * If behaviors set an alias to insert, insert it at the close position.
 */

import type { ChainResult } from "../../types/transform-kind";
import { WikilinkCodec } from "./codec";
import type { WikilinkPayload } from "./payload";

/**
 * Execute the default wikilink action after behavior chain.
 */
export async function executeWikilinkDefaultAction(
	result: ChainResult<WikilinkPayload>,
): Promise<void> {
	switch (result.outcome) {
		case "skipped":
			// Do nothing - behavior chain decided to skip
			return;

		case "replaced":
			// Run the replacement action
			await result.action();
			return;

		case "completed":
			// Insert alias if set by behaviors
			WikilinkCodec.insertAlias(result.data);
			return;
	}
}
