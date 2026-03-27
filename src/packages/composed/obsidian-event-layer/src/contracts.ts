import type { App, Plugin } from "obsidian";

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

export type UserEventKind =
	(typeof UserEventKind)[keyof typeof UserEventKind];

export type UserEventKindKey = keyof typeof UserEventKind;

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
		canResolveNatively: boolean;
		kind: typeof UserEventKind.WikilinkCompleted;
		linkContent: string;
		sourcePath?: string;
	};
};

export type UserPayloadFor<K extends UserEventKindKey> = UserPayloadByKey[K];

export type ActionElementPayload = UserPayloadFor<"ActionElementClicked">;
export type CheckboxPayload = UserPayloadFor<"CheckboxClicked">;
export type CheckboxFrontmatterPayload =
	UserPayloadFor<"CheckboxFrontmatterClicked">;
export type ClipboardPayload = UserPayloadFor<"ClipboardCopy">;
export type SelectAllPayload = UserPayloadFor<"SelectAll">;
export type SelectionChangedPayload = UserPayloadFor<"SelectionChanged">;
export type WikilinkClickPayload = UserPayloadFor<"WikilinkClicked">;
export type WikilinkPayload = UserPayloadFor<"WikilinkCompleted">;

export type UserEventPayloadMap = {
	[K in UserEventKindKey as (typeof UserEventKind)[K]]: UserPayloadFor<K>;
};

type UserEffectByKey = {
	ClipboardCopy: { modifiedText: string };
	SelectAll: { selection: { from: number; to: number } };
	WikilinkCompleted:
		| { aliasToInsert: string }
		| { aliasToInsert?: string; resolvedTarget: string };
};

export type UserEffectFor<K extends keyof UserEffectByKey> = UserEffectByKey[K];

export type UserEventEffectMap = {
	[K in keyof UserEffectByKey as (typeof UserEventKind)[K]]: UserEffectFor<K>;
};

type EventKindsWithEffects = keyof UserEventEffectMap;

type BaseUserEventResult =
	| { outcome: "handled" }
	| { outcome: "passthrough" };

export type UserEventResult<K extends UserEventKind> =
	| BaseUserEventResult
	| (K extends EventKindsWithEffects
			? {
					effect: UserEventEffectMap[K];
					outcome: "effect";
				}
			: never);

export type UserEventHandler<K extends UserEventKind> = {
	doesApply: (payload: UserEventPayloadMap[K]) => boolean;
	handle: (
		payload: UserEventPayloadMap[K],
	) => UserEventResult<K> | Promise<UserEventResult<K>>;
};

export type SelectionTextSource = {
	getSelectionText(): string | null;
};

export type ObsidianEventLayerDeps = {
	app: App;
	plugin: Plugin;
	selectionTextSource: SelectionTextSource;
};

export type Teardown = () => void;

export interface ObsidianEventLayer {
	setHandler<K extends UserEventKind>(
		kind: K,
		handler: UserEventHandler<K>,
	): Teardown;
	start(): void;
	stop(): void;
}
