import { err, ok, type Result } from "neverthrow";
import type { NonEmptyArray } from "../../../../../types/helpers";
import { nonEmptyArrayResult } from "../../../../../types/utils";
import {
	type NodeName,
	NodeNameSchema,
} from "../../../types/schemas/node-name";
import type { CodecError } from "../../errors";
import { makeSuffixError, makeZodError } from "../../errors";
import type { CodecRules } from "../../rules";

/**
 * Splits basename by suffix delimiter into parts.
 * Uses flexible pattern (any spacing around symbol) for parsing.
 * Trims each segment after split.
 * Returns Result with NonEmptyArray<NodeName>.
 */
export function splitBySuffixDelimiter(
	rules: CodecRules,
	basename: string,
): Result<NonEmptyArray<NodeName>, CodecError> {
	// Use flexible pattern for parsing (accepts any spacing)
	const raw = basename.split(rules.suffixDelimiterPattern);
	const out: NodeName[] = [];

	for (const seg of raw) {
		// Trim each segment after split
		const trimmed = seg.trim();
		const r = NodeNameSchema.safeParse(trimmed);
		if (!r.success) {
			return err(
				makeSuffixError(
					"InvalidNodeName",
					basename,
					r.error.issues[0]?.message ?? "Invalid node name in suffix",
					{ segment: trimmed },
					makeZodError(r.error.issues, "NodeName validation failed", {
						segment: trimmed,
					}),
				),
			);
		}
		out.push(r.data);
	}

	const nonEmptyResult = nonEmptyArrayResult(out);
	if (nonEmptyResult.isErr()) {
		return err(
			makeSuffixError(
				"EmptyParts",
				basename,
				"Basename must have at least one part",
				{ parts: raw },
			),
		);
	}

	return ok(nonEmptyResult.value);
}
