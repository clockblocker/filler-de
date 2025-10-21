import { type App, MarkdownView, type TFile, type TFolder } from 'obsidian';

import { getMaybeEditor } from '../helpers/get-editor';
import { logError, logWarning } from '../helpers/issue-handlers';
import { type Maybe, unwrapMaybe, type PathParts } from '../../types/general';

export class OpenedFileService {
	constructor(private app: App) {}

	getApp(): App {
		return this.app;
	}

	async getMaybeOpenedFile(): Promise<Maybe<TFile>> {
		try {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

			if (!activeView) {
				logWarning({
					description: 'File not open or not active',
					location: 'OpenedFileService',
				});
				return { error: true };
			}

			const file = activeView.file;

			if (!file) {
				logWarning({
					description: 'File not open or not active',
					location: 'OpenedFileService',
				});
				return { error: true };
			}

			return { error: false, data: file };
		} catch (error) {
			logError({
				description: `Failed to get maybe opened file: ${error}`,
				location: 'OpenedFileService',
			});
			return { error: true };
		}
	}

	async getMaybeFileContent(): Promise<Maybe<string>> {
		try {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			const mbEditor = await getMaybeEditor(this.app);

			if (!activeView || mbEditor.error) {
				logWarning({
					description: 'File not open or not active',
					location: 'OpenedFileService',
				});
				return { error: true };
			}

			const file = activeView.file;
			const editor = mbEditor.data;

			if (!file) {
				logWarning({
					description: 'File not open or not active',
					location: 'OpenedFileService',
				});
				return { error: true };
			}

			const content = editor.getValue();
			return { error: false, data: content };
		} catch (error) {
			logError({
				description: `Failed to get maybe file content: ${error}`,
				location: 'OpenedFileService',
			});
			return { error: true };
		}
	}

	async getFileContent(): Promise<string> {
		return unwrapMaybe(await this.getMaybeFileContent());
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
		this.showLoadingOverlay();
		const maybeEditor = await getMaybeEditor(this.app);
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
			return { error: true, description: 'Opened file does not have a parent' };
		}

		return { error: false, data: parent };
	}

	public showLoadingOverlay(): void {
		if (document.getElementById('opened-file-service-loading-overlay')) {
			return;
		}
		const overlay = document.createElement('div');
		overlay.id = 'opened-file-service-loading-overlay';

		document.body.appendChild(overlay);

		const loadingText = document.createElement('div');
		loadingText.innerText = 'Loading...';
		loadingText.style.fontSize = '2rem';
		loadingText.style.color = '#fff';
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
			'opened-file-service-loading-overlay'
		);
		if (overlay) {
			overlay.remove();
		}
	}

	public async openFile(file: TFile): Promise<Maybe<TFile>> {
		try {
			await this.app.workspace.getLeaf(true).openFile(file);
			return { error: false, data: file };
		} catch (error) {
			const description = `Failed to open file: ${error}`;
			logError({
				description,
				location: 'OpenedFileService',
			});
			return { error: true, description };
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
			error: false,
			data: { fileName: file.name, pathParts: file.path.split('/') },
		};
	}

	public getFileNameAndPathParts(): { fileName: string; pathParts: PathParts } {
		return unwrapMaybe(this.getMaybeFileNameAndPathParts());
	}
}
