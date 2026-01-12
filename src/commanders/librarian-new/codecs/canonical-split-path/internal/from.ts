import type { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { SuffixCodecs } from "../../internal/suffix";
import type { SplitPathInsideLibraryOf } from "../../split-path-inside-library";
import type { CanonicalSplitPathInsideLibraryOf } from "../types/canonical-split-path";

/**
 * Converts canonical split path to regular split path inside library.
 * Lossy: joins separated suffix into basename.
 */
export function fromCanonicalSplitPathInsideLibrary<SK extends SplitPathKind>(
	suffix: SuffixCodecs,
	sp: CanonicalSplitPathInsideLibraryOf<SK>,
): SplitPathInsideLibraryOf<SK> {
	const basename = suffix.serializeSeparatedSuffix(
		sp.separatedSuffixedBasename,
	);
	return {
		...sp,
		basename,
	} as SplitPathInsideLibraryOf<SK>;
}
