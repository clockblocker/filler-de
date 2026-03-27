/**
 * ActionElementPayload - payload for [data-action] button clicks.
 */

import { z } from "zod";
import { PayloadKind } from "../../../types/payload-base";

export const ActionElementPayloadSchema = z.object({
	/** The action ID from the data-action attribute */
	actionId: z.string(),
	kind: z.literal(PayloadKind.ActionElementClicked),
});

export type ActionElementPayload = z.infer<typeof ActionElementPayloadSchema>;

/**
 * Create an action element payload.
 */
export function createActionElementPayload(
	actionId: string,
): ActionElementPayload {
	return {
		actionId,
		kind: PayloadKind.ActionElementClicked,
	};
}
