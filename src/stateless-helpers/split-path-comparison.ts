import type {
	AnySplitPath,
	SplitPathToMdFile,
} from "../managers/obsidian/vault-action-manager/types/split-path";

/**
 * Compare two split paths for structural equality.
 * Checks kind, basename, extension (when present), and pathParts element-by-element.
 * Pure function, no dependencies.
 */
export function splitPathsEqual(a: AnySplitPath, b: AnySplitPath): boolean {
	if (a.kind !== b.kind) return false;
	if (a.basename !== b.basename) return false;
	if (a.pathParts.length !== b.pathParts.length) return false;
	for (let i = 0; i < a.pathParts.length; i++) {
		if (a.pathParts[i] !== b.pathParts[i]) return false;
	}
	if ("extension" in a && "extension" in b && a.extension !== b.extension) {
		return false;
	}
	return true;
}

/**
 * Convert a SplitPathToMdFile to a human-readable path string.
 * Example: { pathParts: ["Wörter", "A"], basename: "Abend", extension: "md" }
 *   → "Wörter/A/Abend.md"
 */
export function stringifySplitPath(splitPath: SplitPathToMdFile): string {
	return [
		...splitPath.pathParts,
		`${splitPath.basename}.${splitPath.extension}`,
	].join("/");
}
