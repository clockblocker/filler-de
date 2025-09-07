import { Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import { SettingsTab } from './settings';
import { DEFAULT_SETTINGS, TextEaterSettings } from './types';
import { ApiService } from './services/api-service';
import { FileService } from './file';
import fillTemplate from './commands/fillTemplate';
import getInfinitiveAndEmoji from './commands/getInfinitiveAndEmoji';
import normalizeSelection from './commands/normalizeSelection';
import translateSelection from './commands/translateSelection';
import formatSelectionWithNumber from './commands/formatSelectionWithNumber';
import addBacklinksToCurrentFile from './commands/addBacklinksToCurrentFile';
import insertReplyFromKeymaker from './commands/insertReplyFromC1Richter';
import insertReplyFromC1Richter from './commands/insertReplyFromC1Richter';
import newGenCommand from 'commands/new-gen-command';

export default class TextEaterPlugin extends Plugin {
	settings: TextEaterSettings;
	apiService: ApiService;
	fileService: FileService;

	async onload() {
		try {
			await this.loadPlugin();
			this.addSettingTab(new SettingsTab(this.app, this));
		} catch (error) {
			console.error('Error during plugin initialization:', error);
			new Notice(`Plugin failed to load: ${error.message}`);
		}
	}

	async loadPlugin() {
		await this.loadSettings();
		this.apiService = new ApiService(this.settings);
		this.fileService = new FileService(this.app, this.app.vault);

		this.addCommand({
			id: 'backlink-all-to-current-file',
			name: 'Populate all referenced files with a backlink to the current file',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				const fileName = view.file?.name;
				const backlink = view.file?.basename;

				if (view.file && fileName && backlink) {
					if (!checking) {
						addBacklinksToCurrentFile(
							view.file,
							backlink,
							this.app.vault,
							this.app.metadataCache,
							editor
						);
					}
					return true;
				}

				return false;
			},
		});

		this.addCommand({
			id: 'fill-template',
			name: 'Generate a dictionary entry for the word in the title of the file',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				if (view.file) {
					if (!checking) {
						fillTemplate(this, editor, view.file);
						// testEndgame(this, editor, view.file);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'get-infinitive-and-emoji',
			name: 'Get infinitive/normal form and emoji for current word',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				if (view.file) {
					if (!checking) {
						getInfinitiveAndEmoji(this, editor, view.file);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'duplicate-selection',
			name: 'Add links to normal/inf forms to selected text',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				const selection = editor.getSelection();
				if (selection && view.file) {
					if (!checking) {
						normalizeSelection(this, editor, view.file, selection);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'translate-selection',
			name: 'Translate selected text',
			editorCheckCallback: (checking: boolean, editor: Editor) => {
				const selection = editor.getSelection();
				if (selection) {
					if (!checking) {
						translateSelection(this, editor, selection);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'format-selection-with-number',
			name: 'Split selection into linked blocks',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				const selection = editor.getSelection();
				if (selection && view.file) {
					if (!checking) {
						formatSelectionWithNumber(this, editor, view.file, selection);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'check-ru-de-translation',
			name: 'Keymaker',
			editorCheckCallback: (checking: boolean, editor: Editor) => {
				const selection = editor.getSelection();
				if (selection) {
					if (!checking) {
						insertReplyFromKeymaker(this, editor, selection);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'check-schriben',
			name: 'Schriben check',
			editorCheckCallback: (checking: boolean, editor: Editor) => {
				const selection = editor.getSelection();
				if (selection) {
					if (!checking) {
						insertReplyFromC1Richter(this, editor, selection);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'new-gen-command',
			name: 'new-gen-command',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				if (view.file) {
					if (!checking) {
						newGenCommand(this, editor, view.file);
					}
					return true;
				}
				return false;
			},
		});

		this.registerDomEvent(document, 'click', (evt) => {
			const target = evt.target as HTMLElement;

			if (target.tagName === 'A') {
				console.log(`target`, target);

				const blockHtmlElement = target.parentElement?.parentElement;
				console.log(
					'blockHtmlElement?.textContent',
					blockHtmlElement?.textContent
				);

				const parentHtmlElement = target.parentElement;
				console.log(
					'parentHtmlElement?.textContent',
					parentHtmlElement?.textContent
				);

				const children = blockHtmlElement?.children;
				if (children) {
					const blockIdElement = Array.from(children).find((c) =>
						c.classList.contains('cm-blockid')
					);

					if (blockIdElement) {
						const textContent = blockIdElement.textContent;
						console.log('blockIdElement', textContent, `\n\n\n`);
					}
				}
			}
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	findHighestNumber(content: string): number {
		const matches = content.match(/#\^(\d+)/g);
		if (!matches) return 0;

		const numbers = matches.map((match) => {
			const num = match.replace('#^', '');
			return parseInt(num, 10);
		});

		return Math.max(0, ...numbers);
	}
}
