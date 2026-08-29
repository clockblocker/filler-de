import type { AnySplitPath } from "@textfresser/vault-action-manager";
import { pathfinder, SplitPathKind } from "@textfresser/vault-action-manager";
import type { Codecs } from "../../../codecs";
import { makeLibraryScope } from "../../../tree/library-scope";
import { isCodexSplitPath } from "../codex/helpers";
import type { TreeReader } from "../tree-interfaces";
import type { HealingAction } from "../types/healing-action";
import { collectValidCodexPaths } from "./collect-codex-paths";

/**
 * Find invalid codex files (__ prefix but not valid codexes) and return delete actions.
 */
export function findInvalidCodexFiles(
	allFiles: readonly AnySplitPath[],
	healer: TreeReader,
	codecs: Codecs,
): HealingAction[] {
	const libraryScope = makeLibraryScope(codecs.rules);
	// Collect all valid codex paths from tree
	const validCodexPaths = new Set<string>();
	collectValidCodexPaths(healer.getRoot(), [], validCodexPaths, codecs);

	const deleteActions: HealingAction[] = [];

	for (const file of allFiles) {
		// Skip non-md files
		if (file.kind !== SplitPathKind.MdFile) continue;

		// Check if basename starts with __
		if (!isCodexSplitPath(file)) continue;

		// This is a __ file - check if it's valid
		const libraryScopedResult = libraryScope.toLibraryPath(file);
		if (libraryScopedResult.isErr()) continue;

		const filePath = pathfinder.systemPathFromSplitPath(
			libraryScopedResult.value,
		);

		if (!validCodexPaths.has(filePath)) {
			deleteActions.push({
				kind: "DeleteMdFile",
				payload: { splitPath: libraryScopedResult.value },
			});
		}
	}

	return deleteActions;
}
