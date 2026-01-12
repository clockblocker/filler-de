import { err, ok, type Result } from "neverthrow";
import type { NonEmptyArray } from "../../../../../../types/helpers";
import { nonEmptyArrayResult } from "../../../../../../../types/utils";
import { NodeNameSchema } from "../../../../../types/schemas/node-name";
import type { CodecError } from "../../errors";
import { makeSuffixError, makeZodError } from "../../errors";
import type { CodecRules } from "../../rules";

/**
 * Splits basename by suffix delimiter into parts.
 * Returns Result with NonEmptyArray<NodeName>.
 */
export function splitBySuffixDelimiter(
	rules: CodecRules,
	basename: string,
): Result<NonEmptyArray<NodeName>, CodecError> {
	const raw = basename.split(rules.suffixDelimiter);
	const out: NodeName[] = [];

	for (const seg of raw) {
		const r = NodeNameSchema.safeParse(seg);
		if (!r.success) {
			return err(
				makeSuffixError(
					"InvalidNodeName",
					basename,
					r.error.issues[0]?.message ?? "Invalid node name in suffix",
					{ segment: seg },
					makeZodError(r.error.issues, "NodeName validation failed", {
						segment: seg,
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
