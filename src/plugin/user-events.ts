/**
 * The user events the plugin answers: clicks, copy and cut, select-all,
 * selection changes and wikilink completions (`obsidian-event-layer`).
 *
 * The layer's DOM listeners, its editor extension and its Reading view
 * post-processor are the plugin host's, held in this Layer's scope, so
 * closing it removes them all.
 * Each handled event runs on the plugin runtime at its own edge,
 * `user-event.<kind>`, counted as pending work until it ends. Selection
 * changes and toolbar button clicks run untraced: the first are frequent,
 * and a button's command opens its own `command.<kind>`.
 */
import {
	makeObsidianEventLayer,
	type ObsidianEventLayer,
} from "@textfresser/obsidian-event-layer";
import { VaultActionManager } from "@textfresser/vault-action-manager";
import { Context, Effect, Layer, Scope } from "effect";
import type { App } from "obsidian";
import type { TaggedFailure } from "../lifecycle/lifecycle-errors";
import type { LifecycleNotices } from "../lifecycle/lifecycle-notices";
import { releaseGuarded } from "../lifecycle/lifecycle-supervisor";
import { PluginHost, Workspace } from "../managers/obsidian/host";
import type { PluginRuntime } from "../runtime/plugin-runtime";
import { IdleTracker } from "../utils/idle-tracker";

/** What the Layer takes from the plugin. */
export type UserEventsDeps = {
	readonly app: App;
	/** The document the layer listens on; Obsidian's main window's. */
	readonly document: Document;
	/** Where handled events run, and the reads that decide them. */
	readonly runtime: Pick<
		PluginRuntime<never, TaggedFailure>,
		"readSync" | "userEvent"
	>;
	/** Told when the layer's listeners or extension fail to be released. */
	readonly notices: Pick<LifecycleNotices, "releaseFailed">;
};

export class UserEvents extends Context.Service<
	UserEvents,
	ObsidianEventLayer
>()("textfresser/plugin/UserEvents") {
	static readonly layer = (deps: UserEventsDeps) =>
		Layer.effect(
			UserEvents,
			Effect.gen(function* () {
				const host = yield* PluginHost;
				const workspace = yield* Workspace;
				const vam = yield* VaultActionManager;
				const idle = yield* IdleTracker;
				// The layer's registrations, released together: one that fails,
				// such as the editors refusing to drop the extension, is told,
				// and the services released after it still are.
				const registrations = yield* Scope.make();
				yield* Effect.addFinalizer((exit) =>
					releaseGuarded(
						deps.notices,
						"stop the user event interceptor",
						Scope.close(registrations, exit),
					),
				);
				return yield* makeObsidianEventLayer({
					app: deps.app,
					document: deps.document,
					editorExtension: host.editorExtension,
					fork: (kind, program, { traced }) => {
						void deps.runtime.userEvent(kind, idle.track(program), {
							traced,
						});
					},
					listen: (type, handler, options) =>
						host.onDom(deps.document, type, handler, options),
					markdownPostProcessor: host.markdownPostProcessor,
					openLink: (target, sourcePath) =>
						workspace.openLink(target, sourcePath, false),
					readSync: deps.runtime.readSync,
					vam,
				}).pipe(Scope.provide(registrations));
			}),
		);
}
