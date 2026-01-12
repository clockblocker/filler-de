// Re-export SeparatedSuffixedBasename for adapter layer (suffix is internal)
export type { SeparatedSuffixedBasename } from "../internal/suffix/types";
export type { CanonicalSplitPathCodecs } from "./make";
export { makeCanonicalSplitPathCodecs } from "./make";
export type {
	AnyCanonicalSplitPathInsideLibrary,
	// Legacy alias
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathInsideLibraryOf,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "./types/canonical-split-path";
