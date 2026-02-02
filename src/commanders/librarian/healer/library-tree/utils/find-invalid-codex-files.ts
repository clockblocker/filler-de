import { pathfinder } from "../../../../../managers/obsidian/vault-action-manager/helpers/pathfinder";
import type { SplitPathWithReader } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CodecRules, Codecs } from "../../../codecs";
import { isCodexSplitPath } from "../codex/helpers";
import { tryParseAsInsideLibrarySplitPath } from "../tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { TreeReader } from "../tree-interfaces";
import type { HealingAction } from "../types/healing-action";
import { collectValidCodexPaths } from "./collect-codex-paths";

/**
 * Find invalid codex files (__ prefix but not valid codexes) and return delete actions.
 */
export function findInvalidCodexFiles(
	allFiles: SplitPathWithReader[],
	healer: TreeReader,
	codecs: Codecs,
	rules: CodecRules,
): HealingAction[] {
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
		const libraryScopedResult = tryParseAsInsideLibrarySplitPath(
			file,
			rules,
		);
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
