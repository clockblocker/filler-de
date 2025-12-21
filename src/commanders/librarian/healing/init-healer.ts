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
 * Note: currentBasename is resolved on-demand - tRef removed due to staleness.
 */
async function analyzeLeaf(
	leaf: TreeLeaf,
	libraryRoot: string,
	suffixDelimiter: string,
	getCurrentBasename: (path: string) => Promise<string | null>,
): Promise<LeafHealInfo> {
	// Reconstruct expected path from tree structure
	const coreNameChain = [...leaf.coreNameChainToParent, leaf.coreName];
	const expectedPath = `${libraryRoot}/${coreNameChain.join("/")}.${leaf.extension}`;

	// Get current basename from vault (tRef removed - resolve on-demand)
	const currentBasename = await getCurrentBasename(expectedPath);
	if (!currentBasename) {
		// File doesn't exist at expected path - skip healing
		return {
			currentBasename: "",
			expectedBasename: "",
			leaf,
			needsRename: false,
		};
	}

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
 * @param libraryRoot - Library root folder name
 * @param suffixDelimiter - Delimiter for suffix parsing
 * @param getCurrentBasename - Function to get current basename from path (tRef removed - resolve on-demand)
 * @returns Rename and delete actions
 */
export async function healOnInit(
	leaves: TreeLeaf[],
	libraryRoot: string,
	suffixDelimiter = "-",
	getCurrentBasename: (path: string) => Promise<string | null> = async () =>
		null,
): Promise<InitHealResult> {
	const renameActions: VaultAction[] = [];

	for (const leaf of leaves) {
		const info = await analyzeLeaf(
			leaf,
			libraryRoot,
			suffixDelimiter,
			getCurrentBasename,
		);

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
 * Note: requires getCurrentBasename function to resolve current basename (tRef removed).
 */
export async function leafNeedsHealing(
	leaf: TreeLeaf,
	libraryRoot: string,
	suffixDelimiter: string,
	getCurrentBasename: (path: string) => Promise<string | null>,
): Promise<boolean> {
	const info = await analyzeLeaf(
		leaf,
		libraryRoot,
		suffixDelimiter,
		getCurrentBasename,
	);
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
