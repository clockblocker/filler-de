import type { SuffixCodecs } from "../../internal/suffix";
import type { SplitPathInsideLibrary } from "../../split-path-inside-library/types/generic-split-path-inside-library-of";
import type { CanonicalSplitPathInsideLibrary } from "../types/canonical-split-path";

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
