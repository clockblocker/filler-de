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
import type { TreeLeaf } from "../types/tree-node";
import { TreeNodeType } from "../types/tree-node";
import { parseBasenameDeprecated } from "../utils/parse-basename";
import {
	buildBasenameDepreacated,
	computeSuffixFromPathDepreacated,
	suffixMatchesPathDepreacated,
} from "../utils/path-suffix-utils";
import { joinPathPartsDeprecated } from "../utils/tree-path-utils";

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
): SplitPathWithReader | null {
	// Expected path (parent chain only, not including coreName)
	const expectedParentPath = joinPathPartsDeprecated(
		leaf.coreNameChainToParent,
	);

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
		const { coreName } = parseBasenameDeprecated(file.basename);
		if (coreName !== leaf.coreName) {
			continue;
		}

		// Build path key from file pathParts (skip library root)
		// pathParts is [libraryRoot, ...parentChain], so slice(1) gives parentChain
		const fileParentPath = joinPathPartsDeprecated(file.pathParts.slice(1));

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
		leaf.coreNameChainToParent,
	);

	const expectedBasename = needsRename
		? buildBasenameDepreacated(
				parsed.coreName,
				computeSuffixFromPathDepreacated(leaf.coreNameChainToParent),
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
	leaf: TreeLeaf,
	basename: string,
): SplitPathToFile | SplitPathToMdFile {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;
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
 * Reads libraryRoot from global settings.
 */
function createRenameAction(info: LeafHealInfo): VaultAction {
	const from = leafToSplitPath(info.leaf, info.currentBasename);
	const to = leafToSplitPath(info.leaf, info.expectedBasename);

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
 * Reads libraryRoot and suffixDelimiter from global settings.
 *
 * @param leaves - Tree leaves to heal
 * @param actualFiles - Actual files from manager (with readers)
 * @returns Rename and delete actions
 */
export async function healOnInit(
	leaves: TreeLeaf[],
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
	leaf: TreeLeaf,
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
export function getExpectedBasename(leaf: TreeLeaf): string {
	const coreNameChain = leaf.coreNameChainToParent;
	return buildBasenameDepreacated(
		leaf.coreName,
		computeSuffixFromPathDepreacated(coreNameChain),
	);
}
