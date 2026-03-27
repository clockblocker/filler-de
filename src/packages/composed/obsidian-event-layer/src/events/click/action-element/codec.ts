/**
 * ActionElementCodec - encodes action element click data into payload.
 */

import { createEventCodec } from "../../codec-factory";
import type { ActionElementPayload } from "./payload";
import { createActionElementPayload } from "./payload";

type ActionElementClickData = {
	actionId: string;
};

export const ActionElementCodec = createEventCodec(
	/**
	 * Encode action element click data into a payload.
	 */
	(data: ActionElementClickData): ActionElementPayload =>
		createActionElementPayload(data.actionId),
);
