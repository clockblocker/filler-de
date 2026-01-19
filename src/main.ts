import {
	type Editor,
	type MarkdownView,
	Modal,
	Notice,
	Plugin,
	type TFile,
	type WorkspaceLeaf,
} from "obsidian";
import { Librarian } from "./commanders/librarian/librarian";

import {
	clearState,
	initializeState,
	updateParsedSettings,
} from "./global-state/global-state";
import { ClickInterceptor } from "./managers/obsidian/click-interceptor";
import { ClipboardInterceptor } from "./managers/obsidian/clipboard-interceptor";
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
import {
	DEFAULT_SETTINGS,
	type SuffixDelimiterConfig,
	type TextEaterSettings,
} from "./types";
import {
	buildCanonicalDelimiter,
	buildFlexibleDelimiterPattern,
	isSuffixDelimiterConfig,
	migrateStringDelimiter,
} from "./utils/delimiter";
import { whenIdle as whenIdleTracker } from "./utils/idle-tracker";
import { logger } from "./utils/logger";

export default class TextEaterPlugin extends Plugin {
	settings: TextEaterSettings;
	apiService: ApiService;
	testingOpenedFileServiceWithResult: OpenedFileServiceWithResult;
	testingReader: Reader;
	testingTFileHelper: TFileHelper;
	testingTFolderHelper: TFolderHelper;
	vaultActionManager: VaultActionManagerImpl;
	clickInterceptor: ClickInterceptor;
	clipboardInterceptor: ClipboardInterceptor;
	selectionService: SelectionService;

	selectionToolbarService: AboveSelectionToolbarService;
	bottomToolbarService: BottomToolbarService;

	// Commanders
	librarian: Librarian | null = null;
	// librarianLegacy: LibrarianLegacy; // Unplugged

	private initialized = false;
	private previousSettings: TextEaterSettings | null = null;

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
		this.clickInterceptor = new ClickInterceptor(
			this.app,
			this.vaultActionManager,
		);
		this.clipboardInterceptor = new ClipboardInterceptor();

		this.selectionToolbarService = new AboveSelectionToolbarService(
			this.app,
		);

		this.selectionService = new SelectionService(this.app);

		// New Librarian (healing modes + codex clicks)
		this.librarian = new Librarian(
			this.vaultActionManager,
			this.clickInterceptor,
		);

		// Start listening to file system events
		// VaultActionManager will convert events to VaultEvent, filter self-events,
		// and notify subscribers (e.g., Librarian)
		this.vaultActionManager.startListening();

		// Start listening to DOM click events
		this.clickInterceptor.startListening();

