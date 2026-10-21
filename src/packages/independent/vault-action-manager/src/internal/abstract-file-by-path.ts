import type { TAbstractFile, Vault } from "obsidian";

/**
 * Looks up a vault entry by its system path. VAM formats the vault root as
 * `""`, but Obsidian keys its root folder as `"/"`:
 * `getAbstractFileByPath("")` finds nothing, so the root comes from
 * `getRoot()`.
 */
export function getAbstractFileByPath(
	vault: Pick<Vault, "getAbstractFileByPath" | "getRoot">,
	path: string,
): TAbstractFile | null {
	return path === "" ? vault.getRoot() : vault.getAbstractFileByPath(path);
}
