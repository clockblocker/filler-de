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
export function tryParseAsInsideLibrarySplitPath(
	splitPath: SplitPathToFolder,
): Result<SplitPathToFolderInsideLibrary, string>;
export function tryParseAsInsideLibrarySplitPath(
	splitPath: SplitPathToFile,
): Result<SplitPathToFileInsideLibrary, string>;
export function tryParseAsInsideLibrarySplitPath(
	splitPath: SplitPathToMdFile,
): Result<SplitPathToMdFileInsideLibrary, string>;
export function tryParseAsInsideLibrarySplitPath(
	splitPath: SplitPath,
): Result<SplitPathInsideLibrary, string>;
export function tryParseAsInsideLibrarySplitPath(
	splitPath: SplitPath,
): Result<SplitPathInsideLibrary, string> {
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
}

type VaultScoped<T extends SplitPathInsideLibrary> =
	T extends SplitPathToFolderInsideLibrary
		? SplitPathToFolder
		: T extends SplitPathToMdFileInsideLibrary
			? SplitPathToMdFile
			: T extends SplitPathToFileInsideLibrary
				? SplitPathToFile
				: SplitPath;

export function makeVaultScopedSplitPath<T extends SplitPathInsideLibrary>(
	splitPath: T,
): VaultScoped<T> {
	const { splitPathToLibraryRoot: libraryRoot } = getParsedUserSettings();

	return {
		...splitPath,
		pathParts: [...libraryRoot.pathParts, ...splitPath.pathParts],
	} as VaultScoped<T>;
}
// -- private --

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
