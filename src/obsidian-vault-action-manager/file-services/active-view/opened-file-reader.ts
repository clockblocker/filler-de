import { err, ok, type Result } from "neverthrow";
import { type App, MarkdownView, type TFile, type TFolder } from "obsidian";
import { getSplitPathForAbstractFile } from "../../helpers/pathfinder";
import type { SplitPathToMdFile } from "../../types/split-path";
import {
	errorFileStale,
	errorGetEditor,
	errorNoActiveView,
	errorNoFileParent,
	errorNotInSourceMode,
} from "./common";

export class OpenedFileReader {
	constructor(private app: App) {}

	async pwd(): Promise<Result<SplitPathToMdFile, string>> {
		const fileResult = await this.getOpenedTFile();
		if (fileResult.isErr()) {
			return err(fileResult.error);
		}
		return ok(getSplitPathForAbstractFile(fileResult.value));
	}

	async getContent(): Promise<Result<string, string>> {
		try {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view?.file) {
				return err(errorGetEditor());
			}

			// Verify file still exists in vault (may be deleted/renamed while open)
			// Note: On rename, Obsidian may update view.file to a new TFile object,
			// so we check path existence rather than object identity
			const fileInVault = this.app.vault.getAbstractFileByPath(
				view.file.path,
			);
			if (!fileInVault) {
				return err(errorGetEditor(errorFileStale(view.file.path)));
			}

			if (view.getMode() !== "source") {
				return err(errorGetEditor(errorNotInSourceMode()));
			}

			const content = view.editor.getValue();
			return ok(content ?? "");
		} catch (error) {
			return err(
				errorGetEditor(
					error instanceof Error ? error.message : String(error),
				),
			);
		}
	}

	async getParent(): Promise<Result<TFolder, string>> {
		const fileResult = await this.getOpenedTFile();
		if (fileResult.isErr()) {
			return err(fileResult.error);
		}

		const parent = fileResult.value.parent;
		if (!parent) {
			return err(errorNoFileParent());
		}

		return ok(parent);
	}

	async getOpenedTFile(): Promise<Result<TFile, string>> {
		try {
			const activeView =
				this.app.workspace.getActiveViewOfType(MarkdownView);

			if (!activeView) {
				return err(errorNoActiveView());
			}

			const file = activeView.file;

			if (!file) {
				return err(errorNoActiveView());
			}

			// Verify file still exists in vault (may be deleted/renamed while open)
			// Note: On rename, Obsidian may update view.file to a new TFile object,
			// so we check path existence rather than object identity
			const fileInVault = this.app.vault.getAbstractFileByPath(file.path);
			if (!fileInVault) {
				return err(errorFileStale(file.path));
			}
			// If object identity differs but path matches, file was likely renamed
			// and view.file was updated - this is acceptable

			return ok(file);
		} catch (error) {
			return err(error instanceof Error ? error.message : String(error));
		}
	}
}
