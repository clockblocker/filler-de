import type { ObsidianVaultActionManager } from "../../obsidian-vault-action-manager";
import { prettyPathToFolder, prettyPathToMdFile } from "./path-conversions";

type Reader = {
	basename: string;
	pathParts: string[];
	readContent: () => Promise<string>;
};

/**
 * Minimal adapter over ObsidianVaultActionManager to satisfy read-only
 * background file service needs (exists/readContent/deep list md files).
 */
export function makeManagerFsAdapter(manager: ObsidianVaultActionManager): {
	exists(prettyPath: {
		basename: string;
		pathParts: string[];
	}): Promise<boolean>;
	readContent(prettyPath: {
		basename: string;
		pathParts: string[];
	}): Promise<string>;
	getReadersToAllMdFilesInFolder(folder: {
		basename: string;
		pathParts: string[];
		type: "folder";
	}): Promise<Reader[]>;
} {
	const exists = async (prettyPath: {
		basename: string;
		pathParts: string[];
	}) => manager.exists(prettyPathToMdFile(prettyPath));

	const readContent = async (prettyPath: {
		basename: string;
		pathParts: string[];
	}) => manager.readContent(prettyPathToMdFile(prettyPath));

	const getReadersToAllMdFilesInFolder = async (folder: {
		basename: string;
		pathParts: string[];
		type: "folder";
	}): Promise<Reader[]> => {
		const readers: Reader[] = [];

		const walk = async (folderPath: {
			basename: string;
			pathParts: string[];
		}): Promise<void> => {
			const splitFolder = prettyPathToFolder(folderPath);
			const entries = await manager.list(splitFolder);
			for (const entry of entries) {
				if (entry.type === "Folder") {
					await walk({
						basename: entry.basename,
						pathParts: entry.pathParts,
					});
				} else if (entry.type === "MdFile") {
					readers.push({
						basename: entry.basename,
						pathParts: entry.pathParts,
						readContent: async () =>
							manager.readContent({
								basename: entry.basename,
								extension: "md",
								pathParts: entry.pathParts,
								type: "MdFile",
							}),
					});
				}
			}
		};

		await walk(folder);
		return readers;
	};

	return { exists, getReadersToAllMdFilesInFolder, readContent };
}
