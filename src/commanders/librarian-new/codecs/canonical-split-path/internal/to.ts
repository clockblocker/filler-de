import type { Result } from "neverthrow";
import type { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CodecError } from "../../errors";
import type { SuffixCodecs } from "../../internal/suffix";
import type { SplitPathInsideLibraryOf } from "../../split-path-inside-library";
import type { CanonicalSplitPathInsideLibraryOf } from "../types/canonical-split-path";
import { canonizeSplitPathWithSeparatedSuffix } from "./canonicalization-policy";
import { splitPathInsideLibraryToWithSeparatedSuffix } from "./split-path-with-separated-suffix/to";

/**
 * Extracts duplicate marker (e.g., " 1", " 2") from end of basename.
 * Obsidian appends " N" when duplicating files.
 */
function extractDuplicateMarker(basename: string): {
	cleanBasename: string;
	marker: string;
} {
	const match = basename.match(/^(.+?)( \d+)$/);
	if (match) {
		return { cleanBasename: match[1] ?? basename, marker: match[2] ?? "" };
	}
	return { cleanBasename: basename, marker: "" };
}

/**
 * Converts split path inside library to canonical format.
 * Wrapper that uses new codec + policy for backward compatibility.
 * Handles duplicate markers (business logic) before canonization.
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

	let spWithSeparatedSuffix = withSeparatedSuffixResult.value;

	// Handle Obsidian duplicate marker (business logic)
	// Extract duplicate marker and re-attach to coreName
	const { cleanBasename, marker } = extractDuplicateMarker(sp.basename);
	if (marker) {
		// Re-parse without duplicate marker to get clean coreName
		const cleanSepResult = suffix.parseSeparatedSuffix(cleanBasename);
		if (cleanSepResult.isErr()) {
			return cleanSepResult as unknown as Result<
				CanonicalSplitPathInsideLibraryOf<SK>,
				CodecError
			>;
		}

		// Re-attach marker to coreName
		const coreNameWithMarker = cleanSepResult.value.coreName + marker;

		spWithSeparatedSuffix = {
			...spWithSeparatedSuffix,
			separatedSuffixedBasename: {
				coreName: coreNameWithMarker,
				suffixParts: cleanSepResult.value.suffixParts,
			},
		};
	}

	// Use policy to canonize (validates format)
	return canonizeSplitPathWithSeparatedSuffix(
		suffix,
		libraryRootName,
		spWithSeparatedSuffix,
	) as Result<CanonicalSplitPathInsideLibraryOf<SK>, CodecError>;
}
