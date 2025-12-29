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
export const NodeNameSchemaDeprecated = z.string().superRefine((val, ctx) => {
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
export const SplitSuffixSchemaDeprecated = z.array(NodeNameSchemaDeprecated);

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * ["parent", "child"]
 */
export const NodeNameChainSchemaDeprecated = z.array(NodeNameSchemaDeprecated);

export type NodeNameDeprecated = z.infer<typeof NodeNameSchemaDeprecated>;
export type SplitSuffixDeprecated = z.infer<typeof SplitSuffixSchemaDeprecated>;
export type NodeNameChainDeprecated = z.infer<
	typeof NodeNameChainSchemaDeprecated
>;
