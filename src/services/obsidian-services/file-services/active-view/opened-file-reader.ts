import { type App, MarkdownView, type TFile, type TFolder } from "obsidian";
import { getMaybeLegacyEditor } from "../../../../obsidian-vault-action-manager/helpers/get-editor";
import {
	logError,
	logWarning,
} from "../../../../obsidian-vault-action-manager/helpers/issue-handlers";
import {
	type MaybeLegacy,
	unwrapMaybeLegacyByThrowing,
} from "../../../../types/common-interface/maybe";
import { legacyGetFullPathForAbstractFile } from "../../atomic-services/pathfinder";

export class LegacyOpenedFileReader {
	constructor(private app: App) {}

	async pwd() {
		const activeView = unwrapMaybeLegacyByThrowing(
			await this.getMaybeLegacyOpenedTFile(),
		);
		return legacyGetFullPathForAbstractFile(activeView);
	}

	async getContent(): Promise<string> {
		return unwrapMaybeLegacyByThrowing(await this.getMaybeLegacyContent());
	}

	async getParent(): Promise<TFolder> {
		return unwrapMaybeLegacyByThrowing(await this.getMaybeLegacyParent());
	}

	async getOpenedTFile(): Promise<TFile> {
		return unwrapMaybeLegacyByThrowing(
			await this.getMaybeLegacyOpenedTFile(),
		);
	}

	async getMaybeLegacyContent(): Promise<MaybeLegacy<string>> {
		const mbEditor = await getMaybeLegacyEditor(this.app);
		if (mbEditor.error) {
			return mbEditor;
		}

		const content = mbEditor.data.getValue();
		return { data: content ?? "", error: false };
	}

	async getMaybeLegacyParent(): Promise<MaybeLegacy<TFolder>> {
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
	async getMaybeLegacyOpenedTFile(): Promise<MaybeLegacy<TFile>> {
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
