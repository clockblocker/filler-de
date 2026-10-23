/**
 * Just enough DOM and Obsidian for the event layer's tests: a document
 * that dispatches events to its listeners as a browser does (capture, then
 * bubble, honouring `stopPropagation`), elements that answer `closest` and
 * `querySelectorAll` for the selectors the detectors use, an active note
 * with an editor, and a host that runs each handled event at once.
 */
import {
	EditorState,
	type Extension,
	type TransactionSpec,
} from "@codemirror/state";
import {
	makeObsidianEventLayer,
	type UserEventFork,
	type UserEventKind,
	type UserEventsHost,
} from "@textfresser/obsidian-event-layer";
import { Effect, Exit, Scope } from "effect";
import type { App } from "obsidian";

type Listener = {
	readonly type: string;
	readonly listener: (event: never) => void;
	readonly capture: boolean;
};

/** A DOM event as the detectors read it. */
export type FakeEvent = {
	readonly type: string;
	target: unknown;
	button: number;
	key: string;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
	clipboardData: FakeClipboard | null;
	defaultPrevented: boolean;
	propagationStopped: boolean;
	immediateStopped: boolean;
	preventDefault(): void;
	stopPropagation(): void;
	stopImmediatePropagation(): void;
};

/** A `DataTransfer` that holds its text. */
export type FakeClipboard = {
	text: string | undefined;
	getData(format: string): string;
	setData(format: string, data: string): void;
};

export function fakeClipboard(text?: string): FakeClipboard {
	return {
		getData: function (this: FakeClipboard) {
			return this.text ?? "";
		},
		setData: function (this: FakeClipboard, _format, data) {
			this.text = data;
		},
		text,
	};
}

export function fakeEvent(
	type: string,
	init: Partial<Omit<FakeEvent, "type">> = {},
): FakeEvent {
	return {
		altKey: false,
		button: 0,
		clipboardData: null,
		ctrlKey: false,
		defaultPrevented: false,
		immediateStopped: false,
		key: "",
		metaKey: false,
		preventDefault() {
			this.defaultPrevented = true;
		},
		propagationStopped: false,
		shiftKey: false,
		stopImmediatePropagation() {
			this.immediateStopped = true;
			this.propagationStopped = true;
		},
		stopPropagation() {
			this.propagationStopped = true;
		},
		target: null,
		...init,
		type,
	};
}

/** A document that records its listeners and dispatches to them. */
export function fakeDocument() {
	const listeners: Listener[] = [];
	const state = {
		activeElement: null as FakeElement | null,
		selection: "",
	};
	const document = {
		get activeElement() {
			return state.activeElement;
		},
		addEventListener: (
			type: string,
			listener: (event: never) => void,
			options?: boolean | AddEventListenerOptions,
		) => {
			listeners.push({ capture: captureOf(options), listener, type });
		},
		getSelection: () => ({ toString: () => state.selection }),
		removeEventListener: (
			type: string,
			listener: (event: never) => void,
			options?: boolean | AddEventListenerOptions,
		) => {
			const at = listeners.findIndex(
				(entry) =>
					entry.type === type &&
					entry.listener === listener &&
					entry.capture === captureOf(options),
			);
			if (at !== -1) listeners.splice(at, 1);
		},
	};
	/** Dispatches `event` at the document: capture listeners, then bubble ones. */
	const fire = (event: FakeEvent): FakeEvent => {
		for (const capture of [true, false]) {
			for (const entry of listeners.filter(
				(l) => l.type === event.type && l.capture === capture,
			)) {
				(entry.listener as (event: FakeEvent) => void)(event);
				if (event.immediateStopped) return event;
			}
			if (event.propagationStopped) return event;
		}
		return event;
	};
	return {
		document: document as unknown as Document,
		fire,
		listeners: () => listeners.map(({ capture, type }) => ({ capture, type })),
		state,
	};
}

const captureOf = (options?: boolean | AddEventListenerOptions) =>
	typeof options === "boolean" ? options : options?.capture === true;

/**
 * An element, matching the simple selectors the detectors use: `tag`,
 * `.class`, `tag.class` and `[attribute]`.
 */
export class FakeElement {
	readonly children: FakeElement[] = [];
	parentElement: FakeElement | null = null;
	readonly attributes = new Map<string, string>();
	readonly dataset: Record<string, string> = {};
	textContent = "";
	checked = false;
	type = "";
	readonly classList: { contains: (name: string) => boolean };

	constructor(
		readonly tagName: string,
		readonly classes: readonly string[] = [],
	) {
		this.classList = { contains: (name) => this.classes.includes(name) };
	}

