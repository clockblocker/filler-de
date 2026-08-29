import {
	createObsidianEventLayer,
	type ObsidianEventLayer,
	type UserEventKind,
} from "@textfresser/obsidian-event-layer";
import {
	createVaultActionManager,
	SplitPathKind,
	type SplitPathToMdFile,
	splitPathCodec,
	type VamShutdownError,
	VaultActionKind,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { logError } from "@textfresser/vault-action-manager/issue-handlers";
import { Effect, Exit, Predicate } from "effect";
import { Modal, Notice, Plugin, TFile } from "obsidian";
import { Librarian } from "./commanders/librarian/librarian";
import { DelimiterChangeService } from "./commanders/librarian/runtime/delimiter-change-service";
import {
	DelimiterMigrationCoordinator,
	type DelimiterMigrationOutcome,
} from "./commanders/librarian/runtime/delimiter-migration-coordinator";
import { cleanupDictNote } from "./commanders/textfresser/common/cleanup/cleanup-dict-note";
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
import { OverlayManager } from "./managers/overlay-manager";
import { SettingsTab } from "./settings";
import { ApiService } from "./stateless-helpers/api-service";
import {
	DEFAULT_SETTINGS,
	type SuffixDelimiterConfig,
	type TextEaterSettings,
} from "./types";
import { buildCanonicalDelimiter } from "./utils/delimiter";
import { getErrorMessage } from "./utils/get-error-message";
import {
	decrementPending,
	incrementPending,
	whenIdle as whenIdleTracker,
} from "./utils/idle-tracker";
import { logger } from "./utils/logger";
import { sleep } from "./utils/sleep";

export default class TextEaterPlugin extends Plugin {
	settings: TextEaterSettings;
	apiService: ApiService;
	vam: VaultActionManager;
	vamTesting: VaultActionManager["testing"];
	userEventInterceptor: ObsidianEventLayer;
	overlayManager: OverlayManager | null = null;
	delimiterChangeService: DelimiterChangeService | null = null;

	// Commanders
	librarian: Librarian | null = null;
	textfresser: Textfresser | null = null;

	private commandExecutor: CommandExecutor | null = null;
	private disposeVam: Effect.Effect<void, VamShutdownError> | null = null;
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
					// Initialization itself exposes the service required by the test harness.
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

		const vaultActions = createVaultActionManager(this.app);
		this.vam = vaultActions.manager;
		this.vamTesting = vaultActions.testing;
		this.disposeVam = vaultActions.dispose;

		this.rebuildTextfresser();

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
					void Effect.runPromise(
						this.vam.dispatch([
							{
								kind: VaultActionKind.ProcessMdFile,
								payload: {
									// Safe cast: file.extension === "md" verified above
									splitPath: splitPathCodec.parse(
										file.path,
									) as SplitPathToMdFile,
									transform: () => cleaned,
								},
							},
						]),
					).catch((error) => {
						logger.error(
							"[TextEaterPlugin] Failed to clean dictionary note:",
							getErrorMessage(error),
						);
					});
				});
			}),
		);

		// Unified user event interceptor (clicks, clipboard, select-all, wikilinks)
		this.userEventInterceptor = createObsidianEventLayer({
			app: this.app,
			plugin: this,
			selectionTextSource: {
				getSelectionText: () => {
					const exit = Effect.runSyncExit(
						this.vam.getSelectionText(),
					);
					return Exit.isSuccess(exit) ? exit.value : null;
				},
			},
		});

		// New Librarian (healing modes)
		this.librarian = new Librarian(this.vam);

		// Start listening to file system events
		// VaultActionManager will convert events to VaultEvent, filter self-events,
		// and notify subscribers (e.g., Librarian)
		await Effect.runPromise(this.vam.startListening());

		// Start listening to user events (clicks, clipboard, select-all, wikilinks)
		this.userEventInterceptor.start();

		// Initialize delimiter change service (does not require librarian)
		this.delimiterChangeService = new DelimiterChangeService(this.vam);

		// Initialize librarian: read tree, heal mismatches, regenerate codexes
		if (this.librarian) {
			try {
				await Effect.runPromise(this.librarian.init());

				// Wire librarian corename lookup into Textfresser for propagation path resolution
				this.wireLibrarianLookup();

				// Register user event handlers after librarian is initialized
				const handlers = createHandlers(
					this.librarian,
					this.textfresser ?? undefined,
				);
				for (const handlerDef of handlers) {
					this.registerUserEventHandler(
						handlerDef.kind,
						handlerDef.handler,
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

		if (!this.textfresser) {
			throw new Error("Textfresser failed to initialize");
		}

		// Initialize command executor after librarian
		const executeCommand = createCommandExecutor({
			librarian: this.librarian,
			textfresser: this.textfresser,
			vam: this.vam,
		});
		this.commandExecutor = async (kind) => {
			incrementPending();
			try {
				await executeCommand(kind);
			} finally {
				decrementPending();
			}
		};

		// Initialize OverlayManager with commandExecutor
		this.overlayManager = new OverlayManager({
			app: this.app,
			commandExecutor: this.commandExecutor ?? undefined,
			librarian: this.librarian,
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
		if (this.userEventInterceptor) this.userEventInterceptor.stop();
		const librarian = this.librarian;
		this.librarian = null;
		const disposeVam = this.disposeVam;
		this.disposeVam = null;
		if (librarian || disposeVam) {
			const unsubscribe = librarian
				? librarian.unsubscribe().pipe(
						Effect.catch((error) =>
							Effect.sync(() => {
								logger.error(
									"[TextEaterPlugin] Failed to stop Librarian:",
									getErrorMessage(error),
								);
							}),
						),
					)
				: Effect.void;
			const shutdown = disposeVam
				? unsubscribe.pipe(Effect.andThen(disposeVam))
				: unsubscribe;
			void Effect.runPromise(shutdown).catch((error) => {
				logger.error(
					"[TextEaterPlugin] Failed to dispose VaultActionManager:",
					getErrorMessage(error),
				);
			});
		}
		// Clear global state
		clearState();
	}

	private async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

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
					if (!this.vam) return true;
					// Check if there's a selection via VAM
					const selection = Effect.runSyncExit(
						this.vam.getSelectionInfo(),
					);
					if (Exit.isSuccess(selection) && selection.value) {
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

	getLibrarianTestingApi() {
		return {
			handleCodexCheckboxClick: (
				payload: Parameters<Librarian["handleCodexCheckboxClick"]>[0],
			) => {
				if (!this.librarian) return Promise.resolve();
				return Effect.runPromise(
					this.librarian.handleCodexCheckboxClick(payload),
				);
			},
			librarian: this.librarian,
			splitPathCodec,
		};
	}

	/**
	 * E2E test hook: wait until all plugin async work is complete.
	 * Resolves when all queues are drained, pending tasks are done, and Obsidian has registered all actions.
	 */
	async whenIdle(): Promise<void> {
		return whenIdleTracker(() =>
			Effect.runPromise(this.vamTesting.whenSettled()),
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
		this.rebuildTextfresser();
		// Reinitialize librarian with new settings
		await this.reinitLibrarian();
	}

	async saveSettings() {
		const prev = this.previousSettings;
		const curr = this.settings;

		if (prev) {
			let delimiterLifecycleReinitialized = false;
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
			const lexicalGenerationChanged =
				prev.generateInflections !== curr.generateInflections ||
				prev.languages.known !== curr.languages.known ||
				prev.languages.target !== curr.languages.target;

			if (delimiterChanged) {
				const outcome = await this.handleDelimiterChange(
					prev.suffixDelimiter,
					curr.suffixDelimiter,
				);
				if (
					outcome.kind === "Cancelled" ||
					outcome.kind === "Failed" ||
					outcome.kind === "PartiallyFailed"
				) {
					this.settings.suffixDelimiter = { ...prev.suffixDelimiter };
					updateParsedSettings(this.settings);
					return;
				}
				delimiterLifecycleReinitialized =
					outcome.kind === "Completed" && !lexicalGenerationChanged;
			}

			if (
				(delimiterChanged ||
					depthChanged ||
					rootChanged ||
					backlinksChanged ||
					hideMetadataChanged ||
					lexicalGenerationChanged) &&
				!delimiterLifecycleReinitialized
			) {
				// Update global state BEFORE reinit so librarian uses new settings
				updateParsedSettings(this.settings);
				if (lexicalGenerationChanged) {
					this.rebuildTextfresser();
				}
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
	 * The coordinator owns planning, confirmation, dispatch, and restoration.
	 */
	private async handleDelimiterChange(
		oldConfig: SuffixDelimiterConfig,
		newConfig: SuffixDelimiterConfig,
	): Promise<DelimiterMigrationOutcome> {
		if (!this.delimiterChangeService || !this.librarian) {
			const cause = new Error(
				"DelimiterChangeService or Librarian not initialized",
			);
			return {
				failures: [],
				kind: "Failed",
				problem: {
					cause,
					operation: "delimiterMigration.initialize",
					stage: "Planning",
				},
			};
		}

		const libraryRoot = splitPathCodec.parse(this.settings.libraryRoot);
		if (libraryRoot.kind !== SplitPathKind.Folder) {
			const cause = new Error(
				`Library root "${this.settings.libraryRoot}" is not a folder path`,
			);
			return {
				failures: [],
				kind: "Failed",
				problem: {
					cause,
					operation: "delimiterMigration.parseLibraryRoot",
					stage: "Planning",
				},
			};
		}

		const oldDelimiter = buildCanonicalDelimiter(oldConfig);
		const newDelimiter = buildCanonicalDelimiter(newConfig);
		const librarianToPause = this.librarian;
		const coordinator = new DelimiterMigrationCoordinator(
			this.delimiterChangeService,
			{
				confirm: (plan) =>
					Effect.tryPromise({
						catch: (cause) => cause,
						try: () =>
							this.showConfirmDialog(
								"Rename files?",
								`Changing suffix delimiter from "${oldDelimiter}" to "${newDelimiter}" will rename ${plan.previewCount} file(s). Continue?`,
							),
					}),
				pause: () => librarianToPause.unsubscribe(),
				restore: (config, { currentAlreadyPaused }) =>
					Effect.tryPromise({
						catch: (cause) => cause,
						try: async () => {
							this.settings.suffixDelimiter = { ...config };
							updateParsedSettings(this.settings);
							await this.reinitLibrarian({
								propagateFailure: true,
								unsubscribeCurrent: !currentAlreadyPaused,
							});
						},
					}),
			},
		);
		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, libraryRoot),
		);

		switch (outcome.kind) {
			case "Completed":
				new Notice(`Renamed ${outcome.renamedCount} file(s)`);
				break;
			case "PartiallyFailed":
				new Notice(
					`Renamed ${outcome.renamedCount} file(s); ${outcome.failures.length} failed. Previous delimiter retained.`,
				);
				break;
			case "Failed":
				new Notice(
					"Delimiter change failed. Previous delimiter retained.",
				);
				break;
			case "Cancelled":
			case "NoOp":
				break;
		}

		if (outcome.kind === "PartiallyFailed" || outcome.kind === "Failed") {
			const actionFailures = outcome.failures
				.slice(0, 10)
				.map(
					(failure) =>
						`${failure.operation} ${failure.path}: ${getErrorMessage(failure.cause)}`,
				)
				.join(", ");
			logger.error(
				"[TextEaterPlugin] Delimiter migration did not complete:",
				outcome.kind === "Failed"
					? `${outcome.problem.stage}/${outcome.problem.operation}: ${describeDelimiterMigrationCause(outcome.problem.cause)}${actionFailures ? `; ${actionFailures}` : ""}`
					: actionFailures,
			);
		}

		return outcome;
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
	private async reinitLibrarian(
		options: {
			readonly propagateFailure?: boolean;
			readonly unsubscribeCurrent?: boolean;
		} = {},
	): Promise<void> {
		// Unregister old handlers
		for (const teardown of this.handlerTeardowns) {
			teardown();
		}
		this.handlerTeardowns = [];
		this.clearLibrarianLookup();

		if (this.librarian && options.unsubscribeCurrent !== false) {
			await Effect.runPromise(this.librarian.unsubscribe());
		}
		this.librarian = new Librarian(this.vam);
		try {
			await Effect.runPromise(this.librarian.init());
			this.wireLibrarianLookup();

			// Register new handlers
			const handlers = createHandlers(
				this.librarian,
				this.textfresser ?? undefined,
			);
			for (const handlerDef of handlers) {
				this.registerUserEventHandler(
					handlerDef.kind,
					handlerDef.handler,
				);
			}
		} catch (error) {
			this.clearLibrarianLookup();
			logger.error(
				"[TextEaterPlugin] Failed to reinitialize librarian:",
				getErrorMessage(error),
			);
			if (options.propagateFailure) throw error;
		}
	}

	private rebuildTextfresser(): void {
		this.textfresser = new Textfresser(
			this.vam,
			this.settings.languages,
			this.apiService,
			{
				generateInflections: this.settings.generateInflections,
			},
		);
	}

	private registerUserEventHandler(
		kind: UserEventKind,
		handler: unknown,
	): void {
		this.handlerTeardowns.push(
			this.userEventInterceptor.setHandler(
				kind as never,
				handler as never,
			),
		);
	}

	private wireLibrarianLookup(): void {
		if (!this.textfresser || !this.librarian) {
			return;
		}
		const lib = this.librarian;
		this.textfresser.setLibrarianResolvers({
			lookupInLibraryByCoreName: (name) =>
				lib.findMatchingLeavesByCoreName(name).map(
					(m): SplitPathToMdFile => ({
						basename: m.basename,
						extension: "md",
						kind: "MdFile",
						pathParts: m.pathParts,
					}),
				),
			parseLibraryBasename: (basename) =>
				lib.parseLibraryBasename(basename),
		});
	}

	private clearLibrarianLookup(): void {
		this.textfresser?.clearLibrarianLookup();
	}
}

function describeDelimiterMigrationCause(cause: unknown): string {
	if (!Array.isArray(cause)) return getErrorMessage(cause);
	return cause
		.map((item) => {
			const operation =
				Predicate.hasProperty(item, "operation") &&
				Predicate.isString(item.operation)
					? item.operation
					: "scan";
			const path =
				Predicate.hasProperty(item, "path") &&
				Predicate.isString(item.path)
					? ` ${item.path}`
					: "";
			const itemCause = Predicate.hasProperty(item, "cause")
				? item.cause
				: item;
			return `${operation}${path}: ${getErrorMessage(itemCause)}`;
		})
		.join(", ");
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
