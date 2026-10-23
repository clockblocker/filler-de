import type { Extension } from "@codemirror/state";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import type { Cause, Effect, Exit, Scope } from "effect";
import type { App } from "obsidian";

export const UserEventKind = {
	ActionElementClicked: "actionElementClicked",
	CheckboxClicked: "checkboxClicked",
	CheckboxFrontmatterClicked: "checkboxFrontmatterClicked",
	ClipboardCopy: "clipboardCopy",
	SelectAll: "selectAll",
	SelectionChanged: "selectionChanged",
	WikilinkClicked: "wikilinkClicked",
	WikilinkCompleted: "wikilinkCompleted",
} as const;

export type UserEventKind = (typeof UserEventKind)[keyof typeof UserEventKind];

type UserPayloadByKey = {
	ActionElementClicked: {
		actionId: string;
		kind: typeof UserEventKind.ActionElementClicked;
	};
	CheckboxClicked: {
		checked: boolean;
		kind: typeof UserEventKind.CheckboxClicked;
		lineContent: string;
		sourcePath: string;
	};
	CheckboxFrontmatterClicked: {
		checked: boolean;
		kind: typeof UserEventKind.CheckboxFrontmatterClicked;
		propertyName: string;
		sourcePath: string;
	};
	ClipboardCopy: {
		isCut: boolean;
		kind: typeof UserEventKind.ClipboardCopy;
		originalText: string;
		sourcePath?: string;
	};
	SelectAll: {
		content: string;
		kind: typeof UserEventKind.SelectAll;
		sourcePath?: string;
	};
	SelectionChanged: {
		hasSelection: boolean;
		kind: typeof UserEventKind.SelectionChanged;
		selectedText: string;
		source: "mouse" | "keyboard" | "drag";
		sourcePath?: string;
	};
	WikilinkClicked: {
		blockContent: string;
		kind: typeof UserEventKind.WikilinkClicked;
		sourcePath: string;
		target: {
			alias?: string;
			basename: string;
		};
	};
	WikilinkCompleted: {
		/** Whether the link is an embed, `![[…]]`. */
		embed: boolean;
		kind: typeof UserEventKind.WikilinkCompleted;
		linkContent: string;
		/**
		 * Where Obsidian resolves the link from its source note; absent when
		 * it resolves nowhere. VAM resolves it as the event is handled, so
		 * `doesApply` is asked before it is known.
		 */
		resolvedPath?: string;
		sourcePath?: string;
	};
};

export type PayloadFor<K extends keyof typeof UserEventKind> =
	UserPayloadByKey[K];

export type UserEventPayloadMap = {
	[K in keyof typeof UserEventKind as (typeof UserEventKind)[K]]: PayloadFor<K>;
};

/**
 * What `doesApply` is asked about, inside the DOM or editor event: the
 * payload, less what is only read once the event is handled.
 */
export type UserEventDecisionMap = Omit<
	UserEventPayloadMap,
	typeof UserEventKind.WikilinkCompleted
> & {
	[UserEventKind.WikilinkCompleted]: Omit<
		PayloadFor<"WikilinkCompleted">,
		"resolvedPath"
	>;
};

type UserEffectByKey = {
	ClipboardCopy: { modifiedText: string };
	SelectAll: { selection: { from: number; to: number } };
	WikilinkCompleted:
		| { aliasToInsert: string }
		| { aliasToInsert?: string; resolvedTarget: string };
};

export type UserEffectFor<K extends keyof UserEffectByKey> = UserEffectByKey[K];

type UserEventEffectMap = {
	[K in keyof UserEffectByKey as (typeof UserEventKind)[K]]: UserEffectFor<K>;
};

type EventKindsWithEffects = keyof UserEventEffectMap;

type BaseUserEventResult = { outcome: "handled" } | { outcome: "passthrough" };

export type UserEventResult<K extends UserEventKind> =
	| BaseUserEventResult
	| (K extends EventKindsWithEffects
			? {
					effect: UserEventEffectMap[K];
					outcome: "effect";
				}
			: never);

/** How a handler's program may fail: a tagged error, logged at its edge. */
export type UserEventFailure = Cause.YieldableError & {
	readonly _tag: string;
};

export type UserEventHandler<K extends UserEventKind> = {
	/**
	 * Whether the handler takes the event. Plain and synchronous: it is
	 * asked inside the DOM or editor event, which it decides, such as
	 * whether a click's default is prevented.
	 */
	readonly doesApply: (payload: UserEventDecisionMap[K]) => boolean;
	/**
	 * The handling, run on the host's runtime under `user-event.<kind>`.
	 * The layer applies its result in the same fiber: a clipboard text, a
	 * selection, an editor change, or a link it opens.
	 */
	readonly handle: (
		payload: UserEventPayloadMap[K],
	) => Effect.Effect<UserEventResult<K>, UserEventFailure>;
	/**
	 * Work of the same gesture that runs once the result is applied, in
	 * the same fiber and span, such as reopening a clicked note later. It
	 * runs whether or not the layer could apply the result, as a link that
	 * failed to open; not when `handle` failed.
	 */
	readonly afterwards?: (
		payload: UserEventPayloadMap[K],
	) => Effect.Effect<void, UserEventFailure>;
};

/** Whether a handled event of a kind opens a span: frequent kinds do not. */
export type UserEventFork = {
	/**
	 * False for an event too frequent to trace, such as a selection
	 * change, or one whose work opens its own root, such as a toolbar
	 * button's command.
	 */
	readonly traced: boolean;
};

/**
 * What the layer is given by its host: Obsidian's app for the synchronous
 * reads that decide an event, the plugin host's listeners and editor
 * extensions, the runtime to run handlers on, VAM, and the workspace.
 */
export type UserEventsHost = {
	/** For the reads that decide an event, such as the active note. */
	readonly app: App;
	/** The document the layer listens on, and reads the focus of. */
	readonly document: Document;
	/** Listens on `document` while the scope is open (`PluginHost.onDom`). */
	readonly listen: <K extends keyof DocumentEventMap>(
		type: K,
		handler: (event: DocumentEventMap[K]) => void,
		options?: AddEventListenerOptions,
	) => Effect.Effect<void, never, Scope.Scope>;
	/** Puts `extension` into every editor while the scope is open. */
	readonly editorExtension: (
		extension: Extension,
	) => Effect.Effect<void, never, Scope.Scope>;
	/**
	 * Runs a handled event's program on the host's runtime, under
	 * `user-event.<kind>` unless untraced, counted as pending work while it
	 * runs, its failure logged. It starts at once, inside the event: a
	 * program that never waits ends before the event's dispatch does.
	 */
	readonly fork: (
		kind: UserEventKind,
		program: Effect.Effect<void, UserEventFailure>,
		options: UserEventFork,
	) => void;
	/** Runs a small read at once, inside the event it decides. */
	readonly readSync: <A, E>(
		effect: Effect.Effect<A, E>,
	) => Exit.Exit<A, unknown>;
	/** The selection a copy reads, and where a completed link resolves. */
	readonly vam: Pick<
		VaultActionManager,
		"getSelectionText" | "resolveLinkpath"
	>;
	/** Opens a link from a note in the active leaf (`Workspace.openLink`). */
	readonly openLink: (
		target: string,
		sourcePath: string,
	) => Effect.Effect<void, UserEventFailure>;
};

export type Teardown = () => void;

export interface ObsidianEventLayer {
	/**
	 * Sets the one handler of `kind`, in place of any before it, until the
	 * returned teardown runs.
	 */
	setHandler<K extends UserEventKind>(
		kind: K,
		handler: UserEventHandler<K>,
	): Teardown;
}
