import {
	type Editor,
	type MarkdownView,
	Plugin,
	type WorkspaceLeaf,
} from "obsidian";
import { Librarian } from "./commanders/librarian/librarian";
import {
	splitPath as managerSplitPath,
	ObsidianVaultActionManagerImpl,
} from "./obsidian-vault-action-manager";
import { BackgroundFileService as NewBackgroundFileService } from "./obsidian-vault-action-manager/impl/background-file-service";
import {
	OpenedFileService,
	splitPath,
	splitPathKey,
} from "./obsidian-vault-action-manager/impl/opened-file-service";
import { Reader } from "./obsidian-vault-action-manager/impl/reader";
import { AboveSelectionToolbarService } from "./services/obsidian-services/atomic-services/above-selection-toolbar-service";
import { ApiService } from "./services/obsidian-services/atomic-services/api-service";
import { BottomToolbarService } from "./services/obsidian-services/atomic-services/bottom-toolbar-service";
import { SelectionService } from "./services/obsidian-services/atomic-services/selection-service";
import { LegacyOpenedFileService } from "./services/obsidian-services/file-services/active-view/legacy-opened-file-service";
import { OpenedFileReader } from "./services/obsidian-services/file-services/active-view/opened-file-reader";
import { logError } from "./services/obsidian-services/helpers/issue-handlers";
import { ACTION_CONFIGS } from "./services/wip-configs/actions/actions-config";
// import newGenCommand from "./services/wip-configs/actions/new/new-gen-command";
// import { VaultCurrator } from './obsidian-related/obsidian-services/managers/vault-currator';
import addBacklinksToCurrentFile from "./services/wip-configs/actions/old/addBacklinksToCurrentFile";
import { makeClickListener } from "./services/wip-configs/event-listeners/click-listener/click-listener";
import { SettingsTab } from "./settings";
import { LibrarianTester } from "./testers/librarian/librarian-tester";
import { DEFAULT_SETTINGS, type TextEaterSettings } from "./types";

export default class TextEaterPlugin extends Plugin {
	settings: TextEaterSettings;
	apiService: ApiService;
	openedFileReader: OpenedFileReader;
	legacyOpenedFileService: LegacyOpenedFileService;
	openedFileService: LegacyOpenedFileService;
	testingOpenedFileService: OpenedFileService;
	testingBackgroundFileService: NewBackgroundFileService;
	testingReader: Reader;
	vaultActionManager: ObsidianVaultActionManagerImpl;
	selectionService: SelectionService;

	selectionToolbarService: AboveSelectionToolbarService;
	bottomToolbarService: BottomToolbarService;

	// Commanders
	librarian: Librarian;
	vaultEventsTeardown?: () => void;

	private initialized = false;

	override async onload() {
		try {
			// Kick off the deferred init; don't block onload.
			void this.initWhenObsidianIsReady();
			this.addSettingTab(new SettingsTab(this.app, this));
		} catch (error) {
			logError({
				description: `Error during plugin initialization: ${error.message}`,
				location: "TextEaterPlugin",
			});
		}
	}

	private async initWhenObsidianIsReady() {
		try {
			await this.whenLayoutReady();
			await this.whenMetadataResolved();

			await this.sleep(300);

			await this.loadPlugin();
			this.initialized = true;
		} catch (error) {
			console.error("[TextEaterPlugin:initWhenObsidianIsReady]", error);
			logError({
				description: `Error during plugin initialization: ${error.message}`,
				location: "TextEaterPlugin",
			});
		}
	}

	/**
	 * Resolves once the workspace layout is ready.
	 * Equivalent to app.workspace.onLayoutReady(cb).
	 */
	private whenLayoutReady(): Promise<void> {
		return new Promise((resolve) => {
			if (this.app.workspace.layoutReady) return resolve();

			this.app.workspace.onLayoutReady(() => {
				resolve();
			});
		});
	}

	/**
	 * Resolves after the initial metadata indexing is done.
	 * Fires once per app session.
	 */
	private whenMetadataResolved(): Promise<void> {
		return new Promise((resolve) => {
			let resolved = false;

			// this.app.metadataCache.on("resolved", () => {
			// 	if (resolved) return;
			// 	resolved = true;
			// 	this.app.metadataCache.off("resolved", () => null);
			// 	resolve();
			// });

			queueMicrotask(() => {
				if (!resolved && this.hasUsableMetadataSignal()) {
					resolved = true;
					this.app.metadataCache.off("resolved", () => null);
					resolve();
				}
			});
		});
	}

