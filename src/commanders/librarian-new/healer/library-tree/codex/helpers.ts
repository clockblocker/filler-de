import { CODEX_CORE_NAME } from "./literals";

/**
 * Check if a split path represents a codex file (basename starts with __).
 * Uses simple prefix check - more robust than full suffix parsing which can
 * fail on edge cases and incorrectly identify codexes as scrolls.
 */
export function isCodexSplitPath(splitPath: { basename: string }): boolean {
	return splitPath.basename.startsWith(CODEX_CORE_NAME);
}
