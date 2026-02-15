/**
 * ActionElementCodec - encodes action element click data into payload.
 */

import { createEventCodec } from "../../codec-factory";
import type { ActionElementPayload } from "./payload";
import { createActionElementPayload } from "./payload";

export type ActionElementClickData = {
	actionId: string;
	button: HTMLElement;
};

export const ActionElementCodec = createEventCodec(
	/**
	 * Encode action element click data into a payload.
	 */
	(data: ActionElementClickData): ActionElementPayload =>
		createActionElementPayload(data.actionId, data.button),
);
