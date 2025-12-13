import { TFile, TFolder, type Vault } from "obsidian";
import { pathToFolderFromPathParts } from "../../../helpers/pathfinder";
import type { SplitPath } from "../../../types/split-path";
import { SplitPathType } from "../../../types/split-path";

export async function getExistingBasenamesInFolder<SPF extends SplitPath>(
	target: SPF,
	vault: Vault,
): Promise<Set<string>> {
	const folderPath = pathToFolderFromPathParts(target.pathParts);
	const targetFolder = vault.getAbstractFileByPath(folderPath);

	const existingBasenames = new Set<string>();

	if (!targetFolder || !(targetFolder instanceof TFolder)) {
		return existingBasenames;
	}

	if (target.type === SplitPathType.Folder) {
		// For folders, collect all folder basenames
		for (const child of targetFolder.children) {
			if (child instanceof TFolder) {
				existingBasenames.add(child.name);
			}
		}
	} else {
		// For files, collect basenames matching the extension
		const targetExtension =
			target.type === SplitPathType.MdFile
				? "md"
				: target.type === SplitPathType.File
					? target.extension
					: undefined;

		if (targetExtension) {
			for (const child of targetFolder.children) {
				if (
					child instanceof TFile &&
					child.extension.toLowerCase() ===
						targetExtension.toLowerCase()
				) {
					existingBasenames.add(child.basename);
				}
			}
		}
	}

	return existingBasenames;
}

export type CollisionStrategy = "rename" | "skip";

// Error message builders
export function errorGetByPath(
	entityType: "file" | "folder",
	path: string,
): string {
	return `Failed to get ${entityType} by path: ${path}`;
}

export function errorTypeMismatch(
	entityType: "file" | "folder",
	path: string,
): string {
	return `Expected ${entityType} type missmatched the found type: ${path}`;
}

export function errorCreationRaceCondition(
	entityType: "file" | "folder",
	path: string,
	retrievalError: string,
): string {
	return `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} creation race condition: ${path} was created but cannot be retrieved: ${retrievalError}`;
}

export function errorCreateFailed(
	entityType: "file" | "folder",
	path: string,
	errorMessage: string,
): string {
	return `Failed to create ${entityType}: ${path}: ${errorMessage}`;
}

export function errorBothSourceAndTargetNotFound(
	entityType: "file" | "folder",
	fromPath: string,
	toPath: string,
	error: string,
): string {
	return `Both source (${fromPath}) and target (${toPath}) ${entityType}s not found: ${error}`;
}

export function errorRetrieveRenamed(
	entityType: "file" | "folder",
	path: string,
	error: string,
): string {
	return `Failed to retrieve renamed ${entityType}: ${path}: ${error}`;
}

export function errorRenameFailed(
	entityType: "file" | "folder",
	fromPath: string,
	toPath: string,
	errorMessage: string,
): string {
	return `Failed to rename ${entityType}: ${fromPath} to ${toPath}: ${errorMessage}`;
}

export function errorTrashDuplicateFile(
	path: string,
	errorMessage: string,
): string {
	return `Failed to trash duplicate file: ${path}: ${errorMessage}`;
}
