import type { TFile, Vault } from "obsidian";

export function getMdFilesInLibrary(
	vault: Vault,
	libraryRoot: string,
): TFile[] {
	return vault.getFiles().filter((f) => {
		return f.path.startsWith(`${libraryRoot}/`) && f.path.endsWith(".md");
	});
}
