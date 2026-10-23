import {
	type VamSetupError,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import type { RecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import { Effect, Layer } from "effect";
import type { App } from "obsidian";
import {
	Dumgen,
	type DumgenProviderKeys,
	HttpTransport,
	ProviderKeys,
	type RequestUrl,
} from "../managers/dumgen";
import { PROTECTED_PATH_PREFIXES } from "../managers/obsidian/protected-paths/protected-paths-guard";
import { ObservabilityLive } from "./observability";

/** The services every program on the plugin runtime may use. */
export type PluginServices = VaultActionManager | Dumgen;

export type PluginLiveDeps = {
	/** The lifecycle the plugin runs; the runtime stops it before VAM. */
	readonly lifecycle: { readonly stop: Effect.Effect<void> };
	readonly trace: RecentTrace;
	/** Obsidian's `requestUrl`, which dumgen sends through. */
	readonly requestUrl: RequestUrl;
	/** The provider keys in the settings, read at each dumgen action's start. */
	readonly providerKeys: () => DumgenProviderKeys;
};

/**
 * The plugin's Layer: its observability, then VAM and dumgen, then the
 * lifecycle's release. A Layer's finalizers run newest first, so disposing
 * the runtime stops the lifecycle (its services newest first, then the
 * Librarian) while VAM still runs, and then shuts VAM down. VAM installs no
 * tracer or logger of its own: it is given the plugin's with
 * `provideMerge`, so its vault callbacks, which run with the Layer's build
 * context, are traced too. dumgen holds nothing to release: each action's
 * build lives as long as the action, which the runtime interrupts first.
 */
export function PluginLive(
	app: App,
	deps: PluginLiveDeps,
): Layer.Layer<PluginServices, VamSetupError> {
	return Layer.effectDiscard(
		Effect.addFinalizer(() => deps.lifecycle.stop),
	).pipe(
		Layer.provideMerge(
			Layer.mergeAll(
				VaultActionManager.layer(app, {
					observability: "host",
					protectedPaths: PROTECTED_PATH_PREFIXES,
				}),
				Dumgen.layer.pipe(
					Layer.provide(
						Layer.mergeAll(
							HttpTransport.layer(deps.requestUrl),
							ProviderKeys.layer(deps.providerKeys),
						),
					),
				),
			),
		),
		Layer.provideMerge(ObservabilityLive(deps.trace)),
	);
}
