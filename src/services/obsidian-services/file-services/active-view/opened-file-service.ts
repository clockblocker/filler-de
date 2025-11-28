import { type App, MarkdownView, type TFile, type TFolder } from "obsidian";
import type { PathParts } from "../../../../types/common-interface/dtos";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../types/common-interface/maybe";
import { getMaybeEditor } from "../../helpers/get-editor";
import { logError, logWarning } from "../../helpers/issue-handlers";
import { splitPathFromAbstractFile } from "../pathfinder";
import type { SplitPathToFile } from "../types";

export class OpenedFileService {
	private lastOpenedFiles: SplitPathToFile[] = [];

	constructor(
		private app: App,
		initiallyOpenedFile: TFile | null,
	) {
		initiallyOpenedFile &&
			this.lastOpenedFiles.push(
				splitPathFromAbstractFile(initiallyOpenedFile),
			);
	}

	async cd(file: TFile) {
		const leaf = this.app.workspace.getLeaf(false);
		return await leaf.openFile(file);
	}

	async prettyPwd() {
		const activeView = unwrapMaybeByThrowing(
			await this.getMaybeOpenedFile(),
		);
		return splitPathFromAbstractFile(activeView);
	}

	getApp(): App {
		return this.app;
	}

	async getMaybeOpenedFile(): Promise<Maybe<TFile>> {
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

	async getMaybeFileContent(): Promise<Maybe<string>> {
		try {
			const activeView =
				this.app.workspace.getActiveViewOfType(MarkdownView);
			const mbEditor = await getMaybeEditor(this.app);

			if (!activeView || mbEditor.error) {
				logWarning({
					description: "File not open or not active",
					location: "OpenedFileService",
				});
				return { error: true };
			}

			const file = activeView.file;
			const editor = mbEditor.data;

			if (!file) {
				logWarning({
					description: "File not open or not active",
					location: "OpenedFileService",
				});
				return { error: true };
			}

			const content = editor.getValue();
			return { data: content, error: false };
		} catch (error) {
			logError({
				description: `Failed to get maybe file content: ${error}`,
				location: "OpenedFileService",
			});
			return { error: true };
		}
	}

	async getFileContent(): Promise<string> {
		return unwrapMaybeByThrowing(await this.getMaybeFileContent());
	}

	async replaceContentInCurrentlyOpenedFile(
		newContent: string,
	): Promise<Maybe<string>> {
		const maybeFile = await this.getMaybeOpenedFile();
		if (maybeFile.error) {
			return maybeFile;
		}

		return { data: newContent, error: false };
	}

	async writeToOpenedFile(text: string): Promise<Maybe<string>> {
		this.showLoadingOverlay();
		const maybeEditor = await getMaybeEditor(this.app);
		if (maybeEditor.error) {
			return maybeEditor;
		}

		const editor = maybeEditor.data;
		editor.replaceRange(text, { ch: 0, line: editor.lineCount() });

		return { data: text, error: false };
	}

	async replaceAllContentInOpenedFile(content: string): Promise<Maybe<void>> {
		const maybeEditor = await getMaybeEditor(this.app);
		if (maybeEditor.error) {
			return maybeEditor;
		}

		const editor = maybeEditor.data;
		editor.setValue(content);

		return { data: undefined, error: false };
	}

	isFileActive(filePath: string): boolean {
		const activeFile = this.app.workspace.getActiveFile();
		return activeFile?.path === filePath;
	}

	async getPathOfOpenedFile(): Promise<Maybe<string>> {
		const maybeFile = await this.getMaybeOpenedFile();
		if (maybeFile.error) {
			return maybeFile;
		}

		return { data: maybeFile.data.path, error: false };
	}

	async getParentOfOpenedFile(): Promise<Maybe<TFolder>> {
		const maybeFile = await this.getMaybeOpenedFile();
		if (maybeFile.error) return maybeFile;

		const parent = maybeFile.data.parent;

		if (!parent) {
			return {
				description: "Opened file does not have a parent",
				error: true,
			};
		}

		return { data: parent, error: false };
	}

	public showLoadingOverlay(): void {
		if (document.getElementById("opened-file-service-loading-overlay")) {
			return;
		}
		const overlay = document.createElement("div");
		overlay.id = "opened-file-service-loading-overlay";

		document.body.appendChild(overlay);

		const loadingText = document.createElement("div");
		loadingText.innerText = "Loading...";
		loadingText.style.fontSize = "2rem";
		loadingText.style.color = "#fff";
		overlay.appendChild(loadingText);

		// overlay.style.position = 'fixed';
		// overlay.style.top = '0';
		// overlay.style.left = '0';
		// overlay.style.width = '100%';
		// overlay.style.height = '100%';
		// overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent black
		// overlay.style.display = 'flex';
		// overlay.style.justifyContent = 'center';
		// overlay.style.alignItems = 'center';
		// overlay.style.zIndex = '1000'; // Ensure it's on top
	}

	// Exposed method to hide and remove the loading overlay
	public hideLoadingOverlay(): void {
		const overlay = document.getElementById(
			"opened-file-service-loading-overlay",
		);
		if (overlay) {
			overlay.remove();
		}
	}

	public async openFile(file: TFile): Promise<Maybe<TFile>> {
		try {
			await this.app.workspace.getLeaf(true).openFile(file);
			return { data: file, error: false };
		} catch (error) {
			const description = `Failed to open file: ${error}`;
			logError({
				description,
				location: "OpenedFileService",
			});
			return { description, error: true };
		}
	}

	private getMaybeFileNameAndPathParts(): Maybe<{
		fileName: string;
		pathParts: PathParts;
	}> {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			return { error: true };
		}
		return {
			data: { fileName: file.name, pathParts: file.path.split("/") },
			error: false,
		};
	}

	public getFileNameAndPathParts(): {
		fileName: string;
		pathParts: PathParts;
	} {
		return unwrapMaybeByThrowing(this.getMaybeFileNameAndPathParts());
	}
}
