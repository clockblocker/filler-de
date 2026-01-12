import type { AnySplitPath } from "../../../../managers/obsidian/vault-action-manager/types/split-path";

export type { SplitPathInsideLibraryCodecs } from "./make";
export { makeSplitPathInsideLibraryCodecs } from "./make";
export type {
	AnySplitPathInsideLibrary,
	SplitPathInsideLibraryOf,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "./types/split-path-inside-library.ts";

/**
 * Candidate type for type guard narrowing.
 */
export type SplitPathInsideLibraryCandidate = AnySplitPath & {
	/* type marker */
};
