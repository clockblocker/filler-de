/**
 * The user events the plugin answers: clicks, copy and cut, select-all,
 * selection changes and wikilink completions (`obsidian-event-layer`).
 *
 * The layer's DOM listeners and its editor extension are the plugin
 * host's, held in this Layer's scope, so closing it removes them all.
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
import { Context, Effect, Layer } from "effect";
import type { App } from "obsidian";
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
		PluginRuntime<never, unknown>,
		"readSync" | "userEvent"
	>;
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
					openLink: (target, sourcePath) =>
						workspace.openLink(target, sourcePath, false),
					readSync: deps.runtime.readSync,
					vam,
				});
			}),
		);
}
