import type { AnySplitPath } from "../../../../managers/obsidian/vault-action-manager/types/split-path.ts";

export type { SplitPathInsideLibraryCodecs } from "./make.ts";
export { makeSplitPathInsideLibraryCodecs } from "./make.ts";
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
