import type {
	SplitPathToFile,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "../../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../obsidian-vault-action-manager/types/vault-action";
import type { TreeLeaf } from "../types/tree-leaf";
import { TreeNodeType } from "../types/tree-node";
import { parseBasename } from "../utils/parse-basename";
import {
	buildBasename,
	computeSuffixFromPath,
	suffixMatchesPath,
} from "../utils/path-suffix-utils";

/**
 * Result of init healing.
 */
export type InitHealResult = {
	renameActions: VaultAction[];
	deleteActions: VaultAction[];
};

/**
 * Info about a leaf for healing.
 */
type LeafHealInfo = {
	leaf: TreeLeaf;
	currentBasename: string;
	expectedBasename: string;
	needsRename: boolean;
};

/**
 * Match actual file to leaf by comparing coreName and path.
 */
function findMatchingFile(
	leaf: TreeLeaf,
	actualFiles: SplitPathWithReader[],
	suffixDelimiter: string,
): SplitPathWithReader | null {
	// Expected path (parent chain only, not including coreName)
	const expectedParentPath = leaf.coreNameChainToParent.join("/");

	for (const file of actualFiles) {
		// Skip folders
		if (file.type !== "File" && file.type !== "MdFile") {
			continue;
		}

		// Check extension matches
		if (
			(file.type === "MdFile" && leaf.extension !== "md") ||
			(file.type === "File" &&
				"extension" in file &&
				file.extension !== leaf.extension)
		) {
			continue;
		}

		// Parse basename to get coreName
		const { coreName } = parseBasename(file.basename, suffixDelimiter);
		if (coreName !== leaf.coreName) {
			continue;
		}

		// Build path key from file pathParts (skip library root)
		// pathParts is [libraryRoot, ...parentChain], so slice(1) gives parentChain
		const fileParentPath = file.pathParts.slice(1).join("/");

		// Match if parent path matches (file might be at expected location or wrong location)
		// We match by coreName and parent path, then check if suffix needs fixing
		if (fileParentPath === expectedParentPath) {
			return file;
		}
	}

	return null;
}

/**
 * Analyze a leaf against actual file to determine if it needs healing.
 */
function analyzeLeaf(
	leaf: TreeLeaf,
	actualFile: SplitPathWithReader | null,
	suffixDelimiter: string,
): LeafHealInfo {
	if (!actualFile) {
		// File not found - skip healing
		return {
			currentBasename: "",
			expectedBasename: "",
			leaf,
			needsRename: false,
		};
	}

	const currentBasename = actualFile.basename;
	const parsed = parseBasename(currentBasename, suffixDelimiter);

	// Path relative to library root
	const needsRename = !suffixMatchesPath(
		parsed.splitSuffix,
		leaf.coreNameChainToParent,
	);

	const expectedBasename = needsRename
		? buildBasename(
				parsed.coreName,
				computeSuffixFromPath(leaf.coreNameChainToParent),
				suffixDelimiter,
			)
		: currentBasename;

	return {
		currentBasename,
		expectedBasename,
		leaf,
		needsRename,
	};
}

/**
 * Build SplitPath for a leaf.
 */
function leafToSplitPath(
	leaf: TreeLeaf,
	basename: string,
	libraryRoot: string,
): SplitPathToFile | SplitPathToMdFile {
	const pathParts = [libraryRoot, ...leaf.coreNameChainToParent];

	if (leaf.type === TreeNodeType.Scroll) {
		return {
			basename,
			extension: "md",
			pathParts,
			type: "MdFile",
		};
	}

	return {
		basename,
		extension: leaf.extension,
		pathParts,
		type: "File",
	};
}

/**
 * Generate rename action for a leaf.
 */
function createRenameAction(
	info: LeafHealInfo,
	libraryRoot: string,
): VaultAction {
	const from = leafToSplitPath(info.leaf, info.currentBasename, libraryRoot);
	const to = leafToSplitPath(info.leaf, info.expectedBasename, libraryRoot);

	if (info.leaf.type === TreeNodeType.Scroll) {
		return {
			payload: {
				from: from as SplitPathToMdFile,
				to: to as SplitPathToMdFile,
			},
			type: VaultActionType.RenameMdFile,
		};
	}

	return {
		payload: {
			from: from as SplitPathToFile,
			to: to as SplitPathToFile,
		},
		type: VaultActionType.RenameFile,
	};
}

/**
 * Heal leaves on init: fix suffixes to match paths.
 * Mode 2: Path is king, suffix-only renames, never move.
 *
 * @param leaves - Tree leaves to heal
 * @param actualFiles - Actual files from manager (with readers)
 * @param libraryRoot - Library root folder name
 * @param suffixDelimiter - Delimiter for suffix parsing
 * @returns Rename and delete actions
 */
export async function healOnInit(
	leaves: TreeLeaf[],
	actualFiles: SplitPathWithReader[],
	libraryRoot: string,
	suffixDelimiter = "-",
): Promise<InitHealResult> {
	const renameActions: VaultAction[] = [];

	for (const leaf of leaves) {
		const actualFile = findMatchingFile(leaf, actualFiles, suffixDelimiter);
		const info = analyzeLeaf(leaf, actualFile, suffixDelimiter);

		if (info.needsRename) {
			renameActions.push(createRenameAction(info, libraryRoot));
		}
	}

	// Empty folder detection is separate - needs folder info not available here
	// Will be handled by caller after tree is built
	const deleteActions: VaultAction[] = [];

	return { deleteActions, renameActions };
}

/**
 * Check if a single leaf needs healing.
 * Useful for individual file checks.
 */
export function leafNeedsHealing(
	leaf: TreeLeaf,
	actualFiles: SplitPathWithReader[],
	suffixDelimiter: string,
): boolean {
	const actualFile = findMatchingFile(leaf, actualFiles, suffixDelimiter);
	const info = analyzeLeaf(leaf, actualFile, suffixDelimiter);
	return info.needsRename;
}

/**
 * Get the expected basename for a leaf.
 * Note: tRef removed - computes expected basename from tree structure only.
 */
export function getExpectedBasename(
	leaf: TreeLeaf,
	suffixDelimiter = "-",
): string {
	const coreNameChain = leaf.coreNameChainToParent;
	return buildBasename(
		leaf.coreName,
		computeSuffixFromPath(coreNameChain),
		suffixDelimiter,
	);
}
