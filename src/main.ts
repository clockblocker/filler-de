import {
	SplitPathKind,
	splitPathCodec,
	type VamSetupError,
	type VamShutdownError,
	type VamSubscriptionError,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { formatCause } from "@textfresser/vault-action-manager/diagnostics";
import {
	type Cause,
	Context,
	Effect,
	Exit,
	Layer,
	Option,
	type Scope,
} from "effect";
import { Notice, Plugin, requestUrl } from "obsidian";
import { Librarian } from "./commanders/librarian/librarian";
import { DelimiterChangeService } from "./commanders/librarian/runtime/delimiter-change-service";
import {
	clearState,
	initializeState,
	updateParsedSettings,
} from "./global-state/global-state";
import { DictionaryStore } from "./lifecycle/dictionary-store-service";
import { createLifecycleNotices } from "./lifecycle/lifecycle-notices";
import {
	type LaunchedPlugin,
	Lifecycle,
} from "./lifecycle/lifecycle-supervisor";
import { Dumgen, type ScriptedDumgen } from "./managers/dumgen";
import type { ScriptedJevAnswers } from "./managers/dumgen/scripted-jev";
import { createHandlers } from "./managers/obsidian/behavior-manager";
import {
	CommandKind,
	createCommandExecutor,
} from "./managers/obsidian/command-executor";
import type { OverlayManager } from "./managers/overlay-manager";
import { confirmInModal } from "./plugin/confirm-modal";
import { changeDelimiter } from "./plugin/delimiter-migration";
import { migrateNoteMetadata } from "./plugin/note-metadata-migration";
import {
	ClassifyServices,
	DictionaryReset,
	Overlay,
	TextfresserCommands,
	UserEvents,
} from "./plugin/plugin-services";
import {
	OverlayLive,
	type PluginServicesDeps,
	PluginServicesLive,
} from "./plugin/plugin-services-live";
import { registerCommands } from "./plugin/register-commands";
import { diffSettings, snapshotSettings } from "./plugin/settings-changes";
import { whenObsidianIsReady } from "./plugin/when-obsidian-is-ready";
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
import type { TextEaterSettings } from "./types";
import { getErrorMessage } from "./utils/get-error-message";
import { IdleTracker, isE2EMode } from "./utils/idle-tracker";
import { recentTrace } from "./utils/recent-trace";

type Runtime = PluginRuntime<PluginServices, VamSetupError>;

/** The plugin runtime's services alone, without the fiber's span. */
const pluginServices = Context.pick(VaultActionManager, Dumgen, Lifecycle);

/** The services the launch built, once it built them. */
type LaunchedServices = {
	readonly vam: VaultActionManager;
	readonly classify: ClassifyServices["Service"];
	readonly textfresser: TextfresserCommands["Service"];
	readonly dictionaryReset: DictionaryReset["Service"];
	readonly delimiterChangeService: DelimiterChangeService;
};

export default class TextEaterPlugin extends Plugin {
	settings: TextEaterSettings;
	private readonly notices = createLifecycleNotices((message, { sticky }) => {
		new Notice(message, sticky ? 0 : undefined);
	});
	/** The plugin's one Effect runtime: built in `onload`, disposed in `onunload`. */
	private runtime: Runtime | null = null;
	/** The runtime's lifecycle, once the runtime is built. */
	private lifecycle: Lifecycle["Service"] | null = null;
	/**
	 * The runtime's dumgen, once built: each action runs on one build over
	 * the TypeSafe and OpenAI keys in the settings, through `requestUrl`
	 * (see `managers/dumgen/request-url-fetch.ts`).
	 */
	private dumgen: Dumgen["Service"] | null = null;
	private services: LaunchedServices | null = null;
	private overlayManager: OverlayManager | null = null;
	private previousSettings: TextEaterSettings | null = null;

	/** Whether the launch is done; the E2E driver waits for it. */
	get initialized(): boolean {
		return this.lifecycle?.state().kind === "Running";
	}

	get librarian(): Librarian | null {
		return this.lifecycle?.librarian() ?? null;
	}

	override onload() {
		try {
			const runtime = makePluginRuntime(
				PluginLive(this.app, {
					notices: this.notices,
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
					const lifecycle = yield* Lifecycle;
					this.lifecycle = lifecycle;
					this.dumgen = yield* Dumgen;
					// The launch runs with this fiber's context; this only tells
					// the types, and keeps the launch's own span the parent.
					const services = pluginServices(
						yield* Effect.context<PluginServices>(),
					);
					yield* lifecycle.launch(
						this.boot(runtime).pipe(
							Effect.provideContext(services),
						),
					);
				}),
			);
			this.addSettingTab(new SettingsTab(this.app, this));
			// Add testing command early so it exists, but callback waits for init
			this.addCommand({
				callback: () => {
					// Initialization itself exposes the service required by the test harness.
					void this.runtime?.command(
						"textfresser-testing-expose-opened-service",
						Effect.flatMap(
							Lifecycle,
							(lifecycle) => lifecycle.whenLaunched,
						),
					);
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
		this.lifecycle = null;
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
	 * and indexed the vault, in the scope the lifecycle gives it, which it
	 * closes on unload: their finalizers run newest first, before the
	 * Librarian stops and VAM shuts down.
	 */
	private boot(
		runtime: Runtime,
	): Effect.Effect<
		LaunchedPlugin<Librarian>,
		| Cause.UnknownError
		| VamSetupError
		| VamShutdownError
		| VamSubscriptionError,
		PluginServices | Scope.Scope
	> {
		return Effect.gen({ self: this }, function* () {
			yield* whenObsidianIsReady(this.app);
			yield* Effect.tryPromise(() => this.loadSettings());
			const lifecycle = yield* Lifecycle;
			const vam = yield* VaultActionManager;
			registerCommands(this, {
				dictionaryReset: () => this.services?.dictionaryReset ?? null,
				execute: (kind) => void this.executeCommand(kind),
				knowledgeQueue: () =>
					this.services?.classify.knowledgeQueue ?? null,
				restartLibrarian: lifecycle.restart,
				runtime,
				stillLoading: this.notices.stillLoading,
				vam: () => this.services?.vam ?? null,
			});

			const deps: PluginServicesDeps = {
				notices: this.notices,
				plugin: this,
				runtime,
				settings: () => this.settings,
			};
			const built = yield* Layer.build(PluginServicesLive(deps));
			const context = Context.merge(
				pluginServices(yield* Effect.context<PluginServices>()),
				built,
			);
			const classify = Context.get(built, ClassifyServices);
			const dictionaryReset = Context.get(built, DictionaryReset);
			const userEvents = Context.get(built, UserEvents);
			this.services = {
				classify,
				delimiterChangeService: new DelimiterChangeService(vam),
				dictionaryReset,
				textfresser: Context.get(built, TextfresserCommands),
				vam,
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
				loadStore: Context.get(built, DictionaryStore).get,
				makeLibrarian: (onStopped) => new Librarian(vam, { onStopped }),
				onLaunched: () =>
					Layer.build(
						OverlayLive({
							...deps,
							commandExecutor: (kind) =>
								this.executeCommand(kind),
						}),
					).pipe(
						Effect.provideContext(context),
						Effect.flatMap((overlay) =>
							Effect.sync(() => {
								this.overlayManager = Context.get(
									overlay,
									Overlay,
								);
							}),
						),
					),
				resetRunning: () => dictionaryReset.isRunning(),
				sweep: () => classify.unlinkObserver.sweep(),
			};
		});
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

	/**
	 * Runs a Textfresser, Librarian or Classify command on the active note,
	 * once the launch is done, under `command.<kind>`.
	 */
	private executeCommand(kind: CommandKind): Promise<void> {
		const runtime = this.runtime;
		if (!runtime || !this.initialized) return Promise.resolve();
		const program = Effect.gen({ self: this }, function* () {
			const services = this.services;
			const librarian = this.lifecycle?.librarian();
			if (!services || !librarian) return;
			yield* createCommandExecutor({
				classify: services.classify.classify,
				librarian,
				textfresser: yield* services.textfresser.current,
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
		const reopen = this.services?.classify.reopenReading;
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

	/** A Textfresser for the languages in the settings now. */
	private readonly rebuildTextfresser = Effect.suspend(
		() => this.services?.textfresser.rebuild ?? Effect.void,
	);

	/** Applies the changed settings, under `settings.save`, and stores them. */
	saveSettings(): Promise<void> {
		if (!this.runtime) return Promise.resolve();
		return this.runtime.settings(this.applySettings());
	}

	private applySettings() {
		return Effect.gen({ self: this }, function* () {
			const lifecycle = yield* Lifecycle;
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
							supervisor: lifecycle,
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
					if (changes.languages) yield* this.rebuildTextfresser;
					yield* lifecycle.reconfigure;
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
		const librarian = this.lifecycle?.librarian() ?? null;
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
				const current = this.lifecycle?.librarian();
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
				const current = this.lifecycle?.librarian();
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
				this.services?.classify.classify.latestHandoff() ?? null,
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
				const vam = this.services?.vam;
				if (vam) yield* vam.testing.whenSettled();
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
		const rebuild = this.rebuildTextfresser;
		await this.e2e(
			"reset-settings",
			Effect.gen(function* () {
				yield* rebuild;
				const lifecycle = yield* Lifecycle;
				yield* lifecycle.reconfigure;
			}),
		);
	}
}
