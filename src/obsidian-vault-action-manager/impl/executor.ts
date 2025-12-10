import type { VaultAction } from "../types/vault-action";
import { VaultActionType } from "../types/vault-action";
import type { BackgroundFileService } from "./background-file-service";
import type { OpenedFileService } from "./opened-file-service";

export class Executor {
	constructor(
		private readonly background: BackgroundFileService,
		private readonly opened: OpenedFileService,
	) {}

	async execute(actions: readonly VaultAction[]): Promise<void> {
		for (const action of actions) {
			switch (action.type) {
				case VaultActionType.CreateFolder:
					await this.background.createFolder(
						action.payload.coreSplitPath,
					);
					break;
				case VaultActionType.RenameFolder:
					await this.background.renameFolder(
						action.payload.from,
						action.payload.to,
					);
					break;
				case VaultActionType.TrashFolder:
					await this.background.trashFolder(
						action.payload.coreSplitPath,
					);
					break;
				case VaultActionType.CreateFile:
				case VaultActionType.CreateMdFile:
					await this.background.createFile(
						action.payload.coreSplitPath,
						action.payload.content ?? "",
					);
					break;
				case VaultActionType.RenameFile:
				case VaultActionType.RenameMdFile:
					await this.background.renameFile(
						action.payload.from,
						action.payload.to,
					);
					break;
				case VaultActionType.TrashFile:
				case VaultActionType.TrashMdFile:
					await this.background.trashFile(
						action.payload.coreSplitPath,
					);
					break;
				case VaultActionType.ProcessMdFile:
					if (
						await this.opened.isInActiveView(
							action.payload.coreSplitPath,
						)
					) {
						const current = await this.opened.readContent(
							action.payload.coreSplitPath,
						);
						const next = await action.payload.transform(current);
						await this.opened.writeContent(
							action.payload.coreSplitPath,
							next,
						);
					} else {
						await this.background.processMdFile(
							action.payload.coreSplitPath,
							action.payload.transform,
						);
					}
					break;
				case VaultActionType.WriteMdFile:
					if (
						await this.opened.isInActiveView(
							action.payload.coreSplitPath,
						)
					) {
						await this.opened.writeContent(
							action.payload.coreSplitPath,
							action.payload.content,
						);
					} else {
						await this.background.writeFile(
							action.payload.coreSplitPath,
							action.payload.content,
						);
					}
					break;
				case VaultActionType.RenameFile:
				case VaultActionType.RenameMdFile:
					if (await this.opened.isInActiveView(action.payload.from)) {
						await this.opened.renameFile(
							action.payload.from,
							action.payload.to,
						);
					} else {
						await this.background.renameFile(
							action.payload.from,
							action.payload.to,
						);
					}
					break;
				case VaultActionType.TrashFile:
				case VaultActionType.TrashMdFile:
					if (
						await this.opened.isInActiveView(
							action.payload.coreSplitPath,
						)
					) {
						await this.opened.trashFile(
							action.payload.coreSplitPath,
						);
					} else {
						await this.background.trashFile(
							action.payload.coreSplitPath,
						);
					}
					break;
			}
		}
	}
}
