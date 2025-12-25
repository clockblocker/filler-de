import { getParsedUserSettings } from "../../../global-state/global-state";
import { systemPathFromSplitPath } from "../../../obsidian-vault-action-manager/helpers/pathfinder";
import type {
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";
import { logger } from "../../../utils/logger";
import type { ParsedBasename } from "../naming/parsed-basename";
import { RuntimeSubtype } from "../types/literals";
import { parseBasenameDeprecated } from "../utils/parse-basename";
import {
	buildBasenameDepreacated,
	computePathPartsFromSuffixDepreacated,
	computeSuffixFromPathDepreacated,
	expandSuffixedPathDepreacated,
	pathPartsHaveSuffixDepreacated,
} from "../utils/path-suffix-utils";

/**
 * Rename intent: what we need to do to fix the file.
 */
export type RenameIntent = {
	from: SplitPathToFile | SplitPathToMdFile;
	to: SplitPathToFile | SplitPathToMdFile;
};

/**
 * File info extracted for intent resolution.
 */
type FileInfo = {
	pathParts: string[];
	basename: string;
	extension: string;
	parsed: ParsedBasename;
};

function extractFileInfo(path: SplitPathToFile | SplitPathToMdFile): FileInfo {
	logger.debug(
		"[extractFileInfo] input path:",
		systemPathFromSplitPath(path),
	);
	const parsed = parseBasenameDeprecated(path.basename);
	logger.debug("[extractFileInfo] parsed:", JSON.stringify(parsed));
	return {
		basename: path.basename,
		extension: path.extension,
		parsed,
		pathParts: path.pathParts,
	};
}

/**
 * Resolve rename intent for Runtime mode.
 * Reads libraryRoot and suffixDelimiter from global settings.
 *
 * Rules:
 * - BasenameOnly: User wants to move → compute target path from new suffix
 * - PathOnly: User moved file → compute new suffix from path
 * - Both: Path wins → fix suffix to match new path
 *
 * @returns RenameIntent if action needed, null if already correct
 */
export function resolveRuntimeIntent(
	_oldPath: SplitPathToFile | SplitPathToMdFile,
	newPath: SplitPathToFile | SplitPathToMdFile,
	subtype: RuntimeSubtype,
): RenameIntent | null {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;
	// oldPath kept for potential future use (e.g., conflict detection)
	const newInfo = extractFileInfo(newPath);

	// Path relative to library root (strip root from pathParts)
	const relativePathParts = getRelativePathParts(
		newInfo.pathParts,
		libraryRoot,
	);

	switch (subtype) {
		case RuntimeSubtype.BasenameOnly: {
			// User changed basename → interpret as move request only if suffix changed
			// If no suffix in new name, user just renamed the file (no move intent)
			if (newInfo.parsed.splitSuffix.length === 0) {
				// No suffix = user just renamed coreName, no move needed
				// But we should add the correct suffix to match current path
				const expectedSuffix =
					computeSuffixFromPathDepreacated(relativePathParts);
				if (expectedSuffix.length === 0) {
					// At root, no suffix needed
					return null;
				}
				// Need to add suffix to match current location
				const newBasename = buildBasenameDepreacated(
					newInfo.parsed.coreName,
					expectedSuffix,
				);
				const targetPath: SplitPathToFile | SplitPathToMdFile = {
					...newPath,
					basename: newBasename,
				};
				return { from: newPath, to: targetPath };
			}

			// Compute target path from new suffix
			const targetPathParts = computePathPartsFromSuffixDepreacated(
				newInfo.parsed.splitSuffix,
			);
			const fullTargetPathParts = [libraryRoot, ...targetPathParts];

			// If suffix already points to current location, no action needed
			if (pathPartsEqual(targetPathParts, relativePathParts)) {
				return null;
			}

			// Need to move file to suffix location
			const targetPath: SplitPathToFile | SplitPathToMdFile = {
				...newPath,
				pathParts: fullTargetPathParts,
			};

			return { from: newPath, to: targetPath };
		}

		case RuntimeSubtype.PathOnly: {
			// User moved file → fix suffix to match new path
			// Check if path contains suffixed folder (e.g., "X-Y")
			if (pathPartsHaveSuffixDepreacated(relativePathParts)) {
				// Expand suffixed path: ["X-Y"] → ["X", "Y"]
				const expandedRelative =
					expandSuffixedPathDepreacated(relativePathParts);
				const expandedFull = [libraryRoot, ...expandedRelative];
				const expectedSuffix =
					computeSuffixFromPathDepreacated(expandedRelative);

				const newBasename = buildBasenameDepreacated(
					newInfo.parsed.coreName,
					expectedSuffix,
				);

				const targetPath: SplitPathToFile | SplitPathToMdFile = {
					...newPath,
					basename: newBasename,
					pathParts: expandedFull,
				};

				return { from: newPath, to: targetPath };
			}

			// Standard case: no suffixed folders
			const expectedSuffix =
				computeSuffixFromPathDepreacated(relativePathParts);

			// If suffix already matches, no action needed
			if (suffixEquals(newInfo.parsed.splitSuffix, expectedSuffix)) {
				return null;
			}

			// Need to rename file (same folder, new suffix)
			const newBasename = buildBasenameDepreacated(
				newInfo.parsed.coreName,
				expectedSuffix,
			);

			const targetPath: SplitPathToFile | SplitPathToMdFile = {
				...newPath,
				basename: newBasename,
			};

			return { from: newPath, to: targetPath };
		}

		case RuntimeSubtype.Both: {
			// Both changed → path wins, fix suffix
			const expectedSuffix =
				computeSuffixFromPathDepreacated(relativePathParts);

			// If suffix already matches, no action needed
			if (suffixEquals(newInfo.parsed.splitSuffix, expectedSuffix)) {
				return null;
			}

			// Need to rename file (same folder, new suffix)
			const newBasename = buildBasenameDepreacated(
				newInfo.parsed.coreName,
				expectedSuffix,
			);

			const targetPath: SplitPathToFile | SplitPathToMdFile = {
				...newPath,
				basename: newBasename,
			};

			return { from: newPath, to: targetPath };
		}
	}
}

/**
 * Get path parts relative to library root.
 */
function getRelativePathParts(
	pathParts: string[],
	libraryRoot: string,
): string[] {
	if (pathParts[0] === libraryRoot) {
		return pathParts.slice(1);
	}
	return pathParts;
}

/**
 * Compare two path arrays for equality.
 */
function pathPartsEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((part, i) => part === b[i]);
}

/**
 * Compare two suffix arrays for equality.
 */
function suffixEquals(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((part, i) => part === b[i]);
}