	private hasUsableMetadataSignal(): boolean {
		return !!this.app.vault.getRoot();
	}

	private sleep(ms: number) {
		return new Promise((r) => setTimeout(r, ms));
	}

	async loadPlugin() {
		await this.loadSettings();
		await this.addCommands();

		this.apiService = new ApiService(this.settings);
		this.openedFileReader = new OpenedFileReader(this.app);

		this.legacyOpenedFileService = new LegacyOpenedFileService(
			this.app,
			this.openedFileReader,
		);
		this.openedFileService = this.legacyOpenedFileService;
		this.testingOpenedFileService = new OpenedFileService(this.app);
		this.testingBackgroundFileService = new NewBackgroundFileService(
			this.app,
		);
		this.testingReader = new Reader(
			this.testingOpenedFileService,
			this.testingBackgroundFileService,
		);
		this.vaultActionManager = new ObsidianVaultActionManagerImpl(this.app);
		this.setTestingGlobals();

		this.selectionToolbarService = new AboveSelectionToolbarService(
			this.app,
		);

		this.selectionService = new SelectionService(this.app);

		this.librarian = new Librarian({
			manager: this.vaultActionManager,
		});
		await this.librarian.initTrees();
		console.log("[main] Librarian and trees initialized:", this.librarian);

		// Subscribe to manager events (self-filtered inside manager)
		this.vaultEventsTeardown = this.vaultActionManager.subscribe(
			async (event) => {
				await this.librarian.onManagedVaultEvent(event);
			},
		);

		this.registerDomEvent(document, "click", makeClickListener(this));

		this.bottomToolbarService = new BottomToolbarService(this.app);
		this.bottomToolbarService.init();

		this.app.workspace.onLayoutReady(async () => {
			await this.updateBottomActions();
			await this.updateSelectionActions();
			this.selectionToolbarService.reattach();
			this.bottomToolbarService.reattach();
		});

		// Reattach when user switches panes/notes
		this.registerEvent(
			this.app.workspace.on(
				"active-leaf-change",
				async (_leaf: WorkspaceLeaf) => {
					await this.updateBottomActions();
					this.selectionToolbarService.reattach();
				},
			),
		);

		// Add listeners to show the selection toolbar after drag or keyboard selection
		this.registerDomEvent(document, "dragend", async () => {
			await this.updateSelectionActions();
			this.selectionToolbarService.reattach();
		});

		this.registerDomEvent(document, "mouseup", async () => {
			await this.updateSelectionActions();
			this.selectionToolbarService.reattach();
		});

		this.registerDomEvent(document, "keyup", async (evt: KeyboardEvent) => {
			// Only reattach for keys that could affect selection
			const selectionKeys = [
				"ArrowLeft",
				"ArrowRight",
				"ArrowUp",
				"ArrowDown",
				"Shift",
				"Home",
				"End",
				"PageUp",
				"PageDown",
				"a",
			];

			if (evt.shiftKey || selectionKeys.includes(evt.key)) {
				await this.updateSelectionActions();
				this.selectionToolbarService.reattach();
			}
		});

		// Also re-check after major layout changes (splits, etc.)
		this.registerEvent(
			this.app.workspace.on("layout-change", async () => {
				await this.updateBottomActions();
				this.selectionToolbarService.reattach();
			}),
		);

		this.registerEvent(
			this.app.workspace.on("css-change", () =>
				this.selectionToolbarService.onCssChange(),
			),
		);
	}

	override onunload() {
		if (this.vaultEventsTeardown) {
			this.vaultEventsTeardown();
		}
		if (this.bottomToolbarService) this.bottomToolbarService.detach();
		if (this.selectionToolbarService) this.selectionToolbarService.detach();
	}

	private async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	private async addCommands() {
		this.addCommand({
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView,
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
							editor,
						);
					}
					return true;
				}

