import {
	type Editor,
	type MarkdownView,
	Plugin,
	type WorkspaceLeaf,
} from "obsidian";
import { Librarian } from "./commanders/librarian-new/librarian";

import { clearState, initializeState } from "./global-state/global-state";
import { ClickManager } from "./managers/obsidian/click-manager";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
	VaultActionManagerImpl,
} from "./managers/obsidian/vault-action-manager";
import { OpenedFileReader } from "./managers/obsidian/vault-action-manager/file-services/active-view/opened-file-reader";
import {
	OpenedFileService,
	OpenedFileService as OpenedFileServiceWithResult,
} from "./managers/obsidian/vault-action-manager/file-services/active-view/opened-file-service";
import { TFileHelper } from "./managers/obsidian/vault-action-manager/file-services/background/helpers/tfile-helper";
import { TFolderHelper } from "./managers/obsidian/vault-action-manager/file-services/background/helpers/tfolder-helper";
import { logError } from "./managers/obsidian/vault-action-manager/helpers/issue-handlers";
import { splitPathFromSystemPathInternal } from "./managers/obsidian/vault-action-manager/helpers/pathfinder/system-path-and-split-path-codec";
import { Reader } from "./managers/obsidian/vault-action-manager/impl/reader";
import { extractMetaInfoDeprecated } from "./managers/pure/meta-info-manager-deprecated/interface";
import { AboveSelectionToolbarService } from "./services/obsidian-services/atomic-services/above-selection-toolbar-service";
import { ApiService } from "./services/obsidian-services/atomic-services/api-service";
import { BottomToolbarService } from "./services/obsidian-services/atomic-services/bottom-toolbar-service";
import { SelectionService } from "./services/obsidian-services/atomic-services/selection-service";
import { ACTION_CONFIGS } from "./services/wip-configs/actions/actions-config";
import addBacklinksToCurrentFile from "./services/wip-configs/actions/old/addBacklinksToCurrentFile";
import { SettingsTab } from "./settings";
import { DEFAULT_SETTINGS, type TextEaterSettings } from "./types";
import { logger } from "./utils/logger";

export default class TextEaterPlugin extends Plugin {
	settings: TextEaterSettings;
	apiService: ApiService;
	testingOpenedFileServiceWithResult: OpenedFileServiceWithResult;
	testingReader: Reader;
	testingTFileHelper: TFileHelper;
	testingTFolderHelper: TFolderHelper;
	vaultActionManager: VaultActionManagerImpl;
	clickManager: ClickManager;
	selectionService: SelectionService;

	selectionToolbarService: AboveSelectionToolbarService;
	bottomToolbarService: BottomToolbarService;

	// Commanders
	librarian: Librarian | null = null;
	// librarianLegacy: LibrarianLegacy; // Unplugged

	private initialized = false;

