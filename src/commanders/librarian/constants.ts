export const LIBRARY_ROOTSLegacy = ["Library"] as const;
export type RootNameLegacy = (typeof LIBRARY_ROOTSLegacy)[number];

export const UNTRACKED_FOLDER_NAME = "Untracked";

export function isRootNameLegacy(name: string): name is RootNameLegacy {
	return LIBRARY_ROOTSLegacy.some((root) => root === name);
}

export function isInUntrackedLegacy(pathParts: readonly string[]): boolean {
	return pathParts.length > 1 && pathParts[1] === UNTRACKED_FOLDER_NAME;
}
