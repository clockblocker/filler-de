/**
 * Textfresser commander - listens to WikilinkClicked events
 * and stores the latest click info in state.
 */

import type { WikilinkClickPayload } from "../../managers/obsidian/user-event-interceptor/events/click/wikilink-click/payload";
import {
	type EventHandler,
	HandlerOutcome,
} from "../../managers/obsidian/user-event-interceptor/types/handler";
import { logger } from "../../utils/logger";

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

	getLastWikilinkClick(): WikilinkClickPayload | null {
		return this.lastWikilinkClick;
	}
}
