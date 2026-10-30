/**
 * What the plugin registers with Obsidian: palette commands, workspace and
 * DOM listeners, editor extensions and Markdown post-processors, each held
 * in the caller's scope.
 *
 * Each registration is released once: by the scope that holds it, or by
 * Obsidian as the plugin unloads, whichever comes first. A listener is
 * handed to the plugin's `register`, as Obsidian's `registerEvent` and
 * `registerDomEvent` do, but with the scope's release, so neither releases
 * it twice. A command is removed by Obsidian on unload (`addCommand`
 * registers that itself), so the scope removes it only while the plugin is
 * still loaded: a reloaded plugin's command of the same id stays.
 */
import { Context, Effect, Layer, Scope, Tracer } from "effect";
import type {
	Editor,
	MarkdownFileInfo,
	MarkdownPostProcessor,
	MarkdownView,
	Menu,
	Plugin,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import { logAtEdge } from "../../../runtime/edge-log";
import { PluginEdges } from "../../../runtime/plugin-runtime";

/** A palette command; `run` runs under `command.<id>` each time it is invoked. */
export type HostCommand<E, R> = {
	readonly id: string;
	readonly name: string;
	/**
	 * Offered only while a Markdown editor is active. The program reads the
	 * editor through VAM, not from Obsidian's callback.
	 */
	readonly editor?: boolean;
	/** Runs with the services of the fiber that registered it. */
	readonly run: Effect.Effect<void, E, R>;
};

/** The workspace events the plugin listens to, with their arguments. */
export type WorkspaceEvents = {
	readonly "active-leaf-change": (leaf: WorkspaceLeaf | null) => void;
	readonly "editor-menu": (
		menu: Menu,
		editor: Editor,
		info: MarkdownView | MarkdownFileInfo,
	) => void;
	readonly "file-open": (file: TFile | null) => void;
	readonly "layout-change": () => void;
	readonly resize: () => void;
};

/** A CodeMirror extension, as Obsidian takes it. */
export type EditorExtension = Parameters<Plugin["registerEditorExtension"]>[0];

/** What a post-processor does to a section Reading view just rendered. */
export type PostProcessor = (
	...args: Parameters<MarkdownPostProcessor>
) => void;

type DomListener = {
	<K extends keyof WindowEventMap>(
		target: Window,
		type: K,
		handler: (event: WindowEventMap[K]) => void,
		options?: boolean | AddEventListenerOptions,
	): Effect.Effect<void, never, Scope.Scope>;
	<K extends keyof DocumentEventMap>(
		target: Document,
		type: K,
		handler: (event: DocumentEventMap[K]) => void,
		options?: boolean | AddEventListenerOptions,
	): Effect.Effect<void, never, Scope.Scope>;
	<K extends keyof HTMLElementEventMap>(
		target: HTMLElement,
		type: K,
		handler: (event: HTMLElementEventMap[K]) => void,
		options?: boolean | AddEventListenerOptions,
	): Effect.Effect<void, never, Scope.Scope>;
};

/** The parts of Obsidian's `Plugin` the host registers through. */
export type HostPlugin = Pick<
	Plugin,
	| "addCommand"
	| "removeCommand"
	| "register"
	| "registerEditorExtension"
	| "registerMarkdownPostProcessor"
> & {
	readonly app: {
		readonly workspace: Pick<
			Plugin["app"]["workspace"],
			"on" | "offref" | "updateOptions"
		>;
	};
};

export class PluginHost extends Context.Service<
	PluginHost,
	{
		/** Adds a palette command for as long as the scope is open. */
		readonly command: <E, R>(
			command: HostCommand<E, R>,
		) => Effect.Effect<void, never, R | Scope.Scope>;
		/**
		 * Calls `handler` on each `event` while the scope is open. The
		 * handler is plain code that decides within the event, such as a
		 * menu's items; what it throws is logged.
		 */
		readonly onWorkspace: <K extends keyof WorkspaceEvents>(
			event: K,
			handler: WorkspaceEvents[K],
		) => Effect.Effect<void, never, Scope.Scope>;
		/** Listens on a DOM target while the scope is open, as `onWorkspace`. */
		readonly onDom: DomListener;
		/**
		 * Puts `extension` into every editor while the scope is open. The
		 * plugin registers one list of extensions with Obsidian, once, and
		 * this adds to it and removes from it, so an extension really stops.
		 */
		readonly editorExtension: (
			extension: EditorExtension,
		) => Effect.Effect<void, never, Scope.Scope>;
		/**
		 * Runs `processor` on each section Reading view renders while the
		 * scope is open. As with editor extensions, the plugin registers one
		 * post-processor with Obsidian, once, that runs those held now; what
		 * one throws is logged.
		 */
		readonly markdownPostProcessor: (
			processor: PostProcessor,
		) => Effect.Effect<void, never, Scope.Scope>;
	}
>()("textfresser/managers/obsidian/host/PluginHost") {
	/** Over the plugin; its commands run at the runtime's `PluginEdges`. */
	static readonly layer = (plugin: HostPlugin) =>
		Layer.effect(PluginHost, makePluginHost(plugin));
}

/** `release`, run at most once however often it is called. */
function once(release: () => void): () => void {
	let released = false;
	return () => {
		if (released) return;
		released = true;
		release();
	};
}

/** `handler`, its throw logged instead of reaching Obsidian. */
function guarded<A extends readonly unknown[]>(
	what: string,
	handler: (...args: A) => void,
): (...args: A) => void {
	return (...args) => {
		try {
			handler(...args);
		} catch (error) {
			// An Obsidian or DOM callback: no Effect runs here.
			logAtEdge("Error", `[PluginHost] ${what} handler failed:`, error);
		}
	};
}

export const makePluginHost = Effect.fnUntraced(function* (plugin: HostPlugin) {
	const edges = yield* PluginEdges;
	const { workspace } = plugin.app;
	// Obsidian runs what a plugin registered only as it unloads, newest
	// first, all at once: by the time a scope's release runs, every one ran.
	let unloaded = false;
	const unloading = () => {
		unloaded = true;
	};
	plugin.register(unloading);

	/**
	 * Holds what `acquire` registered in the scope, released once. Once the
	 * plugin unloaded, nothing is registered: Obsidian would release it never.
	 */
	const held = (acquire: () => () => void) =>
		Effect.asVoid(
			Effect.acquireRelease(
				Effect.sync(() => {
					if (unloaded) return () => {};
					const release = once(acquire());
					// Newer than the flag's own callback, so it runs before it.
					plugin.register(() => {
						unloading();
						release();
					});
					return release;
				}),
				(release) => Effect.sync(release),
			),
		);

	const command = <E, R>({ editor, id, name, run }: HostCommand<E, R>) =>
		Effect.gen(function* () {
			// The registering fiber's services, without its span or scope:
			// each invocation is a root span of its own.
			const context = Context.omit(
				Tracer.ParentSpan,
				Scope.Scope,
			)(yield* Effect.context<R>()) as Context.Context<R>;
			const invoke = () => {
				void edges.command(id, Effect.provideContext(run, context));
			};
			yield* Effect.acquireRelease(
				Effect.sync(() => {
					if (unloaded) return;
					plugin.addCommand(
						editor
							? { editorCallback: invoke, id, name }
							: { callback: invoke, id, name },
					);
				}),
				() =>
					Effect.sync(() => {
						if (!unloaded) plugin.removeCommand(id);
					}),
			);
		});

	const onWorkspace = <K extends keyof WorkspaceEvents>(
		event: K,
		handler: WorkspaceEvents[K],
	) =>
		held(() => {
			const on = workspace.on as (
				name: string,
				callback: (...args: never[]) => void,
			) => ReturnType<typeof workspace.on>;
			const ref = on.call(
				workspace,
				event,
				guarded(
					`workspace "${event}"`,
					handler as (...args: never[]) => void,
				),
			);
			return () => workspace.offref(ref);
		});

	const onDom = ((
		target: EventTarget,
		type: string,
		handler: (event: Event) => void,
		options?: boolean | AddEventListenerOptions,
	) =>
		held(() => {
			const listener = guarded(`DOM "${type}"`, handler);
			target.addEventListener(type, listener, options);
			return () => target.removeEventListener(type, listener, options);
		})) as DomListener;

	const extensions: EditorExtension[] = [];
	let extensionsRegistered = false;
	const editorExtension = (extension: EditorExtension) =>
		held(() => {
			if (!extensionsRegistered) {
				extensionsRegistered = true;
				plugin.registerEditorExtension(extensions);
			}
			extensions.push(extension);
			workspace.updateOptions();
			return () => {
				const at = extensions.indexOf(extension);
				if (at !== -1) extensions.splice(at, 1);
				// Once unloaded, Obsidian has dropped the list itself.
				if (!unloaded) workspace.updateOptions();
			};
		});

	const processors: PostProcessor[] = [];
	let processorsRegistered = false;
	const markdownPostProcessor = (processor: PostProcessor) =>
		held(() => {
			if (!processorsRegistered) {
				processorsRegistered = true;
				plugin.registerMarkdownPostProcessor((element, context) => {
					for (const run of [...processors]) run(element, context);
				});
			}
			const guardedProcessor = guarded("post-processor", processor);
			processors.push(guardedProcessor);
			return () => {
				const at = processors.indexOf(guardedProcessor);
				if (at !== -1) processors.splice(at, 1);
			};
		});

	return PluginHost.of({
		command,
		editorExtension,
		markdownPostProcessor,
		onDom,
		onWorkspace,
	});
});
