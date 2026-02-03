import { Modal, Notice, Plugin } from "obsidian";
import { DelimiterChangeService } from "./commanders/librarian/delimiter-change-service";
import { Librarian } from "./commanders/librarian/librarian";
import { Textfresser } from "./commanders/textfresser/textfresser";
import {
	clearState,
	initializeState,
	updateParsedSettings,
} from "./global-state/global-state";
import { createHandlers } from "./managers/actions-manager/behaviors";
import { tagLineCopyEmbedBehavior } from "./managers/actions-manager/behaviors/tag-line-copy-embed-behavior";
import {
	type CommandExecutor,
	createCommandExecutor,
} from "./managers/actions-manager/create-command-executor";
import { CommandKind } from "./managers/actions-manager/types";
import { UserEventInterceptor } from "./managers/obsidian/user-event-interceptor";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
	VaultActionManagerImpl,
} from "./managers/obsidian/vault-action-manager";
import { OpenedFileService } from "./managers/obsidian/vault-action-manager/file-services/active-view/opened-file-service";
import { TFileHelper } from "./managers/obsidian/vault-action-manager/file-services/background/helpers/tfile-helper";
import { TFolderHelper } from "./managers/obsidian/vault-action-manager/file-services/background/helpers/tfolder-helper";
import { logError } from "./managers/obsidian/vault-action-manager/helpers/issue-handlers";
import { pathfinder } from "./managers/obsidian/vault-action-manager/helpers/pathfinder";
import { VaultReader } from "./managers/obsidian/vault-action-manager/impl/vault-reader";
import { OverlayManager } from "./managers/overlay-manager";
import { SettingsTab } from "./settings";
import { ApiService } from "./stateless-helpers/api-service";
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
	testingOpenedFileServiceWithResult: OpenedFileService;
	testingReader: VaultReader;
	testingTFileHelper: TFileHelper;
	testingTFolderHelper: TFolderHelper;
	vam: VaultActionManagerImpl;
	userEventInterceptor: UserEventInterceptor;
	overlayManager: OverlayManager | null = null;
	delimiterChangeService: DelimiterChangeService | null = null;

	// Commanders
	librarian: Librarian | null = null;
	textfresser: Textfresser | null = null;

	private commandExecutor: CommandExecutor | null = null;
	private initialized = false;
	private previousSettings: TextEaterSettings | null = null;
	private handlerTeardowns: (() => void)[] = [];

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

		this.testingOpenedFileServiceWithResult = new OpenedFileService(
			this.app,
		);
		this.testingTFileHelper = new TFileHelper({
			fileManager: this.app.fileManager,
			vault: this.app.vault,
		});
		this.testingTFolderHelper = new TFolderHelper({
			fileManager: this.app.fileManager,
			vault: this.app.vault,
		});
		this.testingReader = new VaultReader(
			this.testingOpenedFileServiceWithResult,
			this.testingTFileHelper,
			this.testingTFolderHelper,
			this.app.vault,
		);
		this.vam = new VaultActionManagerImpl(this.app);

		// Textfresser commander (vocabulary commands orchestrator)
		this.textfresser = new Textfresser(this.vam, this.settings.languages);

		// Unified user event interceptor (clicks, clipboard, select-all, wikilinks)
		this.userEventInterceptor = new UserEventInterceptor(
			this.app,
			this,
			this.vam,
		);

		// New Librarian (healing modes)
		this.librarian = new Librarian(this.vam);

		// Start listening to file system events
		// VaultActionManager will convert events to VaultEvent, filter self-events,
		// and notify subscribers (e.g., Librarian)
		this.vam.startListening();

		// Start listening to user events (clicks, clipboard, select-all, wikilinks)
		this.userEventInterceptor.startListening();

		// Initialize delimiter change service (does not require librarian)
		this.delimiterChangeService = new DelimiterChangeService(
			this.app,
			this.vam,
		);

		// Initialize librarian: read tree, heal mismatches, regenerate codexes
		if (this.librarian) {
			try {
				await this.librarian.init();

				// Register user event handlers after librarian is initialized
				const handlers = createHandlers(
					this.librarian,
					this.textfresser ?? undefined,
				);
				for (const { kind, handler } of handlers) {
					this.handlerTeardowns.push(
						this.userEventInterceptor.setHandler(kind, handler),
					);
				}
			} catch (error) {
				logger.error(
					"[TextEaterPlugin] Failed to initialize librarian:",
					error instanceof Error ? error.message : String(error),
				);
			}
		}

		// Initialize command executor after librarian
		this.commandExecutor = createCommandExecutor({
			librarian: this.librarian,
			textfresser: this.textfresser,
			vam: this.vam,
		});

		// Initialize OverlayManager with commandExecutor
		this.overlayManager = new OverlayManager({
			app: this.app,
			commandExecutor: this.commandExecutor ?? undefined,
			plugin: this,
			userEventInterceptor: this.userEventInterceptor,
			vam: this.vam,
		});
		this.overlayManager.init();
	}

	override onunload() {
		// Destroy overlay manager
		if (this.overlayManager) {
			this.overlayManager.destroy();
			this.overlayManager = null;
		}
		// Unregister all user event handlers
		for (const teardown of this.handlerTeardowns) {
			teardown();
		}
		this.handlerTeardowns = [];
		if (this.userEventInterceptor)
			this.userEventInterceptor.stopListening();
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
			editorCheckCallback: () => {
				return false;
			},
			id: "fill-template",
			name: "Generate a dictionary entry for the word in the title of the file",
		});

		this.addCommand({
			editorCheckCallback: () => {
				return false;
			},
			id: "duplicate-selection",
			name: "Add links to normal/inf forms to selected text",
		});

		this.addCommand({
			editorCheckCallback: (checking: boolean) => {
				if (!checking) {
					// Selection is collected by CommandContext in executor
					void this.commandExecutor?.(CommandKind.TranslateSelection);
				}
				return true;
			},
			id: "translate-selection",
			name: "Translate selected text",
		});

		this.addCommand({
			editorCheckCallback: (checking: boolean) => {
				if (!checking) {
					// Check if there's a selection via VAM
					const selection = this.vam?.selection.getInfo();
					if (selection) {
						// Selection is collected by CommandContext in executor
						void this.commandExecutor?.(CommandKind.SplitInBlocks);
					} else {
						tagLineCopyEmbedBehavior({
							app: this.app,
							vam: this.vam,
						});
					}
				}
				return true;
			},
			id: "split-selection-in-blocks",
			name: "Split selected text in blocks",
		});

		this.addCommand({
			editorCheckCallback: () => {
				// TODO: insertReplyFromKeymaker - command handles selection internally
				return false;
			},
			id: "check-ru-de-translation",
			name: "Keymaker",
		});

		this.addCommand({
			editorCheckCallback: () => {
				// TODO: librarian.ls - command handles selection internally
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
					void this.commandExecutor?.(CommandKind.SplitToPages);
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
			manager: this.vam,
		};
	}

	getLibrarianTestingApi() {
		return {
			librarian: new Librarian(this.vam),
			makeSplitPath,
		};
	}

	getHelpersTestingApi() {
		return {
			splitPath: pathfinder.splitPathFromSystemPath,
			tfileHelper: this.testingTFileHelper,
			tfolderHelper: this.testingTFolderHelper,
		};
	}

	/**
	 * E2E test hook: wait until all plugin async work is complete.
	 * Resolves when all queues are drained, pending tasks are done, and Obsidian has registered all actions.
	 */
	async whenIdle(): Promise<void> {
		return whenIdleTracker(() => this.vam.waitForObsidianEvents());
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

			// Check if placement settings changed
			const placementChanged =
				prev.translatePlacement !== curr.translatePlacement ||
				prev.splitInBlocksPlacement !== curr.splitInBlocksPlacement ||
				prev.explainGrammarPlacement !== curr.explainGrammarPlacement ||
				prev.generatePlacement !== curr.generatePlacement;

			if (placementChanged) {
				this.overlayManager?.refreshToolbars();
			}
		}

		await this.saveData(this.settings);
		// Allow file system to flush before any potential reload
		await new Promise((resolve) => setTimeout(resolve, 100));
		this.previousSettings = {
			...this.settings,
			suffixDelimiter: { ...this.settings.suffixDelimiter },
		};
		updateParsedSettings(this.settings);
	}

	/**
	 * Handle delimiter change by renaming files with suffixes.
	 * Uses DelimiterChangeService for safe bulk operations with proper event synchronization.
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

		// Get all .md files in library for counting
		const libraryRoot = this.settings.libraryRoot;
		const rootFolder = this.app.vault.getAbstractFileByPath(libraryRoot);
		if (!rootFolder) {
			new Notice(`Library folder "${libraryRoot}" not found`);
			return false;
		}

		// Count files that will be affected
		const mdFiles = this.app.vault.getFiles().filter((f) => {
			return (
				f.path.startsWith(`${libraryRoot}/`) && f.path.endsWith(".md")
			);
		});

		const filesToRename = mdFiles.filter((f) =>
			oldPattern.test(f.basename),
		);

		const newPattern = buildFlexibleDelimiterPattern(newConfig);
		const filesNeedingEscape = mdFiles.filter((f) =>
			newPattern.test(f.basename),
		);

		const totalAffected = new Set([
			...filesToRename.map((f) => f.path),
			...filesNeedingEscape.map((f) => f.path),
		]).size;

		if (totalAffected === 0) {
			return true;
		}

		// Show confirmation dialog
		const confirmed = await this.showConfirmDialog(
			"Rename files?",
			`Changing suffix delimiter from "${oldDelim}" to "${newDelim}" will rename ${totalAffected} file(s). Continue?`,
		);

		if (!confirmed) return false;

		// Use DelimiterChangeService for safe bulk operations
		if (!this.delimiterChangeService || !this.librarian) {
			logger.error(
				"[TextEaterPlugin] DelimiterChangeService or Librarian not initialized",
			);
			return false;
		}

		const result = await this.delimiterChangeService.changeDelimiter(
			oldConfig,
			newConfig,
			libraryRoot,
			this.librarian,
		);

		new Notice(`Renamed ${result.renamedCount} file(s)`);

		if (result.errors.length > 0) {
			logger.error(
				"[TextEaterPlugin] Delimiter change errors:",
				result.errors.slice(0, 10).join(", "),
			);
		}

		return result.success;
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
		// Unregister old handlers
		for (const teardown of this.handlerTeardowns) {
			teardown();
		}
		this.handlerTeardowns = [];

		if (this.librarian) {
			await this.librarian.unsubscribe();
		}
		this.librarian = new Librarian(this.vam);
		try {
			await this.librarian.init();

			// Register new handlers
			const handlers = createHandlers(
				this.librarian,
				this.textfresser ?? undefined,
			);
			for (const { kind, handler } of handlers) {
				this.handlerTeardowns.push(
					this.userEventInterceptor.setHandler(kind, handler),
				);
			}
		} catch (error) {
			logger.error(
				"[TextEaterPlugin] Failed to reinitialize librarian:",
				error instanceof Error ? error.message : String(error),
			);
		}
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
