import type { SuffixCodecs } from "../../internal/suffix";
import type { SplitPathInsideLibrary } from "../../tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import type { CanonicalSplitPathInsideLibrary } from "../../tree-action/utils/canonical-naming/types";

/**
 * Converts canonical split path to regular split path inside library.
 * Lossy: joins separated suffix into basename.
 */
export function fromCanonicalSplitPathInsideLibrary(
	suffix: SuffixCodecs,
	sp: CanonicalSplitPathInsideLibrary,
): SplitPathInsideLibrary {
	const basename = suffix.serializeSeparatedSuffix(sp.separatedSuffixedBasename);
	return {
		...sp,
		basename,
	};
}
