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
	const { separatedSuffixedBasename: _, ...rest } = sp;
	// TypeScript can't prove structural equivalence: CanonicalSplitPathInsideLibraryOf<SK>
	// is Omit<SplitPathInsideLibraryOf<SK>, "basename"> & { separatedSuffixedBasename },
	// so omitting separatedSuffixedBasename and adding basename should yield SplitPathInsideLibraryOf<SK>,
	// but the generic SK prevents TypeScript from narrowing the union.
	return {
		...rest,
		basename,
	} as unknown as SplitPathInsideLibraryOf<SK>;
}
