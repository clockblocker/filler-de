import type {
	SplitPathToFile,
	SplitPathToMdFile,
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
 * Analyze a leaf to determine if it needs healing.
 */
function analyzeLeaf(
	leaf: TreeLeaf,
	_libraryRoot: string,
	suffixDelimiter: string,
): LeafHealInfo {
	// libraryRoot kept for potential future use
	const currentBasename = leaf.tRef.basename;
	const parsed = parseBasename(currentBasename, suffixDelimiter);

	// Path relative to library root
	const coreNameChain = leaf.coreNameChainToParent;

	const needsRename = !suffixMatchesPath(parsed.splitSuffix, coreNameChain);

	const expectedBasename = needsRename
		? buildBasename(
				parsed.coreName,
				computeSuffixFromPath(coreNameChain),
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
	const extension = leaf.tRef.extension;

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
		extension,
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
 * @param libraryRoot - Library root folder name
 * @param suffixDelimiter - Delimiter for suffix parsing
 * @returns Rename and delete actions
 */
export function healOnInit(
	leaves: TreeLeaf[],
	libraryRoot: string,
	suffixDelimiter = "-",
): InitHealResult {
	const renameActions: VaultAction[] = [];

	for (const leaf of leaves) {
		const info = analyzeLeaf(leaf, libraryRoot, suffixDelimiter);

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
	libraryRoot: string,
	suffixDelimiter = "-",
): boolean {
	const info = analyzeLeaf(leaf, libraryRoot, suffixDelimiter);
	return info.needsRename;
}

/**
 * Get the expected basename for a leaf.
 */
export function getExpectedBasename(
	leaf: TreeLeaf,
	suffixDelimiter = "-",
): string {
	const currentBasename = leaf.tRef.basename;
	const parsed = parseBasename(currentBasename, suffixDelimiter);
	const coreNameChain = leaf.coreNameChainToParent;

	return buildBasename(
		parsed.coreName,
		computeSuffixFromPath(coreNameChain),
		suffixDelimiter,
	);
}
