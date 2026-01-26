/**
 * Path utilities for toolbar lifecycle.
 */

import type { SplitPathToMdFile } from "../../obsidian/vault-action-manager/types/split-path";

/**
 * Build a SplitPath from a file path string.
 */
export function buildSplitPath(path: string): SplitPathToMdFile | null {
	// Split path into segments
	const parts = path.split("/");
	const basename = parts.pop();

	if (!basename || !basename.endsWith(".md")) {
		return null;
	}

	// Remove .md extension for basename
	const basenameWithoutExt = basename.slice(0, -3);

	return {
		basename: basenameWithoutExt,
		extension: "md",
		segments: parts,
	};
}
