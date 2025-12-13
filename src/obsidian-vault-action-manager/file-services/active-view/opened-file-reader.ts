import { err, ok, type Result } from "neverthrow";
import { type App, MarkdownView, type TFile, type TFolder } from "obsidian";
import { getSplitPathForAbstractFile } from "../../helpers/pathfinder";
import type { SplitPathToMdFile } from "../../types/split-path";
import { errorGetEditor, errorNoActiveView, errorNoFileParent } from "./common";

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

			return ok(file);
		} catch (error) {
			return err(error instanceof Error ? error.message : String(error));
		}
	}
}
