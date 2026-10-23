import {
	type DictionaryScanError,
	type DumdictVaultStore,
	makeDumdictVaultStore,
} from "@textfresser/dictionary";
import {
	createObsidianEventLayer,
	type ObsidianEventLayer,
} from "@textfresser/obsidian-event-layer";
import {
	SplitPathKind,
	splitPathCodec,
	type VamSetupError,
	type VamShutdownError,
	type VamSubscriptionError,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { formatCause } from "@textfresser/vault-action-manager/diagnostics";
import { operations } from "dumgen";
import { type Cause, Effect, Exit, Option } from "effect";
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
import { Dumgen, type ScriptedDumgen } from "./managers/dumgen";
import type { ScriptedJevAnswers } from "./managers/dumgen/scripted-jev";
import { createHandlers } from "./managers/obsidian/behavior-manager";
import {
	CommandKind,
	createCommandExecutor,
} from "./managers/obsidian/command-executor";
import {
	protectedPathRefusal,
	watchProtectedPaths,
} from "./managers/obsidian/protected-paths/protected-paths-guard";
import { OverlayManager } from "./managers/overlay-manager";
import { confirmInModal } from "./plugin/confirm-modal";
import { changeDelimiter } from "./plugin/delimiter-migration";
import { migrateNoteMetadata } from "./plugin/note-metadata-migration";
import { registerCommands } from "./plugin/register-commands";
import { diffSettings, snapshotSettings } from "./plugin/settings-changes";
import { logAtEdge } from "./runtime/edge-log";
import { PluginLive, type PluginServices } from "./runtime/plugin-live";
import {
	makePluginRuntime,
	type PluginRuntime,
} from "./runtime/plugin-runtime";
import { SettingsTab } from "./settings";
import {
	holdsRetiredSettings,
	settingsFromStoredData,
} from "./settings/stored-settings";
import { dictionaryProjections } from "./stateless-helpers/dictionary-projections";
import type { TextEaterSettings } from "./types";
import { getErrorMessage } from "./utils/get-error-message";
import { IdleTracker, isE2EMode } from "./utils/idle-tracker";
import { recentTrace } from "./utils/recent-trace";
import { sleep } from "./utils/sleep";

type Runtime = PluginRuntime<PluginServices, VamSetupError>;

/** The services the launch builds, once it built them. */
type LaunchedServices = {
	readonly vam: VaultActionManager;
	readonly vamTesting: VaultActionManager["testing"];
	readonly classify: ClassifyCommander;
	/** Classify's background Knowledge runs, one per Reading (#64). */
	readonly knowledgeQueue: KnowledgeQueue;
	/** Reopens a clicked Reading note once its Knowledge lands (#116). */
	readonly reopenReading: (
		target: string,
	) => Effect.Effect<
		boolean,
		Effect.Error<ReturnType<VaultActionManager["cd"]>>
	>;
	/** "Reset dictionary from old notes…" (#65). */
	readonly dictionaryReset: DictionaryResetCommand;
	/** The dictionary store over `Worter/`. */
	readonly store: DictionaryStoreService<
		DumdictVaultStore,
		DictionaryScanError
	>;
	readonly delimiterChangeService: DelimiterChangeService;
	readonly userEvents: ObsidianEventLayer;
};

export default class TextEaterPlugin extends Plugin {
	settings: TextEaterSettings;
	private readonly notices = createLifecycleNotices((message, { sticky }) => {
		new Notice(message, sticky ? 0 : undefined);
	});
	private readonly lifecycle = createLifecycleSupervisor<Librarian>({
		notices: this.notices,
	});
	/** The plugin's one Effect runtime: built in `onload`, disposed in `onunload`. */
	private runtime: Runtime | null = null;
	/**
	 * The runtime's dumgen, once built: each action runs on one build over
	 * the TypeSafe and OpenAI keys in the settings, through `requestUrl`
	 * (see `managers/dumgen/request-url-fetch.ts`).
	 */
	private dumgen: Dumgen["Service"] | null = null;
	private services: LaunchedServices | null = null;
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

	override onload() {
		try {
			const runtime = makePluginRuntime(
				PluginLive(this.app, {
					lifecycle: this.lifecycle,
					providerKeys: () => ({
						openaiApiKey: this.settings?.openaiApiKey ?? "",
						typesafeApiKey: this.settings?.typesafeApiKey ?? "",
					}),
					requestUrl,
					trace: recentTrace,
				}),
				{
					onBuildFailed: (cause) =>
						this.notices.launchFailedOutsideRuntime(cause),
				},
			);
			this.runtime = runtime;
			// The launch waits for Obsidian; it does not block onload.
			runtime.onload(
				Effect.gen({ self: this }, function* () {
					const vam = yield* VaultActionManager;
					const dumgen = yield* Dumgen;
					this.dumgen = dumgen;
					yield* this.lifecycle.launch(
						this.boot(runtime, vam, dumgen),
					);
				}),
			);
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
			this.notices.launchFailedOutsideRuntime(error);
		}
	}

	override onunload() {
		const runtime = this.runtime;
		this.runtime = null;
		this.services = null;
		this.dumgen = null;
		this.overlayManager = null;
		// Interrupts what runs at an edge, dumgen's actions included, stops
		// the lifecycle (its services newest first, then the Librarian), then
		// shuts VAM down.
		void (runtime?.dispose() ?? Promise.resolve())
			// The runtime is gone: only the edge log is left.
			.catch((error: unknown) =>
				logAtEdge(
					"Error",
					"[TextEaterPlugin] Unloading did not finish cleanly:",
					error,
				),
			)
			.finally(() => clearState());
	}

	/**
	 * Builds the plugin's services once Obsidian has laid out the workspace
	 * and indexed the vault, each owned by the lifecycle, which releases them
	 * newest first on unload. VAM and dumgen come from the runtime, which
	 * shuts VAM down after the lifecycle stopped.
	 */
	private boot(
		runtime: Runtime,
		vam: VaultActionManager,
		dumgen: Dumgen["Service"],
	): Effect.Effect<
		LaunchedPlugin<Librarian>,
		| Cause.UnknownError
		| VamSetupError
		| VamShutdownError
		| VamSubscriptionError
	> {
		const { lifecycle } = this;
		return Effect.gen({ self: this }, function* () {
			yield* Effect.promise(() => this.whenObsidianIsReady());
			yield* Effect.tryPromise(() => this.loadSettings());
			registerCommands(this, {
				dictionaryReset: () => this.services?.dictionaryReset ?? null,
				execute: (kind) => void this.executeCommand(kind),
				knowledgeQueue: () => this.services?.knowledgeQueue ?? null,
				restartLibrarian: lifecycle.restart,
				runtime,
				stillLoading: this.notices.stillLoading,
				vam: () => this.services?.vam ?? null,
			});
			this.rebuildTextfresser(vam, dumgen);
			const idle = yield* IdleTracker;
			// Plain callbacks count their work on the runtime's idle tracker.
			const pending = {
				end: () => void runtime.readSync(idle.end),
				start: () => void runtime.readSync(idle.start),
			};

			const store = createDictionaryStoreService({
				build: () => this.buildDictionaryStore(vam),
				close: (built) => built.close,
				onBuildFailed: this.notices.storeBuildFailed,
				runtime: runtime.hops,
			});
			yield* lifecycle.own("close the dictionary store", store.stop);
			void store.get().catch(() => undefined);
			const dictionary = Effect.tryPromise({
				catch: (cause) =>
					new UnitResolverError({
						cause,
						message: `the dictionary could not be read: ${getErrorMessage(cause)}`,
					}),
				try: () => store.get(),
			});
			// Each Reading's Knowledge runs in the background, on the build
			// every background run shares.
			const runKnowledge = (
				job: Parameters<KnowledgeQueue["enqueue"]>[0],
			) =>
				dictionary.pipe(
					Effect.flatMap((built) =>
						produceKnowledge(
							{
								dumgen: operations,
								store: built,
								translationLanguages:
									this.settings.languages.known === "Russian"
										? ["en", "ru"]
										: ["en"],
							},
							job,
						),
					),
					dumgen.provideBackground,
					Effect.catchTag("DumgenUnavailable", (error) =>
						Effect.fail(
							new UnitResolverError({
								cause: error.cause,
								message: error.message,
							}),
						),
					),
				);
			const knowledgeQueue = createKnowledgeQueue({
				notify: (message) => new Notice(message),
				onEnd: pending.end,
				onStart: pending.start,
				run: runKnowledge,
				runtime: runtime.hops,
			});
			yield* lifecycle.own(
				"close the Knowledge queue",
				Effect.sync(() => knowledgeQueue.close()),
			);
			const reopenReading = createReadingReopener({
				activePath: vam.mdPwd().pipe(
					Effect.map((path) =>
						path ? splitPathCodec.format(path) : null,
					),
					Effect.orElseSucceed(() => null),
				),
				open: (path) =>
					Effect.suspend(() => {
						const splitPath = splitPathCodec.parse(path);
						return splitPath.kind === SplitPathKind.MdFile
							? vam.cd(splitPath)
							: Effect.void;
					}),
				queue: knowledgeQueue,
			});

			const segmentationCache = filesSegmentationCache(
				this.app.vault.adapter,
			);
			const segmenterVersion = Effect.map(
				dumgen.scriptedJevTag,
				(scripted) =>
					scripted
						? `${DUMGEN_SEGMENTER_VERSION}+scripted-${scripted}`
						: DUMGEN_SEGMENTER_VERSION,
			);
			const scrollActivity = createScrollActivity();
			const classify = new ClassifyCommander({
				blockedBy: (scrollPath) =>
					lifecycle.classifyRefusal() ??
					protectedPathRefusal(vam, scrollPath),
				cache: segmentationCache,
				dumgen: dumgen.provide,
				missingProviderKeys: dumgen.missingKeys,
				resolver: dumgenUnitResolver({
					activity: scrollActivity,
					dumgen: operations,
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
				onEnd: pending.end,
				onStart: pending.start,
				runtime: runtime.hops,
				scrolls: vamUnlinkScrolls(vam),
				segmenterVersion,
				store: dictionary,
			});
			yield* lifecycle.own(
				"close the unlink observer",
				Effect.sync(() => unlinkObserver.close()),
			);
			const dictionaryReset = new DictionaryResetCommand({
				activity: scrollActivity,
				app: this.app,
				cache: segmentationCache,
				checkProviderKeys: dumgen.checkKeys,
				dumgen: dumgen.provide,
				knowledge: knowledgeQueue,
				// Read in the modal's click, to decide it.
				missingProviderKeys: () =>
					Option.getOrElse(
						Exit.getSuccess(runtime.readSync(dumgen.missingKeys)),
						() => [],
					),
				runtime: runtime.hops,
				segmenterVersion,
				store: () => store.get(),
				vam,
			});
			yield* lifecycle.own(
				"cancel the dictionary reset",
				Effect.sync(() => void dictionaryReset.cancel()),
			);

			// Unified user event interceptor (clicks, clipboard, select-all, wikilinks)
			const userEvents = createObsidianEventLayer({
				app: this.app,
				pendingWork: pending,
				plugin: this,
				selectionTextSource: {
					getSelectionText: () => {
						const exit = runtime.readSync(vam.getSelectionText());
						return Exit.isSuccess(exit) ? exit.value : null;
					},
				},
			});

			// VAM turns file system events into VaultEvents, filters its own,
			// and notifies subscribers such as the Librarian.
			yield* vam.startListening();
			// VAM closes this subscription when it is disposed.
			// It logs each warning it shows, under its delivery's span.
			yield* watchProtectedPaths(vam, (message) => {
				const notice = new Notice(message, 0);
				return {
					showing: () => notice.noticeEl.isConnected,
					update: (next) => notice.setMessage(next),
				};
			});
			yield* lifecycle.own(
				"stop observing Scrolls",
				yield* observeScrollModifications(vam, unlinkObserver),
			);
			// Started and owned at once, so an unload cannot fall between.
			yield* Effect.uninterruptible(
				Effect.suspend(() => {
					userEvents.start();
					return lifecycle.own(
						"stop the user event interceptor",
						Effect.sync(() => userEvents.stop()),
					);
				}),
			);

			this.services = {
				classify,
				delimiterChangeService: new DelimiterChangeService(vam),
				dictionaryReset,
				knowledgeQueue,
				reopenReading,
				store,
				userEvents,
				vam,
				vamTesting: vam.testing,
			};
			return {
				attachLibrarian: (librarian) => {
					const teardowns = createHandlers(
						librarian,
						runtime.userEvent,
						this.onWikilinkClicked,
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
				onLaunched: () =>
					Effect.uninterruptible(
						Effect.suspend(() => {
							const overlay = new OverlayManager({
								app: this.app,
								commandExecutor: (kind) =>
									this.executeCommand(kind),
								getLibrarian: () => lifecycle.librarian(),
								plugin: this,
								readSync: runtime.readSync,
								userEventInterceptor: userEvents,
								vam,
							});
							this.overlayManager = overlay;
							overlay.init();
							return lifecycle.own(
								"destroy the overlay",
								Effect.sync(() => overlay.destroy()),
							);
						}),
					),
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
			onDiagnostics: (diagnostics) =>
				diagnostics.quarantined.length > 0
					? Effect.logWarning(
							"[TextEaterPlugin] Dictionary notes the store cannot read:",
							diagnostics.quarantined
								.map(({ path }) => path)
								.join(", "),
						)
					: Effect.void,
			onTablesRerendered: ({ lemmas, notes, remaining }) =>
				Effect.logInfo(
					`[TextEaterPlugin] Re-rendered the inflection tables of ${lemmas} Lemma notes for the current language pack (${notes} notes written${remaining > 0 ? `, ${remaining} left for the next scan` : ""})`,
				),
			projections: dictionaryProjections,
			vault,
		});
	}

	/**
	 * Runs a Textfresser, Librarian or Classify command on the active note,
	 * once the launch is done, under `command.<kind>`.
	 */
	private executeCommand(kind: CommandKind): Promise<void> {
		const runtime = this.runtime;
		if (!runtime || !this.initialized) return Promise.resolve();
		const program = Effect.suspend(() => {
			const services = this.services;
			const librarian = this.lifecycle.librarian();
			const textfresser = this.textfresser;
			if (!services || !librarian || !textfresser) return Effect.void;
			return createCommandExecutor({
				classify: services.classify,
				librarian,
				textfresser,
				vam: services.vam,
			})(kind);
		});
		return runtime.command(
			kind,
			Effect.flatMap(IdleTracker, (idle) => idle.track(program)),
		);
	}

	/** A clicked Reading link reopens its note once its Knowledge lands. */
	private readonly onWikilinkClicked = (target: string): void => {
		const reopen = this.services?.reopenReading;
		if (!reopen || !this.runtime) return;
		void this.runtime.userEvent(
			"wikilink-clicked",
			reopen(target).pipe(
				Effect.catch((error) =>
					Effect.logWarning(
						"[TextEaterPlugin] Could not reopen the Reading note:",
						getErrorMessage(error),
					),
				),
			),
		);
	};

	private rebuildTextfresser(
		vam: VaultActionManager | undefined = this.services?.vam,
		dumgen: Dumgen["Service"] | null = this.dumgen,
	): void {
		if (!vam || !dumgen) return;
		this.textfresser = new Textfresser(
			vam,
			this.settings.languages,
			dumgen.provide,
		);
	}

	/** Applies the changed settings, under `settings.save`, and stores them. */
	saveSettings(): Promise<void> {
		if (!this.runtime) return Promise.resolve();
		return this.runtime.settings(this.applySettings());
	}

	private applySettings() {
		return Effect.gen({ self: this }, function* () {
			const prev = this.previousSettings;
			const curr = this.settings;

			if (prev) {
				const changes = diffSettings(prev, curr);
				let librarianRestarted = false;

				if (changes.delimiter) {
					const report = yield* changeDelimiter(
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
					);
					// The setting follows the files: it keeps the new delimiter
					// only when every file carries it.
					if (!report.keepsNewDelimiter) {
						this.settings.suffixDelimiter = {
							...prev.suffixDelimiter,
						};
						updateParsedSettings(this.settings);
						return;
					}
					librarianRestarted =
						report.librarianReinitialized && !changes.languages;
				}

				const services = this.services;
				if (changes.hideMetadata && services) {
					updateParsedSettings(this.settings);
					yield* migrateNoteMetadata(
						services.vam,
						curr.hideMetadata ? "Hidden" : "Frontmatter",
					);
				}

				if (changes.librarian && !librarianRestarted) {
					// Update global state BEFORE the restart so the Librarian uses the new settings
					updateParsedSettings(this.settings);
					if (changes.languages) this.rebuildTextfresser();
					yield* this.lifecycle.reconfigure;
				}

				if (changes.placement) this.overlayManager?.refreshToolbars();
			}

			yield* Effect.tryPromise(() => this.saveData(this.settings));
			// Allow file system to flush before any potential reload
			yield* Effect.sleep("100 millis");
			this.previousSettings = snapshotSettings(this.settings);
			updateParsedSettings(this.settings);
		});
	}

	// ─── E2E test hooks ───

	/** Runs an E2E hook's program under `e2e.<hook>`; rejects after unload. */
	private e2e<A, E>(
		hook: string,
		effect: Effect.Effect<A, E, PluginServices>,
	): Promise<A> {
		return this.runtime
			? this.runtime.e2e(hook, effect)
			: Promise.reject(new Error("Textfresser has unloaded"));
	}

	getLibrarianTestingApi() {
		const vam = this.services?.vam;
		const librarian = this.lifecycle.librarian();
		return {
			getActiveSelection: () =>
				vam
					? this.e2e(
							"get-active-selection",
							vam
								.getSelectionInfo()
								.pipe(
									Effect.map(
										(selection) => selection?.text ?? null,
									),
								),
						)
					: Promise.resolve(null),
			handleCodexCheckboxClick: (
				payload: Parameters<Librarian["handleCodexCheckboxClick"]>[0],
			) => {
				const current = this.lifecycle.librarian();
				if (!current) return Promise.resolve();
				return this.e2e(
					"handle-codex-checkbox-click",
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
			runSplitInBlocks: () => {
				const current = this.lifecycle.librarian();
				if (!current || !vam) return Promise.resolve();
				return this.e2e(
					"run-split-in-blocks",
					Effect.gen(function* () {
						const active = yield* vam.getActiveEditorContext();
						yield* current.executeCommand(
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
						);
					}),
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
		// A scenario must never reach a provider, so a script that cannot be
		// set throws; a plugin with no runtime holds no script to clear.
		const useScripted = (script: ScriptedDumgen | null) => {
			const { dumgen, runtime } = this;
			const exit =
				dumgen && runtime
					? runtime.readSync(dumgen.testing.useScripted(script))
					: undefined;
			if (script === null || (exit && Exit.isSuccess(exit))) return;
			throw new Error(
				`Textfresser could not script dumgen: ${exit ? formatCause(exit.cause, { stack: false }) : "it is still loading or has unloaded"}`,
			);
		};
		return {
			dumgenRequests: () => {
				const requests = this.readDumgenSync(
					(dumgen) => dumgen.testing.requests,
				);
				return Option.getOrUndefined(requests) ?? null;
			},
			latestHandoff: () =>
				this.services?.classify.latestHandoff() ?? null,
			useScriptedDumgen: useScripted,
			useScriptedJev: (answers: ScriptedJevAnswers | null) =>
				useScripted(answers === null ? null : { jev: answers }),
		};
	}

	/**
	 * Runs a read of the runtime's dumgen at once, for the E2E driver's
	 * synchronous hooks; none while the runtime is still being built or
	 * after unload.
	 */
	private readDumgenSync<A>(
		read: (dumgen: Dumgen["Service"]) => Effect.Effect<A>,
	): Option.Option<A> {
		const { dumgen, runtime } = this;
		return dumgen && runtime
			? Exit.getSuccess(runtime.readSync(read(dumgen)))
			: Option.none();
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
		const subscription = await this.e2e(
			"observe-md-modifications",
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
			close: () =>
				this.e2e("close-md-modification-observer", subscription.close),
			read: () => [...observed],
		};
	}

	/**
	 * E2E test hook: wait until all plugin async work is complete.
	 * Resolves once no work has been pending for a second, and VAM has
	 * delivered every vault event Obsidian sent it.
	 */
	whenIdle(): Promise<void> {
		if (!this.runtime || !isE2EMode()) return Promise.resolve();
		return this.e2e(
			"when-idle",
			Effect.gen({ self: this }, function* () {
				const idle = yield* IdleTracker;
				yield* idle.whenIdle();
				const vamTesting = this.services?.vamTesting;
				if (vamTesting) yield* vamTesting.whenSettled();
			}),
		);
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
		await this.e2e("reset-settings", this.lifecycle.reconfigure);
	}
}
