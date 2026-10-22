import {
	type DumdictVaultStore,
	makeDumdictVaultStore,
} from "@textfresser/dictionary";
import {
	createObsidianEventLayer,
	type ObsidianEventLayer,
} from "@textfresser/obsidian-event-layer";
import {
	createVaultActionManager,
	SplitPathKind,
	splitPathCodec,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect, Exit } from "effect";
import { Notice, Plugin, requestUrl } from "obsidian";
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
	vamScrollFiles,
	vamUnlinkScrolls,
} from "./commanders/classify";
import { DictionaryResetCommand } from "./commanders/dictionary-reset/reset-command";
import { Librarian } from "./commanders/librarian/librarian";
import { DelimiterChangeService } from "./commanders/librarian/runtime/delimiter-change-service";
import { Textfresser } from "./commanders/textfresser/textfresser";
import {
	clearState,
	getParsedUserSettings,
	initializeState,
	updateParsedSettings,
} from "./global-state/global-state";
import {
	createDictionaryStoreService,
	type DictionaryStoreService,
} from "./lifecycle/dictionary-store-service";
import { createLifecycleNotices } from "./lifecycle/lifecycle-notices";
import {
	createLifecycleSupervisor,
	type LaunchedPlugin,
} from "./lifecycle/lifecycle-supervisor";
import {
	createRequestUrlFetch,
	createRequestUrlGet,
	DumgenHost,
} from "./managers/dumgen";
import type { ScriptedDumgen } from "./managers/dumgen/dumgen-host";
import type { ScriptedJevAnswers } from "./managers/dumgen/scripted-jev";
import { createHandlers } from "./managers/obsidian/behavior-manager";
import {
	CommandKind,
	createCommandExecutor,
} from "./managers/obsidian/command-executor";
import {
	PROTECTED_PATH_PREFIXES,
	protectedPathRefusal,
	watchProtectedPaths,
} from "./managers/obsidian/protected-paths/protected-paths-guard";
import { OverlayManager } from "./managers/overlay-manager";
import { confirmInModal } from "./plugin/confirm-modal";
import { changeDelimiter } from "./plugin/delimiter-migration";
import { migrateNoteMetadata } from "./plugin/note-metadata-migration";
import { registerCommands } from "./plugin/register-commands";
import { diffSettings, snapshotSettings } from "./plugin/settings-changes";
import { SettingsTab } from "./settings";
import {
	holdsRetiredSettings,
	settingsFromStoredData,
} from "./settings/stored-settings";
import { dictionaryProjections } from "./stateless-helpers/dictionary-projections";
import type { TextEaterSettings } from "./types";
import { getErrorMessage } from "./utils/get-error-message";
import {
	decrementPending,
	incrementPending,
	whenIdle as whenIdleTracker,
} from "./utils/idle-tracker";
import { logger } from "./utils/logger";
import { sleep } from "./utils/sleep";