				return false;
			},
			id: "backlink-all-to-current-file",
			name: "Populate all referenced files with a backlink to the current file",
		});

		this.addCommand({
			editorCheckCallback: (
				// checking: boolean,
				// editor: Editor,
				// view: MarkdownView,
			) => {
				// if (view.file) {
				// 	if (!checking) {
				// 		// fillTemplate(this, editor, view.file);
				// 		// testEndgame(this, editor, view.file);
				// 	}
				// 	return true;
				// }
				return false;
			},
			id: "fill-template",
			name: "Generate a dictionary entry for the word in the title of the file",
		});

		this.addCommand({
			editorCheckCallback: () => {
				const librarianTester = new LibrarianTester(this.librarian);
				librarianTester.createAvatar();
			},
			id: "get-infinitive-and-emoji",
			name: "Get infinitive/normal form and emoji for current word",
		});

		this.addCommand({
			editorCheckCallback: () => {
				this.librarian.createNewNoteInCurrentFolder();
			},
			id: "create-new-text-in-the-current-folder-and-open-it",
			name: "Create new text in the current folder and open it",
		});

		this.addCommand({
			editorCheckCallback: (
				checking: boolean,
				_editor: Editor,
				view: MarkdownView,
			) => {
				// Only show if file is in a Library folder
				if (
					!view.file ||
					!this.librarian.isInLibraryFolder(view.file)
				) {
					return false;
				}
				if (!checking) {
					this.librarian.makeNoteAText();
				}
				return true;
			},
			id: "make-note-a-text",
			name: "Make this note a text",
		});

		this.addCommand({
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView,
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
			id: "duplicate-selection",
			name: "Add links to normal/inf forms to selected text",
		});

		this.addCommand({
			editorCheckCallback: () => {
				ACTION_CONFIGS.TranslateSelection.execute(this);
			},
			id: "translate-selection",
			name: "Translate selected text",
		});

		this.addCommand({
			editorCheckCallback: () => {
				ACTION_CONFIGS.SplitInBlocks.execute(this);
			},
			id: "format-selection-with-number",
			name: "Split selection into linked blocks",
		});

		this.addCommand({
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
			id: "check-ru-de-translation",
			name: "Keymaker",
		});

		this.addCommand({
			editorCheckCallback: (checking: boolean, editor: Editor) => {
				const selection = editor.getSelection();
				if (selection) {
					if (!checking) {
						// this.librarian.ls();
					}
					return true;
				}
				return false;
			},
			id: "check-schriben",
			name: "Schriben check",
		});

		this.addCommand({
			editorCheckCallback: (
				// checking: boolean,
				// editor: Editor,
				// view: MarkdownView,
			) => {
				// if (view.file) {
				// 	if (!checking) {
				// 		newGenCommand(this);
				// 	}
				// 	return true;
				// }
				// return false;
			},
			id: "new-gen-command",
			name: "new-gen-command",
		});

		this.addCommand({
			callback: () => {
				(
					window as unknown as {
						__textfresserTesting?: Record<string, unknown>;
					}
				).__textfresserTesting = {
					managerSplitPath,
					splitPath,
					splitPathKey,
					vaultActionManager: this.vaultActionManager,
				};
			},
			id: "textfresser-testing-expose-manager",
			name: "Testing: expose manager",
		});
	}

	private setTestingGlobals() {
		(
			window as unknown as {
				__textfresserTesting?: Record<string, unknown>;
			}
		).__textfresserTesting = {
			managerSplitPath,
			splitPath,
			splitPathKey,
			vaultActionManager: this.vaultActionManager,
		};
	}

	getReaderTestingApi() {
		return {
			reader: this.testingReader,
			splitPath,
			splitPathKey,
		};
	}

	getVaultActionManagerTestingApi() {
		return {
			manager: this.vaultActionManager,
			splitPath: managerSplitPath,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async updateBottomActions(): Promise<void> {
		// const { fileName, pathParts } =
		// 	this.openedFileService.getFileNameAndPathParts();
		// const metaInfo = extractMetaInfo(
		// 	await this.openedFileService.getContent(),
		// );
		// this.bottomToolbarService.setActions(
		// 	getBottomActionConfigs({
		// 		fileName,
		// 		metaInfo,
		// 		pathParts,
		// 	}),
		// );
	}

	private async updateSelectionActions(): Promise<void> {
		// const { fileName, pathParts } =
		// 	this.openedFileService.getFileNameAndPathParts();
		// const sectionText = await this.selectionService.getSelection();
		// const metaInfo = extractMetaInfo(
		// 	await this.openedFileService.getContent(),
		// );
		// this.selectionToolbarService.setActions(
		// 	getAboveSelectionActionConfigs({
		// 		fileName,
		// 		metaInfo,
		// 		pathParts,
		// 		sectionText,
		// 	}),
		// );
	}
}
