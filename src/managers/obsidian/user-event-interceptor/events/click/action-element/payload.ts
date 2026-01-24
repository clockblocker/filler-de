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

/**
 * ActionElementPayload includes the button element which can't be validated by Zod.
 */
export type ActionElementPayload = z.infer<
	typeof ActionElementPayloadSchema
> & {
	/** The button element that was clicked */
	button: HTMLElement;
};

/**
 * Create an action element payload.
 */
export function createActionElementPayload(
	actionId: string,
	button: HTMLElement,
): ActionElementPayload {
	return {
		actionId,
		button,
		kind: PayloadKind.ActionElementClicked,
	};
}
