import type { Result } from "neverthrow";
import type { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CodecError } from "../../errors";
import type { SuffixCodecs } from "../../internal/suffix";
import type { SplitPathInsideLibraryOf } from "../../split-path-inside-library";
import type { CanonicalSplitPathInsideLibraryOf } from "../types/canonical-split-path";
import { canonizeSplitPathWithSeparatedSuffix } from "./canonicalization-policy";
import { splitPathInsideLibraryToWithSeparatedSuffix } from "./split-path-with-separated-suffix/to";

/**
 * Converts split path inside library to canonical format.
 * Wrapper that uses new codec + policy for backward compatibility.
 */
export function splitPathInsideLibraryToCanonical<SK extends SplitPathKind>(
	suffix: SuffixCodecs,
	libraryRootName: string,
	sp: SplitPathInsideLibraryOf<SK>,
): Result<CanonicalSplitPathInsideLibraryOf<SK>, CodecError> {
	// Use new codec to convert to separated suffix format
	const withSeparatedSuffixResult =
		splitPathInsideLibraryToWithSeparatedSuffix(suffix, sp);
	if (withSeparatedSuffixResult.isErr()) {
		return withSeparatedSuffixResult as Result<
			CanonicalSplitPathInsideLibraryOf<SK>,
			CodecError
		>;
	}

	// Use policy to canonize (validates format)
	return canonizeSplitPathWithSeparatedSuffix(
		suffix,
		libraryRootName,
		withSeparatedSuffixResult.value,
	) as Result<CanonicalSplitPathInsideLibraryOf<SK>, CodecError>;
}
