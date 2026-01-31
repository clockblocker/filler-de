import type { SplitPathToMdFile } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CodecRules } from "../../../codecs";
import { tryParseAsInsideLibrarySplitPath } from "../tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import { PREFIX_OF_CODEX } from "./literals";

/**
 * Check if a split path represents a codex file (basename starts with __).
 * Uses simple prefix check - more robust than full suffix parsing which can
 * fail on edge cases and incorrectly identify codexes as scrolls.
 */
export function isCodexSplitPath(splitPath: { basename: string }): boolean {
	return splitPath.basename.startsWith(PREFIX_OF_CODEX);
}

/**
 * Check if a split path represents a codex file inside the library.
 */
export function isCodexInsideLibrary(
	splitPath: SplitPathToMdFile,
	rules: CodecRules,
): boolean {
	if (!isCodexSplitPath(splitPath)) return false;
	const libraryScopedResult = tryParseAsInsideLibrarySplitPath(
		splitPath,
		rules,
	);
	return libraryScopedResult.isOk();
}
