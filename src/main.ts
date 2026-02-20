import { Modal, Notice, Plugin, TFile } from "obsidian";
import { DelimiterChangeService } from "./commanders/librarian/delimiter-change-service";
import { Librarian } from "./commanders/librarian/librarian";
import { cleanupDictNote } from "./commanders/textfresser/common/cleanup/cleanup-dict-note";
import { buildClosedSetSurfaceHubBackfillActions } from "./commanders/textfresser/common/closed-set-surface-hub";
import { DICT_ENTRY_NOTE_KIND } from "./commanders/textfresser/common/metadata";
import { Textfresser } from "./commanders/textfresser/textfresser";
import {
	clearState,
	initializeState,
	updateParsedSettings,
} from "./global-state/global-state";
import {
	createHandlers,
	tagLineCopyEmbedBehavior,
} from "./managers/obsidian/behavior-manager";
import {
	type CommandExecutor,
	CommandKind,
	createCommandExecutor,
} from "./managers/obsidian/command-executor";
import { UserEventInterceptor } from "./managers/obsidian/user-event-interceptor";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
	VaultActionKind,
	VaultActionManagerImpl,
} from "./managers/obsidian/vault-action-manager";
import { ActiveFileService } from "./managers/obsidian/vault-action-manager/file-services/active-view/active-file-service";
import { TFileHelper } from "./managers/obsidian/vault-action-manager/file-services/background/helpers/tfile-helper";
import { TFolderHelper } from "./managers/obsidian/vault-action-manager/file-services/background/helpers/tfolder-helper";
import { logError } from "./managers/obsidian/vault-action-manager/helpers/issue-handlers";
import { pathfinder } from "./managers/obsidian/vault-action-manager/helpers/pathfinder";
import { VaultReader } from "./managers/obsidian/vault-action-manager/impl/vault-reader";
import type { SplitPathToMdFile } from "./managers/obsidian/vault-action-manager/types/split-path";
import { OverlayManager } from "./managers/overlay-manager";
import { SettingsTab } from "./settings";
import { ApiService } from "./stateless-helpers/api-service";
import { getMdFilesInLibrary } from "./stateless-helpers/library-files";
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
import { getErrorMessage } from "./utils/get-error-message";
import { whenIdle as whenIdleTracker } from "./utils/idle-tracker";
import { logger } from "./utils/logger";
import { sleep } from "./utils/sleep";

