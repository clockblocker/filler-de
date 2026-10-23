import { Result } from "effect";
import type { CodecError } from "../../errors";
import type { CodecRules } from "../../rules";
import { splitBySuffixDelimiter } from "./split";
import type { SeparatedSuffixedBasename } from "./types";

/**
 * Parses basename into separated suffixed basename.
 */
export function parseSeparatedSuffix(
	rules: CodecRules,
	basename: string,
): Result.Result<SeparatedSuffixedBasename, CodecError> {
	return Result.map(splitBySuffixDelimiter(rules, basename), (parts) => {
		const [coreName, ...suffixParts] = parts;
		return { coreName, suffixParts };
	});
}