/** The services the launch builds, once it built them. */
type PluginServices = {
	readonly vam: VaultActionManager;
	readonly vamTesting: VaultActionManager["testing"];
	readonly classify: ClassifyCommander;
	/** Classify's background Knowledge runs, one per Reading (#64). */
	readonly knowledgeQueue: KnowledgeQueue;
	/** Reopens a clicked Reading note once its Knowledge lands (#116). */
	readonly reopenReading: (target: string) => Promise<boolean>;
	/** "Reset dictionary from old notes…" (#65). */
	readonly dictionaryReset: DictionaryResetCommand;
	/** The dictionary store over `Worter/`. */
	readonly store: DictionaryStoreService<DumdictVaultStore>;
	readonly delimiterChangeService: DelimiterChangeService;
	readonly userEvents: ObsidianEventLayer;
};

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
		get: createRequestUrlGet(requestUrl),
		keys: () => ({
			openaiApiKey: this.settings?.openaiApiKey ?? "",
			typesafeApiKey: this.settings?.typesafeApiKey ?? "",
		}),
	});
	private readonly notices = createLifecycleNotices((message, { sticky }) => {
		new Notice(message, sticky ? 0 : undefined);
	});
	private readonly lifecycle = createLifecycleSupervisor<Librarian>({
		notices: this.notices,
	});
	private services: PluginServices | null = null;
	private overlayManager: OverlayManager | null = null;
	private textfresser: Textfresser | null = null;
	private previousSettings: TextEaterSettings | null = null;

	/** Whether the launch is done; the E2E driver waits for it. */
	get initialized(): boolean {
		return this.lifecycle.state().kind === "Running";
	}

	get librarian(): Librarian | null {
		return this.lifecycle.librarian();
	}

	override async onload() {
		try {
			// The launch waits for Obsidian; it does not block onload.
			void Effect.runPromise(this.lifecycle.launch(this.boot()));
			this.addSettingTab(new SettingsTab(this.app, this));
			// Add testing command early so it exists, but callback waits for init
			this.addCommand({
				callback: async () => {
					while (!this.initialized) {
						await sleep(100);
					}
					// Initialization itself exposes the service required by the test harness.
				},
				id: "textfresser-testing-expose-opened-service",
				name: "Testing: expose opened file service",
			});
		} catch (error) {
			this.notices.launchFailed(error);
		}
	}

	override onunload() {
		// Releases at once what it can, newest first; the Librarian and VAM follow.
		Effect.runFork(this.lifecycle.stop);
		this.dumgen.dispose();
		this.services = null;
		this.overlayManager = null;
		clearState();
	}

	/**
	 * Builds the plugin's services once Obsidian has laid out the workspace
	 * and indexed the vault, each owned by the lifecycle, which releases them
	 * newest first on unload.
	 */
	private boot(): Effect.Effect<LaunchedPlugin<Librarian>, unknown> {
		const plugin = this;
		const { lifecycle } = this;
		return Effect.gen(function* () {
			yield* Effect.promise(() => plugin.whenObsidianIsReady());
			yield* Effect.tryPromise(() => plugin.loadSettings());
			registerCommands(plugin, {
				app: plugin.app,
				dictionaryReset: () => plugin.services?.dictionaryReset ?? null,
				execute: (kind) => void plugin.executeCommand(kind),
				knowledgeQueue: () => plugin.services?.knowledgeQueue ?? null,
				restartLibrarian: () =>
					void Effect.runPromise(lifecycle.restart),
				stillLoading: plugin.notices.stillLoading,
				vam: () => plugin.services?.vam ?? null,
			});

			const vaultActions = createVaultActionManager(plugin.app, {
				protectedPaths: PROTECTED_PATH_PREFIXES,
			});
			const vam = vaultActions.manager;
			lifecycle.ownLast(
				"dispose VaultActionManager",
				vaultActions.dispose,
			);
			plugin.rebuildTextfresser(vam);

			const store = createDictionaryStoreService({
				build: () => plugin.buildDictionaryStore(vam),
				close: (built) => built.close,
				onBuildFailed: plugin.notices.storeBuildFailed,
			});
			lifecycle.own("close the dictionary store", store.stop);
			void store.get().catch(() => undefined);
			const dictionary = Effect.tryPromise({
				catch: (cause) =>
					new UnitResolverError({
						cause,
						message: `the dictionary could not be read: ${getErrorMessage(cause)}`,
					}),
				try: () => store.get(),
			});
			const dumgen = Effect.try({
				catch: (cause) =>
					new UnitResolverError({
						cause,
						message: `dumgen is unavailable: ${getErrorMessage(cause)}`,
					}),
				try: () => plugin.dumgen.get(),
			});

			const knowledgeQueue = createKnowledgeQueue({
				notify: (message) => new Notice(message),
				onEnd: decrementPending,
				onStart: incrementPending,
				run: (job) =>
					Effect.all([dumgen, dictionary]).pipe(
						Effect.flatMap(([instance, built]) =>
							produceKnowledge(
								{
									dumgen: instance,
									store: built,
									translationLanguages:
										plugin.settings.languages.known ===
										"Russian"
											? ["en", "ru"]
											: ["en"],
								},
								job,
							),
						),
					),
			});
			lifecycle.own(
				"close the Knowledge queue",
				Effect.sync(() => knowledgeQueue.close()),
			);
			const reopenReading = createReadingReopener({
				activePath: async () => {
					const exit = await Effect.runPromiseExit(vam.mdPwd());
					return Exit.isSuccess(exit) && exit.value
						? splitPathCodec.format(exit.value)
						: null;
				},
				open: async (path) => {
					const splitPath = splitPathCodec.parse(path);
					if (splitPath.kind !== SplitPathKind.MdFile) return;
					await Effect.runPromise(vam.cd(splitPath));
				},
				queue: knowledgeQueue,
			});

			const segmentationCache = filesSegmentationCache(
				plugin.app.vault.adapter,
			);
			const segmenterVersion = () => {
				const scripted = plugin.dumgen.scriptedJevTag();
				return scripted
					? `${DUMGEN_SEGMENTER_VERSION}+scripted-${scripted}`
					: DUMGEN_SEGMENTER_VERSION;
			};
			const scrollActivity = createScrollActivity();
			const classify = new ClassifyCommander({
				blockedBy: (scrollPath) =>
					lifecycle.classifyRefusal() ??
					protectedPathRefusal(vam, scrollPath),
				cache: segmentationCache,
				dumgen: () => plugin.dumgen.get(),
				missingProviderKeys: () => plugin.dumgen.missingKeys(),
				resolver: dumgenUnitResolver({
					activity: scrollActivity,
					dumgen,
					knowledge: knowledgeQueue,
					notify: (message) => new Notice(message),
					scroll: vamScrollFiles(vam),
					store: dictionary,
				}),
				segmenterVersion,
			});
			/** Removes the occurrences whose links the user deletes from a Scroll (#116). */
			const unlinkObserver = createUnlinkObserver({
				activity: scrollActivity,
				blockedBy: lifecycle.classifyRefusal,
				cache: segmentationCache,
				notify: (message) => new Notice(message),
				onEnd: decrementPending,
				onStart: incrementPending,
				scrolls: vamUnlinkScrolls(vam),
				segmenterVersion,
				store: dictionary,
			});
			lifecycle.own(
				"close the unlink observer",
				Effect.sync(() => unlinkObserver.close()),
			);
			const dictionaryReset = new DictionaryResetCommand({
				activity: scrollActivity,
				app: plugin.app,
				cache: segmentationCache,
				checkProviderKeys: () => plugin.dumgen.checkKeys(),
				dumgen: () => plugin.dumgen.get(),
				knowledge: knowledgeQueue,
				missingProviderKeys: () => plugin.dumgen.missingKeys(),
				segmenterVersion,
				store: () => store.get(),
				vam,
			});
			lifecycle.own(
				"cancel the dictionary reset",
				Effect.sync(() => void dictionaryReset.cancel()),
			);

			// Unified user event interceptor (clicks, clipboard, select-all, wikilinks)
			const userEvents = createObsidianEventLayer({
				app: plugin.app,
				plugin,
				selectionTextSource: {
					getSelectionText: () => {
						const exit = Effect.runSyncExit(vam.getSelectionText());
						return Exit.isSuccess(exit) ? exit.value : null;
					},
				},
			});

			// VAM turns file system events into VaultEvents, filters its own,
			// and notifies subscribers such as the Librarian.
			yield* vam.startListening();
			// VAM closes this subscription when it is disposed.
			yield* watchProtectedPaths(vam, (message) => {
				logger.warn(`[TextEaterPlugin] ${message}`);
				const notice = new Notice(message, 0);
				return {
					showing: () => notice.noticeEl.isConnected,
					update: (next) => {
						logger.warn(`[TextEaterPlugin] ${next}`);
						notice.setMessage(next);
					},
				};
			});
			lifecycle.own(
				"stop observing Scrolls",
				yield* observeScrollModifications(vam, unlinkObserver),
			);
			userEvents.start();
			lifecycle.own(
				"stop the user event interceptor",
				Effect.sync(() => userEvents.stop()),
			);

			plugin.services = {
				classify,
				delimiterChangeService: new DelimiterChangeService(vam),
				dictionaryReset,
				knowledgeQueue,
				reopenReading,
				store,
				userEvents,
				vam,
				vamTesting: vaultActions.testing,
			};
			return {
				attachLibrarian: (librarian) => {
					const teardowns = createHandlers(
						librarian,
						plugin.onWikilinkClicked,
					).map((handler) =>
						userEvents.setHandler(
							handler.kind as never,
							handler.handler as never,
						),
					);
					return () => {
						for (const teardown of teardowns) teardown();
					};
				},
				loadStore: () => store.get(),
				makeLibrarian: (onStopped) => new Librarian(vam, { onStopped }),
				onLaunched: () => {
					const overlay = new OverlayManager({
						app: plugin.app,
						commandExecutor: (kind) => plugin.executeCommand(kind),
						getLibrarian: () => lifecycle.librarian(),
						plugin,
						userEventInterceptor: userEvents,
						vam,
					});
					plugin.overlayManager = overlay;
					overlay.init();
					lifecycle.own(
						"destroy the overlay",
						Effect.sync(() => overlay.destroy()),
					);
				},
				resetRunning: () => dictionaryReset.isRunning(),
				sweep: () => unlinkObserver.sweep(),
			};
		});
	}

	/** Resolves once the workspace is laid out and the vault indexed. */
	private async whenObsidianIsReady(): Promise<void> {
		const { metadataCache, vault, workspace } = this.app;
		if (!workspace.layoutReady)
			await new Promise<void>((resolve) =>
				workspace.onLayoutReady(resolve),
			);
		// Initial metadata indexing fires `resolved` once per app session.
		if (!vault.getRoot()) {
			await new Promise<void>((resolve) => {
				const onResolved = () => {
					metadataCache.off("resolved", onResolved);
					resolve();
				};
				metadataCache.on("resolved", onResolved);
			});
		}
		await sleep(300);
	}

	private async loadSettings() {
		const stored: unknown = await this.loadData();
		this.settings = settingsFromStoredData(stored);
		// Drop the retired keys, the Gemini key among them, from data.json now.
		if (holdsRetiredSettings(stored)) await this.saveData(this.settings);

		// Initialize global state with parsed settings
		initializeState(this.settings);
		this.previousSettings = snapshotSettings(this.settings);
	}

	private buildDictionaryStore(vault: VaultActionManager) {
		return makeDumdictVaultStore({
			metadataFormat: () =>
				getParsedUserSettings().hideMetadata ? "Hidden" : "Frontmatter",
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
			vault,
		});
	}

	/**
	 * Runs a Textfresser, Librarian or Classify command on the active note,
	 * once the launch is done.
	 */
	private async executeCommand(kind: CommandKind): Promise<void> {
		if (!this.initialized) return;
		incrementPending();
		try {
			const services = this.services;
			const librarian = this.lifecycle.librarian();
			const textfresser = this.textfresser;
			if (!services || !librarian || !textfresser) return;
			await createCommandExecutor({
				classify: services.classify,
				librarian,
				textfresser,
				vam: services.vam,
			})(kind);
		} finally {
			decrementPending();
		}
	}

	/** A clicked Reading link reopens its note once its Knowledge lands. */
	private readonly onWikilinkClicked = (target: string): void => {
		const reopen = this.services?.reopenReading;
		if (!reopen) return;
		void reopen(target).catch((error) => {
			logger.warn(
				"[TextEaterPlugin] Could not reopen the Reading note:",
				getErrorMessage(error),
			);
		});
	};

	private rebuildTextfresser(
		vam: VaultActionManager | undefined = this.services?.vam,
	): void {
		if (!vam) return;
		this.textfresser = new Textfresser(vam, this.settings.languages, () =>
			this.dumgen.get(),
		);
	}

	async saveSettings() {
		const prev = this.previousSettings;
		const curr = this.settings;

		if (prev) {
			const changes = diffSettings(prev, curr);
			let librarianRestarted = false;

			if (changes.delimiter) {
				const report = await Effect.runPromise(
					changeDelimiter(
						{
							applyDelimiter: (config) => {
								this.settings.suffixDelimiter = { ...config };
								updateParsedSettings(this.settings);
							},
							confirm: (title, message) =>
								confirmInModal(this.app, title, message),
							libraryRoot: curr.libraryRoot,
							notices: this.notices,
							service:
								this.services?.delimiterChangeService ?? null,
							supervisor: this.lifecycle,
						},
						prev.suffixDelimiter,
						curr.suffixDelimiter,
					),
				);
				// The setting follows the files: it keeps the new delimiter
				// only when every file carries it.
				if (!report.keepsNewDelimiter) {
					this.settings.suffixDelimiter = { ...prev.suffixDelimiter };
					updateParsedSettings(this.settings);
					return;
				}
				librarianRestarted =
					report.librarianReinitialized && !changes.languages;
			}

			const services = this.services;
			if (changes.hideMetadata && services) {
				updateParsedSettings(this.settings);
				await migrateNoteMetadata(
					services.vam,
					services.store.ifStarted(),
					curr.hideMetadata ? "Hidden" : "Frontmatter",
				);
			}

			if (changes.librarian && !librarianRestarted) {
				// Update global state BEFORE the restart so the Librarian uses the new settings
				updateParsedSettings(this.settings);
				if (changes.languages) this.rebuildTextfresser();
				await Effect.runPromise(this.lifecycle.reconfigure);
			}

			if (changes.placement) this.overlayManager?.refreshToolbars();
		}

		await this.saveData(this.settings);
		// Allow file system to flush before any potential reload
		await sleep(100);
		this.previousSettings = snapshotSettings(this.settings);
		updateParsedSettings(this.settings);
	}

	// ─── E2E test hooks ───

	getLibrarianTestingApi() {
		const vam = this.services?.vam;
		const librarian = this.lifecycle.librarian();
		return {
			getActiveSelection: () =>
				vam
					? Effect.runPromise(vam.getSelectionInfo()).then(
							(selection) => selection?.text ?? null,
						)
					: Promise.resolve(null),
			handleCodexCheckboxClick: (
				payload: Parameters<Librarian["handleCodexCheckboxClick"]>[0],
			) => {
				const current = this.lifecycle.librarian();
				if (!current) return Promise.resolve();
				return Effect.runPromise(
					current.handleCodexCheckboxClick(payload),
				);
			},
			librarian,
			runPageNavigation: (direction: "next" | "prev") =>
				this.executeCommand(
					direction === "next"
						? CommandKind.GoToNextPage
						: CommandKind.GoToPrevPage,
				),
			runSplitInBlocks: async () => {
				const current = this.lifecycle.librarian();
				if (!current || !vam) return;
				const active = await Effect.runPromise(
					vam.getActiveEditorContext(),
				);
				await Effect.runPromise(
					current.executeCommand(
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
			latestHandoff: () =>
				this.services?.classify.latestHandoff() ?? null,
			useScriptedDumgen: (script: ScriptedDumgen | null) =>
				this.dumgen.useScriptedDumgenForTesting(script),
			useScriptedJev: (answers: ScriptedJevAnswers | null) =>
				this.dumgen.useScriptedJevForTesting(answers),
		};
	}

	/**
	 * E2E test hooks for the "Reset dictionary from old notes…" command: what
	 * its last opening and dry run showed and how its last Execute ended,
	 * clicking a button of its newest open modal, and closing its modals
	 * without clicking in them.
	 */
	getDictionaryResetTestingApi() {
		const reset = () => this.services?.dictionaryReset;
		return {
			clickButton: (label: string) =>
				reset()?.clickButton(label) ?? false,
			closeModal: () => reset()?.closeModal(),
			lastDryRun: () => reset()?.lastDryRun() ?? null,
			lastExecute: () => reset()?.lastExecute() ?? null,
			lastOpening: () => reset()?.lastOpening() ?? null,
		};
	}

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
		const vam = this.services?.vam;
		if (!vam) throw new Error("Textfresser is still loading");
		const folder = splitPathCodec.parse(folderPath);
		if (folder.kind !== SplitPathKind.Folder) {
			throw new Error(`Expected a folder path, got '${folderPath}'`);
		}
		const observed: { mtime: number; path: string; size: number }[] = [];
		const subscription = await Effect.runPromise(
			vam.subscribeToMdModifications(folder, (event) =>
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
		return whenIdleTracker(async () => {
			const vamTesting = this.services?.vamTesting;
			if (vamTesting) await Effect.runPromise(vamTesting.whenSettled());
		});
	}

	/**
	 * E2E test hook: reset settings to provided values and restart the
	 * Librarian, bypassing the confirmation dialog.
	 */
	async resetSettingsForTesting(
		newSettings: Partial<TextEaterSettings>,
	): Promise<void> {
		Object.assign(this.settings, newSettings);
		// Update global state so codecs use new settings
		updateParsedSettings(this.settings);
		await this.saveData(this.settings);
		// Avoid a dialog on the next saveSettings
		this.previousSettings = snapshotSettings(this.settings);
		this.rebuildTextfresser();
		await Effect.runPromise(this.lifecycle.reconfigure);
	}
}
