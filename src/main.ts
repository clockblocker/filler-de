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
	Cause,
	Context,
	Deferred,
	Effect,
	Exit,
	Layer,
	Option,
	type Scope,
} from "effect";
import { Plugin, requestUrl } from "obsidian";
import { RESET_UNLOADED } from "./commanders/dictionary-reset/reset-command";
import { Librarian } from "./commanders/librarian/librarian";
import { DictionaryStore } from "./lifecycle/dictionary-store-service";
import { createLifecycleNotices } from "./lifecycle/lifecycle-notices";
import {
	type LaunchedPlugin,
	Lifecycle,
} from "./lifecycle/lifecycle-supervisor";
import { Dumgen, type ScriptedDumgen } from "./managers/dumgen";
import type { ScriptedJevAnswers } from "./managers/dumgen/scripted-jev";
import { createHandlers } from "./managers/obsidian/behavior-manager";
import { CommandKind } from "./managers/obsidian/command-executor";
import {
	Confirm,
	Notices,
	obsidianNotices,
	PluginHost,
	Workspace,
} from "./managers/obsidian/host";
import { ObsidianHostLive } from "./managers/obsidian/host/live";
import type { OverlayManager } from "./managers/overlay-manager";
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
import {
	commandKindProgram,
	launchCommands,
	registerCommands,
	serviceCommands,
} from "./plugin/register-commands";
import { whenObsidianIsReady } from "./plugin/when-obsidian-is-ready";
import { logAtEdge } from "./runtime/edge-log";
import {
	PluginLive,
	type PluginLiveError,
	type PluginServices,
} from "./runtime/plugin-live";
import {
	makePluginRuntime,
	PluginEdgeError,
	type PluginRuntime,
} from "./runtime/plugin-runtime";
import { SettingsTab } from "./settings";
import type { SettingsPatch } from "./settings/settings-changes";
import { Settings, type SettingsInvalid } from "./settings/settings-service";
import type { TextEaterSettings } from "./types";
import { getErrorMessage } from "./utils/get-error-message";
import { IdleTracker, isE2EMode } from "./utils/idle-tracker";
import { recentTrace } from "./utils/recent-trace";

type Runtime = PluginRuntime<PluginServices, PluginLiveError>;

/** The plugin runtime's services alone, without the fiber's span. */
const pluginServices = Context.pick(
	VaultActionManager,
	Dumgen,
	Lifecycle,
	Settings,
	PluginHost,
	Notices,
	Confirm,
	Workspace,
	IdleTracker,
);

/** The services the launch built, once it built them. */
type LaunchedServices = {
	readonly vam: VaultActionManager;
	readonly classify: ClassifyServices["Service"];
	readonly textfresser: TextfresserCommands["Service"];
	readonly dictionaryReset: DictionaryReset["Service"];
	/** A command kind's program, as the palette and the toolbars run it. */
	readonly commandProgram: (kind: CommandKind) => Effect.Effect<void>;
};

export default class TextEaterPlugin extends Plugin {
	private readonly notices = createLifecycleNotices(obsidianNotices.show);
	/** The plugin's one Effect runtime: built in `onload`, disposed in `onunload`. */
	private runtime: Runtime | null = null;
	/** The runtime's lifecycle, once the runtime is built. */
	private lifecycle: Lifecycle["Service"] | null = null;
	/**
	 * The runtime's dumgen, once built: each action runs on one build over
	 * the TypeSafe and OpenAI keys in the settings, through `requestUrl`
	 * (see `managers/obsidian/host/request-url-fetch.ts`).
	 */
	private dumgen: Dumgen["Service"] | null = null;
	/** The runtime's settings, once the runtime is built and loaded them. */
	private settingsService: Settings["Service"] | null = null;
	private services: LaunchedServices | null = null;
	private overlayManager: OverlayManager | null = null;

	/** Whether the launch is done; the E2E driver waits for it. */
	get initialized(): boolean {
		return this.lifecycle?.state().kind === "Running";
	}

	get librarian(): Librarian | null {
		return this.lifecycle?.librarian() ?? null;
	}

	/**
	 * The settings in effect, as `data.json` stores them; undefined until
	 * the runtime loaded them, and after unload. The settings tab and the
	 * E2E driver read them here; changes go through `updateSettings`.
	 */
	get settings(): TextEaterSettings | undefined {
		return this.settingsService?.rawNow();
	}

	/** Why the settings in effect cannot be run under, if they cannot. */
	get settingsProblem(): string | undefined {
		return this.settingsService?.invalid()?.message;
	}

