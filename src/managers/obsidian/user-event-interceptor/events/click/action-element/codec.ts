/**
 * ActionElementCodec - encodes action element click data into payload.
 */

import type { ActionElementPayload } from "./payload";
import { createActionElementPayload } from "./payload";

export type ActionElementClickData = {
	actionId: string;
	button: HTMLElement;
};

export const ActionElementCodec = {
	/**
	 * Encode action element click data into a payload.
	 */
	encode(data: ActionElementClickData): ActionElementPayload {
		return createActionElementPayload(data.actionId, data.button);
	},
};
