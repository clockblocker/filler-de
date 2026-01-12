export type { CanonicalSplitPathCodecs } from "./make";
export { makeCanonicalSplitPathCodecs } from "./make";
export type {
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "./types";
// Re-export SeparatedSuffixedBasename for adapter layer (suffix is internal)
export type { SeparatedSuffixedBasename } from "../internal/suffix/types";