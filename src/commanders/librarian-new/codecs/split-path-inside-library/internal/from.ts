import type { AnySplitPath } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CodecRules } from "../../rules";
import type { SplitPathInsideLibrary } from "../../tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";

/**
 * Converts library-scoped split path to vault-scoped split path.
 * Adds LibraryRoot path parts back.
 */
export function fromInsideLibrary(
	rules: CodecRules,
	sp: SplitPathInsideLibrary,
): AnySplitPath {
	const libraryRootName = rules.libraryRootName;

	// If pathParts is empty, it's the library root itself
	if (sp.pathParts.length === 0) {
		return sp;
	}

	// Add library root as first element if not already present
	if (sp.pathParts[0] !== libraryRootName) {
		return {
			...sp,
			pathParts: [libraryRootName, ...sp.pathParts],
		} as AnySplitPath;
	}

	// Already has library root, return as-is
	return sp as AnySplitPath;
}
