export const LIBRARY_ROOT = "Library" as const;
export type RootName = typeof LIBRARY_ROOT;
export const LIBRARY_ROOTS = [LIBRARY_ROOT] as const;

export const UNTRACKED_FOLDER_NAME = "Untracked";

export function isRootName(name: string): name is RootName {
	return name === LIBRARY_ROOT;
}

export function isInUntracked(pathParts: readonly string[]): boolean {
	return pathParts.length > 1 && pathParts[1] === UNTRACKED_FOLDER_NAME;
}
