import type {
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";
import { RuntimeSubtype } from "../types/literals";
import type { SplitBasename } from "../types/split-basename";
import { parseBasename } from "../utils/parse-basename";
import {
	buildBasename,
	computePathFromSuffix,
	computeSuffixFromPath,
	expandSuffixedPath,
	pathPartsHaveSuffix,
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
	parsed: SplitBasename;
};

function extractFileInfo(
	path: SplitPathToFile | SplitPathToMdFile,
	suffixDelimiter: string,
): FileInfo {
	return {
		basename: path.basename,
		extension: path.extension,
		parsed: parseBasename(path.basename, suffixDelimiter),
		pathParts: path.pathParts,
	};
}

/**
 * Resolve rename intent for Runtime mode.
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
	libraryRoot: string,
	suffixDelimiter = "-",
): RenameIntent | null {
	// oldPath kept for potential future use (e.g., conflict detection)
	const newInfo = extractFileInfo(newPath, suffixDelimiter);

	// Path relative to library root (strip root from pathParts)
	const relativePathParts = getRelativePathParts(
		newInfo.pathParts,
		libraryRoot,
	);

	switch (subtype) {
		case RuntimeSubtype.BasenameOnly: {
			// User changed basename → interpret as move request
			// Compute target path from new suffix
			const targetPathParts = computePathFromSuffix(
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
			if (pathPartsHaveSuffix(relativePathParts, suffixDelimiter)) {
				// Expand suffixed path: ["X-Y"] → ["X", "Y"]
				const expandedRelative = expandSuffixedPath(
					relativePathParts,
					suffixDelimiter,
				);
				const expandedFull = [libraryRoot, ...expandedRelative];
				const expectedSuffix = computeSuffixFromPath(expandedRelative);

				const newBasename = buildBasename(
					newInfo.parsed.coreName,
					expectedSuffix,
					suffixDelimiter,
				);

				const targetPath: SplitPathToFile | SplitPathToMdFile = {
					...newPath,
					basename: newBasename,
					pathParts: expandedFull,
				};

				return { from: newPath, to: targetPath };
			}

			// Standard case: no suffixed folders
			const expectedSuffix = computeSuffixFromPath(relativePathParts);

			// If suffix already matches, no action needed
			if (suffixEquals(newInfo.parsed.splitSuffix, expectedSuffix)) {
				return null;
			}

			// Need to rename file (same folder, new suffix)
			const newBasename = buildBasename(
				newInfo.parsed.coreName,
				expectedSuffix,
				suffixDelimiter,
			);

			const targetPath: SplitPathToFile | SplitPathToMdFile = {
				...newPath,
				basename: newBasename,
			};

			return { from: newPath, to: targetPath };
		}

		case RuntimeSubtype.Both: {
			// Both changed → path wins, fix suffix
			const expectedSuffix = computeSuffixFromPath(relativePathParts);

			// If suffix already matches, no action needed
			if (suffixEquals(newInfo.parsed.splitSuffix, expectedSuffix)) {
				return null;
			}

			// Need to rename file (same folder, new suffix)
			const newBasename = buildBasename(
				newInfo.parsed.coreName,
				expectedSuffix,
				suffixDelimiter,
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
