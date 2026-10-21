import {
	CrossroadNoteMetadata,
	type DumdictVaultStore,
	makeDumdictVaultStore,
	WORTER_SPLIT_PATH,
} from "@textfresser/dictionary";
import {
	createObsidianEventLayer,
	type ObsidianEventLayer,
	type UserEventKind,
} from "@textfresser/obsidian-event-layer";
import {
	createVaultActionManager,
	SplitPathKind,
	splitPathCodec,
	type VamShutdownError,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { logError } from "@textfresser/vault-action-manager/issue-handlers";
import { Cause, Effect, Exit, Predicate } from "effect";
import { Modal, Notice, Plugin, requestUrl } from "obsidian";
import {
	ClassifyCommander,
	createKnowledgeQueue,
	createReadingReopener,
	createScrollActivity,
	createUnlinkObserver,
	DUMGEN_SEGMENTER_VERSION,
	dumgenUnitResolver,
	filesSegmentationCache,
	type KnowledgeQueue,
	observeScrollModifications,
	produceKnowledge,
	UnitResolverError,
	type UnlinkObserver,
	vamScrollFiles,
	vamUnlinkScrolls,
} from "./commanders/classify";
import {
	CANCEL_RESET_COMMAND_NAME,
	DictionaryResetCommand,
	RESET_COMMAND_NAME,
} from "./commanders/dictionary-reset/reset-command";
import { Librarian } from "./commanders/librarian/librarian";
import { DelimiterChangeService } from "./commanders/librarian/runtime/delimiter-change-service";
import {
	DelimiterMigrationCoordinator,
	type DelimiterMigrationOutcome,
} from "./commanders/librarian/runtime/delimiter-migration-coordinator";
import {
	describeMetadataMigration,
	migrateMetadataFormat,
} from "./commanders/note-metadata-migration/migrate-metadata-format";
import { Textfresser } from "./commanders/textfresser/textfresser";
import {
	clearState,
	getParsedUserSettings,
	initializeState,
	updateParsedSettings,
} from "./global-state/global-state";
import { createRequestUrlFetch, DumgenHost } from "./managers/dumgen";
import type { ScriptedDumgen } from "./managers/dumgen/dumgen-host";
import type { ScriptedJevAnswers } from "./managers/dumgen/scripted-jev";
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
import {
	holdsRetiredSettings,
	settingsFromStoredData,
} from "./settings/stored-settings";
import { dictionaryProjections } from "./stateless-helpers/dictionary-projections";
import {
	LemmaNoteMetadata,
	LibraryMetadata,
	type MetadataFormat,
	ReadingNoteMetadata,
} from "./stateless-helpers/note-metadata";
import type { SuffixDelimiterConfig, TextEaterSettings } from "./types";
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
	/**
	 * The plugin's one dumgen instance: `this.dumgen.get()`. It is built on
	 * first use from the TypeSafe and OpenAI keys in the settings, rebuilt
	 * when a key changes, and disposed on unload. Its calls go through
	 * `requestUrl` (see `managers/dumgen/request-url-fetch.ts`).
	 */
	readonly dumgen = new DumgenHost({
		fetch: createRequestUrlFetch(requestUrl),
		keys: () => ({
			openaiApiKey: this.settings?.openaiApiKey ?? "",
			typesafeApiKey: this.settings?.typesafeApiKey ?? "",
		}),
	});
	vam: VaultActionManager;
	vamTesting: VaultActionManager["testing"];
	userEventInterceptor: ObsidianEventLayer;
	overlayManager: OverlayManager | null = null;
	delimiterChangeService: DelimiterChangeService | null = null;

	// Commanders
	classify: ClassifyCommander | null = null;
	/** Classify's background Knowledge runs, one per Reading (#64). */
	knowledgeQueue: KnowledgeQueue | null = null;
	/** Removes the occurrences whose links the user deletes from a Scroll (#116). */
	private unlinkObserver: UnlinkObserver | null = null;
	private stopObservingScrolls: Effect.Effect<void> | null = null;
	/** Reopens a clicked Reading note once its Knowledge lands (#116). */
	private reopenReading: ((target: string) => Promise<boolean>) | null = null;
	/** "Reset dictionary from old notes…" (#65). */
	private dictionaryReset: DictionaryResetCommand | null = null;
	/** The dictionary store over `Worter/`, built once VAM exists. */
	private dictionary: Promise<DumdictVaultStore> | null = null;
	private unloaded = false;
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

		const vaultActions = createVaultActionManager(this.app);
		this.vam = vaultActions.manager;
		this.vamTesting = vaultActions.testing;
		this.disposeVam = vaultActions.dispose;

		this.rebuildTextfresser();
		void this.dictionaryStore().catch(() => undefined);
		const dictionary = Effect.tryPromise({
			catch: (cause) =>
				new UnitResolverError({
					cause,
					message: `the dictionary could not be read: ${getErrorMessage(cause)}`,
				}),
			try: () => this.dictionaryStore(),
		});
		const dumgen = Effect.try({
			catch: (cause) =>
				new UnitResolverError({
					cause,
					message: `dumgen is unavailable: ${getErrorMessage(cause)}`,
				}),
			try: () => this.dumgen.get(),
		});
		const knowledgeQueue = createKnowledgeQueue({
			notify: (message) => new Notice(message),
			onEnd: decrementPending,
			onStart: incrementPending,
			run: (job) =>
				Effect.all([dumgen, dictionary]).pipe(
					Effect.flatMap(([instance, store]) =>
						produceKnowledge(
							{
								dumgen: instance,
								store,
								translationLanguages:
									this.settings.languages.known === "Russian"
										? ["en", "ru"]
										: ["en"],
							},
							job,
						),
					),
				),
		});
		this.knowledgeQueue = knowledgeQueue;
		this.reopenReading = createReadingReopener({
			activePath: async () => {
				const exit = await Effect.runPromiseExit(this.vam.mdPwd());
				return Exit.isSuccess(exit) && exit.value
					? splitPathCodec.format(exit.value)
					: null;
			},
			open: async (path) => {
				const splitPath = splitPathCodec.parse(path);
				if (splitPath.kind !== SplitPathKind.MdFile) return;
				await Effect.runPromise(this.vam.cd(splitPath));
			},
			queue: knowledgeQueue,
		});
		const segmentationCache = filesSegmentationCache(
			this.app.vault.adapter,
		);
		const segmenterVersion = () => {
			const scripted = this.dumgen.scriptedJevTag();
			return scripted
				? `${DUMGEN_SEGMENTER_VERSION}+scripted-${scripted}`
				: DUMGEN_SEGMENTER_VERSION;
		};
		const scrollActivity = createScrollActivity();
		const resetRunning = () =>
			this.dictionaryReset?.isRunning()
				? "A dictionary reset is running; Classify once it has ended."
				: undefined;
		this.classify = new ClassifyCommander({
			blockedBy: resetRunning,
			cache: segmentationCache,
			dumgen: () => this.dumgen.get(),
			missingProviderKeys: () => this.dumgen.missingKeys(),
			resolver: dumgenUnitResolver({
				activity: scrollActivity,
				dumgen,
				knowledge: knowledgeQueue,
				notify: (message) => new Notice(message),
				scroll: vamScrollFiles(this.vam),
				store: dictionary,
			}),
			segmenterVersion,
		});
		this.unlinkObserver = createUnlinkObserver({
			activity: scrollActivity,
			blockedBy: resetRunning,
			cache: segmentationCache,
			notify: (message) => new Notice(message),
			onEnd: decrementPending,
			onStart: incrementPending,
			scrolls: vamUnlinkScrolls(this.vam),
			segmenterVersion,
			store: dictionary,
		});
		this.dictionaryReset = new DictionaryResetCommand({
			activity: scrollActivity,
			app: this.app,
			cache: segmentationCache,
			dumgen: () => this.dumgen.get(),
			knowledge: knowledgeQueue,
			missingProviderKeys: () => this.dumgen.missingKeys(),
			segmenterVersion,
			store: () => this.dictionaryStore(),
			vam: this.vam,
		});

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
		this.stopObservingScrolls = await Effect.runPromise(
			observeScrollModifications(this.vam, this.unlinkObserver),
		);

		// Start listening to user events (clicks, clipboard, select-all, wikilinks)
		this.userEventInterceptor.start();

		// Initialize delimiter change service (does not require librarian)
		this.delimiterChangeService = new DelimiterChangeService(this.vam);

		// Initialize librarian: read tree, heal mismatches, regenerate codexes
		if (this.librarian) {
			try {
				await Effect.runPromise(this.librarian.init());

				// Register user event handlers after librarian is initialized
				const handlers = createHandlers(
					this.librarian,
					this.onWikilinkClicked,
				);
				for (const handlerDef of handlers) {
					this.registerUserEventHandler(
						handlerDef.kind,
						handlerDef.handler,
					);
				}
			} catch (error) {
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
		this.commandExecutor = async (kind) => {
			incrementPending();
			try {
				const classify = this.classify;
				const librarian = this.librarian;
				const textfresser = this.textfresser;
				if (!classify || !librarian || !textfresser) return;
				await createCommandExecutor({
					classify,
					librarian,
					textfresser,
					vam: this.vam,
				})(kind);
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
		this.unloaded = true;
		this.dictionaryReset?.cancel();
		this.dictionaryReset = null;
		this.knowledgeQueue?.close();
		this.knowledgeQueue = null;
		this.reopenReading = null;
		this.unlinkObserver?.close();
		this.unlinkObserver = null;
		const stopObservingScrolls = this.stopObservingScrolls;
		this.stopObservingScrolls = null;
		if (stopObservingScrolls)
			void Effect.runPromise(stopObservingScrolls).catch(() => undefined);
		this.dumgen.dispose();
		const dictionary = this.dictionary;
		this.dictionary = null;
		void dictionary
			?.then((store) => Effect.runPromise(store.close))
			.catch(() => undefined);
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
		const stored: unknown = await this.loadData();
		this.settings = settingsFromStoredData(stored);
		// Drop the retired keys, the Gemini key among them, from data.json now.
		if (holdsRetiredSettings(stored)) await this.saveData(this.settings);

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
					void this.commandExecutor?.(CommandKind.Classify);
				}
				return true;
			},
			id: "classify-selection",
			name: "Classify selection",
		});

		this.addCommand({
			callback: () => {
				const cancelled = this.knowledgeQueue?.cancelAll() ?? 0;
				new Notice(
					cancelled > 0
						? `Cancelled Knowledge generation for ${cancelled} Reading${cancelled === 1 ? "" : "s"}`
						: "No Knowledge generation is running",
				);
			},
			id: "cancel-knowledge-generation",
			name: "Cancel background Knowledge generation",
		});

		this.addCommand({
			callback: () => {
				if (this.dictionaryReset) this.dictionaryReset.open();
				else new Notice("Textfresser is still loading");
			},
			id: "reset-dictionary-from-old-notes",
			name: RESET_COMMAND_NAME,
		});

		this.addCommand({
			callback: () => {
				new Notice(
					this.dictionaryReset?.cancel()
						? "Cancelling the dictionary reset after its current step"
						: "No dictionary reset is running",
				);
			},
			id: "cancel-dictionary-reset",
			name: CANCEL_RESET_COMMAND_NAME,
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
			getActiveSelection: () =>
				Effect.runPromise(this.vam.getSelectionInfo()).then(
					(selection) => selection?.text ?? null,
				),
			handleCodexCheckboxClick: (
				payload: Parameters<Librarian["handleCodexCheckboxClick"]>[0],
			) => {
				if (!this.librarian) return Promise.resolve();
				return Effect.runPromise(
					this.librarian.handleCodexCheckboxClick(payload),
				);
			},
			librarian: this.librarian,
			runPageNavigation: (direction: "next" | "prev") => {
				const command =
					direction === "next"
						? CommandKind.GoToNextPage
						: CommandKind.GoToPrevPage;
				return this.commandExecutor?.(command) ?? Promise.resolve();
			},
			runSplitInBlocks: async () => {
				if (!this.librarian) return;
				const active = await Effect.runPromise(
					this.vam.getActiveEditorContext(),
				);
				await Effect.runPromise(
					this.librarian.executeCommand(
						CommandKind.SplitInBlocks,
						{
							activeFile: active
								? {
										content: active.content,
										splitPath: active.splitPath,
									}
								: null,
							selection: active?.selection ?? null,
						},
						() => undefined,
					),
				);
			},
			splitPathCodec,
		};
	}

	/**
	 * E2E test hooks for Classify: what its last run handed to the resolver
	 * port and resolved, a scripted dumgen so a scenario never reaches a
	 * provider, and how many requests that script answered.
	 */
	getClassifyTestingApi() {
		return {
			dumgenRequests: () => this.dumgen.scriptedRequests() ?? null,
			latestHandoff: () => this.classify?.latestHandoff() ?? null,
			useScriptedDumgen: (script: ScriptedDumgen | null) =>
				this.dumgen.useScriptedDumgenForTesting(script),
			useScriptedJev: (answers: ScriptedJevAnswers | null) =>
				this.dumgen.useScriptedJevForTesting(answers),
		};
	}

	/**
	 * E2E test hooks for the "Reset dictionary from old notes…" command: what
	 * its last opening showed, and closing its modal without clicking in it.
	 */
	getDictionaryResetTestingApi() {
		return {
			closeModal: () => this.dictionaryReset?.closeModal(),
			lastOpening: () => this.dictionaryReset?.lastOpening() ?? null,
		};
	}

	/**
	 * The dictionary store, built on first use; a build that failed, such as
	 * a scan of `Worter/` that could not finish, is tried again next time.
	 */
	private dictionaryStore(): Promise<DumdictVaultStore> {
		if (this.unloaded)
			return Promise.reject(new Error("the plugin has unloaded"));
		if (this.dictionary) return this.dictionary;
		const building = Effect.runPromise(
			makeDumdictVaultStore({
				metadataFormat: () =>
					getParsedUserSettings().hideMetadata
						? "Hidden"
						: "Frontmatter",
				onDiagnostics: (diagnostics) => {
					if (diagnostics.quarantined.length > 0)
						logger.warn(
							"[TextEaterPlugin] Dictionary notes the store cannot read:",
							diagnostics.quarantined
								.map(({ path }) => path)
								.join(", "),
						);
				},
				onTablesRerendered: ({ lemmas, notes, remaining }) => {
					logger.info(
						`[TextEaterPlugin] Re-rendered the inflection tables of ${lemmas} Lemma notes for the current language pack (${notes} notes written${remaining > 0 ? `, ${remaining} left for the next scan` : ""})`,
					);
				},
				projections: dictionaryProjections,
				vault: this.vam,
			}),
		);
		this.dictionary = building;
		building.catch((error) => {
			if (this.dictionary === building) this.dictionary = null;
			logger.error(
				"[TextEaterPlugin] Failed to build the dictionary store:",
				getErrorMessage(error),
			);
		});
		return building;
	}

	/** A clicked Reading link reopens its note once its Knowledge lands. */
	private readonly onWikilinkClicked = (target: string): void => {
		const reopen = this.reopenReading;
		if (!reopen) return;
		void reopen(target).catch((error) => {
			logger.warn(
				"[TextEaterPlugin] Could not reopen the Reading note:",
				getErrorMessage(error),
			);
		});
	};

	/**
	 * E2E test hook: records VAM's Markdown modify observations below one
	 * vault folder until closed. Paths are vault-relative system paths.
	 */
	async observeMdModificationsForTesting(folderPath: string): Promise<{
		readonly close: () => Promise<void>;
		readonly read: () => readonly {
			readonly mtime: number;
			readonly path: string;
			readonly size: number;
		}[];
	}> {
		const folder = splitPathCodec.parse(folderPath);
		if (folder.kind !== SplitPathKind.Folder) {
			throw new Error(`Expected a folder path, got '${folderPath}'`);
		}
		const observed: { mtime: number; path: string; size: number }[] = [];
		const subscription = await Effect.runPromise(
			this.vam.subscribeToMdModifications(folder, (event) =>
				Effect.sync(() => {
					for (const { splitPath, stat } of event.modifications) {
						observed.push({
							mtime: stat.mtime,
							path: splitPathCodec.format(splitPath),
							size: stat.size,
						});
					}
				}),
			),
		);
		return {
			close: () => Effect.runPromise(subscription.close),
			read: () => [...observed],
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
			const languagesChanged =
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
					outcome.kind === "Completed" && !languagesChanged;
			}

			if (hideMetadataChanged) {
				updateParsedSettings(this.settings);
				await this.migrateNoteMetadata(
					curr.hideMetadata ? "Hidden" : "Frontmatter",
				);
			}

			if (
				(delimiterChanged ||
					depthChanged ||
					rootChanged ||
					backlinksChanged ||
					hideMetadataChanged ||
					languagesChanged) &&
				!delimiterLifecycleReinitialized
			) {
				// Update global state BEFORE reinit so librarian uses new settings
				updateParsedSettings(this.settings);
				if (languagesChanged) {
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
	 * Moves the note metadata of the Library and of the dictionary under
	 * `Worter/` into `target`, the format "Hide metadata" now selects, and
	 * reports the outcome in a Notice.
	 */
	private async migrateNoteMetadata(target: MetadataFormat): Promise<void> {
		const exit = await Effect.runPromiseExit(
			migrateMetadataFormat(this.vam, target, [
				{
					folder: getParsedUserSettings().splitPathToLibraryRoot,
					namespaces: [LibraryMetadata],
				},
				{
					folder: WORTER_SPLIT_PATH,
					namespaces: [
						LemmaNoteMetadata,
						ReadingNoteMetadata,
						CrossroadNoteMetadata,
					],
				},
			]),
		);
		if (Exit.isFailure(exit)) {
			logger.error(
				"[TextEaterPlugin] Metadata migration failed:",
				getErrorMessage(Cause.squash(exit.cause)),
			);
			new Notice("Moving note metadata failed; see the console.");
			return;
		}
		const report = exit.value;
		// VAM's own writes reach the dictionary store as Self Events only, so
		// it reads the notes the migration moved under `Worter/` again.
		await this.dictionary
			?.then((store) => Effect.runPromise(store.rescan))
			.catch((error: unknown) =>
				logger.warn(
					"[TextEaterPlugin] The dictionary could not read Worter/ again after the metadata migration:",
					getErrorMessage(error),
				),
			);
		if (report.skipped.length > 0 || report.failed.length > 0) {
			logger.warn("[TextEaterPlugin] Metadata migration incomplete:", {
				failed: report.failed,
				skipped: report.skipped,
			});
		}
		new Notice(describeMetadataMigration(report));
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

		if (this.librarian && options.unsubscribeCurrent !== false) {
			await Effect.runPromise(this.librarian.unsubscribe());
		}
		this.librarian = new Librarian(this.vam);
		try {
			await Effect.runPromise(this.librarian.init());

			// Register new handlers
			const handlers = createHandlers(
				this.librarian,
				this.onWikilinkClicked,
			);
			for (const handlerDef of handlers) {
				this.registerUserEventHandler(
					handlerDef.kind,
					handlerDef.handler,
				);
			}
		} catch (error) {
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
			() => this.dumgen.get(),
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
