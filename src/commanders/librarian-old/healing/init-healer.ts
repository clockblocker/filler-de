import { getParsedUserSettings } from "../../../global-state/global-state";
import type {
	SplitPathToFile,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "../../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../obsidian-vault-action-manager/types/vault-action";
import type { TreeLeafDeprecated } from "../types/tree-node";
import { TreeNodeTypeDeprecated } from "../types/tree-node";
import { parseBasenameDeprecated } from "../utils/parse-basename";
import {
	buildBasenameDepreacated,
	computeSuffixFromPathDepreacated,
	suffixMatchesPathDepreacated,
} from "../utils/path-suffix-utils";
import { joinPathParts } from "../utils/tree-path-utils";

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
	leaf: TreeLeafDeprecated;
	currentBasename: string;
	expectedBasename: string;
	needsRename: boolean;
};

/**
 * Match actual file to leaf by comparing nodeName and path.
 */
function findMatchingFile(
	leaf: TreeLeafDeprecated,
	actualFiles: SplitPathWithReader[],
): SplitPathWithReader | null {
	// Expected path (parent chain only, not including nodeName)
	const expectedParentPath = joinPathParts(leaf.nodeNameChainToParent);

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

		// Parse basename to get nodeName
		const { nodeName } = parseBasenameDeprecated(file.basename);
		if (nodeName !== leaf.nodeName) {
			continue;
		}

		// Build path key from file pathParts (skip library root)
		// pathParts is [libraryRoot, ...parentChain], so slice(1) gives parentChain
		const fileParentPath = joinPathParts(file.pathParts.slice(1));

		// Match if parent path matches (file might be at expected location or wrong location)
		// We match by nodeName and parent path, then check if suffix needs fixing
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
	leaf: TreeLeafDeprecated,
	actualFile: SplitPathWithReader | null,
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
	const parsed = parseBasenameDeprecated(currentBasename);

	// Path relative to library root
	const needsRename = !suffixMatchesPathDepreacated(
		parsed.splitSuffix,
		leaf.nodeNameChainToParent,
	);

	const expectedBasename = needsRename
		? buildBasenameDepreacated(
				parsed.nodeName,
				computeSuffixFromPathDepreacated(leaf.nodeNameChainToParent),
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
 * Reads libraryRoot from global settings.
 */
function leafToSplitPath(
	leaf: TreeLeafDeprecated,
	basename: string,
): SplitPathToFile | SplitPathToMdFile {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;
	const pathParts = [libraryRoot, ...leaf.nodeNameChainToParent];

	if (leaf.type === TreeNodeTypeDeprecated.Scroll) {
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
 * Reads libraryRoot from global settings.
 */
function createRenameAction(info: LeafHealInfo): VaultAction {
	const from = leafToSplitPath(info.leaf, info.currentBasename);
	const to = leafToSplitPath(info.leaf, info.expectedBasename);

	if (info.leaf.type === TreeNodeTypeDeprecated.Scroll) {
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
 * Reads libraryRoot and suffixDelimiter from global settings.
 *
 * @param leaves - Tree leaves to heal
 * @param actualFiles - Actual files from manager (with readers)
 * @returns Rename and delete actions
 */
export async function healOnInit(
	leaves: TreeLeafDeprecated[],
	actualFiles: SplitPathWithReader[],
): Promise<InitHealResult> {
	const renameActions: VaultAction[] = [];

	for (const leaf of leaves) {
		const actualFile = findMatchingFile(leaf, actualFiles);
		const info = analyzeLeaf(leaf, actualFile);

		if (info.needsRename) {
			renameActions.push(createRenameAction(info));
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
 * Reads suffixDelimiter from global settings.
 */
export function leafNeedsHealing(
	leaf: TreeLeafDeprecated,
	actualFiles: SplitPathWithReader[],
): boolean {
	const actualFile = findMatchingFile(leaf, actualFiles);
	const info = analyzeLeaf(leaf, actualFile);
	return info.needsRename;
}

/**
 * Get the expected basename for a leaf.
 * Reads suffixDelimiter from global settings.
 * Note: tRef removed - computes expected basename from tree structure only.
 */
export function getExpectedBasename(leaf: TreeLeafDeprecated): string {
	const nodeNameChain = leaf.nodeNameChainToParent;
	return buildBasenameDepreacated(
		leaf.nodeName,
		computeSuffixFromPathDepreacated(nodeNameChain),
	);
}
