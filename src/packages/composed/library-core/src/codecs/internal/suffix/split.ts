import { Result } from "effect";
import type { NonEmptyArray } from "../../../internal/root/type-helpers";
import {
	type NodeName,
	nodeNameSchema,
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
): Result.Result<NonEmptyArray<NodeName>, CodecError> {
	// Use flexible pattern for parsing (accepts any spacing)
	const raw = basename.split(rules.suffixDelimiterPattern);
	const nameSchema = nodeNameSchema(rules.suffixDelimiterPattern);
	const out: NodeName[] = [];

	for (const seg of raw) {
		// Trim each segment after split
		const trimmed = seg.trim();
		const r = nameSchema.safeParse(trimmed);
		if (!r.success) {
			return Result.fail(
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

	const [first, ...rest] = out;
	if (first === undefined) {
		return Result.fail(
			makeSuffixError(
				"EmptyParts",
				basename,
				"Basename must have at least one part",
				{ parts: raw },
			),
		);
	}

	return Result.succeed([first, ...rest]);
}
