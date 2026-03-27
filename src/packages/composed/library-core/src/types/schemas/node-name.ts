import z from "zod";
import { getParsedUserSettings } from "../../../../global-state/global-state";
import { CUSTOM_ERROR_CODE } from "../consts/literals";
import { NamingError } from "./errors";

/**
 * @example
 * // For "Library/parent/child/NoteName-child-parent.md":
 * "NoteName"
 *
 * @example
 * // For "Library/parent/child/__-child-parent.md":
 * "__"
 *
 * @example
 * // For "Library/parent/child":
 * "child"
 */
export const NodeNameSchema = z.string().superRefine((val, ctx) => {
	const { suffixDelimiterPattern } = getParsedUserSettings();

	// Reject empty or whitespace-only names
	if (val.trim().length === 0) {
		ctx.addIssue({
			code: CUSTOM_ERROR_CODE,
			message: NamingError.EmptyNodeName,
		});
		return;
	}

	// Use flexible pattern to detect delimiter (any spacing around symbol)
	if (val.split(suffixDelimiterPattern).length !== 1) {
		ctx.addIssue({
			code: CUSTOM_ERROR_CODE,
			message: NamingError.DelimiterInNodeName,
		});
	}
});

export type NodeName = z.infer<typeof NodeNameSchema>;
