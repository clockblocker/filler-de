import type { SuffixCodecs } from "../../internal/suffix";
import type { AnySplitPathInsideLibrary } from "../../split-path-inside-library";
import type { CanonicalSplitPathInsideLibrary } from "../types/canonical-split-path";

/**
 * Converts canonical split path to regular split path inside library.
 * Lossy: joins separated suffix into basename.
 */
export function fromCanonicalSplitPathInsideLibrary(
	suffix: SuffixCodecs,
	sp: CanonicalSplitPathInsideLibrary,
): AnySplitPathInsideLibrary {
	const basename = suffix.serializeSeparatedSuffix(
		sp.separatedSuffixedBasename,
	);
	return {
		...sp,
		basename,
	};
}
