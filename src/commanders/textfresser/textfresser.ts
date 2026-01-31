/**
 * Textfresser commander - listens to WikilinkClicked events
 * and provides structured context from the latest click.
 */

import { err, type Result } from "neverthrow";
import type { WikilinkClickPayload } from "../../managers/obsidian/user-event-interceptor/events/click/wikilink-click/payload";
import {
	type EventHandler,
	HandlerOutcome,
} from "../../managers/obsidian/user-event-interceptor/types/handler";
import { logger } from "../../utils/logger";
import {
	buildTextfresserContext,
	type ContextError,
	noClickError,
	type TextfresserContext,
} from "./context";

export class Textfresser {
	private lastWikilinkClick: WikilinkClickPayload | null = null;

	/** EventHandler for UserEventInterceptor */
	createHandler(): EventHandler<WikilinkClickPayload> {
		return {
			doesApply: () => true,
			handle: (payload) => {
				this.lastWikilinkClick = payload;
				logger.info(
					"Textfresser: lastWikilinkClick",
					this.lastWikilinkClick,
				);
				return { outcome: HandlerOutcome.Passthrough };
			},
		};
	}

	/**
	 * Get structured context from the latest wikilink click.
	 * @returns Result with TextfresserContext or ContextError
	 */
	getLatestContext(): Result<TextfresserContext, ContextError> {
		if (!this.lastWikilinkClick) {
			return err(noClickError());
		}

		const { blockContent, linkTarget, splitPath } = this.lastWikilinkClick;

		return buildTextfresserContext({
			basename: splitPath.basename,
			blockContent,
			linkTarget,
		});
	}
}
