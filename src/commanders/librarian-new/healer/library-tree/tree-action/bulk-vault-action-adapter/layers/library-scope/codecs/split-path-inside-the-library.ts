import { err, ok, type Result } from "neverthrow";
import type { AnySplitPath } from "../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CodecRules } from "../../../../../../../codecs/rules";
import type {
	EnscopedSplitPath,
	ExtractKind,
} from "../types/generics";
import type {
	AnySplitPathInsideLibrary,
	SplitPathInsideLibraryOf,
} from "../../../../../../codecs";

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
	rules: CodecRules,
): Result<SplitPathInsideLibraryOf<ExtractKind<SP>>, string> {
	const libraryPrefix = [
		...rules.libraryRootPathParts,
		rules.libraryRootName,
	]; // full anchor
	const full = splitPath.pathParts;

	if (full.length < libraryPrefix.length) return err("OutsideLibrary");

	for (let i = 0; i < libraryPrefix.length; i++) {
		if (full[i] !== libraryPrefix[i]) return err("OutsideLibrary");
	}

	// keep "Library" as first segment => slice only the *pre*-Library prefix
	const keepFrom = rules.libraryRootPathParts.length;

	return ok({
		...splitPath,
		pathParts: full.slice(keepFrom),
	} as SplitPathInsideLibraryOf<ExtractKind<SP>>);
}

export function makeVaultScopedSplitPath<SPL extends AnySplitPathInsideLibrary>(
	splitPath: SPL,
	rules: CodecRules,
): EnscopedSplitPath<SPL> {
	return {
		...splitPath,
		pathParts: [...rules.libraryRootPathParts, ...splitPath.pathParts],
	} as EnscopedSplitPath<SPL>;
}
