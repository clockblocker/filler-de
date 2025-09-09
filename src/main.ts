import { App, Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
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
import { OpenedFileService } from 'services/opened-file-service';
import { BackgroundFileService } from 'services/background-file-service';
import { EditorView } from '@codemirror/view';

// const clickListener = EditorView.domEventHandlers({
// 	click: (event) => {
// 	  const target = event.target as HTMLElement;
// 	  if (target.matches("button.my-btn")) {
// 		this.app.commands.executeCommandById('your:cmd');
// 		return true;
// 	  }
// 	  return false;
// 	}
//   });
//   this.registerEditorExtension(clickListener);

function onNewFileThenRun(
	app: App,
	file: TFile,
	run: (view: MarkdownView) => void
) {
	let timeout: number | null = null;

	// try immediately if it's already the active view
	const tryRun = () => {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view.file?.path === file.path) {
			run(view);
			return true;
		}
		return false;
	};
	if (tryRun()) return;

	// wait for it to be opened
	const openRef = app.workspace.on('file-open', (opened) => {
		if (!opened || opened.path !== file.path) return;

		// once opened, debounce on 'modify' to wait for templates/other plugins
		const clearTimer = () => {
			if (timeout) {
				window.clearTimeout(timeout);
				timeout = null;
			}
		};

		const done = () => {
			clearTimer();
			// final guard: run against the active view of THIS file
			const view = app.workspace.getActiveViewOfType(MarkdownView);
			if (view && view.file?.path === file.path) run(view);
			app.vault.offref(modRef);
			app.workspace.offref(openRef);
		};

		// if nothing touches the file for 60ms, we consider it "settled"
		const arm = () => {
			clearTimer();
			timeout = window.setTimeout(done, 60);
		};

		// start the timer; any further modify resets it
		arm();

		const modRef = app.vault.on('modify', (f) => {
			if (f instanceof TFile && f.path === file.path) arm();
		});
	});
}

export default class TextEaterPlugin extends Plugin {
	settings: TextEaterSettings;
	apiService: ApiService;
	openedFileService: OpenedFileService;
	backgroundFileService: BackgroundFileService;

	deprecatedFileService: FileService;

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
		await this.addCommands();

		this.apiService = new ApiService(this.settings);
		this.openedFileService = new OpenedFileService(this.app);
		this.backgroundFileService = new BackgroundFileService(
			this.app,
			this.app.vault
		);
		this.deprecatedFileService = new FileService(this.app, this.app.vault);

		this.registerDomEvent(document, 'click', (evt) => {
			const target = evt.target as HTMLElement;

			if (target.tagName === 'BUTTON') {
				const action = target.dataset.action;

				if (action === 'execute-new-gen-command') {
					newGenCommand(this);
				}
			}

			if (target.tagName === 'A') {
				const blockHtmlElement = target.parentElement?.parentElement;

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

		this.registerEvent(
			this.app.vault.on('create', (af) => {
				if (!(af instanceof TFile) || af.extension !== 'md') return;

				onNewFileThenRun(this.app, af, (view) => {
					// now it’s safe: templates finished
					// call your command or write directly
					newGenCommand(this);
					// or: view.editor.replaceRange("Your text\n", {line:0,ch:0});
				});
			})
		);
	}

	private async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	private async addCommands() {
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
						newGenCommand(this);
					}
					return true;
				}
				return false;
			},
		});
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
