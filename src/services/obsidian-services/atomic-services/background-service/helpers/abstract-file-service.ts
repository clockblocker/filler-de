import { TFile, TFolder, type Vault } from "obsidian";
import {
	type Maybe,
	unwrapMaybe,
} from "../../../../../types/common-interface/maybe";
import { SLASH } from "../../../../../types/literals";
import { systemPathFromSplitPath } from "../../../../dto-services/pathfinder/path-helpers";
import type { AbstractFile, SplitPath } from "../types";

export class AbstractFileService {
	constructor(private vault: Vault) {}

	async getAbstractFile<T extends SplitPath>(
		prettyPath: T,
	): Promise<AbstractFile<T>> {
		const mbFile = await this.getMaybeAbstractFileByPrettyPath(prettyPath);
		return unwrapMaybe(mbFile);
	}

	getPrettyPath<T extends SplitPath>(abstractFile: AbstractFile<T>): T {
		const path = abstractFile.path;
		const splitPath = path.split(SLASH).filter(Boolean);
		const title = splitPath.pop() ?? "";

		if (abstractFile instanceof TFolder) {
			return {
				basename: title,
				pathParts: splitPath,
				type: "folder",
			} as T;
		}

		return {
			basename: abstractFile.basename,
			extension: abstractFile.extension,
			pathParts: splitPath,
			type: "file",
		} as T;
	}

	private async getMaybeAbstractFileByPrettyPath<T extends SplitPath>(
		prettyPath: T,
	): Promise<Maybe<AbstractFile<T>>> {
		const systemPath = systemPathFromSplitPath(prettyPath);
		const mbTabstractFile = this.vault.getAbstractFileByPath(systemPath);
		if (!mbTabstractFile) {
			return {
				description: `Failed to get file by path: ${systemPath}`,
				error: true,
			};
		}

		switch (prettyPath.type) {
			case "file":
				if (mbTabstractFile instanceof TFile) {
					return {
						data: mbTabstractFile as AbstractFile<T>,
						error: false,
					};
				}
				break;
			case "folder":
				if (mbTabstractFile instanceof TFolder) {
					return {
						data: mbTabstractFile as AbstractFile<T>,
						error: false,
					};
				}
				break;

			default:
				break;
		}
		return {
			description: "Expected file type missmatched the found type",
			error: true,
		};
	}
}
