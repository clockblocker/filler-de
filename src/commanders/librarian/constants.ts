export const LIBRARY_ROOTS = ["Library"] as const;
export type RootName = (typeof LIBRARY_ROOTS)[number];

export const UNTRACKED_FOLDER_NAME = "Untracked";

export function isRootName(name: string): name is RootName {
	return LIBRARY_ROOTS.some((root) => root === name);
}

export function isInUntracked(pathParts: readonly string[]): boolean {
	return pathParts.length > 1 && pathParts[1] === UNTRACKED_FOLDER_NAME;
}
