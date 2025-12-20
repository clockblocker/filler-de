import type {
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import { parseBasename } from "../utils/parse-basename";
import { buildBasename, computeSuffixFromPath } from "../utils/path-suffix-utils";

export type CreateActionResult = {
	action: VaultAction | null;
	parentChain: string[];
};

/**
 * Compute create action for a file that needs suffix healing.
 * Pure function that determines if file needs renaming and builds action.
 */
export function computeCreateAction(
	splitPath: SplitPathToFile | SplitPathToMdFile,
	libraryRoot: string,
	suffixDelimiter: string,
): CreateActionResult {
	// Compute relative path (without library root)
	const relativePathParts = splitPath.pathParts.slice(1); // Remove library root

	// If at root, no suffix needed
	if (relativePathParts.length === 0) {
		return { action: null, parentChain: [] };
	}

	// Parse current basename to get coreName
	const parsed = parseBasename(splitPath.basename, suffixDelimiter);
	const expectedSuffix = computeSuffixFromPath(relativePathParts);

	// Check if suffix already correct
	const suffixMatches =
		parsed.splitSuffix.length === expectedSuffix.length &&
		parsed.splitSuffix.every((s, i) => s === expectedSuffix[i]);

	if (suffixMatches) {
		return { action: null, parentChain: relativePathParts };
	}

	// Build correct basename with suffix
	const newBasename = buildBasename(
		parsed.coreName,
		expectedSuffix,
		suffixDelimiter,
	);

	// Build action based on file type
	let action: VaultAction;
	if (splitPath.type === SplitPathType.MdFile) {
		const mdPath = splitPath;
		action = {
			payload: {
				from: mdPath,
				to: { ...mdPath, basename: newBasename },
			},
			type: VaultActionType.RenameMdFile,
		};
	} else {
		const filePath = splitPath as SplitPathToFile;
		action = {
			payload: {
				from: filePath,
				to: { ...filePath, basename: newBasename },
			},
			type: VaultActionType.RenameFile,
		};
	}

	return { action, parentChain: relativePathParts };
}

