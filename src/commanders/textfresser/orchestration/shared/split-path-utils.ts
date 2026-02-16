import type { SplitPathToMdFile } from "../../../../managers/obsidian/vault-action-manager/types/split-path";

export function areSameSplitPath(
	a: SplitPathToMdFile,
	b: SplitPathToMdFile,
): boolean {
	return (
		a.basename === b.basename &&
		a.extension === b.extension &&
		a.pathParts.length === b.pathParts.length &&
		a.pathParts.every((part, index) => part === b.pathParts[index])
	);
}

export function stringifySplitPath(splitPath: SplitPathToMdFile): string {
	return [
		...splitPath.pathParts,
		`${splitPath.basename}.${splitPath.extension}`,
	].join("/");
}
