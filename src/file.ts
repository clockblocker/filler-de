import { MarkdownView, TFile, App, Vault } from 'obsidian';

export class DeprecatedFileService {
	constructor(
		private app: App,
		private vault: Vault
	) {}

	async readFileContentByPath(
		filePath: string
	): Promise<
		{ content: string; error: true } | { content: string; error: false }
	> {
		try {
			const file = this.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				return { content: '', error: true };
			}
			const content = await this.vault.read(file);
			return { content, error: false };
		} catch (error) {
			return { content: '', error: true };
		}
	}

	// await this.vault.process(abstractFile, () => {
	// 	return newContent;
	// });

	async replaceContentInCurrentlyOpenedFile(
		filePath: string,
		newContent: string
	): Promise<{ error: boolean }> {
		try {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

			if (!activeView) {
				console.warn('file not open or not active');
				return { error: true };
			}

			const file = activeView.file;
			if (!file || file.path !== filePath) {
				console.warn('file not open or not active');
				return { error: true };
			}

			activeView.editor.setValue(newContent);
			await activeView.save();

			return { error: false };
		} catch (error) {
			console.error(`Failed to replace content: ${error}`);
			return { error: true };
		}
	}

	async writeToOpenedFile(filePath: string, text: string): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view?.file && view?.file?.path === filePath) {
			const editor = view?.editor;
			if (editor) {
				editor.replaceRange(text, { line: editor.lineCount(), ch: 0 });
			}
		}
	}

	public showLoadingOverlay(): void {
		// Check if the overlay already exists
		if (document.getElementById('fileService-loading-overlay')) {
			return;
		}
		const overlay = document.createElement('div');
		overlay.id = 'fileService-loading-overlay';
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

		const loadingText = document.createElement('div');
		loadingText.innerText = 'Loading...';
		loadingText.style.fontSize = '2rem';
		loadingText.style.color = '#fff';
		overlay.appendChild(loadingText);

		document.body.appendChild(overlay);
	}

	// Exposed method to hide and remove the loading overlay
	public hideLoadingOverlay(): void {
		const overlay = document.getElementById('fileService-loading-overlay');
		if (overlay) {
			overlay.remove();
		}
	}
}
