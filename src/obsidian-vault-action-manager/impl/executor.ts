import { err, ok } from "neverthrow";
import type { Vault } from "obsidian";
import type { OpenedFileService } from "../file-services/active-view/opened-file-service";
import type { TFileHelper } from "../file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../file-services/background/helpers/tfolder-helper";
import type { MdFileWithContentDto } from "../helpers/pathfinder";
import { systemPathToSplitPath } from "../helpers/pathfinder";
import type { SplitPathToMdFile } from "../types/split-path";
import type { VaultAction } from "../types/vault-action";
import { VaultActionType } from "../types/vault-action";

export class Executor {
	constructor(
		private readonly tfileHelper: TFileHelper,
		private readonly tfolderHelper: TFolderHelper,
		private readonly opened: OpenedFileService,
		private readonly vault: Vault,
	) {}

	async execute(action: VaultAction) {
		switch (action.type) {
			case VaultActionType.CreateFolder: {
				const result = await this.tfolderHelper.createFolder(
					action.payload.splitPath,
				);
				return result;
			}
			case VaultActionType.RenameFolder: {
				const result = await this.tfolderHelper.renameFolder({
					from: action.payload.from,
					to: action.payload.to,
				});
				return result;
			}
			case VaultActionType.TrashFolder: {
				const result = await this.tfolderHelper.trashFolder(
					action.payload.splitPath,
				);
				return result;
			}
			case VaultActionType.CreateFile: {
				const systemPath = systemPathToSplitPath.encode(
					action.payload.splitPath,
				);
				try {
					await this.vault.create(
						systemPath,
						action.payload.content ?? "",
					);
					return ok(undefined);
				} catch (error) {
					return err(
						error instanceof Error ? error.message : String(error),
					);
				}
			}
			case VaultActionType.CreateMdFile: {
				const dto: MdFileWithContentDto = {
					content: action.payload.content,
					splitPath: action.payload.splitPath,
				};
				const result = await this.tfileHelper.createMdFile(dto);
				return result;
			}
			case VaultActionType.RenameFile:
			case VaultActionType.RenameMdFile: {
				const result = await this.tfileHelper.renameFile({
					from: action.payload.from,
					to: action.payload.to,
				});
				return result;
			}
			case VaultActionType.TrashFile:
			case VaultActionType.TrashMdFile: {
				const result = await this.tfileHelper.trashFile(
					action.payload.splitPath,
				);
				return result;
			}
			case VaultActionType.ProcessMdFile: {
				const isActive = await this.checkFileActive(
					action.payload.splitPath,
				);
				if (isActive) {
					const result = await this.opened.processContent({
						splitPath: action.payload.splitPath,
						transform: action.payload.transform,
					});
					return result;
				}
				const result = await this.tfileHelper.processContent({
					splitPath: action.payload.splitPath,
					transform: action.payload.transform,
				});
				return result;
			}
			case VaultActionType.ReplaceContentMdFile: {
				const isActive = await this.checkFileActive(
					action.payload.splitPath,
				);
				if (isActive) {
					const result =
						await this.opened.replaceAllContentInOpenedFile(
							action.payload.content,
						);
					return result;
				}
				const result = await this.tfileHelper.replaceAllContent(
					action.payload.splitPath,
					action.payload.content,
				);
				return result;
			}
		}
	}

	private async checkFileActive(
		splitPath: SplitPathToMdFile,
	): Promise<boolean> {
		const result = await this.opened.isFileActive(splitPath);
		return result.isOk() && result.value;
	}
}
