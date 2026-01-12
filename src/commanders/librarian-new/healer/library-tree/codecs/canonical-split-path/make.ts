import type { CodecError } from "../errors";
import type { CodecRules } from "../rules";
import type { SuffixCodecs } from "../internal/suffix";
import type { SplitPathInsideLibrary } from "../../tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import { fromCanonicalSplitPathInsideLibrary } from "./internal/from";
import { splitPathInsideLibraryToCanonical } from "./internal/to";
import type { CanonicalSplitPathInsideLibrary } from "../../tree-action/utils/canonical-naming/types";

export type CanonicalSplitPathCodecs = {
	splitPathInsideLibraryToCanonical: (
		sp: SplitPathInsideLibrary,
	) => Result<CanonicalSplitPathInsideLibrary, CodecError>;
	fromCanonicalSplitPathInsideLibrary: (
		sp: CanonicalSplitPathInsideLibrary,
	) => SplitPathInsideLibrary;
};

export function makeCanonicalSplitPathCodecs(
	rules: CodecRules,
	suffix: SuffixCodecs,
): CanonicalSplitPathCodecs {
	return {
		splitPathInsideLibraryToCanonical: (sp) =>
			splitPathInsideLibraryToCanonical(suffix, rules.libraryRootName, sp),
		fromCanonicalSplitPathInsideLibrary: (sp) =>
			fromCanonicalSplitPathInsideLibrary(suffix, sp),
	};
}