	override async onload() {
		try {
			// Kick off the deferred init; don't block onload.
			void this.initWhenObsidianIsReady();
			this.addSettingTab(new SettingsTab(this.app, this));
			// Add testing command early so it exists, but callback waits for init
			this.addCommand({
				callback: async () => {
					// Wait for plugin to be fully initialized
					while (!this.initialized) {
						await new Promise((resolve) =>
							setTimeout(resolve, 100),
						);
					}
					// Tests access APIs via: app.plugins.plugins["cbcr-text-eater-de"]?.getHelpersTestingApi?.()
				},
				id: "textfresser-testing-expose-opened-service",
				name: "Testing: expose opened file service",
			});
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

		const testingOpenedFileReader = new OpenedFileReader(this.app);
		this.testingOpenedFileServiceWithResult =
			new OpenedFileServiceWithResult(this.app, testingOpenedFileReader);
		this.testingTFileHelper = new TFileHelper({
			fileManager: this.app.fileManager,
			vault: this.app.vault,
		});
		this.testingTFolderHelper = new TFolderHelper({
			fileManager: this.app.fileManager,
			vault: this.app.vault,
		});
		const testingOpenedFileService = new OpenedFileService(
			this.app,
			testingOpenedFileReader,
		);
		this.testingReader = new Reader(
			testingOpenedFileService,
			this.testingTFileHelper,
			this.testingTFolderHelper,
			this.app.vault,
		);
		this.vaultActionManager = new VaultActionManagerImpl(this.app);
		this.clickManager = new ClickManager(this.app, this.vaultActionManager);

		this.selectionToolbarService = new AboveSelectionToolbarService(
			this.app,
		);

		this.selectionService = new SelectionService(this.app);

		// New Librarian (healing modes + codex clicks)
		this.librarian = new Librarian(
			this.vaultActionManager,
			this.clickManager,
		);

		// Start listening to file system events
		// VaultActionManager will convert events to VaultEvent, filter self-events,
		// and notify subscribers (e.g., Librarian)
		this.vaultActionManager.startListening();

		// Start listening to DOM click events
		this.clickManager.startListening();

		// Initialize librarian: read tree, heal mismatches, regenerate codexes
		if (this.librarian) {
			try {
				await this.librarian.init();
			} catch (error) {
				logger.error(
					"[TextEaterPlugin] Failed to initialize librarian:",
					error instanceof Error ? error.message : String(error),
				);
			}
		}

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
		if (this.bottomToolbarService) this.bottomToolbarService.detach();
		if (this.selectionToolbarService) this.selectionToolbarService.detach();
		if (this.clickManager) this.clickManager.stopListening();
		if (this.librarian) this.librarian.unsubscribe();
		// Clear global state
		clearState();
	}

	private async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
		// Initialize global state with parsed settings
		initializeState(this.settings);
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

		// TODO: Re-enable when LibrarianLegacy methods are ported to new Librarian
		// this.addCommand({
		// 	editorCheckCallback: () => {
		// 		const librarianTester = new LibrarianLegacyTester(
		// 			this.librarian,
		// 		);
		// 		librarianTester.createAvatar();
		// 	},
		// 	id: "get-infinitive-and-emoji",
		// 	name: "Get infinitive/normal form and emoji for current word",
		// });

		// this.addCommand({
		// 	editorCheckCallback: () => {
		// 		this.librarian.createNewNoteInCurrentFolder();
		// 	},
		// 	id: "create-new-text-in-the-current-folder-and-open-it",
		// 	name: "Create new text in the current folder and open it",
		// });

		// this.addCommand({
		// 	editorCheckCallback: (
		// 		checking: boolean,
		// 		_editor: Editor,
		// 		view: MarkdownView,
		// 	) => {
		// 		// Only show if file is in a Library folder
		// 		if (
		// 			!view.file ||
		// 			!this.librarian.isInLibraryFolder(view.file)
		// 		) {
		// 			return false;
		// 		}
		// 		if (!checking) {
		// 			this.librarian.makeNoteAText();
		// 		}
		// 		return true;
		// 	},
		// 	id: "make-note-a-text",
		// 	name: "Make this note a text",
		// });

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
			// editorCheckCallback: () => {
			// 	ACTION_CONFIGS.SplitInBlocks.execute(this);
			// },
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

		// Legacy command - unplugged
		// this.addCommand({
		// 	callback: () => {
		// 		this.backgroundFileService.logDeepLs();
		// 	},
		// 	id: "librarian-log-deep-ls",
		// 	name: "LibrarianLegacy: log tree structure",
		// });
	}

	// private setTestingGlobals() {
	// 	(
	// 		window as unknown as {
	// 			__textfresserTesting?: Record<string, unknown>;
	// 		}
	// 	).__textfresserTesting = {
	// 		backgroundFileService: this.testingBackgroundFileServiceLegacy,
	// 		managerSplitPath,
	// 		openedFileService: this.testingOpenedFileService,
	// 		reader: this.testingReader,
	// 		splitPath,
	// 		splitPathBackground: splitPathForBackground,
	// 		splitPathKey,
	// 		splitPathKeyBackground: splitPathKeyForBackground,
	// 		vaultActionManager: this.vaultActionManager,
	// 	};
	// }

	// getOpenedFileServiceForTesting() {
	// 	return this.testingOpenedFileService;
	// }

	getOpenedFileServiceTestingApi() {
		return {
			makeSplitPath,
			makeSystemPathForSplitPath,
			openedFileServiceWithResult:
				this.testingOpenedFileServiceWithResult,
		};
	}

	// getBackgroundFileServiceLegacyTestingApi() {
	// 	return {
	// 		backgroundFileService: this.testingBackgroundFileServiceLegacy,
	// 		splitPath: splitPathForBackground,
	// 		splitPathKey: splitPathKeyForBackground,
	// 	};
	// }

	getReaderTestingApi() {
		return {
			makeSplitPath,
			makeSystemPathForSplitPath,
			reader: this.testingReader,
		};
	}

	getVaultActionManagerTestingApi() {
		return {
			makeSplitPath,
			manager: this.vaultActionManager,
		};
	}

	getExtractMetaInfo() {
		return extractMetaInfoDeprecated;
	}

	getLibrarianTestingApi() {
		// Return instance directly like vaultActionManager
		// Create on-demand to avoid storing reference
		return {
			librarian: new Librarian(this.vaultActionManager),
			makeSplitPath,
		};
	}

	getHelpersTestingApi() {
		return {
			splitPath: splitPathFromSystemPathInternal,
			tfileHelper: this.testingTFileHelper,
			tfolderHelper: this.testingTFolderHelper,
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
