import { err, ok } from "neverthrow";
import type { Vault } from "obsidian";
import type { TFileHelper } from "../../file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../../file-services/background/helpers/tfolder-helper";
import type { MarkdownFileAccess } from "../../file-services/markdown-file-access";
import {
	type MdFileWithContentDto,
	pathfinder,
} from "../../helpers/pathfinder";
import { getErrorMessage } from "../../internal/get-error-message";
import { logger } from "../../internal/logger";
import { type VaultAction, VaultActionKind } from "../../types/vault-action";

export class Executor {
	constructor(
		private readonly tfileHelper: TFileHelper,
		private readonly tfolderHelper: TFolderHelper,
		private readonly markdownFiles: MarkdownFileAccess,
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
				const systemPath = pathfinder.systemPathFromSplitPath(
					action.payload.splitPath,
				);
				try {
					await this.vault.create(
						systemPath,
						action.payload.content ?? "",
					);
					return ok(undefined);
				} catch (error) {
					return err(getErrorMessage(error));
				}
			}
			case VaultActionKind.UpsertMdFile: {
				// INVARIANT: Parent folders exist (ensured by dispatcher)
				const { splitPath, content } = action.payload;
				const _path = pathfinder.systemPathFromSplitPath(splitPath);

				// Check if file already exists
				const fileResult = await this.tfileHelper.getFile(splitPath);
				if (fileResult.isOk()) {
					// File exists
					if (content === null || content === undefined) {
						// EnsureExist: don't overwrite existing content
						return ok(fileResult.value);
					}
					return this.markdownFiles.replaceContent(
						splitPath,
						content,
					);
				}

				// File doesn't exist - create it
				const createContent =
					content === null || content === undefined ? "" : content;
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
				const fromPath = pathfinder.systemPathFromSplitPath(
					action.payload.from,
				);
				const toPath = pathfinder.systemPathFromSplitPath(
					action.payload.to,
				);

				const result = await this.markdownFiles.renameFile({
					from: action.payload.from,
					to: action.payload.to,
				});

				if (result.isErr()) {
					logger.error("[Executor] RenameFile FAILED", {
						error: result.error,
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
				const result = await this.tfileHelper.trashFile(
					action.payload.splitPath,
				);
				if (result.isErr()) {
					logger.error("[Executor] TrashMdFile failed", {
						error: result.error,
						path: pathStr,
					});
				}
				return result;
			}
			case VaultActionKind.ProcessMdFile: {
				// INVARIANT: File exists (ensured by dispatcher)
				const payload = action.payload;
				const { splitPath } = payload;

				// Normalize payload to transform function
				const transform =
					"transform" in payload
						? payload.transform
						: (content: string) =>
								content.replace(payload.before, payload.after);

				return this.markdownFiles.processContent({
					splitPath,
					transform,
				});
			}
		}
	}
}
