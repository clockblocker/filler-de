import type { Result } from "neverthrow";
import type { SplitPathKind } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { NodeName } from "../../types/schemas/node-name";
import type { CodecError } from "../errors";
import type { SuffixCodecs } from "../internal/suffix";
import type { SeparatedSuffixedBasename } from "../internal/suffix/types";
import type { CodecRules } from "../rules";
import type { SplitPathInsideLibraryOf } from "../split-path-inside-library";
import { fromCanonicalSplitPathInsideLibrary } from "./internal/from";
import { splitPathInsideLibraryToCanonical } from "./internal/to";
import { fromSplitPathInsideLibraryWithSeparatedSuffix } from "./internal/split-path-with-separated-suffix/from";
import { splitPathInsideLibraryToWithSeparatedSuffix } from "./internal/split-path-with-separated-suffix/to";
import type {
	CanonicalSplitPathInsideLibraryOf,
	SplitPathInsideLibraryWithSeparatedSuffixOf,
} from "./types/canonical-split-path";

export type CanonicalSplitPathCodecs = {
	splitPathInsideLibraryToCanonical: <SK extends SplitPathKind>(
		sp: SplitPathInsideLibraryOf<SK>,
	) => Result<CanonicalSplitPathInsideLibraryOf<SK>, CodecError>;
	fromCanonicalSplitPathInsideLibrary: <SK extends SplitPathKind>(
		sp: CanonicalSplitPathInsideLibraryOf<SK>,
	) => SplitPathInsideLibraryOf<SK>;
	splitPathInsideLibraryToWithSeparatedSuffix: <SK extends SplitPathKind>(
		sp: SplitPathInsideLibraryOf<SK>,
	) => Result<SplitPathInsideLibraryWithSeparatedSuffixOf<SK>, CodecError>;
	fromSplitPathInsideLibraryWithSeparatedSuffix: <SK extends SplitPathKind>(
		sp: SplitPathInsideLibraryWithSeparatedSuffixOf<SK>,
	) => SplitPathInsideLibraryOf<SK>;
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
		splitPathInsideLibraryToWithSeparatedSuffix: (sp) =>
			splitPathInsideLibraryToWithSeparatedSuffix(suffix, sp),
		fromSplitPathInsideLibraryWithSeparatedSuffix: (sp) =>
			fromSplitPathInsideLibraryWithSeparatedSuffix(suffix, sp),
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
