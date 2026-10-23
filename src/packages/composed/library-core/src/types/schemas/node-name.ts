import z from "zod";
import { CUSTOM_ERROR_CODE } from "../consts/literals";
import { NamingError } from "./errors";

function makeNodeNameSchema(suffixDelimiterPattern: RegExp) {
	return z.string().superRefine((val, ctx) => {
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
}

type NodeNameSchema = ReturnType<typeof makeNodeNameSchema>;

const schemaByPattern = new WeakMap<RegExp, NodeNameSchema>();

/**
 * The schema of a node name under a suffix delimiter: not blank, and free of
 * the delimiter. Pass the `suffixDelimiterPattern` of the `CodecRules` in
 * hand, so one heal validates every name against one delimiter.
 *
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
export function nodeNameSchema(suffixDelimiterPattern: RegExp): NodeNameSchema {
	const cached = schemaByPattern.get(suffixDelimiterPattern);
	if (cached) return cached;
	const schema = makeNodeNameSchema(suffixDelimiterPattern);
	schemaByPattern.set(suffixDelimiterPattern, schema);
	return schema;
}

export type NodeName = z.infer<NodeNameSchema>;
