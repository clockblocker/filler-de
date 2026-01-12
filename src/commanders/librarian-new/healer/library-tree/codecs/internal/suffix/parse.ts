import { err, ok, type Result } from "neverthrow";
import type { CodecError } from "../../errors";
import type { CodecRules } from "../../rules";
import type { SeparatedSuffixedBasename } from "./types";
import { splitBySuffixDelimiter } from "./split";

/**
 * Parses basename into separated suffixed basename.
 */
export function parseSeparatedSuffix(
	rules: CodecRules,
	basename: string,
): Result<SeparatedSuffixedBasename, CodecError> {
	return splitBySuffixDelimiter(rules, basename).map((parts) => {
		const [coreName, ...suffixParts] = parts;
		return { coreName, suffixParts };
	});
}
