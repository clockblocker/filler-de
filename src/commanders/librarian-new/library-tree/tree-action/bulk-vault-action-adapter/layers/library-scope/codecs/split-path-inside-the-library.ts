import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../../../global-state/global-state";
import {
	type SplitPath,
	type SplitPathToFile,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	SplitPathType,
} from "../../../../../../../../obsidian-vault-action-manager/types/split-path";
import type {
	SplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../types/inside-library-split-paths";

/**
 * Converts a vault SplitPath into a **SplitPathInsideLibrary**.
 *
 * Behavior:
 * - Verifies that the path is inside the configured Library root.
 * - Strips any leading folders *before* the Library root.
 * - Preserves the Library root itself as `pathParts[0]`.
 *
 * Returns `Err("OutsideLibrary")` if the path is not under Library.
 *
 * @example
 * // Simple inside case
 * // Vault: VaultRoot/Library/Notes/Todo.md
 * // => pathParts: ["Library", "Notes"]
 *
 * @example
 * // Nested Library root
 * // Vault: VaultRoot/Stuff/Data/Library/Recipes/Pie.md
 * // => pathParts: ["Library", "Recipes"]
 *
 * @example
 * // Outside Library
 * // Vault: VaultRoot/Inbox/Todo.md
 * // => Err("OutsideLibrary")
 */
export const tryParseAsInsideLibrarySplitPath = (
	splitPath: SplitPath,
): Result<SplitPathInsideLibrary, string> => {
	const pathPartsResult = tryParseAsInsideLibraryPathParts(
		splitPath.pathParts,
	);
	if (pathPartsResult.isErr()) return err(pathPartsResult.error);

	const insidePathParts = pathPartsResult.value;

	switch (splitPath.type) {
		case SplitPathType.Folder:
			return ok({
				...splitPath,
				pathParts: insidePathParts,
			});
		case SplitPathType.File:
			return ok({
				...splitPath,
				pathParts: insidePathParts,
			});
		case SplitPathType.MdFile:
			return ok({
				...splitPath,
				pathParts: insidePathParts,
			});
	}
};

export function makeVaultScopedSplitPatToFile(
	splitPath: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary,
): SplitPathToFile | SplitPathToMdFile {
	if (splitPath.type === SplitPathType.MdFile) {
		return makeVaultScopedSplitPath(splitPath);
	}
	return makeVaultScopedSplitPath(splitPath);
}

export function makeVaultScopedSplitPathToFolder(
	splitPath: SplitPathToFolderInsideLibrary,
): SplitPathToFolder {
	return makeVaultScopedSplitPath(splitPath);
}

// -- private --

function makeVaultScopedSplitPath(
	splitPath: SplitPathToFolderInsideLibrary,
): SplitPathToFolder;
function makeVaultScopedSplitPath(
	splitPath: SplitPathToFileInsideLibrary,
): SplitPathToFile;
function makeVaultScopedSplitPath(
	splitPath: SplitPathToMdFileInsideLibrary,
): SplitPathToMdFile;
function makeVaultScopedSplitPath(
	splitPath: SplitPathInsideLibrary,
): SplitPath {
	return {
		...splitPath,
		pathParts: makeVaultScopedPathParts(splitPath),
	};
}

function makeVaultScopedPathParts(
	splitPath: SplitPathInsideLibrary,
): SplitPath["pathParts"] {
	const { splitPathToLibraryRoot: libraryRoot } = getParsedUserSettings();

	return [...libraryRoot.pathParts, ...splitPath.pathParts];
}

const tryParseAsInsideLibraryPathParts = (
	pathParts: SplitPath["pathParts"],
): Result<SplitPathInsideLibrary["pathParts"], string> => {
	const { splitPathToLibraryRoot: libraryRoot } = getParsedUserSettings();

	const libraryPrefix = [...libraryRoot.pathParts, libraryRoot.basename]; // full anchor
	const full = pathParts;

	if (full.length < libraryPrefix.length) return err("OutsideLibrary");

	for (let i = 0; i < libraryPrefix.length; i++) {
		if (full[i] !== libraryPrefix[i]) return err("OutsideLibrary");
	}

	// keep "Library" as first segment => slice only the *pre*-Library prefix
	const keepFrom = libraryRoot.pathParts.length;

	return ok(full.slice(keepFrom));
};
