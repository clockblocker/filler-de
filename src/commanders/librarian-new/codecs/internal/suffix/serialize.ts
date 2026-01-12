import { err, ok, type Result } from "neverthrow";
import { NodeNameSchema } from "../../../types/schemas/node-name";
import type { CodecError } from "../../errors";
import { makeSuffixError, makeZodError } from "../../errors";
import type { CodecRules } from "../../rules";
import type { SeparatedSuffixedBasename } from "./types";

/**
 * Serializes separated suffixed basename to basename string.
 * Assumes validated inputs (NodeName[] are validated).
 */
export function serializeSeparatedSuffix(
	rules: CodecRules,
	suffix: SeparatedSuffixedBasename,
): string {
	return [suffix.coreName, ...suffix.suffixParts].join(rules.suffixDelimiter);
}

/**
 * Serializes separated suffixed basename from unchecked inputs.
 * Validates inputs and returns Result.
 */
export function serializeSeparatedSuffixUnchecked(
	rules: CodecRules,
	suffix: { coreName: string; suffixParts: string[] },
): Result<string, CodecError> {
	// Validate coreName
	const coreNameResult = NodeNameSchema.safeParse(suffix.coreName);
	if (!coreNameResult.success) {
		return err(
			makeSuffixError(
				"InvalidNodeName",
				suffix.coreName,
				coreNameResult.error.issues[0]?.message ?? "Invalid core name",
				{ coreName: suffix.coreName },
				makeZodError(
					coreNameResult.error.issues,
					"NodeName validation failed",
					{ coreName: suffix.coreName },
				),
			),
		);
	}

	// Validate suffixParts
	const validatedSuffixParts: string[] = [];
	for (const part of suffix.suffixParts) {
		const partResult = NodeNameSchema.safeParse(part);
		if (!partResult.success) {
			return err(
				makeSuffixError(
					"InvalidNodeName",
					part,
					partResult.error.issues[0]?.message ??
						"Invalid suffix part",
					{ suffixPart: part },
					makeZodError(
						partResult.error.issues,
						"NodeName validation failed",
						{ suffixPart: part },
					),
				),
			);
		}
		validatedSuffixParts.push(partResult.data);
	}

	return ok(
		serializeSeparatedSuffix(rules, {
			coreName: coreNameResult.data,
			suffixParts: validatedSuffixParts,
		}),
	);
}
