import {
	type Editor,
	type MarkdownView,
	Plugin,
	type WorkspaceLeaf,
} from "obsidian";
import { Librarian, LibraryTree } from "./commanders/librarian";
// LibrarianLegacy unplugged - using new Librarian for healing
// import { LibrarianLegacy } from "./commanders/librarian-legacy/librarian";
import {
	splitPath as managerSplitPath,
	ObsidianVaultActionManagerImpl,
	splitPath,
	splitPathKey,
} from "./obsidian-vault-action-manager";
import { OpenedFileReader } from "./obsidian-vault-action-manager/file-services/active-view/opened-file-reader";
import {
	OpenedFileService,
	OpenedFileService as OpenedFileServiceWithResult,
} from "./obsidian-vault-action-manager/file-services/active-view/opened-file-service";
import { TFileHelper } from "./obsidian-vault-action-manager/file-services/background/helpers/tfile-helper";
import { TFolderHelper } from "./obsidian-vault-action-manager/file-services/background/helpers/tfolder-helper";
import { logError } from "./obsidian-vault-action-manager/helpers/issue-handlers";
import { splitPathFromSystemPath } from "./obsidian-vault-action-manager/helpers/pathfinder";
import { BackgroundFileServiceLegacy } from "./obsidian-vault-action-manager/impl/background-file-service";
import { Reader } from "./obsidian-vault-action-manager/impl/reader";
import { extractMetaInfo } from "./services/dto-services/meta-info-manager/interface";
import { AboveSelectionToolbarService } from "./services/obsidian-services/atomic-services/above-selection-toolbar-service";
import { ApiService } from "./services/obsidian-services/atomic-services/api-service";
import { BottomToolbarService } from "./services/obsidian-services/atomic-services/bottom-toolbar-service";
import { SelectionService } from "./services/obsidian-services/atomic-services/selection-service";
// Legacy services - unplugged
// import { LegacyOpenedFileService } from "./services/obsidian-services/file-services/active-view/legacy-opened-file-service";
// import { LegacyOpenedFileReader } from "./services/obsidian-services/file-services/active-view/opened-file-reader";
// import { LegacyBackgroundFileServiceLegacy } from "./services/obsidian-services/file-services/background/background-file-service";
// import { VaultActionExecutor } from "./services/obsidian-services/file-services/background/vault-action-executor";
// import { VaultActionQueueLegacy } from "./services/obsidian-services/file-services/vault-action-queue";
import { ACTION_CONFIGS } from "./services/wip-configs/actions/actions-config";
// import newGenCommand from "./services/wip-configs/actions/new/new-gen-command";
// import { VaultCurrator } from './obsidian-related/obsidian-services/managers/vault-currator';
import addBacklinksToCurrentFile from "./services/wip-configs/actions/old/addBacklinksToCurrentFile";
// import { makeClickListener } from "./services/wip-configs/event-listeners/click-listener/click-listener";
import { SettingsTab } from "./settings";
// import { LibrarianLegacyTester } from "./testers/librarian/librarian-tester";
import { DEFAULT_SETTINGS, type TextEaterSettings } from "./types";

export default class TextEaterPlugin extends Plugin {
	settings: TextEaterSettings;
	apiService: ApiService;
	// Legacy services - unplugged
	// openedFileReader: LegacyOpenedFileReader;
	// legacyOpenedFileService: LegacyOpenedFileService;
	// backgroundFileService: LegacyBackgroundFileServiceLegacy;
	// vaultActionQueue: VaultActionQueueLegacy;
	// vaultActionExecutor: VaultActionExecutor;
	testingOpenedFileServiceWithResult: OpenedFileServiceWithResult;
	testingReader: Reader;
	testingTFileHelper: TFileHelper;
	testingTFolderHelper: TFolderHelper;
	vaultActionManager: ObsidianVaultActionManagerImpl;
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
		console.log("[main] loadPlugin started");
		await this.loadSettings();
		await this.addCommands();

		this.apiService = new ApiService(this.settings);

		// Legacy services - unplugged
		// this.openedFileReader = new LegacyOpenedFileReader(this.app);
		// this.legacyOpenedFileService = new LegacyOpenedFileService(
		// 	this.app,
		// 	this.openedFileReader,
		// );
		// this.backgroundFileService = new LegacyBackgroundFileServiceLegacy({
		// 	fileManager: this.app.fileManager,
		// 	vault: this.app.vault,
		// });
		// this.vaultActionExecutor = new VaultActionExecutor(
		// 	this.backgroundFileService,
		// 	this.legacyOpenedFileService,
		// );
		// this.vaultActionQueue = new VaultActionQueueLegacy(
		// 	this.vaultActionExecutor,
		// );

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
		const testingBackgroundFileServiceLegacy =
			new BackgroundFileServiceLegacy(
				this.testingTFileHelper,
				this.testingTFolderHelper,
				this.app.vault,
			);
		const testingOpenedFileService = new OpenedFileService(
			this.app,
			testingOpenedFileReader,
		);
		this.testingReader = new Reader(
			testingOpenedFileService,
			testingBackgroundFileServiceLegacy,
		);
		this.vaultActionManager = new ObsidianVaultActionManagerImpl(this.app);
		console.log("[main] vaultActionManager created");

		this.selectionToolbarService = new AboveSelectionToolbarService(
			this.app,
		);

		this.selectionService = new SelectionService(this.app);

		// New Librarian (healing modes)
		this.librarian = new Librarian(this.vaultActionManager, "Library", "-");
		const healResult = await this.librarian.init();
		console.log("[main] loadPlugin completed");
		console.log(
			"[main] Librarian initialized, healed:",
			healResult.renameActions.length,
			"files",
		);

		// Start listening to vault events after trees are ready
		// Folder renames: Obsidian does NOT emit file events for children,
		// so we must handle folder renames explicitly and heal all children
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				console.log(
					"[main] rename event:",
					oldPath,
					"→",
					file.path,
					"isFolder:",
					"children" in file,
				);
				if (this.librarian) {
					void this.librarian
						.handleRename(
							oldPath,
							file.path,
							"children" in file, // isFolder
						)
						.then((actions) => {
							console.log(
								"[main] handleRename result:",
								actions.length,
								"actions",
							);
						});
				}
			}),
		);

		// Handle create events - add suffix to match location
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				console.log(
					"[main] create event:",
					file.path,
					"isFolder:",
					"children" in file,
				);
				if (this.librarian) {
					void this.librarian
						.handleCreate(file.path, "children" in file)
						.then((actions) => {
							console.log(
								"[main] handleCreate result:",
								actions.length,
								"actions",
							);
						});
				}
			}),
		);

		// TODO: Handle delete events when tree is fully integrated
		// this.registerEvent(
		// 	this.app.vault.on("delete", (file) => {
		// 		void this.librarian.onFileDeleted(file);
		// 	}),
		// );

		// this.registerDomEvent(document, "click", makeClickListener(this));

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
			openedFileServiceWithResult:
				this.testingOpenedFileServiceWithResult,
			splitPath,
			splitPathKey,
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

	getLibrarianClass() {
		return Librarian;
	}

	getLibraryTreeClass() {
		return LibraryTree;
	}

	getExtractMetaInfo() {
		return extractMetaInfo;
	}

	getLibrarianTestingApi() {
		// Return instance directly like vaultActionManager
		// Create on-demand to avoid storing reference
		return {
			librarian: new Librarian(
				this.vaultActionManager as any,
				"Library",
				"-",
			),
			splitPath: managerSplitPath,
		};
	}

	getHelpersTestingApi() {
		return {
			splitPath: splitPathFromSystemPath,
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