	override onload() {
		try {
			const runtime = makePluginRuntime(
				PluginLive(this.app, {
					data: this,
					host: ObsidianHostLive(this),
					notices: this.notices,
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
					this.settingsService = yield* Settings;
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
			this.addSettingTab(
				new SettingsTab(this.app, this, obsidianNotices),
			);
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
		this.settingsService = null;
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
			);
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
		| SettingsInvalid
		| VamSetupError
		| VamShutdownError
		| VamSubscriptionError,
		PluginServices | Scope.Scope
	> {
		return Effect.gen({ self: this }, function* () {
			yield* whenObsidianIsReady(this.app);
			const lifecycle = yield* Lifecycle;
			const settings = yield* Settings;
			// The tab still shows settings that cannot be run under, so a
			// save there can fix them; only the launch fails.
			const invalid = settings.invalid();
			if (invalid) return yield* invalid;
			const vam = yield* VaultActionManager;
			const notices = yield* Notices;
			// In the services' scope: unloading removes them with the services.
			yield* registerCommands(launchCommands({ lifecycle, notices }));
			const deps: PluginServicesDeps = {
				notices: this.notices,
				plugin: this,
				runtime,
			};
			const built = yield* Layer.build(PluginServicesLive(deps));
			const context = Context.merge(
				pluginServices(yield* Effect.context<PluginServices>()),
				built,
			);
			const classify = Context.get(built, ClassifyServices);
			const dictionaryReset = Context.get(built, DictionaryReset);
			const userEvents = Context.get(built, UserEvents);
			const commands = {
				classify,
				dictionaryReset,
				idle: yield* IdleTracker,
				lifecycle,
				notices,
				textfresser: Context.get(built, TextfresserCommands),
				vam,
			};
			yield* registerCommands(serviceCommands(commands));
			const commandProgram = commandKindProgram(commands);
			this.services = {
				classify,
				commandProgram,
				dictionaryReset,
				textfresser: commands.textfresser,
				vam,
			};
			return {
				attachLibrarian: (librarian) => {
					const teardowns = createHandlers(
						librarian,
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
				makeLibrarian: (onStopped) =>
					Librarian.make(vam, { onStopped, settings }),
				onLaunched: () =>
					Layer.build(
						OverlayLive({
							...deps,
							commandExecutor: (kind) =>
								runtime.command(kind, commandProgram(kind)),
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
				sweep: classify.unlinkObserver.sweep,
			};
		});
	}

	/**
	 * Runs a Textfresser, Librarian or Classify command on the active note,
	 * once the launch is done, under `command.<kind>`, as a toolbar does.
	 */
	private executeCommand(kind: CommandKind): Promise<void> {
		const { runtime, services } = this;
		if (!runtime || !services) return Promise.resolve();
		return runtime.command(kind, services.commandProgram(kind));
	}

	/**
	 * A clicked Reading link reopens its note once its Knowledge lands; it
	 * runs in the click's fiber, under `user-event.wikilinkClicked`.
	 */
	private readonly onWikilinkClicked = (
		target: string,
	): Effect.Effect<void> =>
		Effect.suspend(() => {
			const reopen = this.services?.classify.reopenReading;
			if (!reopen) return Effect.void;
			return reopen(target).pipe(
				Effect.asVoid,
				Effect.catch((error) =>
					Effect.logWarning(
						"[TextEaterPlugin] Could not reopen the Reading note:",
						getErrorMessage(error),
					),
				),
			);
		});

	/**
	 * Applies `patch` to the settings under `settings.update`, once the
	 * launch ended and every update before it is done; resolves once it
	 * is applied and stored. The settings tab calls it.
	 */
	updateSettings(patch: SettingsPatch): Promise<void> {
		if (!this.runtime) return Promise.resolve();
		return this.runtime.settings(
			Effect.flatMap(Settings, (settings) => settings.update(patch)),
		);
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
		// One Promise per step, so the driver can tell a new step from the last.
		const awaited = new WeakMap<object, Promise<unknown>>();
		// A wait the unload interrupts answers as the step itself then does.
		const awaitShown = <A>(
			hook: string,
			shown: Deferred.Deferred<A> | null | undefined,
			unloaded: A,
		): Promise<A> | null => {
			if (!shown) return null;
			let promise = awaited.get(shown) as Promise<A> | undefined;
			if (!promise) {
				promise = this.e2e(hook, Deferred.await(shown)).catch(
					(error: unknown) =>
						error instanceof PluginEdgeError &&
						Cause.hasInterruptsOnly(error.cause)
							? unloaded
							: Promise.reject(error),
				);
				awaited.set(shown, promise);
			}
			return promise;
		};
		return {
			clickButton: (label: string) =>
				reset()?.clickButton(label) ?? false,
			closeModal: () => reset()?.closeModal(),
			lastDryRun: () =>
				awaitShown(
					"dictionary-reset-dry-run",
					reset()?.lastDryRun(),
					RESET_UNLOADED.dryRun,
				),
			lastExecute: () =>
				awaitShown(
					"dictionary-reset-execute",
					reset()?.lastExecute(),
					RESET_UNLOADED.execute,
				),
			lastOpening: () =>
				awaitShown(
					"dictionary-reset-opening",
					reset()?.lastOpening(),
					RESET_UNLOADED.opening,
				),
		};
	}

	/**
	 * E2E test hook: records VAM's Markdown modify observations below one
	 * vault folder until closed. Paths are vault-relative system paths.
	 */
	observeMdModificationsForTesting(folderPath: string): Promise<{
		readonly close: () => Promise<void>;
		readonly read: () => readonly {
			readonly mtime: number;
			readonly path: string;
			readonly size: number;
		}[];
	}> {
		const vam = this.services?.vam;
		if (!vam)
			return Promise.reject(new Error("Textfresser is still loading"));
		const folder = splitPathCodec.parse(folderPath);
		if (folder.kind !== SplitPathKind.Folder) {
			return Promise.reject(
				new Error(`Expected a folder path, got '${folderPath}'`),
			);
		}
		const observed: { mtime: number; path: string; size: number }[] = [];
		return this.e2e(
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
		).then((subscription) => ({
			close: () =>
				this.e2e("close-md-modification-observer", subscription.close),
			read: () => [...observed],
		}));
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
	 * E2E test hook: puts the given settings into effect and restarts the
	 * Librarian, without the delimiter and metadata migrations, and so
	 * without their confirmation dialog: each scenario lays out its notes.
	 */
	resetSettingsForTesting(
		newSettings: Partial<TextEaterSettings>,
	): Promise<void> {
		return this.e2e(
			"reset-settings",
			Effect.flatMap(Settings, (settings) =>
				settings.update(newSettings, {
					migrate: false,
					restartLibrarian: true,
				}),
			),
		);
	}
}
