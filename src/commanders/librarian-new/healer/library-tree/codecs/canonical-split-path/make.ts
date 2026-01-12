import type { CodecError } from "../errors";
import type { CodecRules } from "../rules";
import type { SuffixCodecs } from "../internal/suffix";
import type { SeparatedSuffixedBasename } from "../internal/suffix/types";
import type { SplitPathInsideLibrary } from "../../tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import type { NodeName } from "../../../../../types/schemas/node-name";
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
	// Suffix wrapper functions (expose internal suffix codecs)
	parseSeparatedSuffix: (
		basename: string,
	) => Result<SeparatedSuffixedBasename, CodecError>;
	serializeSeparatedSuffix: (
		suffix: SeparatedSuffixedBasename,
	) => string;
	suffixPartsToPathParts: (suffixParts: NodeName[]) => string[];
	pathPartsWithRootToSuffixParts: (pathParts: string[]) => NodeName[];
	pathPartsToSuffixParts: (pathParts: string[]) => NodeName[];
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
		// Suffix wrapper functions
		parseSeparatedSuffix: (basename) => suffix.parseSeparatedSuffix(basename),
		serializeSeparatedSuffix: (suffix) => suffix.serializeSeparatedSuffix(suffix),
		suffixPartsToPathParts: (suffixParts) =>
			suffix.suffixPartsToPathParts(suffixParts),
		pathPartsWithRootToSuffixParts: (pathParts) =>
			suffix.pathPartsWithRootToSuffixParts(pathParts),
		pathPartsToSuffixParts: (pathParts) =>
			suffix.pathPartsToSuffixParts(pathParts),
	};
}
