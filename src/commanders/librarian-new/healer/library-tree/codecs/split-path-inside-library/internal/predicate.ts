import type { AnySplitPath } from "../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CodecRules } from "../../rules";

/**
 * Quick predicate to check if split path is inside library.
 * Returns boolean for early returns.
 */
export function checkIfInsideLibrary(
	rules: CodecRules,
	sp: AnySplitPath,
): boolean {
	const { pathParts } = sp;
	const libraryRootName = rules.libraryRootName;

	// Empty pathParts is allowed only for Library root folder
	if (pathParts.length === 0) {
		return true;
	}

	// Non-empty pathParts must start with Library root
	return pathParts[0] === libraryRootName;
}
