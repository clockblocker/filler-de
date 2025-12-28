import z from "zod";
import { getParsedUserSettings } from "../../../../global-state/global-state";
import { NamingError } from "../../naming/errors";
import { CUSTOM_ERROR_CODE } from "../literals";

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * "NoteName"
 *
 * @example
 * // For path "Library/parent/child/__-child-parent.md":
 * "__"
 */
export const NodeNameSchema = z.string().superRefine((val, ctx) => {
	const { suffixDelimiter } = getParsedUserSettings();

	if (val.length === 0) {
		ctx.addIssue({
			code: CUSTOM_ERROR_CODE,
			message: NamingError.EmptyNodeName,
		});
		return;
	}

	if (val.split(suffixDelimiter).length !== 1) {
		ctx.addIssue({
			code: CUSTOM_ERROR_CODE,
			message: NamingError.DelimiterInNodeName,
		});
	}
});

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * ["child", "parent"]
 */
export const SplitSuffixSchema = z.array(NodeNameSchema);

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * ["parent", "child"]
 */
export const NodeNameChainSchema = z.array(NodeNameSchema);

export type NodeName = z.infer<typeof NodeNameSchema>;
export type SplitSuffix = z.infer<typeof SplitSuffixSchema>;
export type NodeNameChain = z.infer<typeof NodeNameChainSchema>;