export default class TextEaterPlugin extends Plugin {
	settings: TextEaterSettings;
	apiService: ApiService;
	testingActiveFileService: ActiveFileService;
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
						await sleep(100);
					}
					// Tests access APIs via: app.plugins.plugins["cbcr-text-eater-de"]?.getHelpersTestingApi?.()
				},
				id: "textfresser-testing-expose-opened-service",
				name: "Testing: expose opened file service",
			});
		} catch (error) {
			logError({
				description: `Error during plugin onload: ${getErrorMessage(error)}`,
				location: "TextEaterPlugin",
			});
		}
	}

	private async initWhenObsidianIsReady() {
		try {
			await this.whenLayoutReady();
			await this.whenMetadataResolved();

			await sleep(300);

			await this.loadPlugin();
			this.initialized = true;
		} catch (error) {
			logError({
				description: `Error during plugin initialization: ${getErrorMessage(error)}`,
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
			// Already resolved — nothing to wait for
			if (this.hasUsableMetadataSignal()) {
				resolve();
				return;
			}

			const onResolved = () => {
				this.app.metadataCache.off("resolved", onResolved);
				resolve();
			};
			this.app.metadataCache.on("resolved", onResolved);
		});
	}

	private hasUsableMetadataSignal(): boolean {
		return !!this.app.vault.getRoot();
	}

	async loadPlugin() {
		await this.loadSettings();
		await this.addCommands();

		this.apiService = new ApiService(this.settings);

		this.testingActiveFileService = new ActiveFileService(this.app);
		this.testingTFileHelper = new TFileHelper({
			fileManager: this.app.fileManager,
			vault: this.app.vault,
		});
		this.testingTFolderHelper = new TFolderHelper({
			fileManager: this.app.fileManager,
			vault: this.app.vault,
		});
		this.testingReader = new VaultReader(
			this.testingActiveFileService,
			this.testingTFileHelper,
			this.testingTFolderHelper,
			this.app.vault,
		);
		this.vam = new VaultActionManagerImpl(this.app);

		// Textfresser commander (vocabulary commands orchestrator)
		this.textfresser = new Textfresser(
			this.vam,
			this.settings.languages,
			this.apiService,
		);

		// Dict note cleanup on file open (reorder entries, normalize attestation spacing)
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				if (!(file instanceof TFile) || file.extension !== "md") return;
				void this.app.vault.read(file).then((content) => {
					if (
						!content.includes(
							`"noteKind":"${DICT_ENTRY_NOTE_KIND}"`,
						)
					) {
						// Also check YAML frontmatter style
						if (
							!content.includes(
								`noteKind: ${DICT_ENTRY_NOTE_KIND}`,
							)
						) {
							return;
						}
					}
					const cleaned = cleanupDictNote(content);
					if (cleaned === null) return;
					void this.vam.dispatch([
						{
							kind: VaultActionKind.ProcessMdFile,
							payload: {
								// Safe cast: file.extension === "md" verified above
								splitPath: makeSplitPath(
									file,
								) as SplitPathToMdFile,
								transform: () => cleaned,
							},
						},
					]);
				});
			}),
		);

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

				// Wire librarian corename lookup into Textfresser for propagation path resolution
				this.wireLibrarianLookup();

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
				this.clearLibrarianLookup();
				logger.error(
					"[TextEaterPlugin] Failed to initialize librarian:",
					getErrorMessage(error),
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
			editorCheckCallback: (checking: boolean) => {
				if (!checking) {
					void this.commandExecutor?.(CommandKind.Lemma);
				}
				return true;
			},
			id: "lemma",
			name: "Classify word (Lemma)",
		});

		this.addCommand({
			editorCheckCallback: (checking: boolean) => {
				if (!checking) {
					void this.commandExecutor?.(CommandKind.Generate);
				}
				return true;
			},
			id: "new-gen-command",
			name: "Generate dictionary entry",
		});

		this.addCommand({
			callback: () => {
				void this.rebuildClosedSetSurfaceHubs();
			},
			id: "rebuild-closed-set-surface-hubs",
			name: "Rebuild closed-set surface hubs",
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

	private async rebuildClosedSetSurfaceHubs(): Promise<void> {
		if (!this.textfresser) {
			new Notice("Textfresser is not initialized");
			return;
		}
		if (!this.textfresser.getState().isLibraryLookupAvailable) {
			logger.warn(
				"[TextEaterPlugin.rebuildClosedSetSurfaceHubs] Library lookup is unavailable; aborting to avoid destructive backfill",
			);
			new Notice(
				"Closed-set hub rebuild is unavailable until Librarian lookup is ready",
			);
			return;
		}

		logger.info(
			"[TextEaterPlugin.rebuildClosedSetSurfaceHubs] Starting rebuild",
		);
		new Notice("Rebuilding closed-set hubs...");

		const result = await buildClosedSetSurfaceHubBackfillActions({
			lookupInLibrary: this.textfresser.getState().lookupInLibrary,
			targetLanguage: this.textfresser.getState().languages.target,
			vam: this.vam,
		});
		if (result.isErr()) {
			logger.warn(
				"[TextEaterPlugin.rebuildClosedSetSurfaceHubs] Failed to build actions:",
				result.error,
			);
			new Notice(`Failed to rebuild closed-set hubs: ${result.error}`);
			return;
		}

		if (result.value.length === 0) {
			new Notice("Closed-set hubs are already up to date");
			return;
		}

		const dispatchResult = await this.vam.dispatch(result.value);
		if (dispatchResult.isErr()) {
			logger.warn(
				"[TextEaterPlugin.rebuildClosedSetSurfaceHubs] Failed to dispatch actions:",
				dispatchResult.error,
			);
			new Notice("Failed to rebuild closed-set hubs");
			return;
		}

		new Notice(`Updated closed-set hubs (${result.value.length} actions)`);
	}

	getActiveFileServiceTestingApi() {
		return {
			activeFileService: this.testingActiveFileService,
			makeSplitPath,
			makeSystemPathForSplitPath,
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
		await sleep(100);
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
		const mdFiles = getMdFilesInLibrary(this.app.vault, libraryRoot);

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
		this.clearLibrarianLookup();

		if (this.librarian) {
			await this.librarian.unsubscribe();
		}
		this.librarian = new Librarian(this.vam);
		try {
			await this.librarian.init();
			this.wireLibrarianLookup();

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
			this.clearLibrarianLookup();
			logger.error(
				"[TextEaterPlugin] Failed to reinitialize librarian:",
				getErrorMessage(error),
			);
		}
	}

	private wireLibrarianLookup(): void {
		if (!this.textfresser || !this.librarian) {
			return;
		}
		const lib = this.librarian;
		this.textfresser.setLibrarianLookup((name) =>
			lib.findMatchingLeavesByCoreName(name).map(
				(m): SplitPathToMdFile => ({
					basename: m.basename,
					extension: "md",
					kind: "MdFile",
					pathParts: m.pathParts,
				}),
			),
		);
	}

	private clearLibrarianLookup(): void {
		this.textfresser?.clearLibrarianLookup();
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
