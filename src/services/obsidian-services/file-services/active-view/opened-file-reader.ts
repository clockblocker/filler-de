import { type App, MarkdownView, type TFile, type TFolder } from "obsidian";
import { getMaybeEditor } from "../../../../obsidian-vault-action-manager/helpers/get-editor";
import {
	logError,
	logWarning,
} from "../../../../obsidian-vault-action-manager/helpers/issue-handlers";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../types/common-interface/maybe";
import { getFullPathForAbstractFile } from "../../atomic-services/pathfinder";

export class LegacyOpenedFileReader {
	constructor(private app: App) {}

	async pwd() {
		const activeView = unwrapMaybeByThrowing(
			await this.getMaybeOpenedTFile(),
		);
		return getFullPathForAbstractFile(activeView);
	}

	async getContent(): Promise<string> {
		return unwrapMaybeByThrowing(await this.getMaybeContent());
	}

	async getParent(): Promise<TFolder> {
		return unwrapMaybeByThrowing(await this.getMaybeParent());
	}

	async getOpenedTFile(): Promise<TFile> {
		return unwrapMaybeByThrowing(await this.getMaybeOpenedTFile());
	}

	async getMaybeContent(): Promise<Maybe<string>> {
		const mbEditor = await getMaybeEditor(this.app);
		if (mbEditor.error) {
			return mbEditor;
		}

		const content = mbEditor.data.getValue();
		return { data: content ?? "", error: false };
	}

	async getMaybeParent(): Promise<Maybe<TFolder>> {
		const file = await this.getOpenedTFile();

		const parent = file.parent;

		if (!parent) {
			return {
				description: "Opened file does not have a parent",
				error: true,
			};
		}

		return { data: parent, error: false };
	}

	// [TODO] Make it private
	async getMaybeOpenedTFile(): Promise<Maybe<TFile>> {
		try {
			const activeView =
				this.app.workspace.getActiveViewOfType(MarkdownView);

			if (!activeView) {
				logWarning({
					description: "File not open or not active",
					location: "OpenedFileService",
				});
				return { error: true };
			}

			const file = activeView.file;

			if (!file) {
				logWarning({
					description: "File not open or not active",
					location: "OpenedFileService",
				});
				return { error: true };
			}

			return { data: file, error: false };
		} catch (error) {
			logError({
				description: `Failed to get maybe opened file: ${error}`,
				location: "OpenedFileService",
			});
			return { error: true };
		}
	}
}
