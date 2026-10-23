import {
	type VamSetupError,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import type { RecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import {
	Context,
	type Duration,
	Effect,
	Fiber,
	Layer,
	Option,
	Ref,
} from "effect";
import type { App, Plugin } from "obsidian";
import type { LifecycleNotices } from "../lifecycle/lifecycle-notices";
import { Lifecycle } from "../lifecycle/lifecycle-supervisor";
import {
	Dumgen,
	HttpTransport,
	ProviderKeys,
	type RequestUrl,
} from "../managers/dumgen";
import { PROTECTED_PATH_PREFIXES } from "../managers/obsidian/protected-paths/protected-paths-guard";
import { SettingsLive } from "../plugin/settings-live";
import { PluginData, type PluginDataError } from "../settings/plugin-data";
import type { Settings, SettingsInvalid } from "../settings/settings-service";
import { IdleTrackerLive } from "../utils/idle-tracker";
import { ObservabilityLive } from "./observability";

/** The services every program on the plugin runtime may use. */
export type PluginServices = VaultActionManager | Dumgen | Lifecycle | Settings;

/** What building the plugin's Layer fails with. */
export type PluginLiveError = VamSetupError | PluginDataError | SettingsInvalid;

export type PluginLiveDeps = {
	/** What the lifecycle tells the user. */
	readonly notices: LifecycleNotices;
	readonly trace: RecentTrace;
	/** Obsidian's `requestUrl`, which dumgen sends through. */
	readonly requestUrl: RequestUrl;
	/** Where the settings are stored: the plugin's `data.json`. */
	readonly data: Pick<Plugin, "loadData" | "saveData">;
	/** Asks the user, such as before a delimiter change renames files. */
	readonly confirm: (title: string, message: string) => Promise<boolean>;
	/** How long unloading may wait before it is logged; 5 s by default. */
	readonly slowShutdown?: Duration.Input;
};

/**
 * Logs an unload that waits long. Unloading never cuts the vault work in
 * flight: a half-done batch can leave notes half renamed, so the
 * Librarian's unsubscribe waits for its queue, and VAM's shutdown for the
 * batch it runs, however long that takes. `onunload` does not wait for
 * the disposal, so Obsidian does not either; this only makes a write that
 * hangs visible in the log and the recent trace.
 */
class ShutdownWatch extends Context.Service<
	ShutdownWatch,
	{ readonly arm: Effect.Effect<void> }
>()("textfresser/runtime/ShutdownWatch") {
	/** Below VAM: its finalizer runs once VAM has shut down, and disarms. */
	static readonly layer = (after: Duration.Input) =>
		Layer.effect(
			ShutdownWatch,
			Effect.gen(function* () {
				const armed = yield* Ref.make(Option.none<Fiber.Fiber<void>>());
				yield* Effect.addFinalizer(() =>
					Ref.get(armed).pipe(
						Effect.flatMap(
							Option.match({
								onNone: () => Effect.void,
								onSome: Fiber.interrupt,
							}),
						),
					),
				);
				return {
					arm: Effect.logWarning(
						"[TextEaterPlugin] Unloading waits for the vault work in flight to finish; it is never cut short",
					).pipe(
						Effect.delay(after),
						Effect.forkDetach,
						Effect.flatMap((fiber) =>
							Ref.set(armed, Option.some(fiber)),
						),
					),
				};
			}),
		);

	/** Above the lifecycle: its finalizer arms as the unload begins. */
	static readonly armed = Layer.effectDiscard(
		Effect.gen(function* () {
			const { arm } = yield* ShutdownWatch;
			yield* Effect.addFinalizer(() => arm);
		}),
	);
}

/**
 * The plugin's Layer: its observability and idle tracker, then VAM, then
 * the lifecycle and the stored data, then the settings, which load as the
 * runtime is built, then dumgen, which reads its keys from them. A
 * Layer's finalizers run newest first, so disposing the runtime stops the
 * lifecycle (the services it built, newest first, then the Librarian)
 * while VAM still runs, and then shuts VAM down. VAM installs no tracer or
 * logger of its own: it is given the plugin's with `provideMerge`, so its
 * vault callbacks, which run with the Layer's build context, are traced
 * and counted by the idle tracker too. The settings and dumgen hold
 * nothing to release: each dumgen action's build lives as long as the
 * action, which the runtime interrupts first.
 */
export function PluginLive(
	app: App,
	deps: PluginLiveDeps,
): Layer.Layer<PluginServices, PluginLiveError> {
	return ShutdownWatch.armed.pipe(
		Layer.provideMerge(
			Dumgen.layer.pipe(
				Layer.provide(
					Layer.mergeAll(
						HttpTransport.layer(deps.requestUrl),
						ProviderKeys.fromSettings,
					),
				),
			),
		),
		Layer.provideMerge(
			SettingsLive({ confirm: deps.confirm, notices: deps.notices }),
		),
		Layer.provideMerge(
			Layer.mergeAll(
				Lifecycle.layer({ notices: deps.notices }),
				PluginData.layer(deps.data),
			),
		),
		Layer.provideMerge(
			VaultActionManager.layer(app, {
				observability: "host",
				protectedPaths: PROTECTED_PATH_PREFIXES,
			}),
		),
		Layer.provideMerge(
			ShutdownWatch.layer(deps.slowShutdown ?? "5 seconds"),
		),
		Layer.provideMerge(IdleTrackerLive),
		Layer.provideMerge(ObservabilityLive(deps.trace)),
	);
}
