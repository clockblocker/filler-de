import { err, ok, type Result } from "neverthrow";
import {
	type App,
	type Editor,
	MarkdownView,
	type TFile,
	type TFolder,
} from "obsidian";
import {
	errorFileStale,
	errorGetEditor,
	errorNoActiveView,
	errorNoFileParent,
	errorNotInSourceMode,
} from "../../../errors";
import { getSplitPathForAbstractFile } from "../../../helpers/pathfinder";
import type {
	AnySplitPath,
	SplitPathToMdFile,
} from "../../../types/split-path";

export type EditorWithView = { editor: Editor; view: MarkdownView };

export class OpenedFileReader {
	constructor(private app: App) {}

	pwd(): Result<SplitPathToMdFile, string> {
		return this.getOpenedTFile().map((file) =>
			getSplitPathForAbstractFile(file),
		);
	}

	getContent(): Result<string, string> {
		return this.getActiveView()
			.andThen((view) => this.validateFileExists(view))
			.andThen((view) => this.validateSourceMode(view))
			.map((view) => view.editor.getValue() ?? "");
	}

	getParent(): Result<TFolder, string> {
		return this.getOpenedTFile().andThen((file) =>
			file.parent ? ok(file.parent) : err(errorNoFileParent()),
		);
	}

	getOpenedTFile(): Result<TFile, string> {
		return this.getActiveView()
			.andThen((view) =>
				view.file ? ok(view.file) : err(errorNoActiveView()),
			)
			.andThen((file) => this.validateFileInVault(file));
	}

	getEditor(): Result<EditorWithView, string> {
		return this.getActiveView()
			.andThen((view) => this.validateFileExists(view))
			.andThen((view) => this.validateSourceMode(view))
			.map((view) => ({ editor: view.editor, view }));
	}

	getEditorAnyMode(): Result<EditorWithView, string> {
		return this.getActiveView().andThen((view) =>
			view.file
				? ok({ editor: view.editor, view })
				: err(errorGetEditor()),
		);
	}

	isFileActive(splitPath: SplitPathToMdFile): Result<boolean, string> {
		return this.pwd().map(
			(pwd) =>
				pwd.pathParts.length === splitPath.pathParts.length &&
				pwd.pathParts.every(
					(part, index) => part === splitPath.pathParts[index],
				) &&
				pwd.basename === splitPath.basename,
		);
	}

	isInActiveView(splitPath: AnySplitPath): boolean {
		if (splitPath.kind !== "MdFile") return false;
		const result = this.isFileActive(splitPath);
		return result.isOk() && result.value;
	}

	private getActiveView(): Result<MarkdownView, string> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view ? ok(view) : err(errorNoActiveView());
	}

	private validateFileExists(
		view: MarkdownView,
	): Result<MarkdownView, string> {
		if (!view.file) {
			return err(errorGetEditor());
		}
		const fileInVault = this.app.vault.getAbstractFileByPath(
			view.file.path,
		);
		return fileInVault
			? ok(view)
			: err(errorGetEditor(errorFileStale(view.file.path)));
	}

	private validateSourceMode(
		view: MarkdownView,
	): Result<MarkdownView, string> {
		return view.getMode() === "source"
			? ok(view)
			: err(errorGetEditor(errorNotInSourceMode()));
	}

	private validateFileInVault(file: TFile): Result<TFile, string> {
		const fileInVault = this.app.vault.getAbstractFileByPath(file.path);
		return fileInVault ? ok(file) : err(errorFileStale(file.path));
	}
}
