import type { SuffixCodecs } from "../../internal/suffix";
import type { SplitPathInsideLibrary } from "../../split-path-inside-library/types";
import type { CanonicalSplitPathInsideLibrary } from "../types";

/**
 * Converts canonical split path to regular split path inside library.
 * Lossy: joins separated suffix into basename.
 */
export function fromCanonicalSplitPathInsideLibrary(
	suffix: SuffixCodecs,
	sp: CanonicalSplitPathInsideLibrary,
): SplitPathInsideLibrary {
	const basename = suffix.serializeSeparatedSuffix(
		sp.separatedSuffixedBasename,
	);
	return {
		...sp,
		basename,
	};
}