	append(...children: FakeElement[]): this {
		for (const child of children) {
			child.parentElement = this;
			this.children.push(child);
		}
		return this;
	}

	setAttribute(name: string, value: string): this {
		this.attributes.set(name, value);
		const data = /^data-(.+)$/.exec(name)?.[1];
		if (data) this.dataset[data] = value;
		return this;
	}

	getAttribute(name: string): string | null {
		return this.attributes.get(name) ?? null;
	}

	hasAttribute(name: string): boolean {
		return this.attributes.has(name);
	}

	matches(selector: string): boolean {
		const attribute = /^\[([^\]]+)\]$/.exec(selector)?.[1];
		if (attribute) return this.attributes.has(attribute);
		const [tag, ...classes] = selector.split(".");
		if (tag && tag.toUpperCase() !== this.tagName) return false;
		return classes.every((name) => this.classes.includes(name));
	}

	closest(selector: string): FakeElement | null {
		for (
			let node: FakeElement | null = this;
			node;
			node = node.parentElement
		)
			if (node.matches(selector)) return node;
		return null;
	}

	querySelectorAll(selector: string): FakeElement[] {
		return this.children.flatMap((child) => [
			...(child.matches(selector) ? [child] : []),
			...child.querySelectorAll(selector),
		]);
	}

	querySelector(selector: string): FakeElement | null {
		return this.querySelectorAll(selector)[0] ?? null;
	}
}

/** An editor, as CodeMirror's view: its state, and the changes dispatched. */
export function fakeEditorView(doc: string, cursor = doc.length) {
	let state = EditorState.create({ doc, selection: { anchor: cursor } });
	const view = {
		dispatch: (spec: TransactionSpec) => {
			state = state.update(spec).state;
		},
		get state() {
			return state;
		},
	};
	return view;
}

/** The note at `path` active in source mode, with `lines` in its editor. */
export function fakeApp(
	path: string,
	options: {
		readonly lines?: readonly string[];
		readonly selection?: string;
		readonly mode?: "source" | "preview";
		readonly cm?: unknown;
	} = {},
): App {
	const filename = path.split("/").pop() ?? path;
	const view = {
		editor: {
			cm: options.cm,
			getLine: (n: number) => options.lines?.[n] ?? "",
			getSelection: () => options.selection ?? "",
		},
		file: { basename: filename.replace(/\.md$/, ""), path },
		getMode: () => options.mode ?? "source",
	};
	return {
		workspace: { getActiveViewOfType: () => view },
	} as unknown as App;
}

/**
 * The event layer over a fake document, in a scope of its own, on a host
 * that runs each handled event at once and records its fork.
 */
export function eventLayerOn(
	app: App,
	options: {
		/** What VAM reads as the editor's selection; null for none. */
		readonly selection?: string | null;
		readonly resolveLinkpath?: (link: string) => string | null;
	} = {},
) {
	const dom = fakeDocument();
	const forks: { kind: UserEventKind; fork: UserEventFork }[] = [];
	const opened: { target: string; sourcePath: string }[] = [];
	const extensions: Extension[] = [];
	const host: UserEventsHost = {
		app,
		document: dom.document,
		editorExtension: (extension) =>
			Effect.acquireRelease(
				Effect.sync(() => {
					extensions.push(extension);
				}),
				() =>
					Effect.sync(() => {
						extensions.splice(extensions.indexOf(extension), 1);
					}),
			),
		fork: (kind, program, fork) => {
			forks.push({ fork, kind });
			Effect.runFork(program);
		},
		listen: (type, handler, listenOptions) =>
			Effect.acquireRelease(
				Effect.sync(() =>
					dom.document.addEventListener(type, handler, listenOptions),
				),
				() =>
					Effect.sync(() =>
						dom.document.removeEventListener(type, handler, listenOptions),
					),
			),
		openLink: (target, sourcePath) =>
			Effect.sync(() => {
				opened.push({ sourcePath, target });
			}),
		readSync: Effect.runSyncExit,
		vam: {
			getSelectionText: () => Effect.succeed(options.selection ?? null),
			resolveLinkpath: (link) =>
				Effect.succeed(options.resolveLinkpath?.(link) ?? null),
		} as UserEventsHost["vam"],
	};
	const scope = Scope.makeUnsafe();
	const layer = Effect.runSync(
		Scope.provide(scope)(makeObsidianEventLayer(host)),
	);
	return {
		...dom,
		close: () => Effect.runSync(Scope.close(scope, Exit.void)),
		extensions,
		forks,
		layer,
		opened,
	};
}
