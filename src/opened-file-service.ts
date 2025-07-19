import { MarkdownView, TFile, App, Vault, Editor, TFolder } from 'obsidian';
import { FileService } from './background-file-service';
import { Maybe } from './types/general';

export class OpenedFileService {
	constructor(
		private app: App,
		private fileService: FileService
	) {}

	async getMaybeOpenedFile(): Promise<Maybe<TFile>> {
		try {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

			if (!activeView) {
				console.warn('file not open or not active');
				return { error: true };
			}

			const file = activeView.file;

			if (!file) {
				console.warn('file not open or not active');
				return { error: true };
			}

			return { error: false, data: file };
		} catch (error) {
			console.error(`Failed to replace content: ${error}`);
			return { error: true };
		}
	}

	async getMaybeEditor(): Promise<Maybe<Editor>> {
		return this.fileService.getMaybeEditor();
	}

	async replaceContentInCurrentlyOpenedFile(
		newContent: string
	): Promise<Maybe<string>> {
		const maybeFile = await this.getMaybeOpenedFile();
		if (maybeFile.error) {
			return maybeFile;
		}

		return { error: false, data: newContent };
	}

	async writeToOpenedFile(text: string): Promise<Maybe<string>> {
		const maybeEditor = await this.getMaybeEditor();
		if (maybeEditor.error) {
			return maybeEditor;
		}

		const editor = maybeEditor.data;
		editor.replaceRange(text, { line: editor.lineCount(), ch: 0 });

		return { error: false, data: text };
	}

	async getPathOfOpenedFile(): Promise<Maybe<string>> {
		const maybeFile = await this.getMaybeOpenedFile();
		if (maybeFile.error) {
			return maybeFile;
		}

		return { error: false, data: maybeFile.data.path };
	}

	async getParentOfOpenedFile(): Promise<Maybe<TFolder>> {
		const maybeFile = await this.getMaybeOpenedFile();
		if (maybeFile.error) return maybeFile;

		const parent = maybeFile.data.parent;

		if (!parent) {
			return { error: true, errorText: 'Opened file does not have a parent' };
		}

		return { error: false, data: parent };
	}

	public showLoadingOverlay(): void {
		if (document.getElementById('opened-file-service-loading-overlay')) {
			return;
		}
		const overlay = document.createElement('div');
		overlay.id = 'opened-file-service-loading-overlay';

		const loadingText = document.createElement('div');
		loadingText.innerText = 'Loading...';
		loadingText.style.fontSize = '2rem';
		loadingText.style.color = '#fff';
		overlay.appendChild(loadingText);

		document.body.appendChild(overlay);
	}

	// Exposed method to hide and remove the loading overlay
	public hideLoadingOverlay(): void {
		const overlay = document.getElementById('opened-file-service-loading-overlay');
		if (overlay) {
			overlay.remove();
		}
	}

	public async openFile(file: TFile): Promise<Maybe<TFile>> {
		try {
			await this.app.workspace.getLeaf(true).openFile(file);
			return { error: false, data: file };
		} catch (error) {
			console.warn(`Failed to open file: ${error}`);
			return { error: true, errorText: `Failed to open file: ${error}` };
		}
	}
}
