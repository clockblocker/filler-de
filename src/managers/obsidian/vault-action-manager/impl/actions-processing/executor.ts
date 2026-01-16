import { err, ok } from "neverthrow";
import type { Vault } from "obsidian";
import { logger } from "../../../../../utils/logger";
import type { OpenedFileService } from "../../file-services/active-view/opened-file-service";
import type { TFileHelper } from "../../file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../../file-services/background/helpers/tfolder-helper";
import {
	type MdFileWithContentDto,
	systemPathFromSplitPathInternal,
} from "../../helpers/pathfinder";
import type { SplitPathToMdFile } from "../../types/split-path";
import { type VaultAction, VaultActionKind } from "../../types/vault-action";
import { makeSystemPathForSplitPath } from "../common/split-path-and-system-path";

export class Executor {
	constructor(
		private readonly tfileHelper: TFileHelper,
		private readonly tfolderHelper: TFolderHelper,
		private readonly opened: OpenedFileService,
		private readonly vault: Vault,
	) {}

	async execute(action: VaultAction) {
		switch (action.kind) {
			case VaultActionKind.CreateFolder: {
				const result = await this.tfolderHelper.createFolder(
					action.payload.splitPath,
				);
				return result;
			}
			case VaultActionKind.RenameFolder: {
				const result = await this.tfolderHelper.renameFolder({
					from: action.payload.from,
					to: action.payload.to,
				});
				return result;
			}
			case VaultActionKind.TrashFolder: {
				const result = await this.tfolderHelper.trashFolder(
					action.payload.splitPath,
				);
				return result;
			}
			case VaultActionKind.CreateFile: {
				const systemPath = systemPathFromSplitPathInternal(
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
			case VaultActionKind.UpsertMdFile: {
				// INVARIANT: Parent folders exist (ensured by dispatcher)
				const { splitPath, content } = action.payload;
				const path = makeSystemPathForSplitPath(splitPath);

				// Check if file already exists
				const fileResult = await this.tfileHelper.getFile(splitPath);
				if (fileResult.isOk()) {
					// File exists
					if (content === null || content === undefined) {
						// EnsureExist: don't overwrite existing content
						logger.debug(
							"[Executor.UpsertMdFile] File exists, skipping (EnsureExist)",
							{ path },
						);
						return ok(fileResult.value);
					}
					// File exists - update content
					logger.debug(
						"[Executor.UpsertMdFile] File exists, updating",
						{ path },
					);
					const isActive = await this.checkFileActive(splitPath);
					if (isActive) {
						const result =
							await this.opened.replaceAllContentInOpenedFile(
								content,
							);
						return result.map(() => fileResult.value);
					}
					const result = await this.tfileHelper.replaceAllContent(
						splitPath,
						content,
					);
					return result;
				}

				// File doesn't exist - create it
				const createContent =
					content === null || content === undefined ? "" : content;
				logger.debug(
					"[Executor.UpsertMdFile] File doesn't exist, creating",
					{
						contentLength: createContent.length,
						path,
					},
				);
				// INVARIANT: File should exist (ensured by dispatcher), but handle gracefully
				const dto: MdFileWithContentDto = {
					content: createContent,
					splitPath: action.payload.splitPath,
				};
				const result = await this.tfileHelper.upsertMdFile(dto);
				return result;
			}
			case VaultActionKind.RenameFile:
			case VaultActionKind.RenameMdFile: {
				const fromPath = systemPathFromSplitPathInternal(action.payload.from);
				const toPath = systemPathFromSplitPathInternal(action.payload.to);
				logger.info("[Executor] RenameFile ENTRY", {
					from: fromPath,
					kind: action.kind,
					to: toPath,
				});
				const result = await this.tfileHelper.renameFile({
					from: action.payload.from,
					to: action.payload.to,
				});
				if (result.isErr()) {
					logger.error("[Executor] RenameFile FAILED", {
						error: result.error,
						from: fromPath,
						to: toPath,
					});
				} else {
					logger.info("[Executor] RenameFile SUCCESS", {
						from: fromPath,
						to: toPath,
					});
				}
				return result;
			}
			case VaultActionKind.TrashFile:
			case VaultActionKind.TrashMdFile: {
				const pathStr = [
					...action.payload.splitPath.pathParts,
					action.payload.splitPath.basename,
				].join("/");
				logger.info("[Executor] Executing TrashMdFile", {
					path: pathStr,
				});
				const result = await this.tfileHelper.trashFile(
					action.payload.splitPath,
				);
				if (result.isErr()) {
					logger.error("[Executor] TrashMdFile failed", {
						error: result.error,
						path: pathStr,
					});
				} else {
					logger.info("[Executor] TrashMdFile succeeded", {
						path: pathStr,
					});
				}
				return result;
			}
			case VaultActionKind.ProcessMdFile: {
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
		}
	}

	private async checkFileActive(
		splitPath: SplitPathToMdFile,
	): Promise<boolean> {
		const result = await this.opened.isFileActive(splitPath);
		return result.isOk() && result.value;
	}
}
