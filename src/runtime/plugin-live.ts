import {
	type VamSetupError,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import type { RecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import { Effect, Layer } from "effect";
import type { App } from "obsidian";
import { PROTECTED_PATH_PREFIXES } from "../managers/obsidian/protected-paths/protected-paths-guard";
import { ObservabilityLive } from "./observability";

/** The services every program on the plugin runtime may use. */
export type PluginServices = VaultActionManager;

export type PluginLiveDeps = {
	/** The lifecycle the plugin runs; the runtime stops it before VAM. */
	readonly lifecycle: { readonly stop: Effect.Effect<void> };
	readonly trace: RecentTrace;
};

/**
 * The plugin's Layer: its observability, then VAM, then the lifecycle's
 * release. A Layer's finalizers run newest first, so disposing the runtime
 * stops the lifecycle (its services newest first, then the Librarian) while
 * VAM still runs, and then shuts VAM down. VAM installs no tracer or logger
 * of its own: it is given the plugin's with `provideMerge`, so its vault
 * callbacks, which run with the Layer's build context, are traced too.
 */
export function PluginLive(
	app: App,
	deps: PluginLiveDeps,
): Layer.Layer<PluginServices, VamSetupError> {
	return Layer.effectDiscard(
		Effect.addFinalizer(() => deps.lifecycle.stop),
	).pipe(
		Layer.provideMerge(
			VaultActionManager.layer(app, {
				observability: "host",
				protectedPaths: PROTECTED_PATH_PREFIXES,
			}),
		),
		Layer.provideMerge(ObservabilityLive(deps.trace)),
	);
}