		// Start listening to clipboard events (strips metadata from copied text)
		this.clipboardInterceptor.startListening();

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
		if (this.clickInterceptor) this.clickInterceptor.stopListening();
		if (this.clipboardInterceptor)
			this.clipboardInterceptor.stopListening();
		if (this.librarian) this.librarian.unsubscribe();
		// Clear global state
		clearState();
	}

	private async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

		// Migrate old string delimiter format to new config format
		if (
			loadedData?.suffixDelimiter &&
			!isSuffixDelimiterConfig(loadedData.suffixDelimiter)
		) {
			this.settings.suffixDelimiter = migrateStringDelimiter(
				loadedData.suffixDelimiter as string,
			);
		}

		// Initialize global state with parsed settings
		initializeState(this.settings);
		// Store initial settings for change detection (deep copy delimiter)
		this.previousSettings = {
			...this.settings,
			suffixDelimiter: { ...this.settings.suffixDelimiter },
		};
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
			editorCheckCallback: () => {
				return false;
			},
			id: "fill-template",
			name: "Generate a dictionary entry for the word in the title of the file",
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
			editorCheckCallback: () => {},
			id: "new-gen-command",
			name: "new-gen-command",
		});

		this.addCommand({
			editorCheckCallback: (checking: boolean) => {
				if (!checking) {
					import(
						"./commanders/librarian/bookkeeper/split-to-pages-action"
					).then(({ splitToPagesAction }) => {
						splitToPagesAction({
							openedFileService:
								this.testingOpenedFileServiceWithResult,
							vaultActionManager: this.vaultActionManager,
						});
					});
				}
				return true;
			},
			id: "split-to-pages",
			name: "Split file into pages",
		});
	}

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

	/**
	 * E2E test hook: wait until all plugin async work is complete.
	 * Resolves when all queues are drained, pending tasks are done, and Obsidian has registered all actions.
	 */
	async whenIdle(): Promise<void> {
		return whenIdleTracker(() =>
			this.vaultActionManager.waitForObsidianEvents(),
		);
	}

	/**
	 * E2E test hook: reset settings to provided values and reinitialize librarian.
	 * This bypasses the confirmation dialog and forces a full reinit.
	 */
	async resetSettingsForTesting(
		newSettings: Partial<TextEaterSettings>,
	): Promise<void> {
		// Update settings
		Object.assign(this.settings, newSettings);
		// Update global state so codecs use new settings
		updateParsedSettings(this.settings);
		// Persist to disk
		await this.saveData(this.settings);
		// Update previousSettings to avoid dialog on next saveSettings
		this.previousSettings = {
			...this.settings,
			suffixDelimiter: { ...this.settings.suffixDelimiter },
		};
		// Reinitialize librarian with new settings
		await this.reinitLibrarian();
	}

	async saveSettings() {
		const prev = this.previousSettings;
		const curr = this.settings;

		if (prev) {
			// Compare delimiter configs
			const symbolChanged =
				prev.suffixDelimiter.symbol !== curr.suffixDelimiter.symbol;
			const paddingChanged =
				prev.suffixDelimiter.padded !== curr.suffixDelimiter.padded;
			const delimiterChanged = symbolChanged || paddingChanged;

			const depthChanged =
				prev.maxSectionDepth !== curr.maxSectionDepth ||
				prev.showScrollsInCodexesForDepth !==
					curr.showScrollsInCodexesForDepth;
			const rootChanged = prev.libraryRoot !== curr.libraryRoot;
			const backlinksChanged =
				prev.showScrollBacklinks !== curr.showScrollBacklinks;
			const hideMetadataChanged = prev.hideMetadata !== curr.hideMetadata;

			if (delimiterChanged) {
				const confirmed = await this.handleDelimiterChange(
					prev.suffixDelimiter,
					curr.suffixDelimiter,
				);
				if (!confirmed) {
					// User cancelled - restore old delimiter
					this.settings.suffixDelimiter = { ...prev.suffixDelimiter };
					return;
				}
			}

			if (
				delimiterChanged ||
				depthChanged ||
				rootChanged ||
				backlinksChanged ||
				hideMetadataChanged
			) {
				// Update global state BEFORE reinit so librarian uses new settings
				updateParsedSettings(this.settings);
				await this.reinitLibrarian();
			}
		}

		await this.saveData(this.settings);
		this.previousSettings = {
			...this.settings,
			suffixDelimiter: { ...this.settings.suffixDelimiter },
		};
		updateParsedSettings(this.settings);
	}

	/**
	 * Handle delimiter change by renaming files with suffixes.
	 * Returns true if user confirmed, false if cancelled.
	 */
	private async handleDelimiterChange(
		oldConfig: SuffixDelimiterConfig,
		newConfig: SuffixDelimiterConfig,
	): Promise<boolean> {
		const oldDelim = buildCanonicalDelimiter(oldConfig);
		const newDelim = buildCanonicalDelimiter(newConfig);
		const oldPattern = buildFlexibleDelimiterPattern(oldConfig);

		if (oldDelim === newDelim) return true;

		// Get all .md files in library
		const libraryRoot = this.settings.libraryRoot;
		const rootFolder = this.app.vault.getAbstractFileByPath(libraryRoot);
		if (!rootFolder) {
			new Notice(`Library folder "${libraryRoot}" not found`);
			return false;
		}

		// Collect all .md files in library recursively
		const mdFiles: TFile[] = [];
		const collectMdFiles = (folder: string) => {
			const children = this.app.vault.getFiles().filter((f) => {
				const filePath = f.path;
				return (
					filePath.startsWith(folder + "/") &&
					filePath.endsWith(".md")
				);
			});
			mdFiles.push(...children);
		};
		collectMdFiles(libraryRoot);

		// Count files that need renaming (match old pattern - any spacing around symbol)
		const filesToRename = mdFiles.filter((f) =>
			oldPattern.test(f.basename),
		);

		// Also count files that need escape (have new symbol in basename)
		const newPattern = buildFlexibleDelimiterPattern(newConfig);
		const filesNeedingEscape = mdFiles.filter((f) =>
			newPattern.test(f.basename),
		);

		const totalAffected = new Set([
			...filesToRename.map((f) => f.path),
			...filesNeedingEscape.map((f) => f.path),
		]).size;

		if (totalAffected === 0) {
			// No files to rename, just confirm
			return true;
		}

		// Show confirmation dialog
		const confirmed = await this.showConfirmDialog(
			"Rename files?",
			`Changing suffix delimiter from "${oldDelim}" to "${newDelim}" will rename ${totalAffected} file(s). Continue?`,
		);

		if (!confirmed) return false;

		// Find escape char not present in either delimiter symbol
		const escapeCandidates = ["_", "~", ".", " ", "-", "+", "="];
		const escapeChar =
			escapeCandidates.find(
				(c) =>
					!oldConfig.symbol.includes(c) &&
					!newConfig.symbol.includes(c),
			) ?? "_";

		const symbolChanged = oldConfig.symbol !== newConfig.symbol;

		// Single-pass atomic rename: parse with old pattern, escape new symbol in parts, join with new delimiter
		for (const file of filesToRename) {
			const parts = file.basename.split(oldPattern);
			if (parts.length <= 1) continue;

			// Escape new symbol in each part (node name) if symbol is changing
			let escapedParts = parts;
			if (symbolChanged) {
				const newSymbolRegex = new RegExp(
					newConfig.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
					"g",
				);
				escapedParts = parts.map((part) =>
					part.replace(newSymbolRegex, escapeChar),
				);
			}

			const newBasename = escapedParts.join(newDelim);
			if (newBasename === file.basename) continue;

			const newPath = file.path.replace(file.name, newBasename + ".md");
			try {
				await this.app.fileManager.renameFile(file, newPath);
			} catch (error) {
				logger.error(
					`[TextEaterPlugin] Failed to rename ${file.path}:`,
					error instanceof Error ? error.message : String(error),
				);
			}
		}

		// Let Obsidian process file events before reinit
		await new Promise((resolve) => setTimeout(resolve, 100));

		new Notice(`Renamed ${totalAffected} file(s)`);
		return true;
	}

	/**
	 * Show a simple confirmation dialog.
	 */
	private showConfirmDialog(
		title: string,
		message: string,
	): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmModal(this.app, title, message, resolve);
			modal.open();
		});
	}

	/**
	 * Reinitialize the librarian with current settings.
	 */
	private async reinitLibrarian(): Promise<void> {
		if (this.librarian) {
			await this.librarian.unsubscribe();
		}
		this.librarian = new Librarian(
			this.vaultActionManager,
			this.clickInterceptor,
		);
		try {
			await this.librarian.init();
		} catch (error) {
			logger.error(
				"[TextEaterPlugin] Failed to reinitialize librarian:",
				error instanceof Error ? error.message : String(error),
			);
		}
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

/**
 * Simple confirmation modal with OK/Cancel buttons.
 */
class ConfirmModal extends Modal {
	private readonly title: string;
	private readonly message: string;
	private readonly onResult: (confirmed: boolean) => void;

	constructor(
		app: import("obsidian").App,
		title: string,
		message: string,
		onResult: (confirmed: boolean) => void,
	) {
		super(app);
		this.title = title;
		this.message = message;
		this.onResult = onResult;
	}

	override onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: this.title });
		contentEl.createEl("p", { text: this.message });

		const buttonContainer = contentEl.createDiv({
			cls: "modal-button-container",
		});

		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelBtn.addEventListener("click", () => {
			this.onResult(false);
			this.close();
		});

		const confirmBtn = buttonContainer.createEl("button", {
			cls: "mod-cta",
			text: "OK",
		});
		confirmBtn.addEventListener("click", () => {
			this.onResult(true);
			this.close();
		});
	}

	override onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
