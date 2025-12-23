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
			case VaultActionType.UpsertMdFile: {
				// INVARIANT: Parent folders exist (ensured by dispatcher)
				const { splitPath } = action.payload;

				// Check if file already exists
				const fileResult = await this.tfileHelper.getFile(splitPath);
				if (fileResult.isOk()) {
					// File exists - update content instead of just returning
					// This handles the case where ReplaceContentMdFile was collapsed into UpsertMdFile
					const isActive = await this.checkFileActive(splitPath);
					if (isActive) {
						const result =
							await this.opened.replaceAllContentInOpenedFile(
								action.payload.content ?? "",
							);
						return result.map(() => fileResult.value);
					}
					const result = await this.tfileHelper.replaceAllContent(
						splitPath,
						action.payload.content ?? "",
					);
					return result;
				}

				// File doesn't exist - create it
				// INVARIANT: File should exist (ensured by dispatcher), but handle gracefully
				const dto: MdFileWithContentDto = {
					content: action.payload.content ?? "",
					splitPath: action.payload.splitPath,
				};
				const result = await this.tfileHelper.upsertMdFile(dto);
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
				// INVARIANT: File exists (ensured by dispatcher)
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
				// INVARIANT: File exists (ensured by dispatcher)
				const fileResult = await this.tfileHelper.getFile(
					action.payload.splitPath,
				);
				if (fileResult.isErr()) {
					// File should exist (ensured by dispatcher), but handle gracefully
					return err(`File not found: ${fileResult.error}`);
				}

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
