import type {
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import { parseBasenameDeprecated } from "../utils/parse-basename";
import {
	buildBasenameDepreacated,
	computeSuffixFromPathDepreacated,
} from "../utils/path-suffix-utils";

export type CreateActionResult = {
	action: VaultAction | null;
	parentChain: string[];
};

/**
 * Compute create action for a file that needs suffix healing.
 * Pure function that determines if file needs renaming and builds action.
 * Reads suffixDelimiter from global settings.
 */
export function computeCreateAction(
	splitPath: SplitPathToFile | SplitPathToMdFile,
): CreateActionResult {
	const relativePathParts = splitPath.pathParts.slice(1); // Remove library root

	if (relativePathParts.length === 0) {
		return { action: null, parentChain: [] };
	}

	const parsed = parseBasenameDeprecated(splitPath.basename);
	const expectedSuffix = computeSuffixFromPathDepreacated(relativePathParts);

	const suffixMatches =
		parsed.splitSuffix.length === expectedSuffix.length &&
		parsed.splitSuffix.every((s, i) => s === expectedSuffix[i]);

	if (suffixMatches) {
		return { action: null, parentChain: relativePathParts };
	}

	const newBasename = buildBasenameDepreacated(
		parsed.nodeName,
		expectedSuffix,
	);

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
