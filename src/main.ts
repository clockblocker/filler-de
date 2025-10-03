import {
	App,
	Editor,
	MarkdownView,
	Plugin,
	TFile,
	WorkspaceLeaf,
} from 'obsidian';
import { SettingsTab } from './settings';
import { DEFAULT_SETTINGS, TextEaterSettings } from './types';
import { ApiService } from './obsidian-related/obsidian-services/services/api-service';

import newGenCommand from 'obsidian-related/actions/new/new-gen-command';
import { OpenedFileService } from 'obsidian-related/obsidian-services/services/opened-file-service';
import { BackgroundFileService } from 'obsidian-related/obsidian-services/services/background-file-service';
import { TextsManagerService } from 'obsidian-related/obsidian-services/services/texts-manager-service';
import addBacklinksToCurrentFile from 'obsidian-related/actions/old/addBacklinksToCurrentFile';
import { AboveSelectionToolbarService } from 'obsidian-related/obsidian-services/services/above-selection-toolbar-service';
import { BottomToolbarService } from 'obsidian-related/obsidian-services/services/bottom-toolbar-service';
import { ACTION_CONFIGS } from 'obsidian-related/actions/actions-config';
import { SelectionService } from 'obsidian-related/obsidian-services/services/selection-service';
import { makeClickListener } from './obsidian-related/event-listeners/click-listener/click-listener';
import { logError } from './obsidian-related/obsidian-services/helpers/issue-handlers';
import {
	BOTTOM_ACTIONS,
	ALL_ACTIONS_ABOVE_SELECTION,
} from './obsidian-related/actions/interface';
import { onNewFileThenRun } from './obsidian-related/event-listeners/create-new-file-listener/run-on-new-file';

export default class TextEaterPlugin extends Plugin {
	settings: TextEaterSettings;
	apiService: ApiService;
	openedFileService: OpenedFileService;
	backgroundFileService: BackgroundFileService;
	selectionService: SelectionService;
	textsManagerService: TextsManagerService;

	selectionToolbarService: AboveSelectionToolbarService;
	bottomToolbarService: BottomToolbarService;

	async onload() {
		try {
			await this.loadPlugin();
			this.addSettingTab(new SettingsTab(this.app, this));
		} catch (error) {
			logError({
				description: `Error during plugin initialization: ${error.message}`,
				location: 'TextEaterPlugin',
			});
		}
	}

	async loadPlugin() {
		await this.loadSettings();
		await this.addCommands();

		this.apiService = new ApiService(this.settings);
		this.openedFileService = new OpenedFileService(this.app);
		this.backgroundFileService = new BackgroundFileService(this.app.vault);
		this.selectionToolbarService = new AboveSelectionToolbarService(this.app);
		this.selectionService = new SelectionService(this.app);
		this.textsManagerService = new TextsManagerService(this.app);

		this.registerDomEvent(document, 'click', makeClickListener(this));

		this.registerEvent(
			this.app.vault.on('create', (af) => {
				if (!(af instanceof TFile) || af.extension !== 'md') return;

				onNewFileThenRun(this.app, af, () => {});
			})
		);

		this.bottomToolbarService = new BottomToolbarService(this.app);
		this.bottomToolbarService.init();
		this.bottomToolbarService.setTextsManagerService(this.textsManagerService);

		this.bottomToolbarService.setActions(BOTTOM_ACTIONS);
		this.selectionToolbarService.setActions(ALL_ACTIONS_ABOVE_SELECTION);

		this.app.workspace.onLayoutReady(async () => {
			await this.bottomToolbarService.reattach();
			this.selectionToolbarService.reattach();
		});

		// Reattach when user switches panes/notes
		this.registerEvent(
			this.app.workspace.on(
				'active-leaf-change',
				async (_leaf: WorkspaceLeaf) => {
					await this.bottomToolbarService.reattach();
					this.selectionToolbarService.reattach();
				}
			)
		);

		// Also re-check after major layout changes (splits, etc.)
		this.registerEvent(
			this.app.workspace.on('layout-change', async () => {
				await this.bottomToolbarService.reattach();
				this.selectionToolbarService.reattach();
			})
		);

		this.registerEvent(
			this.app.workspace.on('css-change', () =>
				this.selectionToolbarService.onCssChange()
			)
		);
	}

	onunload() {
		if (this.bottomToolbarService) this.bottomToolbarService.detach();
		if (this.selectionToolbarService) this.selectionToolbarService.detach();
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
						// fillTemplate(this, editor, view.file);
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
						// getInfinitiveAndEmoji(this, editor, view.file);
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
						// normalizeSelection(this, editor, view.file, selection);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'translate-selection',
			name: 'Translate selected text',
			editorCheckCallback: () => {
				ACTION_CONFIGS.TranslateSelection.execute(this);
			},
		});

		this.addCommand({
			id: 'format-selection-with-number',
			name: 'Split selection into linked blocks',
			editorCheckCallback: () => {
				ACTION_CONFIGS.SplitInBlocks.execute(this);
			},
		});

		this.addCommand({
			id: 'check-ru-de-translation',
			name: 'Keymaker',
			editorCheckCallback: (checking: boolean, editor: Editor) => {
				const selection = editor.getSelection();
				if (selection) {
					if (!checking) {
						// insertReplyFromKeymaker(this, editor, selection);
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
						// insertReplyFromC1Richter(this, editor, selection);
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
}
