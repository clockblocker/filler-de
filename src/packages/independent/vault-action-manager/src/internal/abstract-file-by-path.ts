import type { TAbstractFile, Vault } from "obsidian";
import { VaultPath } from "../vault-path";

declare const SystemPathBrand: unique symbol;

/**
 * A path in the exact form Obsidian keys its file map: the output of
 * Obsidian's `normalizePath`, with the vault root as `"/"`. Only the lookup
 * below takes one, so a raw or `""`-rooted path cannot reach Obsidian.
 */
export type SystemPath = string & { readonly [SystemPathBrand]: true };

/** The key Obsidian looks `path` up by; the vault root `""` is `"/"`. */
export function toSystemPath(path: string): SystemPath {
	const normalized = VaultPath.normalize(path);
	return (normalized === VaultPath.root ? "/" : normalized) as SystemPath;
}

/**
 * Looks up a vault entry by its system path. Obsidian keys its root folder
 * as `"/"`, so the root comes from `getRoot()`. The lookup is exact, so it
 * stays case-sensitive on every file system.
 */
export function getAbstractFileByPath(
	vault: Pick<Vault, "getAbstractFileByPath" | "getRoot">,
	path: SystemPath,
): TAbstractFile | null {
	return path === "/" ? vault.getRoot() : vault.getAbstractFileByPath(path);
}
