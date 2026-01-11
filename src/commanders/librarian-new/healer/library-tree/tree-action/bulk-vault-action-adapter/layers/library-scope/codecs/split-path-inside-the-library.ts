import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../../../../global-state/global-state";
import type { AnySplitPath } from "../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { DescopedSplitPath, EnscopedSplitPath } from "../types/generics";
import type { SplitPathInsideLibrary } from "../types/inside-library-split-paths";

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

export function tryParseAsInsideLibrarySplitPath<SP extends AnySplitPath>(
	splitPath: SP,
): Result<DescopedSplitPath<SP>, string> {
	const { splitPathToLibraryRoot: libraryRoot } = getParsedUserSettings();

	const libraryPrefix = [...libraryRoot.pathParts, libraryRoot.basename]; // full anchor
	const full = splitPath.pathParts;

	if (full.length < libraryPrefix.length) return err("OutsideLibrary");

	for (let i = 0; i < libraryPrefix.length; i++) {
		if (full[i] !== libraryPrefix[i]) return err("OutsideLibrary");
	}

	// keep "Library" as first segment => slice only the *pre*-Library prefix
	const keepFrom = libraryRoot.pathParts.length;

	return ok({
		...splitPath,
		pathParts: full.slice(keepFrom),
	} as DescopedSplitPath<SP>);
}

export function makeVaultScopedSplitPath<SPL extends SplitPathInsideLibrary>(
	splitPath: SPL,
): EnscopedSplitPath<SPL> {
	const { splitPathToLibraryRoot: libraryRoot } = getParsedUserSettings();

	return {
		...splitPath,
		pathParts: [...libraryRoot.pathParts, ...splitPath.pathParts],
	} as EnscopedSplitPath<SPL>;
}
