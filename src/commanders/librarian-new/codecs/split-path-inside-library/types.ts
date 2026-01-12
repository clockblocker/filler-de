import type { AnySplitPath } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	SplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";

/**
 * Public types for split-path-inside-library codecs.
 */
export type { SplitPathInsideLibrary };
export type {
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
};

/**
 * Candidate type for type guard narrowing.
 */
export type SplitPathInsideLibraryCandidate = AnySplitPath & {
	/* type marker */
};
