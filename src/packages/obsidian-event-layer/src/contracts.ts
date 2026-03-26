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

export type ClipboardPayload = {
	isCut: boolean;
	kind: typeof UserEventKind.ClipboardCopy;
	originalText: string;
	sourcePath?: string;
};

export type CheckboxPayload = {
	checked: boolean;
	kind: typeof UserEventKind.CheckboxClicked;
	lineContent: string;
	sourcePath: string;
};

export type CheckboxFrontmatterPayload = {
	checked: boolean;
	kind: typeof UserEventKind.CheckboxFrontmatterClicked;
	propertyName: string;
	sourcePath: string;
};

export type ActionElementPayload = {
	actionId: string;
	kind: typeof UserEventKind.ActionElementClicked;
};

export type SelectAllPayload = {
	content: string;
	kind: typeof UserEventKind.SelectAll;
	sourcePath?: string;
};

export type WikilinkPayload = {
	canResolveNatively: boolean;
	kind: typeof UserEventKind.WikilinkCompleted;
	linkContent: string;
	sourcePath?: string;
};

export type WikilinkClickPayload = {
	blockContent: string;
	kind: typeof UserEventKind.WikilinkClicked;
	sourcePath: string;
	target: {
		alias?: string;
		basename: string;
	};
};

export type SelectionChangedPayload = {
	hasSelection: boolean;
	kind: typeof UserEventKind.SelectionChanged;
	selectedText: string;
	source: "mouse" | "keyboard" | "drag";
	sourcePath?: string;
};

export type UserEventPayloadMap = {
	[UserEventKind.ActionElementClicked]: ActionElementPayload;
	[UserEventKind.CheckboxClicked]: CheckboxPayload;
	[UserEventKind.CheckboxFrontmatterClicked]: CheckboxFrontmatterPayload;
	[UserEventKind.ClipboardCopy]: ClipboardPayload;
	[UserEventKind.SelectAll]: SelectAllPayload;
	[UserEventKind.SelectionChanged]: SelectionChangedPayload;
	[UserEventKind.WikilinkClicked]: WikilinkClickPayload;
	[UserEventKind.WikilinkCompleted]: WikilinkPayload;
};

export type UserEventEffectMap = {
	[UserEventKind.ClipboardCopy]: { modifiedText: string };
	[UserEventKind.SelectAll]: { selection: { from: number; to: number } };
	[UserEventKind.WikilinkCompleted]:
		| { aliasToInsert: string }
		| { aliasToInsert?: string; resolvedTarget: string };
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
