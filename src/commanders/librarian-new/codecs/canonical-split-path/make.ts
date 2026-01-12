import type { Result } from "neverthrow";
import type { NodeName } from "../../types/schemas/node-name";
import type { CodecError } from "../errors";
import type { SuffixCodecs } from "../internal/suffix";
import type { SeparatedSuffixedBasename } from "../internal/suffix/types";
import type { CodecRules } from "../rules";
import type { SplitPathInsideLibrary } from "../split-path-inside-library/types";
import { fromCanonicalSplitPathInsideLibrary } from "./internal/from";
import { splitPathInsideLibraryToCanonical } from "./internal/to";
import type { CanonicalSplitPathInsideLibrary } from "./types/canonical-split-path";

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
	serializeSeparatedSuffix: (suffix: SeparatedSuffixedBasename) => string;
	suffixPartsToPathParts: (suffixParts: NodeName[]) => string[];
	pathPartsWithRootToSuffixParts: (pathParts: string[]) => NodeName[];
	pathPartsToSuffixParts: (pathParts: string[]) => NodeName[];
};

export function makeCanonicalSplitPathCodecs(
	rules: CodecRules,
	suffix: SuffixCodecs,
): CanonicalSplitPathCodecs {
	return {
		fromCanonicalSplitPathInsideLibrary: (sp) =>
			fromCanonicalSplitPathInsideLibrary(suffix, sp),
		// Suffix wrapper functions
		parseSeparatedSuffix: (basename) =>
			suffix.parseSeparatedSuffix(basename),
		pathPartsToSuffixParts: (pathParts) =>
			suffix.pathPartsToSuffixParts(pathParts),
		pathPartsWithRootToSuffixParts: (pathParts) =>
			suffix.pathPartsWithRootToSuffixParts(pathParts),
		serializeSeparatedSuffix: (separatedSuffix) =>
			suffix.serializeSeparatedSuffix(separatedSuffix),
		splitPathInsideLibraryToCanonical: (sp) =>
			splitPathInsideLibraryToCanonical(
				suffix,
				rules.libraryRootName,
				sp,
			),
		suffixPartsToPathParts: (suffixParts) =>
			suffix.suffixPartsToPathParts(suffixParts),
	};
}
